import { useFishjamContext } from "../fishjamContext";
import { useDeviceManager } from "./deviceManager";

export const useAudioDeviceManager = () => {
  const { audioDeviceManagerRef } = useFishjamContext();
  const audioDeviceState = useDeviceManager(audioDeviceManagerRef.current);

  return { ...audioDeviceState };
};
