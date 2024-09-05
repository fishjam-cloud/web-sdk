import type { PeerState } from "../state.types";
import type { PeerStateWithTracks } from "../types";
import { useINTERNAL_FishjamClient } from "./useFishjamClient";

function getPeerWithDistinguishedTracks(peerState: PeerState): PeerStateWithTracks {
  const peerTracks = Object.values(peerState.tracks ?? {});

  const videoTracks = peerTracks.filter(({ track }) => track?.kind === "video");
  const audioTracks = peerTracks.filter(({ track }) => track?.kind === "audio");

  return { ...peerState, videoTracks, audioTracks };
}

export function useParticipants() {
  const { peers, localPeer } = useINTERNAL_FishjamClient();

  const localParticipant = localPeer ? getPeerWithDistinguishedTracks(localPeer) : null;
  const participants = Object.values(peers).map(getPeerWithDistinguishedTracks);

  return { localParticipant, participants };
}
