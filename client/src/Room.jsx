import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const playerRef = useRef(null);
  const videoRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [src, setSrc] = useState("");

  // Join room + get room info
  useEffect(() => {
    socket.emit("join-room", { roomId });

    socket.emit("who-is-host", roomId);
    socket.on("host-info", (val) => setIsHost(val));

    // Receive control events
    socket.on("control", ({ action, time, src, isYouTube }) => {
      setSrc(src);
      setIsYouTube(isYouTube);

      if (isYouTube) {
        const p = playerRef.current;
        if (!p) return;

        if (action === "load") {
          p.loadVideoById(src);
        } else if (action === "play") {
          p.seekTo(time, true);
          p.playVideo();
        } else if (action === "pause") {
          p.pauseVideo();
        } else if (action === "seek") {
          p.seekTo(time, true);
        }
      } else {
        const v = videoRef.current;
        if (!v) return;

        if (action === "load") {
          v.src = src;
        } else if (action === "play") {
          v.currentTime = time;
          v.play();
        } else if (action === "pause") {
          v.pause();
        } else if (action === "seek") {
          v.currentTime = time;
        }
      }
    });

    // Fallback SYNC event (host → others)
    socket.on("sync", ({ time, state }) => {
      if (isHost) return;

      if (isYouTube) {
        const p = playerRef.current;
        if (!p) return;

        const diff = Math.abs(p.getCurrentTime() - time);
        if (diff > 0.4) p.seekTo(time, true);

        if (state === 1) p.playVideo();
        if (state === 2) p.pauseVideo();
      } else {
        const v = videoRef.current;
        if (!v) return;

        const diff = Math.abs(v.currentTime - time);
        if (diff > 0.4) v.currentTime = time;

        if (state === 1) v.play();
        if (state === 2) v.pause();
      }
    });
  }, []);

  // HOST: fallback sync looper
  useEffect(() => {
    if (!isHost) return;

    const loop = setInterval(() => {
      if (isYouTube) {
        const p = playerRef.current;
        if (!p) return;
        socket.emit("sync", {
          roomId,
          time: p.getCurrentTime(),
          state: p.getPlayerState(),
        });
      } else {
        const v = videoRef.current;
        if (!v) return;
        socket.emit("sync", {
          roomId,
          time: v.currentTime,
          state: v.paused ? 2 : 1,
        });
      }
    }, 500);

    return () => clearInterval(loop);
  }, [isHost, isYouTube]);

  // YouTube API loader
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new YT.Player("player", {
        height: "390",
        width: "640",
        videoId: "",
        events: {},
      });
    };
  }, []);

  // UI actions
  const loadMP4 = () => {
    const url = prompt("Enter MP4 URL:");
    if (!url) return;
    setIsYouTube(false);
    setSrc(url);
    socket.emit("control", {
      roomId,
      action: "load",
      src: url,
      isYouTube: false,
    });
  };

  const loadYT = () => {
    const id = prompt("Enter YouTube Video ID:");
    if (!id) return;
    setIsYouTube(true);
    setSrc(id);
    socket.emit("control", {
      roomId,
      action: "load",
      src: id,
      isYouTube: true,
    });
  };

  const play = () => {
    if (isYouTube) {
      const p = playerRef.current;
      socket.emit("control", {
        roomId,
        action: "play",
        time: p.getCurrentTime(),
        src,
        isYouTube,
      });
    } else {
      const v = videoRef.current;
      socket.emit("control", {
        roomId,
        action: "play",
        time: v.currentTime,
        src,
        isYouTube,
      });
    }
  };

  const pause = () => {
    if (isYouTube) {
      const p = playerRef.current;
      socket.emit("control", {
        roomId,
        action: "pause",
        time: p.getCurrentTime(),
        src,
        isYouTube,
      });
    } else {
      const v = videoRef.current;
      socket.emit("control", {
        roomId,
        action: "pause",
        time: v.currentTime,
        src,
        isYouTube,
      });
    }
  };

  return (
    <div>
      <h1>Room: {roomId}</h1>

      {/* ---- UI BUTTONS RETURNED ---- */}
      <button onClick={loadMP4}>Load MP4</button>
      <button onClick={loadYT} style={{ marginLeft: 10 }}>
        Load YouTube
      </button>

      <div style={{ marginTop: 20 }}>
        <button onClick={play}>Play</button>
        <button onClick={pause} style={{ marginLeft: 10 }}>
          Pause
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {isYouTube ? (
          <div id="player"></div>
        ) : (
          <video
            ref={videoRef}
            width="640"
            height="360"
            controls
            style={{ background: "black" }}
          />
        )}
      </div>
    </div>
  );
}
