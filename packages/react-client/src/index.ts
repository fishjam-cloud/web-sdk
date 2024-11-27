export {
  useConnect,
  useDisconnect,
  useReconnection,
  useCamera,
  useMicrophone,
  useInitializeDevices,
  usePeers,
  useScreenShare,
  useStatus,
  useVAD,
} from "./hooks/public";
export type { ConnectConfig, PeerWithTracks } from "./hooks/public";

export { FishjamProvider } from "./fishjamProvider";

export type {
  Track,
  TrackMiddleware,
  TracksMiddleware,
  PeerStatus,
  Device,
  PersistLastDeviceHandlers,
  ScreenshareApi,
  StartStreamingProps,
} from "./types/public";

export type {
  Peer,
  MessageEvents,
  CreateConfig,
  TrackBandwidthLimit,
  SimulcastBandwidthLimit,
  BandwidthLimit,
  TrackContextEvents,
  SimulcastConfig,
  TrackContext,
  VadStatus,
  EncodingReason,
  AuthErrorReason,
  Encoding,
} from "@fishjam-cloud/ts-client";
