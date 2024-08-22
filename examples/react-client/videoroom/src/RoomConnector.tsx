import { Button } from "./Button";
import { useConnect, useStatus, useDisconnect } from "./client";

type FormValues = {
  roomName: string;
  username: string;
  roomManagerUrl: string;
};

export function RoomConnector() {
  const connect = useConnect();
  const status = useStatus();
  const disconnect = useDisconnect();

  const isUserConnected = status === "joined";

  const connectToRoom = async ({ roomName, username, roomManagerUrl }: FormValues) => {
    // in case user copied url from admin panel
    const urlWithoutParams = roomManagerUrl.replace("/*roomName*/users/*username*", "");

    // trim slash from end
    const url = urlWithoutParams.endsWith("/") ? urlWithoutParams : urlWithoutParams + "/";

    const res = await fetch(`${url}${roomName}/users/${username}`);

    const { token, url: fishjamUrl } = (await res.json()) as { token: string; url: string };

    connect({
      peerMetadata: {},
      token,
      url: fishjamUrl,
    });
  };

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
        <input id="fishjamUrl" name="roomManagerUrl" type="text" disabled={isUserConnected} />
      </div>

      <div className="flex flex-col justify-between">
        <label htmlFor="roomName">Room name</label>
        <input id="roomName" name="roomName" type="text" disabled={isUserConnected} />
      </div>

      <div className="flex flex-col  justify-between">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" type="text" disabled={isUserConnected} />
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
