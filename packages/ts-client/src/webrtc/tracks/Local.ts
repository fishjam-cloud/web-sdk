import { LocalTrack } from "./LocalTrack";
import type {
  BandwidthLimit,
  Encoding,
  MetadataParser,
  MLineId,
  RemoteTrackId,
  SimulcastConfig,
  TrackBandwidthLimit,
} from "../types";
import type { EndpointWithTrackContext } from "../internal";
import { isTrackKind, TrackContextImpl } from "../internal";
import type { WebRTCEndpoint } from "../webRTCEndpoint";
import { generateCustomEvent, generateMediaEvent } from "../mediaEvent";
import type { Connection } from "../Connection";
import type { Bitrates } from "../bitrate";

export type TrackId = string
export type EndpointId = string

type Mid = string;
export type MidToTrackId = Record<Mid, TrackId>;

export class Local<EndpointMetadata, TrackMetadata> {
  private readonly localTracks: Record<TrackId, LocalTrack<EndpointMetadata, TrackMetadata>> = {}
  private readonly localEndpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> = {
    id: '',
    type: 'webrtc',
    metadata: undefined,
    rawMetadata: undefined,
    tracks: new Map(),
  };

  private readonly endpointMetadataParser: MetadataParser<EndpointMetadata>;
  private readonly trackMetadataParser: MetadataParser<TrackMetadata>;

  // temporary for webrtc.emit and webrtc.sendMediaEvent
  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>;

  private connection: Connection | null = null;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
    endpointMetadataParser: MetadataParser<EndpointMetadata>,
    trackMetadataParser: MetadataParser<TrackMetadata>
  ) {
    this.webrtc = webrtc;
    this.endpointMetadataParser = endpointMetadataParser;
    this.trackMetadataParser = trackMetadataParser;
  }

  public addTrack = (
    connection: Connection | undefined,
    trackId: string,
    track: MediaStreamTrack,
    stream: MediaStream,
    trackMetadata: TrackMetadata | undefined,
    simulcastConfig: SimulcastConfig,
    maxBandwidth: TrackBandwidthLimit,
  ): LocalTrack<EndpointMetadata, TrackMetadata> => {
    const trackContext = new TrackContextImpl(
      this.localEndpoint,
      trackId,
      trackMetadata,
      simulcastConfig,
      this.trackMetadataParser,
    );

    trackContext.track = track;
    trackContext.stream = stream;
    trackContext.maxBandwidth = maxBandwidth;

    if (!isTrackKind(track.kind)) throw new Error('Track has no kind');
    trackContext.trackKind = track.kind;

    this.localEndpoint.tracks.set(trackId, trackContext);

    const trackManager = new LocalTrack<EndpointMetadata, TrackMetadata>(connection, trackId, trackContext, this.trackMetadataParser)
    this.localTracks[trackId] = trackManager
    return trackManager
  }


  public disableAllLocalTrackEncodings = async () => {
    // I'm afraid that we are disabling already disabled encodings
    Object.entries(this.localTracks)
      .forEach(([trackId, trackManager]) => {
        // todo async in forEach probably does not work
        trackManager.disabledEncodings.forEach(async (encoding) => {
          await this.disableLocalTrackEncoding(trackId, encoding)
        })
      })
  }

  public getTrackByMidOrNull = (mid: string): LocalTrack<EndpointMetadata, TrackMetadata> | null => {
    return Object.values(this.localTracks).find(track => track.mLineId === mid) ?? null;
  }

  public removeTrack = (trackId: TrackId) => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    trackManager.removeFromConnection()

    const mediaEvent = generateCustomEvent({ type: 'renegotiateTracks' });
    this.webrtc.sendMediaEvent(mediaEvent);

    this.localEndpoint.tracks.delete(trackId)
    delete this.localTracks[trackId]
  }

  public replaceTrack = async (trackId: TrackId, newTrack: MediaStreamTrack | null, newTrackMetadata: TrackMetadata | undefined) => {
    // todo add validation to track.kind, you cannot replace video with audio

    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    await trackManager.replaceTrack(newTrack, newTrackMetadata, this.webrtc)
  }

  public setEndpointMetadata = (metadata: EndpointMetadata) => {
    try {
      this.localEndpoint.metadata = this.endpointMetadataParser(metadata);
      this.localEndpoint.metadataParsingError = undefined;
    } catch (error) {
      this.localEndpoint.metadata = undefined;
      this.localEndpoint.metadataParsingError = error;
      throw error;
    }
    this.localEndpoint.rawMetadata = metadata;
  }

  public getEndpoint = (): EndpointWithTrackContext<EndpointMetadata, TrackMetadata> => {
    return this.localEndpoint;
  }

  public setTrackBandwidth = async (trackId: string, bandwidth: BandwidthLimit): Promise<void> => {
    // FIXME: maxBandwidth in TrackContext is not updated

    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    await trackManager.setTrackBandwidth(bandwidth);
    const mediaEvent = trackManager.createTrackVariantBitratesEvent();

    this.webrtc.sendMediaEvent(mediaEvent);
    this.webrtc.emit('localTrackBandwidthSet', {
      trackId,
      bandwidth,
    });
  }

  public getTrackIdToTrack = (): Map<RemoteTrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>> => {
    const entries: [string, TrackContextImpl<EndpointMetadata, TrackMetadata>][] = Object.values(this.localTracks).map((track) => [track.id, track.trackContext] as const);
    return new Map(entries)
  }

  public setLocalEndpointId = (endpointId: EndpointId) => {
    this.localEndpoint.id = endpointId;
  }

  public setEncodingBandwidth = async (trackId: TrackId, rid: Encoding, bandwidth: BandwidthLimit): Promise<void> => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    await trackManager.setEncodingBandwidth(rid, bandwidth);

    const mediaEvent = generateCustomEvent({
      type: 'trackVariantBitrates',
      data: {
        trackId: trackId,
        variantBitrates: trackManager.getTrackBitrates(),
      },
    });
    this.webrtc.sendMediaEvent(mediaEvent);

    this.webrtc.emit('localTrackEncodingBandwidthSet', {
      trackId,
      rid,
      bandwidth,
    });
  }

  public updateSenders = () => {
    Object.values(this.localTracks).forEach((localTrack) => {
      localTrack.updateSender()
    });
  }

  public updateEndpointMetadata = (metadata: unknown) => {
    this.localEndpoint.metadata = this.endpointMetadataParser(metadata);
    this.localEndpoint.rawMetadata = this.localEndpoint.metadata;
    this.localEndpoint.metadataParsingError = undefined;

    const mediaEvent = generateMediaEvent('updateEndpointMetadata', {
      metadata: this.localEndpoint.metadata,
    });
    this.webrtc.sendMediaEvent(mediaEvent);
    this.webrtc.emit('localEndpointMetadataChanged', { metadata: this.localEndpoint.metadata });
  }

  public updateLocalTrackMetadata = (trackId: TrackId, metadata: unknown) => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    trackManager.updateTrackMetadata(metadata)

    const trackContext = trackManager.trackContext

    const mediaEvent = generateMediaEvent('updateTrackMetadata', {
      trackId,
      trackMetadata: metadata,
    });

    switch (trackContext.negotiationStatus) {
      case 'done':
        this.webrtc.sendMediaEvent(mediaEvent);

        this.webrtc.emit('localTrackMetadataChanged', {
          trackId,
          metadata: trackContext.metadata!,
        });
        break;

      case 'offered':
        trackContext.pendingMetadataUpdate = true;
        break;

      case 'awaiting':
        // We don't need to do anything
        break;
    }
  }

  public disableLocalTrackEncoding = async (trackId: string, encoding: Encoding) => {
    const localTrack = this.localTracks[trackId];
    if (!localTrack) throw new Error(`Track ${trackId} not found`)

    await localTrack.disableTrackEncoding(encoding)

    const mediaEvent = generateMediaEvent('disableTrackEncoding', {
      trackId: trackId,
      encoding: encoding,
    });

    this.webrtc.sendMediaEvent(mediaEvent);
    this.webrtc.emit('localTrackEncodingEnabled', {
      trackId,
      encoding,
    });
  };

  public enableLocalTrackEncoding = async (trackId: TrackId, encoding: Encoding) => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    await trackManager.enableTrackEncoding(encoding)

    const mediaEvent = generateMediaEvent('enableTrackEncoding', {
      trackId: trackId,
      encoding: encoding,
    });

    this.webrtc.sendMediaEvent(mediaEvent);
    this.webrtc.emit('localTrackEncodingEnabled', {
      trackId,
      encoding,
    });
  }

  public getDisabledLocalTrackEncodings = (): Map<TrackId, Encoding[]> => {
    const entries = Object.values(this.localTracks)
      .map(track => [track.id, track.getDisabledEncodings()] as const)

    return new Map(entries)
  }

  public updateMLineIds = (midToTrackId: Record<MLineId, TrackId>) => {
    Object.entries(midToTrackId)
      .forEach(([mLineId, trackId]) => {
        const localTrack = this.localTracks[trackId]
        if (localTrack) {
          localTrack.setMLineId(mLineId)
        }
      })
  }

  public updateConnection = (connection: Connection) => {
    this.connection = connection;

    Object.values(this.localTracks).forEach((track) => {
      track.updateConnection(connection)
    })
  }

  public getTrackIdToMetadata = (): Record<TrackId, TrackMetadata | undefined> => {
    return Object.values(this.localTracks)
      .reduce(
        (previousValue, localTrack) => ({
          ...previousValue, [localTrack.id]: localTrack.trackContext.metadata,
        }),
        {} as Record<TrackId, TrackMetadata | undefined>,
      )
  };

  public getTrackIdToTrackBitrates = (): Record<TrackId, Bitrates> => {
    return Object.values(this.localTracks)
      .reduce(
        (previousValue, localTrack) => ({
          ...previousValue, [localTrack.id]: localTrack.getTrackBitrates()
        }),
        {} as Record<TrackId, Bitrates>,
      )
  };

  public getMidToTrackId = (): MidToTrackId | null => {
    if (!this.connection) return null;

    // - negotiated unmuted tracks: tracks added in previous negotiation, data is being transmitted
    // - not yet negotiated tracks: tracks added in this negotiation, data will be transmitted after successful negotiation
    const mappingFromTransceivers = this.getTransceiverMapping();

    // - negotiated unmuted tracks: tracks added in previous negotiation, data is being transmitted
    // - negotiated muted tracks: tracks added in previous negotiation, data is not being transmitted but can be transmitted in the future
    const mappingFromLocalNegotiatedTracks = Object.values(this.localTracks)
      .reduce((acc, curr) => {
        if (curr.mLineId) {
          acc[curr.mLineId] = curr.id
        }

        return acc
      }, {} as MidToTrackId)

    return { ...mappingFromTransceivers, ...mappingFromLocalNegotiatedTracks };
  };

  private getTransceiverMapping = (): MidToTrackId => {
    if (!this.connection) return ({});

    return this.connection
      .getConnection()
      .getTransceivers()
      .filter((transceiver) => transceiver.sender.track?.id && transceiver.mid)
      .reduce((acc, transceiver) => {
        const localTrackId = transceiver.sender.track!.id;
        const mid = transceiver!.mid!;

        const localTrack = Object.values(this.localTracks)
          .find(track => track.mediaStreamTrackId === localTrackId)

        if (!localTrack) throw new Error("Local track not found")

        acc[mid] = localTrack.trackContext.trackId;

        return acc;
      }, {} as MidToTrackId);
  };

  public setLocalTrackStatusToOffered = () => {
    Object.values(this.localTracks)
      .forEach((localTrack) => {
        localTrack.trackContext.negotiationStatus = 'offered';
      })
  }

  public addAllTracksToConnection = () => {
    Object.values(this.localTracks)
      .forEach((localTrack) => {
        localTrack.addTrackToConnection()
      })
  }
}
