AFRAME.registerComponent("vr-book", {
  bookWidth: 0.15,
  bookHeight: 0.2,
  bookThickness: 0.02,
  currentPage: 0,
  epub: null,
  bookText: '',
  chapters: [],
  wordsPerPage: 200,
  schema: {
    assetId: { type: 'string', default: '' },

  },
  init: function () {
    this.bookContainer = document.createElement('a-entity');
    this.bookContainer.classList.add('grabbable');
    this.bookContainer.setAttribute('grabbable', '');
    this.bookContainer.setAttribute('geometry', `primitive: box; width: ${this.bookWidth}; height: ${this.bookHeight}; depth: ${this.bookThickness}`);
    this.bookContainer.setAttribute('material', 'color: red; opacity: 0; transparent: true');
    this.isGrabbed = false;
    this.el.appendChild(this.bookContainer);

    // Hover state handlers
    this.isHovered = false;
    this._onRayIntersect = this._onRayIntersect.bind(this);
    this._onRayIntersectCleared = this._onRayIntersectCleared.bind(this);
    // Axis (joystick) handling for page turning
    this._onAxisMove = this._onAxisMove.bind(this);
    this._lastAxisSign = 0;
    this._lastFlipTime = 0;

    this.setupEvents();

    // Prepare storage key for persistence
    this.storageKey = null;
    if (this.data.assetId) this.storageKey = `vr-book:${this.data.assetId}`;
    else if (this.data.bookPath) this.storageKey = `vr-book:${this.data.bookPath}`;

    // Load saved page if available
    if (this.storageKey) {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved != null) {
          const n = parseInt(saved, 10);
          if (!Number.isNaN(n) && n >= 0) this.currentPage = n;
        }
      } catch (e) {
        // ignore localStorage errors
      }
    }

    this.createBook();
    this.loadEpub();

    // Save on page unload
    this._onBeforeUnload = () => this.savePage();
    window.addEventListener('beforeunload', this._onBeforeUnload);
  },

  loadEpub: async function () {
    const assetEl = this.data.assetId && document.getElementById(this.data.assetId);
    const src = (assetEl && assetEl.getAttribute('src')) || this.data.bookPath || '';
    if (!src) return;

    this.title = 'Unknown Title';
    this.author = 'Unknown Author';

    try {
      this.epub = ePub(src);
      await this.epub.ready;

      const metadata = await this.epub.loaded.metadata.catch(() => ({}));
      this.title = metadata.title || this.title;
      this.author = metadata.creator || this.author;

      const cover = await this.epub.loaded.cover.catch(() => null);
      if (cover) this.coverImageUrl = await this.epub.archive.createUrl(cover, { base64: false });

      const items = this.epub.spine.spineItems || [];
      this.chapters = await Promise.all(items.map(async (item, i) => {
        try {
          const doc = await this.epub.load(item.href);
          const text = ((doc.body?.textContent || doc.textContent || doc.innerText || '').trim()).replace(/\s+/g, ' ');
          const tEl = doc.querySelector?.('h1,h2,h3,title');
          const title = tEl?.textContent.trim() || item.label || `Chapter ${i + 1}`;
          return { title, text };
        } catch {
          return { title: `Chapter ${i + 1}`, text: '' };
        }
      }));

      this.bookText = this.chapters.map(c => c.text).join(' ');
    } catch (err) {
      console.warn('Failed to load EPUB', err);
    }

    this.calculateTotalPages();
    this.currentPage = Math.min(this.currentPage, Math.max(0, (this.totalPages || 1) - 1));
    this.createBook();
    this.createPages();
    this.savePage();
    if (this.coverImageUrl) this.updateCoverImage();
  },

  createBook: function () {
    this.createBody();
    this.createPages();
    this.createCover();
    this.addAuthorLabel();
  },

  createBody: function () {
    const geometry = new THREE.BoxGeometry(this.bookWidth, this.bookHeight, this.bookThickness);

    // Load textures from assets
    const textureLoader = new THREE.TextureLoader();

    // Book material for spine/back
    const bookNormalMap = new THREE.Texture(document.getElementById('book-fabric-normal'));
    const bookRoughnessMap = new THREE.Texture(document.getElementById('book-fabric-roughness'));
    const bookMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      normalMap: bookNormalMap,
      roughnessMap: bookRoughnessMap,
      roughness: 0.8
    });
    bookNormalMap.needsUpdate = true;
    bookRoughnessMap.needsUpdate = true;

    // Pages material for exposed paper edges
    const pagesDiffuseMap = new THREE.Texture(document.getElementById('paper-diffuse'));
    const pagesNormalMap = new THREE.Texture(document.getElementById('paper-normal'));
    const pagesRoughnessMap = new THREE.Texture(document.getElementById('paper-roughness'));
    const pagesMaterial = new THREE.MeshStandardMaterial({
      map: pagesDiffuseMap,
      normalMap: pagesNormalMap,
      roughnessMap: pagesRoughnessMap,
      roughness: 0.7
    });
    pagesDiffuseMap.needsUpdate = true;
    pagesNormalMap.needsUpdate = true;
    pagesRoughnessMap.needsUpdate = true;

    const materials = [
      pagesMaterial, // right pages (exposed edge)
      bookMaterial, // left spine with book texture
      pagesMaterial, // top (exposed edge)
      pagesMaterial, // bottom (exposed edge)
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // front (for text canvas)
      bookMaterial  // back spine with book texture
    ];
    this.bookContainer.setObject3D('body', new THREE.Mesh(geometry, materials));
  },

  createPages: function () {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const content = this.getPageContent();
    this.renderPageContent(ctx, content);
  },

  renderPageContent: function (ctx, content) {
    const canvas = ctx.canvas;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(content.title || 'Loading...', 256, 40);

    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    // Render content
    const textToRender = content.epubContent || content.text || 'Loading content...';
    const lines = this.wrapText(ctx, textToRender, 472);
    const maxLines = 25; // Increased from 20 to use more vertical space
    lines.slice(0, maxLines).forEach((line, i) => {
      ctx.fillText(line, 20, 80 + i * 18);
    });

    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${this.currentPage + 1}`, 256, 500); // Moved to very bottom

    // Update the texture
    const geometry = new THREE.PlaneGeometry(this.bookWidth * 0.9, this.bookHeight * 0.9);
    const texture = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
    mesh.position.z = this.bookThickness / 2 + 0.001;
    this.bookContainer.setObject3D('pages', mesh);
  },

  createCover: function () {
    const geometry = new THREE.BoxGeometry(this.bookWidth, this.bookHeight, 0.004);
    geometry.translate(this.bookWidth / 2, 0, 0);

    this.coverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.coverMesh = new THREE.Mesh(geometry, this.coverMaterial);
    this.coverMesh.position.set(-this.bookWidth / 2, 0, this.bookThickness / 2);
    this._hoverEnabled = false;
    this.bookContainer.setObject3D('cover', this.coverMesh);

    // Apply cover image if already loaded
    if (this.coverImageUrl) {
      this.updateCoverImage();
    }
  },

  updateCoverImage: function () {
    if (this.coverImageUrl && this.coverMaterial) {
      new THREE.TextureLoader().load(this.coverImageUrl, (texture) => {
        this.coverMaterial.map = texture;
        this.coverMaterial.needsUpdate = true;
      }, undefined, (error) => {
        console.warn('Failed to load cover texture:', error);
      });
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

  calculateTotalPages: function () {
    const words = (this.bookText || '').split(/\s+/).filter(w => w.length);
    this.totalPages = Math.max(1, Math.ceil(words.length / this.wordsPerPage));
  },

  getPageContent: function () {
    const words = (this.bookText || '').split(/\s+/).filter(w => w.length);
    if (!words.length) return { title: 'Loading...', text: 'Loading content...' };

    const startWord = this.currentPage * this.wordsPerPage;
    const endWord = Math.min(startWord + this.wordsPerPage, words.length);
    const pageText = words.slice(startWord, endWord).join(' ');

    let currentChapter = 'Chapter 1';
    let wordsProcessed = 0;
    for (const chapter of this.chapters) {
      const chapterWords = chapter.text.split(/\s+/).filter(w => w.length);
      if (startWord < wordsProcessed + chapterWords.length) {
        currentChapter = chapter.title;
        break;
      }
      wordsProcessed += chapterWords.length;
    }

    return { title: currentChapter, epubContent: pageText };
  },

  wrapText: function (ctx, text, maxWidth) {
    if (!text) return ['No content available'];
    const words = text.split(' ');
    const lines = [];
    let line = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  setupEvents: function () {
    const scene = document.querySelector('a-scene');

    document.addEventListener('keydown', (e) => {
      if (e.key === 'b') this.nextPage();
      if (e.key === 'v') this.prevPage();
    });

    scene.addEventListener('axismove', this._onAxisMove);
    scene.addEventListener('thumbstickmoved', this._onAxisMove);

    this.bookContainer.addEventListener('grab-start', () => this.isGrabbed = true);
    this.bookContainer.addEventListener('grab-end', () => this.isGrabbed = false);
    this.bookContainer.addEventListener('raycaster-intersected', this._onRayIntersect);
    this.bookContainer.addEventListener('raycaster-intersected-cleared', this._onRayIntersectCleared);
    this.bookContainer.addEventListener('mouseenter', this._onRayIntersect);
    this.bookContainer.addEventListener('mouseleave', this._onRayIntersectCleared);
  },

  // Axis handler: only flip pages when the controller that emitted the axis
  // event is currently intersecting this bookContainer
  _onAxisMove: function (evt) {
    try {
      const detail = evt && evt.detail;
      const axes = detail && (detail.axis || detail.axes) || [];
      const x = Array.isArray(axes) ? axes[0] : (axes && axes.x) || 0;

      // Try to get the controller from the event target. If not available or it has no raycaster,
      // fall back to scanning scene controllers for one whose raycaster intersects this book.
      let controller = evt && evt.target;
      let rc = controller && controller.components && controller.components.raycaster;

      let hit = false;
      if (rc) {
        const intersected = rc.intersectedEls || rc.intersected || [];
        hit = (Array.isArray(intersected) && (intersected.includes(this.bookContainer) || intersected.includes(this.el)));
      }

      if (!hit) {
        // scan all controllers in the scene that have a raycaster
        const scene = this.el.sceneEl || document.querySelector('a-scene');
        if (scene) {
          const controllers = scene.querySelectorAll('[raycaster]');
          for (const c of controllers) {
            const r = c.components && c.components.raycaster;
            if (!r) continue;
            const inter = r.intersectedEls || r.intersected || [];
            if (Array.isArray(inter) && (inter.includes(this.bookContainer) || inter.includes(this.el))) {
              controller = c;
              rc = r;
              hit = true;
              break;
            }
          }
        }
      }

      if (!hit) return;

      const now = Date.now();
      const threshold = 0.5; // require a firm left/right push
      const sign = x > threshold ? 1 : (x < -threshold ? -1 : 0);
      // Only act on a sign change (push then release then push) or after cooldown
      if (sign === 0) {
        // reset lastAxisSign when joystick returns to center
        this._lastAxisSign = 0;
        return;
      }

      if (sign !== this._lastAxisSign && (now - this._lastFlipTime) > 300) {
        if (sign > 0) {
          this.nextPage();
        } else if (sign < 0) {
          this.prevPage();
        }
        this._lastFlipTime = now;
        this._lastAxisSign = sign;
      }
    } catch (e) {
      // ignore parsing errors
    }
  },

  _onRayIntersect: function () {
    if (!this.isHovered) this._triggerHaptic({ intensity: 0.2, duration: 15 });
    this.isHovered = true;
  },
  _onRayIntersectCleared: function () { this.isHovered = false; },

  nextPage: function () {
    const maxPages = this.totalPages || 100;
    if (this.currentPage < maxPages - 1) {
      this.currentPage++;
      this.createPages();
      this.savePage();
      this._triggerHaptic({ intensity: 0.3, duration: 20 });
    }
  },

  prevPage: function () {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.createPages();
      this.savePage();
      this._triggerHaptic({ intensity: 0.3, duration: 20 });
    }
  },

  _triggerHaptic: function (options) {
    const scene = this.el.sceneEl || document.querySelector('a-scene');
    const controllers = scene?.querySelectorAll('[haptics]');
    controllers?.forEach(c => c.emit('haptic-pulse', options));
  },

  savePage: function () {
    if (this.storageKey) {
      try { localStorage.setItem(this.storageKey, String(this.currentPage)); } catch (e) { }
    }
  },

  tick: function (time) {
    if (!this.coverMesh) return;

    const closedAngle = 0;
    const openAngle = -(Math.PI / 2); // 90 degrees

    if (this.isHovered) {
      // Smoothly animate to open position over 0.5s, then add gentle oscillation
      const oscillation = Math.sin(time * 0.001) * 0.2; // Small oscillation around open position
      const target = openAngle + oscillation;
      const cur = this.coverMesh.rotation.y;
      this.coverMesh.rotation.y = THREE.MathUtils.lerp(cur, target, 0.08); // Slower lerp for 0.5s animation
    } else {
      // Smoothly close the cover back to the closedAngle
      const cur = this.coverMesh.rotation.y;
      this.coverMesh.rotation.y = THREE.MathUtils.lerp(cur, closedAngle, 0.12);
    }
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
