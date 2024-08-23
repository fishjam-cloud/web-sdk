import AudioPlayer from "./AudioPlayer";
import { Track } from "@fishjam-cloud/react-client";

export function AudioTracks({ audioTracks }: { audioTracks: Track<unknown>[] | undefined }) {
  return audioTracks?.map((audioTrack) => <AudioPlayer stream={audioTrack.stream} key={audioTrack.trackId} />);
}
