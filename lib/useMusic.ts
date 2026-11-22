import { useCallback, useEffect, useRef, useState } from 'react';
import { MUSIC } from './config';
import { input } from './input';

/**
 * Background music. Also feeds `input.level` (bass energy) so the particles
 * pulse with the beat. If the Web Audio analyser can't be created the song
 * still plays, only without the pulse.
 */
export function useMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = new Audio(MUSIC.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = MUSIC.volume;
    audio.addEventListener('error', () => {
      setError(true);
      setPlaying(false);
    });
    audioRef.current = audio;

    let raf = 0;
    const buf = new Uint8Array(128);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const an = analyserRef.current;
      let target = 0;
      if (an && !audio.paused) {
        an.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 1; i < 9; i++) sum += buf[i];
        target = Math.min(1, Math.max(0, (sum / 8 / 255 - 0.35) * 2.2));
      }
      input.level += (target - input.level) * 0.25;
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      audio.pause();
      audio.src = '';
      ctxRef.current?.close();
      input.level = 0;
    };
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!ctxRef.current) {
        try {
          const ctx = new AudioContext();
          const src = ctx.createMediaElementSource(audio);
          const an = ctx.createAnalyser();
          an.fftSize = 256;
          src.connect(an);
          an.connect(ctx.destination);
          ctxRef.current = ctx;
          analyserRef.current = an;
        } catch {
          /* no analyser, plain playback */
        }
      }
      await ctxRef.current?.resume();
      await audio.play();
      setError(false);
      setPlaying(true);
    } catch {
      setError(true);
      setPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => (playing ? pause() : void play()), [playing, play, pause]);

  return { playing, error, play, toggle };
}
