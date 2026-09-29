// Origin hero: the chrome logo docks into the header as you scroll (D-099), plus the lazy 3D logo.
import { OmSection, gsap, afterLoadIdle, prefersReducedMotion, queueRefresh, MOBILE } from './om-cinema.js';

const DOCK_END = 0.6; // share of the hero's scroll spent flying into the header
const HANDOFF = 0.05; // crossfade to the header mark over the last bit of the flight

/** Cheap, conservative gate: WebGL only where it can hold the frame budget (D-025). */
function canAfford3D() {
  if (prefersReducedMotion()) return false;
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  return true;
}

/** Where the logo lands: the header's chrome star, else the uploaded logo image, else the logo link. */
function findDockTarget() {
  // By priority, not document order (the link is an ancestor of the mark).
  for (const selector of ['[data-om-dock-target]', 'header .header-logo__image', 'header .header-logo']) {
    const match = [...document.querySelectorAll(selector)].find((element) => element.getClientRects().length > 0);
    if (match) return match;
  }
  return null;
}

class OmHero extends OmSection {
  setup() {
    this.logo = null;
    this.progress = 0;
    this.docked = false;
    this.visible = true;
    this.stage = this.querySelector('.om-hero__stage');
    this.wrapper = this.querySelector('.om-hero__logo');
    this.vector = this.querySelector('.om-hero__vector');
    const headline = this.querySelector('.om-hero__headline');
    const cue = this.querySelector('.om-hero__cue');

    this.animate((scroller) => {
      const target = findDockTarget();

      /**
       * Transform that puts the logo exactly on the header target *once docked*: the header is
       * stuck at the top of the viewport and the sticky stage fills it, so both are measured in
       * viewport space. Function-based, recomputed on every ScrollTrigger refresh (resize, fonts).
       */
      const dock = () => {
        if (!target || !this.vector) return { x: 0, y: -this.stage.clientHeight * 0.6, scale: 0.08 };
        const targetRect = target.getBoundingClientRect();
        const header = target.closest('header');
        const headerTop = header ? header.getBoundingClientRect().top : 0;
        const stageLeft = this.stage.getBoundingClientRect().left;
        return {
          x: targetRect.left + targetRect.width / 2 - (stageLeft + this.stage.clientWidth / 2),
          y: targetRect.top - headerTop + targetRect.height / 2 - this.stage.clientHeight / 2,
          scale: targetRect.width / this.vector.offsetWidth,
        };
      };

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: this,
          scroller,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (trigger) => this.onProgress(trigger.progress),
        },
      });

      timeline
        .to(cue, { opacity: 0, duration: 0.06 }, 0)
        .to(
          this.wrapper,
          {
            x: () => dock().x,
            y: () => dock().y,
            scale: () => dock().scale,
            duration: DOCK_END,
            ease: 'power3.inOut',
          },
          0
        )
        .fromTo(headline, { letterSpacing: '-0.03em' }, { letterSpacing: '0.01em', duration: DOCK_END, ease: 'power2.out' }, 0)
        .to(this.wrapper, { opacity: 0, duration: HANDOFF }, DOCK_END - HANDOFF);

      if (target) {
        timeline.fromTo(target, { opacity: 0 }, { opacity: 1, duration: HANDOFF }, DOCK_END - HANDOFF);
      }
      timeline.set({}, {}, 1);

      return () => this.setDocked(false);
    });

    if (this.dataset.webgl === 'true' && this.querySelector('canvas') && canAfford3D()) {
      this.loadWebGL();
    }
  }

  onProgress(progress) {
    this.progress = progress;
    this.logo?.setProgress(Math.min(1, progress / DOCK_END));
    this.setDocked(progress >= DOCK_END);
  }

  /** Once docked, the header mark carries the logo: stop rendering WebGL until we scroll back. */
  setDocked(docked) {
    if (docked === this.docked) return;
    this.docked = docked;
    this.classList.toggle('is-docked', docked);
    if (docked) this.logo?.stop();
    else if (this.visible) this.logo?.start();
  }

  fitFraction() {
    const canvas = this.querySelector('canvas');
    if (!canvas || !this.vector || !canvas.clientWidth) return 0.6;
    return this.vector.offsetWidth / canvas.clientWidth;
  }

  async loadWebGL() {
    await afterLoadIdle();
    if (!this.isConnected) return;

    let createChromeLogo;
    let svgText;
    try {
      [{ createChromeLogo }, svgText] = await Promise.all([
        import('./om-chrome-logo.js'),
        fetch(this.dataset.logoSrc).then((response) => response.text()),
      ]);
    } catch (error) {
      console.warn('[om-hero] 3D logo unavailable', error);
      return;
    }
    if (!this.isConnected) return;

    try {
      this.logo = createChromeLogo(this.querySelector('canvas'), svgText, {
        mobile: window.matchMedia(MOBILE).matches,
        sparkles: Number(this.dataset.sparkles) || 0,
        tilt: Number(this.dataset.tilt) || 0,
        fit: this.fitFraction(),
        onFirstFrame: () => {
          this.classList.add('is-3d');
          queueRefresh();
        },
        onSlow: () => this.dropWebGL(),
      });
    } catch (error) {
      console.warn('[om-hero] WebGL failed, keeping the vector logo', error);
      return;
    }
    this.logo.setProgress(Math.min(1, this.progress / DOCK_END));

    // Keep the 3D mark exactly the size of the vector (and so of the header mark) on resize.
    this.fitObserver = new ResizeObserver(() => this.logo?.setFit(this.fitFraction()));
    this.fitObserver.observe(this.vector);

    // Render only while the hero is on screen and the logo hasn't docked.
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.docked) this.logo?.start();
      else this.logo?.stop();
    });
    this.visibility.observe(this);

    if (window.matchMedia('(pointer: fine)').matches) {
      this.addEventListener(
        'pointermove',
        (event) => {
          this.logo?.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
        },
        { passive: true, signal: this.abort.signal }
      );
    }
  }

  dropWebGL() {
    this.visibility?.disconnect();
    this.fitObserver?.disconnect();
    this.logo?.dispose();
    this.logo = null;
    this.classList.remove('is-3d');
  }

  teardown() {
    this.dropWebGL();
  }
}

if (!customElements.get('om-hero')) customElements.define('om-hero', OmHero);
