import type { TrackContextImpl } from '../internal';
import type {
  BandwidthLimit,
  Encoding,
  LocalTrackId,
  MediaStreamTrackId,
  MetadataParser,
  MLineId,
  SimulcastBandwidthLimit,
  TrackBandwidthLimit,
  TrackKind,
} from '../types';
import type { TrackCommon, TrackEncodings, TrackId } from './TrackCommon';
import { generateCustomEvent, generateMediaEvent } from '../mediaEvent';
import type { WebRTCEndpoint } from '../webRTCEndpoint';
import type { Bitrate } from '../bitrate';
import { defaultBitrates, defaultSimulcastBitrates, UNLIMITED_BANDWIDTH, } from '../bitrate';
import type { Connection } from '../Connection';

export class LocalTrack<EndpointMetadata, TrackMetadata>
  implements TrackCommon {
  public readonly id: TrackId;
  public mediaStreamTrackId: MediaStreamTrackId | null = null;
  public mLineId: MLineId | null = null;
  public readonly trackContext: TrackContextImpl<
    EndpointMetadata,
    TrackMetadata
  >;
  private sender: RTCRtpSender | null = null;
  public readonly encodings: TrackEncodings;

  private readonly metadataParser: MetadataParser<TrackMetadata>;

  public connection: Connection | undefined;

  constructor(
    connection: Connection | undefined,
    id: LocalTrackId,
    trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>,
    metadataParser: MetadataParser<TrackMetadata>,
  ) {
    this.connection = connection;
    this.id = id;
    this.trackContext = trackContext;

    // todo maybe we could remove this object and use sender.getParameters().encodings.encodingParameter.active instead
    this.encodings = { h: true, m: true, l: true };
    if (trackContext.track?.id) {
      this.mediaStreamTrackId = trackContext.track?.id;
    }
    this.metadataParser = metadataParser;
  }

  public disableTrackEncoding = async (encoding: Encoding) => {
    this.encodings[encoding] = false;

    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);

    const params = this.sender.getParameters();
    const encodings = params.encodings;

    const encodingParameter = encodings.find((en) => en.rid == encoding);

    if (!encodingParameter)
      throw new Error(
        `RTCRtpEncodingParameters for track ${this.id} not found`,
      );

    encodingParameter.active = false;

    await this.sender.setParameters(params);
  };

  public addTrackToConnection = () => {
    if (!this.trackContext.track)
      throw Error(`MediaStreamTrack for track ${this.id} does not exist`);
    if (!this.connection)
      throw new Error(`There is no active RTCPeerConnection`);

    const transceiverConfig = this.createTransceiverConfig();

    this.connection.addTransceiver(this.trackContext.track, transceiverConfig);
  };

  private createTransceiverConfig = (): RTCRtpTransceiverInit => {
    if (!this.trackContext.track)
      throw new Error(`Cannot create transceiver config for ${this.id}`);

    if (this.trackContext.track.kind === 'audio') {
      return this.createAudioTransceiverConfig();
    }

    const videoTransceiver = this.createVideoTransceiverConfig();

    if (this.trackContext.maxBandwidth && videoTransceiver.sendEncodings) {
      // warning: this function mutates `videoTransceiver`
      this.applyBandwidthLimitation(videoTransceiver.sendEncodings, this.trackContext.maxBandwidth)
    }

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
    if (!this.trackContext.simulcastConfig)
      throw new Error(`Simulcast config for track ${this.id} not found.`);

    if (this.trackContext.simulcastConfig.enabled) {
      const transceiverConfig: RTCRtpTransceiverInit = {
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

      const activeEncodings = this.trackContext.simulcastConfig.activeEncodings;

      transceiverConfig.sendEncodings?.forEach((encoding) => {
        const rid = encoding.rid as Encoding;

        if (activeEncodings.includes(rid)) {
          encoding.active = true;
          this.encodings[rid] = true;
        } else {
          this.encodings[rid] = false;
        }
      });

      return transceiverConfig;
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
    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);
    if (!this.connection)
      throw new Error(`There is no active RTCPeerConnection`);

    this.connection.removeTrack(this.sender);
  };

  // todo extract replace metadata
  public replaceTrack = async (
    newTrack: MediaStreamTrack | null,
    newTrackMetadata: TrackMetadata | undefined,
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
  ): Promise<void> => {
    const trackId = this.id;
    const stream = this.trackContext.stream;

    if (!this.sender) throw Error('There is no RTCRtpSender for this track id!');

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
      await this.sender.replaceTrack(newTrack);
      this.trackContext.track = newTrack;

      if (newTrackMetadata) {
        webrtc.updateTrackMetadata(trackId, newTrackMetadata);
      }
    } catch (error) {
      // ignore
    }
  };

  public setTrackBandwidth = (bandwidth: BandwidthLimit): Promise<void> => {
    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);

    const parameters = this.sender.getParameters();

    if (parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    } else {
      this.applyBandwidthLimitation(parameters.encodings, bandwidth);
    }

    return this.sender.setParameters(parameters);
  };

  public setEncodingBandwidth(
    rid: Encoding,
    bandwidth: BandwidthLimit,
  ): Promise<void> {
    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);

    const parameters = this.sender.getParameters();
    const encoding = parameters.encodings.find(
      (encoding) => encoding.rid === rid,
    );

    if (!encoding) {
      return Promise.reject(`Encoding with rid '${rid}' doesn't exist`);
    } else if (bandwidth === 0) {
      delete encoding.maxBitrate;
    } else {
      encoding.maxBitrate = bandwidth * 1024;
    }

    return this.sender.setParameters(parameters);
  }

  public updateSender = () => {
    if (this.mediaStreamTrackId && this.connection) {
      this.sender = this.connection.findSender(this.mediaStreamTrackId);
    }
  };

  public updateTrackMetadata = (metadata: unknown) => {
    const trackContext = this.trackContext;

    try {
      trackContext.metadata = this.metadataParser(metadata);
      trackContext.rawMetadata = metadata;
      trackContext.metadataParsingError = undefined;
    } catch (error) {
      trackContext.metadata = undefined;
      trackContext.metadataParsingError = error;
      throw error;
    }
  };

  public enableTrackEncoding = (encoding: Encoding) => {
    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);

    const params = this.sender.getParameters();
    const encodingParameters = params.encodings.find(
      (en) => en.rid == encoding,
    );

    if (!encodingParameters)
      throw new Error(
        `RTCRtEncodingParameters ${encoding} for track ${this.id} not found`,
      );

    encodingParameters.active = true;

    return this.sender.setParameters(params);
  };

  public getDisabledEncodings = (): Encoding[] => {
    return Object.entries(this.encodings)
      .filter(([_, value]) => !value)
      .map(([encoding]) => encoding as Encoding)
      .reduce((acc, encoding) => [...acc, encoding], [] as Encoding[]);
  };

  public setMLineId = (mLineId: MLineId) => {
    this.mLineId = mLineId;
  };

  private isNotSimulcastTrack = (encodings: RTCRtpEncodingParameters[]) =>
    encodings.length === 1 && !encodings[0]!.rid;

  public getTrackBitrates = () => {
    const trackContext = this.trackContext;
    const kind = this.trackContext.track?.kind as TrackKind | undefined;

    if (!trackContext.track) {
      if (!trackContext.trackKind) {
        throw new Error('trackContext.trackKind is empty');
      }

      return defaultBitrates[trackContext.trackKind];
    }

    if (!this.sender) throw new Error(`RTCRtpSender for track ${this.id} not found`);

    const encodings = this.sender.getParameters().encodings;

    if (this.isNotSimulcastTrack(encodings)) {
      return (
        encodings[0]!.maxBitrate ||
        (kind ? defaultBitrates[kind] : UNLIMITED_BANDWIDTH)
      );
    } else if (kind === 'audio') {
      throw 'Audio track cannot have multiple encodings';
    }

    return encodings
      .filter((encoding) => encoding.rid)
      .reduce((acc, encoding) => {
        const rid = encoding.rid! as Encoding;
        acc[rid] = encoding.maxBitrate || defaultSimulcastBitrates[rid];
        return acc
      }, {} as Record<string, Bitrate>);
  };

  public updateConnection = (connection: Connection) => {
    this.connection = connection;
  };

  public createTrackVariantBitratesEvent = () => {
    return generateCustomEvent({
      type: 'trackVariantBitrates',
      data: {
        trackId: this.id,
        variantBitrates: this.getTrackBitrates(),
      },
    });
  };


  // todo refactor to pure function
  private applyBandwidthLimitation = (
    encodings: RTCRtpEncodingParameters[],
    maxBandwidth: TrackBandwidthLimit,
  ) => {
    if (typeof maxBandwidth === 'number') {
      // non-simulcast limitation
      this.splitBandwidth(encodings, (maxBandwidth as number) * 1024);
    } else {
      // simulcast bandwidth limit
      encodings
        .filter((encoding) => encoding.rid)
        .forEach((encoding) => {
          const limit =
            (maxBandwidth as SimulcastBandwidthLimit).get(
              encoding.rid! as Encoding,
            ) || 0;

          if (limit > 0) {
            encoding.maxBitrate = limit * 1024;
          } else delete encoding.maxBitrate;
        });
    }
  };

  // todo refactor to pure function
  private splitBandwidth = (
    encodings: RTCRtpEncodingParameters[],
    bandwidth: number,
  ) => {
    if (bandwidth === 0) {
      encodings.forEach((encoding) => delete encoding.maxBitrate);
      return;
    }

    if (encodings.length === 0) {
      // This most likely is a race condition. Log an error and prevent catastrophic failure
      console.error(
        "Attempted to limit bandwidth of the track that doesn't have any encodings",
      );
      return;
    }

    if (!encodings[0]) throw new Error("RTCRtpEncodingParameters is in invalid state")

    // We are solving the following equation:
    // x + (k0/k1)^2 * x + (k0/k2)^2 * x + ... + (k0/kn)^2 * x = bandwidth
    // where x is the bitrate for the first encoding, kn are scaleResolutionDownBy factors
    // square is dictated by the fact that k0/kn is a scale factor, but we are interested in the total number of pixels in the image
    const firstScaleDownBy = encodings[0].scaleResolutionDownBy || 1;
    const bitrate_parts = encodings.reduce(
      (acc, value) =>
        acc + (firstScaleDownBy / (value.scaleResolutionDownBy || 1)) ** 2,
      0,
    );
    const x = bandwidth / bitrate_parts;

    encodings.forEach((value) => {
      value.maxBitrate =
        x * (firstScaleDownBy / (value.scaleResolutionDownBy || 1)) ** 2;
    });
  };
}
