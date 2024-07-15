import type { Deferred } from './deferred';
import type { LocalTrackManager } from './tracks/LocalTrackManager';
import type { Connection } from './Connection';

export type Command = {
  handler: () => void;
  validate?: () => string | null;
  resolutionNotifier: Deferred<void>;
  resolve: 'after-renegotiation' | 'immediately';
};

export class CommandsQueue<EndpointMetadata, TrackMetadata> {
  private readonly localTrackManager: LocalTrackManager<
    EndpointMetadata,
    TrackMetadata
  >;
  private connection: Connection | null = null;
  private clearConnectionCallbacks: (() => void) | null = null;

  constructor(
    localTrackManager: LocalTrackManager<EndpointMetadata, TrackMetadata>,
  ) {
    this.localTrackManager = localTrackManager;
  }

  public initConnection = (connection: Connection) => {
    this.connection = connection;

    const onSignalingStateChange = () => {
      switch (connection.getConnection().signalingState) {
        case 'stable':
          this.processNextCommand();
          break;
      }
    };

    const onIceGatheringStateChange = () => {
      switch (connection.getConnection().iceGatheringState) {
        case 'complete':
          this.processNextCommand();
          break;
      }
    };

    const onConnectionStateChange = () => {
      switch (connection.getConnection().connectionState) {
        case 'connected':
          this.processNextCommand();
          break;
      }
    };
    const onIceConnectionStateChange = () => {
      switch (connection.getConnection().iceConnectionState) {
        case 'connected':
          this.processNextCommand();
          break;
      }
    };

    this.clearConnectionCallbacks = () => {
      connection
        .getConnection()
        .removeEventListener('signalingstatechange', onSignalingStateChange);
      connection
        .getConnection()
        .removeEventListener(
          'icegatheringstatechange',
          onIceGatheringStateChange,
        );
      connection
        .getConnection()
        .removeEventListener('connectionstatechange', onConnectionStateChange);
      connection
        .getConnection()
        .removeEventListener(
          'iceconnectionstatechange',
          onIceConnectionStateChange,
        );
    };

    connection
      .getConnection()
      .addEventListener('icegatheringstatechange', onIceConnectionStateChange);
    connection
      .getConnection()
      .addEventListener('connectionstatechange', onConnectionStateChange);
    connection
      .getConnection()
      .addEventListener('iceconnectionstatechange', onIceConnectionStateChange);
    connection
      .getConnection()
      .addEventListener('signalingstatechange', onSignalingStateChange);
  };

  private commandsQueue: Command[] = [];
  private commandResolutionNotifier: Deferred<void> | null = null;

  public pushCommand = (command: Command) => {
    this.commandsQueue.push(command);
    this.processNextCommand();
  };

  public processNextCommand = () => {
    if (this.localTrackManager.isNegotiationInProgress()) return;
    if (this.connection?.isConnectionUnstable()) return;

    this.resolvePreviousCommand();

    const command = this.commandsQueue.shift();

    if (!command) return;

    this.commandResolutionNotifier = command.resolutionNotifier;
    this.handleCommand(command);
  };

  private handleCommand = (command: Command) => {
    const error = command.validate?.();

    if (error) {
      this.commandResolutionNotifier?.reject(error);
      this.commandResolutionNotifier = null;
      this.processNextCommand();
    } else {
      command.handler();

      if (command.resolve === 'immediately') {
        this.resolvePreviousCommand();
        this.processNextCommand();
      }
    }
  };

  private resolvePreviousCommand = () => {
    if (!this.commandResolutionNotifier) return;

    this.commandResolutionNotifier.resolve();
    this.commandResolutionNotifier = null;
  };

  public cleanUp = () => {
    this.commandResolutionNotifier?.reject('Disconnected');
    this.commandResolutionNotifier = null;
    this.commandsQueue = [];
    this.clearConnectionCallbacks?.();
  };
}
