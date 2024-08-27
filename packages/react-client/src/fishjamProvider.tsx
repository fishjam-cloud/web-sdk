import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { Client } from "./Client";
import { useTrackManager } from "./trackManager";
import type { DeviceManagerConfig, ScreenshareState } from "./types";
import { useClientState } from "./hooks/clientState";
import type { ReconnectConfig } from "@fishjam-cloud/ts-client";
import { FishjamContext } from "./hooks/fishjamContext";

interface FishjamProviderProps extends PropsWithChildren {
  config?: { reconnect?: ReconnectConfig | boolean };
  deviceManagerDefaultConfig?: DeviceManagerConfig;
}

export function FishjamProvider({ children, config, deviceManagerDefaultConfig }: FishjamProviderProps) {
  const client = useMemo(
    () =>
      new Client({
        clientConfig: config,
        deviceManagerDefaultConfig,
      }),
    [config, deviceManagerDefaultConfig],
  );

  const state = useClientState(client);

  const tsClient = client.getTsClient();

  const screenshareState = useState<ScreenshareState>(null);

  const videoTrackManager = useTrackManager({
    mediaManager: client.videoDeviceManager,
    tsClient,
  });

  const audioTrackManager = useTrackManager({
    mediaManager: client.audioDeviceManager,
    tsClient,
  });

  return (
    <FishjamContext.Provider value={{ state, screenshareState, videoTrackManager, audioTrackManager }}>
      {children}
    </FishjamContext.Provider>
  );
}
