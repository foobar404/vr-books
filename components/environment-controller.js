AFRAME.registerComponent("environment-controller", {
    environmentElm: null,
    presets: ["default", "contact", "egypt", "checkerboard", "forest", "goaland",
        "yavapai", "goldmine", "threetowers", "poison", "arches", "tron", "japan",
        "dream", "volcano", "starry", "osiris", "moon"],
    init: function () {
        this.currentIndex = 0;
        this.environmentElm = document.createElement("a-entity");
        this.el.appendChild(this.environmentElm);

        this.environmentElm.setAttribute("environment", {
            preset: this.presets[0]
        });

        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('ybuttondown', this.cycleEnvironment.bind(this));
    },

    onKeyDown: function (event) {
        // Check if 'e' key was pressed
        if (event.key === 'c') {
            this.cycleEnvironment();
        }
    },

    cycleEnvironment: function () {
        // Move to next environment
        this.currentIndex = (this.currentIndex + 1) % this.presets.length;

        // Update the environment
        this.environmentElm.setAttribute("environment", {
            preset: this.presets[this.currentIndex]
        });
    },

    remove: function () {
        // Clean up event listeners when component is removed
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('ybuttondown', this.cycleEnvironment);
    }
})