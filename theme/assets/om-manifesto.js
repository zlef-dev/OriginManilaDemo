// Origin manifesto: words light up with scroll; the video plays only while on screen.
import { OmSection, gsap, prefersReducedMotion } from './om-cinema.js';

class OmManifesto extends OmSection {
  setup() {
    const words = this.querySelectorAll('.om-word');
    const media = this.querySelector('.om-manifesto__video, .om-manifesto__image, .om-manifesto__city');
    this.video = this.querySelector('video');

    this.animate(
      (scroller) => {
        const scrollTrigger = { trigger: this, scroller, start: 'top 60%', end: 'bottom bottom', scrub: 0.6 };
        gsap.fromTo(words, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger });
        if (media) {
          gsap.fromTo(media, { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { ...scrollTrigger, start: 'top bottom' } });
        }
      },
      () => gsap.set(words, { opacity: 1 })
    );

    if (this.video && !prefersReducedMotion()) {
      this.visibility = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) this.video.play().catch(() => {});
        else this.video.pause();
      });
      this.visibility.observe(this);
    }
  }

  teardown() {
    this.visibility?.disconnect();
    this.video?.pause();
  }
}

if (!customElements.get('om-manifesto')) customElements.define('om-manifesto', OmManifesto);
