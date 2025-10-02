// A-Frame component for mapping VR controller inputs to keyboard/mouse actions
// This ensures all functionality works in VR

AFRAME.registerComponent('vr-controller-input', {
  schema: {
    hand: { type: 'string', default: 'right' } // left or right hand
  },

  init: function () {
    // Store reference to hand type
    this.hand = this.data.hand;
    
    // Track button states to prevent repeated events
    this.buttonStates = {
      trigger: false,
      grip: false,
      menu: false,
      xbutton: false,
      ybutton: false,
      abutton: false,
      bbutton: false,
      thumbstick: false
    };
    
    // Bind event handlers
    this.onButtonDown = this.onButtonDown.bind(this);
    this.onButtonUp = this.onButtonUp.bind(this);
    this.onThumbstickMove = this.onThumbstickMove.bind(this);
    
    // Add event listeners for controller buttons
    this.el.addEventListener('triggerdown', this.onButtonDown);
    this.el.addEventListener('triggerup', this.onButtonUp);
    this.el.addEventListener('gripdown', this.onButtonDown);
    this.el.addEventListener('gripup', this.onButtonUp);
    this.el.addEventListener('menudown', this.onButtonDown);
    this.el.addEventListener('menuup', this.onButtonUp);
    this.el.addEventListener('xbuttondown', this.onButtonDown);
    this.el.addEventListener('xbuttonup', this.onButtonUp);
    this.el.addEventListener('ybuttondown', this.onButtonDown);
    this.el.addEventListener('ybuttonup', this.onButtonUp);
    this.el.addEventListener('abuttondown', this.onButtonDown);
    this.el.addEventListener('abuttonup', this.onButtonUp);
    this.el.addEventListener('bbuttondown', this.onButtonDown);
    this.el.addEventListener('bbuttonup', this.onButtonUp);
    this.el.addEventListener('thumbstickmoved', this.onThumbstickMove);
    
  },

  onButtonDown: function (event) {
    const buttonType = event.type.replace('down', '');
    
    // Prevent repeated events
    if (this.buttonStates[buttonType]) {
      return;
    }
    this.buttonStates[buttonType] = true;
    
    // Map VR controller buttons to actions based on current context
    this.handleButtonPress(buttonType);
  },

  onButtonUp: function (event) {
    const buttonType = event.type.replace('up', '');
    this.buttonStates[buttonType] = false;
  },

  onThumbstickMove: function (event) {
    const detail = event.detail;
    const x = detail.x;
    const y = detail.y;
    
    // Only trigger on significant movement to avoid noise
    if (Math.abs(x) > 0.7 || Math.abs(y) > 0.7) {
      this.handleThumbstickMove(x, y);
    }
  },

  handleButtonPress: function (buttonType) {
    // Get current app state
    const bookshelfComponent = document.querySelector('[virtual-bookshelf]');
    const bookDisplay = document.querySelector('[book-display]');
    const isBookReading = bookDisplay && bookDisplay.getAttribute('visible') !== false && 
                         bookDisplay.getAttribute('visible') !== 'false';
    const isBookshelfVisible = bookshelfComponent && bookshelfComponent.components['virtual-bookshelf'].isVisible;
    
    // Right hand controller mappings
    if (this.hand === 'right') {
      switch (buttonType) {
        case 'trigger':
          // Primary action - Select/Activate
          if (isBookshelfVisible) {
            this.simulateKeyPress('Enter'); // Activate selected book
          } else if (isBookReading) {
            this.simulateKeyPress('ArrowRight'); // Next page
          }
          break;
          
        case 'grip':
          // Secondary action - Back/Previous
          if (isBookReading) {
            this.simulateKeyPress('ArrowLeft'); // Previous page
          } else if (isBookshelfVisible) {
            this.simulateKeyPress('Escape'); // Back action
          }
          break;
          
        case 'menu':
        case 'ybutton':
          // Menu/Toggle actions
          this.simulateKeyPress('v'); // Toggle bookshelf
          break;
          
        case 'abutton':
          // Quick action A
          if (isBookReading) {
            this.simulateKeyPress('PageDown'); // Next page (alternative)
          } else if (isBookshelfVisible) {
            this.simulateKeyPress(' '); // Space for selection
          }
          break;
          
        case 'bbutton':
          // Quick action B  
          if (isBookReading) {
            this.simulateKeyPress('PageUp'); // Previous page (alternative)
          }
          break;
          
        case 'xbutton':
          // TOC toggle for left hand, bookmark for right hand
          if (this.hand === 'left') {
            this.simulateKeyPress('t'); // Toggle Table of Contents
          } else {
            this.simulateKeyPress('b'); // Bookmark
          }
          break;
      }
    }
    
    // Left hand controller mappings (navigation focused)
    if (this.hand === 'left') {
      switch (buttonType) {
        case 'trigger':
          // Left hand trigger for alternative selection
          if (isBookshelfVisible) {
            this.simulateKeyPress(' '); // Space for activation
          }
          break;
          
        case 'grip':
          // Environment controls
          this.simulateKeyPress('e'); // Cycle environment
          break;
          
        case 'menu':
        case 'ybutton':
          // Help or secondary toggle
          this.simulateKeyPress('h'); // Help (if implemented)
          break;
          
        case 'xbutton':
          // TOC toggle for left hand, bookmark for right hand  
          if (this.hand === 'left') {
            this.simulateKeyPress('t'); // Toggle Table of Contents
          } else {
            this.simulateKeyPress('b'); // Bookmark
          }
          break;
      }
    }
  },

  handleThumbstickMove: function (x, y) {
    const bookshelfComponent = document.querySelector('[virtual-bookshelf]');
    const isBookshelfVisible = bookshelfComponent && bookshelfComponent.components['virtual-bookshelf'].isVisible;
    
    if (!isBookshelfVisible) {
      return;
    }
    
    // Thumbstick navigation for bookshelf
    if (this.hand === 'right') {
      // Debounce thumbstick input
      if (this.thumbstickTimeout) {
        return;
      }
      
      this.thumbstickTimeout = setTimeout(() => {
        this.thumbstickTimeout = null;
      }, 300); // 300ms debounce
      
      // Convert thumbstick to arrow keys
      if (Math.abs(x) > Math.abs(y)) {
        // Horizontal movement
        if (x > 0.7) {
          this.simulateKeyPress('ArrowRight');
        } else if (x < -0.7) {
          this.simulateKeyPress('ArrowLeft');
        }
      } else {
        // Vertical movement
        if (y > 0.7) {
          this.simulateKeyPress('ArrowUp');
        } else if (y < -0.7) {
          this.simulateKeyPress('ArrowDown');
        }
      }
    }
  },

  simulateKeyPress: function (key) {
    // Create and dispatch a keyboard event
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: key,
      code: `Key${key.toUpperCase()}`,
      which: key.charCodeAt(0),
      keyCode: key.charCodeAt(0),
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(keyboardEvent);
  },

  remove: function () {
    // Clean up event listeners
    this.el.removeEventListener('triggerdown', this.onButtonDown);
    this.el.removeEventListener('triggerup', this.onButtonUp);
    this.el.removeEventListener('gripdown', this.onButtonDown);
    this.el.removeEventListener('gripup', this.onButtonUp);
    this.el.removeEventListener('menudown', this.onButtonDown);
    this.el.removeEventListener('menuup', this.onButtonUp);
    this.el.removeEventListener('xbuttondown', this.onButtonDown);
    this.el.removeEventListener('xbuttonup', this.onButtonUp);
    this.el.removeEventListener('ybuttondown', this.onButtonDown);
    this.el.removeEventListener('ybuttonup', this.onButtonUp);
    this.el.removeEventListener('abuttondown', this.onButtonDown);
    this.el.removeEventListener('abuttonup', this.onButtonUp);
    this.el.removeEventListener('bbuttondown', this.onButtonDown);
    this.el.removeEventListener('bbuttonup', this.onButtonUp);
    this.el.removeEventListener('thumbstickmoved', this.onThumbstickMove);
    
    if (this.thumbstickTimeout) {
      clearTimeout(this.thumbstickTimeout);
    }
  }
});