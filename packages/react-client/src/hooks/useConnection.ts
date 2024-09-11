import type { UseConnect } from "../types";
import { useCallback, useMemo } from "react";
import { useFishjamClient_DO_NOT_USE } from "./useFishjamClient";

export function useConnect(): UseConnect {
  const client = useFishjamClient_DO_NOT_USE();

  // todo change to use callback or remove useMemo
  return useMemo(() => {
    return (config) => {
      return client.connect(config);
    };
  }, [client]);
}

export function useDisconnect() {
  const client = useFishjamClient_DO_NOT_USE();

  return useCallback(() => {
    client.disconnect();
  }, [client]);
}
