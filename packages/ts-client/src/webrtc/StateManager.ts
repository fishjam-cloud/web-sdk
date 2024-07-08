import type { LocalTrackId, MetadataParser, RemoteTrackId, TrackEncoding } from './types';
import { isTrackKind, mapMediaEventTracksToTrackContextImpl } from './internal';
import type { TrackContextImpl, EndpointWithTrackContext } from './internal';
import { findSenderByTrack } from "./RTCPeerConnectionUtils";
import { generateMediaEvent } from "./mediaEvent";
import type { WebRTCEndpoint } from "./webRTCEndpoint";

export class StateManager<EndpointMetadata, TrackMetadata> {
  public trackIdToTrack: Map<
    string,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  > = new Map();
  public connection?: RTCPeerConnection;
  public idToEndpoint: Map<
    string,
    EndpointWithTrackContext<EndpointMetadata, TrackMetadata>
  > = new Map();
  public localEndpoint: EndpointWithTrackContext<
    EndpointMetadata,
    TrackMetadata
  > = {
    id: '',
    type: 'webrtc',
    metadata: undefined,
    rawMetadata: undefined,
    tracks: new Map(),
  };
  public localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  > = new Map();
  public trackIdToSender: Map<
    RemoteTrackId,
    {
      remoteTrackId: RemoteTrackId;
      localTrackId: LocalTrackId | null;
      sender: RTCRtpSender | null;
    }
  > = new Map();
  public midToTrackId: Map<string, string> = new Map();
  public disabledTrackEncodings: Map<string, TrackEncoding[]> = new Map();
  public rtcConfig: RTCConfiguration = {
    bundlePolicy: 'max-bundle',
    iceServers: [],
    iceTransportPolicy: 'relay',
  };
  public bandwidthEstimation: bigint = BigInt(0);

  /**
   * Indicates if an ongoing renegotiation is active.
   * During renegotiation, both parties are expected to actively exchange events: renegotiateTracks, offerData, sdpOffer, sdpAnswer.
   */
  public ongoingRenegotiation: boolean = false;
  public ongoingTrackReplacement: boolean = false;

  // temporary for webrtc.emit and webrtc.sendMediaEvent
  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>
  private readonly endpointMetadataParser: MetadataParser<EndpointMetadata>;
  private readonly trackMetadataParser: MetadataParser<TrackMetadata>;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>, endpointMetadataParser: MetadataParser<EndpointMetadata>, trackMetadataParser: MetadataParser<TrackMetadata>) {
    this.webrtc = webrtc
    this.endpointMetadataParser = endpointMetadataParser;
    this.trackMetadataParser = trackMetadataParser;
  }

  private onAnswer = async (answer: RTCSessionDescriptionInit) => {
    this.connection!.ontrack = this.onTrack();
    try {
      await this.connection!.setRemoteDescription(answer);
      this.disabledTrackEncodings.forEach(
        (encodings: TrackEncoding[], trackId: string) => {
          encodings.forEach((encoding: TrackEncoding) =>
            this.disableTrackEncoding(trackId, encoding),
          );
        },
      );
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Disables track encoding so that it will be no longer sent to the server.
   * @param {string} trackId - id of track
   * @param {TrackEncoding} encoding - encoding that will be disabled
   * @example
   * ```ts
   * const trackId = webrtc.addTrack(track, stream, {}, {enabled: true, activeEncodings: ["l", "m", "h"]});
   * webrtc.disableTrackEncoding(trackId, "l");
   * ```
   */
  public disableTrackEncoding(trackId: string, encoding: TrackEncoding) {
    const track = this.localTrackIdToTrack.get(trackId)?.track;
    this.disabledTrackEncodings.get(trackId)!.push(encoding);

    const sender = findSenderByTrack(this.connection, track);

    const params = sender?.getParameters();
    params!.encodings.filter((en) => en.rid == encoding)[0].active = false;
    sender?.setParameters(params!);

    const mediaEvent = generateMediaEvent('disableTrackEncoding', {
      trackId: trackId,
      encoding: encoding,
    });
    this.webrtc.sendMediaEvent(mediaEvent);
    this.webrtc.emit('localTrackEncodingDisabled', {
      trackId,
      encoding,
    });
  }

  private onTrack = () => {
    return (event: RTCTrackEvent) => {
      const [stream] = event.streams;
      const mid = event.transceiver.mid!;

      const trackId = this.midToTrackId.get(mid)!;

      if (
        this.checkIfTrackBelongToEndpoint(
          trackId,
          this.localEndpoint,
        )
      )
        return;
      if (!isTrackKind(event.track.kind)) throw new Error('Track has no kind');

      const trackContext = this.trackIdToTrack.get(trackId)!;

      trackContext.stream = stream;
      trackContext.track = event.track;
      trackContext.trackKind = event.track.kind;

      this.idToEndpoint
        .get(trackContext.endpoint.id)
        ?.tracks.set(trackId, trackContext);

      this.webrtc.emit('trackReady', trackContext);
    };
  };

  private checkIfTrackBelongToEndpoint = (
    trackId: string,
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ) =>
    Array.from(endpoint.tracks.keys()).some((track) =>
      trackId.startsWith(track),
    );

  public onTracksAdded(data: any) {
    if (this.getEndpointId() === data.endpointId) return;
    data.tracks = new Map<string, any>(Object.entries(data.tracks));
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> = this.idToEndpoint.get(data.endpointId)!;
    const oldTracks = endpoint.tracks;

    data.tracks = mapMediaEventTracksToTrackContextImpl(
      data.tracks,
      endpoint,
      this.trackMetadataParser,
    );

    endpoint.tracks = new Map([...endpoint.tracks, ...data.tracks]);

    this.idToEndpoint.set(endpoint.id, endpoint);
    Array.from(endpoint.tracks.entries()).forEach(([trackId, ctx]) => {
      if (!oldTracks.has(trackId)) {
        this.trackIdToTrack.set(trackId, ctx);

        this.webrtc.emit('trackAdded', ctx);
      }
    });
  }

  public onTracksRemoved(data: any) {
    const endpointId = data.endpointId;
    if (this.getEndpointId() === endpointId) return;
    const trackIds = data.trackIds as string[];
    trackIds.forEach((trackId) => {
      const trackContext = this.trackIdToTrack.get(trackId)!;

      this.eraseTrack(trackId, endpointId);

      this.webrtc.emit('trackRemoved', trackContext);
    });
  }

  public onSdpAnswer(data: any) {
    this.midToTrackId = new Map(Object.entries(data.midToTrackId),);

    for (const trackId of Object.values(data.midToTrackId,)) {
      const track = this.localTrackIdToTrack.get(trackId as string);

      // if is local track
      if (track) {
        track.negotiationStatus = 'done';

        if (track.pendingMetadataUpdate) {
          const mediaEvent = generateMediaEvent('updateTrackMetadata', {
            trackId,
            trackMetadata: track.metadata,
          });
          this.webrtc.sendMediaEvent(mediaEvent);
        }

        track.pendingMetadataUpdate = false;
      }
    }

    this.onAnswer(data);
  }

  public onEndpointAdded(endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>) {
    if (endpoint.id === this.getEndpointId()) return;
    endpoint.rawMetadata = endpoint.metadata;
    try {
      endpoint.metadataParsingError = undefined;
      endpoint.metadata = this.endpointMetadataParser(endpoint.rawMetadata);
    } catch (error) {
      endpoint.metadataParsingError = error;
      endpoint.metadata = undefined;
    }
    this.addEndpoint(endpoint);

    this.webrtc.emit('endpointAdded', endpoint);
  }

  public onEndpointUpdated(data: any) {
    if (this.getEndpointId() === data.id) return;
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> = this.idToEndpoint.get(data.id)!;

    try {
      endpoint.metadata = this.endpointMetadataParser(
        data.metadata,
      );
      endpoint.metadataParsingError = undefined;
    } catch (error) {
      endpoint.metadata = undefined;
      endpoint.metadataParsingError = error;
    }
    endpoint.rawMetadata = data.metadata;
    this.addEndpoint(endpoint);

    this.webrtc.emit('endpointUpdated', endpoint);
  }

  public onEndpointRemoved(data: any) {
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> = this.idToEndpoint.get(data.id)!;
    if (endpoint === undefined) return;

    Array.from(endpoint.tracks.keys()).forEach((trackId) => {
      this.webrtc.emit(
        'trackRemoved',
        this.trackIdToTrack.get(trackId)!,
      );
    });

    this.eraseEndpoint(endpoint);

    this.webrtc.emit('endpointRemoved', endpoint);
  }

  private addEndpoint = (
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ): void => {
    // #TODO remove this line after fixing deserialization
    if (Object.prototype.hasOwnProperty.call(endpoint, 'trackIdToMetadata'))
      endpoint.tracks = new Map(Object.entries(endpoint.tracks));
    else endpoint.tracks = new Map();

    this.idToEndpoint.set(endpoint.id, endpoint);
  };

  private eraseEndpoint = (
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ): void => {
    const tracksId = Array.from(endpoint.tracks.keys());
    tracksId.forEach((trackId) =>
      this.trackIdToTrack.delete(trackId),
    );
    Array.from(this.midToTrackId.entries()).forEach(
      ([mid, trackId]) => {
        if (tracksId.includes(trackId))
          this.midToTrackId.delete(mid);
      },
    );
    this.idToEndpoint.delete(endpoint.id);
  };

  private eraseTrack = (trackId: string, endpointId: string) => {
    this.trackIdToTrack.delete(trackId);
    const midToTrackId = Array.from(this.midToTrackId.entries());
    const [mid, _trackId] = midToTrackId.find(
      ([_mid, mapTrackId]) => mapTrackId === trackId,
    )!;
    this.midToTrackId.delete(mid);
    this.idToEndpoint.get(endpointId)!.tracks.delete(trackId);
    this.disabledTrackEncodings.delete(trackId);
  };

  private getEndpointId = () => this.localEndpoint.id;
}
