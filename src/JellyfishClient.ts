import {
  BandwidthLimit,
  WebRTCEndpoint,
  Endpoint,
  SerializedMediaEvent,
  SimulcastConfig,
  TrackBandwidthLimit,
  TrackContext,
  TrackEncoding,
  MetadataParser
} from "@jellyfish-dev/membrane-webrtc-js";
import TypedEmitter from "typed-emitter";
import { EventEmitter } from "events";
import { PeerMessage } from "./protos/jellyfish/peer_notifications";

export type Peer<PeerMetadata, TrackMetadata> = Endpoint<PeerMetadata, TrackMetadata>;

/**
 * Events emitted by the client with their arguments.
 */
export interface MessageEvents<PeerMetadata, TrackMetadata> {
  /**
   * Emitted when the websocket connection is closed
   *
   * @param {CloseEvent} event - Close event object from the websocket
   */
  socketClose: (event: CloseEvent) => void;

  /**
   * Emitted when occurs an error in the websocket connection
   *
   * @param {Event} event - Event object from the websocket
   */
  socketError: (event: Event) => void;

  /**
   * Emitted when the websocket connection is opened
   *
   * @param {Event} event - Event object from the websocket
   */
  socketOpen: (event: Event) => void;

  /** Emitted when authentication is successful */
  authSuccess: () => void;

  /** Emitted when authentication fails */
  authError: () => void;

  /** Emitted when the connection is closed */
  disconnected: () => void;

  /**
   * Called when peer was accepted.
   */
  joined: (peerId: string, peers: Peer<PeerMetadata, TrackMetadata>[]) => void;

  /**
   * Called when peer was not accepted
   * @param metadata - Pass through for client application to communicate further actions to frontend
   */
  joinError: (metadata: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  /**
   * Called when data in a new track arrives.
   *
   * This callback is always called after {@link MessageEvents.trackAdded}.
   * It informs user that data related to the given track arrives and can be played or displayed.
   */
  trackReady: (ctx: TrackContext<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called each time the peer which was already in the room, adds new track. Fields track and stream will be set to null.
   * These fields will be set to non-null value in {@link MessageEvents.trackReady}
   */
  trackAdded: (ctx: TrackContext<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called when some track will no longer be sent.
   *
   * It will also be called before {@link MessageEvents.peerLeft} for each track of this peer.
   */
  trackRemoved: (ctx: TrackContext<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called each time peer has its track metadata updated.
   */
  trackUpdated: (ctx: TrackContext<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called each time new peer joins the room.
   */
  peerJoined: (peer: Peer<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called each time peer leaves the room.
   */
  peerLeft: (peer: Peer<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called each time peer has its metadata updated.
   */
  peerUpdated: (peer: Peer<PeerMetadata, TrackMetadata>) => void;

  /**
   * Called in case of errors related to multimedia session e.g. ICE connection.
   */
  connectionError: (message: string) => void;

  /**
   * Currently, this callback is only invoked when DisplayManager in RTC Engine is
   * enabled and simulcast is disabled.
   *
   * Called when priority of video tracks have changed.
   * @param enabledTracks - list of tracks which will be sent to client from SFU
   * @param disabledTracks - list of tracks which will not be sent to client from SFU
   */
  tracksPriorityChanged: (
    enabledTracks: TrackContext<PeerMetadata, TrackMetadata>[],
    disabledTracks: TrackContext<PeerMetadata, TrackMetadata>[]
  ) => void;

  /**
   * Called every time the server estimates client's bandiwdth.
   *
   * @param {bigint} estimation - client's available incoming bitrate estimated
   * by the server. It's measured in bits per second.
   */
  bandwidthEstimationChanged: (estimation: bigint) => void;

  // new
  targetTrackEncodingRequested: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  // local events
  localTrackAdded: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackRemoved: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackReplaced: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackBandwidthSet: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackEncodingBandwidthSet: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackEncodingEnabled: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackEncodingDisabled: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localEndpointMetadataChanged: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  localTrackMetadataChanged: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  disconnectRequested: (event: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type SignalingUrl = {
  /**
   * Protocol of the websocket server
   * Default is `"ws"`
   */
  protocol?: string;

  /**
   * Host of the websocket server
   * Default is `"localhost:5002"`
   */
  host?: string;

  /**
   * Path of the websocket server
   * Default is `"/socket/peer/websocket"`
   */
  path?: string;
};

/** Configuration object for the client */
export interface ConnectConfig<PeerMetadata> {
  /** Metadata for the peer */
  peerMetadata: PeerMetadata;

  /** Token for authentication */
  token: string;

  signaling?: SignalingUrl;
}

export type ReconnectConfig = {
  /*
   + default: 3
   */
  maxAttempts?: number,
  /*
   * unit: milliseconds
   * default: 500
   */
  initialDelay?: number,
  /*
   * unit: milliseconds
   * default: 500
   */
  delay?: number,

  /*
   * default: false
   */
  addTracksOnReconnect?: boolean,
}

const DISABLED_RECONNECT_CONFIG: Required<ReconnectConfig> = {
  maxAttempts: 0,
  initialDelay: 0,
  delay: 0,
  addTracksOnReconnect: false
};

const DEFAULT_RECONNECT_CONFIG: Required<ReconnectConfig> = {
  maxAttempts: 3,
  initialDelay: 500,
  delay: 500,
  addTracksOnReconnect: true
};

export type CreateConfig<PeerMetadata, TrackMetadata> = {
  peerMetadataParser?: MetadataParser<PeerMetadata>;
  trackMetadataParser?: MetadataParser<TrackMetadata>;
  reconnect?: ReconnectConfig | boolean
};

/**
 * JellyfishClient is the main class to interact with Jellyfish.
 *
 * @example
 * ```typescript
 * const client = new JellyfishClient<PeerMetadata, TrackMetadata>();
 * const peerToken = "YOUR_PEER_TOKEN";
 *
 * // You can listen to events emitted by the client
 * client.on("joined", (peerId, peersInRoom) => {
 *  console.log("join success");
 * });
 *
 * // Start the peer connection
 * client.connect({
 *  peerMetadata: {},
 *  isSimulcastOn: false,
 *  token: peerToken
 * });
 *
 * // Close the peer connection
 * client.disconnect();
 * ```
 *
 * You can register callbacks to handle the events emitted by the Client.
 *
 * @example
 * ```typescript
 *
 * client.on("trackReady", (ctx) => {
 *  console.log("On track ready");
 * });
 * ```
 */
export class JellyfishClient<PeerMetadata, TrackMetadata> extends (EventEmitter as {
  new<PeerMetadata, TrackMetadata>(): TypedEmitter<Required<MessageEvents<PeerMetadata, TrackMetadata>>>;
})<PeerMetadata, TrackMetadata> {
  private websocket: WebSocket | null = null;
  private webrtc: WebRTCEndpoint<PeerMetadata, TrackMetadata> | null = null;
  private removeEventListeners: (() => void) | null = null;

  public status: "new" | "initialized" = "new";

  private connectConfig: ConnectConfig<PeerMetadata> | null = null;

  private readonly reconnectConfig: Required<ReconnectConfig>;
  private reconnectAttempt: number = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private reconnectFailedNotificationSend: boolean = false;
  private ongoingReconnection: boolean = false;

  private lastLocalEndpoint: Endpoint<PeerMetadata, TrackMetadata> | null = null;

  private readonly peerMetadataParser: MetadataParser<PeerMetadata>;
  private readonly trackMetadataParser: MetadataParser<TrackMetadata>;

  constructor(config?: CreateConfig<PeerMetadata, TrackMetadata>) {
    super();
    this.peerMetadataParser = config?.peerMetadataParser ?? ((x) => x as PeerMetadata);
    this.trackMetadataParser = config?.trackMetadataParser ?? ((x) => x as TrackMetadata);
    this.reconnectConfig = this.createReconnectConfig(config?.reconnect);
  }

  private createReconnectConfig(config?: ReconnectConfig | boolean): Required<ReconnectConfig> {
    if (!config) return DISABLED_RECONNECT_CONFIG;
    if (config === true) return DEFAULT_RECONNECT_CONFIG;

    return {
      maxAttempts: config?.maxAttempts ?? DEFAULT_RECONNECT_CONFIG.maxAttempts,
      initialDelay: config?.initialDelay ?? DEFAULT_RECONNECT_CONFIG.initialDelay,
      delay: config?.delay ?? DEFAULT_RECONNECT_CONFIG.delay,
      addTracksOnReconnect: config?.addTracksOnReconnect ?? DEFAULT_RECONNECT_CONFIG.addTracksOnReconnect
    };
  }

  /**
   * Uses the {@link !WebSocket} connection and {@link @jellyfish-dev/membrane-webrtc-js!WebRTCEndpoint | WebRTCEndpoint} to join to the room. Registers the callbacks to
   * handle the events emitted by the {@link @jellyfish-dev/membrane-webrtc-js!WebRTCEndpoint | WebRTCEndpoint}. Make sure that peer metadata is serializable.
   *
   * @example
   * ```typescript
   * const client = new JellyfishClient<PeerMetadata, TrackMetadata>();
   *
   * client.connect({
   *  peerMetadata: {},
   *  token: peerToken
   * });
   * ```
   *
   * @param {ConnectConfig} config - Configuration object for the client
   */
  connect(config: ConnectConfig<PeerMetadata>): void {
    this.resetReconnectState();
    this.connectConfig = config;
    this.initConnection();
  }

  private resetReconnectState() {
    this.reconnectAttempt = 0;
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);
    this.reconnectTimeoutId = null;
  }

  private initConnection(): void {
    if (this.status === "initialized") {
      this.disconnect();
    }

    this.webrtc = new WebRTCEndpoint<PeerMetadata, TrackMetadata>({
      endpointMetadataParser: this.peerMetadataParser,
      trackMetadataParser: this.trackMetadataParser
    });

    this.initWebsocket();
    this.setupCallbacks();

    this.status = "initialized";
  }

  private initWebsocket() {
    if (!this.connectConfig) throw Error("ConnectConfig is null");

    const { token, peerMetadata, signaling } = this.connectConfig;

    const metadata = this.lastLocalEndpoint?.metadata ?? peerMetadata;

    const protocol = signaling?.protocol ?? "ws";
    const host = signaling?.host ?? "localhost:5002";
    const path = signaling?.path ?? "/socket/peer/websocket";

    const websocketUrl = protocol + "://" + host + path;

    this.websocket = new WebSocket(websocketUrl);
    this.websocket.binaryType = "arraybuffer";

    const socketOpenHandler = (event: Event) => {
      console.log("Socket open!");

      this.emit("socketOpen", event);

      const message = PeerMessage.encode({ authRequest: { token } }).finish();
      this.websocket?.send(message);
    };

    const socketErrorHandler = (event: Event) => {
      console.error({ name: "socketErrorHandler", event });
      this.reconnect();

      this.emit("socketError", event);
    };

    const socketCloseHandler = (event: CloseEvent) => {
      console.error({ name: "socketCloseHandler", event });
      this.reconnect();

      this.emit("socketClose", event);
    };

    this.websocket.addEventListener("open", socketOpenHandler);
    this.websocket.addEventListener("error", socketErrorHandler);
    this.websocket.addEventListener("close", socketCloseHandler);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageHandler = (event: MessageEvent<any>) => {
      const uint8Array = new Uint8Array(event.data);
      try {
        const data = PeerMessage.decode(uint8Array);
        if (data.authenticated !== undefined) {
          this.resetReconnectState();
          this.emit("authSuccess");

          this.webrtc?.connect(metadata);
        } else if (data.authRequest !== undefined) {
          console.warn("Received unexpected control message: authRequest");
        } else if (data.mediaEvent !== undefined) {
          this.webrtc?.receiveMediaEvent(data.mediaEvent.data);
        }
      } catch (e) {
        console.warn(`Received invalid control message, error: ${e}`);
      }
    };

    this.websocket.addEventListener("message", messageHandler);

    this.removeEventListeners = () => {
      this.websocket?.removeEventListener("open", socketOpenHandler);
      this.websocket?.removeEventListener("error", socketErrorHandler);
      this.websocket?.removeEventListener("close", socketCloseHandler);
      this.websocket?.removeEventListener("message", messageHandler);
    };
  }

  // todo change to private
  private reconnect() {
    if (!this.connectConfig) throw Error("Invalid inner state! ConnectConfig is null");

    if (this.reconnectTimeoutId) return;

    // console.log({
    //   name: "state",
    //   attempt: this.reconnectAttempt,
    //   max: this.reconnectConfig.maxAttempts,
    //   config: this.reconnectConfig
    // });

    if ((this.reconnectAttempt) >= (this.reconnectConfig.maxAttempts)) {
      if (!this.reconnectFailedNotificationSend) {
        console.log("Reconnect failed");
        this.reconnectFailedNotificationSend = true;
      }
      return;
    }

    if (!this.ongoingReconnection) {
      this.ongoingReconnection = true;

      console.log("Saving last localEndpoint");
      this.lastLocalEndpoint = this.webrtc?.getLocalEndpoint() || null;
      console.log({ lastLocalEndpoint: this.lastLocalEndpoint });
    }

    const timeout = this.reconnectConfig.initialDelay + this.reconnectAttempt * this.reconnectConfig.delay;

    // console.log({ name: "schedule next attempt", attempt: this.reconnectAttempt, timeout: timeout });

    this.reconnectAttempt += 1;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      // console.log(`Reconnect attempt ${this.reconnectAttempt}`);

      if (!this.connectConfig) throw Error("Connect config is null");

      // todo should I cleanup previous webrtc object? removeAllListeners?
      this.initConnection();
    }, timeout);
  }

  /**
   * Retrieves statistics related to the RTCPeerConnection.
   * These statistics provide insights into the performance and status of the connection.
   *
   * @return {Promise<RTCStatsReport>}
   *
   * @external RTCPeerConnection#getStats()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats | MDN Web Docs: RTCPeerConnection.getStats()}
   */
  public async getStatistics(selector?: MediaStreamTrack | null): Promise<RTCStatsReport> {
    return (await this.webrtc?.getStatistics(selector)) ?? new Map();
  }

  /**
   * Returns a snapshot of currently received remote tracks.
   *
   * @example
   * if (client.getRemoteTracks()[trackId]?.simulcastConfig?.enabled) {
   *   client.setTargetTrackEncoding(trackId, encoding);
   * }
   */
  getRemoteTracks(): Readonly<Record<string, TrackContext<PeerMetadata, TrackMetadata>>> {
    return this.webrtc?.getRemoteTracks() ?? {};
  }

  /**
   * Returns a snapshot of currently received remote endpoints.
   */
  public getRemoteEndpoints(): Record<string, Endpoint<PeerMetadata, TrackMetadata>> {
    return this.webrtc?.getRemoteEndpoints() ?? {};
  }

  // todo change to read only
  public getLocalEndpoint(): Endpoint<PeerMetadata, TrackMetadata> | null {
    return this.webrtc?.getLocalEndpoint() || null;
  }

  public getBandwidthEstimation(): bigint {
    if (!this.webrtc) throw Error("Webrtc not initialized");

    return this.webrtc?.getBandwidthEstimation();
  }

  private addPreviousTracks() {
    if (!this.lastLocalEndpoint || !this.reconnectConfig.addTracksOnReconnect) {
      console.log("Skipping addPreviousTrack");
      return;
    }

    this.lastLocalEndpoint.tracks.forEach(async (track) => {
      console.log({ name: "Track to add", track });
      if (!track.track || !track.stream) return;

      console.log({ name: "Adding track:", track });
      await this.addTrack(
        track.track,
        track.stream,
        track.rawMetadata,
        track.simulcastConfig,
        track.maxBandwidth
      );
    });

    this.lastLocalEndpoint = null;
  }

  private setupCallbacks() {
    this.webrtc?.on("sendMediaEvent", (mediaEvent: SerializedMediaEvent) => {
      const message = PeerMessage.encode({ mediaEvent: { data: mediaEvent } }).finish();
      this.websocket?.send(message);
    });

    this.webrtc?.on("connected", (peerId: string, peersInRoom: Endpoint<PeerMetadata, TrackMetadata>[]) => {
      console.log("Joined to room");

      if (this.ongoingReconnection) {
        this.addPreviousTracks();

        this.ongoingReconnection = false;

        console.log("Reconnection succeeded");
      }

      this.emit("joined", peerId, peersInRoom);
    });

    this.webrtc?.on("disconnected", () => {
      this.emit("disconnected");
    });
    this.webrtc?.on("endpointAdded", (endpoint: Endpoint<PeerMetadata, TrackMetadata>) => {
      this.emit("peerJoined", endpoint);
    });
    this.webrtc?.on("endpointRemoved", (endpoint: Endpoint<PeerMetadata, TrackMetadata>) => {
      this.emit("peerLeft", endpoint);
    });
    this.webrtc?.on("endpointUpdated", (endpoint: Endpoint<PeerMetadata, TrackMetadata>) => {
      this.emit("peerUpdated", endpoint);
    });
    this.webrtc?.on("trackReady", (ctx: TrackContext<PeerMetadata, TrackMetadata>) => {
      this.emit("trackReady", ctx);
    });
    this.webrtc?.on("trackAdded", (ctx: TrackContext<PeerMetadata, TrackMetadata>) => {
      this.emit("trackAdded", ctx);
    });
    this.webrtc?.on("trackRemoved", (ctx: TrackContext<PeerMetadata, TrackMetadata>) => {
      this.emit("trackRemoved", ctx);
      ctx.removeAllListeners();
    });
    this.webrtc?.on("trackUpdated", (ctx: TrackContext<PeerMetadata, TrackMetadata>) => {
      this.emit("trackUpdated", ctx);
    });
    this.webrtc?.on("tracksPriorityChanged", (enabledTracks, disabledTracks) => {
      this.emit("tracksPriorityChanged", enabledTracks, disabledTracks);
    });
    this.webrtc?.on("connectionError", (metadata: string) => {
      this.emit("joinError", metadata);
    });
    this.webrtc?.on("bandwidthEstimationChanged", (estimation: bigint) => {
      this.emit("bandwidthEstimationChanged", estimation);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("targetTrackEncodingRequested", (event: any) => {
      this.emit("targetTrackEncodingRequested", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackAdded", (event: any) => {
      this.emit("localTrackAdded", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackRemoved", (event: any) => {
      this.emit("localTrackRemoved", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackReplaced", (event: any) => {
      this.emit("localTrackReplaced", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackBandwidthSet", (event: any) => {
      this.emit("localTrackBandwidthSet", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackEncodingBandwidthSet", (event: any) => {
      this.emit("localTrackEncodingBandwidthSet", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackEncodingEnabled", (event: any) => {
      this.emit("localTrackEncodingEnabled", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackEncodingDisabled", (event: any) => {
      this.emit("localTrackEncodingDisabled", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localEndpointMetadataChanged", (event: any) => {
      this.emit("localEndpointMetadataChanged", event);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webrtc?.on("localTrackMetadataChanged", (event: any) => {
      this.emit("localTrackMetadataChanged", event);
    });
    this.webrtc?.on("disconnectRequested", (event: any) => {
      this.emit("disconnectRequested", event);
    });
  }

  /**
   * Register a callback to be called when the event is emitted.
   * Full list of callbacks can be found here {@link MessageEvents}.
   *
   * @example
   * ```ts
   * const callback = ()=>{  };
   *
   * client.on("onJoinSuccess", callback);
   * ```
   *
   * @param event - Event name from {@link MessageEvents}
   * @param listener - Callback function to be called when the event is emitted
   * @returns This
   */
  public on<E extends keyof MessageEvents<PeerMetadata, TrackMetadata>>(
    event: E,
    listener: Required<MessageEvents<PeerMetadata, TrackMetadata>>[E]
  ): this {
    return super.on(event, listener);
  }

  /**
   * Remove a callback from the list of callbacks to be called when the event is emitted.
   *
   * @example
   * ```ts
   * const callback = ()=>{  };
   *
   * client.on("onJoinSuccess", callback);
   *
   * client.off("onJoinSuccess", callback);
   * ```
   *
   * @param event - Event name from {@link MessageEvents}
   * @param listener - Reference to function to be removed from called callbacks
   * @returns This
   */
  public off<E extends keyof MessageEvents<PeerMetadata, TrackMetadata>>(
    event: E,
    listener: Required<MessageEvents<PeerMetadata, TrackMetadata>>[E]
  ): this {
    return super.off(event, listener);
  }

  private handleWebRTCNotInitialized() {
    return new Error("WebRTC is not initialized");
  }

  /**
   * Adds track that will be sent to the RTC Engine.
   *
   * @example
   * ```ts
   * const localStream: MediaStream = new MediaStream();
   * try {
   *   const localAudioStream = await navigator.mediaDevices.getUserMedia(
   *     { audio: true }
   *   );
   *   localAudioStream
   *     .getTracks()
   *     .forEach((track) => localStream.addTrack(track));
   * } catch (error) {
   *   console.error("Couldn't get microphone permission:", error);
   * }
   *
   * try {
   *   const localVideoStream = await navigator.mediaDevices.getUserMedia(
   *     { video: true }
   *   );
   *   localVideoStream
   *     .getTracks()
   *     .forEach((track) => localStream.addTrack(track));
   * } catch (error) {
   *  console.error("Couldn't get camera permission:", error);
   * }
   *
   * localStream
   *  .getTracks()
   *  .forEach((track) => client.addTrack(track, localStream));
   * ```
   *
   * @param track - Audio or video track e.g. from your microphone or camera.
   * @param stream - Stream that this track belongs to.
   * @param trackMetadata - Any information about this track that other peers will receive in
   * {@link MessageEvents.peerJoined}. E.g. this can source of the track - wheather it's screensharing, webcam or some
   * other media device.
   * @param simulcastConfig - Simulcast configuration. By default, simulcast is disabled. For more information refer to
   * {@link @jellyfish-dev/membrane-webrtc-js!SimulcastConfig | SimulcastConfig}.
   * @param maxBandwidth - Maximal bandwidth this track can use. Defaults to 0 which is unlimited. This option has no
   * effect for simulcast and audio tracks. For simulcast tracks use {@link JellyfishClient.setTrackBandwidth}.
   * @returns {string} Returns id of added track
   */
  public addTrack(
    track: MediaStreamTrack,
    stream: MediaStream,
    trackMetadata?: TrackMetadata,
    simulcastConfig: SimulcastConfig = { enabled: false, activeEncodings: [], disabledEncodings: [] },
    maxBandwidth: TrackBandwidthLimit = 0 // unlimited bandwidth
  ): Promise<string> {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.addTrack(track, stream, trackMetadata, simulcastConfig, maxBandwidth);
  }

  /**
   * Replaces a track that is being sent to the RTC Engine.
   *
   * @example
   * ```ts
   * // setup camera
   * let localStream: MediaStream = new MediaStream();
   * try {
   *   localVideoStream = await navigator.mediaDevices.getUserMedia(
   *     VIDEO_CONSTRAINTS
   *   );
   *   localVideoStream
   *     .getTracks()
   *     .forEach((track) => localStream.addTrack(track));
   * } catch (error) {
   *   console.error("Couldn't get camera permission:", error);
   * }
   * let oldTrackId;
   * localStream
   *  .getTracks()
   *  .forEach((track) => trackId = webrtc.addTrack(track, localStream));
   *
   * // change camera
   * const oldTrack = localStream.getVideoTracks()[0];
   * let videoDeviceId = "abcd-1234";
   * navigator.mediaDevices.getUserMedia({
   *      video: {
   *        ...(VIDEO_CONSTRAINTS as {}),
   *        deviceId: {
   *          exact: videoDeviceId,
   *        },
   *      }
   *   })
   *   .then((stream) => {
   *     let videoTrack = stream.getVideoTracks()[0];
   *     webrtc.replaceTrack(oldTrackId, videoTrack);
   *   })
   *   .catch((error) => {
   *     console.error('Error switching camera', error);
   *   })
   * ```
   *
   * @param {string} trackId - Id of audio or video track to replace.
   * @param {MediaStreamTrack} newTrack - New audio or video track.
   * @param {TrackMetadata} [newTrackMetadata] - Optional track metadata to apply to the new track. If no track metadata is passed, the
   * old track metadata is retained.
   * @returns {Promise<boolean>} Success
   */
  public async replaceTrack(
    trackId: string,
    newTrack: MediaStreamTrack,
    newTrackMetadata?: TrackMetadata
  ): Promise<void> {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.replaceTrack(trackId, newTrack, newTrackMetadata);
  }

  /**
   * Updates maximum bandwidth for the track identified by trackId. This value directly translates to quality of the
   * stream and, in case of video, to the amount of RTP packets being sent. In case trackId points at the simulcast
   * track bandwidth is split between all of the variant streams proportionally to their resolution.
   *
   * @param {string} trackId
   * @param {BandwidthLimit} bandwidth In kbps
   * @returns {Promise<boolean>} Success
   */
  public setTrackBandwidth(trackId: string, bandwidth: BandwidthLimit): Promise<boolean> {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.setTrackBandwidth(trackId, bandwidth);
  }

  /**
   * Updates maximum bandwidth for the given simulcast encoding of the given track.
   *
   * @param {string} trackId - Id of the track
   * @param {string} rid - Rid of the encoding
   * @param {BandwidthLimit} bandwidth - Desired max bandwidth used by the encoding (in kbps)
   * @returns
   */
  public setEncodingBandwidth(trackId: string, rid: string, bandwidth: BandwidthLimit): Promise<boolean> {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.setEncodingBandwidth(trackId, rid, bandwidth);
  }

  /**
   * Removes a track from connection that was being sent to the RTC Engine.
   *
   * @example
   * ```ts
   * // setup camera
   * let localStream: MediaStream = new MediaStream();
   * try {
   *   localVideoStream = await navigator.mediaDevices.getUserMedia(
   *     VIDEO_CONSTRAINTS
   *   );
   *   localVideoStream
   *     .getTracks()
   *     .forEach((track) => localStream.addTrack(track));
   * } catch (error) {
   *   console.error("Couldn't get camera permission:", error);
   * }
   *
   * let trackId
   * localStream
   *  .getTracks()
   *  .forEach((track) => trackId = webrtc.addTrack(track, localStream));
   *
   * // remove track
   * webrtc.removeTrack(trackId)
   * ```
   *
   * @param {string} trackId - Id of audio or video track to remove.
   */
  public removeTrack(trackId: string) {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.removeTrack(trackId);
  }

  /**
   * Sets track encoding that server should send to the client library.
   *
   * The encoding will be sent whenever it is available. If chosen encoding is temporarily unavailable, some other
   * encoding will be sent until chosen encoding becomes active again.
   *
   * @example
   * ```ts
   * webrtc.setTargetTrackEncoding(incomingTrackCtx.trackId, "l")
   * ```
   *
   * @param {string} trackId - Id of track
   * @param {TrackEncoding} encoding - Encoding to receive
   */
  public setTargetTrackEncoding(trackId: string, encoding: TrackEncoding) {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.setTargetTrackEncoding(trackId, encoding);
  }

  /**
   * Enables track encoding so that it will be sent to the server.
   *
   * @example
   * ```ts
   * const trackId = webrtc.addTrack(track, stream, {}, {enabled: true, active_encodings: ["l", "m", "h"]});
   * webrtc.disableTrackEncoding(trackId, "l");
   * // wait some time
   * webrtc.enableTrackEncoding(trackId, "l");
   * ```
   *
   * @param {string} trackId - Id of track
   * @param {TrackEncoding} encoding - Encoding that will be enabled
   */
  public enableTrackEncoding(trackId: string, encoding: TrackEncoding) {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.enableTrackEncoding(trackId, encoding);
  }

  /**
   * Disables track encoding so that it will be no longer sent to the server.
   *
   * @example
   * ```ts
   * const trackId = webrtc.addTrack(track, stream, {}, {enabled: true, active_encodings: ["l", "m", "h"]});
   * webrtc.disableTrackEncoding(trackId, "l");
   * ```
   *
   * @param {string} trackId - Id of track
   * @param {rackEncoding} encoding - Encoding that will be disabled
   */
  public disableTrackEncoding(trackId: string, encoding: TrackEncoding) {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    return this.webrtc.disableTrackEncoding(trackId, encoding);
  }

  /**
   * Updates the metadata for the current peer.
   *
   * @param peerMetadata - Data about this peer that other peers will receive upon joining.
   *
   * If the metadata is different from what is already tracked in the room, the event {@link MessageEvents.peerUpdated} will
   * be emitted for other peers in the room.
   */
  public updatePeerMetadata = (peerMetadata: PeerMetadata): void => {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    this.webrtc.updateEndpointMetadata(peerMetadata);
  };

  /**
   * Updates the metadata for a specific track.
   *
   * @param trackId - TrackId (generated in addTrack) of audio or video track.
   * @param trackMetadata - Data about this track that other peers will receive upon joining.
   *
   * If the metadata is different from what is already tracked in the room, the event {@link MessageEvents.trackUpdated} will
   * be emitted for other peers in the room.
   */
  public updateTrackMetadata = (trackId: string, trackMetadata: TrackMetadata): void => {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    this.webrtc.updateTrackMetadata(trackId, trackMetadata);
  };

  /**
   * Leaves the room. This function should be called when user leaves the room in a clean way e.g. by clicking a
   * dedicated, custom button `disconnect`. As a result there will be generated one more media event that should be sent
   * to the RTC Engine. Thanks to it each other peer will be notified that peer left in {@link MessageEvents.peerLeft},
   */
  public leave = () => {
    if (!this.webrtc) throw this.handleWebRTCNotInitialized();

    this.webrtc.disconnect();
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
  private isOpen(websocket: WebSocket | null) {
    return websocket?.readyState === 1;
  }

  /**
   * Disconnect from the room, and close the websocket connection. Tries to leave the room gracefully, but if it fails,
   * it will close the websocket anyway.
   *
   * @example
   * ```typescript
   * const client = new JellyfishClient<PeerMetadata, TrackMetadata>();
   *
   * client.connect({ ... });
   *
   * client.disconnect();
   * ```
   */
  public disconnect() {
    try {
      this.webrtc?.removeAllListeners();
      this.webrtc?.disconnect();
      this.webrtc?.cleanUp();
    } catch (e) {
      console.warn(e);
    }
    this.removeEventListeners?.();
    this.removeEventListeners = null;
    if (this.isOpen(this.websocket || null)) {
      this.websocket?.close();
    }
    this.websocket = null;
    this.webrtc = null;
    this.emit("disconnected");
  }
}
