import type { PeerState } from "../state.types";
import type { PeerStateWithTracks } from "../types";
import { useFishjamClient } from "./tsClient";

function getPeerWithDistinguishedTracks(peerState: PeerState): PeerStateWithTracks {
  const localTracks = Object.values(peerState.tracks ?? {});

  const videoTracks = localTracks.filter(({ track }) => track?.kind === "video");
  const audioTracks = localTracks.filter(({ track }) => track?.kind === "audio");

  return { ...peerState, videoTracks, audioTracks };
}

export function useParticipants() {
  const { peers, localPeer } = useFishjamClient();

  const localParticipant = localPeer ? getPeerWithDistinguishedTracks(localPeer) : null;
  const participants = Object.values(peers).map(getPeerWithDistinguishedTracks);

  return { localParticipant, participants };
}
