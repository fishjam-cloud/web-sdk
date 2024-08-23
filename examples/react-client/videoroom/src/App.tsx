import { useEffect } from "react";
import { useClient, useParticipants } from "./client";
import { DevicePicker } from "./DevicePicker";
import { RoomConnector } from "./RoomConnector";
import VideoPlayer from "./VideoPlayer";
import AudioPlayer from "./AudioPlayer";
import { Track } from "@fishjam-cloud/react-client";

function VideoTracks({
  videoTracks,
  name,
  id,
}: {
  videoTracks: Track<unknown>[] | undefined;
  name: string;
  id: string;
}) {
  return videoTracks?.map((videoTrack) => (
    <div
      className="aspect-video overflow-hidden grid place-content-center relative bg-zinc-300 rounded-md"
      key={videoTrack.trackId}
    >
      {videoTrack && (
        <VideoPlayer className="rounded-md z-20" key={videoTrack.trackId} stream={videoTrack.stream} peerId={id} />
      )}

      <div className="absolute bottom-2 left-0 w-full grid place-content-center text-center text-xs z-30">
        <p className="bg-slate-100/60 px-1 rounded-sm">{name}</p>
      </div>
    </div>
  ));
}

function AudioTracks({ audioTracks }: { audioTracks: Track<unknown>[] | undefined }) {
  return audioTracks?.map((audioTrack) => <AudioPlayer stream={audioTrack.stream} key={audioTrack.trackId} />);
}

function App() {
  const client = useClient();
  const { localParticipant, participants } = useParticipants();

  useEffect(() => {
    client.initializeDevices({
      videoTrackConstraints: true,
      audioTrackConstraints: true,
    });
  }, [client]);
  return (
    <main className="w-screen h-screen flex">
      <section className="w-1/3 bg-zinc-200 p-4 h-full space-y-8">
        <h1 className="text-xl">Videoroom example</h1>

        <RoomConnector />

        <DevicePicker />
      </section>

      <div className="w-full h-full p-4">
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {localParticipant && <VideoTracks videoTracks={localParticipant.videoTracks} name="You" id="0" />}

          {participants.map(({ id, videoTracks, metadata }) => (
            <VideoTracks videoTracks={videoTracks} name={(metadata as { name?: string })?.name ?? id} id={id} />
          ))}
          {participants.map(({ id, audioTracks }) => (
            <AudioTracks audioTracks={audioTracks} key={id} />
          ))}
        </section>
      </div>
    </main>
  );
}

export default App;
