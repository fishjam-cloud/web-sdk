import { useFishjamContext } from "../fishjamProvider";
import { PeerState } from "../state.types";
import { PeerStateWithTracks } from "../types";

function getPeerWithDistinguishedTracks<PeerMetadata>(
  peerState: PeerState<PeerMetadata, unknown>,
): PeerStateWithTracks<PeerMetadata, unknown> {
  const localTracks = Object.values(peerState.tracks ?? {});

  const videoTrack = localTracks.find(({ track }) => track?.kind === "video");
  const audioTrack = localTracks.find(({ track }) => track?.kind === "audio");

  return { ...peerState, videoTrack, audioTrack };
}

export function useParticipants<PeerMetadata>() {
  const { state } = useFishjamContext<PeerMetadata>();

  const localParticipant = state.local ? getPeerWithDistinguishedTracks(state.local) : null;

  const participants = Object.values(state.remote).map(getPeerWithDistinguishedTracks);

  return { localParticipant, participants };
}
