AFRAME.registerComponent("environment-controller", {
    dependencies: ["environment"],
    environmentElm: null,
    presetIndex: 15,
    presets: ["default", "contact", "egypt", "checkerboard", "forest", "goaland",
        "yavapai", "goldmine", "threetowers", "poison", "arches", "tron", "japan",
        "dream", "volcano", "starry", "osiris", "moon"],
    init: function () {
        this.el.setAttribute("environment", { preset: this.presets[this.presetIndex] })

        document.addEventListener('keydown', (event) => { if (event.key === 'c') this.cycleEnvironment() });
        document.addEventListener('ybuttondown', this.cycleEnvironment.bind(this));
    },
    cycleEnvironment: function () {
        // Move to next environment
        this.presetIndex = (this.presetIndex + 1) % this.presets.length;

        // Update the environment
        this.el.setAttribute("environment", {
            preset: this.presets[this.presetIndex]
        });
    },
    remove: function () {
        // Clean up event listeners when component is removed
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('ybuttondown', this.cycleEnvironment);
    }
})