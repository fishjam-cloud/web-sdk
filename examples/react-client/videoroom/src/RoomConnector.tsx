import { Button } from "./Button";
import { useConnect, useStatus, useDisconnect } from "./client";

type FormValues = {
  roomName: string;
  userName: string;
  roomManagerUrl: string;
};

export function RoomConnector() {
  const connect = useConnect();
  const status = useStatus();
  const disconnect = useDisconnect();

  const isUserConnected = status === "joined";

  const connectToRoom = async ({ roomManagerUrl, roomName, userName }: FormValues) => {
    localStorage.setItem("roomManagerUrl", roomManagerUrl);
    localStorage.setItem("roomName", roomName);
    localStorage.setItem("userName", userName);

    // in case user copied url from admin panel
    const urlWithoutParams = roomManagerUrl.replace("/*roomName*/users/*username*", "");

    // trim slash from end
    const url = urlWithoutParams.endsWith("/") ? urlWithoutParams : urlWithoutParams + "/";
    const res = await fetch(`${url}${roomName}/users/${userName}`);

    const { token, url: fishjamUrl } = (await res.json()) as { token: string; url: string };

    connect({
      peerMetadata: {},
      token,
      url: fishjamUrl,
    });
  };

  const defaultRoomManagerUrl = localStorage.getItem("roomManagerUrl") ?? "";
  const defaultUserName = localStorage.getItem("userName") ?? "";
  const defaultRoomName = localStorage.getItem("roomName") ?? "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formProps = Object.fromEntries(formData);

    await connectToRoom(formProps as FormValues);
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} autoComplete="on">
      <div className="flex flex-col  justify-between">
        <label htmlFor="roomManagerUrl">Room url</label>
        <input
          id="fishjamUrl"
          name="roomManagerUrl"
          type="text"
          disabled={isUserConnected}
          defaultValue={defaultRoomManagerUrl}
        />
      </div>

      <div className="flex flex-col justify-between">
        <label htmlFor="roomName">Room name</label>
        <input id="roomName" name="roomName" type="text" disabled={isUserConnected} defaultValue={defaultRoomName} />
      </div>

      <div className="flex flex-col  justify-between">
        <label htmlFor="userName">User name</label>
        <input id="userName" name="userName" type="text" disabled={isUserConnected} defaultValue={defaultUserName} />
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={disconnect} disabled={!status || !isUserConnected}>
          Disconnect
        </Button>

        <Button type="submit" disabled={!!status || isUserConnected}>
          Connect
        </Button>
      </div>
    </form>
  );
}
