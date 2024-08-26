import type { FishjamClient, SimulcastConfig, TrackBandwidthLimit } from "@fishjam-cloud/ts-client";
import type { MediaManager, TrackManager, TrackMiddleware, PeerMetadata, TrackMetadata } from "./types";
import type { Track } from "./state.types";
import { getRemoteOrLocalTrack } from "./utils/track";
import { useEffect, useState } from "react";

interface TrackManagerConfig {
  mediaManager: MediaManager;
  type: TrackMetadata["type"];
  displayName?: string;
  tsClient: FishjamClient<PeerMetadata, TrackMetadata>;
}

export const useTrackManager = ({ mediaManager, tsClient, type, displayName }: TrackManagerConfig): TrackManager => {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [currentTrackMiddleware, setCurrentTrackMiddleware] = useState<TrackMiddleware>(null);

  useEffect(() => {
    const disconnectedHandler = () => {
      setCurrentTrackId(null);
    };

    tsClient.on("disconnected", disconnectedHandler);

    return () => {
      tsClient.off("disconnected", disconnectedHandler);
    };
  }, [tsClient]);

  function getPreviousTrack(): Track {
    if (!currentTrackId) throw Error("There is no current track id");

    const prevTrack = getRemoteOrLocalTrack(tsClient, currentTrackId);

    if (!prevTrack) throw Error("There is no previous track");

    return prevTrack;
  }

  async function setTrackMiddleware(middleware: TrackMiddleware): Promise<void> {
    const currentTrack = getCurrentTrack();
    const mediaTrack = mediaManager.getTracks()[0];

    if (!currentTrack || !mediaTrack) return;

    const trackToSet = middleware ? middleware(mediaTrack) : mediaTrack;
    await tsClient.replaceTrack(currentTrack.trackId, trackToSet);

    setCurrentTrackMiddleware(() => middleware);
  }

  function getCurrentTrack(): Track | null {
    return getRemoteOrLocalTrack(tsClient, currentTrackId);
  }

  async function initialize(deviceId?: string) {
    mediaManager?.start(deviceId ?? true);
  }

  async function stop() {
    mediaManager?.stop();
  }

  function getInternalMetadata(paused: boolean): TrackMetadata {
    return {
      type,
      paused,
      displayName,
    };
  }

  async function startStreaming(simulcastConfig?: SimulcastConfig, maxBandwidth?: TrackBandwidthLimit) {
    if (currentTrackId) throw Error("Track already added");

    const media = mediaManager.getMedia();

    if (!media || !media.stream || !media.track) throw Error("Device is unavailable");

    const track = getRemoteOrLocalTrack(tsClient, currentTrackId);

    if (track) return track.trackId;

    // see `getRemoteOrLocalTrackContext()` explanation
    setCurrentTrackId(media.track.id);

    const remoteTrackId = await tsClient.addTrack(
      media.track,
      getInternalMetadata(false),
      simulcastConfig,
      maxBandwidth,
    );

    setCurrentTrackId(remoteTrackId);
    setPaused(false);

    return remoteTrackId;
  }

  async function refreshStreamedTrack() {
    const prevTrack = getPreviousTrack();

    const newTrack = mediaManager.getTracks()[0];
    if (!newTrack) throw Error("New track is empty");

    return tsClient.replaceTrack(prevTrack.trackId, newTrack);
  }

  function stopStreaming() {
    const prevTrack = getPreviousTrack();
    setCurrentTrackId(null);
    setPaused(true);
    return tsClient.removeTrack(prevTrack.trackId);
  }

  function pauseStreaming() {
    const prevTrack = getPreviousTrack();
    return tsClient.replaceTrack(prevTrack.trackId, null);
  }

  function resumeStreaming() {
    const prevTrack = getPreviousTrack();
    const media = mediaManager.getMedia();

    if (!media) throw Error("Device is unavailable");

    setPaused(false);
    return tsClient.replaceTrack(prevTrack.trackId, media.track);
  }

  function disableTrack() {
    return mediaManager.disable();
  }

  function enableTrack() {
    return mediaManager.enable();
  }

  return {
    getCurrentTrack,
    setTrackMiddleware,
    initialize,
    stop,
    startStreaming,
    stopStreaming,
    pauseStreaming,
    resumeStreaming,
    disableTrack,
    enableTrack,
    currentTrackMiddleware,
    refreshStreamedTrack,
    paused,
  };
};
