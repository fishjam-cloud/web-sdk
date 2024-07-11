import type {
  BandwidthLimit,
  MetadataParser,
  RemoteTrackId,
  SimulcastConfig,
  TrackBandwidthLimit,
  TrackEncoding,
} from './types';
import type { EndpointWithTrackContext } from './internal';
import type { TrackContextImpl } from './internal';
import { isTrackInUse, } from './RTCPeerConnectionUtils';
import { generateCustomEvent, generateMediaEvent } from './mediaEvent';
import type { WebRTCEndpoint } from './webRTCEndpoint';
import type { NegotiationManager } from './NegotiationManager';
import { setTransceiverDirection } from './transciever';
import type { TrackId } from "./tracks/Tracks";
import { Tracks } from "./tracks/Tracks";
import type { Rid } from "./tracks/TrackCommon";

// localEndpoint + EndpointWithTrackContext

// trackId from signaling Event + TrackContextImpl
// endpointId from signaling Event + EndpointWithTrackContext

// locally generated track id (uuid) + TrackContextImpl
// locally generated track id (uuid) + RTCRtpSender
// locally generated track id (uuid) + TrackEncoding

// mid + trackId from signaling Event

export class StateManager<EndpointMetadata, TrackMetadata> {
  // master object
  public connection?: RTCPeerConnection;

  private readonly tracks: Tracks<EndpointMetadata, TrackMetadata>;

  public getTracks = (): Tracks<EndpointMetadata, TrackMetadata> => {
    return this.tracks;
  }

  // locally generated track id (uuid) + TrackContextImpl
  public localTrackIdToTrack: Map<RemoteTrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>> = new Map();

  // locally generated track id (uuid) + TrackEncoding
  public disabledTrackEncodings: Map<string, TrackEncoding[]> = new Map();


  // trackId from signaling Event + TrackContextImpl
  public trackIdToTrack: Map<string, TrackContextImpl<EndpointMetadata, TrackMetadata>> = new Map();

  // mid + trackId from signaling Event
  public midToTrackId: Map<string, string> = new Map();

  public rtcConfig: RTCConfiguration = { bundlePolicy: 'max-bundle', iceServers: [], iceTransportPolicy: 'relay' };
  public bandwidthEstimation: bigint = BigInt(0);
  public ongoingTrackReplacement: boolean = false;

  // temporary for webrtc.emit and webrtc.sendMediaEvent
  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>;
  private readonly negotiationManager: NegotiationManager;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
    negotiationManager: NegotiationManager,
    endpointMetadataParser: MetadataParser<EndpointMetadata>,
    trackMetadataParser: MetadataParser<TrackMetadata>,
  ) {
    this.webrtc = webrtc;
    this.negotiationManager = negotiationManager;

    this.tracks = new Tracks<EndpointMetadata, TrackMetadata>(webrtc, endpointMetadataParser, trackMetadataParser)
  }


  private onTrackReady = () => {
    return (event: RTCTrackEvent) => {
      const stream = event.streams[0];
      if (!stream) throw new Error("Cannot find media stream")

      const mid = event.transceiver.mid!;
      const remoteTrack = this.tracks.getRemoteTrackByMid(mid)

      remoteTrack.setReady(stream, event.track)

      this.webrtc.emit('trackReady', remoteTrack.trackContext);
    };
  };

  public onTracksAdded = (data: any) => {
    if (this.getEndpointId() === data.endpointId) return;

    this.tracks.addRemoteTracks(data)

    // data.tracks = new Map<string, any>(Object.entries(data.tracks));
    // const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> =
    //   this.idToEndpoint.get(data.endpointId)!;
    // const oldTracks = endpoint.tracks;
    //
    // data.tracks = mapMediaEventTracksToTrackContextImpl(
    //   data.tracks,
    //   endpoint,
    //   this.trackMetadataParser,
    // );
    //
    // endpoint.tracks = new Map([...endpoint.tracks, ...data.tracks]);
    //
    // this.idToEndpoint.set(endpoint.id, endpoint);
    // Array.from(endpoint.tracks.entries()).forEach(([trackId, ctx]) => {
    //   if (!oldTracks.has(trackId)) {
    //     this.trackIdToTrack.set(trackId, ctx);
    //
    //     this.webrtc.emit('trackAdded', ctx);
    //   }
    // });
  };

  public onTracksRemoved = (data: any) => {
    const endpointId = data.endpointId;
    if (this.getEndpointId() === endpointId) return;

    this.tracks.removeRemoteTracks(data.trackIds as string[])
  };

  public onSdpAnswer = async (data: any) => {
    this.midToTrackId = new Map(Object.entries(data.midToTrackId));

    Object.values(data.midToTrackId)
      .map((trackId) => {
        if (!trackId) throw new Error("TrackId is not defined")
        if (typeof trackId !== "string") throw new Error("TrackId is not a string")

        return trackId
      })
      .map((trackId) => this.tracks.getLocalTrackByMidOrNull(trackId))
      .filter((localTrack) => localTrack !== null)
      .forEach((localTrack) => {
        const trackContext = localTrack.trackContext

        trackContext.negotiationStatus = 'done';

        if (trackContext.pendingMetadataUpdate) {
          const mediaEvent = generateMediaEvent('updateTrackMetadata', {
            trackId: localTrack.id,
            trackMetadata: trackContext.metadata,
          });
          this.webrtc.sendMediaEvent(mediaEvent);
        }

        trackContext.pendingMetadataUpdate = false;
      })

    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)

    // probably there is no need to reassign it on every onAnswer
    // refactor: remove unnecessary `()`
    this.connection.ontrack = this.onTrackReady();

    try {
      await this.connection!.setRemoteDescription(data);
      this.tracks.disableAllLocalTrackEncodings()

      // this.disabledTrackEncodings.forEach(
      //         (encodings: TrackEncoding[], trackId: string) => {
      //           encodings.forEach((encoding: TrackEncoding) =>
      //             this.disableTrackEncoding(trackId, encoding),
      //           );
      //         },
      //       );
    } catch (err) {
      console.error(err);
    }
  };

  public onEndpointAdded = (
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ) => {
    if (endpoint.id === this.getEndpointId()) return;

    this.tracks.addRemoteEndpoint(endpoint)
  };

  public onEndpointUpdated = (data: any) => {
    if (this.getEndpointId() === data.id) return;

    this.tracks.updateRemoteEndpoint(data)
  };

  public onEndpointRemoved = (data: any) => {
    if (this.getEndpointId() === data.id) return;

    this.tracks.removeRemoteEndpoint(data.id)
  };

  public onTrackUpdated = (data: any) => {
    if (this.getEndpointId() === data.endpointId) return;

    this.tracks.updateRemoteTrack(data)
  };

  public onTrackEncodingDisabled = (data: any) => {
    if (this.getEndpointId() === data.endpointId) return;

    this.tracks.disableRemoteTrackEncoding(data.trackId, data.encoding)
  };

  public onTrackEncodingEnabled = (data: any) => {
    if (this.getEndpointId() === data.endpointId) return;

    this.tracks.enableRemoteTrackEncoding(data.trackId, data.encoding)
  };

  public onEncodingSwitched = (data: any) => {
    this.tracks.setRemoteTrackEncoding(data.trackId, data.encoding, data.reason)
  };

  public onVadNotification = (data: any) => {
    this.tracks.setRemoteTrackVadStatus(data.trackId, data.status)
  };

  public onBandwidthEstimation = (data: any) => {
    this.bandwidthEstimation = data.estimation;

    this.webrtc.emit('bandwidthEstimationChanged', this.bandwidthEstimation);
  };

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

    if (isTrackInUse(this.connection, track)) {
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

    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)

    const trackManager = this.tracks.addLocalTrack(this.connection, trackId, track, stream, trackMetadata, simulcastConfig, maxBandwidth)

    if (this.connection) {
      trackManager.addTrackToConnection();

      setTransceiverDirection(this.connection);
    }

    const mediaEvent = generateCustomEvent({ type: 'renegotiateTracks' });
    this.webrtc.sendMediaEvent(mediaEvent);
  };

  public removeTrackHandler = (trackId: string) => {
    this.negotiationManager.ongoingRenegotiation = true;

    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)
    this.tracks.removeLocalTrack(trackId)
  };

  public replaceTrackHandler = async (
    trackId: string,
    newTrack: MediaStreamTrack | null,
    newTrackMetadata?: TrackMetadata,
  ): Promise<void> => {
    this.ongoingTrackReplacement = true;
    try {
      await this.tracks.replaceLocalTrack(trackId, newTrack, newTrackMetadata)
    } catch (e) {
      this.ongoingTrackReplacement = false;
    }
    this.ongoingTrackReplacement = false
  };

  public getEndpointId = () => this.tracks.getLocalEndpoint().id;

  public setLocalEndpointMetadata = (metadata: EndpointMetadata) => {
    this.tracks.setLocalEndpointMetadata(metadata)
    const mediaEvent = generateMediaEvent('connect', {
      metadata: metadata,
    });
    this.webrtc.sendMediaEvent(mediaEvent);
  }

  public setLocalTrackBandwidth = (trackId: string, bandwidth: BandwidthLimit): Promise<void> => {
    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)

    return this.tracks.setLocalTrackBandwidth(trackId, bandwidth, this.connection)
  }

  public onConnect = (data: any) => {
    this.tracks.setLocalEndpointId(data.id)

    const endpoints = data.otherEndpoints as EndpointWithTrackContext<EndpointMetadata, TrackMetadata>[]

    // todo implement track mapping (+ validate metadata)
    // todo implement endpoint metadata mapping
    endpoints.forEach((endpoint) => {
      this.tracks.addRemoteEndpoint(endpoint)
    })

    // this.webrtc.emit('connected', data.id, otherEndpoints);

    //   otherEndpoints.forEach((endpoint) =>
    //     this.stateManager.idToEndpoint.set(endpoint.id, endpoint),
    //   );
    //
    //   otherEndpoints.forEach((endpoint) => {
    //     endpoint.tracks.forEach((ctx, trackId) => {
    //       this.stateManager.trackIdToTrack.set(trackId, ctx);
    //
    //       this.emit('trackAdded', ctx);
    //     });
    //   });
  }

  public setLocalEncodingBandwidth = async (trackId: TrackId, rid: Rid, bandwidth: BandwidthLimit): Promise<void> => {
    if (!this.connection) throw new Error(`There is no active RTCPeerConnection`)

    return await this.tracks.setLocalEncodingBandwidth(trackId, rid, bandwidth, this.connection)
  }

  public updateSenders = () => {
    this.tracks.updateSenders()
  }

  public updateLocalEndpointMetadata = (metadata: unknown) => {
    this.tracks.updateLocalEndpointMetadata(metadata)
  }

  public updateLocalTrackMetadata = (trackId: TrackId, metadata: unknown) => {
    this.tracks.updateLocalTrackMetadata(trackId, metadata)
  }

  public enableLocalTrackEncoding = async (trackId: TrackId, encoding: TrackEncoding) => {
    await this.tracks.enableLocalTrackEncoding(trackId, encoding)
  }

  public disableLocalTrackEncoding = async (trackId: string, encoding: TrackEncoding) => {
    await this.tracks.disableLocalTrackEncoding(trackId, encoding)
  };
}
