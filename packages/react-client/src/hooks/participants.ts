import { useFishjamContext } from "../fishjamProvider";
import type { PeerState } from "../state.types";
import type { PeerStateWithTracks } from "../types";

function getPeerWithDistinguishedTracks<PeerMetadata>(
  peerState: PeerState<PeerMetadata, unknown>,
): PeerStateWithTracks<PeerMetadata, unknown> {
  const localTracks = Object.values(peerState.tracks ?? {});

  const videoTracks = localTracks.filter(({ track }) => track?.kind === "video");
  const audioTracks = localTracks.filter(({ track }) => track?.kind === "audio");

  return { ...peerState, videoTracks, audioTracks };
}

export function useParticipants<PeerMetadata>() {
  const { state } = useFishjamContext<PeerMetadata>();

  const localParticipant = state.local ? getPeerWithDistinguishedTracks(state.local) : null;

  const participants = Object.values(state.remote).map(getPeerWithDistinguishedTracks);

  return { localParticipant, participants };
}
