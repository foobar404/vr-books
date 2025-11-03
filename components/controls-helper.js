AFRAME.registerComponent('controls-helper', {
    schema: {
        lines: {
            type: 'array', default: [
                'Trigger: Grab / Pick',
                'Grip: Move',
                'Thumbstick: Turn Page',
                'B: Toggle Library',
                'Y: Cycle Environment',
                'X: Toggle Passthrough'
            ]
        },
        offset: { type: 'vec3', default: { x: 0, y: -0.04, z: -0.06 } },
        scale: { type: 'number', default: 0.7 }
    },

    init: function () {
        // container to hold the helper UI
        this.panel = document.createElement('a-entity');
        this.panel.setAttribute('geometry', 'primitive: plane; width: 0.09; height: 0.12');
        this.panel.setAttribute('material', 'color: #000; opacity: 0.6; shader: flat');
        this.panel.setAttribute('visible', true);
        this.el.appendChild(this.panel);

        // Add text lines
        const lineHeight = 0.03 * this.data.scale;
        let y = (this.data.lines.length - 1) * lineHeight * 0.5;
        this.textEls = [];
        this.data.lines.forEach((l, i) => {
            const t = document.createElement('a-text');
            t.setAttribute('value', l);
            t.setAttribute('align', 'center');
            t.setAttribute('color', '#fff');
            t.setAttribute('width', 0.16);
            t.setAttribute('position', `0 ${y - i * lineHeight} 0.01`);
            t.setAttribute('shader', 'msdf');
            t.object3D.scale.set(this.data.scale, this.data.scale, this.data.scale);
            this.panel.appendChild(t);
            this.textEls.push(t);
        });
    },

    update: function (oldData) {
        // support dynamic updates of lines
        if (!oldData || JSON.stringify(oldData.lines) === JSON.stringify(this.data.lines)) return;
        // remove existing
        (this.textEls || []).forEach(t => t.parentNode && t.parentNode.removeChild(t));
        this.init();
    },

    remove: function () {
        if (this.panel && this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);
    }
});
