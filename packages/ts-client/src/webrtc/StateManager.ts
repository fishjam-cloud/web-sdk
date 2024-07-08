import type { LocalTrackId, RemoteTrackId, TrackEncoding } from './types';
import type { EndpointWithTrackContext } from './internal';
import type { TrackContextImpl } from './internal';

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
}
