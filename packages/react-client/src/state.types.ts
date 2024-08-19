import type { Encoding, VadStatus, SimulcastConfig, ReconnectionStatus } from "@fishjam-cloud/ts-client";
import type { MediaState, PeerMetadata, TrackMetadata } from "./types";
import type { Devices } from "./types";
import type { Client } from "./Client";
import type { TrackManager } from "./trackManager";

export type TrackId = string;
export type PeerId = string;

export type Track = {
  stream: MediaStream | null;
  encoding: Encoding | null;
  trackId: TrackId;
  // todo hide this field
  // todo expose type and active
  metadata?: TrackMetadata;
  rawMetadata: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  metadataParsingError?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  simulcastConfig: SimulcastConfig | null;
  vadStatus: VadStatus;
  track: MediaStreamTrack | null;
};

export interface Origin {
  id: string;
  type: string;
  metadata?: PeerMetadata;
  rawMetadata: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  metadataParsingError?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type TrackWithOrigin = Track & {
  origin: Origin;
};

export type PeerState = {
  id: PeerId;
  metadata?: PeerMetadata;
  rawMetadata: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  metadataParsingError?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  tracks: Record<TrackId, Track>;
};

export type PeerStatus = "connecting" | "connected" | "authenticated" | "joined" | "error" | "closed" | null;

export type UseReconnection = {
  status: ReconnectionStatus;
  isReconnecting: boolean;
  isError: boolean;
  isIdle: boolean;
};

export type State = {
  local: PeerState | null;
  remote: Record<PeerId, PeerState>;
  tracks: Record<TrackId, TrackWithOrigin>;
  bandwidthEstimation: bigint;
  status: PeerStatus;
  media: MediaState | null;
  devices: Devices;
  client: Client;
  videoTrackManager: TrackManager;
  audioTrackManager: TrackManager;
  reconnectionStatus: ReconnectionStatus;
};

export type SetStore = (setter: (prevState: State) => State) => void;

export type Selector<Result> = (snapshot: State) => Result;
