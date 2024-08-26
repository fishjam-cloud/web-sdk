import type { PropsWithChildren } from "react";
import { useMemo, useState, createContext, useContext } from "react";
import { Client } from "./Client";
import { useTrackManager } from "./trackManager";
import type { FishjamContextType, ScreenshareState } from "./types";
import { useClientState } from "./hooks/clientState";

interface FishjamProviderProps extends PropsWithChildren {
  config: any;
  deviceManagerDefaultConfig: any;
}

const FishjamContext = createContext<FishjamContextType<unknown, unknown> | null>(null);

export function useFishjamContext<PeerMetadata>() {
  const context = useContext(FishjamContext);
  if (!context) throw new Error("useFishjamContext must be used within a FishjamContextProvider");
  return context as FishjamContextType<PeerMetadata, unknown>;
}

export function FishjamProvider({ children, config, deviceManagerDefaultConfig }: FishjamProviderProps) {
  const client = useMemo(
    () =>
      new Client<unknown, unknown>({
        clientConfig: config,
        deviceManagerDefaultConfig,
      }),
    [],
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
