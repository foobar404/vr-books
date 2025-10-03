// Simple grab component for VR controllers
AFRAME.registerComponent('object-grab', {
  schema: {
    grabButton: { type: 'string', default: 'gripdown' },
    releaseButton: { type: 'string', default: 'gripup' },
    moveButton: { type: 'string', default: 'triggerdown' },
    moveReleaseButton: { type: 'string', default: 'triggerup' }
  },

  init: function() {
    this.grabbedEntity = null;
    this.originalParent = null;
    this.grabRotationOffset = new THREE.Quaternion();
    this.grabPositionOffset = new THREE.Vector3();
    this.isMovingFromCurrentPos = false;
    
    // Bind event handlers
    this.onGripDown = this.onGripDown.bind(this);
    this.onGripUp = this.onGripUp.bind(this);
    this.onTriggerDown = this.onTriggerDown.bind(this);
    this.onTriggerUp = this.onTriggerUp.bind(this);
  },

  tick: function() {
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
  },

  play: function() {
    this.el.addEventListener(this.data.grabButton, this.onGripDown);
    this.el.addEventListener(this.data.releaseButton, this.onGripUp);
    this.el.addEventListener(this.data.moveButton, this.onTriggerDown);
    this.el.addEventListener(this.data.moveReleaseButton, this.onTriggerUp);
  },

  pause: function() {
    this.el.removeEventListener(this.data.grabButton, this.onGripDown);
    this.el.removeEventListener(this.data.releaseButton, this.onGripUp);
    this.el.removeEventListener(this.data.moveButton, this.onTriggerDown);
    this.el.removeEventListener(this.data.moveReleaseButton, this.onTriggerUp);
  },

  onGripDown: function() {
    this.grabFromRaycaster(false); // Snap to origin mode
  },

  onGripUp: function() {
    this.releaseEntity();
  },

  onTriggerDown: function() {
    this.grabFromRaycaster(true); // Move from current position mode
  },

  onTriggerUp: function() {
    this.releaseEntity();
  },

  grabFromRaycaster: function(moveFromCurrentPos) {
    const raycaster = this.el.components.raycaster;
    if (!raycaster?.intersectedEls.length) return;

    // Find first grabbable entity
    for (const entity of raycaster.intersectedEls) {
      if (entity.hasAttribute('grabbable')) {
        this.grabEntity(entity, moveFromCurrentPos);
        break;
      }
    }
  },

  grabEntity: function(entity, moveFromCurrentPos = false) {
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
    console.log(moveFromCurrentPos ? 'Moving from current position:' : 'Grabbed:', entity);
  },

  releaseEntity: function() {
    if (!this.grabbedEntity) return;

    const entity = this.grabbedEntity;
    
    // Reattach to original parent
    this.originalParent.attach(entity.object3D);
    
    // Emit events
    entity.emit('grab-end', { hand: this.el });
    console.log('Released:', entity);
    
    // Reset state
    this.grabbedEntity = null;
    this.originalParent = null;
    this.isMovingFromCurrentPos = false;
    this.grabPositionOffset.set(0, 0, 0);
  }
});