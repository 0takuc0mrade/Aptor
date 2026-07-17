"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type LandingVideoProps = Readonly<{
  poster: string;
  source?: string;
}>;

export function LandingVideo({ poster, source }: LandingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !source) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
      void video.play().catch(() => undefined);

      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({
      capLevelToPlayerSize: true,
      enableWorker: true,
      startLevel: -1,
    });

    hls.loadSource(source);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().catch(() => undefined);
    });

    return () => {
      hls.destroy();
    };
  }, [source]);

  return (
    <div aria-hidden="true" className="landing-media">
      <video
        autoPlay
        className="landing-media__video"
        loop
        muted
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
        tabIndex={-1}
      />
      <div className="landing-media__wash" />
    </div>
  );
}
