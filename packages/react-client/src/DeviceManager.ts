import type {
  DeviceError,
  DeviceManagerStatus,
  DevicesStatus,
  DeviceState,
  Media,
  MediaManager,
  MediaStatus,
} from "./types/internal";

import { prepareMediaTrackConstraints } from "./constraints";

import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";
import type { PersistLastDeviceHandlers, TrackMiddleware } from "./types/public";
import { MiddlewareManager } from "./devices/MiddlewareManager";
import { createStorageConfig } from "./utils/localStorage";
import { setupOnEndedCallback } from "./utils/track";
import { parseUserMediaError } from "./utils/errors";

export type DeviceType = "audio" | "video";

export type DeviceManagerEvents = {
  managerStarted: (
    event: DeviceState & {
      constraints: MediaTrackConstraints | undefined;
    },
    state: DeviceState,
  ) => void;
  managerInitialized: (state: DeviceState) => void;
  devicesStarted: (
    event: { restarting: boolean; constraints?: MediaTrackConstraints | boolean },
    state: DeviceState,
  ) => void;
  deviceReady: (event: { stream: MediaStream }, state: DeviceState) => void;
  devicesReady: (event: DeviceState & { restarted: boolean }, state: DeviceState) => void;
  deviceStopped: (state: DeviceState) => void;
  deviceEnabled: (state: DeviceState) => void;
  deviceDisabled: (state: DeviceState) => void;
  middlewareSet: (state: DeviceState) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (event: any, state: DeviceState) => void;
};

export type DeviceManagerConfig = {
  deviceType: DeviceType;
  defaultConstraints: MediaTrackConstraints;
  userConstraints?: boolean | MediaTrackConstraints;
  storage?: boolean | PersistLastDeviceHandlers;
};

const NOOP = () => {};

export class DeviceManager
  extends (EventEmitter as new () => TypedEmitter<DeviceManagerEvents>)
  implements MediaManager
{
  private readonly constraints: boolean | MediaTrackConstraints;

  private status: DeviceManagerStatus = "uninitialized";
  private readonly deviceType: DeviceType;
  private readonly middlewareManager = new MiddlewareManager();

  public readonly getLastDevice: () => MediaDeviceInfo | null = () => null;
  private readonly saveLastDevice: (info: MediaDeviceInfo) => void = NOOP;

  private rawMedia: Media | null = null;
  private mediaStatus: MediaStatus = "Not requested";
  private devices: MediaDeviceInfo[] | null = null;
  private devicesStatus: DevicesStatus = "Not requested";
  private error: DeviceError | null = null;

  public getState(): DeviceState {
    const media = this.middlewareManager.getMedia();
    const deviceInfo = this.rawMedia?.deviceInfo ?? null;

    return {
      mediaStatus: this.mediaStatus,
      devices: this.devices,
      devicesStatus: this.devicesStatus,
      error: this.error,
      media: media ? { ...media, deviceInfo } : null,
    };
  }

  constructor({ deviceType, storage, userConstraints, defaultConstraints }: DeviceManagerConfig) {
    super();
    const storageConfig = createStorageConfig(deviceType, storage);
    if (storageConfig) {
      this.getLastDevice = storageConfig.getLastDevice;
      this.saveLastDevice = storageConfig.saveLastDevice;
    }

    this.deviceType = deviceType;
    this.constraints = userConstraints ?? defaultConstraints;
  }

  public getStatus(): DeviceManagerStatus {
    return this.status;
  }

  public getConstraints(): MediaTrackConstraints | boolean {
    return this.constraints;
  }

  public getDeviceType = () => {
    return this.deviceType;
  };

  public getMedia = () => this.middlewareManager.getMedia();

  public initialize = (
    stream: MediaStream | null,
    track: MediaStreamTrack | null,
    devices: MediaDeviceInfo[],
    requestedMedia: boolean,
    error: DeviceError | null = null,
  ) => {
    const deviceInfo = getDeviceInfo(track?.getSettings()?.deviceId || null, devices);
    const [devicesStatus, newError] = prepareStatus(requestedMedia, track);

    this.devices = devices;
    this.devicesStatus = devicesStatus;
    this.mediaStatus = devicesStatus;
    this.error = newError ?? error;

    this.updateMedia({
      stream: track ? stream : null,
      track,
      deviceInfo,
      enabled: Boolean(track?.enabled),
    });

    if (deviceInfo) this.saveLastDevice?.(deviceInfo);

    this.status = "initialized";
    setupOnEndedCallback(
      track,
      () => this?.rawMedia?.track?.id,
      async () => this.stop(),
    );

    this.emit("managerInitialized", this.getState());
  };

  public async start(deviceId?: string) {
    const newDeviceId: string | undefined = deviceId ?? this.getLastDevice?.()?.deviceId;
    const currentDeviceId = this.rawMedia?.deviceInfo?.deviceId;

    const shouldReplaceDevice = Boolean(currentDeviceId && currentDeviceId !== newDeviceId);
    const isDeviceStopped = currentDeviceId === undefined;
    const shouldProceed = isDeviceStopped || shouldReplaceDevice;

    const exactConstraints = shouldProceed && prepareMediaTrackConstraints(newDeviceId, this.constraints);
    if (!exactConstraints) return;

    this.mediaStatus = "Requesting";

    this.emit("devicesStarted", { restarting: shouldReplaceDevice, constraints: exactConstraints }, this.getState());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ [this.deviceType]: exactConstraints });
      const track = getTrack(stream, this.deviceType);

      const currentDeviceId = track?.getSettings()?.deviceId;
      const deviceInfo = currentDeviceId ? getDeviceInfo(currentDeviceId, this.devices ?? []) : null;

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
      if (shouldReplaceDevice) {
        this?.rawMedia?.track?.stop();
        this.middlewareManager.stop();
      }

      this.updateMedia({
        stream,
        track,
        deviceInfo,
        enabled: Boolean(track?.enabled),
      });

      setupOnEndedCallback(
        track,
        () => this?.rawMedia?.track?.id,
        async () => this.stop(),
      );

      this.mediaStatus = "OK";

      this.emit("devicesReady", { ...this.getState(), restarted: shouldReplaceDevice }, this.getState());
    } catch (err) {
      const parsedError = parseUserMediaError(err);
      const event = {
        parsedError,
        constraints: exactConstraints,
      };

      if (exactConstraints) {
        this.error = parsedError;
      }

      this.emit("error", event, this.getState());
    }
  }

  public async setTrackMiddleware(middleware: TrackMiddleware | null): Promise<void> {
    const track = getTrack(this.rawMedia?.stream, this.deviceType);
    this.middlewareManager.setTrackMiddleware(middleware, track);
    this.emit("middlewareSet", this.getState());
  }

  public getMiddleware(): TrackMiddleware | null {
    return this.middlewareManager.getMiddleware();
  }

  public stop() {
    this.middlewareManager.stop();
    this.rawMedia?.track?.stop();

    this.updateMedia(null);

    this.emit("deviceStopped", this.getState());
  }

  public disable() {
    if (!this.rawMedia || !this.rawMedia?.track) return;

    this.rawMedia!.track!.enabled = false;
    this.rawMedia!.enabled = false;

    this.middlewareManager.disable();

    this.emit("deviceDisabled", this.getState());
  }

  public enable() {
    if (!this.rawMedia || !this.rawMedia?.track) return;

    this.rawMedia!.track!.enabled = true;
    this.rawMedia!.enabled = true;

    this.middlewareManager.enable();

    this.emit("deviceEnabled", this.getState());
  }

  private updateMedia(media: Media | null) {
    this.rawMedia = !media ? null : { ...media };
    this.middlewareManager.updateMedia(media);
  }
}

function getDeviceInfo(trackDeviceId: string | null, devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  return (trackDeviceId && devices.find(({ deviceId }) => trackDeviceId === deviceId)) || null;
}

function getTrack(stream: MediaStream | undefined | null, deviceType: DeviceType): MediaStreamTrack | null {
  return (deviceType === "audio" ? stream?.getAudioTracks()?.[0] : stream?.getVideoTracks()?.[0]) ?? null;
}

function prepareStatus(requested: boolean, track: MediaStreamTrack | null): [DevicesStatus, DeviceError | null] {
  if (!requested) return ["Not requested", null];
  if (track) return ["OK", null];
  return ["Error", null];
}
