import { useEffect } from "react";
import { useConnect, useStatus, useDisconnect, useClient } from "./client";

export function RoomConnector() {
  const connect = useConnect();
  const status = useStatus();
  const disconnect = useDisconnect();

  const client = useClient();

  const isUserConnected = status === "joined";

  const connectToRoom = async ({ roomName, username, fishjamUrl }: any) => {
    const res = await fetch(
      `https://server823sf.membrane.work/api/rooms/${roomName}/users/${username}`
    );

    const data = (await res.json()) as { token: string };

    connect({
      peerMetadata: {},
      token: data.token,
      signaling: {
        protocol: "wss",
        host: "cloud.fishjam.work/api/v1/connect/c72028d5f7b441c297c2f3f00aa17076",
      },
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formProps = Object.fromEntries(formData);

    connectToRoom(formProps);
  };

  return (
    <form className="flex flex-col gap-4 max-w-xs" onSubmit={handleSubmit}>
      <div className="flex flex-col  justify-between">
        <label htmlFor="fishjamUrl">Fishjam url</label>
        <input
          id="fishjamUrl"
          name="fishjamUrl"
          type="text"
          disabled={isUserConnected}
        />
      </div>

      <div className="flex flex-col justify-between">
        <label htmlFor="roomName">Room name</label>
        <input
          id="roomName"
          name="roomName"
          type="text"
          disabled={isUserConnected}
        />
      </div>

      <div className="flex flex-col  justify-between">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          disabled={isUserConnected}
        />
      </div>

      <div className="flex justify-end gap-4">
        <button
          className="px-2 py-1 bg-gray-500 text-white rounded-md disabled:bg-gray-200"
          onClick={disconnect}
          disabled={!status || !isUserConnected}
        >
          Disconnect
        </button>

        <button
          className="px-2 py-1 bg-blue-500 text-white rounded-md disabled:bg-blue-200"
          type="submit"
          disabled={!!status || isUserConnected}
        >
          Connect
        </button>
      </div>
    </form>
  );
}
