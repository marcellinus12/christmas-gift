"""
Apply the mobile (portrait phone) fixes to the christmas-ar project.

Usage (from the project root, the folder that has package.json):
    python3 apply_mobile_fix.py

Nothing is written unless every edit matches, so it is safe to run once.
Files changed:
  lib/shaders.ts, components/Particles.tsx, lib/useHandTracking.ts, app/globals.css
"""
import sys

EDITS = {
    "lib/shaders.ts": [
        ("uniform sampler2D tTarget;\n\nfloat hash",
         "uniform sampler2D tTarget;\nuniform float uBoundX;   // half width of the snow area (follows the screen)\nuniform float uBoundY;   // half height of the snow area (follows the screen)\n\nfloat hash"),
        ("if ((uForm < 0.6 || tw < 0.5) && pos.y < -9.5) {\n    pos.y = 9.5 + hash(uv + pos.x) * 1.5;\n    pos.x = (hash(uv + pos.y) - 0.5) * 36.0;",
         "if ((uForm < 0.6 || tw < 0.5) && pos.y < -uBoundY) {\n    pos.y = uBoundY + hash(uv + pos.x) * 1.5;\n    pos.x = (hash(uv + pos.y) - 0.5) * 2.0 * uBoundX;"),
        ("  if (pos.x > 18.0) pos.x -= 36.0;\n  if (pos.x < -18.0) pos.x += 36.0;",
         "  if (pos.x > uBoundX) pos.x -= 2.0 * uBoundX;\n  if (pos.x < -uBoundX) pos.x += 2.0 * uBoundX;"),
        ("uniform float uGlow;\nvarying vec3 vColor;",
         "uniform float uGlow;\nuniform float uZoom;     // camera distance / 14, keeps point size on narrow screens\nvarying vec3 vColor;"),
        ("(12.0 / -mv.z)", "(12.0 * uZoom / -mv.z)"),
    ],
    "components/Particles.tsx": [
        ("    const posTex = gpu.createTexture();",
         "    // snow area follows the screen (phones in portrait see a much taller area)\n"
         "    const el = gl.domElement;\n"
         "    const aspect = (el.clientWidth || window.innerWidth) / (el.clientHeight || window.innerHeight);\n"
         "    const camZ = aspect >= 1.35 ? 14 : (14 * 1.35) / aspect;\n"
         "    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(25)) * camZ;\n"
         "    const boundY = Math.max(9.5, visH / 2 + 1.5);\n"
         "    const boundX = Math.max(13, (visH * aspect) / 2 + 2);\n\n"
         "    const posTex = gpu.createTexture();"),
        ("      pd[i * 4] = (Math.random() - 0.5) * 36;\n      pd[i * 4 + 1] = (Math.random() - 0.5) * 20;",
         "      pd[i * 4] = (Math.random() - 0.5) * 2 * boundX;\n      pd[i * 4 + 1] = (Math.random() - 0.5) * 2 * boundY;"),
        ("    pu.uForm = { value: 0 };\n",
         "    pu.uForm = { value: 0 };\n    pu.uBoundX = { value: boundX };\n    pu.uBoundY = { value: boundY };\n"),
        ("          uSoft: { value: soft ? 1 : 0 },",
         "          uSoft: { value: soft ? 1 : 0 },\n          uZoom: { value: camZ / 14 },"),
        ("    const t = clock.elapsedTime;\n",
         "    const t = clock.elapsedTime;\n    sim.pu.uBoundY.value = Math.max(9.5, vh / 2 + 1.5);\n    sim.pu.uBoundX.value = Math.max(13, vw / 2 + 2);\n"),
        ("      u.uPixelRatio.value = gl.getPixelRatio();",
         "      u.uPixelRatio.value = gl.getPixelRatio();\n      u.uZoom.value = cam.position.z / 14;"),
    ],
    "lib/useHandTracking.ts": [
        ("const dist = (a: LM, b: LM) => Math.hypot(a.x - b.x, a.y - b.y);\n",
         "const dist = (a: LM, b: LM, ar: number) => Math.hypot((a.x - b.x) * ar, a.y - b.y);\n"),
        ("export function countFingers(lm: LM[]): number {",
         "/** `ar` = video width / height (landmarks are normalized per axis, so portrait phone video needs this). */\nexport function countFingers(lm: LM[], ar = 1): number {"),
        ("    if (dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.08) n++;",
         "    if (dist(lm[tip], wrist, ar) > dist(lm[pip], wrist, ar) * 1.08) n++;"),
        ("  const palm = dist(lm[0], lm[9]);\n  if (dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.1 && dist(lm[4], lm[5]) > palm * 0.45) n++;",
         "  const palm = dist(lm[0], lm[9], ar);\n  if (dist(lm[4], lm[17], ar) > dist(lm[3], lm[17], ar) * 1.1 && dist(lm[4], lm[5], ar) > palm * 0.45) n++;"),
        ("        let missing = 0;\n", "        let missing = 0;\n        let lastRun = 0;\n"),
        ("          if (video.readyState < 2 || video.currentTime === lastTime) return;\n          lastTime = video.currentTime;\n",
         "          if (video.readyState < 2 || video.currentTime === lastTime) return;\n          const now = performance.now();\n          if (now - lastRun < 33) return; // ~30 fps keeps phones smooth\n          lastRun = now;\n          lastTime = video.currentTime;\n"),
        ("const n = countFingers(lm);",
         "const n = countFingers(lm, video.videoWidth / (video.videoHeight || 1));"),
    ],
    "app/globals.css": [
        (".stage { position: fixed; inset: 0; }", ".stage { position: fixed; inset: 0; touch-action: none; }"),
    ],
}

new_contents = {}
for path, pairs in EDITS.items():
    try:
        text = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        sys.exit(f"File not found: {path} (run this from the project root)")
    for old, new in pairs:
        if text.count(old) != 1:
            sys.exit(f"Could not apply edit in {path} (already applied, or the file differs):\n{old[:80]!r}")
        text = text.replace(old, new)
    new_contents[path] = text

for path, text in new_contents.items():
    open(path, "w", encoding="utf-8").write(text)
    print("updated", path)
print("Done.")