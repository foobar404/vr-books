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
    bookPath: { type: 'string', default: '' },
    // Optional asset id to load from <a-assets>. If present, it takes precedence over bookPath
    assetId: { type: 'string', default: '' }
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
    // Resolve book source: assetId in <a-assets> takes precedence
    let src = '';
    if (this.data.assetId) {
      const assetEl = document.getElementById(this.data.assetId);
      if (assetEl) src = assetEl.getAttribute('src') || '';
    }
    if (!src) src = this.data.bookPath || '';
    if (!src) return;

    try {
      this.epub = ePub(src);
      await this.epub.ready;

      // metadata
      try {
        const metadata = await this.epub.loaded.metadata;
        this.title = metadata.title || 'Unknown Title';
        this.author = metadata.creator || 'Unknown Author';
      } catch (e) {
        this.title = this.title || 'Unknown Title';
        this.author = this.author || 'Unknown Author';
      }

      // cover
      try {
        const cover = await this.epub.loaded.cover;
        if (cover) {
          const url = await this.epub.archive.createUrl(cover, { base64: false });
          this.coverImageUrl = url;
        }
      } catch (e) {
        // no cover
      }

      // load spine content
      const items = this.epub.spine.spineItems || [];
      const chapters = await Promise.all(items.map(async (item, i) => {
        try {
          const doc = await this.epub.load(item.href);
          // extract text
          let text = '';
          if (doc.body) text = (doc.body.textContent || '').trim();
          if (!text) text = (doc.textContent || doc.innerText || '').trim();
          text = text.replace(/\s+/g, ' ');

          // chapter title
          let chapterTitle = item.label || `Chapter ${i + 1}`;
          const tEl = doc.querySelector && doc.querySelector('h1,h2,h3,title');
          if (tEl && tEl.textContent) chapterTitle = tEl.textContent.trim();

          return { title: chapterTitle, text };
        } catch (err) {
          return { title: `Chapter ${i + 1}`, text: '' };
        }
      }));

      this.chapters = chapters;
      this.bookText = chapters.map(c => c.text).join(' ');
      this.calculateTotalPages();
      this.createBook();
      // Clamp restored page
      if (this.currentPage >= this.totalPages) this.currentPage = Math.max(0, this.totalPages - 1);
      this.createPages();
      this.savePage();
      if (this.coverImageUrl) this.updateCoverImage();
    } catch (err) {
      console.warn('Failed to load EPUB', err);
      this.title = this.title || 'Unknown Title';
      this.author = this.author || 'Unknown Author';
      this.bookText = this.bookText || '';
      this.createBook();
      // ensure saved page does not exceed total when load fails
      if (this.currentPage >= (this.totalPages || 1)) this.currentPage = Math.max(0, (this.totalPages || 1) - 1);
      this.createPages();
      this.savePage();
    }
  },

  createBook: function () {
    this.createBody();
    this.createPages();
    this.createCover();
    this.addAuthorLabel();
  },

  createBody: function () {
    const geometry = new THREE.BoxGeometry(this.bookWidth, this.bookHeight, this.bookThickness);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // right pages
      new THREE.MeshBasicMaterial({ color: 0x8B4513 }), // left pages  
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // top
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // bottom
      new THREE.MeshBasicMaterial({ color: 0xFFFFF0 }), // front
      new THREE.MeshBasicMaterial({ color: 0x8B4513 })  // back spine
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
    // Reuse existing label if present to avoid duplicates when recreating the book
    if (this.authorLabelEl) {
      this.authorLabelEl.setAttribute('value', this.author || 'Unknown');
      return;
    }

    // Try to find an existing label in case one was added outside this instance
    const existing = this.bookContainer.querySelector('[data-author-label]');
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
    if (!this.bookText) {
      this.totalPages = 1;
      return;
    }

    const words = this.bookText.split(/\s+/).filter(word => word.length > 0);

    this.totalPages = Math.max(1, Math.ceil(words.length / this.wordsPerPage));
  },

  getPageContent: function () {
    if (!this.bookText || this.bookText.length === 0) {
      return {
        title: 'Loading...',
        text: 'Loading content...'
      };
    }

    const words = this.bookText.split(/\s+/).filter(word => word.length > 0);

    if (words.length === 0) {
      return {
        title: 'Error',
        text: 'No content available.'
      };
    }

    const startWord = this.currentPage * this.wordsPerPage;
    const endWord = Math.min(startWord + this.wordsPerPage, words.length);

    const pageWords = words.slice(startWord, endWord);
    const pageText = pageWords.join(' ');

    // Find which chapter this page belongs to
    let currentChapter = 'Chapter 1';
    let wordsProcessed = 0;

    for (let i = 0; i < this.chapters.length; i++) {
      const chapterWords = this.chapters[i].text.split(/\s+/).filter(word => word.length > 0);

      if (startWord < wordsProcessed + chapterWords.length) {
        currentChapter = this.chapters[i].title;
        break;
      }
      wordsProcessed += chapterWords.length;
    }

    return {
      title: currentChapter,
      epubContent: pageText
    };
  },

  wrapText: function (ctx, text, maxWidth) {
    if (!text || typeof text !== 'string') {
      return ['No content available'];
    }

    const words = text.split(' ');
    const lines = [];
    let line = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const testLine = line + ' ' + words[i];
      if (ctx.measureText(testLine).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  setupEvents: function () {
    // Page navigation events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'b') this.nextPage();
      if (e.key === 'v') this.prevPage();
    });
    // Use joystick left/right while a controller ray is intersecting this book
    document.addEventListener('axismove', this._onAxisMove);
    document.addEventListener('thumbstickmoved', this._onAxisMove);

    // Listen for grab events to update floating animation state
    this.bookContainer.addEventListener('grab-start', (evt) => {
      this.isGrabbed = true;
    });

    this.bookContainer.addEventListener('grab-end', (evt) => {
      this.isGrabbed = false;
    });

    // Raycaster hover events (controllers will emit these when intersecting)
    // Use bookContainer because raycasters intersect the visible entity
    this.bookContainer.addEventListener('raycaster-intersected', this._onRayIntersect);
    this.bookContainer.addEventListener('raycaster-intersected-cleared', this._onRayIntersectCleared);
    // Also support cursor mouseenter/mouseleave for desktop testing
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
      const controller = evt && evt.target;
      if (!controller) return;

      // Ensure this controller's raycaster currently intersects this bookContainer
      const rc = controller.components && controller.components.raycaster;
      if (!rc) return;
      const intersected = rc.intersectedEls || rc.intersected || [];
      // intersectedEls may contain either the bookContainer or the parent element; check both
      const hit = intersected.indexOf(this.bookContainer) !== -1 || intersected.indexOf(this.el) !== -1;
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

  // Ray hover handlers
  _onRayIntersect: function (evt) {
    this.isHovered = true
  },

  _onRayIntersectCleared: function (evt) {
    // Clear hover state when ray leaves
    this.isHovered = false;
  },

  nextPage: function () {
    const maxPages = this.totalPages || 100;
    if (this.currentPage < maxPages - 1) {
      this.currentPage++;
      this.createPages();
      this.savePage();
    }
  },

  prevPage: function () {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.createPages();
      this.savePage();
    }
  },

  savePage: function () {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, String(this.currentPage));
    } catch (e) {
      // ignore storage errors
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
    try {
      window.removeEventListener('beforeunload', this._onBeforeUnload);
    } catch (e) { }
    // Clean up hover listeners
    try {
      if (this.bookContainer) {
        this.bookContainer.removeEventListener('raycaster-intersected', this._onRayIntersect);
        this.bookContainer.removeEventListener('raycaster-intersected-cleared', this._onRayIntersectCleared);
        this.bookContainer.removeEventListener('mouseenter', this._onRayIntersect);
        this.bookContainer.removeEventListener('mouseleave', this._onRayIntersectCleared);
      }
    } catch (e) { }
  }
});
