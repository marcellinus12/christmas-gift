// ---------------------------------------------------------------------------
// GPGPU: posisi & kecepatan 100.000 partikel dihitung di GPU tiap frame.
// `resolution`, `texturePosition`, `textureVelocity` otomatis disediakan oleh
// GPUComputationRenderer.
// ---------------------------------------------------------------------------

export const velocityShader = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform float uForm;      // 0 = salju, 1 = membentuk gambar
uniform float uKick;      // ledakan singkat saat ganti bentuk
uniform float uKickSeed;
uniform float uSway;
uniform sampler2D tTarget;
uniform vec3 uHand;
uniform float uHandActive;
uniform vec3 uOffset;
uniform float uLevel;     // energi bass musik 0..1
uniform float uBob;       // gelombang naik-turun (efek berlari)
uniform float uBobY;      // gelombang hanya di bawah y ini

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  float seed = pos.w;

  // target bentuk (diayun pelan di sumbu Y supaya terasa 3D)
  vec4 tex = texture2D(tTarget, uv);
  vec3 target = tex.xyz;
  float form = uForm * tex.w; // tex.w = 0 -> this particle stays snow
  float ang = sin(uTime * 0.7) * uSway;
  float c = cos(ang);
  float s = sin(ang);
  target.y += sin(uTime * 4.0 + target.x * 1.3) * uBob * (1.0 - smoothstep(uBobY, uBobY + 0.8, target.y));
  target *= 1.0 + uLevel * 0.045;
  target = vec3(c * target.x + s * target.z, target.y, -s * target.x + c * target.z) + uOffset;
  target += mix(0.05, 0.015, form) * vec3(
    sin(uTime * 2.1 + seed * 40.0),
    cos(uTime * 1.7 + seed * 23.0),
    sin(uTime * 1.3 + seed * 31.0)
  );

  // gaya salju: jatuh + angin sinus
  vec3 snow = vec3(
    sin(uTime * 0.5 + pos.y * 0.4 + seed * 6.2831) * 0.8,
    -(0.8 + seed * 1.2),
    cos(uTime * 0.43 + pos.x * 0.3 + seed * 6.2831) * 0.8
  );

  vec3 toTarget = target - pos.xyz;
  vec3 desired = mix(snow, toTarget * 7.0, form);
  float k = 1.0 - exp(-uDelta * mix(1.2, 9.0, form));
  vel = mix(vel, desired, k);

  // tangan mendorong & memutar salju
  if (uHandActive > 0.5) {
    vec3 d = pos.xyz - uHand;
    d.z *= 0.4;
    float dist = length(d) + 0.0001;
    float f = smoothstep(3.0, 0.0, dist);
    float strength = mix(1.0, 0.5, form);
    vel += (d / dist) * f * f * 60.0 * uDelta * strength;
    vel += vec3(-d.y, d.x, 0.0) / dist * f * 20.0 * uDelta * strength;
  }

  // ledakan kecil saat ganti bentuk
  if (uKick > 0.0) {
    vec3 r = vec3(hash(uv + uKickSeed), hash(uv + uKickSeed + 3.1), hash(uv + uKickSeed + 7.7)) - 0.5;
    vel += r * uKick * 1.6;
  }

  float sp = length(vel);
  if (sp > 25.0) vel *= 25.0 / sp;

  gl_FragColor = vec4(vel, 1.0);
}
`;

export const positionShader = /* glsl */ `
uniform float uDelta;
uniform float uForm;
uniform sampler2D tTarget;
uniform float uBoundX;   // half width of the snow area (follows the screen)
uniform float uBoundY;   // half height of the snow area (follows the screen)

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec3 vel = texture2D(textureVelocity, uv).xyz;

  pos.xyz += vel * uDelta;
  float tw = texture2D(tTarget, uv).w;

  // salju yang jatuh keluar layar muncul lagi dari atas
  if ((uForm < 0.6 || tw < 0.5) && pos.y < -uBoundY) {
    pos.y = uBoundY + hash(uv + pos.x) * 1.5;
    pos.x = (hash(uv + pos.y) - 0.5) * 2.0 * uBoundX;
    pos.z = (hash(uv * 1.3 + pos.w) - 0.5) * 18.0;
  }
  if (pos.x > uBoundX) pos.x -= 2.0 * uBoundX;
  if (pos.x < -uBoundX) pos.x += 2.0 * uBoundX;

  gl_FragColor = pos; // w = seed, tetap
}
`;

// ---------------------------------------------------------------------------
// Render: 100.000 titik, posisi dibaca dari texture hasil simulasi.
// ---------------------------------------------------------------------------

export const particleVertex = /* glsl */ `
attribute vec2 reference;
uniform sampler2D tPos;
uniform sampler2D tColor;
uniform float uForm;
uniform float uSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uLevel;
uniform float uFlash;
uniform float uSizeMul;
uniform float uAlphaMul;
uniform float uGlow;
uniform float uZoom;     // camera distance / 14, keeps point size on narrow screens
varying vec3 vColor;
varying float vAlpha;

// warna lampu Natal: merah, emas, biru, hijau
vec3 lightCol(float ph) {
  float m = mod(ph, 4.0);
  if (m < 0.5) return vec3(1.7, 0.2, 0.3);
  if (m < 1.5) return vec3(1.7, 1.3, 0.3);
  if (m < 2.5) return vec3(0.35, 0.75, 1.9);
  return vec3(0.35, 1.7, 0.5);
}

void main() {
  vec4 p = texture2D(tPos, reference);
  vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
  float seed = p.w;

  vec4 tc = texture2D(tColor, reference);
  float flag = tc.a;

  // 1 = lampu berkedip per kelompok, 2 = berdenyut serempak
  float phase = floor(seed * 8.0);
  float twinkle = 1.0;
  vec3 baseCol = tc.rgb;
  if (flag > 2.5) {
    // lampu multiwarna yang berkedip bergantian
    twinkle = 0.08 + 1.5 * smoothstep(-0.2, 0.8, sin(uTime * 3.0 + phase * 2.3));
    baseCol = mix(tc.rgb, lightCol(phase), 0.8);
  } else if (flag > 1.5) {
    twinkle = 0.75 + 0.5 * sin(uTime * 4.0);
  } else if (flag > 0.5) {
    twinkle = 0.2 + 1.2 * smoothstep(-0.3, 1.0, sin(uTime * 3.2 + phase * 1.9));
  }
  float spark = pow(0.5 + 0.5 * sin(uTime * 2.5 + seed * 90.0), 10.0);

  vec3 snowCol = mix(vec3(0.7, 0.85, 1.0), vec3(1.0), seed);
  float f = uForm * (flag < -0.5 ? 0.0 : 1.0);
  vec3 shapeCol = baseCol * uGlow * twinkle * (1.0 + uLevel * 0.3);
  float mx = max(shapeCol.r, max(shapeCol.g, shapeCol.b));
  if (mx > 1.0) shapeCol /= mx; // keep the hue, cap brightness
  shapeCol = mix(shapeCol, vec3(1.0), clamp(spark * 0.35 + uFlash * 0.5, 0.0, 0.6));
  vColor = mix(snowCol, shapeCol, f);

  float formSize = uSize * 1.0 * (0.9 + 0.5 * spark + uLevel * 0.3) * (flag > 0.5 ? (0.8 + 0.5 * twinkle) : 1.0);
  float size = mix(uSize * (0.5 + seed * 1.3), formSize, f);
  gl_PointSize = size * uSizeMul * uPixelRatio * (12.0 * uZoom / -mv.z);
  vAlpha = 0.6 * uAlphaMul;

  gl_Position = projectionMatrix * mv;
}
`;

export const particleFragment = /* glsl */ `
uniform float uSoft;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  if (uSoft > 0.5) {
    // halo layer: soft additive glow
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  } else {
    // core layer: solid opaque disc
    gl_FragColor = vec4(vColor, 1.0);
  }
}
`;
