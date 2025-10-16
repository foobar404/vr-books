AFRAME.registerComponent('world-grab', {
    schema: {
        event: { type: 'string', default: 'gripdown' },   // start event
        speed: { type: 'number', default: 1.0 },          // movement multiplier
        cameraRig: { type: 'selector', default: null },        // optional rig selector
        invert: { type: 'boolean', default: true },         // drag-the-world feel
        minMove: { type: 'number', default: 0.0001 },       // ignore tiny controller jitter (m)
        maxMove: { type: 'number', default: 0.5 },          // clamp max per-frame movement (m)
        endEvent: { type: 'string', default: 'gripup' }             // optional explicit end event
    },

    init: function () {
        this.grabbing = false;
        this.lastWorldPos = new THREE.Vector3();
        this.currWorldPos = new THREE.Vector3();
        this.delta = new THREE.Vector3();
        this.lastLocalPos = new THREE.Vector3();
        this._rigWorldPos = new THREE.Vector3();

        // bind handlers once so we can add/remove the same function reference
        this._onStart = this._onStart.bind(this);
        this._onEnd = this._onEnd.bind(this);

        this._resolveRig();
        this._attach();
    },

    update: function (oldData) {
        if (oldData.event !== this.data.event || oldData.endEvent !== this.data.endEvent) {
            this._detach();
            this._attach();
        }
        if (oldData.cameraRig !== this.data.cameraRig) {
            this._resolveRig();
        }
    },

    tick: function (t, dt) {
        if (!this.grabbing || !this.rig) return;

        // Measure controller movement in rig-local coordinates (controller is a child of the rig)
        // This prevents rig motion from contaminating the measurement.
        const currLocal = this.el.object3D.position;
        this.delta.copy(currLocal).sub(this.lastLocalPos);

        // clamp tiny jitter and large jumps
        const len = this.delta.length();
        if (len < this.data.minMove) {
            this.delta.set(0, 0, 0);
        } else if (len > this.data.maxMove) {
            this.delta.multiplyScalar(this.data.maxMove / len);
        }

        // invert to 'drag world' feel if requested
        if (this.data.invert) this.delta.multiplyScalar(-1);

        // scale by speed
        this.delta.multiplyScalar(this.data.speed);

        // Convert this local delta (in rig-local frame) to a world-space displacement
        // worldFrom = rig.localToWorld(0,0,0)
        // worldTo = rig.localToWorld(delta)
        const worldFrom = new THREE.Vector3();
        const worldTo = new THREE.Vector3();
        this.rig.object3D.localToWorld(worldFrom.set(0, 0, 0));
        this.rig.object3D.localToWorld(worldTo.copy(this.delta));
        const worldDelta = worldTo.sub(worldFrom);

        // apply to rig world position
        this.rig.object3D.getWorldPosition(this._rigWorldPos);
        this._rigWorldPos.add(worldDelta);

        if (this.rig.object3D.parent) {
            const localPos = this.rig.object3D.parent.worldToLocal(this._rigWorldPos.clone());
            this.rig.object3D.position.copy(localPos);
        } else {
            this.rig.object3D.position.copy(this._rigWorldPos);
        }

        // emit per-frame event for external listeners
        this.el.emit('worldgrabmove', {
            delta: { x: this.delta.x, y: this.delta.y, z: this.delta.z },
            speed: this.data.speed
        });

        // store for next frame
        this.lastLocalPos.copy(currLocal);
    },

    remove: function () { this._detach(); },

    // --- private helpers ---
    _resolveRig: function () {
        if (this.data.cameraRig) {
            this.rig = document.querySelector(this.data.cameraRig);
            return;
        }
        // find the scene camera, then use its parent as the rig
        const cam = (document.querySelector('[camera]') || document.querySelector('a-camera'));
        this.rig = cam ? cam.parentEl : null;
        if (!this.rig) console.warn('[world-grab] No camera rig found. Pass cameraRig selector.');
    },

    _attach: function () {
        const start = this.data.event;
        const end = this.data.endEvent;
        this.el.addEventListener(start, this._onStart);

        this.el.addEventListener(end, this._onEnd);
        this.el.addEventListener('controllerdisconnected', this._onEnd);
        window.addEventListener('blur', this._onEnd);
    },

    _detach: function () {
        this.el.removeEventListener(this.data.event, this._onStart);
        this.el.removeEventListener(this.data.endEvent, this._onEnd);
        this.el.removeEventListener('controllerdisconnected', this._onEnd);
        window.removeEventListener('blur', this._onEnd);
    },

    _onStart: function () {
        if (!this.rig) return;
        this.el.object3D.getWorldPosition(this.lastWorldPos);
        // initialize local tracking to prevent contamination from rig movement
        this.lastLocalPos.copy(this.el.object3D.position);
        this.grabbing = true;
        this.el.emit('worldgrabstart', { rig: this.rig });
    },

    _onEnd: function () {
        if (!this.grabbing) return;
        this.grabbing = false;
        this.el.emit('worldgrabend', { rig: this.rig });
    }
});
