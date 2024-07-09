import type {
  AudioOrVideoType,
  CurrentDevices,
  DeviceError,
  DeviceManagerConfig,
  DevicesStatus,
  DeviceState,
  Errors,
  GetMedia,
  Media,
  StorageConfig,
} from "./types";
import { NOT_FOUND_ERROR, OVERCONSTRAINED_ERROR, parseError, PERMISSION_DENIED, UNHANDLED_ERROR } from "./types";

import { loadObject, saveObject } from "./localStorage";
import {
  getExactDeviceConstraint,
  prepareConstraints,
  prepareMediaTrackConstraints,
  toMediaTrackConstraints,
} from "./constraints";

import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";

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

const REQUESTING = "Requesting";
const NOT_REQUESTED = "Not requested";

const getDeviceInfo = (trackDeviceId: string | null, devices: MediaDeviceInfo[]): MediaDeviceInfo | null =>
  (trackDeviceId && devices.find(({ deviceId }) => trackDeviceId === deviceId)) || null;

const getCurrentDevicesSettings = (
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

const isDeviceDifferentFromLastSession = (lastDevice: MediaDeviceInfo | null, currentDevice: MediaDeviceInfo | null) =>
  lastDevice && (currentDevice?.deviceId !== lastDevice.deviceId || currentDevice?.label !== lastDevice?.label);

const stopTracks = (requestedDevices: MediaStream) => {
  for (const track of requestedDevices.getTracks()) {
    track.stop();
  }
};

const getMedia = async (constraints: MediaStreamConstraints, previousErrors: Errors): Promise<GetMedia> => {
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream: mediaStream, type: "OK", constraints, previousErrors };
  } catch (error: unknown) {
    const parsedError: DeviceError | null = parseError(error);
    return { error: parsedError, type: "Error", constraints };
  }
};

const handleNotFoundError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
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

const handleOverconstrainedError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
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

const handleNotAllowedError = async (constraints: MediaStreamConstraints): Promise<GetMedia> => {
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

const getError = (result: GetMedia, type: AudioOrVideoType): DeviceError | null => {
  if (result.type === "OK") {
    return result.previousErrors[type] || null;
  }

  console.warn({ name: "Unhandled DeviceManager error", result });
  return UNHANDLED_ERROR;
};

const prepareStatus = (
  requested: boolean,
  track: MediaStreamTrack | null,
  deviceError: DeviceError | null,
): [DevicesStatus, DeviceError | null] => {
  if (!requested) return ["Not requested", null];
  if (track) return ["OK", null];
  if (deviceError) return ["Error", deviceError];
  return ["Error", null];
};

const prepareDeviceState = (
  stream: MediaStream | null,
  track: MediaStreamTrack | null,
  devices: MediaDeviceInfo[],
  error: DeviceError | null,
  shouldAsk: boolean,
): DeviceState => {
  const deviceInfo = getDeviceInfo(track?.getSettings()?.deviceId || null, devices);
  const [devicesStatus, newError] = prepareStatus(shouldAsk, track, error);

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
    error: error ?? newError,
  };
};

const DISABLE_STORAGE_CONFIG: StorageConfig = {
  getLastDevice: null,
  saveLastDevice: () => {},
};

const getLocalStorageConfig = (deviceType: "audio" | "video"): StorageConfig => {
  const key = `last-selected-${deviceType}-device`;
  return {
    getLastDevice: () => loadObject<MediaDeviceInfo | null>(key, null),
    saveLastDevice: (info: MediaDeviceInfo) => saveObject<MediaDeviceInfo>(key, info),
  };
};

export type DeviceManagerEvents = {
  managerStarted: (
    event: {
      constraints: MediaTrackConstraints | undefined;
    },
    state: DeviceState,
  ) => void;
  managerInitialized: (state: DeviceState) => void;
  devicesStarted: (event: { restarting: boolean; constraints?: string | boolean }, state: DeviceState) => void;
  deviceReady: (event: { stream: MediaStream }, state: DeviceState) => void;
  devicesReady: (event: { restarted: boolean }, state: DeviceState) => void;
  deviceStopped: (state: DeviceState) => void;
  deviceEnabled: (state: DeviceState) => void;
  deviceDisabled: (state: DeviceState) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (event: any, state: DeviceState) => void;
};

export type DeviceManagerStatus = "uninitialized" | "initializing" | "initialized" | "error";

export class DeviceManager extends (EventEmitter as new () => TypedEmitter<DeviceManagerEvents>) {
  private readonly defaultConstraints: MediaTrackConstraints | undefined;
  private readonly defaultStorageConfig: StorageConfig;

  private constraints: MediaTrackConstraints | undefined;
  private storageConfig: StorageConfig | undefined;

  private status: DeviceManagerStatus = "uninitialized";
  private deviceType: "audio" | "video";

  public deviceState: DeviceState = {
    media: null,
    mediaStatus: "Not requested",
    devices: null,
    devicesStatus: "Not requested",
    error: null,
  };

  constructor(deviceType: "audio" | "video", defaultConfig?: DeviceManagerConfig) {
    super();
    this.defaultStorageConfig = this.createStorageConfig(defaultConfig?.storage);

    this.deviceType = deviceType;

    this.defaultConstraints = defaultConfig?.audioTrackConstraints
      ? toMediaTrackConstraints(defaultConfig.audioTrackConstraints)
      : undefined;
  }

  private createStorageConfig(storage: boolean | StorageConfig | undefined): StorageConfig {
    if (storage === false) return DISABLE_STORAGE_CONFIG;
    if (storage === true || storage === undefined) return getLocalStorageConfig(this.deviceType);
    return storage;
  }

  public getStatus(): DeviceManagerStatus {
    return this.status;
  }

  private getConstraints(
    currentConstraints: boolean | MediaTrackConstraints | undefined,
  ): MediaTrackConstraints | undefined {
    if (currentConstraints === false) return undefined;

    const constraints = this.constraints ?? this?.defaultConstraints;

    if (currentConstraints === undefined || currentConstraints === true) return constraints;

    return currentConstraints ?? constraints;
  }

  public async init(initialConstraints?: boolean | MediaTrackConstraints): Promise<"initialized" | "error"> {
    if (this.status !== "uninitialized") {
      return Promise.reject("Device manager already initialized");
    }
    this.status = "initializing";

    if (!navigator?.mediaDevices) {
      console.error("Cannot initialize DeviceManager. Navigator is available only in secure contexts");
      return Promise.resolve("error");
    }

    const previousDevice: MediaDeviceInfo | null = this.getLastDevice() ?? null;

    const trackConstraints = this.getConstraints(initialConstraints);

    const shouldAskForMedia = !!trackConstraints;

    if (shouldAskForMedia && trackConstraints) this.deviceState.devicesStatus = REQUESTING;
    else this.deviceState.devicesStatus ??= NOT_REQUESTED;

    this.deviceState.mediaStatus = this.deviceState.devicesStatus;

    this.emit("managerStarted", { constraints: trackConstraints }, this.deviceState);

    let requestedDevices: MediaStream | null = null;

    const constraints = {
      [this.deviceType]: getExactDeviceConstraint(trackConstraints, previousDevice?.deviceId),
    };

    let result: GetMedia = await getMedia(constraints, {});

    if (result.type === "Error" && result.error?.name === "NotFoundError") {
      result = await handleNotFoundError(constraints);
    }

    if (result.type === "Error" && result.error?.name === "OverconstrainedError") {
      result = await handleOverconstrainedError(result.constraints);
    }

    if (result.type === "Error" && result.error?.name === "NotAllowedError") {
      result = await handleNotAllowedError(result.constraints);
    }

    const mediaDeviceInfos: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();

    if (result.type === "OK") {
      requestedDevices = result.stream;
      // Safari changes deviceId between sessions, therefore we cannot rely on deviceId for identification purposes.
      // We can switch a random device that comes from safari to one that has the same label as the one used in the previous session.
      const currentDevice = getCurrentDevicesSettings(requestedDevices, mediaDeviceInfos)[`${this.deviceType}input`];
      const shouldCorrectDevice = isDeviceDifferentFromLastSession(previousDevice, currentDevice);
      if (shouldCorrectDevice) {
        const deviceIdToStart = mediaDeviceInfos.find((info) => info.label === previousDevice?.label)?.deviceId;

        if (deviceIdToStart) {
          stopTracks(requestedDevices);

          const exactConstraints: MediaStreamConstraints = {
            [this.deviceType]:
              !!result.constraints[this.deviceType] && prepareConstraints(deviceIdToStart, trackConstraints),
          };

          const correctedResult = await getMedia(exactConstraints, result.previousErrors);

          if (correctedResult.type === "OK") {
            requestedDevices = correctedResult.stream;
          } else {
            console.error("Device Manager unexpected error");
          }
        }
      }
    }

    this.deviceState = prepareDeviceState(
      requestedDevices,
      requestedDevices?.getVideoTracks()[0] || null,
      mediaDeviceInfos.filter((device) => device.kind === `${this.deviceType}input`),
      getError(result, "video"),
      shouldAskForMedia,
    );

    const deviceInfo = this.deviceState.media?.deviceInfo;
    if (deviceInfo) this.saveLastDevice(deviceInfo);

    this.setupOnEndedCallback();
    this.emit("managerInitialized", this.deviceState);

    return Promise.resolve("initialized");
  }

  private setupOnEndedCallback() {
    if (this.deviceState?.media?.track) {
      this.deviceState.media.track.addEventListener(
        "ended",
        async (event) => await this.onTrackEnded((event.target as MediaStreamTrack).id),
      );
    }
  }

  private onTrackEnded = async (trackId: string) => {
    if (trackId === this?.deviceState.media?.track?.id) {
      await this.stop();
    }
  };

  private getLastDevice(): MediaDeviceInfo | null {
    return this.storageConfig?.getLastDevice?.() ?? this.defaultStorageConfig?.getLastDevice?.() ?? null;
  }

  private saveLastDevice(info: MediaDeviceInfo) {
    if (this.storageConfig?.saveLastDevice) {
      this.storageConfig.saveLastDevice(info);
    } else {
      this.defaultStorageConfig.saveLastDevice?.(info);
    }
  }

  // todo `audioDeviceId / videoDeviceId === true` means use last device
  public async start(deviceId?: string | boolean) {
    const shouldRestart = !!deviceId && deviceId !== this.deviceState.media?.deviceInfo?.deviceId;

    const newDevice = deviceId === true ? this.getLastDevice?.()?.deviceId || true : deviceId;

    const trackConstraints = this.constraints ?? this.defaultConstraints;

    const exactConstraints = shouldRestart && prepareMediaTrackConstraints(newDevice, trackConstraints);

    if (!exactConstraints) return;

    if (exactConstraints) {
      this.deviceState.mediaStatus = "Requesting";
    }

    this.emit(
      "devicesStarted",
      { ...this.deviceState, restarting: shouldRestart, constraints: newDevice },
      this.deviceState,
    );

    const result = await getMedia({ [this.deviceType]: exactConstraints }, {});

    if (result.type === "OK") {
      const stream = result.stream;

      const getTrack = (): MediaStreamTrack | null => {
        const getTracks = this.deviceType === "audio" ? stream.getAudioTracks : stream.getVideoTracks;

        return getTracks()?.[0] ?? null;
      };

      const currentDeviceId = getTrack()?.getSettings()?.deviceId;
      const deviceInfo = currentDeviceId ? getDeviceInfo(currentDeviceId, this.deviceState.devices ?? []) : null;
      if (deviceInfo) {
        this.saveLastDevice?.(deviceInfo);
      }

      // The device manager assumes that there is only one audio and video track.
      // All previous tracks are deactivated even if the browser is able to handle multiple active sessions. (Chrome, Firefox)
      //
      // Safari always deactivates the track and emits the `ended` event.
      // Its handling is asynchronous and can be executed even before returning a value from the re-execution of `getUserMedia`.
      // In such a case, the tracks are already deactivated at this point (logic in `onTrackEnded` method).
      // The track is null, so the stop method will not execute.
      //
      // However, if Safari has not yet handled this event, the tracks are manually stopped at this point.
      // Manually stopping tracks on its own does not generate the `ended` event.
      // The ended event in Safari has already been emitted and will be handled in the future.
      // Therefore, in the `onTrackEnded` method, events for already stopped tracks are filtered out to prevent the state from being damaged.
      if (shouldRestart) {
        this.deviceState?.media?.track?.stop();
      }

      const media: Media | null = shouldRestart
        ? {
            stream: stream,
            track: getTrack(),
            deviceInfo,
            enabled: true,
          }
        : this.deviceState.media;

      this.deviceState.media = media;

      this.setupOnEndedCallback();

      if (exactConstraints) {
        this.deviceState.mediaStatus = "OK";
      }

      this.emit("devicesReady", { ...this.deviceState, restarted: shouldRestart }, this.deviceState);
    } else {
      const parsedError = result.error;

      const event = {
        parsedError,
        constraints: exactConstraints,
      };

      if (exactConstraints) {
        this.deviceState.error = parsedError;
      }

      this.emit("error", event, this.deviceState);
    }
  }

  public async stop() {
    this.deviceState.media?.track?.stop();
    this.deviceState.media = null;

    this.emit("deviceStopped", this.deviceState);
  }

  public setEnable(value: boolean) {
    if (!this.deviceState.media || !this.deviceState.media?.track) {
      return;
    }

    this.deviceState.media!.track!.enabled = value;
    this.deviceState.media!.enabled = value;

    const eventType = value ? "deviceEnabled" : "deviceDisabled";

    this.emit(eventType, this.deviceState);
  }

  public setConfig(storage?: boolean | StorageConfig, constraints?: boolean | MediaTrackConstraints) {
    this.storageConfig = this.createStorageConfig(storage);
    this.constraints = constraints ? toMediaTrackConstraints(constraints) : undefined;
  }
}
