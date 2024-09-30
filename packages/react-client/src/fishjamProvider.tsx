import { useRef, useState, type PropsWithChildren } from "react";
import { useTrackManager } from "./hooks/useTrackManager";
import { Constraints, PeerMetadata, ScreenShareState, PersistLastDevice, TrackMetadata } from "./types";
import { FishjamClient, type ReconnectConfig } from "@fishjam-cloud/ts-client";
import type { FishjamContextType } from "./hooks/useFishjamContext";
import { FishjamContext } from "./hooks/useFishjamContext";
import { DeviceManager } from "./DeviceManager";
import { useParticipantStatus } from "./hooks/useParticipantStatus";
import { useFishjamClientState } from "./hooks/useFishjamClientState";
import { AUDIO_TRACK_CONSTRAINTS, VIDEO_TRACK_CONSTRAINTS } from "./constraints";

interface FishjamProviderProps extends PropsWithChildren {
  config?: { reconnect?: ReconnectConfig | boolean };
  constraints?: Constraints;
  persistLastDevice?: boolean | PersistLastDevice;
}

/**
 * @category Components
 */
export function FishjamProvider({ children, config, constraints, persistLastDevice }: FishjamProviderProps) {
  const fishjamClientRef = useRef(new FishjamClient<PeerMetadata, TrackMetadata>(config));

  const hasDevicesBeenInitializedRef = useRef(false);
  const storage = persistLastDevice;

  const videoDeviceManagerRef = useRef(
    new DeviceManager({
      deviceType: "video",
      defaultConstraints: VIDEO_TRACK_CONSTRAINTS,
      userConstraints: constraints?.videoTrackConstraints,
      storage,
    }),
  );

  const audioDeviceManagerRef = useRef(
    new DeviceManager({
      deviceType: "audio",
      defaultConstraints: AUDIO_TRACK_CONSTRAINTS,
      userConstraints: constraints?.audioTrackConstraints,
      storage,
    }),
  );

  const screenShareState = useState<ScreenShareState>({ stream: null, trackIds: null });
  const { peerStatus, getCurrentParticipantStatus } = useParticipantStatus(fishjamClientRef.current);

  const videoTrackManager = useTrackManager({
    mediaManager: videoDeviceManagerRef.current,
    tsClient: fishjamClientRef.current,
    getCurrentParticipantStatus,
  });

  const audioTrackManager = useTrackManager({
    mediaManager: audioDeviceManagerRef.current,
    tsClient: fishjamClientRef.current,
    getCurrentParticipantStatus,
  });

  const clientState = useFishjamClientState(fishjamClientRef.current);

  const context: FishjamContextType = {
    fishjamClientRef,
    peerStatus,
    screenShareState,
    videoTrackManager,
    audioTrackManager,
    videoDeviceManagerRef,
    audioDeviceManagerRef,
    hasDevicesBeenInitializedRef,
    clientState,
  };

  return <FishjamContext.Provider value={context}>{children}</FishjamContext.Provider>;
}
