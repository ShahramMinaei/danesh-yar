import { flushSync } from "react-dom";

const REVEAL_MS = 680;
// balanced in-out: the circle visibly leaves the switch instead of covering the screen in the first frames
const REVEAL_EASE = "cubic-bezier(.65,0,.35,1)";

/** Id of the newest transition; only it may clear `html[data-vt]` when it finishes. */
let current = 0;
/**
 * The running circle animation. It targets a view-transition pseudo-element on
 * <html>, so it must be cancelled once its transition ends — a finished
 * `fill` animation would otherwise keep applying its end clip to the NEXT
 * transition's snapshot and the new theme would cover the page at once.
 */
let revealAnim: Animation | null = null;

/**
 * Runs `update` inside a View Transition. With `reveal`, the new state spreads
 * from (x, y) as a growing circle; `reverse` instead shrinks the old state into
 * that point. Falls back to a plain synchronous update when the API is missing
 * or the user prefers reduced motion. Never rejects.
 */
export function withViewTransition(
  update: () => void,
  opts?: { reveal?: { x: number; y: number; reverse?: boolean } },
): Promise<void> {
  const html = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof document.startViewTransition !== "function" || reduce) {
    update();
    return Promise.resolve();
  }

  const reveal = opts?.reveal;
  const id = ++current;
  revealAnim?.cancel();
  revealAnim = null;
  html.dataset.vt = reveal ? (reveal.reverse ? "reverse" : "reveal") : "morph";
  if (reveal) {
    // theme.css pre-clips the incoming snapshot to a 0px circle here, so the new
    // theme never flashes full-screen for a frame before the JS animation starts
    html.style.setProperty("--vt-x", `${reveal.x}px`);
    html.style.setProperty("--vt-y", `${reveal.y}px`);
  }

  let t: ViewTransition;
  try {
    t = document.startViewTransition(() => flushSync(update));
  } catch {
    // e.g. document hidden: apply without a transition
    if (id === current) delete html.dataset.vt;
    update();
    return Promise.resolve();
  }

  if (reveal) {
    const { x, y, reverse } = reveal;
    t.ready
      .then(() => {
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const small = `circle(0px at ${x}px ${y}px)`;
        const large = `circle(${r}px at ${x}px ${y}px)`;
        revealAnim = html.animate(
          { clipPath: reverse ? [large, small] : [small, large] },
          {
            duration: REVEAL_MS,
            easing: REVEAL_EASE,
            pseudoElement: reverse ? "::view-transition-old(root)" : "::view-transition-new(root)",
            fill: "both",
          },
        );
      })
      // skipped by a newer transition: harmless
      .catch(() => {});
  }

  t.finished
    .finally(() => {
      if (id !== current) return;
      delete html.dataset.vt;
      revealAnim?.cancel();
      revealAnim = null;
    })
    .catch(() => {});
  return t.finished.catch(() => {});
}
