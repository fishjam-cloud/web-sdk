import type { DeviceManagerConfig, DeviceState, Media, GenericMediaManager, StorageConfig } from "./types";

import { prepareMediaTrackConstraints, toMediaTrackConstraints } from "./constraints";

import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";
import { DISABLE_STORAGE_CONFIG, getDeviceInfo, getLocalStorageConfig, getMedia } from "./utils/media";

export type DeviceManagerEvents = {
  managerStarted: (
    event: DeviceState & {
      constraints: MediaTrackConstraints | undefined;
    },
    state: DeviceState,
  ) => void;
  managerInitialized: (state: DeviceState) => void;
  devicesStarted: (event: { restarting: boolean; constraints?: string | boolean }, state: DeviceState) => void;
  deviceReady: (event: { stream: MediaStream }, state: DeviceState) => void;
  devicesReady: (event: DeviceState & { restarted: boolean }, state: DeviceState) => void;
  deviceStopped: (state: DeviceState) => void;
  deviceEnabled: (state: DeviceState) => void;
  deviceDisabled: (state: DeviceState) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (event: any, state: DeviceState) => void;
};

export type DeviceManagerStatus = "uninitialized" | "initializing" | "initialized" | "error";

export class DeviceManager
  extends (EventEmitter as new () => TypedEmitter<DeviceManagerEvents>)
  implements GenericMediaManager
{
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

    this.defaultConstraints = defaultConfig?.trackConstraints
      ? toMediaTrackConstraints(defaultConfig.trackConstraints)
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

  public getConstraints(
    currentConstraints: boolean | MediaTrackConstraints | undefined,
  ): MediaTrackConstraints | undefined {
    if (currentConstraints === false) return undefined;

    const constraints = this.constraints ?? this?.defaultConstraints;

    if (currentConstraints === undefined || currentConstraints === true) return constraints;

    return currentConstraints ?? constraints;
  }

  public getMedia = () => this.deviceState.media;

  public initializeWithDeviceState = (state: DeviceState) => {
    this.deviceState = state;

    const deviceInfo = this.deviceState.media?.deviceInfo;
    if (deviceInfo) this.saveLastDevice(deviceInfo);

    this.setupOnEndedCallback();
    this.emit("managerInitialized", this.deviceState);

    return Promise.resolve("initialized");
  };

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

  public getLastDevice(): MediaDeviceInfo | null {
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

    this.deviceState.mediaStatus = "Requesting";

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

      this.deviceState.mediaStatus = "OK";

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
