AFRAME.registerComponent("vr-library", {
    books: [],
    bookElements: [],
    rowMax: 5,
    bookSpace: .24,
    libraryElm: null,
    schema: {
        booksPath: { type: 'string', default: '/books/manifest.json' }
    },
    init: function () {
        this.libraryElm = document.createElement("a-entity");
        this.el.appendChild(this.libraryElm); // Append to the scene
        this.isVisible = true; // Track visibility state
        this.bookElements = []; // Store book elements for animation
        this.time = 0; // Animation time

        // Bind event handlers
        this.toggleVisibility = this.toggleVisibility.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);

        // Listen for keyboard events
        document.addEventListener('keydown', this.onKeyDown);

        // Listen for VR controller events
        document.addEventListener('xbuttondown', this.toggleVisibility);

        const scene = this.el.sceneEl
        const assetItems = scene.querySelectorAll('a-asset-item');
        const epubItems = Array.from(assetItems).filter(a => {
            const src = a.getAttribute('src') || a.src || '';
            return typeof src === 'string' && src.toLowerCase().endsWith('.epub');
        });

        if (epubItems.length > 0) {
            epubItems.forEach(a => {
                const id = a.getAttribute('id');
                const src = a.getAttribute('src') || a.src;
                if (id) {
                    // Use asset id when available so vr-book can load from a-assets
                    this.addBook({ assetId: id, src });
                } else if (src) {
                    this.addBook(src);
                }
            });
            return;
        }
    },
    addBook: function (book) {
        // book can be a string (src) or an object { assetId, src }
        this.books.push(book);

        const bookIndex = this.books.length - 1;

        // Calculate grid position
        const row = Math.floor(bookIndex / this.rowMax);
        const col = bookIndex % this.rowMax;

        // Calculate x and y positions using bookSpace
        const x = (col - (this.rowMax - 1) / 2) * this.bookSpace;
        const y = -row * this.bookSpace;

        let bookElm = document.createElement("a-entity");
        bookElm.setAttribute("position", `${x} ${y} 0`);
        // If caller provided an assetId, prefer that so vr-book loads from <a-assets>
        if (typeof book === 'object' && book.assetId) {
            bookElm.setAttribute('vr-book', { assetId: book.assetId });
        } else if (typeof book === 'object' && book.src) {
            bookElm.setAttribute('vr-book', { bookPath: book.src });
        } else {
            bookElm.setAttribute('vr-book', { bookPath: book });
        }

        // Store book element and original position for animation
        this.bookElements.push({
            element: bookElm,
            originalPos: { x: x, y: y, z: 0 },
            animationOffset: Math.random() * Math.PI * 2 // Random phase offset
        });

        this.libraryElm.appendChild(bookElm);
    },

    tick: function (time, timeDelta) {
        // Floating animation temporarily disabled to fix dragging issues
        // TODO: Re-enable with proper grab state detection

        // Update animation time
        this.time += timeDelta * 0.001; // Convert to seconds

        // Animate each book with floating motion
        this.bookElements.forEach((bookData) => {
            const { element, originalPos, animationOffset } = bookData;

            // Check if this book is currently grabbed - if so, skip floating animation
            const bookComponent = element.components['vr-book'];
            if (bookComponent && bookComponent.isGrabbed) {
                return; // Skip floating animation for grabbed books
            }

            // Create subtle floating animation
            const floatAmount = 0.01; // How much to float (in units)
            const speed = 0.8; // Animation speed

            // Calculate floating offset using sine wave
            const floatY = Math.sin(this.time * speed + animationOffset) * floatAmount;
            const floatX = Math.cos(this.time * speed * 0.7 + animationOffset) * floatAmount * 0.3;

            // Apply the floating animation to the position
            const newY = originalPos.y + floatY;
            const newX = originalPos.x + floatX;

            element.setAttribute('position', `${newX} ${newY} ${originalPos.z}`);
        });
    },

    onKeyDown: function (event) {
        // Check if 'h' key was pressed
        if (event.key === 'h' || event.key === 'H') {
            this.toggleVisibility();
        }
    },

    toggleVisibility: function () {
        this.isVisible = !this.isVisible;

        if (this.isVisible) {
            this.libraryElm.setAttribute('visible', true);
        } else {
            this.libraryElm.setAttribute('visible', false);
        }
    },

    remove: function () {
        // Clean up event listeners when component is removed
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('xbuttondown', this.toggleVisibility);
    }
});