import type { TrackCommon, TrackEncodings } from "./TrackCommon";
import type { LocalTrackId, Mid, TrackEncoding } from "../types";
import type { TrackContextImpl } from "../internal";
import { isTrackKind } from "../internal";
import type { TrackId } from "./Tracks";

export class RemoteTrack<EndpointMetadata, TrackMetadata> implements TrackCommon {
  public id: TrackId | null = null;
  public mid: Mid | null = null;
  public readonly trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>;
  // todo starts with true or false?
  public readonly encodings: TrackEncodings = { h: false, m: false, l: false}

  constructor(id: LocalTrackId, trackContext: TrackContextImpl<EndpointMetadata, TrackMetadata>) {
    this.id = id;
    this.trackContext = trackContext
  }

  public setReady = (stream: MediaStream, track: MediaStreamTrack) => {
    if (!isTrackKind(track.kind)) throw new Error('Track has no kind');

    this.trackContext.stream = stream;
    this.trackContext.track = track;
    this.trackContext.trackKind = track.kind;
  }

  public disableTrackEncoding = (encoding: TrackEncoding) => {
    this.encodings[encoding] = false
  }

  public enableTrackEncoding = (encoding: TrackEncoding) => {
    this.encodings[encoding] = true
  }
}
