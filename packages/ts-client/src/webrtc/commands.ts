import type { SimulcastConfig, TrackBandwidthLimit } from './types';
import type { Deferred } from './deferred';

export type AddTrackCommand<TrackMetadata> = {
  commandType: 'ADD-TRACK';
  trackId: string;
  track: MediaStreamTrack;
  stream: MediaStream;
  trackMetadata?: TrackMetadata;
  simulcastConfig: SimulcastConfig;
  maxBandwidth: TrackBandwidthLimit;
  resolutionNotifier: Deferred<void>;
};

export type RemoveTrackCommand = {
  commandType: 'REMOVE-TRACK';
  trackId: string;
  resolutionNotifier: Deferred<void>;
};

export type ReplaceTackCommand<TrackMetadata> = {
  commandType: 'REPLACE-TRACK';
  trackId: string;
  newTrack: MediaStreamTrack | null;
  newTrackMetadata?: TrackMetadata;
  resolutionNotifier: Deferred<void>;
};

export type CommandWithHandler = {
  commandType: 'COMMAND-WITH-HANDLER';
  handler: () => void;
  resolutionNotifier: Deferred<void>;
  resolve: "after-renegotiation" | "immediately";
};

export type Command<TrackMetadata> =
  | CommandWithHandler
  | AddTrackCommand<TrackMetadata>
  | RemoveTrackCommand
  | ReplaceTackCommand<TrackMetadata>;
