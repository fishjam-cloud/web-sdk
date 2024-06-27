import { generateCustomEvent } from './mediaEvent';
import { getTrackIdToTrackBitrates } from './bitrate';
import { getMidToTrackId } from './transciever';
import { RemoteTrackId, TrackContext } from './types';
import { TrackContextImpl } from './internal';

export const createSdpOfferEvent = <EndpointMetadata, TrackMetadata>(
  offer: RTCSessionDescriptionInit,
  connection: RTCPeerConnection | undefined,
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
  tracks: Map<string, TrackContext<EndpointMetadata, TrackMetadata>>,
) =>
  generateCustomEvent({
    type: 'sdpOffer',
    data: {
      sdpOffer: offer,
      trackIdToTrackMetadata: getTrackIdToMetadata(tracks),
      trackIdToTrackBitrates: getTrackIdToTrackBitrates(
        connection,
        localTrackIdToTrack,
        tracks,
      ),
      midToTrackId: getMidToTrackId(connection, localTrackIdToTrack),
    },
  });

const getTrackIdToMetadata = <EndpointMetadata, TrackMetadata>(
  tracks: Map<string, TrackContext<EndpointMetadata, TrackMetadata>>,
): Record<string, TrackMetadata | undefined> => {
  const trackIdToMetadata: Record<string, TrackMetadata | undefined> = {};
  Array.from(tracks.entries()).forEach(([trackId, { metadata }]) => {
    trackIdToMetadata[trackId] = metadata;
  });
  return trackIdToMetadata;
};
