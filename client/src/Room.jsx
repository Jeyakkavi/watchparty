import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const playerRef = useRef(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Join room
    socket.emit("join", roomId);

    // Ask server: am I the host?
    socket.emit("who-is-host", roomId);
    socket.on("host-info", (val) => setIsHost(val));

    // ---- FALLBACK SYNC RECEIVER ----
    socket.on("sync", ({ time, state }) => {
      const player = playerRef.current;
      if (!player || isHost) return;

      const current = player.getCurrentTime();
      const diff = Math.abs(current - time);

      // Adjust only if drift > 0.4s
      if (diff > 0.4) {
        player.seekTo(time, true);
      }

      if (state === 1) player.playVideo();
      if (state === 2) player.pauseVideo();
    });
  }, []);

  // ---- HOST FALLBACK SYNC LOOPER ----
  useEffect(() => {
    if (!isHost) return;

    const syncInterval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const time = player.getCurrentTime();
      const state = player.getPlayerState(); // 1=play, 2=pause

      socket.emit("sync", {
        roomId,
        time,
        state
      });

    }, 500); // send every 0.5s

    return () => clearInterval(syncInterval);
  }, [isHost]);

  // ---- YOUTUBE PLAYER INIT ----
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new YT.Player("player", {
        height: "390",
        width: "640",
        videoId: "dQw4w9WgXcQ",
      });
    };
  }, []);

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <div id="player"></div>
    </div>
  );
}
