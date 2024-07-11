import { LocalTrack } from "./LocalTrack";
import type {
  BandwidthLimit,
  EncodingReason,
  MetadataParser,
  RemoteTrackId,
  SimulcastConfig,
  TrackBandwidthLimit,
  TrackContext,
  Encoding
} from "../types";
import type { RemoteTrack } from "./RemoteTrack";
import type { EndpointWithTrackContext } from "../internal";
import { isTrackKind, TrackContextImpl } from "../internal";
import type { WebRTCEndpoint } from "../webRTCEndpoint";
import { isVadStatus } from "../voiceActivityDetection";
import { generateCustomEvent, generateMediaEvent } from "../mediaEvent";
import { createTrackVariantBitratesEvent, getTrackBitrates } from "../bitrate";

export type TrackId = string
export type EndpointId = string

export class Tracks<EndpointMetadata, TrackMetadata> {
  private readonly localTracks: Record<TrackId, LocalTrack<EndpointMetadata, TrackMetadata>> = {}
  private readonly localEndpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> = {
    id: '',
    type: 'webrtc',
    metadata: undefined,
    rawMetadata: undefined,
    tracks: new Map(),
  };
  private readonly remoteTracks: Record<TrackId, RemoteTrack<EndpointMetadata, TrackMetadata>> = {}
  private readonly remoteEndpoints: Record<EndpointId, EndpointWithTrackContext<EndpointMetadata, TrackMetadata>> = {}

  private readonly endpointMetadataParser: MetadataParser<EndpointMetadata>;
  private readonly trackMetadataParser: MetadataParser<TrackMetadata>;

  // temporary for webrtc.emit and webrtc.sendMediaEvent
  private readonly webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>;

  constructor(
    webrtc: WebRTCEndpoint<EndpointMetadata, TrackMetadata>,
    endpointMetadataParser: MetadataParser<EndpointMetadata>,
    trackMetadataParser: MetadataParser<TrackMetadata>
  ) {
    this.webrtc = webrtc;
    this.endpointMetadataParser = endpointMetadataParser;
    this.trackMetadataParser = trackMetadataParser;
  }

  public addLocalTrack = (
    connection: RTCPeerConnection,
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


  public disableAllLocalTrackEncodings = () => {
    // I'm afraid that we are disabling already disabled encodings
    Object.entries(this.localTracks)
      .forEach(([trackId, trackManager]) => {
        trackManager.disabledEncodings.forEach((encoding) => {
          this.disableLocalTrackEncoding(trackId, encoding)
        })
      })
  }

  private getLocalTrackByMid = (mid: string): LocalTrack<EndpointMetadata, TrackMetadata> => {
    const localTrack = Object.values(this.localTracks).find(track => track.mid === mid)
    if (!localTrack) throw new Error(`Local track with ${mid} not found`)
    return localTrack;
  }

  public getLocalTrackByMidOrNull = (mid: string): LocalTrack<EndpointMetadata, TrackMetadata> | null => {
    return Object.values(this.localTracks).find(track => track.mid === mid) ?? null;
  }

  public getRemoteTrackByMid = (mid: string): RemoteTrack<EndpointMetadata, TrackMetadata> => {
    const remoteTrack = Object.values(this.remoteTracks).find(remote => remote.mid === mid)
    if (!remoteTrack) throw new Error(`Remote track with ${mid} not found`)
    return remoteTrack;
  }

  public addRemoteTracks = (data: any) => {
    // const rawTracks = new Map<string, any>(Object.entries(data.tracks));
    const endpointId: EndpointId = data.endpointId

    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> | undefined = this.remoteEndpoints[endpointId];

    if (!endpoint) throw new Error(`Endpoint ${endpointId} not found`)

    // const oldTracks = endpoint.tracks;

    // all tracks or only new tracks?

    throw new Error("Fix me!")
    // const trackContextRecord = this.mapToTrackContext(rawTracks, endpoint);

    // endpoint.tracks = new Map([...endpoint.tracks, ...trackContextRecord]);

    // Array.from(endpoint.tracks.entries()).forEach(([trackId, ctx]) => {
    //   if (!oldTracks.has(trackId)) {
    //     this.trackIdToTrack.set(trackId, ctx);
    //
    //     this.webrtc.emit('trackAdded', ctx);
    //   }
    // });
  };

  private mapToTrackContext = (
    tracks: Map<string, any>,
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ): Map<TrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>> => {
    const mappedTracks: Array<
      [string, TrackContextImpl<EndpointMetadata, TrackMetadata>]
    > = Array.from(tracks).map(([trackId, track]) => [
      trackId,
      new TrackContextImpl(
        endpoint,
        trackId,
        track.metadata,
        track.simulcastConfig,
        this.trackMetadataParser,
      ),
    ]);

    return new Map(mappedTracks);
  };

  public removeRemoteTracks = (trackIds: TrackId[]) => {
    trackIds.forEach((trackId) => {
      this.removeRemoteTrack(trackId)
    });
  }

  public removeRemoteTrack = (trackId: TrackId) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    const remoteEndpoint = this.remoteEndpoints[remoteTrack.trackContext.endpoint.id]
    if (!remoteEndpoint) throw new Error(`Endpoint ${remoteTrack.trackContext.endpoint.id} not found`)

    remoteEndpoint.tracks.delete(trackId)
    delete this.remoteTracks[trackId]

    this.webrtc.emit('trackRemoved', remoteTrack.trackContext);
  }

  public addRemoteEndpoint = (endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>) => {
    // todo create deep copy of endpoint
    // mutation in place
    this.updateEndpointMetadata(endpoint, endpoint.metadata)

    this.addEndpoint(endpoint);

    this.webrtc.emit('endpointAdded', endpoint);
  }

  private addEndpoint = (
    endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>,
  ): void => {
    // #TODO remove this line after fixing deserialization
    // if (Object.prototype.hasOwnProperty.call(endpoint, 'trackIdToMetadata'))
    //   endpoint.tracks = new Map(Object.entries(endpoint.tracks));
    // else endpoint.tracks = new Map();

    this.remoteEndpoints[endpoint.id] = endpoint
  };

  public updateRemoteEndpoint = (data: any) => {
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> | undefined = this.remoteEndpoints[data.id]
    if (!endpoint) throw new Error(`Endpoint ${data.id} not found`)

    // mutation in place
    this.updateEndpointMetadata(endpoint, data.metadata)

    this.webrtc.emit('endpointUpdated', endpoint);
  };

  private updateEndpointMetadata = (endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata>, metadata: unknown) => {
    try {
      endpoint.metadata = this.endpointMetadataParser(metadata);
      endpoint.metadataParsingError = undefined;
    } catch (error) {
      endpoint.metadata = undefined;
      endpoint.metadataParsingError = error;
    }
    endpoint.rawMetadata = metadata;
  }

  public removeRemoteEndpoint = (endpointId: EndpointId) => {
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> | undefined = this.remoteEndpoints[endpointId]
    if (!endpoint) throw new Error(`Endpoint ${endpointId} not found`)

    const trackIds = [...endpoint.tracks.values()].map(({ trackId }) => trackId)

    this.removeRemoteTracks(trackIds)

    delete this.remoteEndpoints[endpointId]

    this.webrtc.emit('endpointRemoved', endpoint);
  };

  public updateRemoteTrack = (data: any) => {
    const endpointId = data.endpointId
    const endpoint: EndpointWithTrackContext<EndpointMetadata, TrackMetadata> | undefined = this.remoteEndpoints[endpointId];
    if (!endpoint) throw new Error(`Endpoint ${endpointId} not found`)

    const trackId = data.trackId;

    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    this.updateTrackMetadata(remoteTrack.trackContext, data.metadata)

    this.webrtc.emit('trackUpdated', remoteTrack.trackContext);
  }

  private updateTrackMetadata = (trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>, trackMetadata: unknown) => {
    try {
      trackContext.metadata = this.trackMetadataParser(trackMetadata);
      trackContext.metadataParsingError = undefined;
    } catch (error) {
      trackContext.metadataParsingError = error;
      trackContext.metadata = undefined;
    }
    trackContext.rawMetadata = trackMetadata;
  }

  public disableRemoteTrackEncoding = (trackId: TrackId, encoding: Encoding) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    remoteTrack.disableTrackEncoding(encoding)

    this.webrtc.emit('trackEncodingDisabled', remoteTrack.trackContext, encoding);
  }

  public enableRemoteTrackEncoding = (trackId: TrackId, encoding: Encoding) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    remoteTrack.enableTrackEncoding(encoding)

    this.webrtc.emit('trackEncodingEnabled', remoteTrack.trackContext, encoding);
  }

  public setRemoteTrackEncoding = (trackId: TrackId, encoding: Encoding, reason: EncodingReason) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    remoteTrack.trackContext.encoding = encoding;
    remoteTrack.trackContext.encodingReason = reason;

    remoteTrack.trackContext.emit('encodingChanged', remoteTrack.trackContext);
  };

  public setRemoteTrackVadStatus = (trackId: TrackId, vadStatus: string) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    if (isVadStatus(vadStatus)) {
      remoteTrack.trackContext.vadStatus = vadStatus;
      remoteTrack.trackContext.emit('voiceActivityChanged', remoteTrack.trackContext);
    } else {
      console.warn('Received unknown vad status: ', vadStatus);
    }
  };

  public removeLocalTrack = (trackId: TrackId) => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    trackManager.removeFromConnection()

    const mediaEvent = generateCustomEvent({ type: 'renegotiateTracks' });
    this.webrtc.sendMediaEvent(mediaEvent);

    delete this.localTracks[trackId]
  }

  public replaceLocalTrack = async (trackId: TrackId, newTrack: MediaStreamTrack | null, newTrackMetadata: TrackMetadata | undefined) => {
    // todo add validation to track.kind, you cannot replace video with audio

    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    await trackManager.replaceTrack(newTrack, newTrackMetadata, this.webrtc)
  }

  public setLocalEndpointMetadata = (metadata: EndpointMetadata) => {
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

  public getRemoteTrackContexts = (): Record<string, TrackContext<EndpointMetadata, TrackMetadata>> => {
    return Object.values(this.remoteTracks)
      .reduce((acc, current) => ({
        ...acc,
        [current.trackContext.trackId]: current.trackContext
      }), {} as Record<string, TrackContext<EndpointMetadata, TrackMetadata>>)
  }

  public getRemoteEndpoints = (): Record<string, EndpointWithTrackContext<EndpointMetadata, TrackMetadata>> => {
    return Object.values(this.remoteEndpoints)
      .reduce((acc, current) =>
          ({ ...acc, [current.id]: current }),
        {} as Record<string, EndpointWithTrackContext<EndpointMetadata, TrackMetadata>>)
  }

  public getLocalEndpoint = (): EndpointWithTrackContext<EndpointMetadata, TrackMetadata> => {
    return this.localEndpoint;
  }

  public setLocalTrackBandwidth = (trackId: string, bandwidth: BandwidthLimit, connection: RTCPeerConnection): Promise<void> => {
    // FIXME: maxBandwidth in TrackContext is not updated

    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)


    return trackManager.setTrackBandwidth(bandwidth)
      .then(() => {
        // todo refactor
        const mediaEvent = createTrackVariantBitratesEvent(
          trackId,
          connection,
          this.getLocalTrackIdToTrack(),
        );
        this.webrtc.sendMediaEvent(mediaEvent);

        this.webrtc.emit('localTrackBandwidthSet', {
          trackId,
          bandwidth,
        });
      })
  }

  public getLocalTrackIdToTrack = (): Map<RemoteTrackId, TrackContextImpl<EndpointMetadata, TrackMetadata>> => {
    const map = Object.values(this.localTracks).map((track) => [track.id, track.trackContext] as const);
    return new Map(map)
  }

  public setLocalEndpointId = (endpointId: EndpointId) => {
    this.localEndpoint.id = endpointId;
  }

  public setLocalEncodingBandwidth = (trackId: TrackId, rid: Encoding, bandwidth: BandwidthLimit, connection: RTCPeerConnection): Promise<void> => {
    const trackManager = this.localTracks[trackId]
    if (!trackManager) throw new Error(`Cannot find ${trackId}`)

    return trackManager.setLocalEncodingBandwidth(rid, bandwidth)
      .then(() => {
        const mediaEvent = generateCustomEvent({
          type: 'trackVariantBitrates',
          data: {
            trackId: trackId,
            variantBitrates: getTrackBitrates(
              connection,
              this.getLocalTrackIdToTrack(),
              trackId,
            ),
          },
        });
        this.webrtc.sendMediaEvent(mediaEvent);
        this.webrtc.emit('localTrackEncodingBandwidthSet', {
          trackId,
          rid,
          bandwidth,
        });
      })
  }

  public updateSenders = () => {
    Object.values(this.localTracks).forEach((localTrack) => {
      localTrack.updateSender()
    });
  }

  public updateLocalEndpointMetadata = (metadata: unknown) => {
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

    await trackManager.enableLocalTrackEncoding(trackId, encoding)

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

  public setTargetRemoteTrackEncoding = (trackId: TrackId, variant: Encoding) => {
    const remoteTrack = this.remoteTracks[trackId]
    if (!remoteTrack) throw new Error(`Track ${trackId} not found`)

    try {
      remoteTrack.setTargetTrackEncoding(variant)

      const mediaEvent = generateCustomEvent({
        type: 'setTargetTrackVariant',
        data: {
          trackId: trackId,
          variant,
        },
      });

      this.webrtc.sendMediaEvent(mediaEvent);
      this.webrtc.emit('targetTrackEncodingRequested', {
        trackId,
        variant,
      });

    } catch (e) {
      console.warn(e)
    }
  }

  public getDisabledLocalTrackEncodings = (): Map<TrackId, Encoding[]> => {
    const entries = Object.values(this.localTracks)
      .map(track => [track.id, track.getDisabledEncodings()] as const)

    return new Map(entries)
  }
}
