import { useRef, useState, type PropsWithChildren } from "react";
import { useTrackManager } from "./hooks/useTrackManager";
import type { DeviceManagerConfig, ScreenshareState } from "./types";
import { type FishjamClient } from ".";
import { FishjamContext } from "./hooks/useFishjamContext";
import { DeviceManager } from "./DeviceManager";
import { usePeerStatus } from "./hooks/usePeerStatus";

interface FishjamProviderProps extends PropsWithChildren {
  client: FishjamClient;
  deviceManagerDefaultConfig?: DeviceManagerConfig;
}

export function FishjamProvider({ children, deviceManagerDefaultConfig, client }: FishjamProviderProps) {
  const hasDevicesBeenInitializedRef = useRef(false);
  const videoDeviceManagerRef = useRef(new DeviceManager("video", deviceManagerDefaultConfig));
  const audioDeviceManagerRef = useRef(new DeviceManager("audio", deviceManagerDefaultConfig));

  const screenshareState = useState<ScreenshareState>(null);
  const peerStatusState = usePeerStatus(client);

  const videoTrackManager = useTrackManager({
    mediaManager: videoDeviceManagerRef.current,
    tsClient: client,
  });

  const audioTrackManager = useTrackManager({
    mediaManager: audioDeviceManagerRef.current,
    tsClient: client,
  });

  const context = {
    client,
    peerStatusState,
    screenshareState,
    videoTrackManager,
    audioTrackManager,
    videoDeviceManagerRef,
    audioDeviceManagerRef,
    hasDevicesBeenInitializedRef,
  };

  return <FishjamContext.Provider value={context}>{children}</FishjamContext.Provider>;
}
