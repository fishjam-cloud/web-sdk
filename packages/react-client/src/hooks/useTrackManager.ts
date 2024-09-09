import type { FishjamClient, SimulcastConfig, TrackBandwidthLimit } from "@fishjam-cloud/ts-client";
import type { MediaManager, PeerMetadata, ToggleMode, TrackManager, TrackMetadata, TrackMiddleware } from "../types";
import { getRemoteOrLocalTrack } from "../utils/track";
import { useEffect, useMemo, useRef, useState } from "react";

interface TrackManagerConfig {
  mediaManager: MediaManager;
  tsClient: FishjamClient<PeerMetadata, TrackMetadata>;
}

const TRACK_TYPE_TO_DEVICE = {
  video: "camera",
  audio: "microphone",
} as const;

export const useTrackManager = ({ mediaManager, tsClient }: TrackManagerConfig): TrackManager => {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [currentTrackMiddleware, setCurrentTrackMiddleware] = useState<TrackMiddleware>(null);
  const type = TRACK_TYPE_TO_DEVICE[mediaManager.getDeviceType()];

  // describe why usePeerStatus()
  const joinedRef = useRef<boolean>(false);

  const metadata: TrackMetadata = { type, paused };

  useEffect(() => {
    const onJoined = () => {
      joinedRef.current = true;
    }

    const disconnectedHandler = () => {
      joinedRef.current = false;
      setCurrentTrackId(null);
    };

    tsClient.on("joined", onJoined)
    tsClient.on("disconnected", disconnectedHandler);
    return () => {
      tsClient.on("joined", onJoined)
      tsClient.off("disconnected", disconnectedHandler);
    };
  }, [tsClient]);

  const currentTrack = useMemo(() => getRemoteOrLocalTrack(tsClient, currentTrackId), [tsClient, currentTrackId]);

  async function setTrackMiddleware(middleware: TrackMiddleware): Promise<void> {
    const mediaTrack = mediaManager.getTracks()[0];

    if (!currentTrack || !mediaTrack) return;

    const trackToSet = middleware ? middleware(mediaTrack) : mediaTrack;
    await tsClient.replaceTrack(currentTrack.trackId, trackToSet);

    setCurrentTrackMiddleware(() => middleware);
  }

  async function initialize(deviceId?: string) {
    await mediaManager?.start(deviceId);
    if (!currentTrackId) return;
    const newTrack = mediaManager.getTracks()[0];
    await tsClient.replaceTrack(currentTrackId, newTrack);
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

  async function refreshStreamedTrack() {
    if (!currentTrack) return;

    const newTrack = mediaManager.getTracks()[0];
    if (!newTrack) throw Error("New track is empty");

    return tsClient.replaceTrack(currentTrack.trackId, newTrack);
  }

  async function stopStreaming() {
    if (!currentTrack) return;

    setCurrentTrackId(null);
    setPaused(true);
    return tsClient.removeTrack(currentTrack.trackId);
  }

  async function pauseStreaming() {
    if (!currentTrack) return;

    setPaused(true);
    await tsClient.replaceTrack(currentTrack.trackId, null);

    const trackMetadata: TrackMetadata = { ...metadata, paused: true };

    return tsClient.updateTrackMetadata(currentTrack.trackId, trackMetadata);
  }

  async function resumeStreaming() {
    if (!currentTrack) return;

    const media = mediaManager.getMedia();

    if (!media) throw Error("Device is unavailable");

    setPaused(false);
    await tsClient.replaceTrack(currentTrack.trackId, media.track);

    const trackMetadata: TrackMetadata = { ...metadata, paused: false };

    return tsClient.updateTrackMetadata(currentTrack.trackId, trackMetadata);
  }

  function disableTrack() {
    mediaManager.disable();
  }

  function enableTrack() {
    mediaManager.enable();
  }

  async function toggle(mode: ToggleMode) {
    const suspend = async () => {
      console.log("disable")
      mediaManager.disable()
      if (currentTrack?.trackId) {
        console.log("pause")
        await pauseStreaming()
      }
    }
    const resume = async () => {
      if (currentTrack?.trackId) {
        console.log("resumeStreaming")
        await resumeStreaming()
      } else {
        console.log("startStreaming")
        await startStreaming()
      }
    }


    if (mediaManager.getMedia()?.stream) {
      await suspend()
      console.log("stop")

      if (mode === "turnOff") {
        await mediaManager.stop()
      }
    } else {
      console.log("start")
      await mediaManager.start()

      if (joinedRef.current) {
        await resume()
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
