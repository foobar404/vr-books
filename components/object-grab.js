// Simple grab component for VR controllers
AFRAME.registerComponent('object-grab', {
  schema: {
    grabButton: { type: 'string', default: 'gripdown' },
    releaseButton: { type: 'string', default: 'gripup' },
    moveButton: { type: 'string', default: 'triggerdown' },
    moveReleaseButton: { type: 'string', default: 'triggerup' }
  },

  init: function () {
    this.grabbedEntity = null;
    this.originalParent = null;
    this.grabRotationOffset = new THREE.Quaternion();
    this.grabPositionOffset = new THREE.Vector3();
    this.isMovingFromCurrentPos = false;
    // scaling via joystick
    this.lastAxisY = 0;
    this.scaleThreshold = 0.12; // deadzone for joystick
    this.onAxisMove = this.onAxisMove.bind(this);

    // Bind event handlers
    this.onGripDown = this.onGripDown.bind(this);
    this.onGripUp = this.onGripUp.bind(this);
    this.onTriggerDown = this.onTriggerDown.bind(this);
    this.onTriggerUp = this.onTriggerUp.bind(this);
  },

  tick: function () {
    if (this.grabbedEntity) {
      const controllerPos = new THREE.Vector3();
      const controllerRot = new THREE.Quaternion();

      this.el.object3D.getWorldPosition(controllerPos);
      this.el.object3D.getWorldQuaternion(controllerRot);

      // Apply rotation offset
      const finalRotation = new THREE.Quaternion();
      finalRotation.multiplyQuaternions(controllerRot, this.grabRotationOffset);

      if (this.isMovingFromCurrentPos) {
        // Trigger mode: maintain position offset from controller
        const finalPosition = new THREE.Vector3();
        finalPosition.copy(controllerPos).add(this.grabPositionOffset);
        this.grabbedEntity.object3D.position.copy(finalPosition);
      } else {
        // Grip mode: object origin follows controller exactly
        this.grabbedEntity.object3D.position.copy(controllerPos);
      }

      this.grabbedEntity.object3D.quaternion.copy(finalRotation);
    }
    // Apply joystick scaling when an object is grabbed
    if (this.grabbedEntity && Math.abs(this.lastAxisY) > this.scaleThreshold) {
      // time-insensitive small steps; scaleSpeed tuned in schema
      const speed = this.data.scaleSpeed || 0.8;
      // axis Y: typically -1 (forward) to 1 (back); invert so pushing up increases size
      const axis = -this.lastAxisY;
      const factor = 1 + axis * speed * 0.02; // small incremental change per tick
      const s = this.grabbedEntity.object3D.scale;
      s.multiplyScalar(factor);
      // clamp
      const minS = this.data.minScale || 0.05;
      const maxS = this.data.maxScale || 5;
      s.x = Math.max(minS, Math.min(maxS, s.x));
      s.y = Math.max(minS, Math.min(maxS, s.y));
      s.z = Math.max(minS, Math.min(maxS, s.z));
    }
  },

  play: function () {
    // this.el.addEventListener(this.data.grabButton, this.onGripDown);
    // this.el.addEventListener(this.data.releaseButton, this.onGripUp);
    this.el.addEventListener(this.data.moveButton, this.onTriggerDown);
    this.el.addEventListener(this.data.moveReleaseButton, this.onTriggerUp);
    // axis events for joystick/thumbstick
    this.el.addEventListener('axismove', this.onAxisMove);
    this.el.addEventListener('thumbstickmoved', this.onAxisMove);
  },

  pause: function () {
    this.el.removeEventListener(this.data.grabButton, this.onGripDown);
    this.el.removeEventListener(this.data.releaseButton, this.onGripUp);
    this.el.removeEventListener(this.data.moveButton, this.onTriggerDown);
    this.el.removeEventListener(this.data.moveReleaseButton, this.onTriggerUp);
    this.el.removeEventListener('axismove', this.onAxisMove);
    this.el.removeEventListener('thumbstickmoved', this.onAxisMove);
  },

  onGripDown: function () {
    // Grip now acts like the old trigger: move-from-current-position mode
    this.grabFromRaycaster(true);
  },

  onGripUp: function () {
    this.releaseEntity();
  },

  onTriggerDown: function () {
    // Trigger now acts like the old grip: snap-to-controller origin mode
    this.grabFromRaycaster(false);
  },

  onTriggerUp: function () {
    this.releaseEntity();
  },

  grabFromRaycaster: function (moveFromCurrentPos) {
    const raycaster = this.el.components.raycaster;
    if (!raycaster?.intersectedEls.length) return;

    for (const entity of raycaster.intersectedEls) {
      this.grabEntity(entity, moveFromCurrentPos);
    }
  },

  grabEntity: function (entity, moveFromCurrentPos = false) {
    if (this.grabbedEntity) return;

    this.grabbedEntity = entity;
    this.originalParent = entity.object3D.parent;
    this.isMovingFromCurrentPos = moveFromCurrentPos;

    // Calculate rotation offset
    const controllerRot = new THREE.Quaternion();
    const entityRot = new THREE.Quaternion();

    this.el.object3D.getWorldQuaternion(controllerRot);
    entity.object3D.getWorldQuaternion(entityRot);

    this.grabRotationOffset.copy(entityRot).premultiply(controllerRot.invert());

    if (moveFromCurrentPos) {
      // Trigger mode: calculate position offset to maintain current position
      const controllerPos = new THREE.Vector3();
      const entityPos = new THREE.Vector3();

      this.el.object3D.getWorldPosition(controllerPos);
      entity.object3D.getWorldPosition(entityPos);

      this.grabPositionOffset.copy(entityPos).sub(controllerPos);
    } else {
      // Grip mode: no position offset (snap to controller)
      this.grabPositionOffset.set(0, 0, 0);
    }

    // Detach from parent to work in world space
    this.el.sceneEl.object3D.attach(entity.object3D);

    // Emit events
    entity.emit('grab-start', { hand: this.el });
    this.el.emit('haptic-pulse', { intensity: 0.5, duration: 25 });
    // reset axis so scaling doesn't jump
    this.lastAxisY = 0;
  },

  releaseEntity: function () {
    if (!this.grabbedEntity) return;

    const entity = this.grabbedEntity;

    // Reattach to original parent
    this.originalParent.attach(entity.object3D);

    // Emit events
    entity.emit('grab-end', { hand: this.el });
    this.el.emit('haptic-pulse', { intensity: 0.4, duration: 20 });
    console.log('Released:', entity);

    // Reset state
    this.grabbedEntity = null;
    this.originalParent = null;
    this.isMovingFromCurrentPos = false;
    this.grabPositionOffset.set(0, 0, 0);
    this.lastAxisY = 0;
  },
  onAxisMove: function (evt) {
    // event.detail.axis is usually an array [x, y]
    const d = evt && evt.detail;
    if (!d) return;
    const axis = d.axis || d.axes || d; // some events use different shapes
    const y = Array.isArray(axis) ? axis[1] : (axis && axis.y) || 0;
    // store last axis Y for tick to use
    this.lastAxisY = typeof y === 'number' ? y : 0;
  }
});