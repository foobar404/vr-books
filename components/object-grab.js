// Simple grab component for VR controllers
AFRAME.registerComponent('object-grab', {
  schema: {
    grabButton: { type: 'string', default: 'gripdown' },
    releaseButton: { type: 'string', default: 'gripup' },
    moveButton: { type: 'string', default: 'triggerdown' },
    moveReleaseButton: { type: 'string', default: 'triggerup' },
    minDistance: { type: 'number', default: 0.05 },
    maxDistance: { type: 'number', default: 5 },
    distanceAdjustSpeed: { type: 'number', default: 1.0 },
    scaleSpeed: { type: 'number', default: 0.8 },
    minScale: { type: 'number', default: 0.05 },
    maxScale: { type: 'number', default: 5 }
  },

  init: function () {
    this.grabbedEntity = null;
    this.grabRotationOffset = new THREE.Quaternion();
    this.controllerRotationOffset = new THREE.Quaternion();
    // scaling via joystick
    this.lastAxisY = 0;
    this.scaleThreshold = 0.12; // deadzone for joystick
    this.onAxisMove = this.onAxisMove.bind(this);

    // distance control for ray-based placement
    this.grabDistance = 0.15; // meters

    // Bind event handlers
    this.onGripDown = this.onGripDown.bind(this);
    this.onGripUp = this.onGripUp.bind(this);
    this.onTriggerDown = this.onTriggerDown.bind(this);
    this.onTriggerUp = this.onTriggerUp.bind(this);
  },

  tick: function (time, timeDelta) {
    if (this.grabbedEntity) {
      const raycaster = this.el.components.raycaster?.raycaster;
      if (!raycaster) return;

      // Grab the ray's origin and direction
      const origin = raycaster.ray.origin.clone();
      const direction = raycaster.ray.direction.clone().normalize();

      // Compute point 1 unit along the ray
      const targetPos = origin.add(direction.multiplyScalar(this.grabDistance));

      // Convert to grabbedEntity's parent's local space
      this.grabbedEntity.object3D.parent.worldToLocal(targetPos);

      // Apply position
      this.grabbedEntity.object3D.position.copy(targetPos);

      // Maintain rotation (optional)
      const currentControllerQuat = new THREE.Quaternion();
      this.el.object3D.getWorldQuaternion(currentControllerQuat);

      const controllerDelta = new THREE.Quaternion();
      controllerDelta.copy(currentControllerQuat).multiply(this.controllerRotationOffset.clone().invert());

      const finalRotation = new THREE.Quaternion();
      finalRotation.multiplyQuaternions(controllerDelta, this.grabRotationOffset);
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
    this.grabFromRaycaster();
  },

  onGripUp: function () {
    this.releaseEntity();
  },

  onTriggerDown: function () {
    // Trigger: place the grabbed object slightly in front of the controller and maintain that offset
    this.grabFromRaycaster();
  },

  onTriggerUp: function () {
    this.releaseEntity();
  },

  grabFromRaycaster: function () {
    const raycaster = this.el.components.raycaster;
    if (!raycaster?.intersectedEls.length) return;

    for (const entity of raycaster.intersectedEls) {
      this.grabEntity(entity);
    }
  },

  grabEntity: function (entity) {
    if (this.grabbedEntity) return;

    this.grabbedEntity = entity;
    this.grabRotationOffset = entity.object3D.quaternion.clone();
    this.controllerRotationOffset = this.el.object3D.quaternion.clone();

    // Emit events
    entity.emit('grab-start', { hand: this.el });
    this.el.emit('haptic-pulse', { intensity: 0.5, duration: 25 });
  },

  releaseEntity: function () {
    if (!this.grabbedEntity) return;

    const entity = this.grabbedEntity;

    // Emit events
    entity.emit('grab-end', { hand: this.el });
    this.el.emit('haptic-pulse', { intensity: 0.4, duration: 20 });

    // Reset state
    this.grabbedEntity = null;
    this.grabRotationOffset.set(0, 0, 0);
    this.controllerRotationOffset.set(0, 0, 0);
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

