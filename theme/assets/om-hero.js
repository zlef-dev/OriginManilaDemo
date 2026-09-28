// Origin hero: scroll choreography + lazy 3D chrome logo.
import { OmSection, gsap, afterLoadIdle, prefersReducedMotion, queueRefresh, MOBILE } from './om-cinema.js';

/** Cheap, conservative gate: WebGL only where it can hold the frame budget (D-025). */
function canAfford3D() {
  if (prefersReducedMotion()) return false;
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  return true;
}

class OmHero extends OmSection {
  setup() {
    this.logo = null;
    this.progress = 0;
    const headline = this.querySelector('.om-hero__headline');
    const meta = this.querySelector('.om-hero__meta');
    const cue = this.querySelector('.om-hero__cue');
    const vector = this.querySelector('.om-hero__vector');
    const flash = this.querySelector('.om-flash');

    this.animate((scroller) => {
      const root = document.documentElement;
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: this,
          scroller,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
          onUpdate: (trigger) => {
            this.progress = trigger.progress;
            this.logo?.setProgress(trigger.progress);
            // Homepage-only headroom (D-032): hide the header while flying forward, show it on
            // any scroll back up. Shopping pages keep Horizon's always-visible header.
            root.classList.toggle('om-header-hidden', trigger.direction === 1 && trigger.progress > 0.04);
          },
          onLeave: () => root.classList.remove('om-header-hidden'),
          onLeaveBack: () => root.classList.remove('om-header-hidden'),
        },
      });
      timeline
        .to(cue, { opacity: 0, duration: 0.08 }, 0)
        .to(meta, { opacity: 0, y: -40, duration: 0.2 }, 0.04)
        .to(headline, { scale: 1.4, opacity: 0, duration: 0.5 }, 0.25)
        // No-WebGL fly-through: the vector logo rushes past the camera.
        .to(vector, { scale: 9, opacity: 0, duration: 0.65, ease: 'power2.in' }, 0.3)
        .to(flash, { opacity: 0.85, duration: 0.03 }, 0.93)
        .to(flash, { opacity: 0, duration: 0.04 }, 0.96)
        .set({}, {}, 1);

      return () => root.classList.remove('om-header-hidden');
    });

    if (this.dataset.webgl === 'true' && this.querySelector('canvas') && canAfford3D()) {
      this.loadWebGL();
    }
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
    this.logo.setProgress(this.progress);

    // Render only while the hero is on screen.
    this.visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) this.logo?.start();
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
    this.logo?.dispose();
    this.logo = null;
    this.classList.remove('is-3d');
  }

  teardown() {
    this.dropWebGL();
  }
}

if (!customElements.get('om-hero')) customElements.define('om-hero', OmHero);
