// Virtual Bookshelf Component - Displays 3D books on shelves

AFRAME.registerComponent('virtual-bookshelf', {
  schema: {
    shelfCount: { type: 'number', default: 3 },
    booksPerShelf: { type: 'number', default: 8 },
    shelfWidth: { type: 'number', default: 3 },
    shelfHeight: { type: 'number', default: 0.4 },
    shelfDepth: { type: 'number', default: 0.3 }
  },

  init: function () {
    // NOTE: This bookshelf is now a child of camera-rig, which means:
    // - It automatically moves with the user's head/camera
    // - Position/rotation are relative to camera (not world coordinates)
    // - Consistent distance maintained automatically
    
    this.books = [];
    this.selectedBookIndex = 0;
    this.gridDistance = 0.8; // Distance from camera (closer than before)
    this.gridRows = 5;
    this.gridCols = 5;
    this.bookSpacing = 0.3; // Space between books in grid (increased from 0.2)
    this.floatingHeight = 0; // Relative to camera (camera rig is already at eye level)
    
    // Animation properties
    this.floatTime = 0;
    this.floatSpeed = 0.8;
    this.floatAmplitude = 0.02; // Subtle float for grid layout
    this.animationRunning = false; // Track animation state
    
    // Don't create physical shelves - just floating books in grid
    this.loadBooksFromManifest();
    
    // Bookshelf visibility state
    this.isVisible = true;
    
    // Event listeners
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    
    // Listen for book selection events
    this.el.addEventListener('book-selected-3d', (event) => {
      this.selectBook(event.detail.index);
    });
    
    // Monitor bookshelf visibility to prevent unexpected hiding
    this.startVisibilityMonitor();
    
    // Start floating animation
    this.startFloatingAnimation();
  },

  createShelves() {
    // No physical shelves - books float in an arc
  },

  async loadBooksFromManifest() {
    try {
      const response = await fetch('/books/manifest.json');
      const manifest = await response.json();
      
      if (manifest.books && manifest.books.length > 0) {
        await this.createVirtualBooks(manifest.books);
      }
    } catch (error) {
      this.createSampleBooks();
    }
  },

  async createVirtualBooks(bookList) {
    const maxBooks = this.gridRows * this.gridCols; // 25 books max for 5x5 grid
    const totalBooks = Math.min(bookList.length, maxBooks);
    
    // Clear existing books
    this.books = [];
    
    // Track loading state
    this.loadingBooks = new Array(totalBooks).fill(null);
    this.loadedCount = 0;
    this.nextPositionIndex = 0; // Track the next position to fill
    
    // Start loading all books asynchronously
    const loadPromises = [];
    
    for (let i = 0; i < totalBooks; i++) {
      const book = bookList[i];
      const loadPromise = this.loadBookAsync(book, i);
      loadPromises.push(loadPromise);
    }
    
    // Wait for all books to complete loading (but they render as they finish)
    await Promise.allSettled(loadPromises);
    
    // Ensure bookshelf remains visible after loading
    if (this.isVisible) {
      this.el.setAttribute('visible', 'true');
    }
  },

  async loadBookAsync(book, originalIndex) {
    try {
      // Create book entity (initially invisible)
      const bookEntity = document.createElement('a-entity');
      bookEntity.setAttribute('vr-book', {
        epubUrl: `/books/${book.filename}`,
        scale: 1.0, // Full realistic scale (15cm x 23cm)
        interactive: true
      });
      
      // Add flag to prevent double-processing
      bookEntity.isProcessed = false;
      
      // Add classes for VR interaction
      bookEntity.classList.add('bookshelf-book', 'interactive-book');
      
      // Add grabbable attributes for super-hands
      bookEntity.setAttribute('grabbable', '');
      bookEntity.setAttribute('hoverable', '');
      
      // Add geometry for raycaster detection
      bookEntity.setAttribute('geometry', {
        primitive: 'box',
        width: 0.3,
        height: 0.4,
        depth: 0.05
      });
      
      // Make it temporarily invisible for async loading
      bookEntity.setAttribute('material', {
        opacity: 0,
        transparent: true
      });
      
      // Start invisible and scaled down
      bookEntity.setAttribute('visible', 'false');
      bookEntity.setAttribute('scale', '0 0 0');
      
      // Add to scene immediately but invisible
      this.el.appendChild(bookEntity);
      
      // Listen for book loading completion
      return new Promise((resolve) => {
        let resolved = false;
        let readyCheckInterval = null;
        
        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            bookEntity.removeEventListener('book-loaded', onBookLoaded);
            bookEntity.removeEventListener('book-error', onBookError);
            if (readyCheckInterval) {
              clearInterval(readyCheckInterval);
            }
          }
        };
        
        const onBookLoaded = (event) => {
          cleanup();
          if (bookEntity.isProcessed) {
            resolve();
            return;
          }
          bookEntity.isProcessed = true;
          this.onBookLoadComplete(bookEntity, book, originalIndex);
          resolve();
        };
        
        const onBookError = (event) => {
          cleanup();
          console.warn(`Failed to load book: ${book.filename}`, event.detail?.error);
          if (bookEntity.parentNode) {
            bookEntity.remove();
          }
          resolve(); // Resolve anyway to not block other books
        };
        
        // Also check if the book component is ready (fallback)
        const checkBookReady = () => {
          if (bookEntity.isProcessed) {
            return true; // Already processed
          }
          const vrBookComponent = bookEntity.components['vr-book'];
          if (vrBookComponent && vrBookComponent.isLoaded) {
            cleanup();
            bookEntity.isProcessed = true;
            this.onBookLoadComplete(bookEntity, book, originalIndex);
            resolve();
            return true;
          }
          return false;
        };
        
        // Check every 500ms if book is ready (as fallback)
        readyCheckInterval = setInterval(() => {
          if (checkBookReady()) {
            clearInterval(readyCheckInterval);
          }
        }, 500);
        
        bookEntity.addEventListener('book-loaded', onBookLoaded);
        bookEntity.addEventListener('book-error', onBookError);
        
        // Timeout after 15 seconds - balance between allowing slow loading and preventing hangs
        setTimeout(() => {
          cleanup();
          if (bookEntity.isProcessed) {
            resolve();
            return;
          }
          console.warn(`⏰ Book loading timeout: ${book.filename} (${this.loadedCount + 1}/${this.books.length})`);
          
          // Instead of removing the book entirely, keep it but mark as failed
          if (bookEntity.parentNode) {
            // Create a simple placeholder for timed-out books
            this.createTimeoutPlaceholder(bookEntity, book);
            bookEntity.isProcessed = true;
            this.onBookLoadComplete(bookEntity, book, originalIndex);
          }
          resolve();
        }, 15000); // 15 second timeout - reduced from 30 seconds
      });
      
    } catch (error) {
      console.error(`Error loading book ${book.filename}:`, error);
    }
  },

  createTimeoutPlaceholder: function(bookEntity, book) {
    // Clear any existing components
    bookEntity.removeAttribute('vr-book');
    
    // Create a simple placeholder geometry and material
    bookEntity.setAttribute('geometry', {
      primitive: 'box',
      width: 0.15,  // Realistic book width
      height: 0.23, // Realistic book height
      depth: 0.03   // Realistic book thickness
    });
    
    bookEntity.setAttribute('material', {
      color: '#CC4444', // Red color to indicate timeout
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Add text component with book title
    const titleText = document.createElement('a-text');
    titleText.setAttribute('value', book.title.length > 20 ? book.title.substring(0, 20) + '...' : book.title);
    titleText.setAttribute('position', '0 0 0.016');
    titleText.setAttribute('align', 'center');
    titleText.setAttribute('width', '4');
    titleText.setAttribute('color', 'white');
    titleText.setAttribute('wrap-count', '15');
    bookEntity.appendChild(titleText);
    
    // Add basic interaction capabilities
    bookEntity.setAttribute('class', 'book-item grabbable');
    bookEntity.setAttribute('grabbable', '');
    bookEntity.setAttribute('hoverable', '');
    
    // Add click event for timeout books (could retry loading or show error)
    bookEntity.addEventListener('click', () => {
      // Could implement retry logic here
    });
    
    // Mark as timeout placeholder
    bookEntity.isTimeoutPlaceholder = true;
  },

  onBookLoadComplete(bookEntity, book, originalIndex) {
    // Double-check to prevent duplicate processing
    if (bookEntity.hasBeenCompleted) {
      console.warn(`🚨 Book completion called twice for: ${book.filename}`);
      return;
    }
    bookEntity.hasBeenCompleted = true;
    
    // Calculate position based on loading order (not original index)
    const positionIndex = this.nextPositionIndex++;
    const gridPosition = this.calculateGridPosition(positionIndex);
    
    // Position the book
    bookEntity.setAttribute('position', `${gridPosition.x} ${gridPosition.y} ${gridPosition.z}`);
    bookEntity.setAttribute('rotation', '0 0 0'); // Grid books face forward
    
    // Add selection highlight
    this.addBookHighlight(bookEntity, positionIndex);
    
    // Store original position and rotation for floating animation
    bookEntity.originalPosition = { x: gridPosition.x, y: gridPosition.y, z: gridPosition.z };
    bookEntity.originalRotation = { y: 0 }; // No rotation for grid
    bookEntity.floatOffset = Math.random() * Math.PI * 2;
    bookEntity.gridIndex = positionIndex;
    
    // Add smooth pop-in animation (but not for timeout placeholders)
    if (!bookEntity.isTimeoutPlaceholder) {
      this.animateBookEntry(bookEntity);
    } else {
      // For timeout placeholders, just make them visible
      bookEntity.setAttribute('visible', 'true');
    }
    
    // Listen for book opening
    bookEntity.addEventListener('book-opened', (event) => {
      this.openBook(event.detail);
    });
    
    // Add to books array in loading order
    this.books.push({
      entity: bookEntity,
      data: book,
      index: positionIndex,
      originalIndex: originalIndex
    });
    
    this.loadedCount++;
    
    // If this is the first book, select it
    if (this.loadedCount === 1) {
      this.selectedBookIndex = 0;
      this.highlightBook(0);
    }
    
  },

  animateBookEntry(bookEntity) {
    // Remove temporary geometry and material
    bookEntity.removeAttribute('geometry');
    bookEntity.removeAttribute('material');
    
    // Make visible
    bookEntity.setAttribute('visible', 'true');
    
    // Animate scale from 0 to 1 with bounce effect
    const startTime = Date.now();
    const duration = 800; // 800ms animation
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Bounce easing function
      const easeOutBounce = (t) => {
        if (t < 1 / 2.75) {
          return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
          return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
          return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
          return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
      };
      
      const scale = easeOutBounce(progress) * 1.0; // Full realistic scale
      bookEntity.setAttribute('scale', `${scale} ${scale} ${scale}`);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  },

  calculateGridPosition: function(index) {
    // Calculate row and column in 5x5 grid
    const row = Math.floor(index / this.gridCols);
    const col = index % this.gridCols;
    
    // Center the grid around the camera
    const gridWidth = (this.gridCols - 1) * this.bookSpacing;
    const gridHeight = (this.gridRows - 1) * this.bookSpacing;
    
    const x = (col * this.bookSpacing) - (gridWidth / 2);
    const y = this.floatingHeight + (gridHeight / 2) - (row * this.bookSpacing);
    const z = -this.gridDistance;
    
    return { x, y, z };
  },

  startFloatingAnimation: function() {
    // Prevent multiple animation loops
    if (this.animationRunning) return;
    this.animationRunning = true;
    
    const animate = () => {
      // Stop animation if component is removed
      if (!this.el || !this.el.parentNode) {
        this.animationRunning = false;
        return;
      }
      
      this.floatTime += 0.016; // ~60fps
      
      this.books.forEach((bookData, index) => {
        const bookEntity = bookData.entity;
        if (bookEntity && bookEntity.originalPosition && bookEntity.parentNode) {
          // Calculate floating offset for grid layout
          const floatY = Math.sin(this.floatTime * this.floatSpeed + bookEntity.floatOffset) * this.floatAmplitude;
          const floatX = Math.sin(this.floatTime * this.floatSpeed * 0.7 + bookEntity.floatOffset) * (this.floatAmplitude * 0.3);
          
          // Apply floating movement (no Z movement for grid)
          const newPosition = {
            x: bookEntity.originalPosition.x + floatX,
            y: bookEntity.originalPosition.y + floatY,
            z: bookEntity.originalPosition.z
          };
          
          bookEntity.setAttribute('position', `${newPosition.x} ${newPosition.y} ${newPosition.z}`);
          
          // Add very subtle rotation for floating effect
          const rotateZ = Math.sin(this.floatTime * this.floatSpeed * 0.5 + bookEntity.floatOffset) * 1;
          const rotateX = Math.sin(this.floatTime * this.floatSpeed * 0.3 + bookEntity.floatOffset) * 0.5;
          bookEntity.setAttribute('rotation', `${rotateX} 0 ${rotateZ}`);
          
          // Animate highlight particles if this book is selected
          if (index === this.selectedBookIndex) {
            this.animateSelectedBookParticles(bookEntity);
          }
        }
      });
      
      requestAnimationFrame(animate);
    };
    
    animate();
  },

  animateSelectedBookParticles: function(bookEntity) {
    const highlight = bookEntity.getObject3D('highlight');
    if (highlight) {
      highlight.children.forEach((child, i) => {
        if (child.geometry && child.geometry.type === 'SphereGeometry') {
          // Make particles orbit around the book
          const time = this.floatTime * 2 + i;
          const radius = 0.2 + Math.sin(time) * 0.05;
          const angle = time + i * Math.PI / 3;
          
          child.position.set(
            Math.cos(angle) * radius,
            Math.sin(time * 0.7) * 0.1,
            Math.sin(angle) * radius
          );
        }
      });
    }
  },

  createSampleBooks() {
    // Create some sample books for demonstration
    const sampleBooks = [
      { filename: 'sample1.epub', title: 'Sample Book 1', author: 'Author One' },
      { filename: 'sample2.epub', title: 'Sample Book 2', author: 'Author Two' },
      { filename: 'sample3.epub', title: 'Sample Book 3', author: 'Author Three' }
    ];
    
    this.createVirtualBooks(sampleBooks);
  },

  addBookHighlight(bookEntity, index) {
    // Create floating highlight aura for floating books (smaller for grid)
    const highlightGroup = new THREE.Group();
    
    // Glowing ring around book (smaller for grid layout)
    const ringGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00aaff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.08; // Closer to book
    
    // Add subtle glow particles (fewer for grid layout)
    const particleGeometry = new THREE.SphereGeometry(0.015, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0
    });
    
    // Create smaller number of glow particles around the book
    for (let i = 0; i < 4; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
      const angle = (i / 4) * Math.PI * 2;
      particle.position.set(
        Math.cos(angle) * 0.15,
        Math.random() * 0.05 - 0.025,
        Math.sin(angle) * 0.15
      );
      highlightGroup.add(particle);
    }
    
    highlightGroup.add(ring);
    bookEntity.setObject3D('highlight', highlightGroup);
  },

  highlightBook(index) {
    // Remove previous highlight
    this.books.forEach((book, i) => {
      const highlight = book.entity.getObject3D('highlight');
      if (highlight) {
        // Update ring opacity
        const ring = highlight.children.find(child => child.geometry.type === 'RingGeometry');
        if (ring) {
          ring.material.opacity = i === index ? 0.7 : 0;
        }
        
        // Update particle opacity
        highlight.children.forEach(child => {
          if (child.geometry && child.geometry.type === 'SphereGeometry') {
            child.material.opacity = i === index ? 0.6 : 0;
          }
        });
        
        // Add pulsing animation to selected book
        if (i === index) {
          this.animateHighlight(highlight);
        }
      }
    });
    
    this.selectedBookIndex = index;
  },

  animateHighlight(highlight) {
    // Pulsing animation for selected book highlight (adjusted for grid layout)
    const animate = () => {
      const time = Date.now() * 0.003;
      const pulseScale = 1 + Math.sin(time * 2) * 0.08; // Reduced pulse for smaller books
      
      highlight.children.forEach(child => {
        if (child.geometry && child.geometry.type === 'SphereGeometry') {
          child.scale.set(pulseScale, pulseScale, pulseScale);
          // Add gentle floating motion
          child.position.y += Math.sin(time * 1.5) * 0.002;
        }
      });
      
      // Animate ring opacity
      const ring = highlight.children.find(child => child.geometry && child.geometry.type === 'RingGeometry');
      if (ring) {
        ring.material.opacity = (Math.sin(time * 3) + 1) * 0.2 + 0.1; // Max 0.3 opacity
        ring.rotation.z = time * 0.5; // Gentle rotation
      }
      
      // Continue animation only if this highlight is still active
      if (ring && ring.material.opacity > 0) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  },

  selectBook(index) {
    if (index >= 0 && index < this.books.length) {
      this.highlightBook(index);
    }
  },

  openBook(bookData) {
    // Emit event to open book in reading mode
    this.el.sceneEl.emit('open-book-for-reading', bookData);
  },

  onKeyDown(event) {
    // Always allow toggle key, regardless of bookshelf visibility or current mode
    if (event.key === 'v' || event.key === 'V') {
      if (!event.ctrlKey && !event.shiftKey) {
        this.toggleBookshelf();
        event.preventDefault();
      }
      return;
    }
    
    // Only handle navigation if bookshelf is visible
    if (!this.isVisible) {
      return;
    }
    
    switch(event.key) {
      case 'ArrowLeft':
      case 'h':
      case 'H':
        if (event.ctrlKey) break; // Don't interfere with help
        this.navigateGrid('left');
        event.preventDefault();
        break;
        
      case 'ArrowRight':
      case 'l':
      case 'L':
        if (event.ctrlKey || event.shiftKey) break; // Don't interfere with lighting
        this.navigateGrid('right');
        event.preventDefault();
        break;
        
      case 'ArrowUp':
      case 'k':
      case 'K':
        if (event.ctrlKey || event.shiftKey) break; // Don't interfere with lighting
        this.navigateGrid('up');
        event.preventDefault();
        break;
        
      case 'ArrowDown':
      case 'j':
      case 'J':
        if (event.ctrlKey) break; // Don't interfere with library
        this.navigateGrid('down');
        event.preventDefault();
        break;
        
      case 'Enter':
      case ' ':
        this.activateSelectedBook();
        event.preventDefault();
        break;
    }
  },

  toggleBookshelf: function() {
    // Always allow toggle regardless of current state
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      // Show bookshelf - since it's a child of camera rig, it automatically 
      // maintains consistent distance and orientation relative to user
      this.showBookshelf();
    } else {
      // Hide bookshelf but keep toggle functionality available
      this.hideBookshelf();
    }
    
  },

  showBookshelf: function() {
    // Show all books
    this.el.setAttribute('visible', 'true');
    this.books.forEach(bookData => {
      if (bookData.entity) {
        bookData.entity.setAttribute('visible', 'true');
      }
    });
  },

  hideBookshelf: function() {
    // Hide the entire bookshelf but don't change isVisible for toggle functionality
    this.el.setAttribute('visible', 'false');
  },

  // Force hide bookshelf (used when switching to reading mode)
  forceHide: function() {
    this.isVisible = false;
    this.el.setAttribute('visible', 'false');
  },

  navigateGrid(direction) {
    const currentRow = Math.floor(this.selectedBookIndex / this.gridCols);
    const currentCol = this.selectedBookIndex % this.gridCols;
    let newRow = currentRow;
    let newCol = currentCol;
    
    switch(direction) {
      case 'left':
        newCol = Math.max(0, currentCol - 1);
        break;
      case 'right':
        newCol = Math.min(this.gridCols - 1, currentCol + 1);
        break;
      case 'up':
        newRow = Math.max(0, currentRow - 1);
        break;
      case 'down':
        newRow = Math.min(this.gridRows - 1, currentRow + 1);
        break;
    }
    
    const newIndex = newRow * this.gridCols + newCol;
    
    // Only move if there's a book at the new position
    if (newIndex >= 0 && newIndex < this.books.length && newIndex !== this.selectedBookIndex) {
      this.highlightBook(newIndex);
    }
  },

  navigateBooks(direction) {
    const newIndex = this.selectedBookIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.books.length) {
      this.highlightBook(newIndex);
    }
  },

  activateSelectedBook() {
    if (this.books[this.selectedBookIndex]) {
      const book = this.books[this.selectedBookIndex];
      book.entity.components['vr-book'].openBook();
    }
  },

  startVisibilityMonitor: function() {
    // Monitor bookshelf visibility every 5 seconds to detect unexpected hiding
    this.visibilityCheckInterval = setInterval(() => {
      const isActuallyVisible = this.el.getAttribute('visible');
      const bookCount = this.el.querySelectorAll('a-entity[vr-book], a-entity[geometry]').length;
      
      if (this.isVisible && isActuallyVisible === false) {
        console.warn('🚨 Bookshelf became unexpectedly invisible! Restoring visibility...');
        this.el.setAttribute('visible', 'true');
      }
      
      // Also check if bookshelf still has books
      if (this.isVisible && bookCount === 0 && this.loadedCount > 0) {
        console.warn('🚨 Bookshelf lost all its books! This might indicate a DOM issue.');
        
        // Try to restore books from the books array
        if (this.books && this.books.length > 0) {
          this.books.forEach((bookData, index) => {
            if (bookData.entity && !bookData.entity.parentNode) {
              this.el.appendChild(bookData.entity);
            }
          });
        }
      }
    }, 5000); // Check every 5 seconds
  },

  remove: function () {
    // Clean up animation
    this.animationRunning = false;
    
    // Clean up visibility monitor
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
    }
    
    // Clean up event listeners
    window.removeEventListener('keydown', this.onKeyDown);
    
    // Clean up books
    if (this.books) {
      this.books.forEach(bookData => {
        if (bookData.entity && bookData.entity.parentNode) {
          bookData.entity.remove();
        }
      });
      this.books = [];
    }
  }
});