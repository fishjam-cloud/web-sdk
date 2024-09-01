import { useFishjamContext } from "./fishjamContext";
import type { Device, AudioDevice } from "../types";
import { useVideoDeviceManager } from "./deviceManagers/videoDeviceManager";
import { useAudioDeviceManager } from "./deviceManagers/audioDeviceManager";
import { useCallback, useEffect, useRef } from "react";

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

type InitializeDevicesProps = { autoInitialize?: boolean };

export const useInitializeDevices = (props?: InitializeDevicesProps) => {
  const areDevicesInitialized = useRef(false);
  const { videoDeviceManagerRef, audioDeviceManagerRef } = useFishjamContext();

  const initializeDevices = useCallback(async () => {
    if (areDevicesInitialized.current) return;
    const videoPromise = videoDeviceManagerRef.current.start();
    const audioPromise = audioDeviceManagerRef.current.start();
    await Promise.all([videoPromise, audioPromise]);
    areDevicesInitialized.current = true;
  }, [videoDeviceManagerRef, audioDeviceManagerRef]);

  const autoInitialize = Boolean(props?.autoInitialize);

  useEffect(() => {
    if (!autoInitialize) return;
    initializeDevices();
  }, [initializeDevices, autoInitialize]);

  return { initializeDevices };
};
