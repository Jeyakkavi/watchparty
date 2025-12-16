import { useState } from "react";
import io from "socket.io-client";
import Room from "./Room";
const socket = io(import.meta.env.VITE_SERVER);
const SERVER = import.meta.env.VITE_SERVER;

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div style={{ padding: 40 }}>
      {!joined ? (
        <>
          <h2>Video Chat</h2>
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={() => setJoined(true)}>Join</button>
        </>
      ) : (
        <Room socket={socket} roomId={roomId} />
      )}
    </div>
  );
}
