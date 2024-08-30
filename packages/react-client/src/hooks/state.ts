import { useFishjamContext } from "./fishjamContext";

export function useStatus() {
  const {
    peerStatusState: [peerStatus],
  } = useFishjamContext();

  return peerStatus;
}
