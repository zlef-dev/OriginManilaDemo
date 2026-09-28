// Origin cinema core: shared by every homepage cinema section (never loaded on shopping pages).
//
// - One GSAP + ScrollTrigger instance (assets/vendor-gsap.js).
// - OmSection: a custom-element base. Building happens in connectedCallback and everything is
//   reverted in disconnectedCallback, so the theme editor's section load/unload/reorder (which
//   replaces the DOM) cleans up for free (D-015).
// - Horizon scrolls inside .page-wrapper at ≥990px and the window below (D-080), so every
//   ScrollTrigger is created inside a gsap.matchMedia branch with the matching scroller.
// - "Pins" are CSS sticky stages; ScrollTrigger only reads progress (D-012).

import { gsap, ScrollTrigger } from './vendor-gsap.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

export const DESKTOP = '(min-width: 990px)';
export const MOBILE = '(max-width: 989px)';
export const REDUCED = '(prefers-reduced-motion: reduce)';

export const isDesignMode = () => Boolean(window.Shopify && window.Shopify.designMode);
export const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;

/** The element that actually scrolls right now (D-080). */
export function currentScroller() {
  if (window.matchMedia(DESKTOP).matches) {
    const wrapper = document.querySelector('.page-wrapper');
    if (wrapper && getComputedStyle(wrapper).overflowY !== 'visible') return wrapper;
  }
  return window;
}

let refreshQueued = false;
/** Batches ScrollTrigger.refresh() calls (fonts, images, the 3D logo) into one frame. */
export function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    ScrollTrigger.refresh();
  });
}

if (document.fonts) document.fonts.ready.then(queueRefresh);
if (document.readyState === 'complete') queueRefresh();
else window.addEventListener('load', queueRefresh, { once: true });

/** Resolves after the page has loaded and the main thread is idle (heavy work waits for this). */
export function afterLoadIdle() {
  return new Promise((resolve) => {
    const idle = () =>
      'requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 2000 }) : setTimeout(resolve, 200);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
}

export class OmSection extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController();
    this.mm = gsap.matchMedia();
    this.designMode = isDesignMode();

    this.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', queueRefresh, { once: true, signal: this.abort.signal });
    });

    try {
      this.setup();
    } catch (error) {
      // A broken scene must never break the page: fall back to the static layout.
      console.warn(`[${this.localName}]`, error);
      this.classList.add('om-static');
    }
    queueRefresh();
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.mm?.revert();
    this.teardown();
    queueRefresh();
  }

  /**
   * Registers ScrollTrigger-driven animation for desktop, mobile and reduced motion.
   * `build(scroller, conditions)` runs inside a gsap context, so everything it creates is reverted
   * automatically when the media query stops matching or the section is removed.
   * In reduced motion or the theme editor, `staticState()` runs instead.
   */
  animate(build, staticState) {
    this.mm.add({ desktop: DESKTOP, mobile: MOBILE, reduced: REDUCED }, (context) => {
      const { reduced } = context.conditions;
      if (reduced || this.designMode) {
        this.classList.add('om-static');
        staticState?.(context.conditions);
        return () => this.classList.remove('om-static');
      }
      return build(currentScroller(), context.conditions);
    });
  }

  /** Override: create listeners/triggers. */
  setup() {}

  /** Override: dispose anything not owned by gsap (WebGL, observers, timers). */
  teardown() {}
}
