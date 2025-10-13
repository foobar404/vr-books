AFRAME.registerComponent('passthrough-toggle', {
  schema: {
    // Event name to listen for on this element (e.g. 'gripdown')
    event: { type: 'string', default: 'xbuttondown' }
  },

  init() {
    this._onToggle = this._onToggle.bind(this);
    this.enabled = false;

    if (this.data.event) {
      this.el.addEventListener(this.data.event, this._onToggle);
      this._listenedEvent = this.data.event;
    }
  },
  _onToggle() { this.toggle(); },

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  },

  enable() {
    const renderer = this.el.sceneEl && this.el.sceneEl.renderer;
    const canvas = renderer && renderer.domElement;
    if (canvas) {
      canvas.style.background = 'transparent';
      canvas.style.backgroundColor = 'transparent';
    }
    if (this.el && this.el.sceneEl) this.el.sceneEl.style.background = 'transparent';
    this.enabled = true;
    this.el.emit('passthrough-enabled');
  },

  disable() {
    const renderer = this.el.sceneEl && this.el.sceneEl.renderer;
    const canvas = renderer && renderer.domElement;
    if (canvas) {
      canvas.style.background = '';
      canvas.style.backgroundColor = '';
    }
    if (this.el && this.el.sceneEl) this.el.sceneEl.style.background = '';
    this.enabled = false;
    this.el.emit('passthrough-disabled');
  },

  remove() {
    if (this._listenedEvent) this.el.removeEventListener(this._listenedEvent, this._onToggle);
  }
});
