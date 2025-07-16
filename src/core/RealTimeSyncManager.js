/**
 * RealTimeSyncManager - Manages real-time synchronization of annotation operations
 * across future images within the same plant and view angle.
 * 
 * Features:
 * - Toggle-able real-time synchronization
 * - Sync keypoint operations (add, move, delete) to future images
 * - Compatible with existing save logic
 * - Sequential processing to avoid race conditions
 */
class RealTimeSyncManager {
  constructor(plantDataManager, annotationStorageManager) {
    this.plantDataManager = plantDataManager;
    this.annotationStorageManager = annotationStorageManager;
    
    // Sync state
    this.isEnabled = false;
    this.isSyncing = false;
    this.syncQueue = [];
    
    // Operation types
    this.OPERATION_TYPES = {
      ADD_KEYPOINT: 'ADD_KEYPOINT',
      MOVE_KEYPOINT: 'MOVE_KEYPOINT',
      DELETE_KEYPOINT: 'DELETE_KEYPOINT',
      EDIT_DIRECTION: 'EDIT_DIRECTION', // 🔧 NEW: Direction-specific operation
      CUSTOM_ANNOTATION_CREATE: 'CUSTOM_ANNOTATION_CREATE',
      CUSTOM_ANNOTATION_UPDATE: 'CUSTOM_ANNOTATION_UPDATE',
      CUSTOM_ANNOTATION_DELETE: 'CUSTOM_ANNOTATION_DELETE',
      CUSTOM_TYPE_CREATE: 'CUSTOM_TYPE_CREATE'
    };
    
    // Event listeners for UI feedback
    this.eventListeners = new Map();
    
    console.log('🔄 RealTimeSyncManager initialized');
  }

  /**
   * Enable or disable real-time synchronization
   * @param {boolean} enabled - Whether to enable sync
   */
  setEnabled(enabled) {
    this.isEnabled = Boolean(enabled);
    console.log(`🔄 Real-time sync ${this.isEnabled ? 'enabled' : 'disabled'}`);
    
    // Emit event for UI updates
    this.emit('syncToggled', { enabled: this.isEnabled });
  }

  /**
   * Check if real-time sync is currently enabled
   * @returns {boolean} True if sync is enabled
   */
  isRealTimeSyncEnabled() {
    return this.isEnabled;
  }

  /**
   * Check if sync operation is currently in progress
   * @returns {boolean} True if syncing
   */
  isSyncInProgress() {
    return this.isSyncing;
  }

  /**
   * Add event listener for sync events
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in sync event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get future images for the current plant and view angle
   * @param {object} currentImage - Current image object
   * @param {object} currentPlant - Current plant object
   * @returns {Promise<Array>} Array of future images
   */
  async getFutureImages(currentImage, currentPlant) {
    if (!currentImage || !currentPlant) {
      console.warn('🔄 Cannot get future images: missing current image or plant');
      return [];
    }

    try {
      // Get all images for current plant and view angle
      const allImages = await this.plantDataManager.getPlantImages(
        currentPlant.id,
        currentPlant.selectedViewAngle
      );

      if (!allImages || allImages.length === 0) {
        return [];
      }

      // Get current image date for comparison
      const currentDate = new Date(currentImage.dateTime);
      const currentImageIndex = allImages.findIndex(img => img.id === currentImage.id);

      // 🔧 FIX: Context-aware sync logic to prevent wrong annotations
      // Instead of syncing to all later dates, only sync to images that come 
      // after the current image in sequence AND have later dates
      
      const futureImages = [];
      
      // Only consider images after current image in the sequence
      for (let i = currentImageIndex + 1; i < allImages.length; i++) {
        const image = allImages[i];
        const imgDate = new Date(image.dateTime);
        
        // Only include if it's actually a later date (maintain chronological requirement)
        if (imgDate > currentDate) {
          futureImages.push(image);
        }
      }

      // Sort by date to ensure chronological order
      futureImages.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      console.log(`🔄 Found ${futureImages.length} future images for sync (from index ${currentImageIndex + 1})`);
      return futureImages;

    } catch (error) {
      console.error('🔄 Error getting future images:', error);
      return [];
    }
  }

  /**
   * Sync keypoint addition to future images
   * @param {object} keypoint - The keypoint that was added
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<object>} Sync result
   */
  async syncKeypointAddition(keypoint, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return { success: true, message: 'Sync disabled', synced: 0 };
    }

    console.log(`🔄 Starting keypoint addition sync for keypoint ${keypoint.id}`);
    console.log(`🔄 Current image: ${currentImage.id}, Plant: ${currentPlant.id}, View: ${currentPlant.selectedViewAngle}`);

    try {
      const futureImages = await this.getFutureImages(currentImage, currentPlant);
      
      if (futureImages.length === 0) {
        console.log(`🔄 No future images found for sync`);
        return { success: true, message: 'No future images to sync', synced: 0 };
      }

      console.log(`🔄 Found ${futureImages.length} future images:`, futureImages.map(img => img.id));

      let syncedCount = 0;
      const errors = [];

      // Process each future image sequentially to avoid conflicts
      for (const image of futureImages) {
        try {
          console.log(`🔄 Syncing keypoint ${keypoint.id} to image ${image.id}...`);
          await this.addKeypointToImage(keypoint, image);
          syncedCount++;
          console.log(`🔄 Successfully synced to image ${image.id}`);
        } catch (error) {
          console.error(`🔄 Error syncing to image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }

      const result = {
        success: errors.length === 0,
        message: `Synced to ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log(`🔄 Keypoint addition sync completed:`, result);
      return result;

    } catch (error) {
      console.error('🔄 Error in keypoint addition sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Sync keypoint movement to future images
   * @param {object} keypoint - The keypoint that was moved
   * @param {object} previousPosition - Previous position {x, y}
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<object>} Sync result
   */
  async syncKeypointMovement(keypoint, previousPosition, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return { success: true, message: 'Sync disabled', synced: 0 };
    }

    console.log(`🔄 Starting keypoint movement sync for keypoint ${keypoint.id}`);

    try {
      const futureImages = await this.getFutureImages(currentImage, currentPlant);
      
      if (futureImages.length === 0) {
        return { success: true, message: 'No future images to sync', synced: 0 };
      }

      let syncedCount = 0;
      const errors = [];

      // Process each future image sequentially
      for (const image of futureImages) {
        try {
          await this.moveKeypointInImage(keypoint, image);
          syncedCount++;
        } catch (error) {
          console.error(`🔄 Error syncing movement to image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }

      const result = {
        success: errors.length === 0,
        message: `Synced movement to ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log(`🔄 Keypoint movement sync completed:`, result);
      return result;

    } catch (error) {
      console.error('🔄 Error in keypoint movement sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Sync keypoint deletion to future images
   * @param {object} payload - Deletion payload containing keypoint and context
   * @returns {Promise<object>} Sync result
   */
  async syncKeypointDeletion(payload) {
    if (!this.isEnabled) {
      return { success: true, message: 'Sync disabled', synced: 0 };
    }

    const { keypoint, currentImage, currentPlant } = payload;

    console.log(`🔄 Starting keypoint deletion sync for keypoint ${keypoint.id}`);
    console.log(`🔄 Current image: ${currentImage.id}, Plant: ${currentPlant.id}, View: ${currentPlant.selectedViewAngle}`);

    try {
      const futureImages = await this.getFutureImages(currentImage, currentPlant);
      
      if (futureImages.length === 0) {
        console.log(`🔄 No future images found for deletion sync`);
        return { success: true, message: 'No future images to sync', synced: 0 };
      }

      console.log(`🔄 Found ${futureImages.length} future images:`, futureImages.map(img => img.id));

      let syncedCount = 0;
      const errors = [];

      // Process each future image sequentially to avoid conflicts
      for (const image of futureImages) {
        try {
          console.log(`🔄 Syncing keypoint deletion to image ${image.id}...`);
          await this.deleteKeypointFromImage(keypoint, image);
          syncedCount++;
          console.log(`🔄 Successfully synced deletion to image ${image.id}`);
        } catch (error) {
          console.error(`🔄 Error syncing deletion to image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }

      const result = {
        success: errors.length === 0,
        message: `Synced deletion to ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log(`🔄 Keypoint deletion sync completed:`, result);
      return result;

    } catch (error) {
      console.error('🔄 Error in keypoint deletion sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Add keypoint to a specific image
   * @param {object} keypoint - Keypoint to add
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async addKeypointToImage(keypoint, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // 🔧 FIX: Use order-based matching for consistent sync behavior
    // This is crucial for real-time sync: sync by order + type, not by ID
    const existingKeypoint = existingAnnotations.find(ann => {
      const orderMatch = ann.order === keypoint.order;
      const typeMatch = ann.annotationType === keypoint.annotationType;
      
      // For custom annotations, customTypeId must also match
      const customTypeMatch = keypoint.annotationType === 'custom' 
        ? ann.customTypeId === keypoint.customTypeId
        : true;
      
      return orderMatch && typeMatch && customTypeMatch;
    });
    
    if (existingKeypoint) {
      // Update existing keypoint position and all properties
      existingKeypoint.x = keypoint.x;
      existingKeypoint.y = keypoint.y;
      existingKeypoint.direction = keypoint.direction;
      existingKeypoint.directionType = keypoint.directionType;
      existingKeypoint.directions = keypoint.directions; // 🔧 NEW: Support multi-direction
      existingKeypoint.maxDirections = keypoint.maxDirections; // 🔧 NEW: Support multi-direction
      existingKeypoint.timestamp = new Date().toISOString();
      
      // 🔧 Enhanced Debug: Log annotation details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Updated existing ${typeDesc} keypoint order ${keypoint.order} in image ${targetImage.id}`);
    } else {
      // Add new keypoint
      const newKeypoint = {
        ...keypoint,
        timestamp: new Date().toISOString() // Update timestamp for sync
      };
      existingAnnotations.push(newKeypoint);
      
      // 🔧 Enhanced Debug: Log annotation details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Added new ${typeDesc} keypoint order ${keypoint.order} to image ${targetImage.id}`);
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Move keypoint in a specific image
   * @param {object} keypoint - Keypoint with new position
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async moveKeypointInImage(keypoint, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // 🔧 FIX: Use order-based matching for consistent sync behavior
    // This is crucial for real-time sync: sync by order + type, not by ID
    const existingKeypoint = existingAnnotations.find(ann => {
      const orderMatch = ann.order === keypoint.order;
      const typeMatch = ann.annotationType === keypoint.annotationType;
      
      // For custom annotations, customTypeId must also match
      const customTypeMatch = keypoint.annotationType === 'custom' 
        ? ann.customTypeId === keypoint.customTypeId
        : true;
      
      return orderMatch && typeMatch && customTypeMatch;
    });
    
    if (existingKeypoint) {
      // Update position and all properties
      existingKeypoint.x = keypoint.x;
      existingKeypoint.y = keypoint.y;
      existingKeypoint.direction = keypoint.direction;
      existingKeypoint.directionType = keypoint.directionType;
      existingKeypoint.directions = keypoint.directions; // 🔧 NEW: Support multi-direction
      existingKeypoint.maxDirections = keypoint.maxDirections; // 🔧 NEW: Support multi-direction
      existingKeypoint.timestamp = new Date().toISOString();
      
      // 🔧 Enhanced Debug: Log annotation details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Moved ${typeDesc} keypoint order ${keypoint.order} in image ${targetImage.id}`);
    } else {
      // Add new keypoint if it doesn't exist (order-based sync)
      const newKeypoint = {
        ...keypoint,
        timestamp: new Date().toISOString()
      };
      existingAnnotations.push(newKeypoint);
      
      // 🔧 Enhanced Debug: Log annotation details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Added new ${typeDesc} keypoint order ${keypoint.order} to image ${targetImage.id} (move operation)`);
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Delete keypoint from a specific image with strict matching criteria
   * @param {object} keypoint - Keypoint to delete
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async deleteKeypointFromImage(keypoint, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    if (existingAnnotations.length === 0) {
      console.log(`🔄 No annotations found in image ${targetImage.id} - skipping deletion`);
      return;
    }

    // Find matching keypoint using strict criteria:
    // 1. order must match
    // 2. annotationType must match
    // 3. customTypeId must match (for custom annotations)
    const matchingIndex = existingAnnotations.findIndex(ann => {
      const orderMatch = ann.order === keypoint.order;
      const typeMatch = ann.annotationType === keypoint.annotationType;
      
      // For custom annotations, customTypeId must also match
      const customTypeMatch = keypoint.annotationType === 'custom' 
        ? ann.customTypeId === keypoint.customTypeId
        : true;
      
      return orderMatch && typeMatch && customTypeMatch;
    });
    
    if (matchingIndex !== -1) {
      const removedKeypoint = existingAnnotations[matchingIndex];
      existingAnnotations.splice(matchingIndex, 1);
      
      console.log(`🔄 Deleted keypoint from image ${targetImage.id}:`);
      console.log(`  - Order: ${removedKeypoint.order}`);
      console.log(`  - Type: ${removedKeypoint.annotationType}`);
      console.log(`  - Custom Type ID: ${removedKeypoint.customTypeId || 'N/A'}`);
      console.log(`  - ID: ${removedKeypoint.id}`);
    } else {
      console.log(`🔄 No matching keypoint found in image ${targetImage.id} for deletion:`);
      console.log(`  - Looking for order: ${keypoint.order}`);
      console.log(`  - Looking for type: ${keypoint.annotationType}`);
      console.log(`  - Looking for custom type ID: ${keypoint.customTypeId || 'N/A'}`);
      console.log(`  - Available annotations:`, existingAnnotations.map(ann => ({
        order: ann.order,
        type: ann.annotationType,
        customTypeId: ann.customTypeId,
        id: ann.id
      })));
      return;
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Queue a sync operation for processing
   * @param {object} operation - Sync operation details
   * @returns {Promise<void>}
   */
  async queueSyncOperation(operation) {
    if (!this.isEnabled) {
      return;
    }

    this.syncQueue.push(operation);
    
    // Process queue if not already processing
    if (!this.isSyncing) {
      await this.processSyncQueue();
    }
  }

  /**
   * Process queued sync operations sequentially
   * @returns {Promise<void>}
   */
  async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.emit('syncStarted', { queueLength: this.syncQueue.length });

    try {
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue.shift();
        
        try {
          await this.executeOperation(operation);
        } catch (error) {
          console.error('🔄 Error executing sync operation:', error);
          this.emit('syncError', { operation, error });
        }
      }
    } finally {
      this.isSyncing = false;
      this.emit('syncCompleted', {});
    }
  }

  /**
   * Execute a specific sync operation
   * @param {object} operation - Operation to execute
   * @returns {Promise<void>}
   */
  async executeOperation(operation) {
    const { type, keypoint, currentImage, currentPlant, previousPosition, syncData } = operation;

    switch (type) {
      case this.OPERATION_TYPES.ADD_KEYPOINT:
        return await this.syncKeypointAddition(keypoint, currentImage, currentPlant);
      
      case this.OPERATION_TYPES.MOVE_KEYPOINT:
        return await this.syncKeypointMovement(keypoint, previousPosition, currentImage, currentPlant);
      
      case this.OPERATION_TYPES.DELETE_KEYPOINT:
        // 🔧 FIX: Properly handle keypoint deletion sync
        return await this.syncKeypointDeletion(operation);
      
      case this.OPERATION_TYPES.EDIT_DIRECTION:
        // 🔧 NEW: Direction-specific sync operation
        return await this.syncDirectionEdit(operation);
      
      case this.OPERATION_TYPES.CUSTOM_ANNOTATION_CREATE:
        return await this.syncCustomAnnotationCreate(syncData);
      
      case this.OPERATION_TYPES.CUSTOM_ANNOTATION_UPDATE:
        return await this.syncCustomAnnotationUpdate(syncData);
      
      case this.OPERATION_TYPES.CUSTOM_ANNOTATION_DELETE:
        return await this.syncCustomAnnotationDelete(syncData);
      
      case this.OPERATION_TYPES.CUSTOM_TYPE_CREATE:
        return await this.syncCustomTypeCreate(syncData);
      
      default:
        console.warn(`🔄 Unknown sync operation type: ${type}`);
    }
  }

  /**
   * Sync direction edit to future images
   * @param {object} operation - Direction edit operation
   * @returns {Promise<object>} Sync result
   */
  async syncDirectionEdit(operation) {
    if (!this.isEnabled) {
      return { success: true, message: 'Sync disabled', synced: 0 };
    }

    const { keypoint, currentImage, currentPlant } = operation;

    console.log(`🔄 Starting direction edit sync for keypoint order ${keypoint.order}`);
    console.log(`🔄 Current image: ${currentImage.id}, Plant: ${currentPlant.id}, View: ${currentPlant.selectedViewAngle}`);

    try {
      const futureImages = await this.getFutureImages(currentImage, currentPlant);
      
      if (futureImages.length === 0) {
        console.log(`🔄 No future images found for direction edit sync`);
        return { success: true, message: 'No future images to sync', synced: 0 };
      }

      console.log(`🔄 Found ${futureImages.length} future images:`, futureImages.map(img => img.id));

      let syncedCount = 0;
      const errors = [];

      // Process each future image sequentially to avoid conflicts
      for (const image of futureImages) {
        try {
          console.log(`🔄 Syncing direction edit to image ${image.id}...`);
          await this.editDirectionInImage(keypoint, image);
          syncedCount++;
          console.log(`🔄 Successfully synced direction edit to image ${image.id}`);
        } catch (error) {
          console.error(`🔄 Error syncing direction edit to image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }

      const result = {
        success: errors.length === 0,
        message: `Synced direction edit to ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };

      console.log(`🔄 Direction edit sync completed:`, result);
      return result;

    } catch (error) {
      console.error('🔄 Error in direction edit sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Edit direction in a specific image
   * @param {object} keypoint - Keypoint with updated direction
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async editDirectionInImage(keypoint, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // 🔧 FIX: Use order-based matching for direction edits
    const existingKeypoint = existingAnnotations.find(ann => {
      const orderMatch = ann.order === keypoint.order;
      const typeMatch = ann.annotationType === keypoint.annotationType;
      
      // For custom annotations, customTypeId must also match
      const customTypeMatch = keypoint.annotationType === 'custom' 
        ? ann.customTypeId === keypoint.customTypeId
        : true;
      
      return orderMatch && typeMatch && customTypeMatch;
    });
    
    if (existingKeypoint) {
      // Update only direction-related properties
      existingKeypoint.direction = keypoint.direction;
      existingKeypoint.directionType = keypoint.directionType;
      existingKeypoint.directions = keypoint.directions; // 🔧 NEW: Support multi-direction
      existingKeypoint.maxDirections = keypoint.maxDirections; // 🔧 NEW: Support multi-direction
      existingKeypoint.timestamp = new Date().toISOString();
      
      // 🔧 Enhanced Debug: Log direction edit details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Updated direction for ${typeDesc} keypoint order ${keypoint.order} in image ${targetImage.id}`);
    } else {
      // Add new keypoint if it doesn't exist (order-based sync)
      const newKeypoint = {
        ...keypoint,
        timestamp: new Date().toISOString()
      };
      existingAnnotations.push(newKeypoint);
      
      // 🔧 Enhanced Debug: Log annotation details
      const typeDesc = keypoint.annotationType === 'custom' ? 
        `custom(${keypoint.customTypeId})` : 'regular';
      console.log(`🔄 Added new ${typeDesc} keypoint order ${keypoint.order} to image ${targetImage.id} (direction edit operation)`);
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }
  /**
   * Sync custom annotation creation to future images
   * @param {object} syncData - Custom annotation sync data
   * @returns {Promise<object>} Sync result
   */
  async syncCustomAnnotationCreate(syncData) {
    console.log('🔄 Starting custom annotation creation sync:', syncData);
    
    try {
      // Extract context information
      const { annotation, context } = syncData;
      const { appState } = context;
      
      if (!appState?.currentImage || !appState?.currentPlant) {
        console.warn('🔄 Missing app state for custom annotation sync');
        return { success: false, message: 'Missing app state', synced: 0 };
      }
      
      const futureImages = await this.getFutureImages(appState.currentImage, appState.currentPlant);
      
      if (futureImages.length === 0) {
        console.log('🔄 No future images found for custom annotation sync');
        return { success: true, message: 'No future images to sync', synced: 0 };
      }
      
      let syncedCount = 0;
      const errors = [];
      
      // Process each future image sequentially
      for (const image of futureImages) {
        try {
          console.log(`🔄 Syncing custom annotation to image ${image.id}...`);
          await this.addCustomAnnotationToImage(annotation, image);
          syncedCount++;
          console.log(`🔄 Successfully synced custom annotation to image ${image.id}`);
        } catch (error) {
          console.error(`🔄 Error syncing custom annotation to image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }
      
      const result = {
        success: errors.length === 0,
        message: `Synced custom annotation to ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log('🔄 Custom annotation creation sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('🔄 Error in custom annotation creation sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Sync custom annotation update to future images
   * @param {object} syncData - Custom annotation sync data
   * @returns {Promise<object>} Sync result
   */
  async syncCustomAnnotationUpdate(syncData) {
    console.log('🔄 Starting custom annotation update sync:', syncData);
    
    try {
      // Extract context information
      const { annotation, context } = syncData;
      const { appState } = context;
      
      if (!appState?.currentImage || !appState?.currentPlant) {
        console.warn('🔄 Missing app state for custom annotation update sync');
        return { success: false, message: 'Missing app state', synced: 0 };
      }
      
      const futureImages = await this.getFutureImages(appState.currentImage, appState.currentPlant);
      
      if (futureImages.length === 0) {
        return { success: true, message: 'No future images to sync', synced: 0 };
      }
      
      let syncedCount = 0;
      const errors = [];
      
      // Process each future image sequentially
      for (const image of futureImages) {
        try {
          await this.updateCustomAnnotationInImage(annotation, image);
          syncedCount++;
        } catch (error) {
          console.error(`🔄 Error updating custom annotation in image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }
      
      const result = {
        success: errors.length === 0,
        message: `Updated custom annotation in ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log('🔄 Custom annotation update sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('🔄 Error in custom annotation update sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Sync custom annotation deletion to future images
   * @param {object} syncData - Custom annotation sync data
   * @returns {Promise<object>} Sync result
   */
  async syncCustomAnnotationDelete(syncData) {
    console.log('🔄 Starting custom annotation deletion sync:', syncData);
    
    try {
      // Extract context information
      const { annotation, context } = syncData;
      const { appState } = context;
      
      if (!appState?.currentImage || !appState?.currentPlant) {
        console.warn('🔄 Missing app state for custom annotation deletion sync');
        return { success: false, message: 'Missing app state', synced: 0 };
      }
      
      const futureImages = await this.getFutureImages(appState.currentImage, appState.currentPlant);
      
      if (futureImages.length === 0) {
        return { success: true, message: 'No future images to sync', synced: 0 };
      }
      
      let syncedCount = 0;
      const errors = [];
      
      // Process each future image sequentially
      for (const image of futureImages) {
        try {
          await this.deleteCustomAnnotationFromImage(annotation, image);
          syncedCount++;
        } catch (error) {
          console.error(`🔄 Error deleting custom annotation from image ${image.id}:`, error);
          errors.push({ imageId: image.id, error: error.message });
        }
      }
      
      const result = {
        success: errors.length === 0,
        message: `Deleted custom annotation from ${syncedCount} future images`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log('🔄 Custom annotation deletion sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('🔄 Error in custom annotation deletion sync:', error);
      return { success: false, message: error.message, synced: 0 };
    }
  }

  /**
   * Sync custom type creation to future images
   * @param {object} syncData - Custom type sync data
   * @returns {Promise<object>} Sync result
   */
  async syncCustomTypeCreate(syncData) {
    console.log('🔄 Starting custom type creation sync:', syncData);
    
    // For custom type creation, we typically don't need to sync to future images
    // since types are global and don't belong to specific images
    // This is more of a metadata sync that could be handled separately
    
    console.log('🔄 Custom type creation sync - no image sync needed');
    return { success: true, message: 'Custom type created (no image sync required)', synced: 0 };
  }

  /**
   * Add custom annotation to a specific image
   * @param {object} annotation - Custom annotation to add
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async addCustomAnnotationToImage(annotation, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // 🔧 FIX: Use order-based matching for custom annotations (not ID-based)
    // This is the core of real-time sync: sync by order + custom type, not by ID
    const existingCustomAnnotation = existingAnnotations.find(ann => 
      ann.annotationType === 'custom' && 
      ann.customTypeId === annotation.customTypeId &&
      ann.order === annotation.order
    );
    
    if (existingCustomAnnotation) {
      // Update existing custom annotation with same order and type
      Object.assign(existingCustomAnnotation, annotation);
      existingCustomAnnotation.timestamp = new Date().toISOString();
      
      console.log(`🔄 Updated existing custom annotation order ${annotation.order} type ${annotation.customTypeId} in image ${targetImage.id}`);
    } else {
      // 🔧 FIX: Remove conflict detection - order-based sync is the intended behavior
      // The previous conflict detection was preventing legitimate sync operations
      // Real-time sync SHOULD create annotations with same order on future frames
      
      // Add new custom annotation
      const newAnnotation = {
        ...annotation,
        timestamp: new Date().toISOString()
      };
      existingAnnotations.push(newAnnotation);
      
      console.log(`🔄 Added new custom annotation order ${annotation.order} type ${annotation.customTypeId} to image ${targetImage.id}`);
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Update custom annotation in a specific image
   * @param {object} annotation - Custom annotation with updates
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async updateCustomAnnotationInImage(annotation, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // 🔧 FIX: Use order-based matching for custom annotations (not ID-based)
    // This is crucial for move operations - we need to match by order + type, not ID
    const existingCustomAnnotation = existingAnnotations.find(ann => 
      ann.annotationType === 'custom' && 
      ann.customTypeId === annotation.customTypeId &&
      ann.order === annotation.order
    );
    
    if (existingCustomAnnotation) {
      // Update existing custom annotation with same order and type
      Object.assign(existingCustomAnnotation, annotation);
      existingCustomAnnotation.timestamp = new Date().toISOString();
      
      console.log(`🔄 Updated custom annotation order ${annotation.order} type ${annotation.customTypeId} in image ${targetImage.id}`);
    } else {
      // Add new custom annotation if it doesn't exist (order-based sync)
      const newAnnotation = {
        ...annotation,
        timestamp: new Date().toISOString()
      };
      existingAnnotations.push(newAnnotation);
      
      console.log(`🔄 Added new custom annotation order ${annotation.order} type ${annotation.customTypeId} to image ${targetImage.id} (update operation)`);
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Delete custom annotation from a specific image
   * @param {object} annotation - Custom annotation to delete
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async deleteCustomAnnotationFromImage(annotation, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    if (existingAnnotations.length === 0) {
      console.log(`🔄 No annotations found in image ${targetImage.id} - skipping custom annotation deletion`);
      return;
    }

    // 🔧 FIX: Use order-based matching for custom annotations (not ID-based)
    // This is crucial for delete operations - we need to match by order + type, not ID
    const matchingIndex = existingAnnotations.findIndex(ann => 
      ann.annotationType === 'custom' && 
      ann.customTypeId === annotation.customTypeId &&
      ann.order === annotation.order
    );
    
    if (matchingIndex !== -1) {
      const removedAnnotation = existingAnnotations[matchingIndex];
      existingAnnotations.splice(matchingIndex, 1);
      
      console.log(`🔄 Deleted custom annotation order ${removedAnnotation.order} type ${removedAnnotation.customTypeId} from image ${targetImage.id}`);
    } else {
      console.log(`🔄 No matching custom annotation order ${annotation.order} type ${annotation.customTypeId} found in image ${targetImage.id} for deletion`);
      return;
    }

    // Prepare complete annotation data object
    const annotationData = {
      imageId: targetImage.id,
      annotations: existingAnnotations,
      lastModified: new Date().toISOString()
    };

    // Save updated annotations
    await this.annotationStorageManager.saveImageAnnotation(targetImage.id, annotationData);
  }

  /**
   * Trigger sync for keypoint addition
   * @param {object} keypoint - Added keypoint
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<void>}
   */
  async triggerKeypointAddSync(keypoint, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return;
    }

    const operation = {
      type: this.OPERATION_TYPES.ADD_KEYPOINT,
      keypoint,
      currentImage,
      currentPlant,
      timestamp: new Date().toISOString()
    };

    await this.queueSyncOperation(operation);
  }

  /**
   * Trigger sync for keypoint movement
   * @param {object} keypoint - Moved keypoint
   * @param {object} previousPosition - Previous position
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<void>}
   */
  async triggerKeypointMoveSync(keypoint, previousPosition, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return;
    }

    const operation = {
      type: this.OPERATION_TYPES.MOVE_KEYPOINT,
      keypoint,
      previousPosition,
      currentImage,
      currentPlant,
      timestamp: new Date().toISOString()
    };

    await this.queueSyncOperation(operation);
  }

  /**
   * Trigger sync for keypoint deletion
   * @param {object} keypoint - Deleted keypoint
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<void>}
   */
  async triggerKeypointDeleteSync(keypoint, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return;
    }

    const operation = {
      type: this.OPERATION_TYPES.DELETE_KEYPOINT,
      keypoint,
      currentImage,
      currentPlant,
      timestamp: new Date().toISOString()
    };

    await this.queueSyncOperation(operation);
  }

  /**
   * Trigger sync for direction edit
   * @param {object} keypoint - Keypoint with updated direction
   * @param {object} currentImage - Current image context
   * @param {object} currentPlant - Current plant context
   * @returns {Promise<void>}
   */
  async triggerDirectionEditSync(keypoint, currentImage, currentPlant) {
    if (!this.isEnabled) {
      return;
    }

    const operation = {
      type: this.OPERATION_TYPES.EDIT_DIRECTION,
      keypoint,
      currentImage,
      currentPlant,
      timestamp: new Date().toISOString()
    };

    await this.queueSyncOperation(operation);
  }

  /**
   * Trigger sync for custom annotation operations
   * @param {object} syncData - Custom annotation sync data
   * @returns {Promise<void>}
   */
  async triggerCustomAnnotationSync(syncData) {
    if (!this.isEnabled) {
      console.log('🔄 Custom annotation sync disabled, skipping');
      return;
    }

    console.log('🔄 Processing custom annotation sync:', syncData);

    const operation = {
      type: syncData.type,
      syncData,
      timestamp: new Date().toISOString()
    };

    await this.queueSyncOperation(operation);
  }

  /**
   * Get sync statistics
   * @returns {object} Sync statistics
   */
  getSyncStats() {
    return {
      isEnabled: this.isEnabled,
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length
    };
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue() {
    this.syncQueue = [];
    console.log('🔄 Sync queue cleared');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clearSyncQueue();
    this.eventListeners.clear();
    this.isEnabled = false;
    this.isSyncing = false;
    console.log('🔄 RealTimeSyncManager destroyed');
  }
}

export default RealTimeSyncManager;