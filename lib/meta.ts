export type Look = {
  /** how much the shape sways (radians) */
  sway: number;
  /** color brightness multiplier */
  glow: number;
  /** point size multiplier */
  size: number;
  /** height of the running/bobbing wave */
  bob: number;
  /** the wave only affects points below this y */
  bobY: number;
};

export type Gesture = Look & {
  count: number;
  emoji: string;
  label: string;
};

/** Look used while waiting (no hand / fist). */
export const IDLE_LOOK: Look = { sway: 0.08, glow: 2.4, size: 1.2, bob: 0, bobY: 100 };

export const GESTURES: Gesture[] = [
  { count: 1, emoji: '⭐', label: 'Christmas Star', sway: 0.5, glow: 2.2, size: 1.1, bob: 0, bobY: 100 },
  { count: 2, emoji: '⛄', label: 'Snowman', sway: 0.35, glow: 2.2, size: 1.1, bob: 0.06, bobY: 100 },
  { count: 3, emoji: '🎄', label: 'Christmas Tree', sway: 0.4, glow: 2.2, size: 1.15, bob: 0.05, bobY: 100 },
  { count: 4, emoji: '🦌', label: 'Rudolph', sway: 0.25, glow: 2.2, size: 1.2, bob: 0.1, bobY: 100 },
  { count: 5, emoji: '🎅', label: "Santa's Sleigh", sway: 0.1, glow: 2.4, size: 1.3, bob: 0.3, bobY: 1.5 },
];
