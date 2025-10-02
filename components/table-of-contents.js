// Table of Contents component for VR book reader

AFRAME.registerComponent('table-of-contents', {
  schema: {
    visible: { type: 'boolean', default: false },
    currentChapter: { type: 'number', default: 0 }
  },

  init: function () {
    this.chapters = [];
    this.selectedIndex = 0;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.maxVisibleChapters = 8;
    this.scrollOffset = 0;
    
    window.addEventListener('keydown', this.onKeyDown);
    
    // Create UI panel
    this.createPanel();
    
    // Listen for VR controller input
    this.el.addEventListener('gripdown', this.handleVRInput.bind(this));
    this.el.addEventListener('trackpaddown', this.handleVRInput.bind(this));
    this.el.classList.add('interactive-book');
  },

  createPanel: function () {
    // Create a smaller plane for the TOC UI
    const geometry = new THREE.PlaneGeometry(1.2, 1.8);
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 576;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    const texture = new THREE.CanvasTexture(canvas);
    this.texture = texture;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = this.data.visible;
    this.el.setObject3D('mesh', this.mesh);
    
    this.render();
  },

  setChapters: function (chapters) {
    this.chapters = chapters.map((chapter, index) => ({
      title: chapter.title || `Chapter ${index + 1}`,
      index: index
    }));
    this.selectedIndex = Math.min(this.selectedIndex, this.chapters.length - 1);
    this.render();
  },

  setCurrentChapter: function (chapterIndex) {
    this.data.currentChapter = chapterIndex;
    this.selectedIndex = chapterIndex;
    this.updateScrollOffset();
    this.render();
  },

  updateScrollOffset: function () {
    // Keep selected chapter visible
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.maxVisibleChapters) {
      this.scrollOffset = this.selectedIndex - this.maxVisibleChapters + 1;
    }
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.chapters.length - this.maxVisibleChapters));
  },

  render: function () {
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    
    // Draw header
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Table of Contents', canvas.width / 2, 32);
    
    // Draw chapters
    const itemHeight = 60;
    const startY = 60;
    
    for (let i = 0; i < this.maxVisibleChapters && i + this.scrollOffset < this.chapters.length; i++) {
      const chapterIndex = i + this.scrollOffset;
      const chapter = this.chapters[chapterIndex];
      const y = startY + i * itemHeight;
      
      // Highlight selection
      if (chapterIndex === this.selectedIndex) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(5, y, canvas.width - 10, itemHeight - 5);
      }
      
      // Highlight current chapter
      if (chapterIndex === this.data.currentChapter) {
        ctx.strokeStyle = '#FFC107';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, y, canvas.width - 10, itemHeight - 5);
      }
      
      // Chapter number
      ctx.fillStyle = chapterIndex === this.selectedIndex ? '#fff' : '#bbb';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${chapterIndex + 1}.`, 15, y + 20);
      
      // Chapter title
      ctx.fillStyle = chapterIndex === this.selectedIndex ? '#fff' : '#ddd';
      ctx.font = '12px Arial';
      
      // Truncate long titles
      let title = chapter.title;
      const maxWidth = canvas.width - 80;
      let truncated = false;
      
      while (ctx.measureText(title).width > maxWidth && title.length > 3) {
        title = title.substring(0, title.length - 4) + '...';
        truncated = true;
      }
      
      ctx.fillText(title, 50, y + 20);
      
      // Show page indicator if it's current chapter
      if (chapterIndex === this.data.currentChapter) {
        ctx.fillStyle = '#FFC107';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('READING', canvas.width - 15, y + 45);
      }
    }
    
    // Draw scroll indicators
    if (this.scrollOffset > 0) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▲ More above', canvas.width / 2, 75);
    }
    
    if (this.scrollOffset + this.maxVisibleChapters < this.chapters.length) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▼ More below', canvas.width / 2, canvas.height - 15);
    }
    
    // Draw instructions
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow keys to navigate • Enter to select • T to toggle', canvas.width / 2, canvas.height - 5);
    
    this.texture.needsUpdate = true;
  },

  onKeyDown: function (event) {
    if (!this.data.visible) return;
    
    switch (event.code) {
      case 'ArrowUp':
        event.preventDefault();
        this.navigate(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigate(1);
        break;
      case 'Enter':
        event.preventDefault();
        this.selectChapter();
        break;
      case 'KeyT':
        event.preventDefault();
        this.toggle();
        break;
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;
    }
  },

  navigate: function (direction) {
    if (this.chapters.length === 0) return;
    
    this.selectedIndex += direction;
    
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.chapters.length - 1;
      this.scrollOffset = Math.max(0, this.chapters.length - this.maxVisibleChapters);
    } else if (this.selectedIndex >= this.chapters.length) {
      this.selectedIndex = 0;
      this.scrollOffset = 0;
    } else {
      this.updateScrollOffset();
    }
    
    this.render();
  },

  selectChapter: function () {
    if (this.chapters.length === 0) return;
    
    const selectedChapter = this.chapters[this.selectedIndex];
    
    // Emit event to change chapter
    this.el.emit('chapter-selected', {
      chapterIndex: selectedChapter.index,
      chapterTitle: selectedChapter.title
    });
    
    // Hide TOC after selection
    this.hide();
  },

  show: function () {
    this.data.visible = true;
    this.mesh.visible = true;
    this.selectedIndex = this.data.currentChapter;
    this.updateScrollOffset();
    this.render();
  },

  hide: function () {
    this.data.visible = false;
    this.mesh.visible = false;
  },

  toggle: function () {
    if (this.data.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  handleVRInput: function (event) {
    if (!this.data.visible) return;
    
    // Simple VR interaction - cycle through chapters
    const oculusControls = event.target.getAttribute('oculus-touch-controls');
    if (oculusControls && oculusControls.hand === 'right') {
      this.navigate(1);
    } else if (oculusControls && oculusControls.hand === 'left') {
      this.navigate(-1);
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  }
});