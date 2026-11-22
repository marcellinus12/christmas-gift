"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC } from "@/lib/config";
import { GESTURES } from "@/lib/meta";
import { input } from "@/lib/input";
import { useHandTracking } from "@/lib/useHandTracking";
import { useMusic } from "@/lib/useMusic";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [count, setCount] = useState(0);
  const [to, setTo] = useState("");
  const music = useMusic();

  const setGesture = useCallback((n: number) => {
    input.count = n;
    setCount(n);
  }, []);

  const status = useHandTracking(videoRef, camOn, setGesture);

  // ?to=Name  ->  "Merry Christmas, Name"
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("to");
    if (name) setTo(name.slice(0, 40));
  }, []);

  // mouse / touch: push the snow around (works without the camera)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      input.px = e.clientX / window.innerWidth;
      input.py = e.clientY / window.innerHeight;
      input.pointerActive = true;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") input.pointerActive = false; // finger lifted
    };
    const leave = () => {
      input.pointerActive = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("mouseleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("mouseleave", leave);
      window.removeEventListener("blur", leave);
      input.pointerActive = false;
    };
  }, []);

  // keyboard fallback: 0-5
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-5]$/.test(e.key)) setGesture(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setGesture]);

  const start = () => {
    setCamOn(true);
    void music.play(); // runs inside the click, so the browser allows audio
  };

  const current = GESTURES.find((g) => g.count === count);

  return (
    <main>
      <div className="stage">
        <Scene />
      </div>
      <div className="vignette" />

      <header className="top">
        {to && <h1>{`Merry Christmas, ${to}`}</h1>}
        <p>
          {current
            ? `${current.emoji} ${current.label}`
            : "Move your mouse or drag a finger through the snow. Or show your hand to the camera and hold up 1 to 5 fingers."}
        </p>
      </header>

      {status !== "ready" && (
        <div className="center">
          <div style={{ display: "grid", justifyItems: "center" }}>
            <button
              className="cta"
              onClick={start}
              disabled={status === "loading"}>
              {status === "loading"
                ? "Getting the camera ready…"
                : "Start with camera and music"}
            </button>
            <p className={`note${status === "error" ? " err" : ""}`}>
              {status === "error"
                ? "The camera or hand model could not load. Allow camera access and open the page over HTTPS, or use the buttons below."
                : "Your video never leaves this device."}
            </p>
          </div>
        </div>
      )}

      <div className={`cam${status === "ready" ? " on" : ""}`}>
        <video ref={videoRef} autoPlay playsInline muted />
      </div>

      <button
        className={`music${music.playing ? " on" : ""}`}
        onClick={music.toggle}
        aria-pressed={music.playing}
        title={
          music.error
            ? `Add your audio file at ${MUSIC.src}`
            : `${MUSIC.title} — ${MUSIC.artist}`
        }>
        <span aria-hidden>{music.playing ? "♪" : "♫"}</span>
        <span className="label">
          {music.error
            ? `Missing ${MUSIC.src}`
            : music.playing
              ? MUSIC.title
              : "Play music"}
        </span>
      </button>

      {/* <nav className="dock" aria-label="Choose a shape">
        {GESTURES.map((g) => (
          <button
            key={g.count}
            className={`chip${count === g.count ? ' on' : ''}`}
            onClick={() => setGesture(count === g.count ? 0 : g.count)}
            aria-pressed={count === g.count}
          >
            <span className="n">{g.count}</span>
            <span className="em">{g.emoji}</span>
            <span className="label">{g.label}</span>
          </button>
        ))}
      </nav> */}
    </main>
  );
}
