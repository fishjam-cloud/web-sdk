import { useFishjamContext } from "./fishjamContext";
import type { Device, AudioDevice } from "../types";
import { useVideoDeviceManager } from "./deviceManagers/videoDeviceManager";
import { useAudioDeviceManager } from "./deviceManagers/audioDeviceManager";
import { useCallback, useEffect, useRef } from "react";
import { getAvailableMedia, getCorrectedResult } from "../mediaInitializer";

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
    const videoManager = videoDeviceManagerRef.current;
    const audioManager = audioDeviceManagerRef.current;

    const constraints = {
      video: videoManager.getConstraints(true),
      audio: audioManager.getConstraints(true),
    };

    const previousDevices = {
      video: videoManager.getLastDevice(),
      audio: audioManager.getLastDevice(),
    };

    let [stream, deviceErrors] = await getAvailableMedia(constraints);

    const devices = await navigator.mediaDevices.enumerateDevices();

    const videoDevices = devices.filter(({ kind }) => kind === "videoinput");
    const audioDevices = devices.filter(({ kind }) => kind === "audioinput");

    if (stream) {
      [stream, deviceErrors] = await getCorrectedResult(stream, deviceErrors, devices, constraints, previousDevices);
    }

    videoManager.initialize(
      stream,
      stream?.getVideoTracks()?.[0] ?? null,
      videoDevices,
      !!constraints.video,
      deviceErrors.video,
    );
    audioManager.initialize(
      stream,
      stream?.getAudioTracks()?.[0] ?? null,
      audioDevices,
      !!constraints.audio,
      deviceErrors.audio,
    );
    areDevicesInitialized.current = true;
  }, [videoDeviceManagerRef, audioDeviceManagerRef]);

  const autoInitialize = Boolean(props?.autoInitialize);

  useEffect(() => {
    if (!autoInitialize) return;
    initializeDevices();
  }, [initializeDevices, autoInitialize]);

  return { initializeDevices };
};
