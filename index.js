import { EPUBLoader } from './components/epub-loader.js';
import { BookmarkManager } from './components/bookmark-system.js';

// Main application logic
class XRBookReaderApp {
  constructor() {
    this.epubLoader = new EPUBLoader();
    this.bookmarkManager = new BookmarkManager();
    this.currentBookId = null;
    this.currentChapterIndex = 0;
    
    this.init();
  }

  async init() {
    ('XR Book Reader initialized');
    
    // Wait for A-Frame scene to load
    const scene = document.querySelector('a-scene');
    if (scene.hasLoaded) {
      this.onSceneLoaded();
    } else {
      scene.addEventListener('loaded', () => this.onSceneLoaded());
    }
  }

  onSceneLoaded() {
    // Get references to entities
    this.bookEntity = document.querySelector('#book');
    this.libraryEntity = document.querySelector('#library');
    this.bookshelfEntity = document.querySelector('#bookshelf');
    this.tocEntity = document.querySelector('#table-of-contents');
    
    // Load available books
    this.loadAvailableBooks();
    
    // Listen for book selection from 2D library
    this.libraryEntity.addEventListener('book-selected', (event) => {
      this.loadSelectedBook(event.detail.book);
    });
    
    // Listen for book selection from 3D bookshelf
    document.addEventListener('open-book-for-reading', async (event) => {
      await this.openBookFromShelf(event.detail);
    });
    
    // Listen for bookmark events
    this.bookEntity.addEventListener('bookmark-loaded', (event) => {
      this.loadBookmark(event.detail);
    });
    
    // Listen for automatic chapter progression
    this.bookEntity.addEventListener('chapter-end-reached', (event) => {
      if (event.detail.direction === 'next') {
        this.nextChapter();
      } else if (event.detail.direction === 'previous') {
        this.previousChapter();
      }
    });
    
    // Listen for TOC chapter selection
    this.tocEntity.addEventListener('chapter-selected', (event) => {
      this.loadChapter(event.detail.chapterIndex);
      this.showNotification(`Chapter ${event.detail.chapterIndex + 1}: ${event.detail.chapterTitle}`);
    });
    
    // Show welcome message
    this.showWelcomeMessage();
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Make app available globally for chapter navigation
    window.xrBookApp = this;
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyT' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        // Toggle TOC
        const tocComponent = this.tocEntity.components['table-of-contents'];
        if (tocComponent) {
          tocComponent.toggle();
        }
        event.preventDefault();
      }
    });
  }

  async loadAvailableBooks() {
    // Since we can't automatically list files from /books without a server,
    // we'll provide a way for users to manually specify books
    // You can extend this to use a manifest.json file in /books/
    
    try {
      const response = await fetch('/books/manifest.json');
      const manifest = await response.json();
      
      if (manifest.books && manifest.books.length > 0) {
        const library = this.libraryEntity.components['book-library'];
        library.setBooks(manifest.books);
      }
    } catch (error) {
      // Set empty library with instructions
      const library = this.libraryEntity.components['book-library'];
      library.setBooks([]);
    }
  }

  async loadSelectedBook(bookInfo) {
    try {
      const bookUrl = `/books/${bookInfo.filename}`;
      const book = await this.epubLoader.loadBook(bookUrl);
      
      this.currentBookId = bookInfo.filename;
      this.currentChapterIndex = 0;
      
      // Update book-display component with metadata and cover
      const bookDisplay = this.bookEntity.components['book-display'];
      if (bookDisplay) {
        // Update metadata
        const metadata = {
          title: book.metadata?.title || bookInfo.title || 'Unknown Title',
          author: book.metadata?.creator || 'Unknown Author',
          publisher: book.metadata?.publisher || '',
          pageCount: book.spine?.length || 100
        };
        bookDisplay.updateBookMetadata(metadata);
        
        // Update cover image if available from the VR book component
        const vrBook = this.bookEntity.components['vr-book'];
        if (vrBook && vrBook.coverImageUrl) {
          bookDisplay.updateCoverImage(vrBook.coverImageUrl);
        }
      }
      
      // Check for existing bookmark
      const bookmark = this.bookmarkManager.getBookmark(this.currentBookId);
      if (bookmark) {
        this.currentChapterIndex = bookmark.chapterIndex;
      }
      
      // Show reading interface
      this.showReadingInterface();
      
      // Update book-display with cover image after VR book component loads it
      const waitForCoverImage = async () => {
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 10 seconds
        
        while (attempts < maxAttempts) {
          const bookDisplay = this.bookEntity.components['book-display'];
          const vrBook = this.bookEntity.components['vr-book'];
          
          if (bookDisplay && vrBook && vrBook.coverImageUrl) {
            bookDisplay.updateCoverImage(vrBook.coverImageUrl);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          console.warn('Timeout waiting for cover image, proceeding without it');
        }
      };
      
      // Start cover image update in parallel
      waitForCoverImage();
      
      // Load first/bookmarked chapter
      await this.loadChapter(this.currentChapterIndex);
      
      // Update bookmark system
      const bookmarkSystem = this.bookEntity.components['bookmark-system'];
      if (bookmarkSystem) {
        bookmarkSystem.data.bookId = this.currentBookId;
        bookmarkSystem.data.chapterIndex = this.currentChapterIndex;
      }
    } catch (error) {
      console.error('Error loading book:', error);
      console.error('Error stack:', error.stack);
      alert('Failed to load book. Make sure the EPUB file exists in /books/');
    }
  }

  async openBookFromShelf(bookData) {
    // If the VR book already has loaded EPUB data, use it directly
    if (bookData.bookData && bookData.bookData.metadata) {
      // Set the current book data in our EPUB loader
      this.epubLoader.currentBook = bookData.bookData;
      this.currentBookId = bookData.epubUrl.replace('/books/', '');
      this.currentChapterIndex = 0;
      
      // Set up the vr-book component on the reading entity to show the cover
      const vrBook = this.bookEntity.components['vr-book'];
      if (vrBook && bookData.epubUrl) {
        console.log('Setting up vr-book component with EPUB URL:', bookData.epubUrl);
        vrBook.data.epubUrl = bookData.epubUrl;
        vrBook.loadBook(bookData.epubUrl);
      }
      
      // Check for existing bookmark
      const bookmark = this.bookmarkManager.getBookmark(this.currentBookId);
      if (bookmark) {
        this.currentChapterIndex = bookmark.chapterIndex;
      } else {
        // Find first chapter with substantial content (skip cover pages)
        this.currentChapterIndex = await this.findFirstContentChapter();
      }
      
      // Show reading interface
      this.showReadingInterface();
      
      // Load first/bookmarked chapter
      this.loadChapter(this.currentChapterIndex);
      
      // Update bookmark system
      const bookmarkSystem = this.bookEntity.components['bookmark-system'];
      if (bookmarkSystem) {
        bookmarkSystem.data.bookId = this.currentBookId;
        bookmarkSystem.data.chapterIndex = this.currentChapterIndex;
      }
      
      return;
    }
    
    // Fallback to loading from scratch
    let filename;
    let title = 'Unknown';
    let author = 'Unknown';
    
    // Extract filename from epubUrl
    if (bookData.epubUrl) {
      filename = bookData.epubUrl.replace('/books/', '');
    }
    
    // Fallback to extract from filename if no metadata
    if (filename) {
      // Try to extract title from filename
      title = filename.replace('.epub', '').replace(/by\s+[^.]+$/i, '');
      const authorMatch = filename.match(/by\s+([^.]+)\.epub$/i);
      if (authorMatch) {
        author = authorMatch[1];
      }
    }
    
    this.loadSelectedBook({
      filename: filename,
      title: title,
      author: author
    });
  }

  showReadingInterface() {
    // Hide bookshelf and show reading interface
    const bookshelfComponent = this.bookshelfEntity.components['virtual-bookshelf'];
    if (bookshelfComponent) {
      bookshelfComponent.forceHide();
    }
    this.bookEntity.setAttribute('visible', true);
    this.tocEntity.setAttribute('visible', true);
    
    // Set up TOC with current book chapters
    this.setupTableOfContents();
    
    // Position book at controller location or fallback to front of user
    this.positionBookAtController();
  }

  positionBookAtController() {
    // Simple positioning: place book directly in front of camera
    const camera = document.querySelector('#camera');
    
    if (camera && camera.object3D) {
      // Get camera world position and rotation
      const cameraWorldPos = new THREE.Vector3();
      const cameraWorldRot = new THREE.Quaternion();
      
      camera.object3D.getWorldPosition(cameraWorldPos);
      camera.object3D.getWorldQuaternion(cameraWorldRot);
      
      // Calculate position in front of camera (0.8 units forward, slightly down)
      const forwardDirection = new THREE.Vector3(0, 0, -0.3); // Forward and slightly down
      forwardDirection.applyQuaternion(cameraWorldRot);
      
      const bookPosition = cameraWorldPos.clone().add(forwardDirection);
      
      this.bookEntity.setAttribute('position', `${bookPosition.x} ${bookPosition.y} ${bookPosition.z}`);
    } else {
      // Fallback to traditional position in front of user
      this.bookEntity.setAttribute('position', '0 1.6 -2');
    }
  }

  showBookshelf() {
    // Show bookshelf and hide reading interface
    const bookshelfComponent = this.bookshelfEntity.components['virtual-bookshelf'];
    if (bookshelfComponent) {
      bookshelfComponent.showBookshelf();
    }
    this.bookEntity.setAttribute('visible', false);
    this.tocEntity.setAttribute('visible', false);
  }

  setupTableOfContents() {
    if (!this.epubLoader.currentBook) return;
    
    const tocComponent = this.tocEntity.components['table-of-contents'];
    if (!tocComponent) return;
    
    // Create chapter list from spine
    const chapters = this.epubLoader.currentBook.spine.map((spineId, index) => {
      // Try to get a meaningful title from the manifest
      const manifestItem = this.epubLoader.currentBook.manifest[spineId];
      let title = `Chapter ${index + 1}`;
      
      // If the href gives us a clue about the content, use it
      if (manifestItem && manifestItem.href) {
        const filename = manifestItem.href.split('/').pop().replace(/\.(xhtml|html)$/i, '');
        // Clean up common patterns
        if (filename && !filename.match(/^(cover|title|toc|index|\d+)$/i)) {
          title = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      
      return { title, index };
    });
    
    tocComponent.setChapters(chapters);
    tocComponent.setCurrentChapter(this.currentChapterIndex);
  }

  async loadChapter(chapterIndex) {
    try {
      const chapterText = await this.epubLoader.getChapterText(chapterIndex);
      
      const bookDisplay = this.bookEntity.components['book-display'];
      if (bookDisplay) {
        bookDisplay.setText(chapterText);
      } else {
        console.error('🔥 LOAD-CHAPTER: Book display component not found!');
      }
      
      this.currentChapterIndex = chapterIndex;
      
      // Update TOC current chapter indicator
      const tocComponent = this.tocEntity.components['table-of-contents'];
      if (tocComponent) {
        tocComponent.setCurrentChapter(chapterIndex);
      }
      
      // Update bookmark
      const bookmarkSystem = this.bookEntity.components['bookmark-system'];
      if (bookmarkSystem && this.currentBookId) {
        bookmarkSystem.data.chapterIndex = chapterIndex;
        bookmarkSystem.data.pageNumber = 0;
      }
    } catch (error) {
      console.error('🔥 LOAD-CHAPTER: Error loading chapter:', error);
      console.error('Error stack:', error.stack);
    }
  }

  async findFirstContentChapter() {
    // Look for the first chapter with substantial text content
    const totalChapters = this.epubLoader.currentBook.spine.length;
    
    for (let i = 0; i < Math.min(totalChapters, 5); i++) { // Check first 5 chapters max
      try {
        const chapterText = await this.epubLoader.getChapterText(i);
        const cleanText = chapterText.trim();
        
        // Consider chapter with substantial content if it has:
        // - More than 200 characters of text
        // - Not just whitespace/formatting
        if (cleanText.length > 200) {
          return i;
        }
      } catch (error) {
        console.warn('🔥 CONTENT-FINDER: Error checking chapter', i, ':', error);
      }
    }
    
    // Fallback to chapter 1 if no substantial content found
    return Math.min(1, totalChapters - 1);
  }

  loadBookmark(bookmark) {
    if (bookmark && bookmark.chapterIndex !== undefined) {
      this.loadChapter(bookmark.chapterIndex);
      
      // Set page number
      setTimeout(() => {
        const bookDisplay = this.bookEntity.components['book-display'];
        if (bookDisplay && bookmark.pageNumber !== undefined) {
          bookDisplay.currentPage = bookmark.pageNumber;
          bookDisplay.renderPage();
        }
      }, 500);
    }
  }

  showWelcomeMessage() {
    
  }

  nextChapter() {
    if (!this.epubLoader.currentBook) return;
    
    const totalChapters = this.epubLoader.currentBook.spine.length;
    if (this.currentChapterIndex < totalChapters - 1) {
      this.loadChapter(this.currentChapterIndex + 1);
      this.showNotification(`Chapter ${this.currentChapterIndex + 2} of ${totalChapters}`);
    } else {
      this.showNotification('You have reached the end of the book');
    }
  }

  previousChapter() {
    if (!this.epubLoader.currentBook) return;
    
    if (this.currentChapterIndex > 0) {
      this.loadChapter(this.currentChapterIndex - 1);
      this.showNotification(`Chapter ${this.currentChapterIndex} of ${this.epubLoader.currentBook.spine.length}`);
    } else {
      this.showNotification('You are at the beginning of the book');
    }
  }

  showNotification(message) {
    const notificationSystem = this.bookEntity.components['notification-system'];
    if (notificationSystem) {
      notificationSystem.showNotification(message, 3000);
    }
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new XRBookReaderApp();
  });
} else {
  window.app = new XRBookReaderApp();
}
