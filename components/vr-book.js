AFRAME.registerComponent("vr-book", {
  bookWidth: 0.15,
  bookHeight: 0.2,
  bookThickness: 0.02,
  currentPage: 0,
  epub: null,
  rendition: null,
  bookText: '',
  chapters: [],
  wordsPerPage: 200,
  schema: {
    bookPath: { type: 'string', default: '' },
  },
  init: function () {
    this.bookContainer = document.createElement('a-entity');
    this.bookContainer.setAttribute('class', 'grabbable');
    
    // Add grabbable attribute for simple-grab component
    this.bookContainer.setAttribute('grabbable', '');
    
    // Add geometry for raycaster detection
    this.bookContainer.setAttribute('geometry', `primitive: box; width: ${this.bookWidth}; height: ${this.bookHeight}; depth: ${this.bookThickness}`);
    this.bookContainer.setAttribute('material', 'color: red; opacity: 0; transparent: true'); // Invisible collision box
    
    // Track grab state for floating animation
    this.isGrabbed = false;
    
    this.el.appendChild(this.bookContainer);

    this.createBook();
    this.setupEvents();
    this.loadEpub();
  },

  loadEpub: function () {
    if (!this.data.bookPath) return;

    this.epub = ePub(this.data.bookPath);
    this.epub.ready.then(() => {
      
      // Get book metadata
      this.epub.loaded.metadata.then((metadata) => {
        this.title = metadata.title || 'Unknown Title';
        this.author = metadata.creator || 'Unknown Author';
      });

      // Get cover image
      this.epub.loaded.cover.then((cover) => {
        if (cover) {
          this.epub.archive.createUrl(cover, { base64: false }).then((url) => {
            this.coverImageUrl = url;
            this.updateCoverImage();
          });
        }
      }).catch(() => {
        console.log('No cover image found');
      });

      // Get all book content for proper pagination
      const loadPromises = this.epub.spine.spineItems.map((item, index) => {
        return this.epub.load(item.href).then((doc) => {
          // Try multiple methods to extract text content
          let text = '';
          if (doc.textContent) {
            text = doc.textContent;
          } else if (doc.innerText) {
            text = doc.innerText;
          } else if (doc.body && doc.body.textContent) {
            text = doc.body.textContent;
          } else {
            // Fallback: get text from all text nodes
            const walker = document.createTreeWalker(
              doc.body || doc,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            let node;
            const textParts = [];
            while (node = walker.nextNode()) {
              if (node.textContent.trim()) {
                textParts.push(node.textContent.trim());
              }
            }
            text = textParts.join(' ');
          }

          // Clean up the text
          text = text.replace(/\s+/g, ' ').trim();

          // Try to extract chapter title
          let chapterTitle = item.label || `Chapter ${index + 1}`;

          // Look for title in the document
          const titleElements = doc.querySelectorAll('h1, h2, h3, title');
          if (titleElements.length > 0) {
            const titleText = titleElements[0].textContent.trim();
            if (titleText && titleText.length < 100) {
              chapterTitle = titleText;
            }
          }

          return { title: chapterTitle, text: text };
        }).catch(() => {
          console.warn('Failed to load chapter:', item.href);
          return { title: `Chapter ${index + 1}`, text: '' };
        });
      });

      Promise.all(loadPromises).then((chapters) => {
        this.chapters = chapters;
        this.bookText = chapters.map(ch => ch.text).join(' ');
        this.calculateTotalPages();
        this.createBook(); // Recreate with proper content
        // Reapply cover image after recreation
        if (this.coverImageUrl) {
          this.updateCoverImage();
        }
      }).catch((error) => {
        console.error('Error loading book content:', error);
        this.bookText = 'Failed to load book content.';
        this.createBook();
      });
    }).catch((error) => {
      console.warn('Failed to load EPUB:', error);
      this.title = 'Unknown Title';
      this.author = 'Unknown Author';
      this.createBook();
    });
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

    // Get content and handle async loading
    const content = this.getPageContent();

    if (content && content.then) {
      // Handle async EPUB content
      content.then((resolvedContent) => {
        this.renderPageContent(ctx, resolvedContent);
      }).catch(() => {
        this.renderPageContent(ctx, { title: this.title || 'Error', text: 'Failed to load content' });
      });
    } else {
      // Handle synchronous content
      this.renderPageContent(ctx, content);
    }
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
    this.coverMesh.rotation.y = -Math.PI / 2;
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
    document.addEventListener('abuttondown', () => this.prevPage());
    document.addEventListener('bbuttondown', () => this.nextPage());
    
    // Listen for grab events to update floating animation state
    this.bookContainer.addEventListener('grab-start', (evt) => {
      this.isGrabbed = true;
    });
    
    this.bookContainer.addEventListener('grab-end', (evt) => {
      this.isGrabbed = false;
    });
  },

  nextPage: function () {
    const maxPages = this.totalPages || 100;
    if (this.currentPage < maxPages - 1) {
      this.currentPage++;
      this.createPages();
    }
  },

  prevPage: function () {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.createPages();
    }
  },

  tick: function (time) {
    if (this.coverMesh) {
      // this.coverMesh.rotation.y = -Math.PI / 2 + Math.sin(time * 0.001) * Math.PI / 6;
    }
    // Note: Super-hands handles the movement automatically, no manual position updates needed
  }
});