import { useMemo } from "react";
import { useFishjamContext } from "../fishjamProvider";
import { Selector } from "../state.types";

export function useSelector<Result, PeerMetadata>(selector: Selector<PeerMetadata, unknown, Result>): Result {
  const { state } = useFishjamContext<PeerMetadata>();

  return useMemo(() => selector(state), [selector, state]);
}

export function useStatus() {
  return useSelector((s) => s.status);
}

export function useTracks() {
  return useSelector((s) => s.tracks);
}

export function useClient() {
  return useSelector((s) => s.client);
}
