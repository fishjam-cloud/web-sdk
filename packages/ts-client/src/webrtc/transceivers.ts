import { EndpointWithTrackContext, TrackContextImpl } from "./internal";
import { RemoteTrackId } from "./types";

export const getMidToTrackId = <EndpointMetadata, TrackMetadata>(
  connection: RTCPeerConnection | undefined,
  localTrackIdToTrack: Map<RemoteTrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>>,
  midToTrackId: Map<string, string> = new Map(),
  localEndpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
): Record<string, string> | null => {
  if (!connection) return null;

  const active = getActive(connection, localTrackIdToTrack)
  const muted = getMuted(midToTrackId, localEndpoint)

  return { ...active, ...muted };
};

export const getActive = <EndpointMetadata, TrackMetadata>(
  connection: RTCPeerConnection,
  localTrackIdToTrack: Map<RemoteTrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>>,
): Record<string, string> | null =>
  connection.getTransceivers()
    .filter((transceiver) => transceiver.sender.track?.id && transceiver.mid)
    .reduce((acc, transceiver) => {
      const localTrackId = transceiver.sender.track!.id;
      const mid = transceiver!.mid!;

      const trackContext = Array.from(localTrackIdToTrack.values()).find(
        (trackContext) => trackContext?.track?.id === localTrackId,
      )!;

      acc[mid] = trackContext.trackId;

      return acc
    }, {} as Record<string, string>);


export const getMuted = <EndpointMetadata, TrackMetadata>(
  midToTrackId: Map<string, string> = new Map(),
  localEndpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
): Record<string, string> => {
  return [...midToTrackId.entries()]
    .filter(([_mid, trackId]) => localEndpoint.tracks.get(trackId))
    .reduce((acc, [mid, trackId]) => {
      acc[mid] = trackId;

      return acc
    }, {} as Record<string, string>);
}
