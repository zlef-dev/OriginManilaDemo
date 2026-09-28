// Origin drop countdown: ticks every second, flips to "shop the drop" at T-0 without a reload.
// Standalone (no GSAP) so the password page can use it too.

class OmDrop extends HTMLElement {
  connectedCallback() {
    this.target = Number(this.dataset.target) * 1000;
    if (!this.target || this.dataset.state !== 'countdown') return;
    this.values = Object.fromEntries(
      [...this.querySelectorAll('[data-unit]')].map((element) => [element.dataset.unit, element])
    );
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
  }

  tick() {
    const remaining = this.target - Date.now();
    if (remaining <= 0) {
      this.flip();
      return;
    }
    const seconds = Math.floor(remaining / 1000);
    const parts = {
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    };
    for (const [unit, value] of Object.entries(parts)) {
      const text = String(value).padStart(2, '0');
      if (this.values[unit] && this.values[unit].textContent !== text) this.values[unit].textContent = text;
    }
  }

  flip() {
    window.clearInterval(this.timer);
    this.dataset.state = 'live';
    this.querySelector('.om-drop__before')?.setAttribute('hidden', '');
    this.querySelector('.om-drop__after')?.removeAttribute('hidden');
    this.querySelector('.om-drop__form')?.setAttribute('hidden', '');
    this.querySelector('.om-drop__fine')?.setAttribute('hidden', '');
    this.classList.add('is-flipping');
  }
}

if (!customElements.get('om-drop')) customElements.define('om-drop', OmDrop);
