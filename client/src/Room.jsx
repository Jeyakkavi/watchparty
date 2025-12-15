import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);

  const [src, setSrc] = useState("");
  const [mp4, setMP4] = useState("");

  // Chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Join room & listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit("join-room", { roomId });

    socket.on("sync-state", (room) => {
      if (!room) return;
      setSrc(room.src || "");
    });

    socket.on("control", ({ action, time, src }) => {
      const v = videoRef.current;
      if (!v) return;

      isRemote.current = true;

      if (action === "load") {
        setSrc(src);
        v.src = src;
        v.load();
      }
      if (action === "play") {
        v.currentTime = time;
        v.play().catch(() => {});
      }
      if (action === "pause") {
        v.currentTime = time;
        v.pause();
      }
      if (action === "seek") {
        v.currentTime = time;
      }

      setTimeout(() => (isRemote.current = false), 300);
    });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("sync-state");
      socket.off("control");
      socket.off("chat-message");
    };
  }, [socket, roomId]);

  // Local video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const emit = (action) => {
      if (isRemote.current) return;
      socket.emit("control", {
        roomId,
        action,
        time: v.currentTime,
        src,
      });
    };

    v.addEventListener("play", () => emit("play"));
    v.addEventListener("pause", () => emit("pause"));
    v.addEventListener("seeked", () => emit("seek"));

    return () => {
      v.removeEventListener("play", () => emit("play"));
      v.removeEventListener("pause", () => emit("pause"));
      v.removeEventListener("seeked", () => emit("seek"));
    };
  }, [src, socket, roomId]);

  const loadMP4 = () => {
    if (!mp4) return alert("Paste a public MP4 URL");

    setSrc(mp4);
    const v = videoRef.current;

    if (v) {
      isRemote.current = true;
      v.src = mp4;
      v.load();
      setTimeout(() => (isRemote.current = false), 300);
    }

    socket.emit("control", {
      roomId,
      action: "load",
      src: mp4,
    });
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    socket.emit("chat-message", {
      roomId,
      message: chatInput,
      user: "User", // later: Google name
    });

    setChatInput("");
  };

  return (
    <div style={styles.page}>
      {/* VIDEO SIDE */}
      <div style={styles.videoSection}>
        <h2>🎬 Watch Party</h2>
        <p style={{ color: "#aaa" }}>Room ID: {roomId}</p>

        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Paste public MP4 URL"
            value={mp4}
            onChange={(e) => setMP4(e.target.value)}
          />
          <button style={styles.button} onClick={loadMP4}>
            Load
          </button>
        </div>

        <video
          ref={videoRef}
          src={src || undefined}
          controls
          style={styles.video}
        />
      </div>

      {/* CHAT PANEL */}
      <div style={styles.chatPanel}>
        <h3>💬 Chat</h3>

        <div style={styles.chatBox}>
          {messages.map((m, i) => (
            <div key={i} style={styles.msg}>
              <b>{m.user}</b>
              <span style={{ color: "#888", fontSize: 11 }}>
                {" "}({m.time})
              </span>
              <div>{m.message}</div>
            </div>
          ))}
        </div>

        <div style={styles.chatInputRow}>
          <input
            style={styles.chatInput}
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button style={styles.sendBtn} onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    height: "100vh",
    background: "#0f0f0f",
    color: "#fff",
  },
  videoSection: {
    flex: 3,
    padding: 20,
  },
  video: {
    width: "100%",
    marginTop: 12,
    borderRadius: 8,
    background: "#000",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    padding: 8,
    background: "#111",
    border: "1px solid #333",
    color: "#fff",
    borderRadius: 6,
  },
  button: {
    background: "#4f46e5",
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  chatPanel: {
    flex: 1,
    borderLeft: "1px solid #222",
    display: "flex",
    flexDirection: "column",
    padding: 12,
    background: "#141414",
  },
  chatBox: {
    flex: 1,
    overflowY: "auto",
    marginBottom: 10,
  },
  msg: {
    marginBottom: 8,
    fontSize: 14,
  },
  chatInputRow: {
    display: "flex",
    gap: 6,
  },
  chatInput: {
    flex: 1,
    padding: 8,
    background: "#111",
    border: "1px solid #333",
    color: "#fff",
    borderRadius: 6,
  },
  sendBtn: {
    background: "#22c55e",
    border: "none",
    color: "#000",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
};
