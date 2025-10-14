AFRAME.registerComponent('upload-epub', {
  schema: {
    event: { type: 'string', default: 'open-upload' },
    createButton: { type: 'boolean', default: true },
    buttonText: { type: 'string', default: 'Upload EPUB' },
    accept: { type: 'string', default: '.epub,application/epub+zip' }
  },

  init: function () {
    this._onInputChange = this._onInputChange.bind(this);
    this._onOpenEvent = this._onOpenEvent.bind(this);
    this._createdObjectURLs = [];

    // Hidden file input
    this._input = document.createElement('input');
    this._input.type = 'file';
    this._input.accept = this.data.accept;
    this._input.style.display = 'none';
    this._input.addEventListener('change', this._onInputChange);
    document.body.appendChild(this._input);

    // Optional small DOM button for desktop testing
    this._button = null;
    if (this.data.createButton) {
      this._button = document.createElement('button');
      this._button.type = 'button';
      this._button.textContent = this.data.buttonText;
      // Minimal styling to avoid heavy UI files
      Object.assign(this._button.style, {
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        zIndex: 9999,
        padding: '8px 12px',
        fontSize: '14px',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer'
      });
      this._button.addEventListener('click', () => this.open());
      document.body.appendChild(this._button);
    } else {
      // listen for the open event on the element
      this.el.addEventListener(this.data.event, this._onOpenEvent);
    }

    // expose programmatic open
    this.open = this.open.bind(this);
  },

  _onOpenEvent: function () {
    this.open();
  },

  open: function () {
    // Reset value so same file can be picked twice in a row
    this._input.value = '';
    this._input.click();
  },

  _onInputChange: function (evt) {
    const file = evt.target.files && evt.target.files[0];
    if (!file) return;

    try {
      const url = URL.createObjectURL(file);
      const assetId = `uploaded-epub-${Date.now()}`;

      const assets = this.el.sceneEl && this.el.sceneEl.querySelector && this.el.sceneEl.querySelector('a-assets');
      if (!assets) {
        console.warn('upload-epub: no <a-assets> found in scene; the uploaded asset will not be registered.');
      } else {
        const asset = document.createElement('a-asset-item');
        asset.setAttribute('id', assetId);
        asset.setAttribute('src', url);
        assets.appendChild(asset);
      }

      this._createdObjectURLs.push(url);

      // Emit event with file metadata and asset id so other components can react
      this.el.emit('epub-uploaded', {
        assetId: assetId,
        name: file.name,
        size: file.size,
        url: url,
        file: file
      }, false);
    } catch (e) {
      console.error('upload-epub: failed to register uploaded file', e);
    } finally {
      // Clear input so change will fire next time for same file
      this._input.value = '';
    }
  },

  remove: function () {
    if (this._input) {
      this._input.removeEventListener('change', this._onInputChange);
      if (this._input.parentNode) this._input.parentNode.removeChild(this._input);
      this._input = null;
    }

    if (this._button) {
      this._button.remove();
      this._button = null;
    }

    this.el.removeEventListener(this.data.event, this._onOpenEvent);

    // Revoke object URLs and remove created assets
    this._createdObjectURLs.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      // remove any matching a-asset-item that used this URL
      const assets = this.el.sceneEl && this.el.sceneEl.querySelector && this.el.sceneEl.querySelector('a-assets');
      if (!assets) return;
      const items = assets.querySelectorAll('a-asset-item');
      items.forEach(item => {
        if (item.getAttribute('src') === url) {
          if (item.parentNode) item.parentNode.removeChild(item);
        }
      });
    });
    this._createdObjectURLs = [];
  }
});
