import { MediaEvent as ServerMediaEvent } from '@fishjam-cloud/protobufs/server';
import { MediaEvent as PeerMediaEvent } from '@fishjam-cloud/protobufs/peer';

export type SerializedMediaEvent = Uint8Array;

export interface MediaEvent {
  type: keyof PeerMediaEvent;
  key?: string;
  data?: any;
}

export function serializeMediaEvent(mediaEvent: PeerMediaEvent): Uint8Array {
  const encodedEvent = PeerMediaEvent.encode(mediaEvent).finish();
  return encodedEvent;
}

export function deserializeMediaEvent(serializedMediaEvent: SerializedMediaEvent): ServerMediaEvent {
  const decodedEvent = ServerMediaEvent.decode(serializedMediaEvent);
  return decodedEvent;
}

export function generateMediaEvent<T extends keyof PeerMediaEvent>(type: T, data?: PeerMediaEvent[T]): MediaEvent {
  const mediaEvent: MediaEvent = { type, data };

  return mediaEvent;
}

// export function generateCustomEvent(data?: any): MediaEvent {
//   return generateMediaEvent('custom', data);
// }
