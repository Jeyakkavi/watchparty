import { useEffect, useRef } from "react";
import YouTube from "react-youtube";

export default function VideoPlayer({ url }) {
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  const getVideoId = () => {
    try {
      if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1].split("?")[0];
      }
      const params = new URLSearchParams(new URL(url).search);
      return params.get("v");
    } catch {
      return null;
    }
  };

  if (isYouTube) {
    const videoId = getVideoId();
    if (!videoId) return <p>Invalid YouTube URL</p>;

    return (
      <YouTube
        videoId={videoId}
        opts={{
          height: "390",
          width: "640",
          playerVars: { autoplay: 0 },
        }}
      />
    );
  }

  return (
    <video
      src={url}
      controls
      style={{ width: "640px", height: "390px", background: "#000" }}
    />
  );
}
