import type { TrackContext, Encoding } from './types';
import { applyBandwidthLimitation } from './bandwidth';
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
