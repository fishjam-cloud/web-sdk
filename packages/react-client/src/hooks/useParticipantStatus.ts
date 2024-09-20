import { useCallback, useEffect, useRef, useState } from "react";
import type { ParticipantStatus } from "../state.types";
import type { FishjamClient } from "@fishjam-cloud/ts-client";
import type { PeerMetadata, TrackMetadata } from "../types";

export const useParticipantStatus = (client: FishjamClient<PeerMetadata, TrackMetadata>) => {
  const [participantStatus, setParticipantStatusState] = useState<ParticipantStatus>("idle");
  const participantStatusRef = useRef<ParticipantStatus>("idle");

  const setParticipantStatus = useCallback(
    (status: ParticipantStatus) => {
      participantStatusRef.current = status;
      setParticipantStatusState(status);
    },
    [setParticipantStatusState],
  );

  const getCurrentParticipantStatus = useCallback(() => participantStatusRef.current, []);

  useEffect(() => {
    const setConnecting = () => {
      setParticipantStatus("connecting");
    };
    const setError = () => {
      setParticipantStatus("error");
    };
    const setJoined = () => {
      setParticipantStatus("connected");
    };
    const setDisconnected = () => {
      setParticipantStatus("idle");
    };

    client.on("connectionStarted", setConnecting);
    client.on("joined", setJoined);
    client.on("authError", setError);
    client.on("joinError", setError);
    client.on("connectionError", setError);
    client.on("disconnected", setDisconnected);

    return () => {
      client.off("connectionStarted", setConnecting);
      client.off("joined", setJoined);
      client.off("authError", setError);
      client.off("joinError", setError);
      client.off("connectionError", setError);
      client.off("disconnected", setDisconnected);
    };
  }, [client, setParticipantStatus]);

  return { participantStatus, getCurrentParticipantStatus } as const;
};
