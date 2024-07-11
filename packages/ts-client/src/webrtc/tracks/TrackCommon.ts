import type { Mid } from "../types";

export type TrackEncodings = {
  h: boolean,
  m: boolean,
  l: boolean,
}

export interface TrackCommon {
  mid: Mid | null;
  encodings: TrackEncodings
}
