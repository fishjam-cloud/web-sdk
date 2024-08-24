import { FC, useCallback, useRef } from "react";
import AudioVisualizer from "./AudioVisualizer";
import { useCamera, useMicrophone, useScreenShare, useStatus } from "../client";
import VideoPlayer from "./VideoPlayer";
import {
  TrackManager,
  TrackMiddleware,
  UserMediaAPI,
} from "@fishjam-cloud/react-client";
import { Button } from "./Button";
import { BlurProcessor } from "./utils/blur/BlurProcessor";

interface DeviceSelectProps {
  device: UserMediaAPI & TrackManager<unknown>;
}

const DeviceSelect: FC<DeviceSelectProps> = ({ device }) => {
  const hasJoinedRoom = useStatus() === "joined";
  const blurProcessorRef = useRef<BlurProcessor | null>(null);

  const blurMiddleware: TrackMiddleware = useCallback(
    (videoTrack: MediaStreamTrack | null) => {
      if (!videoTrack) return videoTrack;

      const stream = new MediaStream([videoTrack]);
      const blurProcessor = new BlurProcessor(stream);
      blurProcessorRef.current = blurProcessor;

      return blurProcessor.stream.getVideoTracks()[0];
    },
    [],
  );

  const clearBlurMiddleware = async () => {
    await device.setTrackMiddleware(null);
    blurProcessorRef.current?.destroy();
    blurProcessorRef.current = null;
  };

  const isMiddlewareSet = device.currentTrackMiddleware === blurMiddleware;

  const isTrackStreamed = !!device.getCurrentTrack()?.trackId;

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

      {isTrackStreamed ? (
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

      {isMiddlewareSet ? (
        <Button
          disabled={!device.stream}
          onClick={async () => {
            await clearBlurMiddleware();
          }}
        >
          Unblur
        </Button>
      ) : (
        <Button
          disabled={!device.stream}
          onClick={async () => {
            await device.setTrackMiddleware(blurMiddleware);
          }}
        >
          Blur
        </Button>
      )}
    </div>
  );
};

export function DevicePicker() {
  const camera = useCamera();
  const microphone = useMicrophone();

  const screenShare = useScreenShare();
  const hasJoinedRoom = useStatus() === "joined";

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4">
        <DeviceSelect device={camera} />

        <DeviceSelect device={microphone} />

        {screenShare.stream ? (
          <Button
            disabled={!hasJoinedRoom}
            onClick={() => screenShare.stopStreaming()}
          >
            Stop sharing
          </Button>
        ) : (
          <Button
            disabled={!hasJoinedRoom}
            onClick={() => screenShare.startStreaming()}
          >
            Share the screen
          </Button>
        )}
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
