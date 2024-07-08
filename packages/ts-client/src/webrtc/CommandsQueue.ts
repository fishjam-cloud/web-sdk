import type {
  AddTrackCommand,
  Command,
  RemoveTrackCommand,
  ReplaceTackCommand,
} from './commands';
import type { Deferred } from './deferred';
import { findSender, isTrackInUse } from './RTCPeerConnectionUtils';
import { isTrackKind, TrackContextImpl } from './internal';
import { addTrackToConnection, setTransceiverDirection } from './transciever';
import { generateCustomEvent, generateMediaEvent } from './mediaEvent';
import type { StateManager } from './StateManager';
import type { NegotiationManager } from './NegotiationManager';
import type { WebRTCEndpoint } from './webRTCEndpoint';
import type { MetadataParser } from './types';

export class CommandsQueue<EndpointMetadata, TrackMetadata> {
  private readonly stateManager: StateManager<EndpointMetadata, TrackMetadata>;
  private negotiationManager: NegotiationManager;
  private webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>;
  private readonly trackMetadataParser: MetadataParser<TrackMetadata>;

  private clearConnectionCallbacks: (() => void) | null = null;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
    stateManager: StateManager<EndpointMetadata, TrackMetadata>,
    negotiationManager: NegotiationManager,
    trackMetadataParser: MetadataParser<TrackMetadata>,
  ) {
    this.webrtc = webrtc;
    this.stateManager = stateManager;
    this.negotiationManager = negotiationManager;
    this.trackMetadataParser = trackMetadataParser;
  }

  public setupEventListeners(connection: RTCPeerConnection) {
    const onSignalingStateChange = () => {
      switch (this.stateManager.connection?.signalingState) {
        case 'stable':
          this.processNextCommand();
          break;
      }
    };

    const onIceGatheringStateChange = () => {
      switch (this.stateManager.connection?.iceGatheringState) {
        case 'complete':
          this.processNextCommand();
          break;
      }
    };

    const onConnectionStateChange = () => {
      switch (connection.connectionState) {
        case 'connected':
          this.processNextCommand();
          break;
      }
    };
    const onIceConnectionStateChange = () => {
      switch (this.stateManager.connection?.iceConnectionState) {
        case 'connected':
          this.processNextCommand();
          break;
      }
    };

    this.clearConnectionCallbacks = () => {
      connection.removeEventListener(
        'signalingstatechange',
        onSignalingStateChange,
      );
      connection.removeEventListener(
        'icegatheringstatechange',
        onIceGatheringStateChange,
      );
      connection.removeEventListener(
        'connectionstatechange',
        onConnectionStateChange,
      );
      connection.removeEventListener(
        'iceconnectionstatechange',
        onIceConnectionStateChange,
      );
    };

    connection.addEventListener(
      'icegatheringstatechange',
      onIceConnectionStateChange,
    );
    connection.addEventListener(
      'connectionstatechange',
      onConnectionStateChange,
    );
    connection.addEventListener(
      'iceconnectionstatechange',
      onIceConnectionStateChange,
    );
    connection.addEventListener('signalingstatechange', onSignalingStateChange);
  }

  private commandsQueue: Command<TrackMetadata>[] = [];
  private commandResolutionNotifier: Deferred<void> | null = null;

  public pushCommand(command: Command<TrackMetadata>) {
    this.commandsQueue.push(command);
    this.processNextCommand();
  }

  public processNextCommand() {
    if (
      this.negotiationManager.ongoingRenegotiation ||
      this.stateManager.ongoingTrackReplacement
    )
      return;

    if (
      this.stateManager.connection &&
      (this.stateManager.connection.signalingState !== 'stable' ||
        this.stateManager.connection.connectionState !== 'connected' ||
        this.stateManager.connection.iceConnectionState !== 'connected')
    )
      return;

    this.resolvePreviousCommand();

    const command = this.commandsQueue.shift();

    if (!command) return;

    this.commandResolutionNotifier = command.resolutionNotifier;
    this.handleCommand(command);
  }

  private handleCommand(command: Command<TrackMetadata>) {
    switch (command.commandType) {
      case 'ADD-TRACK':
        this.addTrackHandler(command);
        break;
      case 'REPLACE-TRACK':
        this.replaceTrackHandler(command);
        break;
      case "COMMAND-WITH-HANDLER":
        command.handler()
        break;
    }
  }

  private addTrackHandler(addTrackCommand: AddTrackCommand<TrackMetadata>) {
    const {
      simulcastConfig,
      maxBandwidth,
      track,
      stream,
      trackMetadata,
      trackId,
    } = addTrackCommand;
    const isUsedTrack = isTrackInUse(this.stateManager.connection, track);

    let error;
    if (isUsedTrack) {
      error =
        "This track was already added to peerConnection, it can't be added again!";
    }

    if (!simulcastConfig.enabled && !(typeof maxBandwidth === 'number'))
      error =
        'Invalid type of `maxBandwidth` argument for a non-simulcast track, expected: number';
    if (this.stateManager.getEndpointId() === '')
      error = 'Cannot add tracks before being accepted by the server';

    if (error) {
      this.commandResolutionNotifier?.reject(error);
      this.commandResolutionNotifier = null;
      this.processNextCommand();
      return;
    }

    this.negotiationManager.ongoingRenegotiation = true;

    const trackContext = new TrackContextImpl(
      this.stateManager.localEndpoint,
      trackId,
      trackMetadata,
      simulcastConfig,
      this.trackMetadataParser,
    );

    if (!isTrackKind(track.kind)) throw new Error('Track has no kind');

    trackContext.track = track;
    trackContext.stream = stream;
    trackContext.maxBandwidth = maxBandwidth;
    trackContext.trackKind = track.kind;

    this.stateManager.localEndpoint.tracks.set(trackId, trackContext);

    this.stateManager.localTrackIdToTrack.set(trackId, trackContext);

    if (this.stateManager.connection) {
      addTrackToConnection(
        trackContext,
        this.stateManager.disabledTrackEncodings,
        this.stateManager.connection,
      );

      setTransceiverDirection(this.stateManager.connection);
    }

    this.stateManager.trackIdToSender.set(trackId, {
      remoteTrackId: trackId,
      localTrackId: track.id,
      sender: null,
    });
    const mediaEvent = generateCustomEvent({ type: 'renegotiateTracks' });
    this.webrtc.sendMediaEvent(mediaEvent);
  }

  private async replaceTrackHandler(
    command: ReplaceTackCommand<TrackMetadata>,
  ) {
    const { trackId, newTrack, newTrackMetadata } = command;

    // todo add validation to track.kind, you cannot replace video with audio

    const trackContext = this.stateManager.localTrackIdToTrack.get(trackId)!;

    const track = this.stateManager.trackIdToSender.get(trackId);
    const sender = track?.sender ?? null;

    if (!track) throw Error(`There is no track with id: ${trackId}`);
    if (!sender) throw Error('There is no RTCRtpSender for this track id!');

    this.stateManager.ongoingTrackReplacement = true;

    trackContext.stream?.getTracks().forEach((track) => {
      trackContext.stream?.removeTrack(track);
    });

    if (newTrack) {
      trackContext.stream?.addTrack(newTrack);
    }

    if (trackContext.track && !newTrack) {
      const mediaEvent = generateMediaEvent('muteTrack', { trackId: trackId });
      this.webrtc.sendMediaEvent(mediaEvent);
      this.webrtc.emit('localTrackMuted', { trackId: trackId });
    } else if (!trackContext.track && newTrack) {
      const mediaEvent = generateMediaEvent('unmuteTrack', {
        trackId: trackId,
      });
      this.webrtc.sendMediaEvent(mediaEvent);
      this.webrtc.emit('localTrackUnmuted', { trackId: trackId });
    }

    track.localTrackId = newTrack?.id ?? null;

    try {
      await sender.replaceTrack(newTrack);
      trackContext.track = newTrack;

      if (newTrackMetadata) {
        this.webrtc.updateTrackMetadata(trackId, newTrackMetadata);
      }
    } catch (error) {
      // ignore
    } finally {
      this.resolvePreviousCommand();
      this.stateManager.ongoingTrackReplacement = false;
      this.processNextCommand();
    }
  }

  private resolvePreviousCommand() {
    if (this.commandResolutionNotifier) {
      this.commandResolutionNotifier.resolve();
      this.commandResolutionNotifier = null;
    }
  }

  public clenUp() {
    this.commandResolutionNotifier?.reject('Disconnected');
    this.commandResolutionNotifier = null;
    this.commandsQueue = [];
    this.clearConnectionCallbacks?.();
  }
}
