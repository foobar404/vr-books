AFRAME.registerComponent('smooth-turn', {
    schema: {
        speedDeg: { type: 'number', default: 120 },     // deg/sec at full deflection
        deadzone: { type: 'number', default: 0.15 },
        cameraRig: { type: 'selector', default: null }
    },
    init() {
        this.x = 0; this._onThumb = e => { this.x = e.detail.x || 0 };
        this._onAxis = e => { const a = e.detail.axis || e.detail.axes || []; if (a.length) this.x = a[0] };
        this._resolveRig(); this.el.addEventListener('thumbstickmoved', this._onThumb);
        this.el.addEventListener('axismove', this._onAxis);
    },
    update() { this._resolveRig(); },
    remove() {
        this.el.removeEventListener('thumbstickmoved', this._onThumb);
        this.el.removeEventListener('axismove', this._onAxis);
    },
    tick(t, dt) {
        if (!this.rig) return;
    let x = Math.abs(this.x) < this.data.deadzone ? 0 : this.x;
    if (!x) return;
    // invert direction
    x = -x;
    const yawRad = (this.data.speedDeg * x * (dt / 1000)) * Math.PI / 180;
    this.rig.object3D.rotation.y += yawRad;
        this.el.emit('smoothturnstep', { yawDeg: this.data.speedDeg * x * (dt / 1000) });
    },
    _resolveRig() {
        if (this.data.cameraRig) { this.rig = this.data.cameraRig; return; }
        const s = this.el.sceneEl, cam = s && (s.querySelector('[camera]') || s.querySelector('a-camera'));
        this.rig = cam ? cam.parentEl : null;
    }
});