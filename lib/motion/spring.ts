/**
 * @helix/motion — spring core
 *
 * Faithful port of Apple's "Designing Fluid Interfaces" spring model (WWDC 2018):
 * parameters are (dampingRatio, response) — NOT duration. A spring has no fixed
 * duration; its settle time emerges from the parameters. Springs are inherently
 * interruptible and velocity-aware, which is what makes motion feel physical.
 *
 * Zero runtime dependencies. Animates by calling `onUpdate(value)` each frame on
 * requestAnimationFrame. Callers animate ONLY transform/opacity for compositor-
 * friendly, 60fps motion.
 */

export interface SpringConfig {
  /** Overshoot. 1.0 = critically damped (no bounce). <1 bounces. Lower = bouncier. */
  damping: number;
  /** How quickly it reaches target, in seconds. Lower = snappier. NOT a duration. */
  response: number;
}

export interface SpringOptions extends Partial<SpringConfig> {
  from: number;
  to: number;
  /** Initial velocity (px/s) — hand off the pointer's release velocity here (§5). */
  velocity?: number;
  onUpdate: (value: number) => void;
  onRest?: () => void;
  /** When true, jump straight to target (reduced-motion). */
  reduce?: boolean;
}

export interface SpringController {
  /** Stop the animation immediately (keeps last presentation value). */
  cancel: () => void;
  /** Change the target mid-flight; velocity is carried through (interruptible, §3). */
  retarget: (to: number, keepVelocity?: boolean) => void;
  /** Current presentation (on-screen) value. */
  readonly value: number;
  /** Current velocity (px/s). */
  readonly velocity: number;
}

/** Apple's concrete ship values (skill §4), plus sensible house defaults. */
export const SPRINGS = {
  /** Default UI: critically damped, no overshoot. */
  default: { damping: 1.0, response: 0.4 } as SpringConfig,
  /** Move / reposition (e.g. PiP). */
  move: { damping: 1.0, response: 0.4 } as SpringConfig,
  /** Rotation. */
  rotate: { damping: 0.8, response: 0.4 } as SpringConfig,
  /** Drawer / sheet — a little bounce because the gesture carries momentum. */
  drawer: { damping: 0.8, response: 0.3 } as SpringConfig,
  /** Modal / popover scaling in from its origin. */
  modal: { damping: 0.85, response: 0.35 } as SpringConfig,
  /** Momentum landing after a flick/throw. */
  momentum: { damping: 0.8, response: 0.35 } as SpringConfig,
  /** Snappy list reflow (FLIP). */
  reflow: { damping: 0.85, response: 0.42 } as SpringConfig,
} as const;

/**
 * Momentum projection (skill §6). Given a release velocity, project the resting
 * point — exactly like scroll deceleration — so a flick "throws" the element.
 * Uses Apple's exponential-decay form, NOT the physics-textbook v²/(2·decel).
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Rubber-banding (skill §9). Progressive resistance past a boundary instead of a
 * hard stop. `overshoot` = distance past the bound, `dimension` = the surface size.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Track a short pointer history to derive release velocity (skill §5). */
export class VelocityTracker {
  private samples: { v: number; t: number }[] = [];
  add(value: number, time: number) {
    this.samples.push({ v: value, t: time });
    if (this.samples.length > 6) this.samples.shift();
  }
  reset() {
    this.samples = [];
  }
  /** px/s from the recent samples. */
  velocity(): number {
    if (this.samples.length < 2) return 0;
    const a = this.samples[0];
    const b = this.samples[this.samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.v - a.v) / dt : 0;
  }
}

/**
 * Start a spring. Semi-implicit Euler, substepped for stability. Converts Apple's
 * (dampingRatio, response) to (stiffness, damping): ω = 2π/response, k = ω², c = 2ζω.
 */
export function createSpring(options: SpringOptions): SpringController {
  const { from, to, velocity = 0, onUpdate, onRest, reduce = false } = options;
  const damping = options.damping ?? SPRINGS.default.damping;
  const response = options.response ?? SPRINGS.default.response;

  if (reduce || response <= 0) {
    onUpdate(to);
    onRest?.();
    return { cancel() {}, retarget(t) { onUpdate(t); }, value: to, velocity: 0 };
  }

  const omega = (2 * Math.PI) / response;
  const k = omega * omega;
  const c = 2 * damping * omega;

  let x = from;
  let v = velocity;
  let target = to;
  let raf = 0;
  let last: number | null = null;
  let alive = true;

  const step = (t: number) => {
    if (!alive) return;
    if (last == null) last = t;
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    const sub = 4;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = -k * (x - target) - c * v;
      v += a * h;
      x += v * h;
    }
    onUpdate(x);
    if (Math.abs(x - target) < 0.1 && Math.abs(v) < 2) {
      x = target;
      onUpdate(x);
      alive = false;
      onRest?.();
      return;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  return {
    cancel() {
      alive = false;
      cancelAnimationFrame(raf);
    },
    retarget(t: number, keepVelocity = true) {
      target = t;
      if (!keepVelocity) v = 0;
      if (!alive) {
        alive = true;
        last = null;
        raf = requestAnimationFrame(step);
      }
    },
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
  };
}
