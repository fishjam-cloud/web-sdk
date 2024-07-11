import type { MLineId, Encoding } from "../types";

export type TrackEncodings = Record<Encoding, boolean>

export interface TrackCommon {
  mLineId: MLineId | null;
  encodings: TrackEncodings
}
