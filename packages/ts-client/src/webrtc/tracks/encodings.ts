import type {
  Encoding,
  SimulcastBandwidthLimit,
  TrackBandwidthLimit,
} from '../types';
import type { TrackContextImpl } from "../internal";


export const getEncodingParameters = (parameters: RTCRtpSendParameters, bandwidth: number): RTCRtpEncodingParameters[] => {
  const unlimitedEncodings = [{}];

  return parameters.encodings.length === 0
    ? unlimitedEncodings
    : splitBandwidth(parameters.encodings, bandwidth);
}

export const createTransceiverConfig = (trackContext: TrackContextImpl<any, any>): RTCRtpTransceiverInit => {
  if (!trackContext.track)
    throw new Error(`Cannot create transceiver config for `);

  if (trackContext.track.kind === 'audio') {
    return createAudioTransceiverConfig(trackContext.stream);
  }

  return createVideoTransceiverConfig(trackContext, trackContext.maxBandwidth);
};

const createAudioTransceiverConfig = (stream: MediaStream | null): RTCRtpTransceiverInit => {
  return {
    direction: 'sendonly',
    streams: stream ? [stream] : [],
  };
};

const createVideoTransceiverConfig = (
  trackContext: TrackContextImpl<any, any>,
  maxBandwidth: TrackBandwidthLimit
): RTCRtpTransceiverInit => {
  if (!trackContext.simulcastConfig)
    throw new Error(`Simulcast config for track ${trackContext.trackId} not found.`);

  if (typeof maxBandwidth !== 'number' && trackContext.simulcastConfig.enabled) {
    return createSimulcastTransceiverConfig(trackContext, maxBandwidth)
  }

  if (typeof maxBandwidth === 'number') {
    return createNonSimulcastTransceiverConfig(trackContext, maxBandwidth)
  }

  throw new Error("LocalTrack is in invalid state!")
};

const createNonSimulcastTransceiverConfig = (
  trackContext: TrackContextImpl<any, any>,
  maxBandwidth: number): RTCRtpTransceiverInit => {
  return {
    direction: 'sendonly',
    sendEncodings: splitBandwidth([{ active: true }], maxBandwidth),
    streams: trackContext.stream ? [trackContext.stream] : [],
  };
}

const createSimulcastTransceiverConfig = (
  trackContext: TrackContextImpl<any, any>,
  maxBandwidth: SimulcastBandwidthLimit
): RTCRtpTransceiverInit => {
  if (!trackContext.simulcastConfig)
    throw new Error(`Simulcast config for track ${trackContext.trackId} not found.`);

  const activeEncodings = trackContext.simulcastConfig.activeEncodings;

  const encodings: RTCRtpEncodingParameters[] = [
    {
      rid: 'l',
      active: activeEncodings.includes('l'),
      // maxBitrate: 4_000_000,
      scaleResolutionDownBy: 4.0,
      //   scalabilityMode: "L1T" + TEMPORAL_LAYERS_COUNT,
    },
    {
      rid: 'm',
      active: activeEncodings.includes('m'),
      scaleResolutionDownBy: 2.0,
    },
    {
      rid: 'h',
      active: activeEncodings.includes('h'),
      // maxBitrate: 4_000_000,
      // scalabilityMode: "L1T" + TEMPORAL_LAYERS_COUNT,
    },
  ]

  return {
    direction: 'sendonly',
    // keep this array from low resolution to high resolution
    // in other case lower resolution encoding can get
    // higher max_bitrate
    sendEncodings: calculateSimulcastEncodings(encodings, maxBandwidth),
  }
}

const calculateSimulcastEncodings = (
  encodings: RTCRtpEncodingParameters[],
  maxBandwidth: SimulcastBandwidthLimit
) => {
  return encodings
    .filter((encoding) => encoding.rid)
    .map((encoding) => {
      const rid = encoding.rid! as Encoding;

      const limit = maxBandwidth.get(rid) || 0;

      return ({ ...encoding, maxBitrate: limit > 0 ? limit * 1024 : undefined }) satisfies RTCRtpEncodingParameters
    });
}

const splitBandwidth = (
  rtcRtpEncodingParameters: RTCRtpEncodingParameters[],
  maxBandwidth: number,
): RTCRtpEncodingParameters[] => {
  const bandwidth = maxBandwidth * 1024

  if (bandwidth === 0) {
    return rtcRtpEncodingParameters
      .map((encoding) => ({ ...encoding, maxBitrate: undefined }))
  }

  if (rtcRtpEncodingParameters.length === 0) {
    // This most likely is a race condition. Log an error and prevent catastrophic failure
    console.error(
      "Attempted to limit bandwidth of the track that doesn't have any encodings",
    );
    return rtcRtpEncodingParameters.map((encoding) => ({ ...encoding }));
  }
  if (!rtcRtpEncodingParameters[0])
    throw new Error('RTCRtpEncodingParameters is in invalid state');

  // We are solving the following equation:
  // x + (k0/k1)^2 * x + (k0/k2)^2 * x + ... + (k0/kn)^2 * x = bandwidth
  // where x is the bitrate for the first encoding, kn are scaleResolutionDownBy factors
  // square is dictated by the fact that k0/kn is a scale factor, but we are interested in the total number of pixels in the image
  const firstScaleDownBy = rtcRtpEncodingParameters[0].scaleResolutionDownBy || 1;
  const bitrate_parts = rtcRtpEncodingParameters.reduce(
    (acc, value) =>
      acc + (firstScaleDownBy / (value.scaleResolutionDownBy || 1)) ** 2,
    0,
  );
  const x = bandwidth / bitrate_parts;

  return rtcRtpEncodingParameters.map((encoding) => ({
    ...encoding,
    maxBitrate: x * (firstScaleDownBy / (encoding.scaleResolutionDownBy || 1)) ** 2
  }));
};
