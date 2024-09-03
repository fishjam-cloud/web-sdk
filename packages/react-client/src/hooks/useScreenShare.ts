import { useCallback, useEffect } from "react";
import { getRemoteOrLocalTrack } from "../utils/track";
import type { ScreenshareApi, TracksMiddleware } from "../types";
import { useFishjamContext } from "./useFishjamContext";

const getTracks = (stream: MediaStream): [MediaStreamTrack, MediaStreamTrack | null] => {
  const video = stream.getVideoTracks()[0];
  const audio = stream.getAudioTracks()[0] ?? null;

  return [video, audio];
};

export const useScreenShare = (): ScreenshareApi => {
  const ctx = useFishjamContext();

  const [state, setState] = ctx.screenshareState;
  const { client } = useFishjamContext();

  const startStreaming: ScreenshareApi["startStreaming"] = async (props) => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: props?.videoConstraints ?? true,
      audio: props?.audioConstraints ?? true,
    });
    const [video, audio] = getTracks(stream);

    const addTrackPromises = [client.addTrack(video, { type: "screenShareVideo", paused: false })];

    if (audio) addTrackPromises.push(client.addTrack(audio, { type: "screenShareAudio", paused: false }));

    const [videoId, audioId] = await Promise.all(addTrackPromises);
    setState({ stream, trackIds: { videoId, audioId } });
  };

  const replaceTracks = async (newVideoTrack: MediaStreamTrack, newAudioTrack: MediaStreamTrack | null) => {
    if (!state?.stream) return;

    const addTrackPromises = [client.replaceTrack(state.trackIds.videoId, newVideoTrack)];

    if (newAudioTrack && state.trackIds.audioId) {
      addTrackPromises.push(client.replaceTrack(state.trackIds.audioId, newAudioTrack));
    }

    await Promise.all(addTrackPromises);
  };

  const setTracksMiddleware = async (middleware: TracksMiddleware | null): Promise<void> => {
    if (!state?.stream) return;

    const [videoTrack, audioTrack] = getTracks(state.stream);
    const [newVideoTrack, newAudioTrack] = middleware?.(videoTrack, audioTrack) ?? [videoTrack, audioTrack];

    await replaceTracks(newVideoTrack, newAudioTrack);
  };

  const stopStreaming: ScreenshareApi["stopStreaming"] = useCallback(async () => {
    if (!state) {
      console.warn("No stream to stop");
      return;
    }
    const [video, audio] = getTracks(state.stream);

    video.stop();
    if (audio) audio.stop();

    const removeTrackPromises = [client.removeTrack(state.trackIds.videoId)];
    if (state.trackIds.audioId) removeTrackPromises.push(client.removeTrack(state.trackIds.audioId));

    await Promise.all(removeTrackPromises);

    setState(null);
  }, [state, client, setState]);

  useEffect(() => {
    if (!state) return;
    const [video, audio] = getTracks(state.stream);

    const trackEndedHandler = () => {
      stopStreaming();
    };

    video.addEventListener("ended", trackEndedHandler);
    audio?.addEventListener("ended", trackEndedHandler);

    return () => {
      video.removeEventListener("ended", trackEndedHandler);
      audio?.removeEventListener("ended", trackEndedHandler);
    };
  }, [state, stopStreaming]);

  useEffect(() => {
    const onDisconnected = () => {
      stopStreaming();
    };
    client.on("disconnected", onDisconnected);

    return () => {
      client.removeListener("disconnected", onDisconnected);
    };
  }, [stopStreaming, client]);

  const stream = state?.stream ?? null;
  const [videoTrack, audioTrack] = stream ? getTracks(stream) : [null, null];

  const videoBroadcast = state ? getRemoteOrLocalTrack(client, state.trackIds.videoId) : null;
  const audioBroadcast = state?.trackIds.audioId ? getRemoteOrLocalTrack(client, state.trackIds.audioId) : null;

  return {
    startStreaming,
    stopStreaming,
    stream,
    videoTrack,
    audioTrack,
    videoBroadcast,
    audioBroadcast,
    setTracksMiddleware,
    currentTracksMiddleware: state?.tracksMiddleware ?? null,
  };
};
