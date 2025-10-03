AFRAME.registerComponent('wasd-plus', {
  dependencies: ['wasd-controls'],
  
  init: function () {
    this.keys = {};
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  },

  onKeyDown: function (event) {
    this.keys[event.code] = true;
  },

  onKeyUp: function (event) {
    this.keys[event.code] = false;
  },

  tick: function (time, timeDelta) {
    const el = this.el;
    const velocity = 0.05;
    
    if (this.keys['KeyQ']) {
      el.object3D.position.y -= velocity;
    }
    if (this.keys['KeyE']) {
      el.object3D.position.y += velocity;
    }
  },

  remove: function () {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
});