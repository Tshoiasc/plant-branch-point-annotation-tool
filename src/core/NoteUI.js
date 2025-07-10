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
      console.log('[NoteUI] UI initialization completed');
      
      // Initialize plant note badges after a short delay
      setTimeout(() => {
        this.updateAllPlantNoteBadges();
      }, 500);
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
    this.createNoteDisplayAreas();
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
    
    // Create the button
    const noteBtn = document.createElement('button');
    noteBtn.id = 'plant-note-btn';
    noteBtn.className = 'btn btn-small btn-secondary';
    noteBtn.innerHTML = '📝 Plant Notes';
    noteBtn.title = 'View or add plant notes';
    noteBtn.style.cssText = `
      display: none;
      width: 100%;
      margin-bottom: 5px;
    `;
    noteContainer.appendChild(noteBtn);
    
    console.log('[NoteUI] Plant notes button created in toolbar');
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
    
    // Create the icon button to match annotation controls style
    const noteBtn = document.createElement('button');
    noteBtn.id = 'image-note-btn';
    noteBtn.className = 'btn btn-icon';
    noteBtn.innerHTML = '📝';
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
    `;
    
    // Add to annotation controls
    annotationControls.appendChild(noteBtn);
    
    console.log('[NoteUI] Image notes button created in annotation controls');
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
   * Create note display areas
   */
  createNoteDisplayAreas() {
    this.createPlantNoteDisplay();
    this.createImageNoteDisplay();
  }

  /**
   * Create plant note display area
   */
  createPlantNoteDisplay() {
    const existingDisplay = document.getElementById('plant-note-display');
    if (existingDisplay) {
      existingDisplay.remove();
    }
    
    const display = document.createElement('div');
    display.id = 'plant-note-display';
    display.className = 'note-display collapsible';
    display.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 300px;
      max-height: 200px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      overflow-y: auto;
      z-index: 1000;
      display: none;
      transition: all 0.3s ease;
      resize: both;
      min-width: 250px;
      min-height: 100px;
      max-width: 500px;
    `;
    
    display.innerHTML = `
      <div class="note-display-header draggable-header">
        <h4>Plant Notes</h4>
        <div class="note-display-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="close-btn" title="Close"></button>
        </div>
      </div>
      <div class="note-display-content">
        <div class="note-loading">Loading...</div>
      </div>
    `;
    
    document.body.appendChild(display);
    this.makeDraggable(display);
  }

  /**
   * Create image note display area
   */
  createImageNoteDisplay() {
    const existingDisplay = document.getElementById('image-note-display');
    if (existingDisplay) {
      existingDisplay.remove();
    }
    
    const display = document.createElement('div');
    display.id = 'image-note-display';
    display.className = 'note-display collapsible';
    display.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      max-height: 200px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      overflow-y: auto;
      z-index: 1000;
      display: none;
      transition: all 0.3s ease;
      resize: both;
      min-width: 250px;
      min-height: 100px;
      max-width: 500px;
    `;
    
    display.innerHTML = `
      <div class="note-display-header draggable-header">
        <h4>Image Notes</h4>
        <div class="note-display-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="close-btn" title="Close"></button>
        </div>
      </div>
      <div class="note-display-content">
        <div class="note-loading">Loading...</div>
      </div>
    `;
    
    document.body.appendChild(display);
    this.makeDraggable(display);
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
      this.setupNoteDisplayEventListeners();
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
   * Setup note display event listeners
   */
  setupNoteDisplayEventListeners() {
    // Setup minimize and close button listeners for all note displays
    document.querySelectorAll('.note-display').forEach(display => {
      const minimizeBtn = display.querySelector('.minimize-btn');
      const closeBtn = display.querySelector('.close-btn');
      const content = display.querySelector('.note-display-content');
      
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
          const isMinimized = display.classList.contains('minimized');
          if (isMinimized) {
            // Restore
            display.classList.remove('minimized');
            content.style.display = 'block';
            minimizeBtn.textContent = '−';
            minimizeBtn.title = 'Minimize';
          } else {
            // Minimize
            display.classList.add('minimized');
            content.style.display = 'none';
            minimizeBtn.textContent = '+';
            minimizeBtn.title = 'Restore';
          }
        });
      }
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          display.style.display = 'none';
        });
      }
    });
  }

  /**
   * Make note display draggable
   */
  makeDraggable(element) {
    const header = element.querySelector('.draggable-header');
    if (!header) return;
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.style.cursor = 'move';
    header.style.userSelect = 'none';
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        element.style.cursor = 'grabbing';
      }
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        // Keep within viewport bounds
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        xOffset = Math.max(0, Math.min(xOffset, maxX));
        yOffset = Math.max(0, Math.min(yOffset, maxY));
        
        setTranslate(xOffset, yOffset, element);
      }
    }
    
    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      element.style.cursor = 'default';
    }
    
    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate(${xPos}px, ${yPos}px)`;
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

    this.currentImageId = null;
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
    if (!this.currentPlantId || !this.currentImageId) {
      console.warn('[NoteUI] No plant or image selected, cannot show image notes');
      this.showUserError('Please select plant and image', 'You need to select both plant and image to view image notes');
      return;
    }

    document.getElementById('note-list-modal-title').textContent = `Image Notes - ${this.currentImageId}`;
    
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
   * Load note list
   */
  async loadNoteList() {
    const listContainer = document.getElementById('note-list-content');
    listContainer.innerHTML = '<div class="loading-message">Loading...</div>';

    try {
      let notes;
      if (this.currentImageId) {
        notes = await this.noteManager.getImageNotes(this.currentPlantId, this.currentImageId);
      } else {
        notes = await this.noteManager.getPlantNotes(this.currentPlantId);
      }

      this.renderNoteList(notes);
    } catch (error) {
      console.error('Failed to load note list:', error);
      listContainer.innerHTML = `<div class="error-message">Loading failed: ${error.message}</div>`;
    }
  }

  /**
   * Render note list
   */
  renderNoteList(notes) {
    const listContainer = document.getElementById('note-list-content');
    
    if (!notes || notes.length === 0) {
      listContainer.innerHTML = '<div class="empty-message">No notes available</div>';
      return;
    }

    const noteItems = notes.map(note => {
      const formattedNote = this.noteManager.formatNoteForDisplay(note);
      return `
        <div class="note-item" data-note-id="${note.noteId}">
          <div class="note-item-header">
            <h4 class="note-title">${this.escapeHtml(formattedNote.title)}</h4>
            <div class="note-actions">
              <button class="btn btn-sm btn-secondary edit-note-btn" data-note-id="${note.noteId}">Edit</button>
              <button class="btn btn-sm btn-danger delete-note-btn" data-note-id="${note.noteId}">Delete</button>
            </div>
          </div>
          <div class="note-item-meta">
            <span class="note-type note-type-${note.noteType}">${this.getNoteTypeText(note.noteType)}</span>
            <span class="note-timestamp">${formattedNote.formattedTimestamp}</span>
            <span class="note-author">Author: ${this.escapeHtml(note.author)}</span>
          </div>
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

    listContainer.innerHTML = noteItems;

    // Bind edit and delete events
    listContainer.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = e.target.dataset.noteId;
        this.editNote(noteId);
      });
    });

    listContainer.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = e.target.dataset.noteId;
        this.deleteNote(noteId);
      });
    });
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
    
    if (!modal || !title) {
      console.error('[NoteUI] Note modal elements not found');
      return;
    }
    
    title.textContent = this.isEditMode ? 'Edit Note' : 'Add Note';
    
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
   * Save note
   */
  async saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const noteType = document.getElementById('note-type').value;
    const tags = document.getElementById('note-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const author = document.getElementById('note-author').value.trim();

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
        await this.noteManager.updateNote(this.currentNote.noteId, noteData);
        console.log('Note updated successfully');
      } else {
        if (this.currentImageId) {
          await this.noteManager.addImageNote(this.currentPlantId, this.currentImageId, noteData);
        } else {
          await this.noteManager.addPlantNote(this.currentPlantId, noteData);
        }
        console.log('Note created successfully');
      }

      this.closeNoteModal();
      
      // Refresh note list
      const listModal = document.getElementById('note-list-modal');
      if (listModal.style.display === 'flex') {
        await this.loadNoteList();
      }

      // Update plant note badge
      if (this.currentPlantId) {
        await this.updatePlantNoteBadge(this.currentPlantId);
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
      await this.noteManager.deleteNote(noteId);
      console.log('Note deleted successfully');
      
      // Refresh note list
      await this.loadNoteList();
      
      // Update plant note badge
      if (this.currentPlantId) {
        await this.updatePlantNoteBadge(this.currentPlantId);
      }
    } catch (error) {
      console.error('Delete note failed:', error);
      alert('Delete failed: ' + error.message);
    }
  }

  /**
   * Search notes
   */
  async searchNotes() {
    const query = document.getElementById('note-search').value.trim();
    const typeFilter = document.getElementById('note-type-filter').value;
    
    const filters = {};
    if (this.currentPlantId) {
      filters.plantId = this.currentPlantId;
    }
    if (typeFilter) {
      filters.noteType = typeFilter;
    }

    try {
      const notes = await this.noteManager.searchNotes(query, filters);
      this.renderNoteList(notes);
    } catch (error) {
      console.error('Search notes failed:', error);
      document.getElementById('note-list-content').innerHTML = `<div class="error-message">Search failed: ${error.message}</div>`;
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
    
    // Auto load and display plant notes
    if (plantId) {
      this.loadAndDisplayPlantNotes(plantId);
      // Update plant note badge
      this.updatePlantNoteBadge(plantId);
    } else {
      this.hideNoteDisplay('plant-note-display');
    }
  }

  /**
   * Set current image ID
   */
  setCurrentImage(imageId) {
    console.log(`[NoteUI] Setting current image ID: ${imageId}, current plant ID: ${this.currentPlantId}`);
    this.currentImageId = imageId;
    
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
    
    // Auto load and display image notes
    if (this.currentPlantId && imageId) {
      this.loadAndDisplayImageNotes(this.currentPlantId, imageId);
    } else {
      this.hideNoteDisplay('image-note-display');
    }
  }

  /**
   * Update plant note badge to show note count
   */
  async updatePlantNoteBadge(plantId) {
    if (!plantId) return;
    
    try {
      // Get both plant notes and image notes for this plant
      const plantNotes = await this.noteManager.getPlantNotes(plantId);
      const plantImages = await window.fileManager.readPlantImages(plantId);
      
      let totalImageNotes = 0;
      
      // Count notes for all images of this plant
      if (plantImages) {
        for (const viewAngle in plantImages) {
          for (const image of plantImages[viewAngle]) {
            try {
              const imageNotes = await this.noteManager.getImageNotes(plantId, image.id);
              if (imageNotes && imageNotes.length > 0) {
                totalImageNotes += imageNotes.length;
              }
            } catch (error) {
              // Ignore errors for individual images
            }
          }
        }
      }
      
      const totalNotes = (plantNotes?.length || 0) + totalImageNotes;
      const badge = document.getElementById(`note-badge-${plantId}`);
      
      if (badge) {
        if (totalNotes > 0) {
          badge.innerHTML = `<span class="note-count">📝 ${totalNotes}</span>`;
          badge.style.display = 'flex';
          badge.title = `${plantNotes?.length || 0} plant notes, ${totalImageNotes} image notes`;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (error) {
      console.error(`Failed to update note badge for plant ${plantId}:`, error);
    }
  }

  /**
   * Update all plant note badges
   */
  async updateAllPlantNoteBadges() {
    const plantItems = document.querySelectorAll('.plant-item');
    for (const item of plantItems) {
      const plantId = item.dataset.plantId;
      if (plantId) {
        await this.updatePlantNoteBadge(plantId);
      }
    }
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
   * Load and display plant notes
   */
  async loadAndDisplayPlantNotes(plantId) {
    try {
      const notes = await this.noteManager.getPlantNotes(plantId);
      this.displayNotes('plant-note-display', notes, 'Plant Notes');
    } catch (error) {
      console.error('Failed to load plant notes:', error);
    }
  }

  /**
   * Load and display image notes
   */
  async loadAndDisplayImageNotes(plantId, imageId) {
    try {
      const notes = await this.noteManager.getImageNotes(plantId, imageId);
      this.displayNotes('image-note-display', notes, 'Image Notes');
    } catch (error) {
      console.error('Failed to load image notes:', error);
    }
  }

  /**
   * Display notes in specified area
   */
  displayNotes(displayId, notes, title) {
    const display = document.getElementById(displayId);
    if (!display) return;

    const content = display.querySelector('.note-display-content');
    if (!content) return;

    if (!notes || notes.length === 0) {
      content.innerHTML = '<div class="note-empty">No notes available</div>';
      display.style.display = 'none';
      return;
    }

    // Only show the latest 3 notes
    const recentNotes = notes.slice(0, 3);
    const noteHtml = recentNotes.map(note => {
      const formattedNote = this.noteManager.formatNoteForDisplay(note);
      return `
        <div class="note-item-mini">
          <div class="note-title-mini">${this.escapeHtml(formattedNote.title)}</div>
          <div class="note-content-mini">${this.escapeHtml(formattedNote.shortContent)}</div>
          <div class="note-time-mini">${formattedNote.formattedTimestamp}</div>
        </div>
      `;
    }).join('');

    content.innerHTML = noteHtml;
    display.style.display = 'block';
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
   * Hide note display area
   */
  hideNoteDisplay(displayId) {
    const display = document.getElementById(displayId);
    if (display) {
      display.style.display = 'none';
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
      'image-note-btn',
      'plant-note-display',
      'image-note-display'
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