import { useState } from "react";
import io from "socket.io-client";
import Room from "./Room";

const socket = io("http://localhost:5000");

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div style={{ padding: 30 }}>
      {!joined ? (
        <>
          <h2>Join Room</h2>
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
