// ---------------------------------------------------------------------------
// Generator bentuk: tiap bentuk = 100.000 titik target (posisi + warna).
// Partikel ke-i selalu menuju titik ke-i, jadi perpindahan antar bentuk
// otomatis menjadi animasi "morphing".
// Unit dunia: area tampil kira-kira x ±11, y ±6.5 di z = 0.
// ---------------------------------------------------------------------------

export const WIDTH = 400;
export const HEIGHT = 250;
export const COUNT = WIDTH * HEIGHT; // 100.000

type RGB = [number, number, number];
type Pt = [number, number];
type Seg = [number, number, number, number];
type Sample = [number, number, number, number, number, number];
type Part = { w: number; f: () => Sample; flag?: number; blink?: number; snow?: boolean };
export type ShapeData = { pos: Float32Array; col: Float32Array };

const rnd = Math.random;
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const vary = (c: RGB, a = 0.25): RGB => {
  const k = 1 + (rnd() - 0.5) * a;
  return [c[0] * k, c[1] * k, c[2] * k];
};
const S = (x: number, y: number, z: number, c: RGB): Sample => [x, y, z, c[0], c[1], c[2]];

// ---------- helper geometri ----------

function inPoly(x: number, y: number, p: Pt[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polySampler(p: Pt[]): () => Pt {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return () => {
    for (let i = 0; i < 200; i++) {
      const x = lerp(x0, x1, rnd());
      const y = lerp(y0, y1, rnd());
      if (inPoly(x, y, p)) return [x, y];
    }
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Pt {
  const r = Math.sqrt(rnd());
  const a = rnd() * Math.PI * 2;
  const x = Math.cos(a) * r * rx;
  const y = Math.sin(a) * r * ry;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [cx + x * c - y * s, cy + x * s + y * c];
}

function starPoly(cx: number, cy: number, R: number, r: number, rot = Math.PI / 2): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = rot + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

function segSampler(segs: Seg[]): () => Pt {
  const lens = segs.map((s) => Math.hypot(s[2] - s[0], s[3] - s[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return () => {
    let t = rnd() * total;
    let i = 0;
    while (i < segs.length - 1 && t > lens[i]) {
      t -= lens[i];
      i++;
    }
    const u = lens[i] ? t / lens[i] : 0;
    const s = segs[i];
    return [lerp(s[0], s[2], u), lerp(s[1], s[3], u)];
  };
}

function sphere(cx: number, cy: number, cz: number, r: number, fill = 0.25, thick = 0.05): [number, number, number] {
  const x = gauss();
  const y = gauss();
  const z = gauss();
  const l = Math.hypot(x, y, z) || 1;
  const rr = rnd() < fill ? r * Math.cbrt(rnd()) : r + gauss() * thick;
  return [cx + (x / l) * rr, cy + (y / l) * rr, cz + (z / l) * rr];
}

function build(parts: Part[]): ShapeData {
  const total = parts.reduce((s, p) => s + p.w, 0);
  const pos = new Float32Array(COUNT * 4);
  const col = new Float32Array(COUNT * 4);
  let i = 0;
  parts.forEach((p, idx) => {
    const end = idx === parts.length - 1 ? COUNT : Math.min(COUNT, i + Math.round((COUNT * p.w) / total));
    for (; i < end; i++) {
      const s = p.f();
      pos[i * 4] = s[0];
      pos[i * 4 + 1] = s[1];
      pos[i * 4 + 2] = s[2];
      pos[i * 4 + 3] = p.snow ? 0 : 1; // w = 0 -> particle keeps falling as snow
      col[i * 4] = s[3];
      col[i * 4 + 1] = s[4];
      col[i * 4 + 2] = s[5];
      // 0 = normal, 1 = twinkle, 2 = pulse, 3 = multicolor blinking light (random subset)
      col[i * 4 + 3] = p.snow ? -1 : (p.flag ?? (rnd() < (p.blink ?? 0.12) ? 3 : 0));
    }
  });
  return { pos, col };
}

// ---------- teks (canvas -> titik) ----------

function textSampler(text: string, y: number, width: number): () => Sample {
  const W = 1600;
  const H = 360;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 700 200px Georgia, "Times New Roman", serif';
  const mw = ctx.measureText(text).width;
  if (mw > W - 40) {
    ctx.font = `italic 700 ${Math.floor((200 * (W - 40)) / mw)}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillText(text, W / 2, H / 2);

  const img = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  let minX = W;
  let maxX = 0;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      if (img[(py * W + px) * 4 + 3] > 140) {
        pts.push(px, py);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
      }
    }
  }
  const scale = width / (maxX - minX || 1);
  const cx = (minX + maxX) / 2;
  const pal: RGB[] = [
    [1.5, 0.3, 0.35],
    [1.5, 1.3, 0.6],
    [0.5, 1.5, 0.7],
    [1.4, 1.4, 1.4],
  ];
  return () => {
    const i = ((rnd() * pts.length) / 2 | 0) * 2;
    const px = pts[i];
    const py = pts[i + 1];
    const x = (px - cx) * scale;
    const t = x / width + 0.5;
    const idx = Math.floor(t * 15) % pal.length;
    return S(x, y - (py - H / 2) * scale, gauss() * 0.1, vary(pal[Math.max(0, idx)], 0.2));
  };
}

// ===========================================================================
// 1 jari — Bintang Natal
// ===========================================================================
function starShape(): ShapeData {
  const outline = starPoly(0, 0.3, 4.6, 1.9);
  const edge = segSampler(
    outline.map((p, i): Seg => {
      const q = outline[(i + 1) % outline.length];
      return [p[0], p[1], q[0], q[1]];
    }),
  );
  const poly = polySampler(outline);
  return build([
    {
      w: 14,
      flag: 1,
      f: () => {
        const [x, y] = edge();
        return S(x + gauss() * 0.04, y + gauss() * 0.04, gauss() * 0.1, [1.2, 1.1, 0.8]);
      },
    },
    {
      w: 68,
      f: () => {
        const [x, y] = poly();
        const d = Math.hypot(x, y - 0.3) / 4.6;
        const z = (rnd() - 0.5) * 0.9 * (1 - d * 0.7);
        return S(x, y, z, vary(mix([1, 0.97, 0.75], [1, 0.62, 0.08], Math.min(1, d * 1.2)), 0.2));
      },
    },
    { w: 20, flag: 1, f: () => S(gauss() * 1.6, 0.3 + gauss() * 1.6, gauss() * 0.6, vary([1, 0.75, 0.25], 0.4)) },
    {
      w: 12,
      flag: 1,
      f: () => {
        const a = rnd() * Math.PI * 2;
        const r = 5.7 + gauss() * 0.08;
        return S(Math.cos(a) * r, 0.3 + Math.sin(a) * r * 0.95, gauss() * 0.25, vary([0.7, 0.85, 1], 0.3));
      },
    },
  ]);
}

// ===========================================================================
// 2 jari — Manusia Salju
// ===========================================================================
function snowmanShape(): ShapeData {
  const WHITE: RGB = [0.92, 0.96, 1];
  const body = (cy: number, r: number) => () => {
    const [x, y, z] = sphere(0, cy, 0, r, 0.3, 0.04);
    return S(x, y, z, vary(WHITE, 0.2));
  };
  const arm = (side: number) => {
    const sm = segSampler([
      [1.3 * side, 0.5, 3.1 * side, 1.7],
      [2.2 * side, 1.1, 2.9 * side, 0.3],
      [2.5 * side, 1.3, 3.0 * side, 2.4],
    ]);
    return () => {
      const [x, y] = sm();
      return S(x + gauss() * 0.04, y + gauss() * 0.04, gauss() * 0.05, vary([0.85, 0.55, 0.25]));
    };
  };
  const buttonYs = [0.65, 0, -0.65];
  const PURPLE: RGB = [0.65, 0.35, 1];

  return build([
    { w: 26, f: body(-3, 2) },
    { w: 18, f: body(0, 1.45) },
    { w: 10, f: body(2.55, 1) },
    // kancing
    {
      w: 2.5,
      f: () => {
        const by = buttonYs[(rnd() * 3) | 0];
        const z = Math.sqrt(1.45 * 1.45 - by * by);
        return S(gauss() * 0.07, by + gauss() * 0.07, z + 0.03, [1, 0.25, 0.3]);
      },
    },
    // mata
    {
      w: 1.6,
      f: () => {
        const sx = rnd() < 0.5 ? -1 : 1;
        return S(sx * 0.36 + gauss() * 0.05, 2.78 + gauss() * 0.05, 0.93, [0.35, 0.6, 1.3]);
      },
    },
    // hidung wortel
    {
      w: 2,
      f: () => {
        const t = rnd();
        const rad = 0.17 * (1 - t);
        const a = rnd() * 6.283;
        return S(Math.cos(a) * rad, 2.5 + Math.sin(a) * rad, 0.95 + t * 1.0, [1, 0.5, 0.1]);
      },
    },
    // senyum
    {
      w: 1.5,
      f: () => {
        const x = lerp(-0.45, 0.45, rnd());
        return S(x, 2.2 + 0.18 * (x / 0.45) ** 2 + gauss() * 0.02, Math.sqrt(Math.max(0, 1 - x * x - 0.12)) + 0.02, [1, 0.35, 0.4]);
      },
    },
    // syal
    {
      w: 6,
      f: () => {
        const a = rnd() * 6.283;
        const b = rnd() * 6.283;
        const R = 0.72;
        const rr = 0.25;
        const x = (R + rr * Math.cos(b)) * Math.cos(a);
        const z = (R + rr * Math.cos(b)) * Math.sin(a);
        const y = 1.5 + rr * Math.sin(b) * 0.9;
        const stripe = Math.floor((a / 6.283) * 14) % 2 === 0;
        return S(x, y, z, vary(stripe ? [1, 0.15, 0.2] : [1, 0.9, 0.9], 0.2));
      },
    },
    {
      w: 2,
      f: () => {
        const t = rnd();
        const y = lerp(1.35, 0.2, t);
        const x = lerp(0.45, 0.85, t) + (rnd() - 0.5) * 0.32;
        const z = Math.sqrt(Math.max(0.05, 2.1 - y * y - x * x)) + 0.12;
        return S(x, y, z, vary(Math.floor(t * 6) % 2 === 0 ? [1, 0.15, 0.2] : [1, 0.9, 0.9]));
      },
    },
    // topi
    {
      w: 3,
      f: () => {
        const [x, z] = ellipse(0, 0, 1.3, 1.3);
        return S(x, 3.5 + gauss() * 0.02, z, vary(PURPLE));
      },
    },
    {
      w: 6,
      f: () => {
        const a = rnd() * 6.283;
        const y = lerp(3.5, 4.7, rnd());
        const rr = 0.78 * (rnd() < 0.35 ? Math.sqrt(rnd()) : 1);
        return S(Math.cos(a) * rr, y, Math.sin(a) * rr, y < 3.85 ? [1, 0.8, 0.2] : vary(PURPLE));
      },
    },
    {
      w: 1.5,
      f: () => {
        const [x, z] = ellipse(0, 0, 0.78, 0.78);
        return S(x, 4.7, z, vary(PURPLE));
      },
    },
    // lengan ranting
    { w: 3, f: arm(1) },
    { w: 3, f: arm(-1) },
  ]);
}

// ===========================================================================
// 3 jari — Pohon Natal
// ===========================================================================
const TIERS = [
  { y0: -3.6, y1: -0.4, R: 3.3 },
  { y0: -1.7, y1: 1.4, R: 2.6 },
  { y0: 0.1, y1: 3.0, R: 1.9 },
  { y0: 1.7, y1: 4.3, R: 1.2 },
];
const TIER_W = TIERS.map((t) => t.R * t.R);
const TIER_SUM = TIER_W.reduce((a, b) => a + b, 0);

function envR(y: number) {
  let m = 0;
  for (const t of TIERS) {
    if (y >= t.y0 && y <= t.y1) m = Math.max(m, t.R * (1 - (y - t.y0) / (t.y1 - t.y0)));
  }
  return m;
}

function tierPoint(shell: boolean): [number, number, number] {
  let pick = rnd() * TIER_SUM;
  let ti = 0;
  while (ti < TIERS.length - 1 && pick > TIER_W[ti]) {
    pick -= TIER_W[ti];
    ti++;
  }
  const t = TIERS[ti];
  const u = 1 - Math.sqrt(rnd());
  const r = t.R * (1 - u);
  const k = shell ? (rnd() < 0.3 ? Math.sqrt(rnd()) : 1) : 1;
  const a = rnd() * 6.283;
  return [Math.cos(a) * r * k, lerp(t.y0, t.y1, u), Math.sin(a) * r * k];
}

function treeShape(): ShapeData {
  const palette: RGB[] = [
    [1, 0.2, 0.25],
    [0.35, 0.6, 1.2],
    [1, 0.85, 0.3],
    [1, 0.5, 0.8],
  ];
  const ornaments = Array.from({ length: 32 }, () => {
    const [x, y, z] = tierPoint(false);
    return { x: x * 1.03, y, z: z * 1.03, c: palette[(rnd() * palette.length) | 0] };
  });

  return build([
    {
      w: 70,
      f: () => {
        const [x, y, z] = tierPoint(true);
        const g = rnd();
        return S(x, y, z, mix([0.05, 0.5, 0.18], [0.25, 0.95, 0.4], g * g));
      },
    },
    // batang
    {
      w: 4,
      f: () => {
        const a = rnd() * 6.283;
        const r = 0.45 * (rnd() < 0.4 ? Math.sqrt(rnd()) : 1);
        return S(Math.cos(a) * r, lerp(-5, -3.6, rnd()), Math.sin(a) * r, vary([0.6, 0.33, 0.14]));
      },
    },
    // lilitan lampu
    {
      w: 7,
      flag: 1,
      f: () => {
        const s = rnd();
        const y = lerp(-3.3, 4.0, s);
        const a = s * Math.PI * 2 * 5;
        const r = envR(y) + 0.15;
        return S(Math.cos(a) * r, y, Math.sin(a) * r, vary([1, 0.85, 0.3], 0.3));
      },
    },
    // bola hias
    {
      w: 9,
      flag: 1,
      f: () => {
        const o = ornaments[(rnd() * ornaments.length) | 0];
        return S(o.x + gauss() * 0.12, o.y + gauss() * 0.12, o.z + gauss() * 0.12, vary(o.c, 0.2));
      },
    },
    // bintang di puncak
    {
      w: 4,
      flag: 2,
      f: (() => {
        const poly = polySampler(starPoly(0, 4.75, 0.75, 0.32));
        return () => {
          const [x, y] = poly();
          return S(x, y, gauss() * 0.06, vary([1.2, 1, 0.5], 0.2));
        };
      })(),
    },
  ]);
}

// ===========================================================================
// 4 jari — Rudolph
// ===========================================================================
function rudolphShape(): ShapeData {
  const BROWN: RGB = [0.62, 0.36, 0.16];
  const TAN: RGB = [0.95, 0.68, 0.32];

  const antler = (s: number) => {
    const bx = 0.9 * s;
    const by = 1.3;
    const rel: Seg[] = [
      [0, 0, 0.35, 1.1],
      [0.35, 1.1, 0.25, 2.2],
      [0.25, 2.2, 0.75, 3.2],
      [0.35, 1.1, 1.25, 1.7],
      [0.25, 2.2, 1.1, 2.8],
      [0.25, 2.2, -0.5, 2.9],
      [0.75, 3.2, 1.3, 3.9],
    ];
    const sm = segSampler(rel.map(([a, b, c, d]): Seg => [bx + a * s, by + b, bx + c * s, by + d]));
    return () => {
      const [x, y] = sm();
      return S(x + gauss() * 0.07, y + gauss() * 0.07, gauss() * 0.07, vary(TAN, 0.3));
    };
  };
  const ear = (s: number, inner: boolean) => () => {
    const k = inner ? 0.55 : 1;
    const [x, y] = ellipse(2.3 * s, 0.9, 1.0 * k, 0.45 * k, 0.5 * s);
    return S(x, y, (rnd() - 0.5) * 0.2 + (inner ? 0.1 : 0), vary(inner ? [1, 0.6, 0.7] : BROWN, 0.25));
  };

  return build([
    // kepala
    {
      w: 30,
      f: () => {
        const [x, y] = ellipse(0, -0.6, 1.9, 2.2);
        const d = Math.hypot(x / 1.9, (y + 0.6) / 2.2);
        return S(x, y, (rnd() - 0.5) * 0.5, vary(mix([0.8, 0.5, 0.25], BROWN, d), 0.3));
      },
    },
    // moncong
    {
      w: 9,
      f: () => {
        const [x, y] = ellipse(0, -2.2, 1.2, 0.95);
        return S(x, y, 0.3 + (rnd() - 0.5) * 0.2, vary([1, 0.85, 0.65], 0.2));
      },
    },
    // hidung merah
    {
      w: 6,
      flag: 2,
      f: () => {
        const [x, y, z] = sphere(0, -2.45, 0.75, 0.5, 0.9, 0.03);
        return S(x, y, z, vary([1.7, 0.1, 0.1], 0.25));
      },
    },
    // cahaya hidung
    { w: 3, flag: 2, f: () => S(gauss() * 0.55, -2.45 + gauss() * 0.55, 0.75 + gauss() * 0.3, [0.8, 0.05, 0.05]) },
    // mata
    {
      w: 3,
      f: () => {
        const sx = rnd() < 0.5 ? -1 : 1;
        const [x, y] = ellipse(0.8 * sx, -0.15, 0.26, 0.26);
        return S(x, y, 0.3, [1.2, 1.2, 1.2]);
      },
    },
    { w: 5, f: ear(1, false) },
    { w: 5, f: ear(-1, false) },
    { w: 1.5, f: ear(1, true) },
    { w: 1.5, f: ear(-1, true) },
    { w: 13, f: antler(1) },
    { w: 13, f: antler(-1) },
  ]);
}

// ===========================================================================
// 5 jari — Kereta luncur Santa + tulisan "Merry Christmas"
// ===========================================================================
/** One reindeer in profile, galloping to the right. Local units ~ 3.4 wide, scaled by 0.85. */
function reindeerParts(cx: number, cy: number, tilt: number, variant: 0 | 1, rudolph: boolean): Part[] {
  const k = 0.85;
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const T = (x: number, y: number): Pt => [cx + (x * c - y * sn) * k, cy + (x * sn + y * c) * k];
  const BROWN: RGB = [1.0, 0.55, 0.22];
  const BELLY: RGB = [1.2, 0.85, 0.5];
  const TAN: RGB = [1.5, 1.1, 0.4];
  const GOLD: RGB = [1.5, 1.05, 0.25];
  const RED: RGB = [1.8, 0.12, 0.15];
  const WHITE: RGB = [1.4, 1.4, 1.4];

  const thick = (segs: Seg[], r: number) => {
    const sm = segSampler(segs);
    return (): Pt => {
      const [x, y] = sm();
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * r;
      return T(x + Math.cos(a) * d, y + Math.sin(a) * d);
    };
  };
  const mk = (w: number, pt: () => Pt, col: () => RGB, opt: { flag?: number; blink?: number } = {}): Part => ({
    w,
    flag: opt.flag,
    blink: opt.blink,
    f: () => {
      const [x, y] = pt();
      return S(x, y, (rnd() - 0.5) * 0.4, col());
    },
  });

  const legs: Seg[] =
    variant === 0
      ? [
          [0.65, -0.25, 1.25, -0.75], [1.25, -0.75, 1.65, -0.6],
          [0.45, -0.3, 0.85, -0.95], [0.85, -0.95, 1.1, -0.8],
          [-0.65, -0.2, -1.15, -0.8], [-1.15, -0.8, -1.55, -0.7],
          [-0.45, -0.3, -0.55, -1.0], [-0.55, -1.0, -0.85, -1.05],
        ]
      : [
          [0.65, -0.25, 1.0, -0.95], [1.0, -0.95, 1.3, -0.9],
          [0.45, -0.3, 1.2, -0.55], [1.2, -0.55, 1.6, -0.4],
          [-0.65, -0.2, -0.9, -0.95], [-0.9, -0.95, -1.2, -1.0],
          [-0.45, -0.3, -1.3, -0.6], [-1.3, -0.6, -1.7, -0.45],
        ];
  const antlers: Seg[] = [
    [1.4, 1.0, 1.1, 1.9],
    [1.25, 1.45, 1.7, 1.8],
    [1.1, 1.9, 1.55, 2.3],
    [1.1, 1.9, 0.7, 2.25],
  ];

  const parts: Part[] = [
    mk(9, () => { const [x, y] = ellipse(0, 0, 1.0, 0.42); return T(x, y); }, () => vary(rnd() < 0.25 ? BELLY : BROWN, 0.25)),
    mk(3, thick([[0.7, 0.2, 1.35, 0.9]], 0.24), () => vary(BROWN, 0.25)),
    mk(2.5, thick([[1.35, 0.9, 1.9, 0.78]], 0.2), () => vary(BROWN, 0.25)),
    mk(0.6, thick([[1.3, 1.05, 1.1, 1.4]], 0.08), () => [1.5, 0.7, 0.8]),
    mk(3.5, thick(antlers, 0.05), () => vary(TAN, 0.2), { blink: 0.3 }),
    mk(6, thick(legs, 0.1), () => vary([0.9, 0.5, 0.2], 0.25)),
    mk(0.5, thick([[-0.95, 0.2, -1.25, 0.35]], 0.13), () => WHITE),
    // harness: blinking gold strap + red collar
    mk(1.4, thick([[-0.6, 0.42, 0.6, 0.44], [0.55, 0.42, 0.55, -0.4]], 0.04), () => GOLD, { flag: 1 }),
    mk(1, thick([[0.9, 0.5, 1.05, 0.68]], 0.12), () => vary(RED, 0.2), { flag: 1 }),
    mk(0.2, thick([[1.65, 0.9, 1.65, 0.9]], 0.05), () => WHITE),
  ];
  if (rudolph) {
    parts.push(mk(0.7, thick([[1.93, 0.76, 1.97, 0.76]], 0.15), () => vary(RED, 0.2), { flag: 2 }));
    parts.push(mk(1.4, () => T(1.95 + gauss() * 0.28, 0.77 + gauss() * 0.28), () => [1.3, 0.05, 0.05], { flag: 2 }));
  } else {
    parts.push(mk(0.5, thick([[1.93, 0.76, 1.97, 0.76]], 0.13), () => [0.5, 0.3, 0.15]));
  }
  return parts;
}

function sleighShape(): ShapeData {
  // Sleigh is drawn in its own units, then scaled/moved to the left of the team.
  const K = 0.7;
  const OX = -5.22;
  const OY = -1.5;
  const sd = (x: number, y: number, z: number, c: RGB) => S(OX + x * K, OY + y * K, z * K, c);
  const RED: RGB = [1.4, 0.1, 0.18];
  const GOLD: RGB = [1.5, 1.05, 0.25];

  const body = polySampler([
    [-4.2, -0.4],
    [-3.8, -2.4],
    [-2.6, -3.4],
    [2.8, -3.4],
    [4.0, -2.6],
    [4.8, -1.0],
    [4.3, -0.9],
    [3.6, -1.8],
    [-3.0, -1.8],
  ]);
  const trim = segSampler([
    [-3.0, -1.8, 3.6, -1.8],
    [3.6, -1.8, 4.3, -0.9],
    [-3.0, -1.8, -4.2, -0.4],
  ]);
  const runner = segSampler([
    [-4.4, -4.0, 4.0, -4.0],
    [4.0, -4.0, 4.9, -3.4],
    [4.9, -3.4, 5.2, -2.5],
    [-2.5, -4.0, -2.5, -3.4],
    [1.8, -4.0, 1.8, -3.4],
  ]);
  const hat = polySampler([
    [-1.15, 1.2],
    [-0.05, 1.2],
    [0.45, 2.0],
  ]);
  const text = textSampler('Merry Christmas', 3.9, 13);

  // reindeer team, rising toward the lead (Rudolph)
  const team = [
    { cx: 0.2, cy: -3.35, tilt: 0.0, v: 0 as const, r: false },
    { cx: 3.2, cy: -3.05, tilt: 0.08, v: 1 as const, r: false },
    { cx: 6.2, cy: -2.7, tilt: 0.15, v: 0 as const, r: true },
  ];
  const reinSegs: Seg[] = [[-1.9, -2.3, team[0].cx - 0.7, team[0].cy + 0.3]];
  for (let n = 0; n < team.length - 1; n++) {
    reinSegs.push([team[n].cx + 0.75, team[n].cy + 0.3, team[n + 1].cx - 0.7, team[n + 1].cy + 0.3]);
  }
  const reins = segSampler(reinSegs);

  const sleighParts: Part[] = [
    { w: 22, f: () => { const [x, y] = body(); return sd(x, y, (rnd() - 0.5) * 1.4, vary(RED, 0.3)); } },
    { w: 3, flag: 1, f: () => { const [x, y] = trim(); return sd(x + gauss() * 0.03, y + gauss() * 0.03, (rnd() - 0.5) * 1.4, vary(GOLD)); } },
    { w: 5, flag: 1, f: () => { const [x, y] = runner(); return sd(x + gauss() * 0.04, y + gauss() * 0.04, rnd() < 0.5 ? -0.8 : 0.8, vary(GOLD)); } },
    // Santa
    { w: 6, f: () => { const [x, y] = ellipse(-0.6, -0.5, 1.0, 1.1); return sd(x, y, 0.2 + gauss() * 0.25, vary([1.5, 0.2, 0.25])); } },
    { w: 0.8, flag: 1, f: () => sd(lerp(-1.5, 0.3, rnd()), -0.95 + gauss() * 0.04, 0.5, GOLD) },
    { w: 3, f: () => { const [x, y] = ellipse(-0.6, 0.95, 0.5, 0.5); return sd(x, y, 0.3 + gauss() * 0.1, vary([1.4, 1.0, 0.8])); } },
    { w: 3, f: () => { const [x, y] = ellipse(-0.6, 0.55, 0.5, 0.4); return sd(x, y, 0.45 + gauss() * 0.1, vary([1.4, 1.4, 1.4], 0.1)); } },
    { w: 3, f: () => { const [x, y] = hat(); return sd(x, y, 0.3 + gauss() * 0.1, vary([1.5, 0.15, 0.2])); } },
    { w: 1, f: () => { const [x, y] = ellipse(-0.6, 1.2, 0.6, 0.14); return sd(x, y, 0.35, [1.4, 1.4, 1.4]); } },
    { w: 0.8, flag: 2, f: () => { const [x, y, z] = sphere(0.5, 2.0, 0.3, 0.18, 0.8, 0.02); return sd(x, y, z, [1.4, 1.4, 1.4]); } },
    // gift sack + presents
    { w: 5, f: () => { const [x, y] = ellipse(-3.0, -0.5, 1.05, 1.15); return sd(x, y, gauss() * 0.3, vary([1.3, 0.7, 0.2], 0.3)); } },
    { w: 1.5, blink: 0.3, f: () => sd(lerp(1.3, 2.5, rnd()), lerp(-1.8, -0.9, rnd()), (rnd() - 0.5) * 0.6, vary([0.3, 1.4, 0.5])) },
    { w: 1.2, blink: 0.3, f: () => sd(lerp(2.6, 3.4, rnd()), lerp(-1.8, -1.1, rnd()), (rnd() - 0.5) * 0.6, vary([0.4, 0.8, 1.6])) },
  ];

  const teamParts = team.flatMap((t) => reindeerParts(t.cx, t.cy, t.tilt, t.v, t.r));

  return build([
    { w: 55, blink: 0.15, f: text },
    ...sleighParts,
    ...teamParts,
    { w: 3, flag: 1, f: () => { const [x, y] = reins(); return S(x + gauss() * 0.02, y + gauss() * 0.02, gauss() * 0.04, vary(GOLD, 0.2)); } },
  ]);
}

// ===========================================================================
// Idle (no hand / waiting) — big clear "Merry Christmas" with snow still falling
// ===========================================================================
function idleShape(): ShapeData {
  const GOLD: RGB = [1.5, 1.05, 0.3];
  const text = textSampler('Merry Christmas', 0.6, 13);
  const stars = [
    { x: 0, y: 3.7, r: 1.0, flag: 2 },
    { x: -4.2, y: 3.4, r: 0.55, flag: 1 },
    { x: 4.2, y: 3.4, r: 0.55, flag: 1 },
  ].map((st) => ({ ...st, poly: polySampler(starPoly(st.x, st.y, st.r, st.r * 0.42)) }));

  return build([
    { w: 48, blink: 0.15, f: text },
    {
      w: 4,
      f: () => {
        const st = stars[(rnd() * stars.length) | 0];
        const [x, y] = st.poly();
        return S(x, y, gauss() * 0.05, vary(GOLD, 0.2));
      },
    },
    {
      w: 4,
      flag: 1,
      f: () => {
        const x = lerp(-6, 6, rnd());
        return S(x, -1.3 + 0.25 * Math.sin(x * 1.1) + gauss() * 0.03, gauss() * 0.06, vary(GOLD, 0.2));
      },
    },
    // remaining particles stay snow
    { w: 44, snow: true, f: () => S((rnd() - 0.5) * 30, (rnd() - 0.5) * 18, (rnd() - 0.5) * 16, [1, 1, 1]) },
  ]);
}

/** Index 0-4 = gestures 1-5, index 5 = idle. */
export const IDLE_INDEX = 5;

export function buildAllShapes(): ShapeData[] {
  return [starShape(), snowmanShape(), treeShape(), rudolphShape(), sleighShape(), idleShape()];
}
