AFRAME.registerComponent("vr-library", {
    books: [
        'a-modest-proposal-by-jonathan-swift',
        'a-room-with-a-view-by-e-m-forster',
        'alices-adventures-in-wonderland-by-lewis-carroll',
        'beowulf-an-anglo-saxon-epic-poem-by-j-lesslie-hall',
        'cranford-by-elizabeth-cleghorn-gaskell',
        'dracula-by-bram-stoker',
        'frankenstein-or-the-modern-prometheus',
        'history-of-tom-jones-a-foundling-by-henry-fielding',
        'jane-eyre-an-autobiography-by-charlotte-bronte',
        'leviathan-by-thomas-hobbes',
        'little-women-or-meg-jo-beth-and-amy-by-louisa-may-alcott',
        'middlemarch-by-george-eliot',
        'moby-dick-or-the-whale-by-herman-melville',
        'pride-and-prejudice-by-jane-austen',
        'romeo-and-juliet-by-william-shakespeare',
        'the-adventures-of-ferdinand-count-fathom-complete-by-t-smollett',
        'the-adventures-of-roderick-random-by-t-smollett',
        'the-blue-castle-a-novel-by-l-m-montgomery',
        'the-complete-works-of-william-shakespeare-by-william-shakespeare',
        'the-enchanted-april-by-elizabeth-von-arnim',
        'the-expedition-of-humphry-clinker-by-t-smollett',
        'the-picture-of-dorian-gray-by-oscar-wilde',
        'the-scarlet-letter-by-nathaniel-hawthorne',
        'the-strange-case-of-dr-jekyll-and-mr-hyde-by-robert-louis-stevenson',
        'twenty-years-after-by-alexandre-dumas-and-auguste-maquet'
    ],
    bookElements: [],
    rowMax: 5,
    bookSpace: .24,
    libraryElm: null,
    init: function () {
        this.libraryElm = document.createElement("a-entity");
        this.el.appendChild(this.libraryElm); // Append to the scene
        this.isVisible = true; // Track visibility state
        this._lastToggleTime = 0; // timestamp for debounce
        this.bookElements = []; // Store book elements for animation
        this.time = 0; // Animation time

        document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'h') this.toggleVisibility(); });
        document.addEventListener('bbuttondown', this.toggleVisibility.bind(this));

        this.books.forEach(this.addBook.bind(this));
    },
    addBook: function (book) {
        const bookIndex = this.bookElements.length;

        // Calculate grid position
        const row = Math.floor(bookIndex / this.rowMax);
        const col = bookIndex % this.rowMax;

        // Calculate x and y positions using bookSpace
        const x = (col - (this.rowMax - 1) / 2) * this.bookSpace;
        const y = -row * this.bookSpace;

        // Create slug id from filename/title
        const slugify = (s) => s.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const assetId = slugify(book.replace(/^books\//, '').replace(/\.epub$/, ''));

        let bookElm = document.createElement("a-entity");
        bookElm.setAttribute("position", `${x} ${y} 0`);
        // Pass the slug asset id into vr-book so it can look up the a-asset-item by id
        bookElm.setAttribute('vr-book', { bookPath: assetId });

        // Store book element and original position for animation
        this.bookElements.push({
            element: bookElm,
            originalPos: { x: x, y: y, z: 0 },
            animationOffset: Math.random() * Math.PI * 2 // Random phase offset
        });

        // Support both VR controller trigger events and desktop clicks
        bookElm.addEventListener('selected', (e) => this.moveBookToScene(bookElm, e));

        this.libraryElm.appendChild(bookElm);
    },

    /**
     * Move a book element out of the library and append it to the scene root.
     * Also remove it from internal arrays so the library no longer animates or manages it.
     */
    moveBookToScene: function (bookElm, triggerEvent) {
        if (!bookElm || !this.libraryElm) return;

        // Remove listeners attached by the library
        if (bookElm._vrLibraryTriggerHandler) {
            bookElm.removeEventListener('triggerdown', bookElm._vrLibraryTriggerHandler);
            bookElm.removeEventListener('click', bookElm._vrLibraryTriggerHandler);
            delete bookElm._vrLibraryTriggerHandler;
        }

        bookElm.setAttribute("vr-book", { active: true });
        // Remove by matching the element reference
        this.bookElements = this.bookElements.filter(bd => bd.element !== bookElm);
        return;

        // Remove from library DOM
        if (bookElm.parentElement === this.libraryElm) {
            this.libraryElm.removeChild(bookElm);
        }

        // Append to scene root so it becomes part of the world
        const parent = document.querySelector('#camera-rig');
        parent.appendChild(bookElm);
    },

    tick: function (time, timeDelta) {
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

    toggleVisibility: function () {
        const now = Date.now();
        const cooldown = 250; // ms
        if (now - this._lastToggleTime < cooldown) return; // ignore rapid toggles
        this._lastToggleTime = now;
        this.isVisible = !this.isVisible;
        this.libraryElm.setAttribute('visible', this.isVisible);
    },

    remove: function () {
        // Clean up event listeners when component is removed
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('xbuttondown', this.toggleVisibility);
    }
});