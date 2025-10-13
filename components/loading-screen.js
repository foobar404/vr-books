AFRAME.registerComponent('loading-screen', {
  // Hide or show all scene children except this loader entity
  _hideNonLoaderChildren: function (hide) {
    const sceneEl = this.el && this.el.sceneEl;
    if (!sceneEl) return;
    Array.from(sceneEl.children).forEach((child) => {
      if (child === this.el) return;
      try { child.setAttribute && child.setAttribute('visible', hide ? false : true); } catch (e) {}
    });
  },
  init() {
    // Always use the scene's a-assets element
    this.assetsEl = this.el.sceneEl && this.el.sceneEl.querySelector('a-assets');
    this.onAssetProgress = this.onAssetProgress.bind(this);
    this.onSceneLoaded = this.onSceneLoaded.bind(this);
    this.onAssetLoaded = this.onAssetLoaded.bind(this);
    this.loaded = 0;
    this.total = 0;

    // Hide the default A-Frame loader if present
    try {
      const defaultLoader = document.querySelector('.a-loader');
      if (defaultLoader) defaultLoader.style.display = 'none';
    } catch (e) {}

    // Initially show only this entity's children, hide other scene children
    this._hideNonLoaderChildren(true);
    this.show();

    if (this.assetsEl) {
      this.assetsEl.addEventListener('progress', this.onAssetProgress);
      this.assetsEl.addEventListener('assetloaded', this.onAssetLoaded);
    }
    // Scene-level events
    if (this.el && this.el.sceneEl) {
      this.el.sceneEl.addEventListener('assetprogress', this.onAssetProgress);
      this.el.sceneEl.addEventListener('loaded', this.onSceneLoaded);
    }
  },

  onAssetLoaded(evt) {
    // Some runtimes emit assetloaded per-item
    const d = evt && evt.detail || {};
    if (d && d.target) {
      this.loaded++;
      if (this.total && this.loaded <= this.total) {
        this.updateProgress(Math.round((this.loaded / this.total) * 100), this.loaded, this.total);
      }
    }
  },

  onAssetProgress(evt) {
    // evt.detail may contain { loaded, total }
    const d = evt && evt.detail || {};
    const loaded = d.loaded != null ? d.loaded : this.loaded;
    const total = d.total != null ? d.total : this.total || 0;
    if (total) {
      this.loaded = loaded;
      this.total = total;
      const pct = Math.round((loaded / total) * 100);
      this.updateProgress(pct, loaded, total);
    } else if (loaded) {
      this.loaded = loaded;
      this.updateProgress(null, this.loaded, total);
    }
  },

  onSceneLoaded() {
    this.hide();
  },

  updateProgress(pct, loaded, total) {
    // Update any child elements with class .loading-progress or data-loading-progress
    const els = this.el.querySelectorAll('.loading-progress, [data-loading-progress]');
    els.forEach((el) => {
      const text = (pct != null) ? `${pct}% (${loaded}/${total})` : `${loaded}${total ? ('/' + total) : ''}`;
      // If it's an a-text (A-Frame), set attribute 'value'
      if (el.tagName && el.tagName.toLowerCase() === 'a-text') {
        el.setAttribute('value', text);
      } else {
        el.textContent = text;
      }
    });

    // Also update HTML overlay if present
    if (this.htmlEl) {
      const h = this.htmlEl.querySelector && (this.htmlEl.querySelector('.loading-progress') || this.htmlEl.querySelector('[data-loading-progress]'));
      if (h) {
        const t = (pct != null) ? `${pct}% (${loaded}/${total})` : `${loaded}${total ? ('/' + total) : ''}`;
        h.textContent = t;
      }
    }
  },

  show() {
    // Show only this entity
    try { this.el.setAttribute('visible', true); } catch (e) {}
  },

  hide() {
    // Hide loader entity and restore scene children visibility
    try { this.el.setAttribute('visible', false); } catch (e) {}
    this._hideNonLoaderChildren(false);
  },

  remove() {
    if (this.assetsEl) {
      this.assetsEl.removeEventListener('progress', this.onAssetProgress);
      this.assetsEl.removeEventListener('assetloaded', this.onAssetLoaded);
    }
    if (this.el && this.el.sceneEl) {
      this.el.sceneEl.removeEventListener('assetprogress', this.onAssetProgress);
      this.el.sceneEl.removeEventListener('loaded', this.onSceneLoaded);
    }
    // Ensure we restore visibility of other scene children if component removed early
    this._hideNonLoaderChildren(false);
  }

});

// Helper: hide or show all scene children except this loader entity
// helper removed: component provides _hideNonLoaderChildren directly
