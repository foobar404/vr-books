// Mouse raycast component - treats mouse cursor as a raycast and clicks as triggers

AFRAME.registerComponent('mouse-raycast', {
  schema: {
    objects: { type: 'string', default: '.grabbable, .bookshelf-book, .interactive-book' },
    showLine: { type: 'boolean', default: false },
    lineColor: { type: 'color', default: '#ffffff' },
    lineOpacity: { type: 'number', default: 0.5 },
    far: { type: 'number', default: 10 }
  },

  init: function () {
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.camera = null;
    this.scene = null;
    this.intersectedObject = null;
    this.previousIntersectedObject = null;
    
    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    
    // Wait for scene to be ready
    if (this.el.sceneEl.hasLoaded) {
      this.setup();
    } else {
      this.el.sceneEl.addEventListener('loaded', () => this.setup());
    }
  },

  setup: function () {
    this.camera = this.el.getObject3D('camera');
    this.scene = this.el.sceneEl.object3D;
    
    // Add event listeners
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    
    // Create visual line if enabled
    if (this.data.showLine) {
      this.createRayLine();
    }
    
    // Create crosshair cursor
    this.createCrosshair();
    
    console.log('Mouse raycast initialized');
  },

  createCrosshair: function () {
    // Create a simple crosshair in the center of the screen
    const crosshair = document.createElement('div');
    crosshair.id = 'mouse-crosshair';
    crosshair.style.position = 'fixed';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.marginLeft = '-10px';
    crosshair.style.marginTop = '-10px';
    crosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    crosshair.style.borderRadius = '50%';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '1000';
    crosshair.style.transition = 'all 0.1s ease';
    crosshair.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    
    document.body.appendChild(crosshair);
    this.crosshair = crosshair;
  },

  createRayLine: function () {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -this.data.far)
    ]);
    
    const material = new THREE.LineBasicMaterial({
      color: this.data.lineColor,
      opacity: this.data.lineOpacity,
      transparent: true
    });
    
    this.rayLine = new THREE.Line(geometry, material);
    this.rayLine.visible = false;
    this.el.object3D.add(this.rayLine);
  },

  onMouseMove: function (event) {
    if (!this.camera) return;
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const canvas = this.el.sceneEl.canvas;
    const rect = canvas.getBoundingClientRect();
    
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycast
    this.updateRaycast();
  },

  updateRaycast: function () {
    if (!this.camera || !this.scene) return;
    
    // Set raycaster from camera through mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get target objects
    const targetObjects = this.getTargetObjects();
    
    // Perform raycast
    const intersects = this.raycaster.intersectObjects(targetObjects, true);
    
    // Handle intersection changes
    this.handleIntersectionChange(intersects);
    
    // Update visual line if enabled
    if (this.rayLine) {
      this.updateRayLine(intersects);
    }
  },

  getTargetObjects: function () {
    const selector = this.data.objects;
    const elements = document.querySelectorAll(selector);
    const objects = [];
    
    elements.forEach(el => {
      if (el.object3D) {
        // Add all mesh objects recursively
        el.object3D.traverse(child => {
          if (child.isMesh) {
            objects.push(child);
          }
        });
      }
    });
    
    return objects;
  },

  handleIntersectionChange: function (intersects) {
    const currentIntersect = intersects.length > 0 ? intersects[0] : null;
    const currentObject = currentIntersect ? currentIntersect.object : null;
    
    // Store previous for comparison
    this.previousIntersectedObject = this.intersectedObject;
    this.intersectedObject = currentObject;
    
    // Handle mouse enter/leave events
    if (this.previousIntersectedObject !== this.intersectedObject) {
      // Mouse leave previous object
      if (this.previousIntersectedObject) {
        this.emitRaycastEvent('mouseleave', this.previousIntersectedObject, null);
      }
      
      // Mouse enter new object
      if (this.intersectedObject && currentIntersect) {
        this.emitRaycastEvent('mouseenter', this.intersectedObject, currentIntersect);
        
        // Change cursor and crosshair to indicate interactivity
        document.body.style.cursor = 'pointer';
        if (this.crosshair) {
          this.crosshair.style.borderColor = '#00ff00';
          this.crosshair.style.transform = 'scale(1.2)';
        }
      } else {
        // Reset cursor and crosshair
        document.body.style.cursor = 'default';
        if (this.crosshair) {
          this.crosshair.style.borderColor = 'rgba(255, 255, 255, 0.8)';
          this.crosshair.style.transform = 'scale(1)';
        }
      }
    }
    
    // Continuous hover event
    if (this.intersectedObject && currentIntersect) {
      this.emitRaycastEvent('mousehover', this.intersectedObject, currentIntersect);
    }
  },

  updateRayLine: function (intersects) {
    if (!this.rayLine) return;
    
    if (intersects.length > 0) {
      const distance = intersects[0].distance;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -distance)
      ]);
      this.rayLine.geometry.dispose();
      this.rayLine.geometry = geometry;
      this.rayLine.material.color.setHex(0x00ff00); // Green when hitting
      this.rayLine.visible = true;
    } else {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -this.data.far)
      ]);
      this.rayLine.geometry.dispose();
      this.rayLine.geometry = geometry;
      this.rayLine.material.color.setHex(0xffffff); // White when not hitting
      this.rayLine.visible = this.data.showLine;
    }
  },

  onMouseDown: function (event) {
    if (!this.intersectedObject) return;
    
    // Find the intersection details
    const targetObjects = this.getTargetObjects();
    const intersects = this.raycaster.intersectObjects(targetObjects, true);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      this.emitRaycastEvent('triggerdown', intersection.object, intersection);
      
      // Also emit click event for compatibility
      this.emitRaycastEvent('click', intersection.object, intersection);
    }
  },

  onMouseUp: function (event) {
    if (!this.intersectedObject) return;
    
    // Find the intersection details
    const targetObjects = this.getTargetObjects();
    const intersects = this.raycaster.intersectObjects(targetObjects, true);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      this.emitRaycastEvent('triggerup', intersection.object, intersection);
    }
  },

  emitRaycastEvent: function (eventType, object, intersection) {
    // Find the A-Frame entity that owns this object
    const entity = this.findEntityFromObject(object);
    
    if (entity) {
      const detail = {
        intersection: intersection,
        cursorEl: this.el,
        target: entity
      };
      
      // Emit event on the target entity
      entity.emit(eventType, detail);
      
      // Also emit raycaster-specific events
      if (eventType === 'mouseenter') {
        entity.emit('raycaster-intersection', { els: [entity], intersection: intersection });
      } else if (eventType === 'mouseleave') {
        entity.emit('raycaster-intersection-cleared', { clearedEls: [entity] });
      }
    }
  },

  findEntityFromObject: function (object) {
    // Traverse up the object hierarchy to find the A-Frame entity
    let current = object;
    while (current) {
      if (current.el && current.el.tagName) {
        return current.el;
      }
      current = current.parent;
    }
    return null;
  },

  remove: function () {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    
    // Clean up visual line
    if (this.rayLine) {
      this.rayLine.geometry.dispose();
      this.rayLine.material.dispose();
      this.el.object3D.remove(this.rayLine);
    }
    
    // Clean up crosshair
    if (this.crosshair) {
      document.body.removeChild(this.crosshair);
    }
    
    // Reset cursor
    document.body.style.cursor = 'default';
  }
});