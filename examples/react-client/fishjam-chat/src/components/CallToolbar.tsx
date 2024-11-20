import {
  PhoneOff,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Video,
  VideoOff,
  Settings,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  useScreenShare,
  useCamera,
  useMicrophone,
  useDisconnect,
} from "@fishjam-cloud/react-client";
import { SettingsSheet } from "./SettingsSheet";

export const CallToolbar = () => {
  const disconnect = useDisconnect();

  const {
    startStreaming,
    stream: screenStream,
    stopStreaming,
  } = useScreenShare();
  const camera = useCamera();
  const mic = useMicrophone();

  const onHangUp = async () => {
    camera.stopStreaming();
    mic.stopStreaming();
    disconnect();
  };

  const MicIcon = mic.stream ? Mic : MicOff;
  const CameraIcon = camera.stream ? Video : VideoOff;
  const ScreenshareIcon = screenStream ? MonitorOff : MonitorUp;

  const toggleScreenShare = async () => {
    if (screenStream) return stopStreaming();
    try {
      await startStreaming();
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") return;
      console.error(error);
    }
  };

  return (
    <footer className="h-24 flex justify-center items-center gap-8 border-t border-stone-200">
      <SettingsSheet>
        <Button className="text-xs gap-2 mr-4" variant="default" asChild>
          <div>
            <Settings size={20} strokeWidth={"1.5px"} />
          </div>
        </Button>
      </SettingsSheet>

      <Button
        className="text-xs gap-2"
        variant={mic.stream ? "default" : "outline"}
        onClick={mic.toggleDevice}
      >
        <MicIcon size={20} strokeWidth={"1.5px"} />
      </Button>

      <Button
        className="text-xs gap-2"
        variant={camera.stream ? "default" : "outline"}
        onClick={camera.toggleDevice}
      >
        <CameraIcon size={20} strokeWidth={"1.5px"} />
      </Button>

      <Button className="text-xs gap-2" onClick={toggleScreenShare}>
        <ScreenshareIcon size={20} strokeWidth={"1.5px"} />
      </Button>

      <Button
        className="text-xs gap-2 ml-4"
        variant="destructive"
        onClick={onHangUp}
      >
        <PhoneOff size={20} strokeWidth={"1.5px"} />
        <span>Hang up</span>
      </Button>
    </footer>
  );
};
