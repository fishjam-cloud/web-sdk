import type { RemoteTrackId, TrackContext, Encoding } from './types';
import { applyBandwidthLimitation } from './bandwidth';
import type { EndpointWithTrackContext, TrackContextImpl } from './internal';
import { simulcastTransceiverConfig } from "./tracks/LocalTrack";

const getNeededTransceiversTypes = (
  type: string,
  recvTransceivers: RTCRtpTransceiver[],
  serverTracks: Map<string, number>,
): string[] => {
  const typeNumber = serverTracks.get(type) ?? 0;

  const typeTransceiversNumber = recvTransceivers.filter(
    (elem) => elem.receiver.track.kind === type,
  ).length;

  return Array(typeNumber - typeTransceiversNumber).fill(type);
};

export const addTransceiversIfNeeded = (
  connection: RTCPeerConnection | undefined,
  serverTracks: Map<string, number>,
) => {
  const recvTransceivers = connection!
    .getTransceivers()
    .filter((elem) => elem.direction === 'recvonly');

  ['audio', 'video']
    .flatMap((type) =>
      getNeededTransceiversTypes(type, recvTransceivers, serverTracks),
    )
    .forEach((kind) =>
      connection?.addTransceiver(kind, { direction: 'recvonly' }),
    );
};

export const addTrackToConnection = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
  disabledTrackEncodingsMap: Map<string, Encoding[]>,
  connection: RTCPeerConnection | undefined,
) => {
  const transceiverConfig = createTransceiverConfig(
    trackContext,
    disabledTrackEncodingsMap,
  );
  const track = trackContext.track!;
  connection!.addTransceiver(track, transceiverConfig);
};

const createTransceiverConfig = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
  disabledTrackEncodingsMap: Map<string, Encoding[]>,
): RTCRtpTransceiverInit => {
  if (trackContext.track!.kind === 'audio') {
    return createAudioTransceiverConfig(trackContext);
  }

  return createVideoTransceiverConfig(trackContext, disabledTrackEncodingsMap);
};

const createAudioTransceiverConfig = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
): RTCRtpTransceiverInit => {
  return {
    direction: 'sendonly',
    streams: trackContext.stream ? [trackContext.stream] : [],
  };
};

const createVideoTransceiverConfig = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
  disabledTrackEncodingsMap: Map<string, Encoding[]>,
): RTCRtpTransceiverInit => {
  let transceiverConfig: RTCRtpTransceiverInit;
  if (trackContext.simulcastConfig!.enabled) {
    transceiverConfig = simulcastTransceiverConfig;
    const trackActiveEncodings = trackContext.simulcastConfig!.activeEncodings;
    const disabledTrackEncodings: Encoding[] = [];
    transceiverConfig.sendEncodings?.forEach((encoding) => {
      if (trackActiveEncodings.includes(encoding.rid! as Encoding)) {
        encoding.active = true;
      } else {
        disabledTrackEncodings.push(encoding.rid! as Encoding);
      }
    });
    disabledTrackEncodingsMap.set(trackContext.trackId, disabledTrackEncodings);
  } else {
    transceiverConfig = {
      direction: 'sendonly',
      sendEncodings: [
        {
          active: true,
        },
      ],
      streams: trackContext.stream ? [trackContext.stream] : [],
    };
  }

  if (trackContext.maxBandwidth && transceiverConfig.sendEncodings)
    applyBandwidthLimitation(
      transceiverConfig.sendEncodings,
      trackContext.maxBandwidth,
    );

  return transceiverConfig;
};

export const setTransceiversToReadOnly = (connection: RTCPeerConnection) => {
  connection
    .getTransceivers()
    .forEach((transceiver) => (transceiver.direction = 'sendonly'));
};

type Mid = string;
type TrackId = string;
export type MidToTrackId = Record<Mid, TrackId>;


const getTrackContext = <EndpointMetadata, TrackMetadata>(
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
  localTrackId: string,
) =>
  Array.from(localTrackIdToTrack.values()).find(
    (trackContext) => trackContext?.track?.id === localTrackId,
  )!;

const getTransceiverMapping = <EndpointMetadata, TrackMetadata>(
  connection: RTCPeerConnection,
  localTrackIdToTrack: Map<
    RemoteTrackId,
    TrackContextImpl<EndpointMetadata, TrackMetadata>
  >,
): MidToTrackId =>
  connection
    .getTransceivers()
    .filter((transceiver) => transceiver.sender.track?.id && transceiver.mid)
    .reduce((acc, transceiver) => {
      const localTrackId = transceiver.sender.track!.id;
      const mid = transceiver!.mid!;

      const trackContext = getTrackContext(localTrackIdToTrack, localTrackId);

      acc[mid] = trackContext.trackId;

      return acc;
    }, {} as MidToTrackId);

const getAllNegotiatedLocalTracksMapping = <EndpointMetadata, TrackMetadata>(
  midToTrackId: Map<string, string> = new Map(),
  localEndpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
): MidToTrackId => {
  return [...midToTrackId.entries()]
    .filter(([_mid, trackId]) => localEndpoint.tracks.get(trackId))
    .reduce(
      (acc, [mid, trackId]) => ({ ...acc, [mid]: trackId }),
      {} as MidToTrackId,
    );
};
