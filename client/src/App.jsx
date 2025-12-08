import { useEffect, useState } from "react";
import io from "socket.io-client";
import Room from "./Room";

const SERVER = import.meta.env.VITE_SERVER || "http://localhost:5000";

export default function App(){
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    // If redirected from Google OAuth, url contains ?token=...
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      localStorage.setItem('token', t);
      // remove token from URL for cleanliness
      window.history.replaceState({}, document.title, window.location.pathname);
      setToken(t);
    } else {
      const stored = localStorage.getItem('token');
      if (stored) setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!socket && typeof window !== 'undefined') {
      const auth = localStorage.getItem('token');
      const s = io(SERVER, { auth: { token: auth } });
      setSocket(s);
      return () => s.disconnect();
    }
  }, []);

  const startAuth = () => {
    // visits server route which uses passport -> Google
    window.location.href = `${SERVER.replace(/\/$/, '')}/auth/google`;
  };

  const join = () => {
    if (!roomId) return alert('Enter room id');
    setJoined(true);
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
          <input placeholder="Room ID" value={roomId} onChange={e=>setRoomId(e.target.value)} />
          <button onClick={join}>Join</button>
        </div>
      ) : (
        <Room socket={socket} roomId={roomId} />
      )}
    </div>
  );
}
