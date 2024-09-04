import type {
  PeerStatus,
  Device,
  AudioDevice,
} from "@fishjam-cloud/react-client";

type DeviceControlsProps = {
  status: PeerStatus;
} & (
  | {
      device: AudioDevice;
      type: "audio";
    }
  | {
      device: Device;
      type: "video";
    }
);

export const DeviceControls = ({
  device,
  type,
  status,
}: DeviceControlsProps) => {
  const isDeviceStreaming = !!device.currentlyStreamed;
  return (
    <div className="flex flex-col gap-2">
      <button
        className="btn btn-success btn-sm"
        disabled={!!isDeviceStreaming}
        onClick={() => {
          device?.initialize();
        }}
      >
        Start {type} device
      </button>

      <button
        className="btn btn-error btn-sm"
        disabled={!isDeviceStreaming}
        onClick={() => {
          device?.stop();
        }}
      >
        Stop {type} device
      </button>

      <button
        className="btn btn-success btn-sm"
        disabled={!isDeviceStreaming || !device?.paused}
        onClick={() => {
          device.enableTrack();
        }}
      >
        Enable {type} track
      </button>

      <button
        className="btn btn-error btn-sm"
        disabled={!device?.paused}
        onClick={() => {
          device?.disableTrack();
        }}
      >
        Disable {type} track
      </button>

      <button
        className="btn btn-success btn-sm"
        disabled={status !== "joined" || isDeviceStreaming}
        onClick={() => {
          device?.startStreaming();
        }}
      >
        Stream {type} track
      </button>

      <button
        className="btn btn-error btn-sm"
        disabled={status !== "joined" || !isDeviceStreaming}
        onClick={() => {
          device?.stopStreaming();
        }}
      >
        Stop {type} track stream
      </button>
    </div>
  );
};
