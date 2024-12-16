export { FishjamProvider } from "./FishjamProvider";
export { useCamera, type UseCameraResult } from "./hooks/devices/useCamera";
export { useInitializeDevices, type UseInitializeDevicesResult } from "./hooks/devices/useInitializeDevices";
export { useMicrophone, type UseMicrophoneResult } from "./hooks/devices/useMicrophone";
export type { JoinRoomConfig } from "./hooks/useConnection";
export { useConnection } from "./hooks/useConnection";
export { type PeerWithTracks, usePeers, type UsePeersResult } from "./hooks/usePeers";
export { useScreenShare } from "./hooks/useScreenShare";
export { useUpdatePeerMetadata } from "./hooks/useUpdatePeerMetadata";
export { useVAD } from "./hooks/useVAD";
export type {
  DeviceItem,
  PeerStatus,
  PersistLastDeviceHandlers,
  ScreenshareApi,
  StreamConfig,
  Track,
  TrackMiddleware,
  TracksMiddleware,
} from "./types/public";
export type {
  AuthErrorReason,
  ReconnectConfig,
  ReconnectionStatus,
  SimulcastBandwidthLimit,
  SimulcastConfig,
  TrackBandwidthLimit,
  VadStatus,
} from "@fishjam-cloud/ts-client";
export { Variant } from "@fishjam-cloud/ts-client";
