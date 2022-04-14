AFRAME.registerComponent("multi-material", {
    schema: {
        srcs: { type: "array", default: [] }
    },
    update: function () {
        let sides = this.el.getObject3D('mesh').geometry.groups.length;
        let materials = []
        for (let i = 0; i < sides; i++) {
            materials.push(new THREE.MeshStandardMaterial());

            if (this.data[`src${i}`]) this.data.srcs[i] = this.data[`src${i}`];
        }

        this.data.srcs.forEach((src, i) => {
            let asset = src.includes("/") ? src : document.querySelector(src)?.src;
            let material = materials[i];
            let loader = new THREE.TextureLoader();
            material.map = loader.load(asset);
            material.needsUpdate = true;
        });

        this.el.getObject3D('mesh').material = materials;
    }
})