import { useCallback } from "react";
import { useFishjamContext } from "./useFishjamContext";
import type { ConnectConfig } from "../types/public";
import { useReconnection } from "./useReconnection";

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
