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

  // Handle OAuth token from URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      localStorage.setItem("token", t);
      window.history.replaceState({}, document.title, window.location.pathname);
      setToken(t);
    } else {
      const stored = localStorage.getItem("token");
      if (stored) setToken(stored);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!socketRef.current && token) {
      const s = io(SERVER, { auth: { token } });
      socketRef.current = s;
      setSocket(s);

      return () => {
        s.disconnect();
        socketRef.current = null;
      };
    }
  }, [token]);

  const startAuth = () => {
    window.location.href = `${SERVER.replace(/\/$/, "")}/auth/google`;
  };

  const join = () => {
    if (!roomId) return alert("Enter room id");
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

  return (
    <div style={{ padding: 20 }}>
      {!token ? (
        <div>
          <h2>Please login to continue</h2>
          <button onClick={startAuth}>Sign in with Google</button>
        </div>
      ) : !joined ? (
        <div>
          <h1>Welcome</h1>
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={join}>Join</button>
          <button onClick={logout} style={{ marginLeft: 10 }}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <button onClick={logout} style={{ marginBottom: 10 }}>
            Logout
          </button>
          <Room socket={socket} roomId={roomId} />
        </div>
      )}
    </div>
  );
}
