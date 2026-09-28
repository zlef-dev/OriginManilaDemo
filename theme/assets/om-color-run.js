// Origin color run: scroll progress picks the active colorway; the stage takes its color.
import { OmSection, ScrollTrigger } from './om-cinema.js';

class OmColorRun extends OmSection {
  setup() {
    this.slides = [...this.querySelectorAll('.om-color-run__slide')];
    this.dots = [...this.querySelectorAll('.om-color-run__dot')];
    this.active = 0;
    if (this.slides.length === 0) return;

    this.animate((scroller) => {
      ScrollTrigger.create({
        trigger: this,
        scroller,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (trigger) => {
          const index = Math.min(this.slides.length - 1, Math.floor(trigger.progress * this.slides.length));
          this.show(index);
        },
      });
      this.show(0);
    });

    // Theme editor: selecting a block shows that colorway.
    document.addEventListener(
      'shopify:block:select',
      (event) => {
        const index = this.slides.findIndex((slide) => slide.contains(event.target) || slide === event.target);
        if (index >= 0) this.show(index);
      },
      { signal: this.abort.signal }
    );
  }

  show(index) {
    if (index === this.active && this.style.getPropertyValue('--om-run-ink')) return;
    this.active = index;
    this.slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    const slide = this.slides[index];
    this.style.setProperty('--om-run-bg', slide.dataset.color);
    this.style.setProperty('--om-run-ink', slide.dataset.ink);
  }
}

if (!customElements.get('om-color-run')) customElements.define('om-color-run', OmColorRun);
