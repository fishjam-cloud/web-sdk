import type { TrackCommon, TrackEncodings, TrackId } from './TrackCommon';
import type { LocalTrackId, MLineId, Encoding } from '../types';
import type { TrackContextImpl } from '../internal';
import { isTrackKind } from '../internal';

export class RemoteTrack<EndpointMetadata, TrackMetadata>
  implements TrackCommon
{
  public id: TrackId;
  public mLineId: MLineId | null = null;
  public readonly trackContext: TrackContextImpl<
    EndpointMetadata,
    TrackMetadata
  >;
  // todo starts with true or false?
  public readonly encodings: TrackEncodings = { h: false, m: false, l: false };
  private targetEncoding: Encoding | null = null;

  constructor(
    id: LocalTrackId,
    trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>,
  ) {
    this.id = id;
    this.trackContext = trackContext;
  }

  public setReady = (stream: MediaStream, track: MediaStreamTrack) => {
    if (!isTrackKind(track.kind)) throw new Error('Track has no kind');

    this.trackContext.stream = stream;
    this.trackContext.track = track;
    this.trackContext.trackKind = track.kind;
  };

  public disableTrackEncoding = (encoding: Encoding) => {
    this.encodings[encoding] = false;
  };

  public enableTrackEncoding = (encoding: Encoding) => {
    this.encodings[encoding] = true;
  };

  public setTargetTrackEncoding = (variant: Encoding) => {
    // todo implement validation
    this.targetEncoding = variant;

    const trackContext = this.trackContext;

    if (!trackContext.simulcastConfig?.enabled) {
      throw new Error('The track does not support changing its target variant');
    }

    const isValidTargetEncoding =
      !trackContext.simulcastConfig.activeEncodings.includes(variant);

    if (isValidTargetEncoding) {
      throw new Error(`The track does not support variant ${variant}`);
    }
  };
  public setMLineId = (mLineId: MLineId) => {
    this.mLineId = mLineId;
  };
}
