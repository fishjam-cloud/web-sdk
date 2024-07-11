import { prepareConstraints } from "./constraints";
import { DeviceError, GetMedia } from "./types";
import {
  getMedia,
  handleNotFoundError,
  handleOverconstrainedError,
  handleNotAllowedError,
  getCurrentDevicesSettings,
  stopTracks,
  isAnyDeviceDifferentFromLastSession,
} from "./utils/media";

interface MediaConstraints {
  audio?: MediaTrackConstraints;
  video?: MediaTrackConstraints;
}

interface PreviousDevices {
  audio: MediaDeviceInfo | null;
  video: MediaDeviceInfo | null;
}

export const getAvailableMedia = async (constraints: MediaConstraints) => {
  let result: GetMedia = await getMedia(constraints);

  if (result.type === "Error" && result.error?.name === "NotFoundError") {
    result = await handleNotFoundError(constraints);
  }

  if (result.type === "Error" && result.error?.name === "OverconstrainedError") {
    result = await handleOverconstrainedError(result.constraints);
  }

  if (result.type === "Error" && result.error?.name === "NotAllowedError") {
    result = await handleNotAllowedError(result.constraints);
  }

  return result;
};

// Safari changes deviceId between sessions, therefore we cannot rely on deviceId for identification purposes.
// We can switch a random device that comes from safari to one that has the same label as the one used in the previous session.
export const getCorrectedResult = async (
  result: GetMedia,
  devices: MediaDeviceInfo[],
  constraints: MediaConstraints,
  previousDevices: PreviousDevices,
) => {
  if (result.type !== "OK") return;

  const shouldCorrectDevices = isAnyDeviceDifferentFromLastSession(
    previousDevices.video,
    previousDevices.audio,
    getCurrentDevicesSettings(result.stream, devices),
  );

  if (!shouldCorrectDevices) return;

  const videoIdToStart = devices.find((info) => info.label === previousDevices.video?.label)?.deviceId;
  const audioIdToStart = devices.find((info) => info.label === previousDevices.audio?.label)?.deviceId;

  if (!videoIdToStart && !audioIdToStart) return;

  stopTracks(result.stream);

  const exactConstraints: MediaStreamConstraints = {
    video: !!result.constraints.video && prepareConstraints(videoIdToStart, constraints.video),
    audio: !!result.constraints.video && prepareConstraints(audioIdToStart, constraints.audio),
  };

  const correctedResult = await getMedia(exactConstraints, result.previousErrors);

  if (correctedResult.type !== "OK") {
    console.error("Device Manager unexpected error");
    return correctedResult;
  }

  return correctedResult;
};
