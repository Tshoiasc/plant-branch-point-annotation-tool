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
      DELETE_KEYPOINT: 'DELETE_KEYPOINT'
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

      // Filter future images (images with later dates)
      const futureImages = allImages.filter(img => {
        const imgDate = new Date(img.dateTime);
        return imgDate > currentDate;
      });

      // Sort by date to ensure chronological order
      futureImages.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      console.log(`🔄 Found ${futureImages.length} future images for sync`);
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
   * Add keypoint to a specific image
   * @param {object} keypoint - Keypoint to add
   * @param {object} targetImage - Target image
   * @returns {Promise<void>}
   */
  async addKeypointToImage(keypoint, targetImage) {
    // Get existing annotations for the target image
    const existingData = await this.annotationStorageManager.getImageAnnotation(targetImage.id);
    const existingAnnotations = existingData ? existingData.annotations : [];
    
    // Check if keypoint with same ID already exists
    const existingKeypoint = existingAnnotations.find(ann => ann.id === keypoint.id);
    
    if (existingKeypoint) {
      // Update existing keypoint position
      existingKeypoint.x = keypoint.x;
      existingKeypoint.y = keypoint.y;
      existingKeypoint.direction = keypoint.direction;
      existingKeypoint.directionType = keypoint.directionType;
      existingKeypoint.timestamp = new Date().toISOString();
      console.log(`🔄 Updated existing keypoint ${keypoint.id} in image ${targetImage.id}`);
    } else {
      // Add new keypoint
      const newKeypoint = {
        ...keypoint,
        timestamp: new Date().toISOString() // Update timestamp for sync
      };
      existingAnnotations.push(newKeypoint);
      console.log(`🔄 Added new keypoint ${keypoint.id} to image ${targetImage.id}`);
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
    
    // Find existing keypoint
    const existingKeypoint = existingAnnotations.find(ann => ann.id === keypoint.id);
    
    if (existingKeypoint) {
      // Update position
      existingKeypoint.x = keypoint.x;
      existingKeypoint.y = keypoint.y;
      existingKeypoint.direction = keypoint.direction;
      existingKeypoint.directionType = keypoint.directionType;
      existingKeypoint.timestamp = new Date().toISOString();
      console.log(`🔄 Moved keypoint ${keypoint.id} in image ${targetImage.id}`);
    } else {
      // Add new keypoint if it doesn't exist
      const newKeypoint = {
        ...keypoint,
        timestamp: new Date().toISOString()
      };
      existingAnnotations.push(newKeypoint);
      console.log(`🔄 Added new keypoint ${keypoint.id} to image ${targetImage.id} (move operation)`);
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
    const { type, keypoint, currentImage, currentPlant, previousPosition } = operation;

    switch (type) {
      case this.OPERATION_TYPES.ADD_KEYPOINT:
        return await this.syncKeypointAddition(keypoint, currentImage, currentPlant);
      
      case this.OPERATION_TYPES.MOVE_KEYPOINT:
        return await this.syncKeypointMovement(keypoint, previousPosition, currentImage, currentPlant);
      
      case this.OPERATION_TYPES.DELETE_KEYPOINT:
        // TODO: Implement keypoint deletion sync if needed
        console.log('🔄 Keypoint deletion sync not yet implemented');
        break;
      
      default:
        console.warn(`🔄 Unknown sync operation type: ${type}`);
    }
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