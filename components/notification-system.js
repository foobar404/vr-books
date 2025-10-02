// Notification system for displaying messages in VR

AFRAME.registerComponent('notification-system', {
  init: function () {
    this.notifications = [];
    this.createNotificationPanel();
    
    // Listen for notification events
    this.el.sceneEl.addEventListener('notification', (event) => {
      this.showNotification(event.detail.message);
    });
  },

  createNotificationPanel: function () {
    const geometry = new THREE.PlaneGeometry(1.5, 0.3);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    const texture = new THREE.CanvasTexture(canvas);
    this.texture = texture;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.5, 0);
    this.el.setObject3D('mesh', this.mesh);
    
    this.isVisible = false;
  },

  showNotification: function (message, duration = 3000) {
    // Clear canvas
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 10);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    
    this.texture.needsUpdate = true;
    
    // Fade in
    this.mesh.material.opacity = 0.9;
    this.isVisible = true;
    
    // Auto hide after duration
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    this.hideTimeout = setTimeout(() => {
      this.hideNotification();
    }, duration);
  },

  hideNotification: function () {
    this.mesh.material.opacity = 0;
    this.isVisible = false;
  }
});

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
