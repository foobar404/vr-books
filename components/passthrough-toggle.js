AFRAME.registerComponent('passthrough-toggle', {
  enabled: false,
  schema: {
    event: { type: 'string', default: 'xbuttondown' }
  },
  saves: {},
  envElm: null,
  _lastToggle: 0,
  init() {
    this.el.addEventListener(this.data.event, this.toggle.bind(this));
  },

  toggle(e) {
    const now = Date.now();
    if (now - (this._lastToggle || 0) < 500) return; // debounce 1s
    this._lastToggle = now;

    if (this.enabled) this.disable();
    else this.enable();
  },

  enable() {
    this.envElm = document.querySelector("[environment]");

    this.saves["environment"] = this.envElm.getAttribute("environment");
    this.envElm.removeAttribute("environment");

    this.enabled = true;
    this._triggerHaptic({ intensity: 0.7, duration: 40 });
  },

  disable() {
    this.envElm.setAttribute("environment", this.saves["environment"])

    this.enabled = false;
    this._triggerHaptic({ intensity: 0.5, duration: 30 });
  },

  _triggerHaptic(options) {
    const scene = this.el.sceneEl || document.querySelector('a-scene');
    const controllers = scene?.querySelectorAll('[haptics]');
    controllers?.forEach(c => c.emit('haptic-pulse', options));
  }
});
