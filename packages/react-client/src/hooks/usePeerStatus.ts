import { useCallback, useEffect, useRef, useState } from "react";
import type { PeerStatus } from "../state.types";
import type { FishjamClient } from "@fishjam-cloud/ts-client";
import type { PeerMetadata, TrackMetadata } from "../types";

export const usePeerStatus = (client: FishjamClient<PeerMetadata, TrackMetadata>) => {
  const [peerStatus, setPeerStatus] = useState<PeerStatus>(null);
  const peerStatusRef = useRef<PeerStatus>(null);

  const setInnerStatus = useCallback((status: PeerStatus) => {
    peerStatusRef.current = status
    setPeerStatus(status)
  }, [setPeerStatus]);

  const getCurrentPeerState = useCallback(() => peerStatusRef.current, []);

  useEffect(() => {
    const setConnecting = () => {
      setInnerStatus("connecting");
    };
    const setAuthenticated = () => {
      setInnerStatus("authenticated");
    };
    const setError = () => {
      setInnerStatus("error");
    };
    const setJoined = () => {
      setInnerStatus("joined");
    };
    const setDisconnected = () => {
      setInnerStatus(null);
    };
    const setConnected = () => {
      setInnerStatus("connected");
    };

    client.on("connectionStarted", setConnecting);
    client.on("authSuccess", setAuthenticated);
    client.on("joined", setJoined);
    client.on("authError", setError);
    client.on("joinError", setError);
    client.on("connectionError", setError);
    client.on("disconnected", setDisconnected);
    client.on("socketOpen", setConnected);

    return () => {
      client.off("connectionStarted", setConnecting);
      client.off("authSuccess", setAuthenticated);
      client.off("joined", setJoined);
      client.off("authError", setError);
      client.off("joinError", setError);
      client.off("connectionError", setError);
      client.off("disconnected", setDisconnected);
      client.off("socketOpen", setConnected);
    };
  }, [client, setInnerStatus]);

  return { peerStatus, getCurrentPeerState } as const;
};
