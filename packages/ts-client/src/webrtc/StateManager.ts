import type {
  BandwidthLimit,
  MetadataParser,
  SimulcastConfig,
  TrackBandwidthLimit,
  Encoding,
} from './types';
import type { EndpointWithTrackContext } from './internal';
import { generateCustomEvent, generateMediaEvent } from './mediaEvent';
import type { WebRTCEndpoint } from './webRTCEndpoint';
import type { NegotiationManager } from './NegotiationManager';
import type { TrackId } from "./tracks/Remote";
import { Remote } from "./tracks/Remote";
import { Connection } from "./Connection";
import { Local } from "./tracks/Local";

// localEndpoint + EndpointWithTrackContext

// trackId from signaling Event + TrackContextImpl
// endpointId from signaling Event + EndpointWithTrackContext

// locally generated track id (uuid) + TrackContextImpl
// locally generated track id (uuid) + RTCRtpSender
// locally generated track id (uuid) + TrackEncoding

// mid + trackId from signaling Event

export class StateManager<EndpointMetadata, TrackMetadata> {
  public connection?: Connection;

  private readonly local: Local<EndpointMetadata, TrackMetadata>;
  public ongoingTrackReplacement: boolean = false;

  // temporary for webrtc.emit and webrtc.sendMediaEvent
  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>;
  private readonly negotiationManager: NegotiationManager;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
    negotiationManager: NegotiationManager,
    local: Local<EndpointMetadata, TrackMetadata>,
  ) {
    this.webrtc = webrtc;
    this.negotiationManager = negotiationManager;
    this.local = local
  }

  public validateAddTrack = (
    track: MediaStreamTrack,
    simulcastConfig: SimulcastConfig,
    maxBandwidth: TrackBandwidthLimit,
  ): string | null => {
    if (this.getEndpointId() === '') {
      return 'Cannot add tracks before being accepted by the server';
    }

    if (!simulcastConfig.enabled && !(typeof maxBandwidth === 'number')) {
      return 'Invalid type of `maxBandwidth` argument for a non-simulcast track, expected: number';
    }

    if (this.connection?.isTrackInUse(track)) {
      return "This track was already added to peerConnection, it can't be added again!";
    }

    return null;
  };

  public addTrackHandler = (
    trackId: string,
    track: MediaStreamTrack,
    stream: MediaStream,
    trackMetadata: TrackMetadata | undefined,
    simulcastConfig: SimulcastConfig,
    maxBandwidth: TrackBandwidthLimit,
  ) => {
    this.negotiationManager.ongoingRenegotiation = true;

    const trackManager = this.local.addTrack(this.connection, trackId, track, stream, trackMetadata, simulcastConfig, maxBandwidth)

    if (this.connection) {
      trackManager.addTrackToConnection();
      this.connection.setTransceiverDirection()
    }

    const mediaEvent = generateCustomEvent({ type: 'renegotiateTracks' });
    this.webrtc.sendMediaEvent(mediaEvent);
  };

  public removeTrackHandler = (trackId: string) => {
    this.negotiationManager.ongoingRenegotiation = true;

    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)

    this.local.removeTrack(trackId)
  };

  public replaceTrackHandler = async (
    trackId: string,
    newTrack: MediaStreamTrack | null,
    newTrackMetadata?: TrackMetadata,
  ): Promise<void> => {
    this.ongoingTrackReplacement = true;
    try {
      await this.local.replaceTrack(trackId, newTrack, newTrackMetadata)
    } catch (e) {
      this.ongoingTrackReplacement = false;
    }
    this.ongoingTrackReplacement = false
  };

  public getEndpointId = () => this.local.getEndpoint().id;

  public updateSenders = () => {
    this.local.updateSenders()
  }
}
