import { useEffect, useRef, useState } from "react";
import Chat from "./Chat";
import YouTube from 'react-youtube';

export default function Room({ socket, roomId }) {
  const videoRef = useRef(null);
  const [roomState, setRoomState] = useState({ isYouTube: false, src: null, playing: false, time: 0 });
  const [isRemoteAction, setIsRemoteAction] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join-room', { roomId });

    socket.on('sync-state', (s) => {
      setRoomState(s);
    });

    socket.on('control', ({ action, time, src, isYouTube }) => {
      // remote action -> apply locally without re-emitting
      setIsRemoteAction(true);
      if (action === 'load') setRoomState({ isYouTube: !!isYouTube, src, playing: false, time: 0 });
      else if (action === 'play') {
        setRoomState(r => ({ ...r, playing: true, time }));
      } else if (action === 'pause') {
        setRoomState(r => ({ ...r, playing: false, time }));
      } else if (action === 'seek') {
        setRoomState(r => ({ ...r, time }));
      }
      setTimeout(()=>setIsRemoteAction(false), 250);
    });

    return () => {
      socket.off('sync-state');
      socket.off('control');
    };
  }, [socket, roomId]);

  // --- MP4 handlers ---
  const onPlayLocal = () => {
    if (isRemoteAction) return;
    const t = videoRef.current.currentTime;
    socket.emit('control', { roomId, action: 'play', time: t });
  };
  const onPauseLocal = () => {
    if (isRemoteAction) return;
    const t = videoRef.current.currentTime;
    socket.emit('control', { roomId, action: 'pause', time: t });
  };
  const onSeekLocal = () => {
    if (isRemoteAction) return;
    const t = videoRef.current.currentTime;
    socket.emit('control', { roomId, action: 'seek', time: t });
  };

  useEffect(()=> {
    // apply roomState changes to mp4 player
    if (!roomState.isYouTube && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - (roomState.time || 0)) > 0.5) {
        videoRef.current.currentTime = roomState.time || 0;
      }
      if (roomState.playing) videoRef.current.play().catch(()=>{});
      else videoRef.current.pause();
    }
  }, [roomState]);

  // --- YouTube handlers ---
  const ytRef = useRef(null);
  const onYtReady = (event) => {
    ytRef.current = event.target;
    if (roomState.time) ytRef.current.seekTo(roomState.time, true);
    if (roomState.playing) ytRef.current.playVideo();
  };
  const onYtStateChange = (e) => {
    if (!ytRef.current) return;
    const state = e.data; // -1 unstarted, 0 ended, 1 playing, 2 paused
    if (isRemoteAction) return;
    const t = ytRef.current.getCurrentTime();
    if (state === 1) socket.emit('control', { roomId, action: 'play', time: t });
    if (state === 2) socket.emit('control', { roomId, action: 'pause', time: t });
  };

  // UI helpers
  const loadYouTube = (urlOrId) => {
    let id = urlOrId;
    // extract id from typical youtube url
    try {
      const u = new URL(urlOrId);
      if (u.hostname.includes('youtube')) id = u.searchParams.get('v') || id;
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    } catch (e) {}
    socket.emit('control', { roomId, action: 'load', src: id, isYouTube: true });
    setRoomState(r => ({ ...r, isYouTube: true, src: id, time: 0, playing: false }));
  };

  const loadMP4 = (url) => {
    socket.emit('control', { roomId, action: 'load', src: url, isYouTube: false });
    setRoomState(r => ({ ...r, isYouTube: false, src: url, time: 0, playing: false }));
  };

  return (
    <div style={{ display:'flex', gap:12 }}>
      <div style={{ flex:1 }}>
        <h3>Room: {roomId}</h3>

        <div style={{ marginBottom: 8 }}>
          <input id="mp4url" placeholder="MP4 URL (or use /sample.mp4)" style={{ width:'60%' }} />
          <button onClick={() => loadMP4(document.getElementById('mp4url').value || '/sample.mp4')}>Load MP4</button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <input id="yturl" placeholder="YouTube URL or ID" style={{ width:'60%' }} />
          <button onClick={() => loadYouTube(document.getElementById('yturl').value)}>Load YouTube</button>
        </div>

        <div style={{ border:'1px solid #ccc', padding:8 }}>
          {!roomState.isYouTube ? (
            <video ref={videoRef} width="720" controls onPlay={onPlayLocal} onPause={onPauseLocal} onSeeked={onSeekLocal}>
              <source src={roomState.src || '/sample.mp4'} type="video/mp4" />
            </video>
          ) : (
            <YouTube
              videoId={roomState.src}
              onReady={onYtReady}
              onStateChange={onYtStateChange}
              opts={{ width: '720', playerVars:{ rel:0, modestbranding:1 } }}
            />
          )}
        </div>
      </div>

      <Chat socket={socket} roomId={roomId} />
    </div>
  );
}
