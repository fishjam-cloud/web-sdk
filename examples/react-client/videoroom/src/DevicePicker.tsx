import { FC } from "react";
import AudioVisualizer from "./AudioVisualizer";
import { useCamera, useMicrophone, useStatus } from "./client";
import VideoPlayer from "./VideoPlayer";
import { GenericTrackManager, UserMediaAPI } from "@fishjam-dev/react-client";
import { Button } from "./Button";

interface DeviceSelectProps {
  device: UserMediaAPI<unknown> & GenericTrackManager<unknown>;
}

const DeviceSelect: FC<DeviceSelectProps> = ({ device }) => {
  const hasJoinedRoom = useStatus() === "joined";

  return (
    <div className="flex gap-4 justify-between">
      <select
        className="flex-shrink w-full"
        onChange={(e) => device.initialize(e.target.value)}
      >
        {device.devices?.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>

      {device.broadcast?.trackId ? (
        <Button
          disabled={!hasJoinedRoom}
          onClick={async () => {
            await device.stopStreaming();
          }}
        >
          Stop
        </Button>
      ) : (
        <Button
          disabled={!hasJoinedRoom}
          onClick={async () => {
            await device.startStreaming();
          }}
        >
          Stream
        </Button>
      )}
    </div>
  );
};

export function DevicePicker() {
  const camera = useCamera();
  const microphone = useMicrophone();

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4">
        <DeviceSelect device={camera} />

        <DeviceSelect device={microphone} />
      </div>

      <div className="flex flex-col items-center">
        {camera.stream && (
          <VideoPlayer className="w-64" stream={camera.stream} />
        )}
        {microphone.stream && <AudioVisualizer stream={microphone.stream} />}
      </div>
    </section>
  );
}