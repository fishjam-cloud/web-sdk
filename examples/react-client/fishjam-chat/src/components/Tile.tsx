import VideoPlayer from "./VideoPlayer";
import { Track } from "@fishjam-cloud/react-client";

type Props = {
  id: string;
  name: string;
  videoTrack: Track | undefined;
};

export function Tile({ videoTrack, name, id }: Props) {
  return (
    <div className="relative grid aspect-video place-content-center overflow-hidden rounded-md bg-zinc-300">
      {videoTrack && (
        <VideoPlayer
          className="z-20 rounded-md"
          peerId={id}
          stream={videoTrack.stream}
        />
      )}

      <div className="absolute bottom-2 left-0 z-30 grid w-full place-content-center text-center text-xs">
        <span
          title={videoTrack?.trackId}
          className="rounded-sm bg-slate-100/60 px-1"
        >
          {name}
        </span>
      </div>
    </div>
  );
}
