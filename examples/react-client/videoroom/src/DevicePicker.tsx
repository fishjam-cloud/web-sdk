import { useCamera, useMicrophone } from "./client";

export function DevicePicker() {
  const camera = useCamera();
  const microphone = useMicrophone();

  const onCameraSelect = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    if (!event.target.value) {
      return camera.cleanup();
    }
    await camera.initialize(event.target.value);
  };

  const onAudioSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!event.target.value) {
      return microphone.cleanup();
    }
    await microphone.initialize(event.target.value);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4">
        <select onChange={onCameraSelect}>
          <option value={""}>Disable camera</option>

          {camera.devices?.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        <select onChange={onAudioSelect}>
          <option value="">Disable microphone</option>

          {microphone.devices?.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <button
          onClick={async () => {
            await camera.startStreaming();
          }}
        >
          Stream camera
        </button>

        <button
          onClick={async () => {
            await camera.startStreaming();
          }}
        >
          Stop streaming camera
        </button>
      </div>
    </section>
  );
}
