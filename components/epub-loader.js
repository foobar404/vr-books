// EPUB Loader Component
// Loads and parses EPUB3 files from the /books directory

export class EPUBLoader {
  constructor() {
    this.books = [];
    this.currentBook = null;
  }

  async loadBookList() {
    // In a real scenario, we'd need a server endpoint to list books
    // For now, we'll manually specify available books
    try {
      const response = await fetch('/books/');
      // This will likely fail without a proper server
      // So we'll implement manual book loading
      return [];
    } catch (error) {
      return [];
    }
  }

  async loadBook(url) {
    try {
      
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded. Make sure the JSZip CDN script is loaded.');
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch book: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      // Use JSZip to extract EPUB contents
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Parse container.xml to find content.opf
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('Invalid EPUB: META-INF/container.xml not found');
      }
      
      const containerXml = await containerFile.async('string');
      
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');
      const rootfileElement = containerDoc.querySelector('rootfile');
      
      if (!rootfileElement) {
        throw new Error('Invalid EPUB: rootfile element not found in container.xml');
      }
      
      const rootfilePath = rootfileElement.getAttribute('full-path');
      
      // Parse content.opf
      const contentOpfFile = zip.file(rootfilePath);
      if (!contentOpfFile) {
        throw new Error(`Invalid EPUB: ${rootfilePath} not found`);
      }
      
      const contentOpf = await contentOpfFile.async('string');
      
      const opfDoc = parser.parseFromString(contentOpf, 'text/xml');
      
      // Extract metadata
      const metadata = this.extractMetadata(opfDoc);
      
      // Extract spine (reading order)
      const spine = this.extractSpine(opfDoc);
      
      // Extract manifest (all files)
      const manifest = this.extractManifest(opfDoc);
      
      // Get content directory
      const contentDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
      
      this.currentBook = {
        metadata,
        spine,
        manifest,
        zip,
        contentDir
      };
      
      
      return this.currentBook;
    } catch (error) {
      console.error('🔥 EPUB-LOADER: Error loading book:', error);
      throw error;
    }
  }

  extractMetadata(opfDoc) {
    const metadata = {};
    const metadataEl = opfDoc.querySelector('metadata');
    
    metadata.title = metadataEl.querySelector('title')?.textContent || 'Unknown';
    metadata.creator = metadataEl.querySelector('creator')?.textContent || 'Unknown';
    metadata.language = metadataEl.querySelector('language')?.textContent || 'en';
    
    return metadata;
  }

  extractSpine(opfDoc) {
    const spineEl = opfDoc.querySelector('spine');
    const itemrefs = spineEl.querySelectorAll('itemref');
    return Array.from(itemrefs).map(ref => ref.getAttribute('idref'));
  }

  extractManifest(opfDoc) {
    const manifestEl = opfDoc.querySelector('manifest');
    const items = manifestEl.querySelectorAll('item');
    const manifest = {};
    
    items.forEach(item => {
      manifest[item.getAttribute('id')] = {
        href: item.getAttribute('href'),
        mediaType: item.getAttribute('media-type')
      };
    });
    
    return manifest;
  }

  async getChapter(chapterIndex) {
    if (!this.currentBook) {
      throw new Error('No book loaded');
    }
    
    const { spine, manifest, zip, contentDir } = this.currentBook;
    
    if (chapterIndex < 0 || chapterIndex >= spine.length) {
      throw new Error(`Chapter index ${chapterIndex} out of range (0-${spine.length - 1})`);
    }
    
    const chapterId = spine[chapterIndex];
    const chapterInfo = manifest[chapterId];
    
    if (!chapterInfo) {
      throw new Error(`Chapter not found in manifest: ${chapterId}`);
    }
    
    const chapterPath = contentDir + chapterInfo.href;
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) {
      throw new Error(`Chapter file not found: ${chapterPath}`);
    }
    
    const chapterContent = await chapterFile.async('string');
    
    return {
      content: chapterContent,
      index: chapterIndex,
      total: spine.length
    };
  }

  async getChapterText(chapterIndex) {
    try {
      const chapter = await this.getChapter(chapterIndex);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(chapter.content, 'text/html');
      
      // Return HTML content with images and formatting preserved
      const body = doc.querySelector('body');
      if (!body) {
        const docElement = doc.documentElement;
        const content = docElement ? docElement.innerHTML || docElement.textContent || '' : '';
        return content;
      }
      
      // Process images to ensure they have proper URLs
      const images = body.querySelectorAll('img');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          // Convert relative image paths to EPUB-relative paths
          if (this.currentBook && this.currentBook.archive) {
            try {
              // Try to find the image in the EPUB archive
              const imageFile = this.currentBook.archive.file(src);
              if (imageFile) {
                // Create blob URL for the image
                const imageData = imageFile.asUint8Array();
                const blob = new Blob([imageData], { type: this.getImageMimeType(src) });
                img.src = URL.createObjectURL(blob);
              }
            } catch (error) {
              console.warn('Could not process image:', src, error);
              img.alt = img.alt || 'Image not available';
            }
          }
        }
      });
      
      const content = body.innerHTML || body.textContent || '';
      
      if (content.length === 0) {
        console.warn('🔥 EPUB-LOADER: No content found in chapter body');
      } else {
      }
      
      return content;
    } catch (error) {
      console.error('🔥 EPUB-LOADER: Error extracting chapter text:', error);
      throw error;
    }
  }

  getImageMimeType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}
