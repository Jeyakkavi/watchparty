import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const ytReady = useRef(false);
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const pendingYT = useRef(null);
  const isRemote = useRef(false);

  const [isYouTube, setIsYouTube] = useState(false);
  const [src, setSrc] = useState("");

  // join room + socket listeners
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-room", { roomId });

    socket.on("sync-state", (room) => {
      if (!room) return;
      setIsYouTube(room.isYouTube);
      setSrc(room.src || "");
    });

    socket.on("control", ({ action, time, src, isYouTube }) => {
      isRemote.current = true;
      setIsYouTube(isYouTube);
      setSrc(src);

      // YOUTUBE APPLY
      if (isYouTube) {
        if (playerRef.current) applyYT(action, src, time);
        else pendingYT.current = { action, src, time };
      }
      // MP4 APPLY
      else {
        const v = videoRef.current;
        if (!v) return;

        if (action === "load") {
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
      }

      setTimeout(() => (isRemote.current = false), 300);
    });

    socket.on("sync", ({ time, state, videoType }) => {
      if (isRemote.current) return;

      if (videoType === "youtube") {
        if (!playerRef.current) return;
        const cur = playerRef.current.getCurrentTime();
        if (Math.abs(cur - time) > 0.5) playerRef.current.seekTo(time, true);
        if (state === 1) playerRef.current.playVideo();
        if (state === 2) playerRef.current.pauseVideo();
      } else {
        const v = videoRef.current;
        if (!v) return;
        if (Math.abs(v.currentTime - time) > 0.5) v.currentTime = time;
        if (state === 1) v.play().catch(() => {});
        if (state === 2) v.pause();
      }
    });

    return () => {
      socket.off("sync-state");
      socket.off("control");
      socket.off("sync");
    };
  }, [socket, roomId]);

  // YT API load
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => createPlayer();

    function createPlayer() {
      playerRef.current = new YT.Player("ytplayer", {
        height: "400",
        width: "700",
        videoId: isYouTube ? src : "",
        events: {
          onReady: () => {
            ytReady.current = true;

            if (pendingYT.current) {
              const { action, src, time } = pendingYT.current;
              applyYT(action, src, time);
              pendingYT.current = null;
            }
      },

          onStateChange: (e) => {
            if (isRemote.current) return;
            const time = playerRef.current.getCurrentTime();
            if (e.data === 1)
              socket.emit("control", { roomId, action: "play", time, src, isYouTube: true });
            if (e.data === 2)
              socket.emit("control", { roomId, action: "pause", time, src, isYouTube: true });
            if (e.data === 3)
              socket.emit("control", { roomId, action: "seek", time, src, isYouTube: true });
          },
        },
      });
    }
  }, []);

  // YT apply function
function applyYT(action, src, time = 0) {
  const p = playerRef.current;
  if (!p || typeof p.loadVideoById !== "function") return;

  if (action === "load") p.loadVideoById(src);
  if (action === "play") {
    p.seekTo(time, true);
    p.playVideo();
  }
  if (action === "pause") {
    p.seekTo(time, true);
    p.pauseVideo();
  }

  if (action === "seek") {
    p.seekTo(time, true);
  }
  }

  // MP4 events  
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const play = () =>
      !isRemote.current &&
      socket.emit("control", {
        roomId,
        action: "play",
        time: v.currentTime,
        src,
        isYouTube: false,
      });

    const pause = () =>
      !isRemote.current &&
      socket.emit("control", {
        roomId,
        action: "pause",
        time: v.currentTime,
        src,
        isYouTube: false,
      });

    const seek = () =>
      !isRemote.current &&
      socket.emit("control", {
        roomId,
        action: "seek",
        time: v.currentTime,
        src,
        isYouTube: false,
      });

    v.addEventListener("play", play);
    v.addEventListener("pause", pause);
    v.addEventListener("seeked", seek);

    return () => {
      v.removeEventListener("play", play);
      v.removeEventListener("pause", pause);
      v.removeEventListener("seeked", seek);
    };
  }, [src]);

  // LOAD functions
  const loadMP4 = (url) => {
    if (!url) return;
    setIsYouTube(false);
    setSrc(url);
    if (videoRef.current) {
      isRemote.current = true;
      videoRef.current.src = url;
      videoRef.current.load();
      setTimeout(() => (isRemote.current = false), 300);
    }
    socket.emit("control", { roomId, action: "load", src: url, isYouTube: false });
  };

const loadYT = (input) => {
  if (!input) return;

  let id = input;
  try {
    const u = new URL(input);
    if (u.hostname.includes("youtube")) id = u.searchParams.get("v");
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
  } catch {}

  setIsYouTube(true);
  setSrc(id);

  // ✅ ONLY emit — never touch player directly
  socket.emit("control", {
    roomId,
    action: "load",
    src: id,
    isYouTube: true,
  });
};



  // UI
  const [mp4, setMP4] = useState("");
  const [yt, setYT] = useState("");

  return (
    <div style={{ padding: 20 }}>
      <h2>Room: {roomId}</h2>

      <input value={mp4} onChange={(e) => setMP4(e.target.value)} placeholder="MP4 URL" />
      <button onClick={() => loadMP4(mp4)}>Load MP4</button>

      <br /><br />

      <input value={yt} onChange={(e) => setYT(e.target.value)} placeholder="YT URL or ID" />
      <button onClick={() => loadYT(yt)}>Load YouTube</button>

      <br /><br />

      {isYouTube ? (
        <div id="ytplayer"></div>
      ) : (
        <video ref={videoRef} width="700" controls src={src || undefined} />
      )}
    </div>
  );
}
