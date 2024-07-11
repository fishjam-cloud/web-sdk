import type { Mid, Encoding } from "../types";

export type TrackEncodings = Record<Encoding, boolean>

export interface TrackCommon {
  mid: Mid | null;
  encodings: TrackEncodings
}
