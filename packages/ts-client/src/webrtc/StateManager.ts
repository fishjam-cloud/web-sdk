import type { LocalTrackId, RemoteTrackId, TrackEncoding } from './types';
import { isTrackKind } from './internal';
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

  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>
  ) {
    this.webrtc = webrtc
  }

  public onAnswer = async (answer: RTCSessionDescriptionInit) => {
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
}
