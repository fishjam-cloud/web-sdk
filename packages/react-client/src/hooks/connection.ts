import type { ConnectConfig } from "@fishjam-cloud/ts-client";
import { useFishjamContext } from "../fishjamProvider";
import type { FishjamContextType, UseConnect } from "../types";
import { useCallback, useMemo } from "react";
import type { UseReconnection } from "../state.types";

export function useConnect<PeerMetadata>(): UseConnect<PeerMetadata> {
  const { state }: FishjamContextType<PeerMetadata, unknown> = useFishjamContext();

  return useMemo(() => {
    return (config: ConnectConfig<PeerMetadata>): (() => void) => {
      state.client.connect(config);
      return () => {
        state.client.disconnect();
      };
    };
  }, [state.client]);
}

export function useDisconnect() {
  const { state } = useFishjamContext();

  return useCallback(() => {
    state.client.disconnect();
  }, [state.client]);
}

export function useReconnection(): UseReconnection {
  const { state } = useFishjamContext();

  return {
    status: state.reconnectionStatus,
    isReconnecting: state.reconnectionStatus === "reconnecting",
    isError: state.reconnectionStatus === "error",
    isIdle: state.reconnectionStatus === "idle",
  };
}
