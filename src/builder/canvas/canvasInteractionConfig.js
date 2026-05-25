/** Canvas interaction tuning — ManyChat / n8n / Figma-style feel */

export const CANVAS_SNAP_GRID = Object.freeze([20, 20]);

/** Magnetic handle snap radius (px, flow coords scaled by zoom internally) */
export const CANVAS_CONNECTION_RADIUS = 36;

/** Smooth-step edge routing */
export const CANVAS_EDGE_BORDER_RADIUS = 18;
export const CANVAS_EDGE_OFFSET = 24;

/** Pan inertia after release */
export const CANVAS_PAN_INERTIA_FRICTION = 0.9;
export const CANVAS_PAN_INERTIA_MIN_VELOCITY = 0.06;
export const CANVAS_PAN_INERTIA_GAIN = 14;

/** Auto-connect when dropping / ending connection near a port */
export const CANVAS_AUTO_CONNECT_RADIUS = 52;

export const CANVAS_ZOOM_TRANSITION_MS = 240;
export const CANVAS_FIT_PADDING = 0.2;
export const CANVAS_FIT_MAX_ZOOM = 1.25;
