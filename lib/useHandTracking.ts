import { useEffect, useState, type RefObject } from 'react';
import { input } from './input';

type LM = { x: number; y: number; z: number };
export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const dist = (a: LM, b: LM, ar: number) => Math.hypot((a.x - b.x) * ar, a.y - b.y);

/** Hitung jumlah jari yang terbuka (0-5), tidak bergantung orientasi tangan. */
/** `ar` = video width / height (landmarks are normalized per axis, so portrait phone video needs this). */
export function countFingers(lm: LM[], ar = 1): number {
  const wrist = lm[0];
  let n = 0;
  const pairs: [number, number][] = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  for (const [tip, pip] of pairs) {
    if (dist(lm[tip], wrist, ar) > dist(lm[pip], wrist, ar) * 1.08) n++;
  }
  // ibu jari: ujungnya menjauh dari pangkal jari kelingking & dari pangkal telunjuk
  const palm = dist(lm[0], lm[9], ar);
  if (dist(lm[4], lm[17], ar) > dist(lm[3], lm[17], ar) * 1.1 && dist(lm[4], lm[5], ar) > palm * 0.45) n++;
  return n;
}

/**
 * Membuka kamera, menjalankan MediaPipe Hand Landmarker, dan menulis hasilnya
 * ke `input`. `onCount` dipanggil hanya saat jumlah jari stabil berubah.
 */
export function useHandTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onCount: (n: number) => void,
): TrackingStatus {
  const [status, setStatus] = useState<TrackingStatus>('idle');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let landmarker: { close: () => void } | null = null;

    (async () => {
      try {
        setStatus('loading');
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(WASM);

        const create = (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL, delegate },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        let hl;
        try {
          hl = await create('GPU');
        } catch {
          hl = await create('CPU');
        }
        landmarker = hl;
        if (cancelled) return hl.close();

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || cancelled) return;
        video.srcObject = stream;
        video.muted = true;
        try {
          await video.play();
        } catch (e) {
          // Some browser extensions wrap play() and throw; the video still plays via autoPlay.
          console.warn('video.play() was interrupted', e);
        }
        setStatus('ready');

        let lastTime = -1;
        let candidate = 0;
        let stable = 0;
        let missing = 0;
        let lastRun = 0;

        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (video.readyState < 2 || video.currentTime === lastTime) return;
          const now = performance.now();
          if (now - lastRun < 33) return; // ~30 fps keeps phones smooth
          lastRun = now;
          lastTime = video.currentTime;

          const res = hl.detectForVideo(video, performance.now());
          if (res.landmarks.length > 0) {
            const lm = res.landmarks[0];
            missing = 0;
            let cx = 0;
            let cy = 0;
            for (const i of [0, 5, 9, 13, 17]) {
              cx += lm[i].x / 5;
              cy += lm[i].y / 5;
            }
            input.active = true;
            input.x = 1 - cx; // mirror
            input.y = cy;

            const n = countFingers(lm, video.videoWidth / (video.videoHeight || 1));
            if (n === candidate) stable++;
            else {
              candidate = n;
              stable = 1;
            }
            if (stable >= 5 && n !== input.count) {
              input.count = n;
              onCount(n);
            }
          } else {
            input.active = false;
            if (++missing > 20 && input.count !== 0) {
              input.count = 0;
              onCount(0);
            }
          }
        };
        loop();
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
      input.active = false;
      setStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return status;
}
