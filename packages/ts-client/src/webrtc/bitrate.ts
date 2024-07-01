import {
  type BandwidthLimit,
  RemoteTrackId,
  TrackContext,
  TrackEncoding,
  TrackKind,
} from './types';
import { TrackContextImpl } from './internal';
import { findSender } from './RTCPeerConnectionUtils';
import { generateCustomEvent } from './mediaEvent';

export type Bitrate = number;
export type Bitrates = Record<TrackEncoding, Bitrate> | Bitrate;

// The suggested bitrate values are based on our internal tests.
export const defaultBitrates = {
  audio: 50_000 as Bitrate,
  video: 2_500_000 as Bitrate,
} as const;

export const UNLIMITED_BANDWIDTH: Bitrate = 0 as Bitrate;

// The suggested bitrate values are based on our internal tests.
export const defaultSimulcastBitrates: {
  [key in TrackEncoding]: BandwidthLimit;
} = {
  h: 2_500_000,
  m: 500_000,
  l: 150_000,
};

export const createTrackVariantBitratesEvent = <
  EndpointMetadata,
  TrackMetadata,
>(
  trackId: string,
  connection: RTCPeerConnection | undefined,
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
) => {
  return generateCustomEvent({
    type: 'trackVariantBitrates',
    data: {
      trackId: trackId,
      variantBitrates: getTrackBitrates(
        connection,
        localTrackIdToTrack,
        trackId,
      ),
    },
  });
};

export const getTrackIdToTrackBitrates = <EndpointMetadata, TrackMetadata>(
  connection: RTCPeerConnection | undefined,
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
  tracks: Map<string, TrackContext<EndpointMetadata, TrackMetadata>>,
): Record<string, Bitrates> => {
  const trackIdToTrackBitrates: Record<string, Bitrates> = {};

  Array.from(tracks.entries()).forEach(([trackId, _trackEntry]) => {
    trackIdToTrackBitrates[trackId] = getTrackBitrates(
      connection,
      localTrackIdToTrack,
      trackId,
    );
  });

  return trackIdToTrackBitrates;
};

const isNotSimulcastTrack = (encodings: RTCRtpEncodingParameters[]) =>
  encodings.length === 1 && !encodings[0].rid;

export const getTrackBitrates = <EndpointMetadata, TrackMetadata>(
  connection: RTCPeerConnection | undefined,
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
  trackId: string,
): Bitrates => {
  const trackContext = localTrackIdToTrack.get(trackId);
  if (!trackContext)
    throw "Track with id ${trackId} not present in 'localTrackIdToTrack'";

  const kind = trackContext.track?.kind as TrackKind | undefined;

  if (!trackContext.track) {
    if (!trackContext.trackKind) {
      throw new Error('trackContext.trackKind is empty');
    }

    return defaultBitrates[trackContext.trackKind];
  }

  const sender = findSender(connection, trackContext.track!.id);
  const encodings = sender.getParameters().encodings;

  if (isNotSimulcastTrack(encodings)) {
    return (
      encodings[0].maxBitrate ||
      (kind ? defaultBitrates[kind] : UNLIMITED_BANDWIDTH)
    );
  } else if (kind === 'audio') {
    throw 'Audio track cannot have multiple encodings';
  }

  const bitrates: Record<string, Bitrate> = {};

  encodings
    .filter((encoding) => encoding.rid)
    .forEach((encoding) => {
      const rid = encoding.rid! as TrackEncoding;
      bitrates[rid] = encoding.maxBitrate || defaultSimulcastBitrates[rid];
    });

  return bitrates;
};
