import type { JSX } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from "react";
import type { PeerState, Selector, State, UseReconnection } from "./state.types";
import type { ConnectConfig, CreateConfig } from "@fishjam-cloud/ts-client";
import type {
  DeviceManagerConfig,
  UserMediaAPI,
  ScreenShareAPI,
  CreateFishjamClient,
  FishjamContextType,
  FishjamContextProviderProps,
  UseConnect,
  GenericTrackManager,
  PeerStateWithTracks,
} from "./types";
import { Client } from "./Client";
import type { ScreenShareManagerConfig } from "./ScreenShareManager";
import { createUseSetupMediaHook } from "./useSetupMedia";

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

/**
 * Create a client that can be used with a context.
 * Returns context provider, and two hooks to interact with the context.
 *
 * @returns ContextProvider, useSelector, useConnect
 */
export const create = <PeerMetadata, TrackMetadata>(
  config?: CreateConfig<PeerMetadata, TrackMetadata>,
  deviceManagerDefaultConfig?: DeviceManagerConfig,
  screenShareManagerDefaultConfig?: ScreenShareManagerConfig,
): CreateFishjamClient<PeerMetadata, TrackMetadata> => {
  const FishjamContext = createContext<FishjamContextType<PeerMetadata, TrackMetadata> | undefined>(undefined);

  const FishjamContextProvider: ({ children }: FishjamContextProviderProps) => JSX.Element = ({
    children,
  }: FishjamContextProviderProps) => {
    const memoClient = useMemo(() => {
      return new Client<PeerMetadata, TrackMetadata>({
        clientConfig: config,
        deviceManagerDefaultConfig,
        screenShareManagerDefaultConfig,
      });
    }, []);

    const clientRef = useRef(memoClient);
    const mutationRef = useRef(false);

    const subscribe = useCallback((cb: () => void) => {
      const client = clientRef.current;

      const callback = () => {
        mutationRef.current = true;
        cb();
      };
      eventNames.forEach((eventName) => client.on(eventName, callback));

      return () => {
        eventNames.forEach((eventName) => client.removeListener(eventName, callback));
      };
    }, []);

    const lastSnapshotRef = useRef<State<PeerMetadata, TrackMetadata> | null>(null);

    const getSnapshot: () => State<PeerMetadata, TrackMetadata> = useCallback(() => {
      if (mutationRef.current || lastSnapshotRef.current === null) {
        const state = {
          remote: clientRef.current.peers,
          screenShareManager: clientRef.current.screenShareManager,
          media: clientRef.current.media,
          bandwidthEstimation: clientRef.current.bandwidthEstimation,
          tracks: clientRef.current.peersTracks,
          local: clientRef.current.local,
          status: clientRef.current.status,
          devices: clientRef.current.devices,
          videoTrackManager: clientRef.current.videoTrackManager,
          audioTrackManager: clientRef.current.audioTrackManager,
          client: clientRef.current,
          reconnectionStatus: clientRef.current.reconnectionStatus,
        } satisfies State<PeerMetadata, TrackMetadata>;

        lastSnapshotRef.current = state;
        mutationRef.current = false;
      }

      return lastSnapshotRef.current;
    }, []);

    const state = useSyncExternalStore(subscribe, getSnapshot);

    return <FishjamContext.Provider value={{ state }}>{children}</FishjamContext.Provider>;
  };

  const useFishjamContext = (): FishjamContextType<PeerMetadata, TrackMetadata> => {
    const context = useContext(FishjamContext);
    if (!context) throw new Error("useFishjamContext must be used within a FishjamContextProvider");
    return context;
  };

  const useSelector = <Result,>(selector: Selector<PeerMetadata, TrackMetadata, Result>): Result => {
    const { state } = useFishjamContext();

    return useMemo(() => selector(state), [selector, state]);
  };

  const useConnect = (): UseConnect<PeerMetadata> => {
    const { state }: FishjamContextType<PeerMetadata, TrackMetadata> = useFishjamContext();

    return useMemo(() => {
      return (config: ConnectConfig<PeerMetadata>): (() => void) => {
        state.client.connect(config);
        return () => {
          state.client.disconnect();
        };
      };
    }, [state.client]);
  };

  const useDisconnect = () => {
    const { state }: FishjamContextType<PeerMetadata, TrackMetadata> = useFishjamContext();

    return useCallback(() => {
      state.client.disconnect();
    }, [state.client]);
  };

  const useStatus = () => useSelector((s) => s.status);
  const useTracks = () => useSelector((s) => s.tracks);
  const useClient = () => useSelector((s) => s.client);

  const useCamera = (): UserMediaAPI<TrackMetadata> & GenericTrackManager<TrackMetadata> => {
    const { state } = useFishjamContext();

    return { ...state.devices.camera, ...state.videoTrackManager };
  };

  const useMicrophone = (): UserMediaAPI<TrackMetadata> & GenericTrackManager<TrackMetadata> => {
    const { state } = useFishjamContext();

    return { ...state.devices.microphone, ...state.audioTrackManager };
  };

  const useScreenShare = (): ScreenShareAPI<TrackMetadata> => {
    const { state } = useFishjamContext();
    return { ...state.devices.screenShare };
  };

  const useReconnection = (): UseReconnection => {
    const { state } = useFishjamContext();

    return {
      status: state.reconnectionStatus,
      isReconnecting: state.reconnectionStatus === "reconnecting",
      isError: state.reconnectionStatus === "error",
      isIdle: state.reconnectionStatus === "idle",
    };
  };

  const getPeerWithDistinguishedTracks = (
    peerState: PeerState<PeerMetadata, TrackMetadata>,
  ): PeerStateWithTracks<PeerMetadata, TrackMetadata> => {
    const localTracks = Object.values(peerState.tracks ?? {});

    const videoTrack = localTracks.find(({ track }) => track?.kind === "video");
    const audioTrack = localTracks.find(({ track }) => track?.kind === "audio");

    return { ...peerState, videoTrack, audioTrack };
  };

  const useParticipants = () => {
    const { state } = useFishjamContext();

    const localParticipant: PeerStateWithTracks<PeerMetadata, TrackMetadata> | null = state.local
      ? getPeerWithDistinguishedTracks(state.local)
      : null;

    const participants: PeerStateWithTracks<PeerMetadata, TrackMetadata>[] = Object.values(state.remote).map(
      getPeerWithDistinguishedTracks,
    );

    return { localParticipant, participants };
  };

  return {
    FishjamContextProvider,
    useSelector,
    useConnect,
    useDisconnect,
    useStatus,
    useTracks,
    useSetupMedia: createUseSetupMediaHook(useFishjamContext),
    useParticipants,
    useCamera,
    useMicrophone,
    useScreenShare,
    useClient,
    useReconnection,
  };
};
