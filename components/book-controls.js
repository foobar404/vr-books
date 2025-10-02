// A-Frame component for transforming books (move, rotate, scale)

AFRAME.registerComponent('book-controls', {
  schema: {
    enabled: { type: 'boolean', default: true }
  },

  init: function () {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onClick = this.onClick.bind(this);
    
    // Add event listeners
    window.addEventListener('keydown', this.onKeyDown);
    this.el.addEventListener('click', this.onClick);
    
    // Store original position
    this.originalPosition = this.el.getAttribute('position');
    this.isGrabbed = false;
  },

  onKeyDown: function (event) {
    if (!this.data.enabled) return;
    
    // Only handle transformation keys when the book is in transform mode
    // Use Shift + arrow keys for rotation to avoid conflict with page turning
    const position = this.el.getAttribute('position');
    const rotation = this.el.getAttribute('rotation');
    const scale = this.el.getAttribute('scale');
    
    const moveStep = 0.1;
    const rotateStep = 5;
    const scaleStep = 0.1;
    
    switch(event.key) {
      // Movement
      case 'w':
      case 'W':
        position.z -= moveStep;
        break;
      case 's':
      case 'S':
        position.z += moveStep;
        break;
      case 'a':
      case 'A':
        position.x -= moveStep;
        break;
      case 'd':
      case 'D':
        position.x += moveStep;
        break;
      case 'q':
      case 'Q':
        position.y += moveStep;
        break;
      case 'e':
      case 'E':
        position.y -= moveStep;
        break;
        
      // Rotation - only with Shift key to avoid page navigation conflict
      case 'ArrowLeft':
        if (event.shiftKey) {
          rotation.y += rotateStep;
          event.preventDefault();
        } else {
          return; // Let page-controls handle this
        }
        break;
      case 'ArrowRight':
        if (event.shiftKey) {
          rotation.y -= rotateStep;
          event.preventDefault();
        } else {
          return; // Let page-controls handle this
        }
        break;
      case 'ArrowUp':
        if (event.shiftKey) {
          rotation.x += rotateStep;
          event.preventDefault();
        } else {
          return; // Let page-controls handle this
        }
        break;
      case 'ArrowDown':
        if (event.shiftKey) {
          rotation.x -= rotateStep;
          event.preventDefault();
        } else {
          return; // Let page-controls handle this
        }
        break;
        
      // Scale
      case '+':
      case '=':
        scale.x += scaleStep;
        scale.y += scaleStep;
        scale.z += scaleStep;
        break;
      case '-':
      case '_':
        scale.x = Math.max(0.1, scale.x - scaleStep);
        scale.y = Math.max(0.1, scale.y - scaleStep);
        scale.z = Math.max(0.1, scale.z - scaleStep);
        break;
        
      // Reset
      case 'r':
      case 'R':
        this.el.setAttribute('position', this.originalPosition);
        this.el.setAttribute('rotation', { x: 0, y: 0, z: 0 });
        this.el.setAttribute('scale', { x: 1, y: 1, z: 1 });
        return;
        
      default:
        return;
    }
    
    this.el.setAttribute('position', position);
    this.el.setAttribute('rotation', rotation);
    this.el.setAttribute('scale', scale);
  },

  onClick: function (event) {
    // Toggle grab mode for VR controllers
    this.isGrabbed = !this.isGrabbed;
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    this.el.removeEventListener('click', this.onClick);
  }
});

// Component for page navigation
AFRAME.registerComponent('page-controls', {
  init: function () {
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
  },

  onKeyDown: function (event) {
    // Only handle page navigation when book is visible
    const bookElement = this.el;
    const isVisible = bookElement.getAttribute('visible');
    
    if (!isVisible) {
      return;
    }
    
    const bookDisplay = this.el.components['book-display'];
    if (!bookDisplay) {
      return;
    }
    
    switch(event.key) {
      case 'ArrowRight':
      case 'PageDown':
      case 'n':
      case 'N':
        if (!event.shiftKey && !event.ctrlKey) {
          const success = bookDisplay.nextPage();
          // Automatic chapter progression handled by book-display component
          event.preventDefault();
        }
        break;
      case 'ArrowLeft':
      case 'PageUp':
      case 'p':
      case 'P':
        if (!event.shiftKey && !event.ctrlKey) {
          const success = bookDisplay.previousPage();
          // Automatic chapter progression handled by book-display component
          event.preventDefault();
        }
        break;
        
      // Manual chapter navigation with Ctrl+Arrow or Ctrl+N/P
      case 'ArrowRight':
      case 'n':
      case 'N':
        if (event.ctrlKey) {
          window.xrBookApp?.nextChapter();
          event.preventDefault();
        }
        break;
      case 'ArrowLeft':
      case 'p':
      case 'P':
        if (event.ctrlKey) {
          window.xrBookApp?.previousChapter();
          event.preventDefault();
        }
        break;
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  }
});
