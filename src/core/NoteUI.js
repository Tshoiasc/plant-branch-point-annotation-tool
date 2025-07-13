/**
 * Note System UI Component
 * 
 * Features:
 * - Note modal dialogs
 * - Note list display
 * - Note editor
 * - Note search
 */

export class NoteUI {
  constructor(noteManager) {
    this.noteManager = noteManager;
    this.currentPlantId = null;
    this.currentImageId = null;
    this.currentNote = null;
    this.isEditMode = false;
    
    this.initializeUI();
  }

  /**
   * Initialize UI components
   */
  initializeUI() {
    // Delay initialization of all UI components to ensure DOM is fully loaded
    setTimeout(() => {
      this.createNoteModal();
      this.createNoteListModal();
      this.setupEventListeners();
      this.createNoteButtons();
      this.injectNoteStyles(); // 🔧 FIX: Add styles for separated note display
      console.log('[NoteUI] UI initialization completed with note separation styles');
      
      // Initialize plant note badges after a short delay
      setTimeout(() => {
        this.updateAllPlantNoteBadges();
      }, 500);
      
      // ADDITIONAL SAFETY: Update badges again after a longer delay to catch any timing issues
      setTimeout(() => {
        console.log('[NoteUI] Running additional badge update for safety');
        this.updateAllPlantNoteBadges();
      }, 2000);
    }, 200);
  }

  /**
   * Create note modal with improved styling
   */
  createNoteModal() {
    console.log('[NoteUI] Creating note modal');
    const modal = document.createElement('div');
    modal.id = 'note-modal';
    modal.className = 'modal';
    modal.style.display = 'none'; // Ensure initial state is hidden
    modal.innerHTML = `
      <div class="modal-content note-modal-content">
        <div class="modal-header">
          <h2 id="note-modal-title">Add Note</h2>
          <button class="close-button" id="note-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="note-form">
            <div class="form-group">
              <label for="note-title">Title <span class="required">*</span></label>
              <input type="text" id="note-title" maxlength="100" required placeholder="Enter note title...">
              <div class="char-counter">
                <span id="note-title-count">0</span>/100
              </div>
            </div>
            
            <div class="form-group">
              <label for="note-type">Type</label>
              <select id="note-type">
                <option value="general">General Note</option>
                <option value="observation">Observation Record</option>
                <option value="annotation">Annotation Description</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="note-content">Content <span class="required">*</span></label>
              <textarea id="note-content" rows="6" maxlength="5000" required placeholder="Enter note content..."></textarea>
              <div class="char-counter">
                <span id="note-content-count">0</span>/5000
              </div>
            </div>
            
            <div class="form-group">
              <label for="note-tags">Tags</label>
              <input type="text" id="note-tags" placeholder="Separate multiple tags with commas">
              <div class="form-help">Example: observation, growth, issue</div>
            </div>
            
            <div class="form-group">
              <label for="note-author">Author</label>
              <input type="text" id="note-author" value="User" placeholder="Enter author name">
            </div>
            
            <!-- 🔧 NEW: Backward Propagation Option -->
            <div class="form-group" id="backward-propagation-group" style="display: none;">
              <div class="checkbox-wrapper">
                <label class="checkbox-label">
                  <input type="checkbox" id="note-backward-propagation">
                  <span class="checkbox-text">Backward Propagation</span>
                </label>
                <div class="form-help">Apply this note to all later-dated images of the current plant</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="note-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="note-save-btn">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    console.log('[NoteUI] Note modal created and set to hidden');
  }

  /**
   * Create note list modal with improved styling
   */
  createNoteListModal() {
    console.log('[NoteUI] Creating note list modal');
    const modal = document.createElement('div');
    modal.id = 'note-list-modal';
    modal.className = 'modal';
    modal.style.display = 'none'; // Ensure initial state is hidden
    modal.innerHTML = `
      <div class="modal-content note-list-modal-content">
        <div class="modal-header">
          <h2 id="note-list-modal-title">Note List</h2>
          <button class="close-button" id="note-list-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="note-list-controls">
            <div class="search-group">
              <input type="text" id="note-search" placeholder="Search notes...">
              <button class="btn btn-sm btn-secondary" id="note-search-btn">Search</button>
            </div>
            <div class="filter-group">
              <select id="note-type-filter">
                <option value="">All Types</option>
                <option value="general">General Note</option>
                <option value="observation">Observation Record</option>
                <option value="annotation">Annotation Description</option>
              </select>
              <button class="btn btn-sm btn-primary" id="add-note-btn">Add Note</button>
            </div>
          </div>
          <div class="note-list-container">
            <div id="note-list-content">
              <div class="loading-message">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    console.log('[NoteUI] Note list modal created and set to hidden');
  }

  /**
   * Create note buttons
   */
  createNoteButtons() {
    this.createPlantNoteButton();
    this.createImageNoteButton();
    // 🔧 REMOVED: Note display areas no longer needed - counts shown in buttons
  }

  /**
   * Create plant notes button in toolbar
   */
  createPlantNoteButton() {
    // Find toolbar section
    const toolbarSection = document.querySelector('.toolbar-section');
    if (!toolbarSection) {
      console.warn('[NoteUI] Toolbar section not found, creating fallback container');
      this.createFallbackPlantNoteContainer();
      return;
    }
    
    // Remove existing button
    const existingBtn = document.getElementById('plant-note-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    // Create button container within toolbar
    let noteContainer = toolbarSection.querySelector('.plant-notes-section');
    if (!noteContainer) {
      noteContainer = document.createElement('div');
      noteContainer.className = 'plant-notes-section';
      noteContainer.style.cssText = `
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--border-color);
      `;
      toolbarSection.appendChild(noteContainer);
    }
    
    // Create the button with note count display
    const noteBtn = document.createElement('button');
    noteBtn.id = 'plant-note-btn';
    noteBtn.className = 'btn btn-small btn-secondary';
    noteBtn.innerHTML = '📝 Plant Notes <span id="plant-note-count" class="note-count-display"></span>';
    noteBtn.title = 'View or add plant notes';
    noteBtn.style.cssText = `
      display: none;
      width: 100%;
      margin-bottom: 5px;
      position: relative;
    `;
    noteContainer.appendChild(noteBtn);
    
    console.log('[NoteUI] Plant notes button created in toolbar with count display');
  }
  
  /**
   * Create fallback container if toolbar not found
   */
  createFallbackPlantNoteContainer() {
    const container = document.createElement('div');
    container.className = 'plant-note-container';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      display: none;
    `;
    document.body.appendChild(container);
    
    const noteBtn = document.createElement('button');
    noteBtn.id = 'plant-note-btn';
    noteBtn.className = 'btn btn-info btn-sm note-btn';
    noteBtn.innerHTML = '📝 Plant Notes';
    noteBtn.title = 'View or add plant notes';
    noteBtn.style.display = 'none';
    container.appendChild(noteBtn);
  }

  /**
   * Create image notes button in annotation controls
   */
  createImageNoteButton() {
    console.log('[NoteUI] Creating image notes button');
    
    // Find annotation controls container
    const annotationControls = document.querySelector('.annotation-controls');
    if (!annotationControls) {
      console.warn('[NoteUI] Annotation controls not found, creating fallback container');
      this.createFallbackImageNoteContainer();
      return;
    }
    
    // Remove existing button
    const existingBtn = document.getElementById('image-note-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    // Create the icon button to match annotation controls style with count display
    const noteBtn = document.createElement('button');
    noteBtn.id = 'image-note-btn';
    noteBtn.className = 'btn btn-icon';
    noteBtn.innerHTML = '📝<span id="image-note-count" class="note-count-overlay"></span>';
    noteBtn.title = 'View or add image notes';
    noteBtn.style.cssText = `
      display: none;
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 16px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      pointer-events: auto;
      cursor: pointer;
      border-radius: 0.375rem;
      position: relative;
    `;
    
    // Add to annotation controls
    annotationControls.appendChild(noteBtn);
    
    console.log('[NoteUI] Image notes button created in annotation controls with count display');
  }
  
  /**
   * Create fallback container if annotation controls not found
   */
  createFallbackImageNoteContainer() {
    const container = document.createElement('div');
    container.className = 'image-note-container';
    container.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      display: none;
    `;
    document.body.appendChild(container);
    
    const noteBtn = document.createElement('button');
    noteBtn.id = 'image-note-btn';
    noteBtn.className = 'btn btn-info btn-sm note-btn';
    noteBtn.innerHTML = '📝';
    noteBtn.title = 'View or add image notes';
    noteBtn.style.cssText = `
      display: none;
      pointer-events: auto;
      cursor: pointer;
    `;
    container.appendChild(noteBtn);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Delay event listener setup to ensure DOM elements are created
    setTimeout(() => {
      this.setupModalEventListeners();
      this.setupButtonEventListeners();
      this.setupInputEventListeners();
      // 🔧 REMOVED: Note display event listeners no longer needed
    }, 200);
  }

  /**
   * Setup modal event listeners
   */
  setupModalEventListeners() {
    // Note modal events
    const noteModalClose = document.getElementById('note-modal-close');
    if (noteModalClose) {
      noteModalClose.addEventListener('click', () => {
        this.closeNoteModal();
      });
    }

    const noteCancelBtn = document.getElementById('note-cancel-btn');
    if (noteCancelBtn) {
      noteCancelBtn.addEventListener('click', () => {
        this.closeNoteModal();
      });
    }

    const noteSaveBtn = document.getElementById('note-save-btn');
    if (noteSaveBtn) {
      noteSaveBtn.addEventListener('click', () => {
        this.saveNote();
      });
    }

    // Note list modal events
    const noteListModalClose = document.getElementById('note-list-modal-close');
    if (noteListModalClose) {
      noteListModalClose.addEventListener('click', () => {
        this.closeNoteListModal();
      });
    }

    const addNoteBtn = document.getElementById('add-note-btn');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => {
        this.closeNoteListModal();
        this.showNoteModal();
      });
    }

    const noteSearchBtn = document.getElementById('note-search-btn');
    if (noteSearchBtn) {
      noteSearchBtn.addEventListener('click', () => {
        this.searchNotes();
      });
    }

    const noteSearch = document.getElementById('note-search');
    if (noteSearch) {
      noteSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchNotes();
        }
      });
    }

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.id === 'note-modal') {
        this.closeNoteModal();
      }
      if (e.target.id === 'note-list-modal') {
        this.closeNoteListModal();
      }
    });
  }

  /**
   * Setup button event listeners
   */
  setupButtonEventListeners() {
    // Plant notes button
    const plantNoteBtn = document.getElementById('plant-note-btn');
    if (plantNoteBtn) {
      console.log('[NoteUI] Plant notes button found, binding events');
      plantNoteBtn.addEventListener('click', (event) => {
        console.log('[NoteUI] Plant notes button clicked');
        event.preventDefault();
        this.showPlantNotes();
      });
    } else {
      console.warn('[NoteUI] Plant notes button not found');
    }

    // Image notes button
    const imageNoteBtn = document.getElementById('image-note-btn');
    if (imageNoteBtn) {
      console.log('[NoteUI] Image notes button found, binding events');
      imageNoteBtn.addEventListener('click', (event) => {
        console.log('[NoteUI] Image notes button clicked');
        event.preventDefault();
        this.showImageNotes();
      });
    } else {
      console.warn('[NoteUI] Image notes button not found');
    }
  }

  /**
   * Setup input field event listeners
   */
  setupInputEventListeners() {
    // Character counter
    const noteTitle = document.getElementById('note-title');
    if (noteTitle) {
      noteTitle.addEventListener('input', () => {
        this.updateCharCounter('note-title', 'note-title-count', 100);
      });
    }

    const noteContent = document.getElementById('note-content');
    if (noteContent) {
      noteContent.addEventListener('input', () => {
        this.updateCharCounter('note-content', 'note-content-count', 5000);
      });
    }
  }

  /**
   * Show plant notes
   */
  async showPlantNotes() {
    console.log('[NoteUI] showPlantNotes called');
    if (!this.currentPlantId) {
      console.warn('[NoteUI] No plant selected, cannot show plant notes');
      this.showUserError('Please select a plant', 'You need to select a plant to view notes');
      return;
    }

    // 🔧 FIX: 确保在显示植物笔记时清除图像ID，防止误创建图像笔记
    this.currentImageId = null;
    console.log('[NoteUI] Cleared currentImageId to ensure plant notes creation');
    
    document.getElementById('note-list-modal-title').textContent = `Plant Notes - ${this.currentPlantId}`;
    
    const modal = document.getElementById('note-list-modal');
    if (modal) {
      console.log('[NoteUI] Showing plant notes modal');
      modal.style.display = 'flex';
    }
    
    try {
      await this.loadNoteList();
    } catch (error) {
      console.error('[NoteUI] Failed to load plant notes:', error);
      this.showUserError('Failed to load notes', error.message);
    }
  }

  /**
   * Show image notes
   */
  async showImageNotes() {
    console.log('[NoteUI] showImageNotes called');
    console.log(`[NoteUI] Current state - plantId: ${this.currentPlantId}, imageId: ${this.currentImageId}`);
    
    // Also check the global app state as a fallback
    const globalAppState = window.PlantAnnotationTool?.appState;
    const fallbackPlantId = globalAppState?.currentPlant?.id;
    const fallbackImageId = globalAppState?.currentImage?.id;
    
    console.log(`[NoteUI] Fallback state - plantId: ${fallbackPlantId}, imageId: ${fallbackImageId}`);
    
    const effectivePlantId = this.currentPlantId || fallbackPlantId;
    const effectiveImageId = this.currentImageId || fallbackImageId;
    
    if (!effectivePlantId || !effectiveImageId) {
      console.warn('[NoteUI] No plant or image selected, cannot show image notes');
      this.showUserError('Please select plant and image', 'You need to select both plant and image to view image notes');
      return;
    }
    
    // Update current state if we used fallback values
    if (!this.currentPlantId && fallbackPlantId) {
      this.currentPlantId = fallbackPlantId;
    }
    if (!this.currentImageId && fallbackImageId) {
      this.currentImageId = fallbackImageId;
    }

    document.getElementById('note-list-modal-title').textContent = `Image Notes - ${effectiveImageId}`;
    
    const modal = document.getElementById('note-list-modal');
    if (modal) {
      console.log('[NoteUI] Showing image notes modal');
      modal.style.display = 'flex';
    }
    
    try {
      await this.loadNoteList();
    } catch (error) {
      console.error('[NoteUI] Failed to load image notes:', error);
      this.showUserError('Failed to load notes', error.message);
    }
  }

  /**
   * Load note list (unified to show ALL notes for plant, consistent with search)
   */
  async loadNoteList() {
    const listContainer = document.getElementById('note-list-content');
    listContainer.innerHTML = '<div class="loading-message">Loading...</div>';

    try {
      let notes;
      if (this.currentImageId) {
        // For image notes, get specific image notes
        notes = await this.noteManager.getImageNotes(this.currentPlantId, this.currentImageId);
        console.log(`[NoteUI] Loaded ${notes.length} image notes for ${this.currentImageId}`);
      } else {
        // 🔧 FIX: For plant modal initial load, show ONLY plant-level notes
        // Search function will show all notes when user explicitly searches
        console.log(`[NoteUI] Loading plant-level notes only for ${this.currentPlantId}`);
        notes = await this.noteManager.getPlantNotes(this.currentPlantId);
        console.log(`[NoteUI] Plant API loaded ${notes.length} plant-only notes for ${this.currentPlantId}`);
      }

      this.renderNoteList(notes);
      console.log(`[NoteUI] Modal refreshed with ${notes.length} notes`);
    } catch (error) {
      console.error('Failed to load note list:', error);
      listContainer.innerHTML = `<div class="error-message">Loading failed: ${error.message}</div>`;
    }
  }

  /**
   * Render note list with proper plant/image note separation
   */
  renderNoteList(notes) {
    const listContainer = document.getElementById('note-list-content');
    
    if (!notes || notes.length === 0) {
      listContainer.innerHTML = '<div class="empty-message">No notes available</div>';
      return;
    }

    // 🔧 FIX: Separate plant-level notes from image-level notes
    const plantNotes = notes.filter(note => !note.imageId);
    const imageNotes = notes.filter(note => note.imageId);
    
    console.log(`[NoteUI] Rendering ${plantNotes.length} plant notes and ${imageNotes.length} image notes`);

    let html = '';
    
    // Render plant-level notes section
    if (plantNotes.length > 0) {
      html += `
        <div class="notes-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon">📝</span>
              Plant Notes (${plantNotes.length})
            </h3>
          </div>
          <div class="notes-list">
            ${this.renderNoteItems(plantNotes, 'plant')}
          </div>
        </div>
      `;
    }
    
    // Render image-level notes section
    if (imageNotes.length > 0) {
      html += `
        <div class="notes-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="section-icon">🖼️</span>
              Image Notes (${imageNotes.length})
            </h3>
          </div>
          <div class="notes-list">
            ${this.renderNoteItems(imageNotes, 'image')}
          </div>
        </div>
      `;
    }

    listContainer.innerHTML = html;

    // Bind edit and delete events
    this.bindNoteActionEvents(listContainer);
  }

  /**
   * Helper method to render note items with proper type indicators
   */
  renderNoteItems(notes, noteScope) {
    return notes.map(note => {
      const formattedNote = this.noteManager.formatNoteForDisplay(note);
      
      // 🔧 FIX: Add visual indicators and image info for different note types
      let scopeIndicator = '';
      let imageInfo = '';
      
      if (noteScope === 'plant') {
        scopeIndicator = '<span class="note-scope plant-scope">📝 Plant</span>';
      } else if (noteScope === 'image') {
        scopeIndicator = '<span class="note-scope image-scope">🖼️ Image</span>';
        // Extract image name from imageId for display
        const imageName = note.imageId ? note.imageId.split('_').slice(-1)[0] : 'Unknown';
        imageInfo = `<div class="image-info">📷 Image: ${this.escapeHtml(imageName)}</div>`;
      }
      
      return `
        <div class="note-item ${noteScope}-note" data-note-id="${note.noteId}">
          <div class="note-item-header">
            <h4 class="note-title">${this.escapeHtml(formattedNote.title)}</h4>
            <div class="note-actions">
              <button class="btn btn-sm btn-secondary edit-note-btn" data-note-id="${note.noteId}">Edit</button>
              <button class="btn btn-sm btn-danger delete-note-btn" data-note-id="${note.noteId}">Delete</button>
            </div>
          </div>
          <div class="note-item-meta">
            ${scopeIndicator}
            <span class="note-type note-type-${note.noteType}">${this.getNoteTypeText(note.noteType)}</span>
            <span class="note-timestamp">${formattedNote.formattedTimestamp}</span>
            <span class="note-author">Author: ${this.escapeHtml(note.author)}</span>
          </div>
          ${imageInfo}
          <div class="note-content">
            ${this.escapeHtml(formattedNote.shortContent)}
          </div>
          ${note.tags.length > 0 ? `
            <div class="note-tags">
              ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Helper method to bind note action events
   */
  bindNoteActionEvents(container) {
    container.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = e.target.dataset.noteId;
        this.editNote(noteId);
      });
    });

    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = e.target.dataset.noteId;
        this.deleteNote(noteId);
      });
    });
  }

  /**
   * Inject CSS styles for separated note display
   */
  injectNoteStyles() {
    const styleId = 'note-separation-styles';
    if (document.getElementById(styleId)) return; // Already injected

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Note section separation styles */
      .notes-section {
        margin-bottom: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .section-header {
        background: #f9fafb;
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .section-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #374151;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .section-icon {
        font-size: 18px;
      }
      
      .notes-list {
        background: white;
      }
      
      /* Note scope indicators */
      .note-scope {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        margin-right: 8px;
      }
      
      .plant-scope {
        background: #dcfce7;
        color: #166534;
      }
      
      .image-scope {
        background: #dbeafe;
        color: #1d4ed8;
      }
      
      /* Image info display */
      .image-info {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 4px;
        padding: 6px 10px;
        margin: 8px 0;
        font-size: 13px;
        color: #0c4a6e;
      }
      
      /* Note item styling for different types */
      .plant-note {
        border-left: 4px solid #22c55e;
      }
      
      .image-note {
        border-left: 4px solid #3b82f6;
      }
      
      /* Enhance existing note item spacing */
      .note-item {
        margin-bottom: 0;
        border-bottom: 1px solid #f3f4f6;
      }
      
      .note-item:last-child {
        border-bottom: none;
      }
      
      /* Backward propagation checkbox styling */
      .checkbox-wrapper {
        margin: 15px 0;
      }
      
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-weight: 500;
        color: #374151;
      }
      
      .checkbox-label input[type="checkbox"] {
        margin: 0;
        padding: 0;
        transform: scale(1.1);
        accent-color: #3b82f6;
      }
      
      .checkbox-text {
        user-select: none;
      }
      
      #backward-propagation-group .form-help {
        margin-top: 5px;
        font-size: 12px;
        color: #6b7280;
        font-style: italic;
      }
    `;
    
    document.head.appendChild(style);
    console.log('[NoteUI] Injected separation styles for plant/image notes');
  }

  /**
   * Display note edit modal
   */
  showNoteModal(note = null) {
    console.log('[NoteUI] showNoteModal called, note:', note);
    this.currentNote = note;
    this.isEditMode = !!note;

    const modal = document.getElementById('note-modal');
    const title = document.getElementById('note-modal-title');
    const backwardPropagationGroup = document.getElementById('backward-propagation-group');
    
    if (!modal || !title) {
      console.error('[NoteUI] Note modal elements not found');
      return;
    }
    
    title.textContent = this.isEditMode ? 'Edit Note' : 'Add Note';
    
    // 🔧 NEW: Show backward propagation option only for new image notes
    const isNewImageNote = !this.isEditMode && this.currentImageId;
    if (backwardPropagationGroup) {
      backwardPropagationGroup.style.display = isNewImageNote ? 'block' : 'none';
      // Reset checkbox when showing modal
      const checkbox = document.getElementById('note-backward-propagation');
      if (checkbox) {
        checkbox.checked = false;
      }
    }
    
    if (note) {
      document.getElementById('note-title').value = note.title;
      document.getElementById('note-type').value = note.noteType;
      document.getElementById('note-content').value = note.content;
      document.getElementById('note-tags').value = note.tags.join(', ');
      document.getElementById('note-author').value = note.author;
    } else {
      document.getElementById('note-title').value = '';
      document.getElementById('note-type').value = 'general';
      document.getElementById('note-content').value = '';
      document.getElementById('note-tags').value = '';
      document.getElementById('note-author').value = 'User';
    }

    this.updateCharCounter('note-title', 'note-title-count', 100);
    this.updateCharCounter('note-content', 'note-content-count', 5000);

    console.log('[NoteUI] Showing note edit modal');
    modal.style.display = 'flex';
    
    const titleInput = document.getElementById('note-title');
    if (titleInput) {
      titleInput.focus();
    }
  }

  /**
   * Close note modal
   */
  closeNoteModal() {
    document.getElementById('note-modal').style.display = 'none';
    this.currentNote = null;
    this.isEditMode = false;
  }

  /**
   * Close note list modal
   */
  closeNoteListModal() {
    document.getElementById('note-list-modal').style.display = 'none';
  }

  /**
   * Get later-dated images for backward propagation
   */
  async getLaterDatedImages(plantId, currentImageId) {
    try {
      console.log(`[NoteUI] Finding later-dated images for ${plantId}, current: ${currentImageId}`);
      
      // Get all images for the current plant and view angle
      const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
      if (!plantDataManager) {
        throw new Error('PlantDataManager not available');
      }
      
      // Get current plant information
      const currentPlant = plantDataManager.plants?.get(plantId);
      if (!currentPlant || !currentPlant.selectedViewAngle) {
        throw new Error('Current plant or view angle not found');
      }
      
      // Get all images for the current view angle
      const images = await plantDataManager.getPlantImages(plantId, currentPlant.selectedViewAngle);
      if (!images || images.length === 0) {
        return [];
      }
      
      // Find the current image index
      const currentImageIndex = images.findIndex(img => img.id === currentImageId);
      if (currentImageIndex === -1) {
        throw new Error('Current image not found in plant images');
      }
      
      // Get all images after the current one (later in time)
      const laterImages = images.slice(currentImageIndex + 1);
      
      console.log(`[NoteUI] Found ${laterImages.length} later-dated images for backward propagation`);
      return laterImages;
      
    } catch (error) {
      console.error('[NoteUI] Error finding later-dated images:', error);
      return [];
    }
  }

  /**
   * Apply note to multiple images (backward propagation)
   */
  async applyNoteToMultipleImages(plantId, noteData, targetImages) {
    const results = {
      success: [],
      failed: []
    };
    
    console.log(`[NoteUI] Applying note to ${targetImages.length} images via backward propagation`);
    
    for (const image of targetImages) {
      try {
        await this.noteManager.addImageNote(plantId, image.id, noteData);
        results.success.push(image.id);
        console.log(`[NoteUI] Note successfully applied to ${image.id}`);
      } catch (error) {
        console.error(`[NoteUI] Failed to apply note to ${image.id}:`, error);
        results.failed.push({ imageId: image.id, error: error.message });
      }
    }
    
    console.log(`[NoteUI] Backward propagation completed: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Save note
   */
  async saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const noteType = document.getElementById('note-type').value;
    const tags = document.getElementById('note-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const author = document.getElementById('note-author').value.trim();
    
    // 🔧 NEW: Check backward propagation setting
    const backwardPropagationCheckbox = document.getElementById('note-backward-propagation');
    const enableBackwardPropagation = backwardPropagationCheckbox && backwardPropagationCheckbox.checked;

    const noteData = {
      title,
      content,
      noteType,
      tags,
      author
    };

    const validation = this.noteManager.validateNoteData(noteData);
    if (!validation.isValid) {
      alert('Input error:\\n' + validation.errors.join('\\n'));
      return;
    }

    try {
      if (this.isEditMode && this.currentNote) {
        console.log(`[NoteUI] Updating note: ${this.currentNote.noteId}`);
        await this.noteManager.updateNote(this.currentNote.noteId, noteData);
        console.log('[NoteUI] Note updated successfully');
      } else {
        console.log('[NoteUI] Creating new note...');
        if (this.currentImageId) {
          console.log(`[NoteUI] Creating image note for ${this.currentPlantId}/${this.currentImageId}`);
          
          // Add note to current image
          await this.noteManager.addImageNote(this.currentPlantId, this.currentImageId, noteData);
          
          // 🔧 NEW: Handle backward propagation
          if (enableBackwardPropagation) {
            console.log('[NoteUI] Backward propagation enabled, finding later-dated images...');
            
            const laterImages = await this.getLaterDatedImages(this.currentPlantId, this.currentImageId);
            if (laterImages.length > 0) {
              console.log(`[NoteUI] Applying note to ${laterImages.length} later-dated images`);
              const propagationResults = await this.applyNoteToMultipleImages(this.currentPlantId, noteData, laterImages);
              
              // Show propagation results
              if (propagationResults.success.length > 0) {
                console.log(`[NoteUI] Backward propagation successful: ${propagationResults.success.length} images updated`);
              }
              if (propagationResults.failed.length > 0) {
                console.warn(`[NoteUI] Backward propagation partial failure: ${propagationResults.failed.length} images failed`);
              }
            } else {
              console.log('[NoteUI] No later-dated images found for backward propagation');
            }
          }
          
        } else {
          console.log(`[NoteUI] Creating plant note for ${this.currentPlantId}`);
          await this.noteManager.addPlantNote(this.currentPlantId, noteData);
        }
        console.log('[NoteUI] Note created successfully');
      }

      this.closeNoteModal();
      
      // 🔧 FIX: Add small delay to ensure backend processing completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 🔧 FIX: Force immediate cache clear to ensure fresh data
      console.log('[NoteUI] Note saved, forcing complete cache clear for fresh data...');
      if (this.noteManager.clearCache) {
        this.noteManager.clearCache();
        console.log('[NoteUI] Note manager cache completely cleared');
      }
      
      // 🔧 FIX: Force refresh bulk data to ensure real-time accuracy
      if (this.noteManager.refreshBulkData) {
        try {
          await this.noteManager.refreshBulkData();
          console.log('[NoteUI] Bulk data forcefully refreshed for immediate sync');
        } catch (refreshError) {
          console.warn('[NoteUI] Bulk data refresh failed, cache cleared anyway:', refreshError);
        }
      }
      
      // 🔧 FIX: Always refresh the note list modal regardless of visibility to show new note
      const listModal = document.getElementById('note-list-modal');
      if (listModal && listModal.style.display !== 'none') {
        console.log('[NoteUI] Refreshing note list to show new/updated note');
        await this.loadNoteList();
        console.log('[NoteUI] Note list refreshed with fresh data');
      }

      // 🔧 FIX: 立即刷新植物笔记徽章和图像笔记徽章，以及按钮计数
      if (this.currentPlantId) {
        console.log('[NoteUI] 笔记保存完成，立即刷新徽章和按钮...');
        
        // 🔧 FIX: Force real-time badge updates with fresh data (bypassing stale cache)
        console.log('[NoteUI] Forcing immediate badge refresh with fresh data...');
        
        // Wait a bit longer for backend sync
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 立即刷新植物笔记徽章和按钮
        await this.updatePlantNoteBadge(this.currentPlantId);
        await this.updatePlantNoteButton(this.currentPlantId);
        
        // 如果是图像笔记，使用直接API调用刷新徽章避免缓存冲突
        if (this.currentImageId) {
          // ✅ CONSISTENCY: Use direct API call for save operations too
          await this.directUpdateThumbnailBadge(this.currentPlantId, this.currentImageId);
          // 🔧 FIX: Also update the image note button count overlay
          await this.updateImageNoteButton(this.currentPlantId, this.currentImageId);
          console.log('[NoteUI] ✅ 图像笔记徽章和按钮计数通过直接API刷新完成');
          
          // 🔧 NEW: Update badges for all affected images if backward propagation was used
          if (enableBackwardPropagation) {
            console.log('[NoteUI] Refreshing badges for all images affected by backward propagation...');
            const laterImages = await this.getLaterDatedImages(this.currentPlantId, this.currentImageId);
            for (const image of laterImages) {
              await this.directUpdateThumbnailBadge(this.currentPlantId, image.id);
            }
            console.log(`[NoteUI] Updated badges for ${laterImages.length} propagated images`);
          }
        }
        
        console.log('[NoteUI] 笔记徽章和按钮刷新完成');
      }

    } catch (error) {
      console.error('Save note failed:', error);
      alert('Save failed: ' + error.message);
    }
  }

  /**
   * Edit note
   */
  async editNote(noteId) {
    try {
      const note = await this.noteManager.getNote(noteId);
      if (note) {
        this.closeNoteListModal();
        this.showNoteModal(note);
      }
    } catch (error) {
      console.error('Failed to get note:', error);
      alert('Failed to get note: ' + error.message);
    }
  }

  /**
   * Delete note
   */
  async deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      console.log(`[NoteUI] Attempting to delete note: ${noteId}`);
      await this.noteManager.deleteNote(noteId);
      console.log('[NoteUI] Note deletion successful');
      
      // 🔧 FIX: Add small delay to ensure cache clearing completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 🔧 FIX: Force immediate cache clear and refresh for deletion
      console.log('[NoteUI] Note deleted, forcing complete cache clear and refresh...');
      
      // Double-ensure cache is cleared
      if (this.noteManager.clearCache) {
        this.noteManager.clearCache();
        console.log('[NoteUI] Note manager cache cleared after deletion');
      }
      
      // 🔧 FIX: Force refresh bulk data to ensure deletion is reflected immediately
      if (this.noteManager.refreshBulkData) {
        try {
          await this.noteManager.refreshBulkData();
          console.log('[NoteUI] Bulk data forcefully refreshed after deletion');
        } catch (refreshError) {
          console.warn('[NoteUI] Bulk data refresh failed after deletion, cache cleared anyway:', refreshError);
        }
      }
      
      // Immediately refresh note list in modal with fresh data
      await this.loadNoteList();
      console.log('[NoteUI] Note list refreshed after deletion');
      
      // 🔧 FIX: Streamlined badge refresh after deletion - direct API only
      if (this.currentPlantId) {
        console.log('[NoteUI] Refreshing badges after note deletion using direct API calls...');
        
        // Force refresh plant note badge and button with bypassed cache
        await this.updatePlantNoteBadge(this.currentPlantId);
        await this.updatePlantNoteButton(this.currentPlantId);
        
        // If there's a current image, use ONLY direct API call to avoid cache conflicts
        if (this.currentImageId) {
          // ✅ SOLUTION: Skip cache-dependent methods, use direct API call exclusively
          await this.directUpdateThumbnailBadge(this.currentPlantId, this.currentImageId);
          // 🔧 FIX: Also update the image note button count overlay
          await this.updateImageNoteButton(this.currentPlantId, this.currentImageId);
          console.log('[NoteUI] ✅ Image note badge and button updated via direct API after deletion');
        }
        
        console.log('[NoteUI] All badges refreshed after deletion');
      }
    } catch (error) {
      console.error('Delete note failed:', error);
      
      // 🔧 FIX: Improved error handling for different error types
      let errorMessage = 'Delete failed: ';
      if (error.message.includes('404') || error.message.includes('不存在')) {
        errorMessage += 'Note was already deleted or does not exist.';
        // Still refresh the modal to show current state
        console.log('[NoteUI] Note already deleted, refreshing modal to show current state...');
        if (this.noteManager.clearCache) {
          this.noteManager.clearCache();
        }
        await this.loadNoteList();
        if (this.currentPlantId) {
          await this.updatePlantNoteBadge(this.currentPlantId);
          // 🔧 FIX: Also use direct API for error recovery to maintain consistency
          if (this.currentImageId) {
            await this.directUpdateThumbnailBadge(this.currentPlantId, this.currentImageId);
            // 🔧 FIX: Also update the image note button count overlay in error recovery
            await this.updateImageNoteButton(this.currentPlantId, this.currentImageId);
          }
        }
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  }

  /**
   * Search notes with proper scope based on current modal context
   */
  async searchNotes() {
    const query = document.getElementById('note-search').value.trim();
    const typeFilter = document.getElementById('note-type-filter').value;
    
    try {
      let notes;
      
      if (this.currentImageId) {
        // 🔧 FIX: In Image Notes modal - search only image notes for this specific image
        console.log(`[NoteUI] Searching image notes for ${this.currentImageId} with query:`, query);
        const allImageNotes = await this.noteManager.getImageNotes(this.currentPlantId, this.currentImageId);
        
        // Filter by query and type if provided
        notes = allImageNotes.filter(note => {
          const matchesQuery = !query || 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase()) ||
            note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
          
          const matchesType = !typeFilter || note.noteType === typeFilter;
          
          return matchesQuery && matchesType;
        });
        
        console.log(`[NoteUI] Image note search completed: found ${notes.length} notes`);
        
      } else {
        // 🔧 FIX: In Plant Notes modal - search ONLY plant-level notes for consistency
        console.log(`[NoteUI] Searching plant-level notes only for ${this.currentPlantId} with query:`, query);
        const allPlantNotes = await this.noteManager.getPlantNotes(this.currentPlantId);
        
        // Filter by query and type if provided  
        notes = allPlantNotes.filter(note => {
          const matchesQuery = !query || 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase()) ||
            note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
          
          const matchesType = !typeFilter || note.noteType === typeFilter;
          
          return matchesQuery && matchesType;
        });
        
        console.log(`[NoteUI] Plant note search completed: found ${notes.length} plant-level notes (image notes excluded for consistency)`);
      }
      
      this.renderNoteList(notes);
      
    } catch (error) {
      console.error('Search notes failed:', error);
      
      let errorMessage = 'Search failed: ';
      if (error.message.includes('404')) {
        errorMessage += 'Notes not found or backend server unavailable.';
      } else if (error.message.includes('500')) {
        errorMessage += 'Server error occurred during search. Please try again.';
      } else {
        errorMessage += error.message;
      }
      
      document.getElementById('note-list-content').innerHTML = `<div class="error-message">${errorMessage}</div>`;
    }
  }

  /**
   * Update character counter
   */
  updateCharCounter(inputId, counterId, maxLength) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    const currentLength = input.value.length;
    
    counter.textContent = currentLength;
    
    if (currentLength > maxLength * 0.9) {
      counter.style.color = '#ff6b6b';
    } else if (currentLength > maxLength * 0.8) {
      counter.style.color = '#feca57';
    } else {
      counter.style.color = '#666';
    }
  }

  /**
   * Set current plant ID
   */
  setCurrentPlant(plantId) {
    this.currentPlantId = plantId;
    
    // Show plant notes button and container
    const plantNoteBtn = document.getElementById('plant-note-btn');
    const plantNoteContainer = document.querySelector('.plant-notes-section, .plant-note-container');
    
    if (plantNoteBtn) {
      plantNoteBtn.style.display = plantId ? 'block' : 'none';
    }
    
    if (plantNoteContainer) {
      plantNoteContainer.style.display = plantId ? 'block' : 'none';
    }
    
    // Update plant note button count and badge
    if (plantId) {
      this.updatePlantNoteButton(plantId);
      this.updatePlantNoteBadge(plantId);
    } else {
      this.updatePlantNoteButton(null);
    }
  }

  /**
   * Set current image ID
   */
  setCurrentImage(imageId) {
    console.log(`[NoteUI] Setting current image ID: ${imageId}, current plant ID: ${this.currentPlantId}`);
    this.currentImageId = imageId;
    
    // 🔧 FIX: Always update image note button regardless of state
    if (imageId && this.currentPlantId) {
      // Ensure we have the current plant ID as well
      if (!this.currentPlantId && window.PlantAnnotationTool?.appState?.currentPlant?.id) {
        this.currentPlantId = window.PlantAnnotationTool.appState.currentPlant.id;
        console.log(`[NoteUI] Auto-updated plant ID from global state: ${this.currentPlantId}`);
      }
      
      // Update image note button and thumbnail badge
      this.updateImageNoteButton(this.currentPlantId, imageId);
      this.refreshThumbnailNoteBadge(this.currentPlantId, imageId);
    } else {
      // 🔧 FIX: Clear image note button when no image is selected
      this.updateImageNoteButton(null, null);
      console.log('[NoteUI] Image note button cleared - no image selected');
    }
    
    // Show image notes button and container
    const imageNoteBtn = document.getElementById('image-note-btn');
    const imageNoteContainer = document.querySelector('.annotation-controls, .image-note-container');
    
    console.log(`[NoteUI] Image note button exists: ${!!imageNoteBtn}, container exists: ${!!imageNoteContainer}`);
    
    if (imageNoteBtn) {
      const shouldShow = this.currentPlantId && imageId;
      console.log(`[NoteUI] Image note button should show: ${shouldShow}`);
      imageNoteBtn.style.display = shouldShow ? 'block' : 'none';
    }
    
    if (imageNoteContainer && imageNoteContainer.classList.contains('image-note-container')) {
      const shouldShow = this.currentPlantId && imageId;
      console.log(`[NoteUI] Image note container should show: ${shouldShow}`);
      imageNoteContainer.style.display = shouldShow ? 'block' : 'none';
    }
  }

  /**
   * Update plant note button count display (ALL notes for this plant)
   */
  async updatePlantNoteButton(plantId) {
    const plantNoteCountElement = document.getElementById('plant-note-count');
    if (!plantNoteCountElement) return;
    
    if (!plantId) {
      plantNoteCountElement.textContent = '';
      return;
    }
    
    try {
      // 🔧 FIX: Use bulk stats first for performance, then fallback to search API for accuracy
      let totalCount = 0;
      
      // Try bulk stats first (fast)
      const bulkStats = await this.noteManager.getQuickNoteStats();
      if (bulkStats && bulkStats[plantId]) {
        // 🔧 FIX: Plant Notes button should ONLY show plant-level notes, not image notes
        totalCount = bulkStats[plantId].plantNotes; // Only plant notes, not .total
        console.log(`[NoteUI] Plant note button using bulk data: ${totalCount} plant-only notes`);
        
        // 🔧 FIX: Validate plant-only count with plant API (not search API)
        if (Math.random() < 0.1) { // 10% spot-check for validation
          try {
            const plantNotes = await this.noteManager.getPlantNotes(plantId);
            const actualCount = plantNotes ? plantNotes.length : 0;
            if (actualCount !== totalCount) {
              console.warn(`[NoteUI] Plant button bulk data inconsistency! Bulk: ${totalCount}, Actual: ${actualCount}. Using actual...`);
              totalCount = actualCount;
            }
          } catch (validationError) {
            console.debug('[NoteUI] Plant button validation failed, continuing with bulk data:', validationError);
          }
        }
      } else {
        // Fallback to plant API (only plant-level notes, consistent with button purpose)
        console.log(`[NoteUI] Plant note button fallback to plant API for ${plantId}`);
        try {
          const plantNotes = await this.noteManager.getPlantNotes(plantId);
          totalCount = plantNotes ? plantNotes.length : 0;
          console.log(`[NoteUI] Plant note button plant API found: ${totalCount} plant-only notes`);
        } catch (plantError) {
          console.warn(`[NoteUI] Plant API failed, final fallback to 0:`, plantError);
          totalCount = 0;
        }
      }
      
      if (totalCount > 0) {
        plantNoteCountElement.textContent = `(${totalCount})`;
        plantNoteCountElement.style.cssText = `
          color: #059669;
          font-weight: bold;
          margin-left: 5px;
        `;
      } else {
        plantNoteCountElement.textContent = '';
      }
      
      console.log(`[NoteUI] Plant note button updated: ${totalCount} total notes (plant + image)`);
    } catch (error) {
      console.error('Failed to update plant note button:', error);
      plantNoteCountElement.textContent = '';
    }
  }

  /**
   * Update image note button count display
   */
  async updateImageNoteButton(plantId, imageId) {
    const imageNoteCountElement = document.getElementById('image-note-count');
    if (!imageNoteCountElement) return;
    
    if (!plantId || !imageId) {
      imageNoteCountElement.textContent = '';
      imageNoteCountElement.style.display = 'none';
      return;
    }
    
    try {
      const notes = await this.noteManager.getImageNotes(plantId, imageId);
      const count = notes ? notes.length : 0;
      
      if (count > 0) {
        imageNoteCountElement.textContent = count;
        imageNoteCountElement.style.cssText = `
          position: absolute;
          top: -5px;
          right: -5px;
          background: #dc2626;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        `;
      } else {
        imageNoteCountElement.textContent = '';
        imageNoteCountElement.style.display = 'none';
      }
      
      console.log(`[NoteUI] Image note button updated: ${count} notes`);
    } catch (error) {
      console.error('Failed to update image note button:', error);
      imageNoteCountElement.textContent = '';
      imageNoteCountElement.style.display = 'none';
    }
  }

  /**
   * Refresh thumbnail note badge for specific image
   */
  async refreshThumbnailNoteBadge(plantId, imageId) {
    try {
      // 🔧 FIX: Force cache invalidation for this specific image before refresh
      const cacheKey = `image_${plantId}_${imageId}`;
      if (this.noteManager.notes && this.noteManager.notes.has(cacheKey)) {
        this.noteManager.notes.delete(cacheKey);
        console.log(`[NoteUI] Force cleared cache for ${cacheKey}`);
      }
      
      // 🔧 FIX: Also clear bulk data to ensure fresh load
      if (this.noteManager.bulkNoteData) {
        this.noteManager.bulkNoteData = null;
        this.noteManager.bulkDataTimestamp = 0;
        console.log(`[NoteUI] Force cleared bulk cache for thumbnail refresh`);
      }
      
      // Call the global function to refresh thumbnail badge
      if (typeof loadImageNoteCount === 'function') {
        await loadImageNoteCount(plantId, imageId);
        console.log(`[NoteUI] Thumbnail note badge refreshed for ${imageId}`);
      } else {
        console.warn('[NoteUI] loadImageNoteCount function not available');
      }
    } catch (error) {
      console.error('Failed to refresh thumbnail note badge:', error);
    }
  }
  async updatePlantNoteBadge(plantId) {
    if (!plantId) return;
    
    console.log(`[NoteUI] updatePlantNoteBadge called for plant: ${plantId}`);
    
    try {
      // Use bulk note stats for better performance
      const bulkStats = await this.noteManager.getQuickNoteStats();
      
      if (bulkStats && bulkStats[plantId]) {
        const stats = bulkStats[plantId];
        const totalNotes = stats.total;
        
        console.log(`[NoteUI] Plant ${plantId} bulk stats: ${stats.plantNotes} plant + ${stats.imageNotes} image = ${totalNotes} total`);
        
        // 🔧 FIX: Occasional validation to detect stale bulk data
        if (Math.random() < 0.15) { // 15% validation rate for badges
          try {
            const validationResults = await this.noteManager.searchNotes('', { plantId: plantId });
            const actualTotal = validationResults ? validationResults.length : 0;
            if (actualTotal !== totalNotes) {
              console.warn(`[NoteUI] Badge bulk data stale! Bulk: ${totalNotes}, Actual: ${actualTotal}. Using accurate data...`);
              // Force refresh and use accurate data
              if (this.noteManager.refreshBulkData) {
                await this.noteManager.refreshBulkData();
              }
              // Fall through to individual method below
            } else {
              // Bulk data is accurate, proceed with badge update
              this.updateBadgeWithStats(plantId, stats);
              return;
            }
          } catch (validationError) {
            console.debug('[NoteUI] Badge validation failed, using bulk data:', validationError);
            // Continue with bulk data despite validation failure
            this.updateBadgeWithStats(plantId, stats);
            return;
          }
        } else {
          // No validation this time, trust bulk data
          this.updateBadgeWithStats(plantId, stats);
          return;
        }
      }
      
      console.log(`[NoteUI] Bulk stats not available for ${plantId}, falling back to individual requests`);
      
      // Fallback to individual requests if bulk API is not available
      const plantNotes = await this.noteManager.getPlantNotes(plantId);
      console.log(`[NoteUI] Plant ${plantId} has ${plantNotes?.length || 0} plant notes`);
      
      let totalImageNotes = 0;
      
      // Get plant images using the correct API
      let plantImages = null;
      if (window.PlantAnnotationTool?.plantDataManager) {
        try {
          plantImages = await window.PlantAnnotationTool.plantDataManager.getPlantImages(plantId);
        } catch (error) {
          console.debug(`Could not load plant images for ${plantId}:`, error.message);
          // Fallback: try to get images by view angles if available
          const plant = window.PlantAnnotationTool.plantDataManager.plants?.find(p => p.id === plantId);
          if (plant?.viewAngles) {
            const imagesByView = {};
            for (const viewAngle of plant.viewAngles) {
              try {
                const images = await window.PlantAnnotationTool.plantDataManager.getPlantImages(plantId, viewAngle);
                if (images && images.length > 0) {
                  imagesByView[viewAngle] = images;
                }
              } catch (viewError) {
                console.debug(`Could not load images for ${plantId}/${viewAngle}:`, viewError.message);
              }
            }
            plantImages = imagesByView;
          }
        }
      }
      
      // Count notes for all images of this plant
      if (plantImages) {
        const imagePromises = [];
        
        if (Array.isArray(plantImages)) {
          // Single view angle array
          for (const image of plantImages) {
            imagePromises.push(this.noteManager.getImageNotes(plantId, image.id));
          }
        } else {
          // Multi-view angle object
          for (const viewAngle in plantImages) {
            for (const image of plantImages[viewAngle]) {
              imagePromises.push(this.noteManager.getImageNotes(plantId, image.id));
            }
          }
        }
        
        // Get all image notes in parallel with proper error handling
        const imageNotesResults = await Promise.allSettled(imagePromises);
        totalImageNotes = imageNotesResults.reduce((total, result) => {
          if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
            return total + result.value.length;
          }
          return total;
        }, 0);
      }
      
      const totalNotes = (plantNotes?.length || 0) + totalImageNotes;
      console.log(`[NoteUI] Plant ${plantId} total notes: ${totalNotes} (${plantNotes?.length || 0} plant + ${totalImageNotes} image)`);
      
      const badge = document.getElementById(`note-badge-${plantId}`);
      console.log(`[NoteUI] Badge element found for ${plantId}:`, !!badge);
      
      if (badge) {
        if (totalNotes > 0) {
          // 🔧 FIX: 分离显示植株笔记和图片笔记（降级处理）
          const plantNotesCount = plantNotes?.length || 0;
          let badgeText = '';
          let title = '';
          
          if (plantNotesCount > 0 && totalImageNotes > 0) {
            // 两种笔记都有
            badgeText = `📝 ${plantNotesCount} | 🖼️ ${totalImageNotes}`;
            title = `${plantNotesCount} plant notes, ${totalImageNotes} image notes`;
          } else if (plantNotesCount > 0) {
            // 只有植株笔记
            badgeText = `📝 ${plantNotesCount}`;
            title = `${plantNotesCount} plant notes`;
          } else if (totalImageNotes > 0) {
            // 只有图片笔记
            badgeText = `🖼️ ${totalImageNotes}`;
            title = `${totalImageNotes} image notes`;
          }
          
          badge.innerHTML = `<span class="note-count">${badgeText}</span>`;
          badge.style.display = 'inline-flex';
          badge.style.visibility = 'visible';
          badge.style.opacity = '1';
          badge.title = title;
          console.log(`[NoteUI] Badge updated for ${plantId}: ${badgeText} (INDIVIDUAL)`);
        } else {
          badge.style.display = 'none';
          badge.style.visibility = 'hidden';
          badge.style.opacity = '0';
          console.log(`[NoteUI] Badge hidden for ${plantId}: no notes found`);
        }
      } else {
        console.error(`[NoteUI] Badge element not found for plant ${plantId}`);
      }
    } catch (error) {
      console.error(`Failed to update note badge for plant ${plantId}:`, error);
    }
  }

  /**
   * Helper method to update badge with provided stats
   */
  updateBadgeWithStats(plantId, stats) {
    const badge = document.getElementById(`note-badge-${plantId}`);
    console.log(`[NoteUI] Badge element found for ${plantId}:`, !!badge);
    
    if (badge) {
      const totalNotes = stats.total;
      if (totalNotes > 0) {
        // 🔧 FIX: 分离显示植株笔记和图片笔记
        let badgeText = '';
        let title = '';
        
        if (stats.plantNotes > 0 && stats.imageNotes > 0) {
          // 两种笔记都有
          badgeText = `📝 ${stats.plantNotes} | 🖼️ ${stats.imageNotes}`;
          title = `${stats.plantNotes} plant notes, ${stats.imageNotes} image notes`;
        } else if (stats.plantNotes > 0) {
          // 只有植株笔记
          badgeText = `📝 ${stats.plantNotes}`;
          title = `${stats.plantNotes} plant notes`;
        } else if (stats.imageNotes > 0) {
          // 只有图片笔记
          badgeText = `🖼️ ${stats.imageNotes}`;
          title = `${stats.imageNotes} image notes`;
        }
        
        badge.innerHTML = `<span class="note-count">${badgeText}</span>`;
        badge.style.display = 'inline-flex';
        badge.style.visibility = 'visible';
        badge.style.opacity = '1';
        badge.title = title;
        console.log(`[NoteUI] Badge updated for ${plantId}: ${badgeText} (VALIDATED)`);
      } else {
        badge.style.display = 'none';
        badge.style.visibility = 'hidden';
        badge.style.opacity = '0';
        console.log(`[NoteUI] Badge hidden for ${plantId}: no notes found (VALIDATED)`);
      }
    } else {
      console.error(`[NoteUI] Badge element not found for plant ${plantId}`);
    }
  }

  /**
   * Update all plant note badges using bulk data (INSTANT - no individual requests)
   */
  async updateAllPlantNoteBadgesFromBulk(bulkData) {
    console.log('[NoteUI] updateAllPlantNoteBadgesFromBulk() called with bulk data');
    const plantItems = document.querySelectorAll('.plant-item');
    console.log(`[NoteUI] Found ${plantItems.length} plant items to update`);
    
    if (!bulkData || !bulkData.plantNotes || !bulkData.imageNotes) {
      console.error('[NoteUI] Invalid bulk data provided');
      return;
    }
    
    const startTime = performance.now();
    
    // Create quick stats lookup from bulk data
    const quickStats = {};
    
    // Process plant notes
    for (const [plantId, notes] of Object.entries(bulkData.plantNotes)) {
      if (!quickStats[plantId]) {
        quickStats[plantId] = { plantNotes: 0, imageNotes: 0, total: 0 };
      }
      quickStats[plantId].plantNotes = notes.length;
      quickStats[plantId].total += notes.length;
    }
    
    // Process image notes (group by plant)
    for (const [imageId, notes] of Object.entries(bulkData.imageNotes)) {
      // Extract plant ID from image ID (format: BR017-028111_sv-000_...)
      const plantId = imageId.split('_')[0];
      if (plantId) {
        if (!quickStats[plantId]) {
          quickStats[plantId] = { plantNotes: 0, imageNotes: 0, total: 0 };
        }
        quickStats[plantId].imageNotes += notes.length;
        quickStats[plantId].total += notes.length;
      }
    }
    
    console.log(`[NoteUI] Generated quick stats for ${Object.keys(quickStats).length} plants`);
    
    // Update all badges instantly using pre-calculated stats
    for (const item of plantItems) {
      const plantId = item.dataset.plantId;
      if (plantId && quickStats[plantId]) {
        const stats = quickStats[plantId];
        const totalNotes = stats.total;
        
        const badge = document.getElementById(`note-badge-${plantId}`);
        if (badge) {
          if (totalNotes > 0) {
            // 🔧 FIX: Use consistent separated display format for instant bulk updates
            let badgeText = '';
            let title = '';
            
            if (stats.plantNotes > 0 && stats.imageNotes > 0) {
              // 两种笔记都有
              badgeText = `📝 ${stats.plantNotes} | 🖼️ ${stats.imageNotes}`;
              title = `${stats.plantNotes} plant notes, ${stats.imageNotes} image notes`;
            } else if (stats.plantNotes > 0) {
              // 只有植株笔记
              badgeText = `📝 ${stats.plantNotes}`;
              title = `${stats.plantNotes} plant notes`;
            } else if (stats.imageNotes > 0) {
              // 只有图片笔记
              badgeText = `🖼️ ${stats.imageNotes}`;
              title = `${stats.imageNotes} image notes`;
            }
            
            badge.innerHTML = `<span class="note-count">${badgeText}</span>`;
            badge.style.display = 'inline-flex';
            badge.style.visibility = 'visible';
            badge.style.opacity = '1';
            badge.title = title;
          } else {
            badge.style.display = 'none';
            badge.style.visibility = 'hidden';
            badge.style.opacity = '0';
          }
        }
      }
    }
    
    const endTime = performance.now();
    console.log(`[NoteUI] BULK UPDATE COMPLETE: ${plantItems.length} badges updated in ${(endTime - startTime).toFixed(2)}ms using bulk data`);
    console.log(`[NoteUI] Performance: INSTANT UPDATE - no individual HTTP requests`);
  }

  /**
   * Update all plant note badges (OPTIMIZED with bulk API)
   */
  async updateAllPlantNoteBadges() {
    console.log('[NoteUI] updateAllPlantNoteBadges() called');
    const plantItems = document.querySelectorAll('.plant-item');
    console.log(`[NoteUI] Found ${plantItems.length} plant items to update`);
    
    const startTime = performance.now();
    
    try {
      // Try bulk API first for maximum performance
      const bulkStats = await this.noteManager.getQuickNoteStats();
      
      if (bulkStats) {
        console.log('[NoteUI] Using bulk note stats for optimal performance');
        
        // Update all badges using bulk data in a single pass
        for (const item of plantItems) {
          const plantId = item.dataset.plantId;
          if (plantId && bulkStats[plantId]) {
            const stats = bulkStats[plantId];
            const totalNotes = stats.total;
            
            const badge = document.getElementById(`note-badge-${plantId}`);
            if (badge) {
              if (totalNotes > 0) {
                // 🔧 FIX: Use consistent separated display format like updatePlantNoteBadge()
                let badgeText = '';
                let title = '';
                
                if (stats.plantNotes > 0 && stats.imageNotes > 0) {
                  // 两种笔记都有
                  badgeText = `📝 ${stats.plantNotes} | 🖼️ ${stats.imageNotes}`;
                  title = `${stats.plantNotes} plant notes, ${stats.imageNotes} image notes`;
                } else if (stats.plantNotes > 0) {
                  // 只有植株笔记
                  badgeText = `📝 ${stats.plantNotes}`;
                  title = `${stats.plantNotes} plant notes`;
                } else if (stats.imageNotes > 0) {
                  // 只有图片笔记
                  badgeText = `🖼️ ${stats.imageNotes}`;
                  title = `${stats.imageNotes} image notes`;
                }
                
                badge.innerHTML = `<span class="note-count">${badgeText}</span>`;
                badge.style.display = 'inline-flex';
                badge.style.visibility = 'visible';
                badge.style.opacity = '1';
                badge.title = title;
              } else {
                badge.style.display = 'none';
                badge.style.visibility = 'hidden';
                badge.style.opacity = '0';
              }
            }
          }
        }
        
        const endTime = performance.now();
        const metrics = this.noteManager.getPerformanceMetrics();
        console.log(`[NoteUI] BULK UPDATE COMPLETE: ${plantItems.length} badges updated in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`[NoteUI] Performance: ${metrics.bulkRequestCount} bulk requests, ${metrics.cacheHits} cache hits`);
        
        return; // Exit early with optimal performance
      }
      
      console.log('[NoteUI] Bulk API not available, falling back to individual requests');
    } catch (error) {
      console.error('[NoteUI] Bulk badge update failed, falling back to individual requests:', error);
    }
    
    // Fallback to individual updates if bulk API fails
    console.log('[NoteUI] Using individual badge updates (slower)');
    for (const item of plantItems) {
      const plantId = item.dataset.plantId;
      if (plantId) {
        console.log(`[NoteUI] Updating badge for plant: ${plantId}`);
        await this.updatePlantNoteBadge(plantId);
      } else {
        console.warn('[NoteUI] Plant item found without plantId dataset');
      }
    }
    
    const endTime = performance.now();
    const metrics = this.noteManager.getPerformanceMetrics();
    console.log(`[NoteUI] INDIVIDUAL UPDATE COMPLETE: ${plantItems.length} badges updated in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`[NoteUI] Performance: ${metrics.requestCount} individual requests, ${metrics.cacheHits} cache hits`);
  }

  /**
   * Get note type text in English
   */
  getNoteTypeText(noteType) {
    const typeMap = {
      'general': 'General Note',
      'observation': 'Observation Record',
      'annotation': 'Annotation Description'
    };
    return typeMap[noteType] || noteType;
  }

  /**
   * HTML escape
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show user-friendly error message
   */
  showUserError(title, message) {
    // Try to use global error display function
    if (window.PlantAnnotationTool && window.PlantAnnotationTool.showError) {
      window.PlantAnnotationTool.showError(title, message);
    } else {
      // Fall back to alert
      alert(`${title}: ${message}`);
    }
  }

  /**
   * Direct thumbnail badge update (bypass all cache issues) - OPTIMIZED
   */
  async directUpdateThumbnailBadge(plantId, imageId) {
    try {
      console.log(`[NoteUI] 🔄 Direct thumbnail badge update for ${imageId}`);
      
      // 🔧 INCREASED DELAY: Allow backend processing to complete fully
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Force fresh data by making direct API call
      const response = await fetch(`${this.noteManager.baseUrl}/notes/image/${plantId}/${imageId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      const noteCount = result.success ? (result.data?.length || 0) : 0;
      
      // Update badge directly
      const badge = document.getElementById(`image-note-badge-${imageId}`);
      if (badge) {
        if (noteCount > 0) {
          badge.innerHTML = `<span class="image-note-count">📝 ${noteCount}</span>`;
          badge.style.display = 'inline-block';
          badge.className = 'image-note-badge';
          console.log(`[NoteUI] ✅ Badge updated: ${noteCount} notes for ${imageId} (DIRECT API)`);
        } else {
          badge.innerHTML = '';
          badge.style.display = 'none';
          console.log(`[NoteUI] ✅ Badge cleared for ${imageId} - no notes (DIRECT API)`);
        }
      } else {
        console.error(`[NoteUI] Badge element not found for ${imageId}`);
      }
    } catch (error) {
      console.error(`[NoteUI] ❌ Direct thumbnail badge update failed for ${imageId}:`, error);
      
      // 🔧 FALLBACK: Try global function as last resort
      try {
        console.log(`[NoteUI] 🔄 Attempting fallback via global loadImageNoteCount for ${imageId}`);
        if (typeof loadImageNoteCount === 'function') {
          await loadImageNoteCount(plantId, imageId);
          console.log(`[NoteUI] ✅ Fallback badge update successful for ${imageId}`);
        } else {
          console.warn(`[NoteUI] ⚠️ Global loadImageNoteCount not available for fallback`);
        }
      } catch (fallbackError) {
        console.error(`[NoteUI] ❌ Fallback badge update also failed for ${imageId}:`, fallbackError);
      }
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Remove event listeners and DOM elements
    const elementsToRemove = [
      'note-modal',
      'note-list-modal',
      'plant-note-btn',
      'image-note-btn'
      // 🔧 REMOVED: Note display elements no longer exist
    ];

    elementsToRemove.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
      }
    });

    // Remove created containers
    const containers = document.querySelectorAll('.plant-note-container, .image-note-container');
    containers.forEach(container => container.remove());

    console.log('NoteUI cleanup completed');
  }
}