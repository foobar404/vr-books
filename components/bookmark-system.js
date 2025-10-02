// Bookmark system for saving reading progress

export class BookmarkManager {
  constructor() {
    this.storageKey = 'xr-book-reader-bookmarks';
    this.bookmarks = this.loadBookmarks();
  }

  loadBookmarks() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      return {};
    }
  }

  saveBookmarks() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
    } catch (error) {
      console.error('Error saving bookmarks:', error);
    }
  }

  setBookmark(bookId, chapterIndex, pageNumber) {
    this.bookmarks[bookId] = {
      chapterIndex,
      pageNumber,
      timestamp: Date.now()
    };
    this.saveBookmarks();
  }

  getBookmark(bookId) {
    return this.bookmarks[bookId] || null;
  }

  deleteBookmark(bookId) {
    delete this.bookmarks[bookId];
    this.saveBookmarks();
  }

  getAllBookmarks() {
    return { ...this.bookmarks };
  }
}

// A-Frame component for bookmark management
AFRAME.registerComponent('bookmark-system', {
  schema: {
    bookId: { type: 'string', default: '' },
    chapterIndex: { type: 'number', default: 0 },
    pageNumber: { type: 'number', default: 0 }
  },

  init: function () {
    this.manager = new BookmarkManager();
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      if (this.data.bookId) {
        this.saveBookmark();
      }
    }, 30000);
  },

  onKeyDown: function (event) {
    if (event.ctrlKey || event.metaKey) {
      switch(event.key) {
        case 's':
        case 'S':
          // Save bookmark
          event.preventDefault();
          this.saveBookmark();
          this.showNotification('Bookmark saved!');
          break;
          
        case 'o':
        case 'O':
          // Load bookmark
          event.preventDefault();
          this.loadBookmark();
          break;
      }
    }
    
    // Quick bookmark with 'm'
    if (event.key === 'm' || event.key === 'M') {
      this.saveBookmark();
      this.showNotification('Quick bookmark saved!');
    }
  },

  saveBookmark: function () {
    if (!this.data.bookId) {
      console.warn('No book ID set, cannot save bookmark');
      return;
    }
    
    this.manager.setBookmark(
      this.data.bookId,
      this.data.chapterIndex,
      this.data.pageNumber
    );
  },

  loadBookmark: function () {
    if (!this.data.bookId) {
      console.warn('No book ID set, cannot load bookmark');
      return null;
    }
    
    const bookmark = this.manager.getBookmark(this.data.bookId);
    if (bookmark) {
      this.el.emit('bookmark-loaded', bookmark);
      this.showNotification('Bookmark loaded!');
      return bookmark;
    } else {
      this.showNotification('No bookmark found for this book');
      return null;
    }
  },

  showNotification: function (message) {
    // Emit event that can be caught by notification system
    this.el.sceneEl.emit('notification', { message });
  },

  update: function (oldData) {
    // Update bookmark when page or chapter changes
    if (this.data.bookId && 
        (oldData.chapterIndex !== this.data.chapterIndex || 
         oldData.pageNumber !== this.data.pageNumber)) {
      // Don't auto-save on every page turn, only on interval
    }
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
});
