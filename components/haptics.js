AFRAME.registerComponent('haptics', {
  schema: {
    intensity: {default: 0.6}, 
    duration: {default: 30}
  },

  init() {
    this.el.addEventListener('haptic-pulse', (e) => this.pulse(e.detail));
    this.el.addEventListener('haptic-burst', (e) => this.burst(e.detail));
  },

  getActuator() {
    const controller = this.el.components['tracked-controls']?.controller;
    const gamepad = controller?.gamepad;
    return gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator || null;
  },

  pulse(options = {}) {
    const actuator = this.getActuator();
    if (!actuator) return;

    const intensity = options.intensity ?? this.data.intensity;
    const duration = options.duration ?? this.data.duration;

    if (actuator.pulse) {
      actuator.pulse(intensity, duration);
    } else if (actuator.playEffect) {
      actuator.playEffect('dual-rumble', {
        duration,
        strongMagnitude: intensity,
        weakMagnitude: intensity
      });
    }
  },

  burst(options = {}) {
    const count = options.count ?? 3;
    const gap = options.gap ?? 40;
    const intensity = options.intensity ?? this.data.intensity;
    const duration = options.duration ?? this.data.duration;

    let pulseCount = 0;
    const doPulse = () => {
      if (pulseCount++ >= count) return;
      this.pulse({ intensity, duration });
      setTimeout(doPulse, gap);
    };
    doPulse();
  }
});
