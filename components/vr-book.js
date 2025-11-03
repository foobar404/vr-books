AFRAME.registerComponent("vr-book", {
  bookWidth: 0.15,
  bookHeight: 0.2,
  bookThickness: 0.02,
  currentPage: 1,
  epub: null,
  bookText: '',
  chapters: [],
  wordsPerPage: 200,
  schema: {
    bookPath: { type: "string", default: "" },
    active: { type: 'boolean', default: false }
  },
  init: function () {
    // Create container
    this.bookContainer = document.createElement('a-entity');
    this.bookContainer.setAttribute('grabbable', '');
    this.bookContainer.setAttribute('geometry', `primitive: box; width: ${this.bookWidth}; height: ${this.bookHeight}; depth: ${this.bookThickness}`);
    this.bookContainer.setAttribute('material', 'color: red; opacity: 0; transparent: true');
    this.el.appendChild(this.bookContainer);
    this.htmlCanvas = document.createElement("canvas");
    this.htmlCanvasContext = this.htmlCanvas.getContext("2d");
    this.outCanvas = document.createElement("canvas");
    this.outContext = this.outCanvas.getContext("2d");

    // State
    this.isGrabbed = false;
    this.isHovered = false;
    this._lastAxisSign = 0;
    this._lastFlipTime = 0;

    // Bind handlers
    this._onRayIntersect = this._onRayIntersect.bind(this);
    this._onRayIntersectCleared = this._onRayIntersectCleared.bind(this);
    this._onAxisMove = this._onAxisMove.bind(this);
    this._onBeforeUnload = () => this.savePage();

    this.setupEvents();

    // Load saved page. Use the provided bookPath (slug or path) as storage key.
    // this.storageKey = `vr-book:${this.data.bookPath}`;
    // if (this.storageKey) {
    //   const saved = localStorage.getItem(this.storageKey);
    //   const n = parseInt(saved, 10);
    //   if (!isNaN(n) && n >= 0) this.currentPage = n;
    // }

    this.createBook();
    this.loadEpub();
    window.addEventListener('beforeunload', this._onBeforeUnload);
  },

  loadEpub: async function () {
    this.title = 'Unknown Title';
    this.author = 'Unknown Author';

    try {
      let assetEl = document.getElementById(this.data.bookPath);
      this.epub = ePub(assetEl.data);
      await this.epub.ready;

      const metadata = await this.epub.loaded.metadata.catch(() => ({}));
      this.title = metadata.title || this.title;
      this.author = metadata.creator || this.author;

      const cover = await this.epub.loaded.cover.catch(() => null);
      if (cover) this.coverImageUrl = await this.epub.archive.createUrl(cover, { base64: true });

      const items = this.epub.spine.spineItems || [];
      this.sections = await Promise.all(items.map(async (item, i) => {
        const doc = await this.epub.load(item.href).catch(() => null);
        if (!doc) return { title: `Chapter ${i + 1}`, html: '' };
        const html = doc.body?.innerHTML || doc.innerHTML || '';
        const tEl = doc.querySelector?.('h1,h2,h3,title');
        const title = tEl?.textContent.trim() || item.label || `Chapter ${i + 1}`;
        return { title, html };
      }));

      this.paginateContent();
    } catch (err) {
      console.warn('Failed to load EPUB', err);
    }

    this.currentPage = Math.min(this.currentPage, Math.max(0, (this.totalPages || 1) - 1));
    this.createBook();
    this.createPages();
    this.savePage();
    if (this.coverImageUrl) this.updateCoverImage();
  },

  paginateContent: function () {
    const pageHeight = 480;
    const container = document.createElement('div');
    // container.style.cssText = 'position:absolute;left:-9999px;width:472px;font-family:serif;font-size:14px;line-height:1.5;padding:20px;';
    document.body.appendChild(container);

    this.pages = [];
    this.sections.forEach(section => {
      this.pages.push({ section: section.title, html: section.html, offset: 0, pageHeight });
    });

    document.body.removeChild(container);
    this.totalPages = this.pages.length || 1;
  },

  _loadTexture: function (id) {
    const img = document.getElementById(id);
    if (!img) return null;
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    return tex;
  },

  createBook: function () {
    this.createBody();
    this.createPages();
    this.createCover();
    this.addAuthorLabel();
  },

  createBody: function () {
    const geometry = new THREE.BoxGeometry(this.bookWidth, this.bookHeight, this.bookThickness);

    const bookMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      normalMap: this._loadTexture('book-fabric-normal'),
      roughness: 0.5
    });

    const pagesMaterial = new THREE.MeshStandardMaterial({
      map: this._loadTexture('paper-diffuse'),
      normalMap: this._loadTexture('paper-normal'),
      roughnessMap: this._loadTexture('paper-roughness'),
      roughness: 0.7
    });

    const materials = [
      pagesMaterial, // right
      bookMaterial, // left spine
      pagesMaterial, // top
      pagesMaterial, // bottom
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // front
      bookMaterial  // back
    ];
    this.bookContainer.setObject3D('body', new THREE.Mesh(geometry, materials));
  },

  createPages: async function () {
    const page = this.pages?.[this.currentPage];
    if (!page) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#000';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Loading...', 256, 256);
      this.renderCanvas(canvas);
      return;
    }

    console.log(this.currentPage);

    const container = document.createElement('div');
    // Ensure the container matches the expected page dimensions and hides overflow
    container.style.cssText = `position:absolute;left:-9999px;width:472px;height:${page.pageHeight}px;overflow:hidden;font-family:serif;font-size:14px;line-height:1.5;padding:20px;background:#fff;`;
    const content = document.createElement('div');
    content.innerHTML = page.html;

    container.appendChild(content);
    document.body.appendChild(container);

    let canvas = await html2canvas(container, {
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
    });

    this.renderCanvas(canvas);

    document.body.removeChild(container);
  },

  // Dispose previous pages mesh/material/texture
  disposePages: function () {
    const prev = this.bookContainer.getObject3D('pages');
    if (!prev) return;
    // detach from scene container
    // dispose geometry
    try {
      if (prev.geometry) prev.geometry.dispose();
      const mat = prev.material;
      if (mat) {
        if (mat.map) {
          try { mat.map.dispose(); } catch (e) { }
          mat.map = null;
        }
        try { mat.dispose(); } catch (e) { }
      }
    } catch (e) {
      console.warn('Error disposing previous page resources', e);
    }
    this.bookContainer.removeObject3D('pages');
  },

  // Backwards-compatible: if a Canvas is provided, use it as a fallback (will create CanvasTexture)
  renderCanvas: function (canvas) {
    this.disposePages();
    const geometry = new THREE.PlaneGeometry(this.bookWidth * 0.9, this.bookHeight * 0.9);
    const image = new Image();
    image.onload = () => {
      const texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      const material = new THREE.MeshStandardMaterial({ map: texture });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = this.bookThickness / 2 + 0.001;
      this.bookContainer.setObject3D('pages', mesh);
    };
    image.src = canvas.toDataURL();
  },

  createCover: function () {
    const geometry = new THREE.BoxGeometry(this.bookWidth, this.bookHeight, 0.004);
    geometry.translate(this.bookWidth / 2, 0, 0);
    this.coverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.coverMesh = new THREE.Mesh(geometry, this.coverMaterial);
    this.coverMesh.position.set(-this.bookWidth / 2, 0, this.bookThickness / 2);
    this.bookContainer.setObject3D('cover', this.coverMesh);
    // If `active` is set, keep the cover open immediately
    if (this.data && this.data.active) {
      this.coverMesh.rotation.y = -(Math.PI);
    }
    if (this.coverImageUrl) this.updateCoverImage();
  },

  update: function (oldData) {
    // Respond to schema changes (e.g., active toggled at runtime)
    if (!oldData) return;
    if (oldData.active === this.data.active) return;
    if (this.data.active) {
      if (this.coverMesh) this.coverMesh.rotation.y = -(Math.PI);
      this.isHovered = true; // treat as hovered so interactions behave consistently
    } else {
      // let hover state control closing again
      this.isHovered = false;
    }
  },

  updateCoverImage: function () {
    if (this.coverImageUrl && this.coverMaterial) {
      new THREE.TextureLoader().load(this.coverImageUrl, (texture) => {
        this.coverMaterial.map = texture;
        this.coverMaterial.needsUpdate = true;
      }, undefined, (err) => console.warn('Failed to load cover texture:', err));
    }
  },

  addAuthorLabel: function () {
    const existing = this.authorLabelEl || this.bookContainer.querySelector('[data-author-label]');
    if (existing) {
      existing.setAttribute('value', this.author || 'Unknown');
      this.authorLabelEl = existing;
      return;
    }
    const label = document.createElement('a-text');
    label.setAttribute('value', this.author || 'Unknown');
    label.setAttribute('position', `0 0 ${-this.bookThickness / 2 - 0.001}`);
    label.setAttribute('rotation', '0 180 0');
    label.setAttribute('align', 'center');
    label.setAttribute('color', '#FFF');
    label.setAttribute('width', '.2');
    label.setAttribute('data-author-label', 'true');
    this.bookContainer.appendChild(label);
    this.authorLabelEl = label;
  },

  setupEvents: function () {
    const scene = document.querySelector('a-scene');
    document.addEventListener('keydown', (e) => {
      if (e.key === 'b') this.nextPage();
      if (e.key === 'v') this.prevPage();
    });
    scene.addEventListener('axismove', this._onAxisMove);
    scene.addEventListener('thumbstickmoved', this._onAxisMove);
    this.bookContainer.addEventListener('grab-start', (e) => { this.isGrabbed = true; this.el.emit("selected") });
    this.bookContainer.addEventListener('grab-end', (e) => this.isGrabbed = false);
    this.bookContainer.addEventListener('raycaster-intersected', this._onRayIntersect);
    this.bookContainer.addEventListener('raycaster-intersected-cleared', this._onRayIntersectCleared);
    this.bookContainer.addEventListener('mouseenter', this._onRayIntersect);
    this.bookContainer.addEventListener('mouseleave', this._onRayIntersectCleared);
  },

  _onAxisMove: function (evt) {
    if (!this.isHovered) return;

    const x = evt.detail.x;
    const now = Date.now();
    const sign = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;

    if (sign === 0) {
      this._lastAxisSign = 0;
      return;
    }
    if (sign !== this._lastAxisSign && (now - this._lastFlipTime) > 300) {
      if (sign > 0) this.nextPage();
      else this.prevPage();

      this._lastFlipTime = now;
      this._lastAxisSign = sign;
    }
  },

  _onRayIntersect: function () {
    if (!this.isHovered) this._triggerHaptic({ intensity: 0.2, duration: 15 });
    this.isHovered = true;
  },

  _onRayIntersectCleared: function () {
    this.isHovered = false;
  },

  nextPage: async function () {
    if (this.currentPage < (this.totalPages || 100) - 1) {
      this.currentPage++;
      await this.createPages();
      this.savePage();
      this._triggerHaptic({ intensity: 0.3, duration: 20 });
    }
  },

  prevPage: async function () {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.createPages();
      this.savePage();
      this._triggerHaptic({ intensity: 0.3, duration: 20 });
    }
  },

  _triggerHaptic: function (options) {
    const controllers = (this.el.sceneEl || document.querySelector('a-scene'))?.querySelectorAll('[haptics]');
    controllers?.forEach(c => c.emit('haptic-pulse', options));
  },

  savePage: function () {
    if (this.storageKey) {
      try { localStorage.setItem(this.storageKey, String(this.currentPage)); } catch (e) { }
    }
  },

  tick: function (time) {
    if (!this.coverMesh) return;
    // If active is true, keep the cover fully open without oscillation.
    if (this.data && this.data.active) {
      const target = -(Math.PI);
      this.coverMesh.rotation.y = THREE.MathUtils.lerp(this.coverMesh.rotation.y, target, 0.2);
      return;
    }
    const target = this.isHovered ? -(Math.PI / 2) + Math.sin(time * 0.001) * 0.2 : 0;
    this.coverMesh.rotation.y = THREE.MathUtils.lerp(this.coverMesh.rotation.y, target, this.isHovered ? 0.08 : 0.12);
  },

  remove: function () {
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    if (this.bookContainer) {
      this.bookContainer.removeEventListener('raycaster-intersected', this._onRayIntersect);
      this.bookContainer.removeEventListener('raycaster-intersected-cleared', this._onRayIntersectCleared);
      this.bookContainer.removeEventListener('mouseenter', this._onRayIntersect);
      this.bookContainer.removeEventListener('mouseleave', this._onRayIntersectCleared);
    }
  }
});
