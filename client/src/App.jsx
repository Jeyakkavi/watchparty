import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import Room from "./Room";

const SERVER = import.meta.env.VITE_SERVER || "http://localhost:5000";

export default function App() {
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);

  // load token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");

    if (t) {
      localStorage.setItem("token", t);
      window.history.replaceState({}, "", window.location.pathname);
      setToken(t);
      return;
    }

    const stored = localStorage.getItem("token");
    if (stored) setToken(stored);
  }, []);

  // init socket
  useEffect(() => {
    if (token && !socketRef.current) {
      const s = io(SERVER, {
        auth: { token },
      });
      socketRef.current = s;
      setSocket(s);

      return () => {
        s.disconnect();
        socketRef.current = null;
      };
    }
  }, [token]);

  const login = () => {
    window.location.href = `${SERVER}/auth/google`;
  };

  const join = () => {
    if (!roomId.trim()) return alert("Enter room ID");
    setJoined(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setJoined(false);
    setRoomId("");
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  };

  if (!token)
    return (
      <div style={{ padding: 40 }}>
        <button onClick={login}>Login with Google</button>
      </div>
    );

  if (!joined)
    return (
      <div style={{ padding: 40 }}>
        <h2>Welcome</h2>
        <input
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={join}>Join</button>
        <button onClick={logout}>Logout</button>
      </div>
    );

  return (
    <Room socket={socket} roomId={roomId} />
  );
}
