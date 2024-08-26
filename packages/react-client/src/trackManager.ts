import type { FishjamClient, SimulcastConfig, TrackBandwidthLimit } from "@fishjam-cloud/ts-client";
import type { GenericMediaManager, GenericTrackManager, PeerMetadata, TrackMetadata } from "./types";
import type { Track } from "./state.types";
import { getRemoteOrLocalTrack } from "./utils/track";

export class TrackManager implements GenericTrackManager {
  private readonly mediaManager: GenericMediaManager;
  private readonly tsClient: FishjamClient<PeerMetadata, TrackMetadata>;
  private readonly type: TrackMetadata["type"];
  private currentTrackId: string | null = null;
  private paused: boolean = false;
  private displayName?: string;

  constructor(
    tsClient: FishjamClient<PeerMetadata, TrackMetadata>,
    deviceManager: GenericMediaManager,
    type: TrackMetadata["type"],
  ) {
    this.mediaManager = deviceManager;
    this.tsClient = tsClient;
    this.type = type;
  }

  public setDisplayName = (displayName?: string) => {
    this.displayName = displayName;
  };

  private getPreviousTrack = (): Track => {
    if (!this.currentTrackId) throw Error("There is no current track id");

    const prevTrack = getRemoteOrLocalTrack(this.tsClient, this.currentTrackId);

    if (!prevTrack) throw Error("There is no previous track");

    return prevTrack;
  };

  public getCurrentTrack = (): Track | null => {
    return getRemoteOrLocalTrack(this.tsClient, this.currentTrackId);
  };

  public initialize = async (deviceId?: string) => {
    this.mediaManager?.start(deviceId ?? true);
  };

  public stop = async () => {
    this?.mediaManager?.stop();
  };

  public cleanup = () => {
    this.currentTrackId = null;
  };

  public startStreaming = async (simulcastConfig?: SimulcastConfig, maxBandwidth?: TrackBandwidthLimit) => {
    if (this.currentTrackId) throw Error("Track already added");

    const media = this.mediaManager.getMedia();

    if (!media || !media.stream || !media.track) throw Error("Device is unavailable");

    const track = getRemoteOrLocalTrack(this.tsClient, this.currentTrackId);

    if (track) return track.trackId;

    // see `getRemoteOrLocalTrackContext()` explanation
    this.currentTrackId = media.track.id;

    const remoteTrackId = await this.tsClient.addTrack(
      media.track,
      this.getInternalMetadata(false),
      simulcastConfig,
      maxBandwidth,
    );

    this.currentTrackId = remoteTrackId;
    this.paused = false;

    return remoteTrackId;
  };

  private getInternalMetadata = (paused: boolean): TrackMetadata => ({
    type: this.type,
    paused,
    displayName: this.displayName,
  });

  public refreshStreamedTrack = async () => {
    const prevTrack = this.getPreviousTrack();

    const newTrack = this.mediaManager.getTracks()[0];
    if (!newTrack) throw Error("New track is empty");

    return this.tsClient.replaceTrack(prevTrack.trackId, newTrack);
  };

  public stopStreaming = async () => {
    const prevTrack = this.getPreviousTrack();
    this.currentTrackId = null;
    return this.tsClient.removeTrack(prevTrack.trackId);
  };

  public isPaused = () => this.paused;

  public pauseStreaming = async () => {
    const prevTrack = this.getPreviousTrack();

    await this.tsClient.replaceTrack(prevTrack.trackId, null);
    this.paused = true;
    await this.tsClient.updateTrackMetadata(prevTrack.trackId, this.getInternalMetadata(true));
  };

  public isMuted = () => {
    const media = this.mediaManager.getMedia();
    const isTrackDisabled = !media?.track?.enabled;
    const areMediaDisabled = !media?.enabled;

    return isTrackDisabled && areMediaDisabled;
  };

  public resumeStreaming = async () => {
    const prevTrack = this.getPreviousTrack();
    const media = this.mediaManager.getMedia();

    if (!media) throw Error("Device is unavailable");

    await this.tsClient.replaceTrack(prevTrack.trackId, media.track);
    this.paused = false;
    await this.tsClient.updateTrackMetadata(prevTrack.trackId, this.getInternalMetadata(false));
  };

  public disableTrack = async () => {
    this.mediaManager.disable();
  };

  public enableTrack = async () => {
    this.mediaManager.enable();
  };
}
