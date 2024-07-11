import type { TrackContextImpl } from "../internal";
import type { BandwidthLimit, LocalTrackId, MediaStreamTrackId, Mid, TrackEncoding } from "../types";
import { applyBandwidthLimitation } from "../bandwidth";
import type { TrackCommon, TrackEncodings } from "./TrackCommon";
import { generateMediaEvent } from "../mediaEvent";
import type { WebRTCEndpoint } from "../webRTCEndpoint";
import { createTrackVariantBitratesEvent } from "../bitrate";

export const simulcastTransceiverConfig: RTCRtpTransceiverInit = {
  direction: 'sendonly',
  // keep this array from low resolution to high resolution
  // in other case lower resolution encoding can get
  // higher max_bitrate
  sendEncodings: [
    {
      rid: 'l',
      active: false,
      // maxBitrate: 4_000_000,
      scaleResolutionDownBy: 4.0,
      //   scalabilityMode: "L1T" + TEMPORAL_LAYERS_COUNT,
    },
    {
      rid: 'm',
      active: false,
      scaleResolutionDownBy: 2.0,
    },
    {
      rid: 'h',
      active: false,
      // maxBitrate: 4_000_000,
      // scalabilityMode: "L1T" + TEMPORAL_LAYERS_COUNT,
    },
  ],
};


export class LocalTrack<EndpointMetadata, TrackMetadata> implements TrackCommon {
  // its not local track id
  public readonly id: LocalTrackId;
  public mediaStreamTrackId: MediaStreamTrackId | null = null;
  public mid: Mid | null = null;
  public readonly trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>
  private rtcRtpSender: RTCRtpSender | null = null
  // todo change to { h: boolean, m: boolean, l: boolean }
  // for compatibility reasons
  public disabledEncodings: TrackEncoding[] = []
  public readonly encodings: TrackEncodings

  public connection: RTCPeerConnection

  constructor(connection: RTCPeerConnection, id: LocalTrackId, trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>) {
    this.connection = connection;
    this.id = id;
    this.trackContext = trackContext
    this.encodings = { h: true, m: true, l: true }
    if (trackContext.track?.id) {
      this.mediaStreamTrackId = trackContext.track?.id
    }
  }

  public getTrackId = () => {
    return this.id
  }

  public disableTrackEncoding = async (encoding: TrackEncoding) => {
    // maybe we could remove this object and use sender.getParameters().encodings.encodingParameter.active instead
    this.encodings[encoding] = false
    if (!this.disabledEncodings.find(e => e === encoding)) {
      this.disabledEncodings.push(encoding)
    }

    // const sender = findSenderByTrack(this.connection, track);
    const sender = this.rtcRtpSender

    if (!sender) throw new Error(`RTCRtpSender for track ${this.id} not found`)

    const params = sender.getParameters();
    const encodings = params.encodings

    const encodingParameter = encodings.find((en) => en.rid == encoding)

    if (!encodingParameter) throw new Error(`RTCRtpEncodingParameters for track ${this.id} not found`)

    encodingParameter.active = false;

    await sender.setParameters(params);
  }

  public addTrackToConnection = () => {
    const transceiverConfig = this.createTransceiverConfig()

    if (!this.trackContext.track) throw Error(`MediaStreamTrack for track ${this.id} does not exist`)

    this.connection.addTransceiver(this.trackContext.track, transceiverConfig);
  };

  private createTransceiverConfig = (): RTCRtpTransceiverInit => {
    if (!this.trackContext.track) throw new Error(`Cannot create transceiver config for ${this.id}`)

    if (this.trackContext.track.kind === 'audio') {
      return this.createAudioTransceiverConfig();
    }

    const videoTransceiver = this.createVideoTransceiverConfig();

    if (this.trackContext.maxBandwidth && videoTransceiver.sendEncodings)
      // todo remove mutation
      applyBandwidthLimitation(
        videoTransceiver.sendEncodings,
        this.trackContext.maxBandwidth,
      );

    return videoTransceiver;
  };

  private createAudioTransceiverConfig = (): RTCRtpTransceiverInit => {
    return {
      direction: 'sendonly',
      streams: this.trackContext.stream ? [this.trackContext.stream] : [],
    };
  };

  // todo this function mutates internal state
  private createVideoTransceiverConfig = (): RTCRtpTransceiverInit => {
    if (!this.trackContext.simulcastConfig) throw new Error(`Simulcast config for track ${this.id} not found.`)

    if (this.trackContext.simulcastConfig.enabled) {
      const transceiverConfig = { ...simulcastTransceiverConfig };
      const activeEncodings = this.trackContext.simulcastConfig.activeEncodings;

      transceiverConfig.sendEncodings?.forEach((encoding) => {
        const rid = encoding.rid as TrackEncoding

        if (activeEncodings.includes(rid)) {
          encoding.active = true;
          this.encodings[rid] = true
        } else {
          this.encodings[rid] = false
          if (!this.disabledEncodings.find(e => e === rid)) {
            this.disabledEncodings.push(rid)
          }
        }
      });

      return transceiverConfig
    } else {
      return {
        direction: 'sendonly',
        sendEncodings: [
          {
            active: true,
          },
        ],
        streams: this.trackContext.stream ? [this.trackContext.stream] : [],
      };
    }
  };

  public removeFromConnection = () => {
    // const sender = findSender(this.connection, trackContext.track!.id);

    // todo check if isLocal
    const sender = this.rtcRtpSender;

    if (!sender) throw new Error(`RTCRtpSender for track ${this.id} not found`)

    this.connection.removeTrack(sender);
  }

  // todo extract replace metadata
  // todo remove webrtc dependency
  public replaceTrack = async (newTrack: MediaStreamTrack | null, newTrackMetadata: TrackMetadata | undefined, webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>) => {
    const trackId = this.id
    const sender = this.rtcRtpSender;
    const stream = this.trackContext.stream;

    if (!sender) throw Error('There is no RTCRtpSender for this track id!');

    stream?.getTracks().forEach((track) => {
      stream?.removeTrack(track);
    });

    if (newTrack) {
      stream?.addTrack(newTrack);
    }

    if (this.trackContext.track && !newTrack) {
      const mediaEvent = generateMediaEvent('muteTrack', { trackId: trackId });
      webrtc.sendMediaEvent(mediaEvent);
      webrtc.emit('localTrackMuted', { trackId: trackId });
    } else if (!this.trackContext.track && newTrack) {
      const mediaEvent = generateMediaEvent('unmuteTrack', {
        trackId: trackId,
      });
      webrtc.sendMediaEvent(mediaEvent);
      webrtc.emit('localTrackUnmuted', { trackId: trackId });
    }

    this.mediaStreamTrackId = newTrack?.id ?? null;

    try {
      await sender.replaceTrack(newTrack);
      this.trackContext.track = newTrack;

      if (newTrackMetadata) {
        webrtc.updateTrackMetadata(trackId, newTrackMetadata);
      }
    } catch (error) {
      // ignore
    }
  }

  public setTrackBandwidth = (bandwidth: BandwidthLimit): Promise<void> => {
    const sender = this.rtcRtpSender
    if (!sender) throw new Error(`RTCRtpSender for track ${this.id} not found`)

    const parameters = sender.getParameters();

    if (parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    } else {
      applyBandwidthLimitation(parameters.encodings, bandwidth);
    }

    return sender.setParameters(parameters)
  }
}
