// Origin exhibit: desktop sideways procession tied to scroll; live stat counts up on arrival.
import { OmSection, gsap, queueRefresh } from './om-cinema.js';

class OmExhibit extends OmSection {
  setup() {
    const track = this.querySelector('.om-exhibit__track');
    const viewport = this.querySelector('.om-exhibit__viewport');
    const counter = this.querySelector('.om-exhibit__count');
    const claimed = Number(this.dataset.claimed) || 0;
    if (!track || !viewport) return;

    this.animate(
      (scroller, { desktop }) => {
        if (counter) {
          const state = { value: 0 };
          gsap.to(state, {
            value: claimed,
            duration: 1.2,
            ease: 'expo.out',
            onUpdate: () => (counter.textContent = Math.round(state.value)),
            scrollTrigger: { trigger: this, scroller, start: 'top 70%', once: true },
          });
        }

        if (!desktop) return;

        // Scene height = the sideways travel + one viewport, so vertical scroll maps 1:1.
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
        const setHeight = () => this.style.setProperty('--om-length-desktop', `${distance() + window.innerHeight}px`);
        setHeight();
        queueRefresh();

        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: this,
            scroller,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: setHeight,
          },
        });
        return () => this.style.removeProperty('--om-length-desktop');
      },
      () => {
        if (counter) counter.textContent = claimed;
      }
    );
  }
}

if (!customElements.get('om-exhibit')) customElements.define('om-exhibit', OmExhibit);
