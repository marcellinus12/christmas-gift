# Merry Christmas — AR Snow Particles

Interactive art for a Christmas gift. Fingers captured by the webcam are tracked
with **MediaPipe Hand Landmarker**, and **100,000 snow particles** (positions and
velocities computed on the GPU with GLSL / WebGL 2) morph into shapes depending on
how many fingers you show.

| Fingers | Shape |
| ------- | ----- |
| ✊ 0 (fist) / no hand | big "Merry Christmas" text with snow still falling |
| ☝️ 1 | ⭐ Christmas star |
| ✌️ 2 | ⛄ Snowman |
| 🤟 3 | 🎄 Christmas tree (blinking lights) |
| 🖖 4 | 🦌 Rudolph (pulsing red nose) |
| 🖐️ 5 | 🎅 Santa's sleigh + "Merry Christmas" |

Move your hand: snow is pushed and swirled around your palm, and the shape drifts
slightly toward your hand. Particles also pulse with the bass of the music.

## Run

```bash
npm install
npm run dev      # open http://localhost:3000
```

The camera only works on `localhost` or **HTTPS** (Vercel is HTTPS by default).

- No camera: press **1–5** on the keyboard or click the chips at the bottom.
- Personal greeting: `https://yoursite.com/?to=Maria` shows "Merry Christmas, Maria".

## Music

Put your own audio file at `public/music/song.mp3` (the project cannot ship
copyrighted songs, so use a file you have the rights to use). To switch songs,
replace the file or edit `MUSIC` in `lib/config.ts` (path, title, artist, volume).
Playback starts when you press the start button, because browsers block audio
before a click.

## Structure

```
app/page.tsx              UI, camera button, music button, shape chips
components/Scene.tsx      React Three Fiber canvas
components/Particles.tsx  GPGPU (GPUComputationRenderer) + 2-layer render (core + halo glow)
lib/shaders.ts            GLSL: velocity, position, vertex, fragment
lib/shapes.ts             5 shape generators (100,000 target points + colors)
lib/useHandTracking.ts    MediaPipe + finger counting
lib/useMusic.ts           background music + bass analyser
lib/config.ts             song settings
lib/input.ts              shared state (no re-renders)
```

## Tuning

- Particle count: `WIDTH × HEIGHT` in `lib/shapes.ts` (400 × 250 = 100,000).
- Brightness: `uGlow` (color boost) and halo alpha `0.07` in `Particles.tsx`.
- Point size: `uSize` in `Particles.tsx`.
- Snow speed and hand push strength: `velocityShader` in `lib/shaders.ts`.
- Colors/shapes: `lib/shapes.ts`. Each part can set `flag: 1` (twinkle) or `flag: 2` (pulse).
- Fingers misread? Adjust `1.08` / `stable >= 5` in `lib/useHandTracking.ts`.

## Self-hosting MediaPipe

The WASM files and model load from a CDN (jsDelivr + Google Storage). To self-host,
copy `node_modules/@mediapipe/tasks-vision/wasm` and `hand_landmarker.task` into
`public/mediapipe/` and change `WASM` and `MODEL` in `lib/useHandTracking.ts`.
