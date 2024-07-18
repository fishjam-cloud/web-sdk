function RoomCredentials() {
  return (
    <div className="flex flex-col gap-4">
      <div className="">
        <label htmlFor="roomName">Fishjam url</label>
        <input id="roomName" type="text" />
      </div>

      <div>
        <label htmlFor="roomName">Room name</label>
        <input id="roomName" type="text" />
      </div>

      <div>
        <label htmlFor="username">Username</label>
        <input name="username" type="text" />
      </div>
    </div>
  );
}

function App() {
  return (
    <main className="w-screen h-screen bg-zinc-100 p-4">
      <h1 className="text-xl">Videoroom example</h1>

      <RoomCredentials />
    </main>
  );
}

export default App;
