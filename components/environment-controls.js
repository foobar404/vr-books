// A-Frame component for environment and lighting controls

AFRAME.registerComponent('environment-controls', {
  schema: {
    preset: { type: 'string', default: 'checkerboard' }
  },

  init: function () {
    this.presets = {
      default: {
        environment: 'default',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      forest: {
        environment: 'forest',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      egypt: {
        environment: 'egypt',
        ambientIntensity: 0.6,
        directionalIntensity: 1.0
      },
      checkerboard: {
        environment: 'checkerboard',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      goaland: {
        environment: 'goaland',
        ambientIntensity: 0.4,
        directionalIntensity: 0.9
      },
      yavapai: {
        environment: 'yavapai',
        ambientIntensity: 0.6,
        directionalIntensity: 0.8
      },
      goldmine: {
        environment: 'goldmine',
        ambientIntensity: 0.3,
        directionalIntensity: 0.6
      },
      threetowers: {
        environment: 'threetowers',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      poison: {
        environment: 'poison',
        ambientIntensity: 0.3,
        directionalIntensity: 0.5
      },
      arches: {
        environment: 'arches',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      tron: {
        environment: 'tron',
        ambientIntensity: 0.3,
        directionalIntensity: 0.4
      },
      japan: {
        environment: 'japan',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      dream: {
        environment: 'dream',
        ambientIntensity: 0.3,
        directionalIntensity: 0.5
      },
      volcano: {
        environment: 'volcano',
        ambientIntensity: 0.6,
        directionalIntensity: 0.9
      },
      starry: {
        environment: 'starry',
        ambientIntensity: 0.2,
        directionalIntensity: 0.3
      },
      osiris: {
        environment: 'osiris',
        ambientIntensity: 0.4,
        directionalIntensity: 0.6
      }
    };
    
    this.currentPreset = 'checkerboard';
    this.applyPreset(this.currentPreset);
  },

  applyPreset: function (presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;
    
    const scene = this.el.sceneEl;
    
    // Remove existing environment
    let existingEnv = scene.querySelector('[environment]');
    if (existingEnv) {
      existingEnv.parentNode.removeChild(existingEnv);
    }
    
    if (preset.environment) {
      // Use A-Frame environment component
      const envEntity = document.createElement('a-entity');
      envEntity.setAttribute('environment', {
        preset: preset.environment,
        seed: 2,
        lightPosition: { x: 0.0, y: 0.03, z: -0.5 },
        fog: 0.8
      });
      scene.appendChild(envEntity);
      
      // Hide default sky and ground
      let sky = scene.querySelector('a-sky');
      let ground = scene.querySelector('#ground');
      if (sky) sky.setAttribute('visible', false);
      if (ground) ground.setAttribute('visible', false);
      
    } else {
      // Use basic sky and ground
      let sky = scene.querySelector('a-sky');
      let ground = scene.querySelector('#ground');
      
      if (sky) {
        sky.setAttribute('visible', true);
        sky.setAttribute('color', preset.sky);
      }
      if (ground) {
        ground.setAttribute('visible', true);
        ground.setAttribute('color', preset.ground);
      }
    }
    
    // Update lights
    let ambient = scene.querySelector('#ambient-light');
    if (ambient) {
      ambient.setAttribute('intensity', preset.ambientIntensity);
    }
    
    let directional = scene.querySelector('#directional-light');
    if (directional) {
      directional.setAttribute('intensity', preset.directionalIntensity);
    }
    
    this.currentPreset = presetName;
  },

  cyclePreset: function () {
    const presetNames = Object.keys(this.presets);
    const currentIndex = presetNames.indexOf(this.currentPreset);
    const nextIndex = (currentIndex + 1) % presetNames.length;
    this.applyPreset(presetNames[nextIndex]);
    
    // Show notification
    this.el.sceneEl.emit('notification', { 
      message: `Environment: ${presetNames[nextIndex]}` 
    });
  },

  init: function () {
    this.presets = {
      default: {
        environment: 'default',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      forest: {
        environment: 'forest',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      egypt: {
        environment: 'egypt',
        ambientIntensity: 0.6,
        directionalIntensity: 1.0
      },
      checkerboard: {
        environment: 'checkerboard',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      goaland: {
        environment: 'goaland',
        ambientIntensity: 0.4,
        directionalIntensity: 0.9
      },
      yavapai: {
        environment: 'yavapai',
        ambientIntensity: 0.6,
        directionalIntensity: 0.8
      },
      goldmine: {
        environment: 'goldmine',
        ambientIntensity: 0.3,
        directionalIntensity: 0.6
      },
      threetowers: {
        environment: 'threetowers',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      poison: {
        environment: 'poison',
        ambientIntensity: 0.3,
        directionalIntensity: 0.5
      },
      arches: {
        environment: 'arches',
        ambientIntensity: 0.5,
        directionalIntensity: 0.8
      },
      tron: {
        environment: 'tron',
        ambientIntensity: 0.3,
        directionalIntensity: 0.4
      },
      japan: {
        environment: 'japan',
        ambientIntensity: 0.4,
        directionalIntensity: 0.7
      },
      dream: {
        environment: 'dream',
        ambientIntensity: 0.3,
        directionalIntensity: 0.5
      },
      volcano: {
        environment: 'volcano',
        ambientIntensity: 0.6,
        directionalIntensity: 0.9
      },
      starry: {
        environment: 'starry',
        ambientIntensity: 0.2,
        directionalIntensity: 0.3
      },
      osiris: {
        environment: 'osiris',
        ambientIntensity: 0.4,
        directionalIntensity: 0.6
      }
    };
    
    this.currentPreset = 'checkerboard';
    
    // Add keyboard event listener for B key
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    
    this.applyPreset(this.currentPreset);
  },

  onKeyDown: function (event) {
    switch(event.key) {
      case 'b':
      case 'B':
        // Cycle environment preset
        event.preventDefault();
        this.cyclePreset();
        break;
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  }
});

// Lighting control component
AFRAME.registerComponent('lighting-controls', {
  schema: {
    ambientIntensity: { type: 'number', default: 0.5 },
    directionalIntensity: { type: 'number', default: 0.8 }
  },

  init: function () {
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
  },

  onKeyDown: function (event) {
    const scene = this.el.sceneEl;
    let ambient = scene.querySelector('#ambient-light');
    let directional = scene.querySelector('#directional-light');
    
    const step = 0.1;
    
    switch(event.key) {
      case 'l':
      case 'L':
        if (event.shiftKey) {
          // Decrease ambient
          const currentAmbient = parseFloat(ambient.getAttribute('intensity'));
          ambient.setAttribute('intensity', Math.max(0, currentAmbient - step));
        } else {
          // Increase ambient
          const currentAmbient = parseFloat(ambient.getAttribute('intensity'));
          ambient.setAttribute('intensity', Math.min(2, currentAmbient + step));
        }
        break;
        
      case 'k':
      case 'K':
        if (event.shiftKey) {
          // Decrease directional
          const currentDir = parseFloat(directional.getAttribute('intensity'));
          directional.setAttribute('intensity', Math.max(0, currentDir - step));
        } else {
          // Increase directional
          const currentDir = parseFloat(directional.getAttribute('intensity'));
          directional.setAttribute('intensity', Math.min(2, currentDir + step));
        }
        break;
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  }
});
