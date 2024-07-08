import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";
import type { WebRTCEndpointEvents } from "./types";
import type { MediaEvent} from "./mediaEvent";
import { serializeMediaEvent } from "./mediaEvent";

export class LocalEventEmitter<
  EndpointMetadata = any,
  TrackMetadata = any,
> extends (EventEmitter as {
  new<EndpointMetadata, TrackMetadata>(): TypedEmitter<
    Required<WebRTCEndpointEvents<EndpointMetadata, TrackMetadata>>
  >;
})<EndpointMetadata, TrackMetadata> {

  public sendMediaEvent = (mediaEvent: MediaEvent) => {
    const serializedMediaEvent = serializeMediaEvent(mediaEvent);
    this.emit('sendMediaEvent', serializedMediaEvent);
  };
}
