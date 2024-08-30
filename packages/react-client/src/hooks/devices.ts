import { useFishjamContext } from "./fishjamContext";
import type { Device, AudioDevice } from "../types";
import { useVideoDeviceManager } from "./deviceManagers/videoDeviceManager";
import { useAudioDeviceManager } from "./deviceManagers/audioDeviceManager";

export function useCamera(): Device {
  const {
    videoTrackManager: { currentTrack, ...trackManager },
  } = useFishjamContext();

  const { deviceState } = useVideoDeviceManager();

  const streamedTrackId = currentTrack?.trackId ?? null;
  const streamedTrack = currentTrack?.track ?? null;
  const stream = currentTrack?.stream ?? null;
  const devices = deviceState.devices ?? [];
  const activeDevice = deviceState.media?.deviceInfo ?? null;

  return { ...trackManager, streamedTrack, streamedTrackId, stream, devices, activeDevice };
}

export function useMicrophone(): AudioDevice {
  const {
    audioTrackManager: { currentTrack, ...trackManager },
  } = useFishjamContext();

  const { deviceState } = useAudioDeviceManager();

  const isAudioPlaying = currentTrack?.vadStatus === "speech";
  const streamedTrackId = currentTrack?.trackId ?? null;
  const streamedTrack = currentTrack?.track ?? null;
  const stream = currentTrack?.stream ?? null;
  const devices = deviceState.devices ?? [];
  const activeDevice = deviceState.media?.deviceInfo ?? null;

  return { ...trackManager, streamedTrack, streamedTrackId, isAudioPlaying, stream, devices, activeDevice };
}
