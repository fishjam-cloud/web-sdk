import { useFishjamContext } from "../fishjamContext";
import { useDeviceManager } from "./deviceManager";

export const useVideoDeviceManager = () => {
  const { videoDeviceManagerRef } = useFishjamContext();
  const videoDeviceState = useDeviceManager(videoDeviceManagerRef.current);

  return videoDeviceState;
};
