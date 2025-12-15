import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);

  const [src, setSrc] = useState("");
  const [mp4, setMP4] = useState("");

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

    socket.on("sync", ({ time, state }) => {
      if (isRemote.current) return;
      const v = videoRef.current;
      if (!v) return;

      if (Math.abs(v.currentTime - time) > 0.5) {
        v.currentTime = time;
      }
      if (state === 1) v.play().catch(() => {});
      if (state === 2) v.pause();
    });

    return () => {
      socket.off("sync-state");
      socket.off("control");
      socket.off("sync");
    };
  }, [socket, roomId]);

  // Local video → socket
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2>🎬 Watch Party</h2>
        <p style={{ color: "#aaa" }}>Room ID: {roomId}</p>

        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Paste public MP4 video URL"
            value={mp4}
            onChange={(e) => setMP4(e.target.value)}
          />
          <button style={styles.button} onClick={loadMP4}>
            Load Video
          </button>
        </div>

        <p style={styles.hint}>
          ℹ️ Only one person needs to load the video. Everyone stays in sync.
        </p>

        <div style={styles.videoBox}>
          <video
            ref={videoRef}
            src={src || undefined}
            controls
            style={styles.video}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f0f",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    background: "#1c1c1c",
    padding: 24,
    borderRadius: 12,
    width: 800,
    boxShadow: "0 0 20px rgba(0,0,0,0.6)",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
  },
  button: {
    padding: "10px 16px",
    borderRadius: 6,
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  hint: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },
  videoBox: {
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    background: "#000",
  },
  video: {
    width: "100%",
    height: "auto",
  },
};
