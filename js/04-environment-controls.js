AFRAME.registerComponent("environment-controls", {
    init: function () {
        this.vars = {
            envIndex: 0
        };

        this.el.addEventListener("bbuttonup", this.nextEnvironment.bind(this));
        this.el.addEventListener("abuttonup", this.prevEnvironment.bind(this));
        this.el.addEventListener("ybuttonup", this.nextEnvironment.bind(this));
        this.el.addEventListener("xbuttonup", this.prevEnvironment.bind(this));
        document.body.addEventListener("keypress", ({ key }) => {
            if (key == "[") { this.prevEnvironment.call(this) }
            if (key == "]") { this.nextEnvironment.call(this) }
        })
    },
    nextEnvironment: function () {
        this.vars.envIndex += 1;
        if (this.vars.envIndex >= ENVIRONMENT_PRESETS.length) this.vars.envIndex = 0;

        document.querySelector("#env").setAttribute("environment", {
            preset: ENVIRONMENT_PRESETS[this.vars.envIndex]
        });
    },
    prevEnvironment: function () {
        this.vars.envIndex -= 1;
        if (this.vars.envIndex < 0) this.vars.envIndex = ENVIRONMENT_PRESETS.length - 1;

        document.querySelector("#env").setAttribute("environment", {
            preset: ENVIRONMENT_PRESETS[this.vars.envIndex]
        });
    }
})