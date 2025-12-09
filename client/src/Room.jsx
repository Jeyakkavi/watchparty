import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const ytRef = useRef(null);
  const videoRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [videoType, setVideoType] = useState("youtube"); // youtube | mp4
  const [ytId, setYtId] = useState("");
  const [mp4Url, setMp4Url] = useState("");

  // ---------------------------------------------------
  // JOIN ROOM + CHECK HOST
  // ---------------------------------------------------
  useEffect(() => {
    socket.emit("join", roomId);
    socket.emit("who-is-host", roomId);

    socket.on("host-info", (val) => setIsHost(val));

    return () => {
      socket.off("host-info");
    };
  }, []);

  // ---------------------------------------------------
  // LOAD YOUTUBE PLAYER
  // ---------------------------------------------------
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      ytRef.current = new YT.Player("yt-player", {
        height: "390",
        width: "640",
        videoId: "",
        events: {
          onStateChange: handleYTStateChange
        }
      });
    };
  }, []);

  // ---------------------------------------------------
  // HOST → SEND SYNC LOOP EVERY 500ms
  // ---------------------------------------------------
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      if (videoType === "youtube" && ytRef.current) {
        const time = ytRef.current.getCurrentTime();
        const state = ytRef.current.getPlayerState(); // 1 = play, 2 = pause

        socket.emit("sync", { roomId, time, state, videoType });
      }

      if (videoType === "mp4" && videoRef.current) {
        const time = videoRef.current.currentTime;
        const state = videoRef.current.paused ? 2 : 1;

        socket.emit("sync", { roomId, time, state, videoType });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isHost, videoType]);

  // ---------------------------------------------------
  // CLIENTS RECEIVE SYNC
  // ---------------------------------------------------
  useEffect(() => {
    socket.on("sync", ({ time, state, videoType: vt }) => {
      if (isHost) return; // Host never adjusts on sync

      if (vt === "youtube" && ytRef.current) {
        const diff = Math.abs(ytRef.current.getCurrentTime() - time);
        if (diff > 0.4) ytRef.current.seekTo(time, true);

        if (state === 1) ytRef.current.playVideo();
        if (state === 2) ytRef.current.pauseVideo();
      }

      if (vt === "mp4" && videoRef.current) {
        const diff = Math.abs(videoRef.current.currentTime - time);
        if (diff > 0.4) videoRef.current.currentTime = time;

        if (state === 1) videoRef.current.play();
        if (state === 2) videoRef.current.pause();
      }
    });

    return () => socket.off("sync");
  }, [isHost]);

  // ---------------------------------------------------
  // YT EVENT → HOST BROADCAST (REAL EVENTS)
  // ---------------------------------------------------
  function handleYTStateChange(e) {
    if (!isHost) return;

    const time = ytRef.current.getCurrentTime();
    const state = ytRef.current.getPlayerState();

    socket.emit("sync", { roomId, time, state, videoType: "youtube" });
  }

  // ---------------------------------------------------
  // DIRECT UI CONTROLS (HOST ONLY)
  // ---------------------------------------------------
  const loadYouTube = () => {
    setVideoType("youtube");

    try {
      const id = extractYouTubeId(ytId);
      ytRef.current.loadVideoById(id);
    } catch {
      alert("Invalid YouTube URL");
    }
  };

  const loadMP4 = () => {
    setVideoType("mp4");
  };

  const extractYouTubeId = (url) => {
    const match =
      url.match(/v=([^&]+)/) ||
      url.match(/youtu\.be\/([^?]+)/);

    return match ? match[1] : url;
  };

  const handlePlay = () => {
    if (!isHost) return;
    socket.emit("sync", {
      roomId,
      time:
        videoType === "youtube"
          ? ytRef.current.getCurrentTime()
          : videoRef.current.currentTime,
      state: 1,
      videoType
    });
  };

  const handlePause = () => {
    if (!isHost) return;
    socket.emit("sync", {
      roomId,
      time:
        videoType === "youtube"
          ? ytRef.current.getCurrentTime()
          : videoRef.current.currentTime,
      state: 2,
      videoType
    });
  };

  const handleSeek = () => {
    if (!isHost) return;
    socket.emit("sync", {
      roomId,
      time: videoRef.current.currentTime,
      state: videoRef.current.paused ? 2 : 1,
      videoType: "mp4"
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Room: {roomId}</h2>
      <h3>{isHost ? "You are the HOST" : "You are a viewer"}</h3>

      {/* ---------------------- UI CONTROLS ---------------------- */}
      {isHost && (
        <div style={{ marginBottom: 20 }}>
          <h3>Load Content</h3>

          <input
            placeholder="YouTube URL"
            value={ytId}
            onChange={(e) => setYtId(e.target.value)}
            style={{ width: 300 }}
          />
          <button onClick={loadYouTube}>Load YouTube</button>

          <br /><br />

          <input
            placeholder="MP4 URL"
            value={mp4Url}
            onChange={(e) => setMp4Url(e.target.value)}
            style={{ width: 300 }}
          />
          <button onClick={loadMP4}>Load MP4</button>
        </div>
      )}

      {/* ---------------------- VIDEO PLAYER ---------------------- */}
      {videoType === "youtube" && (
        <div>
          <div id="yt-player"></div>
        </div>
      )}

      {videoType === "mp4" && (
        <video
          ref={videoRef}
          src={mp4Url}
          width="640"
          controls
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeek}
        />
      )}
    </div>
  );
}
