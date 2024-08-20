import { z } from "zod";
import type { ClientEvents } from "@fishjam-cloud/react-client";
import { create } from "@fishjam-cloud/react-client";
import { useEffect, useState } from "react";

const peerMetadataSchema = z.object({
  name: z.string(),
});

const trackMetadataSchema = z.object({
  type: z.union([
    z.literal("camera"),
    z.literal("microphone"),
    z.literal("screenshare"),
  ]),
  mode: z.union([z.literal("auto"), z.literal("manual")]),
});

export type PeerMetadata = z.infer<typeof peerMetadataSchema>;

export type TrackMetadata = z.infer<typeof trackMetadataSchema>;

export const DEFAULT_VIDEO_TRACK_METADATA: TrackMetadata = {
  type: "camera",
  mode: "auto",
};

export const MANUAL_VIDEO_TRACK_METADATA: TrackMetadata = {
  type: "camera",
  mode: "manual",
};

export const DEFAULT_AUDIO_TRACK_METADATA: TrackMetadata = {
  type: "microphone",
  mode: "auto",
};

export const MANUAL_AUDIO_TRACK_METADATA: TrackMetadata = {
  type: "microphone",
  mode: "manual",
};

export const {
  useStatus,
  useConnect,
  useDisconnect,
  FishjamContextProvider,
  useSetupMedia,
  useCamera,
  useMicrophone,
  useScreenShare,
  useSelector,
  useClient,
} = create();

export const useAuthErrorReason = () => {
  const client = useClient();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const authError: ClientEvents["authError"] = (reason) => {
      setAuthError(reason);
    };

    const authSuccess: ClientEvents["authSuccess"] = () => {
      setAuthError(null);
    };

    client.on("authError", authError);
    client.on("authSuccess", authSuccess);

    return () => {
      client.removeListener("authError", authError);
      client.removeListener("authSuccess", authSuccess);
    };
  }, [setAuthError, client]);

  return authError;
};
