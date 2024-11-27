import { useCallback } from "react";
import { useFishjamContext } from "./useFishjamContext";
import type { ConnectConfig } from "../types/public";
import { useReconnection } from "./useReconnection";

/**
 *
 * @category Connection
 *
 * @typeParam P Type of metadata set by peer while connecting to a room.
 */
export function useConnect(): <P>(config: ConnectConfig<P>) => Promise<void> {
  const client = useFishjamContext().fishjamClientRef.current;

  return useCallback((config) => client.connect({ ...config, peerMetadata: config.peerMetadata ?? {} }), [client]);
}

/**
 *
 * @category Connection
 */
export function useDisconnect() {
  const client = useFishjamContext().fishjamClientRef.current;

  return useCallback(() => {
    client.disconnect();
  }, [client]);
}

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
