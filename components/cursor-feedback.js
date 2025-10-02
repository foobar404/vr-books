// Cursor feedback component - provides visual feedback for mouse interactions

AFRAME.registerComponent('cursor-feedback', {
  init: function () {
    // Create a visual cursor that follows mouse position in 3D space
    this.createCursor();
    
    // Listen for mouse raycast events
    this.el.addEventListener('raycaster-intersection', this.onIntersection.bind(this));
    this.el.addEventListener('raycaster-intersection-cleared', this.onIntersectionCleared.bind(this));
  },

  createCursor: function () {
    // Create a small sphere that will act as the 3D cursor
    const geometry = new THREE.SphereGeometry(0.01, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.8 
    });
    
    this.cursorMesh = new THREE.Mesh(geometry, material);
    this.cursorMesh.visible = false;
    this.el.object3D.add(this.cursorMesh);
  },

  onIntersection: function (event) {
    if (!event.detail.intersection) return;
    
    // Position the cursor at the intersection point
    const point = event.detail.intersection.point;
    this.cursorMesh.position.copy(point);
    this.cursorMesh.visible = true;
    
    // Change color to indicate interaction
    this.cursorMesh.material.color.setHex(0x00ff00);
  },

  onIntersectionCleared: function (event) {
    // Hide the cursor when not intersecting
    this.cursorMesh.visible = false;
    this.cursorMesh.material.color.setHex(0xffffff);
  },

  remove: function () {
    if (this.cursorMesh) {
      this.cursorMesh.geometry.dispose();
      this.cursorMesh.material.dispose();
      this.el.object3D.remove(this.cursorMesh);
    }
  }
});