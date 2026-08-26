/**
 * @helix/motion — the HELIX in-app motion system.
 *
 * Apple "Designing Fluid Interfaces" primitives for every HELIX product's UI
 * (not marketing pages). Zero runtime deps beyond React — a self-contained spring
 * engine drives everything, so it drops into any HELIX repo (Next.js or Vite)
 * without installing framer-motion.
 *
 * Setup (once, at the app root):
 *   import '@helix/motion/tokens.css';
 *   // then set your product accent: :root { --hm-accent: <product color>; }
 */
export {
  createSpring,
  project,
  rubberband,
  SPRINGS,
  VelocityTracker,
} from './spring';
export type { SpringConfig, SpringOptions, SpringController } from './spring';

export { useMotionPreference, useReducedMotion } from './useMotionPreference';
export type { MotionPreference } from './useMotionPreference';

export { Pressable } from './Pressable';
export { Material } from './Material';
export { Scrim } from './Scrim';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';
export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';
export { CommandPalette } from './CommandPalette';
export type { CommandItem, CommandPaletteProps } from './CommandPalette';
export { useFlip } from './useFlip';
export { ResizablePanel } from './ResizablePanel';
export type { ResizablePanelProps } from './ResizablePanel';
