import type { UseConnect } from "../types";
import { useCallback, useMemo } from "react";
import { useINTERNAL_FishjamClient } from "./useFishjamClient";

export function useConnect(): UseConnect {
  const client = useINTERNAL_FishjamClient();

  return useMemo(() => {
    return (config) => {
      client.connect(config);
      return () => {
        client.disconnect();
      };
    };
  }, [client]);
}

export function useDisconnect() {
  const client = useINTERNAL_FishjamClient();

  return useCallback(() => {
    client.disconnect();
  }, [client]);
}
