import { TrackContext, TrackEncoding } from './types';
import { simulcastTransceiverConfig } from './const';
import { applyBandwidthLimitation } from './bandwidth';

export const createAudioTransceiverConfig = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
): RTCRtpTransceiverInit => {
  return {
    direction: 'sendonly',
    streams: trackContext.stream ? [trackContext.stream] : [],
  };
};

export const createVideoTransceiverConfig = <EndpointMetadata, TrackMetadata>(
  trackContext: TrackContext<EndpointMetadata, TrackMetadata>,
  disabledTrackEncodingsMap: Map<string, TrackEncoding[]>,
): RTCRtpTransceiverInit => {
  let transceiverConfig: RTCRtpTransceiverInit;
  if (trackContext.simulcastConfig!.enabled) {
    transceiverConfig = simulcastTransceiverConfig;
    const trackActiveEncodings = trackContext.simulcastConfig!.activeEncodings;
    const disabledTrackEncodings: TrackEncoding[] = [];
    transceiverConfig.sendEncodings?.forEach((encoding) => {
      if (trackActiveEncodings.includes(encoding.rid! as TrackEncoding)) {
        encoding.active = true;
      } else {
        disabledTrackEncodings.push(encoding.rid! as TrackEncoding);
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
