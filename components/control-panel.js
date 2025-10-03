AFRAME.registerComponent("control-panel", {
    init: function() {
        this.passthroughEnabled = false;
        document.addEventListener("xbuttondown", () => this.togglePassthrough());
        document.addEventListener("keydown", (e) => {
            if (e.key === 'x') this.togglePassthrough();
        });
    },
    
    togglePassthrough: function() {
        this.passthroughEnabled = !this.passthroughEnabled;
        this.el.sceneEl.renderer.xr.getSession()?.requestReferenceSpace('viewer')
            .then(() => {
                if (this.passthroughEnabled) {
                    this.el.sceneEl.setAttribute('background', 'color', 'transparent');
                } else {
                    this.el.sceneEl.setAttribute('background', 'color', '#000');
                }
            });
    }
});