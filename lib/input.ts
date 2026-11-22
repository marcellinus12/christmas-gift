// Shared mutable state (no React re-renders) between hand tracker, music and the 3D scene.
export const input = {
  /** 0 = no hand / fist (snow), 1-5 = number of fingers */
  count: 0,
  /** whether a hand is currently detected */
  active: false,
  /** palm position, 0..1 (x is mirrored so it behaves like a mirror) */
  x: 0.5,
  y: 0.5,
  /** mouse / finger on the screen, 0..1 (not mirrored) */
  pointerActive: false,
  px: 0.5,
  py: 0.5,
  /** smoothed bass energy of the music, 0..1 */
  level: 0,
};
