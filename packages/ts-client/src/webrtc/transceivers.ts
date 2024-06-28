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
): Record<string, string> | null => {
  const localTrackMidToTrackId: Record<string, string> = {};

  connection.getTransceivers().forEach((transceiver) => {
    const localTrackId = transceiver.sender.track?.id;

    const mid = transceiver.mid;
    if (localTrackId && mid) {
      const trackContext = Array.from(localTrackIdToTrack.values()).find(
        (trackContext) => trackContext?.track?.id === localTrackId,
      )!;

      localTrackMidToTrackId[mid] = trackContext.trackId;
    }
  });

  return localTrackMidToTrackId;
};


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
