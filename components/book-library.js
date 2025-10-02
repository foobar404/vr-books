// Book library UI component

AFRAME.registerComponent('book-library', {
  schema: {
    visible: { type: 'boolean', default: false }
  },

  init: function () {
    this.books = [];
    this.selectedIndex = 0;
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    
    // Create UI panel
    this.createPanel();
  },

  createPanel: function () {
    // Create a plane for the library UI
    const geometry = new THREE.PlaneGeometry(2, 2.5);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 640;
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

  setBooks: function (books) {
    this.books = books;
    this.selectedIndex = 0;
    this.render();
  },

  render: function () {
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Book Library', 20, 40);
    
    // Instructions
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Use J/K to navigate, Enter to select', 20, 70);
    ctx.fillText('Press TAB to toggle library', 20, 90);
    
    // Book list
    ctx.font = '18px sans-serif';
    const startY = 120;
    const lineHeight = 35;
    
    if (this.books.length === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('No books found in /books directory', 20, startY);
      ctx.fillText('Add .epub files to /books/', 20, startY + lineHeight);
    } else {
      this.books.forEach((book, i) => {
        if (i === this.selectedIndex) {
          // Highlight selected
          ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
          ctx.fillRect(10, startY + i * lineHeight - 20, canvas.width - 20, 30);
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = '#cccccc';
        }
        
        const displayText = book.title || book.filename || `Book ${i + 1}`;
        ctx.fillText(displayText, 20, startY + i * lineHeight);
        
        if (book.author) {
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#888888';
          ctx.fillText(book.author, 40, startY + i * lineHeight + 15);
          ctx.font = '18px sans-serif';
        }
      });
    }
    
    this.texture.needsUpdate = true;
  },

  onKeyDown: function (event) {
    // Toggle library visibility
    if (event.key === 'Tab') {
      event.preventDefault();
      this.data.visible = !this.data.visible;
      this.mesh.visible = this.data.visible;
      return;
    }
    
    if (!this.data.visible) return;
    
    switch(event.key) {
      case 'j':
      case 'J':
        // Next book
        this.selectedIndex = Math.min(this.books.length - 1, this.selectedIndex + 1);
        this.render();
        event.preventDefault();
        break;
        
      case 'k':
      case 'K':
        // Previous book
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.render();
        event.preventDefault();
        break;
        
      case 'Enter':
        // Select book
        if (this.books.length > 0) {
          this.el.emit('book-selected', { 
            book: this.books[this.selectedIndex],
            index: this.selectedIndex 
          });
          this.data.visible = false;
          this.mesh.visible = false;
        }
        event.preventDefault();
        break;
        
      case 'Escape':
        // Close library
        this.data.visible = false;
        this.mesh.visible = false;
        event.preventDefault();
        break;
    }
  },

  update: function (oldData) {
    if (oldData.visible !== this.data.visible) {
      this.mesh.visible = this.data.visible;
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
  }
});
