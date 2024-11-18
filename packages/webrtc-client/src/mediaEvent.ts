import { BinaryReader } from '@bufbuild/protobuf/wire';
import { MediaEvent as ServerMediaEvent } from '../protos/media_events/server/server';
import { MediaEvent as PeerMediaEvent } from '../protos/media_events/peer/peer';

export type SerializedMediaEvent = BinaryReader | Uint8Array;

export interface MediaEvent {
  type: keyof ServerMediaEvent;
  key?: string;
  data?: any;
}

export function serializeMediaEvent(mediaEvent: PeerMediaEvent): SerializedMediaEvent {
  const encodedEvent = PeerMediaEvent.encode(mediaEvent).finish();
  return encodedEvent;
}

export function deserializeMediaEvent(serializedMediaEvent: SerializedMediaEvent): ServerMediaEvent {
  const decodedEvent = ServerMediaEvent.decode(serializedMediaEvent);
  return decodedEvent;
}

export function generateMediaEvent(type: keyof ServerMediaEvent, data?: any): MediaEvent {
  let event: MediaEvent = { type };
  if (data) {
    event = { ...event, data };
  }
  return event;
}

// export function generateCustomEvent(data?: any): MediaEvent {
//   return generateMediaEvent('custom', data);
// }
