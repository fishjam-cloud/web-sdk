import { FishjamClient, TrackContext } from "@fishjam-dev/ts-client";
import { type DeviceManager } from "./UnifiedDeviceManager";
import { MediaService } from "./types";
import { Track } from "./state.types";

export class TrackManager<PeerMetadata, TrackMetadata> implements MediaService<TrackMetadata> {
  private deviceManager: DeviceManager;
  private tsClient: FishjamClient<PeerMetadata, TrackMetadata>;
  private currentTrackId: string | null = null;

  constructor(tsClient: FishjamClient<PeerMetadata, TrackMetadata>, deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
    this.tsClient = tsClient;
  }

  private getPreviousTrack = (): Track<TrackMetadata> => {
    if (!this.currentTrackId) throw Error("There is no current track id");

    const prevTrack = this.getRemoteTrack(this.currentTrackId);

    if (!prevTrack) throw Error("There is no previous track");

    return prevTrack;
  };

  private trackContextToTrack(track: TrackContext<unknown, TrackMetadata>): Track<TrackMetadata> {
    return {
      rawMetadata: track.rawMetadata,
      metadata: track.metadata,
      trackId: track.trackId,
      stream: track.stream,
      simulcastConfig: track.simulcastConfig || null,
      encoding: track.encoding || null,
      vadStatus: track.vadStatus,
      track: track.track,
      metadataParsingError: track.metadataParsingError,
    };
  }

  private getRemoteTrack = (remoteOrLocalTrackId: string | null): Track<TrackMetadata> | null => {
    if (!remoteOrLocalTrackId) return null;

    const tracks = this.tsClient?.getLocalEndpoint()?.tracks;
    if (!tracks) return null;

    const trackByRemoteId = tracks?.get(remoteOrLocalTrackId);
    if (trackByRemoteId) return this.trackContextToTrack(trackByRemoteId);

    const trackByLocalId = [...tracks.values()].find((track) => track.track?.id === remoteOrLocalTrackId);
    return trackByLocalId ? this.trackContextToTrack(trackByLocalId) : null;
  };

  public initialize = async (deviceId?: string) => {
    this?.deviceManager?.start(deviceId);
  };

  public cleanup = async () => {};

  public startStreaming = async (trackMetadata?: TrackMetadata, simulcastConfig?: any, maxBandwidth?: any) => {
    if (this.currentTrackId) throw Error("Track already added");

    const media = this.deviceManager?.deviceState.media;

    if (!media || !media.stream || !media.track) throw Error("Device is unavailable");

    const track = this.getRemoteTrack(media.track.id);

    if (track) return track.trackId;

    // see `getRemoteTrack()` explanation
    this.currentTrackId = media.track.id;

    const remoteTrackId = await this.tsClient.addTrack(media.track, trackMetadata, simulcastConfig, maxBandwidth);

    this.currentTrackId = remoteTrackId;

    return remoteTrackId;
  };

  public stopStreaming = async () => {
    const prevTrack = this.getPreviousTrack();
    this.currentTrackId = null;
    return this.tsClient.removeTrack(prevTrack.trackId);
  };

  public muteTrack = async () => {
    const prevTrack = this.getPreviousTrack();
    await this.tsClient.replaceTrack(prevTrack.trackId, null);
  };

  public unmuteTrack = async () => {
    const prevTrack = this.getPreviousTrack();
    const media = this.deviceManager.deviceState.media;

    if (!media) throw Error("Device is unavailable");

    await this.tsClient.replaceTrack(prevTrack.trackId, media.track);
  };
}
