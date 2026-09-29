// Origin manifesto: words light up with scroll, the brand line lands last and glints once;
// the video plays only while on screen.
import { OmSection, gsap, prefersReducedMotion } from './om-cinema.js';

class OmManifesto extends OmSection {
  setup() {
    const words = this.querySelectorAll('.om-word:not(.om-word--quote)');
    const quoteWords = this.querySelectorAll('.om-word--quote');
    const quote = this.querySelector('.om-manifesto__quote');
    const media = this.querySelector('.om-manifesto__video, .om-manifesto__image, .om-manifesto__city');
    this.video = this.querySelector('video');

    this.animate(
      (scroller) => {
        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: this,
            scroller,
            start: 'top 60%',
            end: 'bottom bottom',
            scrub: 0.6,
            onUpdate: (trigger) => {
              if (!quote) return;
              // Glint once when the line is fully lit; re-arm after scrolling well back.
              if (trigger.progress > 0.94) quote.classList.add('is-lit');
              else if (trigger.progress < 0.8) quote.classList.remove('is-lit');
            },
          },
        });
        // Manifesto over the first ~60%, then the brand line word by word, heavier.
        if (words.length) timeline.fromTo(words, { opacity: 0.16 }, { opacity: 1, stagger: 0.6 / words.length, duration: 0.08 }, 0);
        if (quoteWords.length) {
          timeline.fromTo(
            quoteWords,
            { opacity: 0.12, y: '0.25em' },
            { opacity: 1, y: 0, stagger: 0.24 / quoteWords.length, duration: 0.1, ease: 'power2.out' },
            0.64
          );
        }
        timeline.set({}, {}, 1);

        if (media) {
          gsap.fromTo(
            media,
            { scale: 1.08 },
            { scale: 1, ease: 'none', scrollTrigger: { trigger: this, scroller, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } }
          );
        }
      },
      () => {
        gsap.set([...words, ...quoteWords], { opacity: 1 });
        quote?.classList.add('is-lit');
      }
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
