import { useCallback, useRef, useSyncExternalStore } from "react";
import { State } from "../state.types";
import { Client } from "../Client";

const eventNames = [
  "socketOpen",
  "socketError",
  "socketClose",
  "authSuccess",
  "authError",
  "disconnected",
  "joined",
  "joinError",
  "peerJoined",
  "peerUpdated",
  "peerLeft",
  "reconnected",
  "reconnectionRetriesLimitReached",
  "reconnectionStarted",
  "componentAdded",
  "componentUpdated",
  "componentRemoved",
  "trackReady",
  "trackAdded",
  "trackRemoved",
  "trackUpdated",
  "bandwidthEstimationChanged",
  "encodingChanged",
  "voiceActivityChanged",
  "deviceDisabled",
  "deviceEnabled",
  "managerInitialized",
  "managerStarted",
  "deviceStopped",
  "deviceReady",
  "devicesStarted",
  "devicesReady",
  "error",
  "targetTrackEncodingRequested",
  "localTrackAdded",
  "localTrackRemoved",
  "localTrackReplaced",
  "localTrackMuted",
  "localTrackUnmuted",
  "localTrackBandwidthSet",
  "localTrackEncodingBandwidthSet",
  "localTrackEncodingEnabled",
  "localTrackEncodingDisabled",
  "localPeerMetadataChanged",
  "localTrackMetadataChanged",
  "disconnectRequested",
] as const;

export const useClientState = <PeerMetadata>(client: Client<PeerMetadata, unknown>) => {
  const mutationRef = useRef(false);

  const subscribe = useCallback(
    (subscribeCallback: () => void) => {
      const callback = () => {
        mutationRef.current = true;
        subscribeCallback();
      };
      eventNames.forEach((eventName) => client.on(eventName, callback));

      return () => {
        eventNames.forEach((eventName) => client.removeListener(eventName, callback));
      };
    },
    [client],
  );

  const lastSnapshotRef = useRef<State<PeerMetadata, unknown> | null>(null);

  const getSnapshot: () => State<PeerMetadata, unknown> = useCallback(() => {
    if (mutationRef.current || lastSnapshotRef.current === null) {
      const state = {
        remote: client.peers,
        media: client.media,
        bandwidthEstimation: client.bandwidthEstimation,
        tracks: client.peersTracks,
        local: client.local,
        status: client.status,
        devices: client.devices,
        client: client,
        reconnectionStatus: client.reconnectionStatus,
      } satisfies State<PeerMetadata, unknown>;

      lastSnapshotRef.current = state;
      mutationRef.current = false;
    }

    return lastSnapshotRef.current;
  }, [client]);

  return useSyncExternalStore(subscribe, getSnapshot);
};
