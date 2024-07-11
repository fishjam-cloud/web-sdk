import type { Mid } from "../types";

export type Rid = "h" | "m" | "l"
export const isRid = (value: string): value is Rid => value === "h" || value === "m" || value === "l"

export type TrackEncodings = Record<Rid, boolean>

export interface TrackCommon {
  mid: Mid | null;
  encodings: TrackEncodings
}
