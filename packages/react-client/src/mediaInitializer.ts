import { prepareConstraints } from "./constraints";
import type { DeviceError} from "./types";
import { NOT_FOUND_ERROR, OVERCONSTRAINED_ERROR, PERMISSION_DENIED, UNHANDLED_ERROR } from "./types";
import { getCurrentDevicesSettings, stopTracks, isAnyDeviceDifferentFromLastSession, removeExact } from "./utils/media";

type AudioVideo<T> = { audio: T; video: T };

type MediaConstraints = AudioVideo<MediaTrackConstraints | undefined>;

type PreviousDevices = AudioVideo<MediaDeviceInfo | null>;

const defaultErrors = { audio: null, video: null };

const tryToGetVideoThenAudio = async (
  constraints: MediaStreamConstraints,
  deviceErrors: AudioVideo<DeviceError | null> = defaultErrors,
  transformConstraint: (value?: boolean | MediaTrackConstraints) => boolean | MediaTrackConstraints | undefined = () =>
    false,
) => {
  try {
    return await getAvailableMedia(
      { ...constraints, video: transformConstraint(constraints.video) },
      { ...deviceErrors, video: null },
    );
  } catch (err: unknown) {
    return await getAvailableMedia(
      { ...constraints, video: transformConstraint(constraints.audio) },
      { ...deviceErrors, audio: null },
    );
  }
};

export const getAvailableMedia = async (
  constraints: MediaStreamConstraints,
  deviceErrors: AudioVideo<DeviceError | null> = defaultErrors,
): Promise<[MediaStream | null, AudioVideo<DeviceError | null>]> => {
  try {
    return [await navigator.mediaDevices.getUserMedia(constraints), deviceErrors];
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) return [null, { audio: UNHANDLED_ERROR, video: UNHANDLED_ERROR }];

    if (err.name === "NotFoundError")
      return tryToGetVideoThenAudio(constraints, { audio: NOT_FOUND_ERROR, video: NOT_FOUND_ERROR });

    if (err.name === "OverconstrainedError")
      return tryToGetVideoThenAudio(
        constraints,
        { audio: OVERCONSTRAINED_ERROR, video: OVERCONSTRAINED_ERROR },
        removeExact,
      );

    if (err.name === "NotAllowedError")
      return tryToGetVideoThenAudio(constraints, { audio: PERMISSION_DENIED, video: PERMISSION_DENIED });

    return [null, { audio: UNHANDLED_ERROR, video: UNHANDLED_ERROR }];
  }
};

// Safari changes deviceId between sessions, therefore we cannot rely on deviceId for identification purposes.
// We can switch a random device that comes from safari to one that has the same label as the one used in the previous session.
export const getCorrectedResult = async (
  stream: MediaStream,
  deviceErrors: AudioVideo<DeviceError | null>,
  devices: MediaDeviceInfo[],
  constraints: MediaConstraints,
  previousDevices: PreviousDevices,
): Promise<[MediaStream | null, AudioVideo<DeviceError | null>]> => {
  const shouldCorrectDevices = isAnyDeviceDifferentFromLastSession(
    previousDevices.video,
    previousDevices.audio,
    getCurrentDevicesSettings(stream, devices),
  );

  if (!shouldCorrectDevices) return [stream, deviceErrors];

  const videoIdToStart = devices.find((info) => info.label === previousDevices.video?.label)?.deviceId;
  const audioIdToStart = devices.find((info) => info.label === previousDevices.audio?.label)?.deviceId;

  if (!videoIdToStart && !audioIdToStart) return [stream, deviceErrors];

  stopTracks(stream);

  const exactConstraints: MediaStreamConstraints = {
    video: !deviceErrors.video && prepareConstraints(videoIdToStart, constraints.video),
    audio: !deviceErrors.audio && prepareConstraints(audioIdToStart, constraints.audio),
  };

  return await getAvailableMedia(exactConstraints, deviceErrors);
};
