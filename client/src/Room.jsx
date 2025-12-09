import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const playerRef = useRef(null);   // YT player instance (YT.Player)
  const videoRef = useRef(null);    // <video> element
  const pendingYtLoad = useRef(null);
  const isRemoteAction = useRef(false);

  const [isYouTube, setIsYouTube] = useState(false);
  const [src, setSrc] = useState(""); // for MP4 -> url, for YT -> videoId
  const [isHost, setIsHost] = useState(false); // optional: if your server sends host info

  // safe socket attach: only attach when socket exists
  useEffect(() => {
    if (!socket) return;

    // Join room
    socket.emit("join-room", { roomId });

    // initial room state (server sends room object)
    socket.on("sync-state", (room) => {
      if (!room) return;
      setIsYouTube(room.isYouTube);
      setSrc(room.src || "");
      // server may include host info; if so set it:
      if (room.host && socket.id /* client socket id not directly comparable */) {
        // if your server sends host id and client knows its id, set setIsHost accordingly
      }
    });

    // handle control events from server (load/play/pause/seek)
    socket.on("control", ({ action, time, src: serverSrc, isYouTube: serverIsYt }) => {
      // mark remote action
      isRemoteAction.current = true;

      // Update source state
      setIsYouTube(!!serverIsYt);
      setSrc(serverSrc || "");

      if (serverIsYt) {
        // apply to YouTube player when ready
        if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
          if (action === "load") {
            playerRef.current.loadVideoById(serverSrc);
          } else if (action === "play") {
            playerRef.current.seekTo(time || 0, true);
            playerRef.current.playVideo();
          } else if (action === "pause") {
            playerRef.current.seekTo(time || 0, true);
            playerRef.current.pauseVideo();
          } else if (action === "seek") {
            playerRef.current.seekTo(time || 0, true);
          }
        } else {
          // player isn't ready yet — queue the load
          pendingYtLoad.current = { action, time, src: serverSrc };
        }
      } else {
        // MP4
        const v = videoRef.current;
        if (!v) {
          // update state and UI will pick it up
        } else {
          if (action === "load") {
            v.src = serverSrc || "";
            v.load();
          } else if (action === "play") {
            v.currentTime = time || v.currentTime;
            v.play().catch(() => {});
          } else if (action === "pause") {
            v.currentTime = time || v.currentTime;
            v.pause();
          } else if (action === "seek") {
            v.currentTime = time || v.currentTime;
          }
        }
      }

      // small delay before allowing local emits again
      setTimeout(() => (isRemoteAction.current = false), 300);
    });

    // fallback sync (host -> viewers)
    socket.on("sync", ({ time, state, videoType }) => {
      if (isRemoteAction.current) return;
      if (videoType === "youtube") {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const cur = playerRef.current.getCurrentTime();
          const diff = Math.abs(cur - time);
          if (diff > 0.5) playerRef.current.seekTo(time, true);
          if (state === 1) playerRef.current.playVideo();
          if (state === 2) playerRef.current.pauseVideo();
        } else {
          // nothing we can do yet
        }
      } else {
        if (videoRef.current) {
          const cur = videoRef.current.currentTime;
          const diff = Math.abs(cur - time);
          if (diff > 0.5) videoRef.current.currentTime = time;
          if (state === 1) videoRef.current.play().catch(() => {});
          if (state === 2) videoRef.current.pause();
        }
      }
    });

    return () => {
      socket.off("sync-state");
      socket.off("control");
      socket.off("sync");
    };
  }, [socket, roomId]);

  // HOST periodic fallback sync
  useEffect(() => {
    if (!socket) return;
    let timer = null;
    // no gating on isHost to keep testing easier; if you want host-only, check isHost
    timer = setInterval(() => {
      try {
        if (isYouTube && playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const time = playerRef.current.getCurrentTime();
          const state = playerRef.current.getPlayerState(); // 1=playing,2=paused
          socket.emit("sync", { roomId, time, state, videoType: "youtube" });
        } else if (!isYouTube && videoRef.current) {
          const time = videoRef.current.currentTime;
          const state = videoRef.current.paused ? 2 : 1;
          socket.emit("sync", { roomId, time, state, videoType: "mp4" });
        }
      } catch (e) {
        // ignore blocked API calls
      }
    }, 500);
    return () => clearInterval(timer);
  }, [socket, isYouTube, roomId]);

  // YouTube iframe API loader + events
  useEffect(() => {
    // load YT api only once
    if (window.YT && window.YT.Player) {
      // already loaded
      createPlayer();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    function createPlayer() {
      playerRef.current = new YT.Player("player", {
        height: "390",
        width: "640",
        videoId: isYouTube ? src : "",
        events: {
          onReady: (e) => {
            // if pending load came from server, apply it
            if (pendingYtLoad.current) {
              const p = pendingYtLoad.current;
              if (p.action === "load") playerRef.current.loadVideoById(p.src);
              else if (p.action === "play") {
                playerRef.current.seekTo(p.time || 0, true);
                playerRef.current.playVideo();
              }
              pendingYtLoad.current = null;
            }
          },
          onStateChange: (e) => {
            // e.data: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
            if (isRemoteAction.current) return;

            // Emit control events when user (host) interacts: we allow everyone to emit for now
            const state = e.data;
            try {
              const time = playerRef.current.getCurrentTime();
              if (state === 1) {
                socket.emit("control", { roomId, action: "play", time, src, isYouTube: true });
              } else if (state === 2) {
                socket.emit("control", { roomId, action: "pause", time, src, isYouTube: true });
              } else if (state === 3) {
                // treat buffering/seek as seek
                socket.emit("control", { roomId, action: "seek", time, src, isYouTube: true });
              }
            } catch (err) {}
          },
        },
      });
    }

    // cleanup (optional)
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // MP4 local event handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => {
      if (isRemoteAction.current) return;
      socket.emit("control", { roomId, action: "play", time: v.currentTime, src, isYouTube: false });
    };
    const onPause = () => {
      if (isRemoteAction.current) return;
      socket.emit("control", { roomId, action: "pause", time: v.currentTime, src, isYouTube: false });
    };
    const onSeeked = () => {
      if (isRemoteAction.current) return;
      socket.emit("control", { roomId, action: "seek", time: v.currentTime, src, isYouTube: false });
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
    };
  }, [videoRef.current, socket, roomId, src]);

  // UI actions for loading content
  const loadMP4 = (url) => {
    if (!url) return alert("Enter MP4 URL");
    setIsYouTube(false);
    setSrc(url);
    // apply locally immediately
    if (videoRef.current) {
      isRemoteAction.current = true;
      videoRef.current.src = url;
      videoRef.current.load();
      setTimeout(()=> isRemoteAction.current = false, 300);
    }
    socket.emit("control", { roomId, action: "load", src: url, isYouTube: false });
  };

  const loadYT = (urlOrId) => {
    if (!urlOrId) return alert("Enter YouTube URL/ID");
    // extract id if url provided
    let id = urlOrId;
    try {
      const u = new URL(urlOrId);
      if (u.hostname.includes("youtube")) id = u.searchParams.get("v") || id;
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    } catch (e) {}
    setIsYouTube(true);
    setSrc(id);
    // apply locally if player ready
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      isRemoteAction.current = true;
      playerRef.current.loadVideoById(id);
      setTimeout(()=> isRemoteAction.current = false, 300);
    } else {
      pendingYtLoad.current = { action: "load", src: id };
    }
    socket.emit("control", { roomId, action: "load", src: id, isYouTube: true });
  };

  // Basic UI input state
  const [mp4Input, setMp4Input] = useState("");
  const [ytInput, setYtInput] = useState("");

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <h3>Room: {roomId}</h3>
        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="MP4 URL (https...)"
            value={mp4Input}
            onChange={(e) => setMp4Input(e.target.value)}
            style={{ width: 360 }}
          />
          <button onClick={() => loadMP4(mp4Input || src)}>Load MP4</button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="YouTube URL or ID"
            value={ytInput}
            onChange={(e) => setYtInput(e.target.value)}
            style={{ width: 360 }}
          />
          <button onClick={() => loadYT(ytInput || src)}>Load YouTube</button>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 8 }}>
          {isYouTube ? (
            <div id="player" />
          ) : (
            <video ref={videoRef} width="720" controls src={src || undefined} />
          )}
        </div>
      </div>

      <div style={{ width: 320 }}>
        {/* Chat component if you have it */}
      </div>
    </div>
  );
}
