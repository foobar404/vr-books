// A-Frame component for displaying book pages in VR

AFRAME.registerComponent('book-display', {
  schema: {
    width: { type: 'number', default: 0.25 }, // 25cm wide (scaled up for VR reading comfort)
    height: { type: 'number', default: 0.35 }, // 35cm tall (scaled up for VR reading comfort) 
    fontSize: { type: 'number', default: 36 }, // Reduced from 48 for better fitting
    textColor: { type: 'color', default: '#000000' },
    backgroundColor: { type: 'color', default: '#ffffff' },
    pageNumber: { type: 'number', default: 0 }
  },

  init: function () {
    // Initialize book properties
    this.bookMetadata = {};
    this.totalPages = 100; // Default, will be updated when content loads
    this.coverImageTexture = null;
    this.dominantColor = '#8B4513'; // Default brown
    this.coverAngle = 0; // Hinge angle for cover (0 = closed, Math.PI/2 = open)
    this.isAnimating = false;
    this.hoveredButton = null; // Track which button is being hovered
    
    // Create simple book display (just content for now)
    this.createSimpleBookDisplay();
    
    // Add grabbable functionality for VR
    this.setupGrabbableControls();
    
    // Setup interaction handlers
    this.setupInteraction();
    
    this.text = '';
    this.currentPage = 0;
    this.pages = [];
    this.linesPerPage = 26; // Increased from 20 to fit more content
    this.charsPerLine = 65; // Increased from 50 to fit more characters per line
  },

  createSimpleBookDisplay: function () {
    // Let the vr-book component handle the 3D book creation
    // We just handle the text content overlay
    
    // Create canvas for page content
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    
    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.format = THREE.RGBAFormat;
    this.texture.premultiplyAlpha = false;
    
    // Start with book cover display (no text overlay)
    this.renderCoverDisplay();
    
    // Wait for vr-book component to create the 3D model
    setTimeout(() => {
      this.setupFromVRBook();
    }, 100);
  },

  setupFromVRBook: function () {
    // Get the vr-book component that's on the same entity
    const vrBook = this.el.components['vr-book'];
    if (vrBook && vrBook.bookMesh) {
      // The vr-book handles the cover display, we just add text overlay when reading
      this.pageMesh = vrBook.bookMesh;
      console.log('book-display: Using vr-book mesh for interaction');
    } else {
      console.warn('book-display: vr-book component not found or not ready');
      // Retry after a delay
      setTimeout(() => {
        this.setupFromVRBook();
      }, 500);
    }
  },

  renderCoverDisplay: function () {
    // When not reading, show minimal overlay on the vr-book cover
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    if (!ctx || !canvas) return;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Add very subtle overlay to indicate interactivity
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.width);
    
    // Update texture
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  },

  updateBookMetadata: function (metadata) {
    this.bookMetadata = {
      title: metadata.title || 'Unknown Title',
      author: metadata.author || 'Unknown Author', 
      publisher: metadata.publisher || '',
      pageCount: metadata.pageCount || 100
    };
    
    // Update total pages
    this.totalPages = metadata.pageCount || 100;
  },

  // Simple texture helpers (removed complex book creation)

  updateBookMetadata: function (metadata) {
    this.bookMetadata = {
      title: metadata.title || 'Unknown Title',
      author: metadata.author || 'Unknown Author', 
      publisher: metadata.publisher || '',
      pageCount: metadata.pageCount || 100
    };
    
    // Update total pages for thickness calculation
    this.totalPages = metadata.pageCount || 100;
    
    // Store pending cover image URL if available
    this.pendingCoverImageUrl = this.pendingCoverImageUrl || null;
    
    // For now, just store metadata without recreating complex book
  },

  addPageTurnEffect: function (direction) {
    // Simple page turn effect (keep this for visual feedback)
    if (this.pageMesh && direction) {
      const targetRotation = direction === 'next' ? 0.05 : -0.05;
      
      // Quick rotation effect
      this.pageMesh.rotation.y = targetRotation;
      
      setTimeout(() => {
        if (this.pageMesh) {
          this.pageMesh.rotation.y = 0;
        }
      }, 150);
    }
  },

  setupInteraction: function () {
    // VR controller interaction
    this.el.addEventListener('triggerdown', (event) => {
      // Check if trigger was on navigation buttons
      const intersection = event.detail?.intersection;
      if (intersection && intersection.object === this.pageMesh) {
        this.handleNavigationButtonClick(intersection);
      }
    });

    // Mouse interaction for desktop
    this.el.addEventListener('click', (event) => {
      // Check if click was on navigation buttons
      const intersection = event.detail?.intersection;
      if (intersection && intersection.object === this.pageMesh) {
        this.handleNavigationButtonClick(intersection);
      }
    });

    // Mouse hover for button feedback
    this.el.addEventListener('mouseenter', (event) => {
      if (event.detail?.intersection?.object === this.pageMesh) {
        this.handleButtonHover(event.detail.intersection);
      }
    });

    this.el.addEventListener('mousehover', (event) => {
      if (event.detail?.intersection?.object === this.pageMesh) {
        this.handleButtonHover(event.detail.intersection);
      }
    });

    this.el.addEventListener('mouseleave', (event) => {
      this.hoveredButton = null;
      if (this.text && this.text.length > 0) {
        this.renderPage(); // Re-render to remove hover effects
      }
    });
  },

  setText: function (text) {
    if (!text || text.trim().length === 0) {
      console.warn('🔥 BOOK-DISPLAY: Empty or null text provided, showing fallback message');
      text = 'No content available for this chapter.';
    } 
    
    this.text = text;
    
    // Check if text contains HTML content
    if (text.includes('<') && text.includes('>')) {
      this.processHTMLContent(text);
    } else {
      this.pages = this.paginateText(text);
    }
    
    this.currentPage = 0;
    
    this.renderPage();
  },

  processHTMLContent: function(htmlContent) {
    try {
      // For now, extract plain text from HTML but preserve structure
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract text content while preserving some formatting
      const body = doc.querySelector('body') || doc.documentElement;
      let extractedText = '';
      
      // Process each element to maintain some structure
      this.extractTextWithStructure(body, (text) => {
        extractedText += text;
      });
      
      // Paginate the extracted text
      this.pages = this.paginateText(extractedText);
      
    } catch (error) {
      console.warn('Error processing HTML content, falling back to plain text:', error);
      this.pages = this.paginateText(htmlContent);
    }
  },

  extractTextWithStructure: function(element, callback) {
    if (!element) return;
    
    for (let node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          callback(text + ' ');
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        // Add line breaks for block elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'].includes(tagName)) {
          callback('\n\n');
        }
        
        // Handle images
        if (tagName === 'img') {
          const alt = node.alt || 'Image';
          callback(`[${alt}]\n\n`);
        } else {
          // Recursively process child elements
          this.extractTextWithStructure(node, callback);
        }
        
        // Add line breaks after block elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          callback('\n');
        }
      }
    }
  },

  paginateText: function (text) {
    const pages = [];
    const paragraphs = text.split('\n\n');
    
    // Create a temporary canvas for accurate text measurement
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1024;
    tempCanvas.height = 1024;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${this.data.fontSize}px "Georgia", serif`;
    
    // Calculate layout parameters (same as renderPage)
    const lineHeight = this.data.fontSize * 1.3;
    const startY = 40;
    const leftMargin = 40;
    const rightMargin = 40;
    const maxWidth = tempCanvas.width - leftMargin - rightMargin;
    const maxHeight = tempCanvas.height - 80; // Bottom margin
    
    let currentPage = [];
    let currentPageHeight = startY;
    
    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const paragraph = paragraphs[paragraphIndex].trim();
      
      if (!paragraph) {
        // Empty paragraph - add small spacing
        if (currentPageHeight + (lineHeight * 0.5) > maxHeight && currentPage.length > 0) {
          pages.push(currentPage.join('\n\n'));
          currentPage = [];
          currentPageHeight = startY;
        }
        currentPageHeight += lineHeight * 0.5;
        currentPage.push('');
        continue;
      }
      
      // Handle special formatting (like image placeholders)
      if (paragraph.startsWith('[') && paragraph.endsWith(']')) {
        // Image placeholder takes 2 line heights
        if (currentPageHeight + (lineHeight * 2) > maxHeight && currentPage.length > 0) {
          pages.push(currentPage.join('\n\n'));
          currentPage = [];
          currentPageHeight = startY;
        }
        currentPage.push(paragraph);
        currentPageHeight += lineHeight * 2 + lineHeight * 0.3;
        continue;
      }
      
      // Process regular text paragraph with accurate line wrapping
      const words = paragraph.split(' ');
      let currentLine = '';
      let paragraphLines = [];
      
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        const word = words[wordIndex];
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = tempCtx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          // Current line is full, save it and start new line
          paragraphLines.push(currentLine);
          currentLine = word;
        } else {
          // Word fits on current line
          currentLine = testLine;
        }
      }
      
      // Add the last line of the paragraph
      if (currentLine) {
        paragraphLines.push(currentLine);
      }
      
      // Calculate height needed for this paragraph
      const paragraphHeight = paragraphLines.length * lineHeight + lineHeight * 0.3; // Include paragraph spacing
      
      // Check if this paragraph fits on current page
      if (currentPageHeight + paragraphHeight > maxHeight && currentPage.length > 0) {
        // Start new page
        pages.push(currentPage.join('\n\n'));
        currentPage = [];
        currentPageHeight = startY;
      }
      
      // Add paragraph to current page
      currentPage.push(paragraphLines.join('\n'));
      currentPageHeight += paragraphHeight;
    }
    
    // Add the last page if it has content
    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n\n'));
    }
    
    // If we only got 1 page but the text is long, there might be a pagination issue
    if (pages.length === 1 && text.length > 1000) {
      console.warn('🔥 PAGINATION: Warning - large text resulted in only 1 page. Text length:', text.length);
    }
    
    return pages;
  },

  renderPage: function () {
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    if (!ctx || !canvas) {
      console.error('🔥 BOOK-DISPLAY: Canvas or context not available');
      return;
    }

    // Clear canvas with transparent background so paper material shows through
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle paper-like background overlay for better text readability
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // Semi-transparent white
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up text styling with slightly darker text for better contrast on paper
    ctx.fillStyle = '#2C2C2C'; // Darker text for better readability on paper
    ctx.font = `${this.data.fontSize}px "Georgia", serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Add subtle text shadow for paper-like depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 0.5;
    ctx.shadowOffsetY = 0.5;

    const pageText = this.pages[this.currentPage] || 'No content';
    const lineHeight = this.data.fontSize * 1.3; // Reduced line spacing from 1.4 to 1.3
    const startY = 40; // Reduced top margin from 60 to 40
    const leftMargin = 40; // Reduced left margin from 60 to 40
    const rightMargin = 40; // Reduced right margin from 60 to 40
    const maxWidth = canvas.width - leftMargin - rightMargin;

    let currentY = startY;

    // Split text into paragraphs
    const paragraphs = pageText.split('\n\n');

    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (currentY > canvas.height - 80) return; // Reduced bottom margin from 100 to 80

      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) {
        currentY += lineHeight * 0.5; // Small space for empty paragraphs
        return;
      }

      // Handle special formatting (like image placeholders)
      if (trimmedParagraph.startsWith('[') && trimmedParagraph.endsWith(']')) {
        // Image placeholder
        ctx.save();
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(leftMargin, currentY, maxWidth, lineHeight * 2);
        ctx.fillStyle = '#666666';
        ctx.font = `${this.data.fontSize * 0.8}px "Arial", sans-serif`;
        ctx.fillText(trimmedParagraph, leftMargin + 10, currentY + lineHeight * 0.3);
        ctx.restore();
        currentY += lineHeight * 2.5;
        return;
      }

      // Wrap text to fit within margins
      const words = trimmedParagraph.split(' ');
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          // Draw current line and start new one
          ctx.fillText(currentLine, leftMargin, currentY);
          currentY += lineHeight;
          currentLine = word;
          
          // Check if we're running out of space (using new bottom margin)
          if (currentY > canvas.height - 80) return;
        } else {
          currentLine = testLine;
        }
      });

      // Draw the last line of the paragraph
      if (currentLine && currentY <= canvas.height - 80) {
        ctx.fillText(currentLine, leftMargin, currentY);
        currentY += lineHeight;
      }

      // Add space between paragraphs
      currentY += lineHeight * 0.3;
    });

    // Add navigation buttons in top right corner
    this.renderNavigationButtons(ctx, canvas);

    // Add page number
    ctx.save();
    ctx.font = `${this.data.fontSize * 0.7}px "Arial", sans-serif`;
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'center';
    const pageNum = `${this.currentPage + 1} / ${this.pages.length}`;
    ctx.fillText(pageNum, canvas.width / 2, canvas.height - 30);
    ctx.restore();

    // Update texture
    if (this.texture) {
      this.texture.needsUpdate = true;
    } else {
      console.error('🔥 BOOK-DISPLAY: No texture available to update');
    }
  },

  renderNavigationButtons: function (ctx, canvas) {
    const baseButtonSize = 40;
    const buttonMargin = 20;
    const buttonY = 20;
    
    // Calculate button positions (top right corner)
    const prevButtonX = canvas.width - (baseButtonSize * 2) - (buttonMargin * 2);
    const nextButtonX = canvas.width - baseButtonSize - buttonMargin;
    
    // Adjust button size for hover effect
    const prevButtonSize = this.hoveredButton === 'prev' ? baseButtonSize + 4 : baseButtonSize;
    const nextButtonSize = this.hoveredButton === 'next' ? baseButtonSize + 4 : baseButtonSize;
    const prevOffsetX = this.hoveredButton === 'prev' ? -2 : 0;
    const nextOffsetX = this.hoveredButton === 'next' ? -2 : 0;
    const prevOffsetY = this.hoveredButton === 'prev' ? -2 : 0;
    const nextOffsetY = this.hoveredButton === 'next' ? -2 : 0;
    
    // Store button positions for click detection (use base size for consistent hit detection)
    this.prevButtonBounds = {
      x: prevButtonX,
      y: buttonY,
      width: baseButtonSize,
      height: baseButtonSize
    };
    
    this.nextButtonBounds = {
      x: nextButtonX,
      y: buttonY,
      width: baseButtonSize,
      height: baseButtonSize
    };
    
    // Save context state
    ctx.save();
    
    // Draw previous page button
    const canGoPrev = this.currentPage > 0;
    const isPrevHovered = this.hoveredButton === 'prev';
    
    // Button color with hover effect
    if (canGoPrev) {
      ctx.fillStyle = isPrevHovered ? '#66BB6A' : '#4CAF50'; // Lighter green on hover
    } else {
      ctx.fillStyle = '#E0E0E0';
    }
    
    ctx.strokeStyle = isPrevHovered ? '#2E7D32' : '#333333'; // Darker border on hover
    ctx.lineWidth = isPrevHovered ? 3 : 2; // Thicker border on hover
    
    // Button background with subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = isPrevHovered ? 8 : 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Add glow effect when hovered
    if (isPrevHovered && canGoPrev) {
      ctx.shadowColor = 'rgba(76, 175, 80, 0.6)';
      ctx.shadowBlur = 12;
    }
    
    ctx.fillRect(prevButtonX + prevOffsetX, buttonY + prevOffsetY, prevButtonSize, prevButtonSize);
    
    // Remove shadow for border
    ctx.shadowColor = 'transparent';
    ctx.strokeRect(prevButtonX + prevOffsetX, buttonY + prevOffsetY, prevButtonSize, prevButtonSize);
    
    // Arrow left (◄)
    ctx.fillStyle = canGoPrev ? '#FFFFFF' : '#999999';
    ctx.font = isPrevHovered ? 'bold 22px Arial' : 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◄', prevButtonX + prevOffsetX + prevButtonSize/2, buttonY + prevOffsetY + prevButtonSize/2);
    
    // Draw next page button
    const canGoNext = this.currentPage < this.pages.length - 1;
    const isNextHovered = this.hoveredButton === 'next';
    
    // Button color with hover effect
    if (canGoNext) {
      ctx.fillStyle = isNextHovered ? '#66BB6A' : '#4CAF50'; // Lighter green on hover
    } else {
      ctx.fillStyle = '#E0E0E0';
    }
    
    ctx.strokeStyle = isNextHovered ? '#2E7D32' : '#333333'; // Darker border on hover
    ctx.lineWidth = isNextHovered ? 3 : 2; // Thicker border on hover
    
    // Button background with subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = isNextHovered ? 8 : 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Add glow effect when hovered
    if (isNextHovered && canGoNext) {
      ctx.shadowColor = 'rgba(76, 175, 80, 0.6)';
      ctx.shadowBlur = 12;
    }
    
    ctx.fillRect(nextButtonX + nextOffsetX, buttonY + nextOffsetY, nextButtonSize, nextButtonSize);
    
    // Remove shadow for border
    ctx.shadowColor = 'transparent';
    ctx.strokeRect(nextButtonX + nextOffsetX, buttonY + nextOffsetY, nextButtonSize, nextButtonSize);
    
    // Arrow right (►)
    ctx.fillStyle = canGoNext ? '#FFFFFF' : '#999999';
    ctx.font = isNextHovered ? 'bold 22px Arial' : 'bold 20px Arial';
    ctx.fillText('►', nextButtonX + nextOffsetX + nextButtonSize/2, buttonY + nextOffsetY + nextButtonSize/2);
    
    // Add small labels below buttons
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Prev', prevButtonX + prevOffsetX + prevButtonSize/2, buttonY + prevOffsetY + prevButtonSize + 15);
    ctx.fillText('Next', nextButtonX + nextOffsetX + nextButtonSize/2, buttonY + nextOffsetY + nextButtonSize + 15);
    
    // Restore context state
    ctx.restore();
  },

  handleNavigationButtonClick: function (intersection) {
    if (!intersection || !intersection.uv) return;
    
    // Convert UV coordinates to canvas pixel coordinates
    const u = intersection.uv.x;
    const v = 1 - intersection.uv.y; // Flip V coordinate
    const x = u * this.canvas.width;
    const y = v * this.canvas.height;
    
    // Check if click is within previous button bounds
    if (this.prevButtonBounds && 
        x >= this.prevButtonBounds.x && 
        x <= this.prevButtonBounds.x + this.prevButtonBounds.width &&
        y >= this.prevButtonBounds.y && 
        y <= this.prevButtonBounds.y + this.prevButtonBounds.height) {
      
      if (this.currentPage > 0) {
        this.previousPage();
      }
      return;
    }
    
    // Check if click is within next button bounds
    if (this.nextButtonBounds && 
        x >= this.nextButtonBounds.x && 
        x <= this.nextButtonBounds.x + this.nextButtonBounds.width &&
        y >= this.nextButtonBounds.y && 
        y <= this.nextButtonBounds.y + this.nextButtonBounds.height) {
      
      if (this.currentPage < this.pages.length - 1) {
        this.nextPage();
      }
      return;
    }
  },

  handleButtonHover: function (intersection) {
    if (!intersection || !intersection.uv) return;
    
    // Convert UV coordinates to canvas pixel coordinates
    const u = intersection.uv.x;
    const v = 1 - intersection.uv.y; // Flip V coordinate
    const x = u * this.canvas.width;
    const y = v * this.canvas.height;
    
    let newHoveredButton = null;
    
    // Check if hover is within previous button bounds
    if (this.prevButtonBounds && 
        x >= this.prevButtonBounds.x && 
        x <= this.prevButtonBounds.x + this.prevButtonBounds.width &&
        y >= this.prevButtonBounds.y && 
        y <= this.prevButtonBounds.y + this.prevButtonBounds.height) {
      newHoveredButton = 'prev';
    }
    // Check if hover is within next button bounds
    else if (this.nextButtonBounds && 
        x >= this.nextButtonBounds.x && 
        x <= this.nextButtonBounds.x + this.nextButtonBounds.width &&
        y >= this.nextButtonBounds.y && 
        y <= this.nextButtonBounds.y + this.nextButtonBounds.height) {
      newHoveredButton = 'next';
    }
    
    // Only re-render if hover state changed
    if (this.hoveredButton !== newHoveredButton) {
      this.hoveredButton = newHoveredButton;
      this.renderPage();
    }
  },

  nextPage: function () {
    if (this.currentPage < this.pages.length - 1) {
      this.currentPage++;
      this.addPageTurnEffect('next');
      this.renderPage();
      return true;
    } else {
      this.addPageTurnEffect('next');
      // Emit event to request next chapter
      this.el.emit('chapter-end-reached', { direction: 'next' });
      return false;
    }
  },

  previousPage: function () {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.addPageTurnEffect('previous');
      this.renderPage();
      return true;
    } else {
      this.addPageTurnEffect('previous');
      // Emit event to request previous chapter
      this.el.emit('chapter-end-reached', { direction: 'previous' });
      return false;
    }
  },

  setupGrabbableControls: function() {
    // Add grabbable attribute for VR controllers
    this.el.setAttribute('class', 'grabbable');
    
    // Store initial transform
    this.initialPosition = this.el.getAttribute('position');
    this.initialRotation = this.el.getAttribute('rotation');
    this.initialScale = this.el.getAttribute('scale') || {x: 1, y: 1, z: 1};
    
    // Track grabbing state
    this.isGrabbed = false;
    this.grabbingController = null;
    
    // Setup controller event listeners
    this.el.addEventListener('gripdown', (event) => {
      this.startGrab(event);
    });
    
    this.el.addEventListener('gripup', (event) => {
      this.endGrab(event);
    });
    
    // Setup joystick scaling
    this.setupJoystickScaling();
  },

  startGrab: function(event) {
    if (!this.isGrabbed) {
      this.isGrabbed = true;
      this.grabbingController = event.target;
      
      // Store relative transform
      const bookPosition = this.el.object3D.position;
      const controllerPosition = this.grabbingController.object3D.position;
      const controllerRotation = this.grabbingController.object3D.rotation;
      
      this.grabOffset = {
        position: bookPosition.clone().sub(controllerPosition),
        rotation: new THREE.Euler().copy(controllerRotation)
      };
      
    }
  },

  endGrab: function(event) {
    if (this.isGrabbed && this.grabbingController === event.target) {
      this.isGrabbed = false;
      this.grabbingController = null;
    }
  },

  setupJoystickScaling: function() {
    // Listen for thumbstick events from controllers
    document.addEventListener('thumbstickmoved', (event) => {
      if (this.isGrabbed && event.target === this.grabbingController) {
        const joystickY = event.detail.y; // Up/down movement
        
        // Scale book based on joystick Y axis
        const scaleChange = joystickY * 0.01; // Sensitivity adjustment
        const currentScale = this.el.object3D.scale;
        const newScale = Math.max(0.1, Math.min(3.0, currentScale.x + scaleChange)); // Clamp between 0.1 and 3.0
        
        this.el.object3D.scale.set(newScale, newScale, newScale);
      }
    });
  },

  tick: function() {
    // Update book position when grabbed
    if (this.isGrabbed && this.grabbingController) {
      const controllerPosition = this.grabbingController.object3D.position;
      const controllerRotation = this.grabbingController.object3D.rotation;
      
      // Apply the grab offset
      const newPosition = controllerPosition.clone().add(this.grabOffset.position);
      this.el.object3D.position.copy(newPosition);
      
      // Optional: Also rotate with controller
      this.el.object3D.rotation.copy(controllerRotation);
    }
  },

  update: function (oldData) {
    if (oldData.pageNumber !== this.data.pageNumber) {
      this.currentPage = this.data.pageNumber;
      this.renderPage();
    }
  }
});
