let fire = null;

/** Confetti burst, loaded on demand and skipped for users who prefer reduced motion. */
export async function celebrate(options = {}) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!fire) {
    const { create } = await import('canvas-confetti');
    // No web worker: the default instance spawns one from a blob: URL, which the CSP (script-src 'self') blocks.
    fire = create(undefined, { resize: true, useWorker: false, disableForReducedMotion: true });
  }
  fire({ particleCount: 60, spread: 70, origin: { y: 0.3 }, ...options });
}
