import { useCallback } from "react";
import { useFishjamContext } from "./internal/useFishjamContext";
import type { ConnectConfig as TSClientConnectConfig } from "@fishjam-cloud/ts-client";
import { useReconnection } from "./internal/useReconnection";

export type ConnectConfig<P> = Omit<TSClientConnectConfig<P>, "peerMetadata"> & { peerMetadata?: P };

/**
 * @category Connection
 * @returns
 */
export function useConnection() {
  const context = useFishjamContext();
  const client = context.fishjamClientRef.current;

  const reconnectionStatus = useReconnection();

  const joinRoom = useCallback(
    <P>(config: ConnectConfig<P>) => client.connect({ ...config, peerMetadata: config.peerMetadata ?? {} }),
    [client],
  );

  const leaveRoom = useCallback(() => {
    client.disconnect();
  }, [client]);

  return { joinRoom, leaveRoom, peerStatus: context.peerStatus, reconnectionStatus };
}
