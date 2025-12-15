import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const watchVideo = useRef();
  const pc = useRef(null);
  const localStream = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // ================== WEBRTC ==================
  const startMedia = async (screen = false) => {
    const stream = screen
      ? await navigator.mediaDevices.getDisplayMedia({ video: true })
      : await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

    localStream.current = stream;
    localVideo.current.srcObject = stream;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((t) =>
      pc.current.addTrack(t, stream)
    );

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    pc.current.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("ice-candidate", {
          roomId,
          candidate: e.candidate,
        });
    };
  };

  const call = async () => {
    await startMedia();
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
  };

  // ================== SOCKET ==================
  useEffect(() => {
    socket.emit("join-room", roomId);

    socket.on("offer", async (offer) => {
      await startMedia();
      await pc.current.setRemoteDescription(offer);
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      await pc.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", (candidate) => {
      pc.current.addIceCandidate(candidate);
    });

    socket.on("video-control", ({ action, time, src }) => {
      if (action === "load") {
        watchVideo.current.src = src;
      }
      if (action === "play") {
        watchVideo.current.currentTime = time;
        watchVideo.current.play();
      }
      if (action === "pause") {
        watchVideo.current.currentTime = time;
        watchVideo.current.pause();
      }
    });
  }, []);

  // ================== CONTROLS ==================
  const toggleMic = () => {
    localStream.current
      .getAudioTracks()
      .forEach((t) => (t.enabled = !micOn));
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    localStream.current
      .getVideoTracks()
      .forEach((t) => (t.enabled = !camOn));
    setCamOn(!camOn);
  };

  const shareScreen = async () => {
    await startMedia(true);
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
  };

  // ================== WATCH PARTY ==================
  const loadVideo = () => {
    const url = prompt("MP4 URL");
    socket.emit("video-control", {
      roomId,
      action: "load",
      src: url,
    });
  };

  const playVideo = () =>
    socket.emit("video-control", {
      roomId,
      action: "play",
      time: watchVideo.current.currentTime,
    });

  const pauseVideo = () =>
    socket.emit("video-control", {
      roomId,
      action: "pause",
      time: watchVideo.current.currentTime,
    });

  // ================== UI ==================
  return (
    <div>
      <h2>Room: {roomId}</h2>

      <button onClick={call}>Start Call</button>
      <button onClick={toggleMic}>
        {micOn ? "Mute Mic" : "Unmute Mic"}
      </button>
      <button onClick={toggleCam}>
        {camOn ? "Camera Off" : "Camera On"}
      </button>
      <button onClick={shareScreen}>Share Screen</button>

      <hr />

      <button onClick={loadVideo}>Load MP4</button>
      <button onClick={playVideo}>Play</button>
      <button onClick={pauseVideo}>Pause</button>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <video ref={localVideo} autoPlay muted width="250" />
        <video ref={remoteVideo} autoPlay width="250" />
        <video
          ref={watchVideo}
          controls
          width="400"
          style={{ background: "black" }}
        />
      </div>
    </div>
  );
}
