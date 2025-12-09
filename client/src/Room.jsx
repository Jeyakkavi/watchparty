import { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import Chat from "./Chat";

export default function Room({ socket, roomId }) {
  const videoRef = useRef(null);   // <video> player
  const ytRef = useRef(null);      // YouTube player instance (from react-youtube)
  const isRemoteAction = useRef(false);

  const [isHost, setIsHost] = useState(false);
  const [videoType, setVideoType] = useState("youtube"); // "youtube" or "mp4"
  const [ytId, setYtId] = useState("");
  const [mp4Url, setMp4Url] = useState("");
  const [roomState, setRoomState] = useState({ playing: false, time: 0, src: null, isYouTube: true });

  // ---------------- join + request host info ----------------
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-room", { roomId });

    socket.on("sync-state", (s) => {
      // initial room state from server
      setRoomState(s);
      setVideoType(s.isYouTube ? "youtube" : "mp4");
      if (s.isYouTube) setYtId(s.src || "");
      else setMp4Url(s.src || "");
    });

    // server may send who the host is via custom event (if implemented)
    socket.emit("who-is-host", { roomId });
    socket.on("host-info", (val) => setIsHost(val));

    // immediate control events (load/play/pause/seek)
    socket.on("control", ({ action, time, src, isYouTube }) => {
      // apply remote control without re-emitting
      isRemoteAction.current = true;

      if (action === "load") {
        setVideoType(isYouTube ? "youtube" : "mp4");
        if (isYouTube) {
          setYtId(src);
          if (ytRef.current?.internalPlayer?.loadVideoById) {
            ytRef.current.internalPlayer.loadVideoById(src);
          }
        } else {
          setMp4Url(src);
          if (videoRef.current) {
            videoRef.current.src = src;
          }
        }
        setRoomState({ playing: false, time: 0, src, isYouTube });
      }

      if (action === "play") {
        setRoomState((r) => ({ ...r, playing: true, time }));
        // apply immediately
        if (videoType === "youtube" && ytRef.current) {
          ytRef.current.internalPlayer.seekTo(time, true).then(() => ytRef.current.internalPlayer.playVideo?.());
        } else if (videoRef.current) {
          videoRef.current.currentTime = time;
          videoRef.current.play().catch(()=>{});
        }
      }

      if (action === "pause") {
        setRoomState((r) => ({ ...r, playing: false, time }));
        if (videoType === "youtube" && ytRef.current) {
          ytRef.current.internalPlayer.seekTo(time, true).then(() => ytRef.current.internalPlayer.pauseVideo?.());
        } else if (videoRef.current) {
          videoRef.current.currentTime = time;
          videoRef.current.pause();
        }
      }

      if (action === "seek") {
        setRoomState((r) => ({ ...r, time }));
        if (videoType === "youtube" && ytRef.current) {
          ytRef.current.internalPlayer.seekTo(time, true);
        } else if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      }

      setTimeout(() => (isRemoteAction.current = false), 300);
    });

    // fallback sync messages (host -> attendees)
    socket.on("sync", ({ time, state }) => {
      // viewers adjust to host timing
      if (isHost) return;
      if (videoType === "youtube" && ytRef.current) {
        ytRef.current.internalPlayer.getCurrentTime().then((cur) => {
          const diff = Math.abs(cur - time);
          if (diff > 0.5) ytRef.current.internalPlayer.seekTo(time, true);
          if (state === 1) ytRef.current.internalPlayer.playVideo?.();
          if (state === 2) ytRef.current.internalPlayer.pauseVideo?.();
        }).catch(()=>{});
      } else if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        const diff = Math.abs(cur - time);
        if (diff > 0.5) videoRef.current.currentTime = time;
        if (state === 1) videoRef.current.play().catch(()=>{});
        if (state === 2) videoRef.current.pause();
      }
    });

    return () => {
      socket.off("sync-state");
      socket.off("control");
      socket.off("sync");
      socket.off("host-info");
    };
  }, [socket, roomId, videoType, isHost]);

  // ---------------- host periodic fallback sync (every 500ms) ----------------
  useEffect(() => {
    if (!socket || !isHost) return;
    const t = setInterval(async () => {
      try {
        if (videoType === "youtube" && ytRef.current) {
          const time = await ytRef.current.internalPlayer.getCurrentTime();
          const state = await ytRef.current.internalPlayer.getPlayerState();
          socket.emit("sync", { roomId, time, state });
        } else if (videoRef.current) {
          const time = videoRef.current.currentTime;
          const state = videoRef.current.paused ? 2 : 1;
          socket.emit("sync", { roomId, time, state });
        }
      } catch (err) {
        // ignore errors from blocked API
      }
    }, 500);
    return () => clearInterval(t);
  }, [socket, isHost, videoType]);

  // ---------------- helper: emit control ----------------
  const emitControl = (payload) => {
    if (!socket) return;
    socket.emit("control", payload);
  };

  // ---------------- MP4 event handlers (user actions) ----------------
  const handleMp4Play = () => {
    if (isRemoteAction.current) return;
    const time = videoRef.current.currentTime;
    emitControl({ roomId, action: "play", time, isYouTube: false });
  };
  const handleMp4Pause = () => {
    if (isRemoteAction.current) return;
    const time = videoRef.current.currentTime;
    emitControl({ roomId, action: "pause", time, isYouTube: false });
  };
  const handleMp4Seeked = () => {
    if (isRemoteAction.current) return;
    const time = videoRef.current.currentTime;
    emitControl({ roomId, action: "seek", time, isYouTube: false });
  };

  // ---------------- YouTube event handlers (react-youtube) ----------------
  const onYtReady = (event) => {
    // store internal player reference
    ytRef.current = event.target;
    // if server had a src/time, apply it
    if (roomState.src) {
      try { ytRef.current.loadVideoById(roomState.src); } catch {}
    }
  };

  const onYtStateChange = (event) => {
    const state = event.data; // -1,0,1=playing,2=paused,3=buffering
    if (isRemoteAction.current) return;

    // host emits control events on play/pause/seek
    if (isHost) {
      // play
      if (state === 1) {
        ytRef.current.getCurrentTime().then((time) => {
          emitControl({ roomId, action: "play", time, isYouTube: true, src: ytId || roomState.src });
        }).catch(()=>{});
      }
      // pause
      if (state === 2) {
        ytRef.current.getCurrentTime().then((time) => {
          emitControl({ roomId, action: "pause", time, isYouTube: true, src: ytId || roomState.src });
        }).catch(()=>{});
      }
      // buffering/seek (3) -> also emit seek
      if (state === 3) {
        ytRef.current.getCurrentTime().then((time) => {
          emitControl({ roomId, action: "seek", time, isYouTube: true, src: ytId || roomState.src });
        }).catch(()=>{});
      }
    }
  };

  // ---------------- UI handlers to Load content (host) ----------------
  const loadYouTube = () => {
    if (!socket) return;
    if (!isHost) return alert("Only host can load content");
    if (!ytId) return alert("Enter YouTube URL or ID");

    // extract id if url
    let id = ytId;
    try {
      const u = new URL(ytId);
      if (u.hostname.includes("youtube")) id = u.searchParams.get("v") || id;
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    } catch (e) {}

    emitControl({ roomId, action: "load", src: id, isYouTube: true });
    setVideoType("youtube");
    setRoomState((r)=>({ ...r, src: id, isYouTube: true, time: 0 }));
    // load locally
    if (ytRef.current?.loadVideoById) {
      isRemoteAction.current = true;
      ytRef.current.loadVideoById(id);
      setTimeout(()=> isRemoteAction.current = false, 400);
    }
  };

  const loadMp4 = () => {
    if (!socket) return;
    if (!isHost) return alert("Only host can load content");
    if (!mp4Url) return alert("Enter MP4 URL");

    emitControl({ roomId, action: "load", src: mp4Url, isYouTube: false });
    setVideoType("mp4");
    setRoomState((r)=>({ ...r, src: mp4Url, isYouTube: false, time: 0 }));
    if (videoRef.current) {
      isRemoteAction.current = true;
      videoRef.current.src = mp4Url;
      videoRef.current.load();
      setTimeout(()=> isRemoteAction.current = false, 400);
    }
  };

  // ---------------- render ----------------
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <h2>Room: {roomId}</h2>
        <div><strong>{isHost ? "Host" : "Viewer"}</strong></div>

        {/* Host load controls */}
        {isHost && (
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="YouTube URL or ID"
                value={ytId}
                onChange={(e) => setYtId(e.target.value)}
                style={{ width: 360 }}
              />
              <button onClick={loadYouTube} style={{ marginLeft: 8 }}>Load YouTube</button>
            </div>

            <div>
              <input
                placeholder="MP4 URL (https...)"
                value={mp4Url}
                onChange={(e) => setMp4Url(e.target.value)}
                style={{ width: 360 }}
              />
              <button onClick={loadMp4} style={{ marginLeft: 8 }}>Load MP4</button>
            </div>
          </div>
        )}

        {/* Player */}
        <div style={{ border: "1px solid #ddd", padding: 8 }}>
          {videoType === "youtube" ? (
            <YouTube
              videoId={roomState.src || ytId || ""}
              onReady={onYtReady}
              onStateChange={onYtStateChange}
              opts={{ width: "720" }}
            />
          ) : (
            <video
              ref={videoRef}
              width="720"
              controls
              onPlay={handleMp4Play}
              onPause={handleMp4Pause}
              onSeeked={handleMp4Seeked}
              src={roomState.src || mp4Url || ""}
            />
          )}
        </div>
      </div>

      <div style={{ width: 320 }}>
        <Chat socket={socket} roomId={roomId} />
      </div>
    </div>
  );
}
