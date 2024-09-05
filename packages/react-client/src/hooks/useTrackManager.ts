import type { FishjamClient, SimulcastConfig, TrackBandwidthLimit } from "@fishjam-cloud/ts-client";
import type { MediaManager, PeerMetadata, ToggleMode, TrackManager, TrackMetadata, TrackMiddleware } from "../types";
import type { PeerStatus, Track } from "../state.types";
import { getRemoteOrLocalTrack } from "../utils/track";
import { useEffect, useMemo, useState } from "react";

interface TrackManagerConfig {
  mediaManager: MediaManager;
  tsClient: FishjamClient<PeerMetadata, TrackMetadata>;
  peerStatus: PeerStatus
}

const TRACK_TYPE_TO_DEVICE = {
  video: "camera",
  audio: "microphone",
} as const;

export const useTrackManager = ({ mediaManager, tsClient, peerStatus }: TrackManagerConfig): TrackManager => {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [currentTrackMiddleware, setCurrentTrackMiddleware] = useState<TrackMiddleware>(null);
  const type = TRACK_TYPE_TO_DEVICE[mediaManager.getDeviceType()];

  const metadata: TrackMetadata = { type, paused };

  useEffect(() => {
    const disconnectedHandler = () => {
      setCurrentTrackId(null);
    };

    tsClient.on("disconnected", disconnectedHandler);

    return () => {
      tsClient.off("disconnected", disconnectedHandler);
    };
  }, [tsClient]);

  const currentTrack = useMemo(() => getRemoteOrLocalTrack(tsClient, currentTrackId), [tsClient, currentTrackId]);

  function getPreviousTrack(): Track {
    if (!currentTrackId) throw Error("There is no current track id");

    const prevTrack = getRemoteOrLocalTrack(tsClient, currentTrackId);

    if (!prevTrack) throw Error("There is no previous track");

    return prevTrack;
  }

  async function setTrackMiddleware(middleware: TrackMiddleware): Promise<void> {
    const mediaTrack = mediaManager.getTracks()[0];

    if (!currentTrack || !mediaTrack) return;

    const trackToSet = middleware ? middleware(mediaTrack) : mediaTrack;
    await tsClient.replaceTrack(currentTrack.trackId, trackToSet);

    setCurrentTrackMiddleware(() => middleware);
  }

  function initialize(deviceId?: string) {
    return mediaManager?.start(deviceId);
  }

  function stop() {
    return mediaManager?.stop();
  }

  async function startStreaming(simulcastConfig?: SimulcastConfig, maxBandwidth?: TrackBandwidthLimit) {
    if (currentTrackId) throw Error("Track already added");

    const media = mediaManager.getMedia();

    console.log({ media: media, stream: media?.stream, track: media?.track })

    if (!media || !media.stream || !media.track) throw Error("Device is unavailable");

    const track = getRemoteOrLocalTrack(tsClient, currentTrackId);

    if (track) return track.trackId;

    // see `getRemoteOrLocalTrackContext()` explanation
    setCurrentTrackId(media.track.id);

    const displayName = tsClient.getLocalPeer()?.metadata?.displayName;

    const trackMetadata: TrackMetadata = { ...metadata, displayName, paused: false };

    const remoteTrackId = await tsClient.addTrack(media.track, trackMetadata, simulcastConfig, maxBandwidth);

    setCurrentTrackId(remoteTrackId);
    setPaused(false);

    return remoteTrackId;
  }

  function refreshStreamedTrack() {
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

  async function pauseStreaming() {
    const prevTrack = getPreviousTrack();
    setPaused(true);
    await tsClient.replaceTrack(prevTrack.trackId, null);

    const trackMetadata: TrackMetadata = { ...metadata, paused: true };

    return tsClient.updateTrackMetadata(prevTrack.trackId, trackMetadata);
  }

  async function resumeStreaming() {
    const prevTrack = getPreviousTrack();
    const media = mediaManager.getMedia();

    if (!media) throw Error("Device is unavailable");

    setPaused(false);
    await tsClient.replaceTrack(prevTrack.trackId, media.track);

    const trackMetadata: TrackMetadata = { ...metadata, paused: false };

    return tsClient.updateTrackMetadata(prevTrack.trackId, trackMetadata);
  }

  function disableTrack() {
    mediaManager.disable();
  }

  function enableTrack() {
    mediaManager.enable();
  }

  async function toggle(mode: ToggleMode) {
    if (mode === "suspend") {
      console.log("Suspend")
      if (mediaManager.getMedia()?.stream) {
        console.log("disable")
        mediaManager.disable()
        if (currentTrack?.trackId) {
          console.log("pause")
          await pauseStreaming()
        }
      } else {
        console.log("start")
        await mediaManager.start()
        if (currentTrack?.trackId) {
          console.log("resumeStreaming")
          await resumeStreaming()
        } else {
          console.log("startStreaming")
          await startStreaming()
        }
      }
    } else if (mode === "turnOff") {
      if (mediaManager.getMedia()?.stream) {
        // to immediately disable stream
        console.log("disable")
        mediaManager.disable()
        if (currentTrack) {
          console.log("pause")
          await pauseStreaming()
        }
        console.log("stop")
        await mediaManager.stop()
      } else {
        console.log("start")
        await mediaManager.start()
        // because mediaTrackManger is async I don't have any guarantee that `peerStatus` is up-to-date
        if (peerStatus === "joined")
          if (currentTrack?.trackId) {
            console.log("resumeStreaming")
            await resumeStreaming()
          } else {
            console.log("startStreaming")
            await startStreaming()
          }
      }
    }
  }

  return {
    currentTrack,
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
    toggle,
  };
};
