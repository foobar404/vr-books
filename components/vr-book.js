// VR Book Component - Creates 3D physical representation of EPUB books

AFRAME.registerComponent('vr-book', {
  schema: {
    epubUrl: { type: 'string', default: '' },
    scale: { type: 'number', default: 1 },
    interactive: { type: 'boolean', default: true }
  },

  init: function () {
    this.bookData = null;
    this.bookMesh = null;
    this.isLoaded = false;
    this.pageCount = 0;
    
    // Book dimensions (in meters)
    this.bookDimensions = {
      width: 0.15,   // 15cm wide
      height: 0.23,  // 23cm tall (standard paperback)
      minThickness: 0.01,  // 1cm minimum
      maxThickness: 0.08,  // 8cm maximum
      pagesPerCm: 125      // Approximate pages per cm of thickness
    };

    this.materials = {
      cover: null,
      spine: null,
      pages: null
    };

    if (this.data.epubUrl) {
      this.loadBook(this.data.epubUrl);
    }
  },

  async loadBook(url) {
    try {
      
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded');
      }
      
      // Use EPUBLoader to parse the book
      if (!window.epubLoaderClass) {
        const module = await import('./epub-loader.js');
        window.epubLoaderClass = module.EPUBLoader;
      }
      
      // Create a new instance for this book
      const epubLoader = new window.epubLoaderClass();
      
      // Load the book data
      const book = await epubLoader.loadBook(url);
      this.bookData = book;
      
      // Set page count from spine
      this.pageCount = book.spine ? book.spine.length : 20;
      
      // Extract cover image
      try {
        this.coverImageUrl = await this.extractCoverImage();
      } catch (error) {
        console.warn('VR Book: Failed to extract cover image:', error);
        this.coverImageUrl = null;
      }
      
      // Wait for cover image to load before creating 3D representation
      await this.waitForCoverImageLoad();
      
      // Create 3D representation
      this.create3DBook();
      
      this.isLoaded = true;
      
      this.el.emit('book-loaded', { bookData: this.bookData });
      
    } catch (error) {
      console.error('VR Book: Error loading book:', error);
      this.el.emit('book-error', { error: error.message });
      this.createFallbackBook();
    }
  },

  async waitForCoverImageLoad() {
    if (!this.coverImageUrl) {
      // No cover image to wait for
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve();
      };
      img.onerror = (error) => {
        console.warn('VR Book: Cover image failed to load, proceeding without it');
        this.coverImageUrl = null; // Clear the URL so we use procedural cover
        resolve(); // Resolve anyway to not block the book
      };
      
      // Set timeout to avoid hanging
      setTimeout(() => {
        console.warn('VR Book: Cover image loading timeout, proceeding without it');
        this.coverImageUrl = null;
        resolve();
      }, 3000); // Reduced to 3 seconds
      
      img.src = this.coverImageUrl;
    });
  },

  async extractCoverImage() {
    if (!this.bookData) return null;

    const { manifest, zip, contentDir } = this.bookData;
    
    try {
      // Look for cover image in manifest
      for (const [id, item] of Object.entries(manifest)) {
        if (item.mediaType && item.mediaType.startsWith('image/') && 
            (id.toLowerCase().includes('cover') || item.href.toLowerCase().includes('cover'))) {
          
          const imagePath = contentDir + item.href;
          const imageFile = zip.file(imagePath);
          
          if (imageFile) {
            const imageBlob = await imageFile.async('blob');
            return URL.createObjectURL(imageBlob);
          }
        }
      }
      
      // Fallback: look for any image that might be a cover
      const imageFiles = Object.values(manifest).filter(item => 
        item.mediaType && item.mediaType.startsWith('image/')
      );
      
      if (imageFiles.length > 0) {
        const firstImage = imageFiles[0];
        const imagePath = contentDir + firstImage.href;
        const imageFile = zip.file(imagePath);
        
        if (imageFile) {
          const imageBlob = await imageFile.async('blob');
          return URL.createObjectURL(imageBlob);
        }
      }
      
    } catch (error) {
    }
    
    return null;
  },

  create3DBook() {
    // Calculate book thickness based on page count
    const thickness = Math.min(
      this.bookDimensions.maxThickness,
      Math.max(
        this.bookDimensions.minThickness,
        this.pageCount / this.bookDimensions.pagesPerCm * 0.01
      )
    );

    // Create book geometry
    this.createBookGeometry(thickness);
    
    // Create materials
    this.createMaterials();
    
    // Create the book mesh
    this.createBookMesh(thickness);
  },

  createBookGeometry(thickness) {
    const { width, height } = this.bookDimensions;
    
    // Main book body (slightly smaller than cover)
    this.bodyGeometry = new THREE.BoxGeometry(
      width - 0.002, 
      height - 0.002, 
      thickness - 0.002
    );
    
    // Cover geometry (slightly larger)
    this.coverGeometry = new THREE.BoxGeometry(width, height, thickness);
    
    // Spine geometry
    this.spineGeometry = new THREE.BoxGeometry(0.001, height, thickness);
  },

  createMaterials() {
    const metadata = this.bookData?.metadata || {};
    
    // Create cover material
    if (this.coverImageUrl) {
      const coverTexture = new THREE.TextureLoader().load(this.coverImageUrl);
      coverTexture.wrapS = THREE.ClampToEdgeWrapping;
      coverTexture.wrapT = THREE.ClampToEdgeWrapping;
      
      this.materials.cover = new THREE.MeshStandardMaterial({
        map: coverTexture,
        roughness: 0.3,
        metalness: 0.0
      });
    } else {
      // Generate procedural cover
      this.materials.cover = this.createProceduralCover(metadata);
    }
    
    // Pages material with realistic paper texture
    this.materials.pages = this.createPagesMaterial();
    
    // Spine material with leather-like PBR
    this.materials.spine = this.createSpineMaterial();
  },

  createPagesMaterial() {
    // Create procedural page texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base paper color - off-white with slight yellow tint
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add paper grain/texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Add subtle random noise for paper texture
      const noise = (Math.random() - 0.5) * 20;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add subtle page lines
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Create normal map for paper texture
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = 256;
    normalCanvas.height = 256;
    const normalCtx = normalCanvas.getContext('2d');
    
    // Generate subtle normal map for paper fiber texture
    const normalImageData = normalCtx.getImageData(0, 0, normalCanvas.width, normalCanvas.height);
    const normalData = normalImageData.data;
    
    for (let i = 0; i < normalData.length; i += 4) {
      const x = (i / 4) % normalCanvas.width;
      const y = Math.floor((i / 4) / normalCanvas.width);
      
      // Create subtle fiber pattern
      const fiberNoise = Math.sin(x * 0.1) * Math.cos(y * 0.15) * 0.5 + 0.5;
      const noise = (Math.random() - 0.5) * 0.2 + fiberNoise * 0.3;
      
      normalData[i] = 128 + noise * 127;     // R (X normal)
      normalData[i + 1] = 128 + noise * 127; // G (Y normal)
      normalData[i + 2] = 255;               // B (Z normal - pointing out)
      normalData[i + 3] = 255;               // A
    }
    
    normalCtx.putImageData(normalImageData, 0, 0);
    
    // Create textures
    const diffuseTexture = new THREE.CanvasTexture(canvas);
    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    
    diffuseTexture.wrapS = THREE.RepeatWrapping;
    diffuseTexture.wrapT = THREE.RepeatWrapping;
    diffuseTexture.repeat.set(1, 20); // Repeat to show page layers
    
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.repeat.set(1, 20);
    
    return new THREE.MeshStandardMaterial({
      map: diffuseTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.9,
      metalness: 0.0,
      transparent: false
    });
  },

  createSpineMaterial() {
    // Create leather-like spine texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base leather color
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#8b4513');
    gradient.addColorStop(0.5, '#a0522d');
    gradient.addColorStop(1, '#654321');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add leather grain
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % canvas.width;
      const y = Math.floor((i / 4) / canvas.width);
      
      // Create leather-like texture
      const grain = Math.sin(x * 0.3) * Math.cos(y * 0.2) * 0.4;
      const noise = (Math.random() - 0.5) * 30 + grain * 20;
      
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.0,
      bumpMap: texture,
      bumpScale: 0.1
    });
  },

  createProceduralCover(metadata) {
    // Create a canvas for procedural cover
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#3498db');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const title = metadata.title || 'Unknown Title';
    this.wrapText(ctx, title, canvas.width / 2, canvas.height * 0.3, canvas.width - 40, 60);
    
    // Author
    ctx.font = '32px serif';
    ctx.fillStyle = '#ecf0f1';
    const author = metadata.creator || 'Unknown Author';
    this.wrapText(ctx, author, canvas.width / 2, canvas.height * 0.7, canvas.width - 40, 40);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.0
    });
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    
    const startY = y - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineHeight);
    });
  },

  createBookMesh(thickness) {
    // Create book group
    this.bookGroup = new THREE.Group();
    
    // Create book cover (front and back)
    const frontCover = new THREE.Mesh(
      new THREE.PlaneGeometry(this.bookDimensions.width, this.bookDimensions.height),
      this.materials.cover
    );
    frontCover.position.z = thickness / 2 + 0.001;
    
    const backCover = new THREE.Mesh(
      new THREE.PlaneGeometry(this.bookDimensions.width, this.bookDimensions.height),
      new THREE.MeshStandardMaterial({ 
        color: 0x2c3e50,
        roughness: 0.4,
        metalness: 0.0
      })
    );
    backCover.position.z = -thickness / 2 - 0.001;
    backCover.rotation.y = Math.PI;
    
    // Create pages with detailed geometry for realistic page edges
    const pagesGeometry = new THREE.BoxGeometry(
      this.bookDimensions.width - 0.002,
      this.bookDimensions.height - 0.002,
      thickness - 0.002
    );
    
    // Apply different materials to different faces of the pages
    const pagesMaterials = [
      this.materials.pages, // Right side (page edges)
      this.materials.pages, // Left side (page edges)
      new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.9 }), // Top
      new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.9 }), // Bottom
      new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.9 }), // Front (hidden)
      new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.9 })  // Back (hidden)
    ];
    
    const pages = new THREE.Mesh(pagesGeometry, pagesMaterials);
    
    // Create spine
    const spineGeometry = new THREE.PlaneGeometry(thickness, this.bookDimensions.height);
    const spine = new THREE.Mesh(spineGeometry, this.materials.spine);
    spine.position.x = -this.bookDimensions.width / 2;
    spine.rotation.y = Math.PI / 2;
    
    // Add spine text
    this.addSpineText(spine, thickness);
    
    // Create page edge detail (small strips to show individual pages)
    this.addPageEdgeDetails(thickness);
    
    // Add all parts to group
    this.bookGroup.add(frontCover);
    this.bookGroup.add(backCover);
    this.bookGroup.add(pages);
    this.bookGroup.add(spine);
    
    // Apply scale
    this.bookGroup.scale.setScalar(this.data.scale);
    
    // Add interaction
    if (this.data.interactive) {
      this.addInteraction();
    }
    
    // Add to entity
    this.el.setObject3D('book', this.bookGroup);
  },

  addPageEdgeDetails(thickness) {
    // Add subtle page separation lines for realism
    const pageCount = Math.min(this.pageCount, 50); // Limit visual pages for performance
    const pageThickness = thickness / pageCount;
    
    for (let i = 0; i < Math.min(pageCount, 20); i += 2) {
      const pageEdge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.001, this.bookDimensions.height - 0.004),
        new THREE.MeshStandardMaterial({
          color: 0xf0f0e8,
          roughness: 0.95,
          metalness: 0.0,
          transparent: true,
          opacity: 0.7
        })
      );
      
      pageEdge.position.x = this.bookDimensions.width / 2 - 0.001;
      pageEdge.position.z = -thickness / 2 + (i * pageThickness);
      pageEdge.rotation.y = Math.PI / 2;
      
      this.bookGroup.add(pageEdge);
    }
  },

  addSpineText(spine, thickness) {
    if (!this.bookData?.metadata?.title) return;
    
    // Create canvas for spine text
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Background with leather texture
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#654321');
    gradient.addColorStop(0.5, '#8b4513');
    gradient.addColorStop(1, '#a0522d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 15;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Text with gold foil effect
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    
    // Rotate text for spine
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    
    // Add text shadow for embossed effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    
    ctx.strokeText(this.bookData.metadata.title, 0, 0);
    ctx.fillText(this.bookData.metadata.title, 0, 0);
    ctx.restore();
    
    // Apply texture with PBR properties
    const spineTexture = new THREE.CanvasTexture(canvas);
    spine.material = new THREE.MeshStandardMaterial({
      map: spineTexture,
      roughness: 0.7,
      metalness: 0.0,
      bumpMap: spineTexture,
      bumpScale: 0.05
    });
  },

  addInteraction() {
    // Add click handler for desktop
    this.el.addEventListener('click', () => {
      if (this.isLoaded && this.bookData) {
        this.el.emit('book-opened', { 
          bookData: this.bookData,
          epubUrl: this.data.epubUrl 
        });
      } else {
      }
    });
    
    // Add triggerdown handler for VR controllers
    this.el.addEventListener('triggerdown', (event) => {
      if (this.isLoaded && this.bookData) {
        this.el.emit('book-opened', { 
          bookData: this.bookData,
          epubUrl: this.data.epubUrl 
        });
        event.stopPropagation();
      } else {
      }
    });
    
    // Add gripdown handler for VR controllers (alternative grab)
    this.el.addEventListener('gripdown', (event) => {
      if (this.isLoaded && this.bookData) {
        this.el.emit('book-opened', { 
          bookData: this.bookData,
          epubUrl: this.data.epubUrl 
        });
        event.stopPropagation();
      }
    });

    // Add super-hands events for better VR interaction
    this.el.addEventListener('grabbed', (event) => {
      if (this.isLoaded && this.bookData) {
        this.el.emit('book-opened', { 
          bookData: this.bookData,
          epubUrl: this.data.epubUrl 
        });
      }
    });

    // Add generic interaction event for any selection method
    this.el.addEventListener('interact', (event) => {
      if (this.isLoaded && this.bookData) {
        this.el.emit('book-opened', { 
          bookData: this.bookData,
          epubUrl: this.data.epubUrl 
        });
      }
    });
    
    // Add hover effect
    this.el.addEventListener('mouseenter', () => {
      if (this.bookGroup) {
        this.bookGroup.scale.setScalar(this.data.scale * 1.05);
      }
    });
    
    this.el.addEventListener('mouseleave', () => {
      if (this.bookGroup) {
        this.bookGroup.scale.setScalar(this.data.scale);
      }
    });
    
    // VR raycaster hover events
    this.el.addEventListener('raycaster-intersected', () => {
      // Highlight when raycaster points at book
      if (this.bookGroup && this.bookGroup.scale) {
        this.bookGroup.scale.setScalar(this.data.scale * 1.1);
      }
      if (this.bookMesh && this.bookMesh.material) {
        this.bookMesh.material.emissive.setHex(0x333333);
      }
    });
    
    this.el.addEventListener('raycaster-intersected-cleared', () => {
      // Remove highlight when raycaster leaves book
      if (this.bookGroup && this.bookGroup.scale) {
        this.bookGroup.scale.setScalar(this.data.scale);
      }
      if (this.bookMesh && this.bookMesh.material) {
        this.bookMesh.material.emissive.setHex(0x000000);
      }
    });
  },

  createFallbackBook() {
    // Create a simple book representation if loading fails
    const geometry = new THREE.BoxGeometry(0.15, 0.23, 0.03);
    const material = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    
    this.bookMesh = new THREE.Mesh(geometry, material);
    this.bookMesh.scale.setScalar(this.data.scale);
    
    this.el.setObject3D('book', this.bookMesh);
  },

  update: function (oldData) {
    if (oldData.epubUrl !== this.data.epubUrl && this.data.epubUrl) {
      this.loadBook(this.data.epubUrl);
    }
    
    if (oldData.scale !== this.data.scale && this.bookGroup) {
      this.bookGroup.scale.setScalar(this.data.scale);
    }
  },

  remove: function () {
    if (this.coverImageUrl) {
      URL.revokeObjectURL(this.coverImageUrl);
    }
  },

  openBook: function () {
    if (this.isLoaded && this.bookData) {
      this.el.emit('book-opened', { 
        bookData: this.bookData,
        epubUrl: this.data.epubUrl,
        coverImageUrl: this.coverImageUrl  // Include the cover image URL
      });
    } else {
      console.warn('VR Book: Cannot open book - not loaded or no book data');
    }
  }
});