AFRAME.registerComponent('loading-screen', {
  init: function () {
    let assets = document.querySelector("a-assets");

    assets.addEventListener("timeout", this.start.bind(this));
    assets.addEventListener("progress", this.start.bind(this));
  },
  start: function () {
    console.log("done!!!!!")
  }
});
