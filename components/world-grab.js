// World grab component for VR locomotion
AFRAME.registerComponent('world-grab', {
    schema: {
        grabButton: { type: 'string', default: 'gripdown' },
        releaseButton: { type: 'string', default: 'gripup' },
        speed: { type: 'number', default: 1.7 }
    },

    init: function () {
        this.isGrabbing = false;
        this.grabStartPos = new THREE.Vector3();
        this.lastControllerPos = new THREE.Vector3();
        this.cameraRig = null;
        this.frameCount = 0;
        this.stabilizationFrames = 3; // Skip first few frames to stabilize

        // Bind event handlers
        this.onGripDown = this.onGripDown.bind(this);
        this.onGripUp = this.onGripUp.bind(this);
    },

    play: function () {
        this.el.addEventListener(this.data.grabButton, this.onGripDown);
        this.el.addEventListener(this.data.releaseButton, this.onGripUp);

        // Find camera rig
        this.cameraRig = this.el.sceneEl.querySelector('#camera-rig');
    },

    pause: function () {
        this.el.removeEventListener(this.data.grabButton, this.onGripDown);
        this.el.removeEventListener(this.data.releaseButton, this.onGripUp);
    },

    tick: function () {
        if (this.isGrabbing && this.cameraRig) {
            this.frameCount++;

            // Skip first few frames to let tracking stabilize
            if (this.frameCount <= this.stabilizationFrames) {
                this.el.object3D.getWorldPosition(this.lastControllerPos);
                return;
            }

            // Get current controller position
            const currentPos = new THREE.Vector3();
            this.el.object3D.getWorldPosition(currentPos);

            // Calculate movement delta from last frame only
            const delta = new THREE.Vector3();
            delta.copy(this.lastControllerPos).sub(currentPos);

            // Apply filtering approaches:

            // 1. Minimum movement threshold
            const deltaLength = delta.length();
            if (deltaLength < 0.005) { // 5mm minimum movement
                this.lastControllerPos.copy(currentPos);
                return;
            }

            // 2. Remove maximum clamp to allow longer movements
            // (The clamp was preventing longer movements from working)

            // 3. Apply speed multiplier to all valid movements
            delta.multiplyScalar(this.data.speed);

            // 4. Light smoothing only for very large movements
              if (deltaLength > 2.0) { // Only smooth movements over 1m
                delta.multiplyScalar(0.9); // Reduce by 10% for very large movements
              }

            // Apply movement to camera rig
            this.cameraRig.object3D.position.add(delta);

            // Update last position for next frame
            this.lastControllerPos.copy(currentPos);
        }
    },

    onGripDown: function () {
        // Check if raycaster has intersections (object interaction)
        const raycaster = this.el.components.raycaster;
        if (raycaster && raycaster.intersectedEls.length > 0) {
            // Don't world grab if there are object intersections
            return;
        }

        // Start world grab
        this.isGrabbing = true;
        this.frameCount = 0; // Reset frame counter
        this.el.object3D.getWorldPosition(this.grabStartPos);
        this.el.object3D.getWorldPosition(this.lastControllerPos);
    },

    onGripUp: function () {
        if (this.isGrabbing) {
            this.isGrabbing = false;
            this.frameCount = 0;
        }
    }
});