import type {
  AudioOrVideoType,
  CurrentDevices,
  DeviceError,
  DevicesStatus,
  DeviceState,
  Errors,
  GetMedia,
  StorageConfig,
} from "../types";
import { NOT_FOUND_ERROR, OVERCONSTRAINED_ERROR, parseError, PERMISSION_DENIED, UNHANDLED_ERROR } from "../types";

import { loadObject, saveObject } from "./localStorage";

const removeExact = (
  trackConstraints: boolean | MediaTrackConstraints | undefined,
): boolean | MediaTrackConstraints | undefined => {
  if (typeof trackConstraints === "object") {
    const copy: MediaTrackConstraints = { ...trackConstraints };
    delete copy["deviceId"];
    return copy;
  }
  return trackConstraints;
};

export const REQUESTING = "Requesting";
export const NOT_REQUESTED = "Not requested";

export const getDeviceInfo = (trackDeviceId: string | null, devices: MediaDeviceInfo[]): MediaDeviceInfo | null =>
  (trackDeviceId && devices.find(({ deviceId }) => trackDeviceId === deviceId)) || null;

export const getCurrentDevicesSettings = (
  requestedDevices: MediaStream,
  mediaDeviceInfos: MediaDeviceInfo[],
): CurrentDevices => {
  const currentDevices: CurrentDevices = { videoinput: null, audioinput: null };

  for (const track of requestedDevices.getTracks()) {
    const settings = track.getSettings();
    if (settings.deviceId) {
      const currentDevice = mediaDeviceInfos.find((device) => device.deviceId == settings.deviceId);
      const kind = currentDevice?.kind ?? null;
      if ((currentDevice && kind === "videoinput") || kind === "audioinput") {
        currentDevices[kind] = currentDevice ?? null;
      }
    }
  }
  return currentDevices;
};

export const isDeviceDifferentFromLastSession = (
  lastDevice: MediaDeviceInfo | null,
  currentDevice: MediaDeviceInfo | null,
) => lastDevice && (currentDevice?.deviceId !== lastDevice.deviceId || currentDevice?.label !== lastDevice?.label);

export const isAnyDeviceDifferentFromLastSession = (
  lastVideoDevice: MediaDeviceInfo | null,
  lastAudioDevice: MediaDeviceInfo | null,
  currentDevices: CurrentDevices | null,
): boolean =>
  !!(
    (currentDevices?.videoinput &&
      isDeviceDifferentFromLastSession(lastVideoDevice, currentDevices?.videoinput || null)) ||
    (currentDevices?.audioinput &&
      isDeviceDifferentFromLastSession(lastAudioDevice, currentDevices?.audioinput || null))
  );

export const stopTracks = (requestedDevices: MediaStream) => {
  for (const track of requestedDevices.getTracks()) {
    track.stop();
  }
};

export const getMedia = async (constraints: MediaStreamConstraints, previousErrors: Errors = {}): Promise<GetMedia> => {
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream: mediaStream, type: "OK", constraints, previousErrors };
  } catch (error: unknown) {
    const parsedError: DeviceError | null = parseError(error);
    return { error: parsedError, type: "Error", constraints };
  }
};

export const handleNotFoundError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
  const withoutVideo = await getMedia(
    { video: false, audio: constraints.audio },
    {
      video: NOT_FOUND_ERROR,
    },
  );

  if (withoutVideo.type === "OK") {
    return withoutVideo;
  }

  const withoutAudio = await getMedia({ video: constraints.video, audio: false }, { audio: NOT_FOUND_ERROR });

  if (withoutAudio.type === "OK") {
    return withoutAudio;
  }

  return await getMedia({ video: false, audio: false }, { audio: NOT_FOUND_ERROR, video: NOT_FOUND_ERROR });
};

export const handleOverconstrainedError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
  const notExactVideo = await getMedia(
    {
      video: removeExact(constraints.video),
      audio: constraints.audio,
    },
    { video: OVERCONSTRAINED_ERROR },
  );
  if (notExactVideo.type === "OK" || notExactVideo.error?.name === "NotAllowedError") {
    return notExactVideo;
  }

  const notExactAudio = await getMedia(
    {
      video: constraints.video,
      audio: removeExact(constraints.audio),
    },
    { audio: OVERCONSTRAINED_ERROR },
  );

  if (notExactAudio.type === "OK" || notExactAudio.error?.name === "NotAllowedError") {
    return notExactAudio;
  }

  return await getMedia(
    { video: removeExact(constraints.video), audio: removeExact(constraints.audio) },
    {
      video: OVERCONSTRAINED_ERROR,
      audio: OVERCONSTRAINED_ERROR,
    },
  );
};

export const handleNotAllowedError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
  const withoutVideo = await getMedia({ video: false, audio: constraints.audio }, { video: PERMISSION_DENIED });
  if (withoutVideo.type === "OK") {
    return withoutVideo;
  }

  const withoutAudio = await getMedia({ video: constraints.video, audio: false }, { audio: PERMISSION_DENIED });
  if (withoutAudio.type === "OK") {
    return withoutAudio;
  }

  return await getMedia({ video: false, audio: false }, { video: PERMISSION_DENIED, audio: PERMISSION_DENIED });
};

export const getError = (result: GetMedia, type: AudioOrVideoType): DeviceError | null => {
  if (result.type === "OK") {
    return result.previousErrors[type] || null;
  }

  console.warn({ name: "Unhandled DeviceManager error", result });
  return UNHANDLED_ERROR;
};

const prepareStatus = (requested: boolean, track: MediaStreamTrack | null): [DevicesStatus, DeviceError | null] => {
  if (!requested) return ["Not requested", null];
  if (track) return ["OK", null];
  return ["Error", null];
};

export const prepareDeviceState = (
  stream: MediaStream | null,
  track: MediaStreamTrack | null,
  devices: MediaDeviceInfo[],
  error: DeviceError | null,
  shouldAsk: boolean,
): DeviceState => {
  const deviceInfo = getDeviceInfo(track?.getSettings()?.deviceId || null, devices);
  const [devicesStatus, newError] = prepareStatus(shouldAsk, track);

  return {
    devices,
    devicesStatus,
    media: {
      stream: track ? stream : null,
      track: track,
      deviceInfo,
      enabled: !!track,
    },
    mediaStatus: devicesStatus,
    error: newError ?? error,
  };
};

export const DISABLE_STORAGE_CONFIG: StorageConfig = {
  getLastDevice: null,
  saveLastDevice: () => {},
};

export const getLocalStorageConfig = (deviceType: "audio" | "video"): StorageConfig => {
  const key = `last-selected-${deviceType}-device`;
  return {
    getLastDevice: () => loadObject<MediaDeviceInfo | null>(key, null),
    saveLastDevice: (info: MediaDeviceInfo) => saveObject<MediaDeviceInfo>(key, info),
  };
};
