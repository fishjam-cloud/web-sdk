import type { PeerState } from "../state.types";
import type { PeerStateWithTracks } from "../types";
import { useFishjamClient_DO_NOT_USE } from "./useFishjamClient";

function getPeerWithDistinguishedTracks(peerState: PeerState): PeerStateWithTracks {
  const peerTracks = Object.values(peerState.tracks ?? {});

  const cameraTrack = peerTracks.find(({ metadata }) => metadata?.type === "camera");
  const microphoneTrack = peerTracks.find(({ metadata }) => metadata?.type === "microphone");
  const screenShareVideoTrack = peerTracks.find(({ metadata }) => metadata?.type === "screenShareVideo");
  const screenShareAudioTrack = peerTracks.find(({ metadata }) => metadata?.type === "screenShareAudio");

  return { ...peerState, cameraTrack, microphoneTrack, screenShareVideoTrack, screenShareAudioTrack };
}

export function useParticipants() {
  const { peers, localPeer } = useFishjamClient_DO_NOT_USE();

  const localParticipant = localPeer ? getPeerWithDistinguishedTracks(localPeer) : null;
  const participants = Object.values(peers).map(getPeerWithDistinguishedTracks);

  return { localParticipant, participants };
}
