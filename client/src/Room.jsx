import { useEffect, useRef, useState } from "react";

export default function Room({ socket, roomId }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pc = useRef(null);

  const [status, setStatus] = useState("Waiting for another user...");

  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.current.srcObject = stream;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((track) =>
      pc.current.addTrack(track, stream)
    );

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: e.candidate,
        });
      }
    };
  };

  useEffect(() => {
    socket.emit("join-room", roomId);

    socket.on("room-info", async ({ count }) => {
      if (count === 1) {
        await startMedia();
      }

      if (count === 2) {
        await startMedia();
        setStatus("Connecting...");

        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer });
      }

      if (count > 2) {
        alert("Room full (1-to-1 only)");
      }
    });

    socket.on("offer", async (offer) => {
      await pc.current.setRemoteDescription(offer);
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
      setStatus("Connected");
    });

    socket.on("answer", async (answer) => {
      await pc.current.setRemoteDescription(answer);
      setStatus("Connected");
    });

    socket.on("ice-candidate", (candidate) => {
      pc.current.addIceCandidate(candidate);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h3>{status}</h3>

      <div style={{ display: "flex", gap: 20 }}>
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          style={{ width: 300, background: "#000" }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={{ width: 300, background: "#000" }}
        />
      </div>
    </div>
  );
}
