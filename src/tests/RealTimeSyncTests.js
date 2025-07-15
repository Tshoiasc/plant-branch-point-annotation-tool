/**
 * Real-Time Sync Functionality Tests
 * 
 * Test scenarios for the real-time synchronization feature that syncs
 * keypoint operations to future images in the same plant and view angle.
 */

// Test Configuration
const TEST_CONFIG = {
  testPlantId: 'BR017-028122',
  testViewAngle: 'sv-000',
  testImages: [
    {
      id: 'BR017-028122_sv-000_BR017-028122-2018-07-04_00_VIS_sv_000-0-0-0.png',
      dateTime: new Date('2018-07-04T00:00:00'),
      timeString: '2018/7/4',
      viewAngle: 'sv-000',
      plantId: 'BR017-028122'
    },
    {
      id: 'BR017-028122_sv-000_BR017-028122-2018-07-05_00_VIS_sv_000-0-0-0.png',
      dateTime: new Date('2018-07-05T00:00:00'),
      timeString: '2018/7/5',
      viewAngle: 'sv-000',
      plantId: 'BR017-028122'
    },
    {
      id: 'BR017-028122_sv-000_BR017-028122-2018-07-06_00_VIS_sv_000-0-0-0.png',
      dateTime: new Date('2018-07-06T00:00:00'),
      timeString: '2018/7/6',
      viewAngle: 'sv-000',
      plantId: 'BR017-028122'
    }
  ]
};

/**
 * Test Suite for Real-Time Sync Manager
 */
class RealTimeSyncTestSuite {
  constructor() {
    this.testResults = [];
    this.mockData = new Map();
    this.setupMockData();
  }

  /**
   * Set up mock data for testing
   */
  setupMockData() {
    // Mock annotation storage
    this.mockAnnotations = new Map();
    
    // Mock future images (images after current one)
    this.mockFutureImages = TEST_CONFIG.testImages.slice(1); // Skip first image (current)
  }

  /**
   * Mock PlantDataManager for testing
   */
  createMockPlantDataManager() {
    return {
      getPlantImages: async (plantId, viewAngle) => {
        console.log(`🧪 Mock: Getting images for ${plantId} - ${viewAngle}`);
        return TEST_CONFIG.testImages;
      }
    };
  }

  /**
   * Mock AnnotationStorageManager for testing
   */
  createMockAnnotationStorageManager() {
    const self = this;
    return {
      getImageAnnotation: async (imageId) => {
        console.log(`🧪 Mock: Getting annotation data for ${imageId}`);
        const annotations = self.mockAnnotations.get(imageId) || [];
        return annotations.length > 0 ? {
          imageId: imageId,
          annotations: annotations,
          lastModified: new Date().toISOString()
        } : null;
      },
      
      saveImageAnnotation: async (imageId, annotationData) => {
        console.log(`🧪 Mock: Saving annotation data for ${imageId}`, annotationData);
        if (annotationData && annotationData.annotations) {
          self.mockAnnotations.set(imageId, annotationData.annotations);
        }
        return true;
      }
    };
  }

  /**
   * Test 1: RealTimeSyncManager Initialization
   */
  async testInitialization() {
    console.log('🧪 Test 1: RealTimeSyncManager Initialization');
    
    try {
      const mockPlantDataManager = this.createMockPlantDataManager();
      const mockAnnotationStorageManager = this.createMockAnnotationStorageManager();
      
      // Create RealTimeSyncManager instance
      const syncManager = new window.RealTimeSyncManager(
        mockPlantDataManager,
        mockAnnotationStorageManager
      );
      
      // Test initial state
      const isEnabled = syncManager.isRealTimeSyncEnabled();
      const isSyncing = syncManager.isSyncInProgress();
      
      this.assert(isEnabled === false, 'Sync should be disabled by default');
      this.assert(isSyncing === false, 'Should not be syncing initially');
      
      // Test enable/disable
      syncManager.setEnabled(true);
      this.assert(syncManager.isRealTimeSyncEnabled() === true, 'Should enable sync');
      
      syncManager.setEnabled(false);
      this.assert(syncManager.isRealTimeSyncEnabled() === false, 'Should disable sync');
      
      this.logTestResult('testInitialization', true, 'Initialization tests passed');
      
    } catch (error) {
      this.logTestResult('testInitialization', false, `Initialization failed: ${error.message}`);
    }
  }

  /**
   * Test 2: Future Images Detection
   */
  async testFutureImagesDetection() {
    console.log('🧪 Test 2: Future Images Detection');
    
    try {
      const mockPlantDataManager = this.createMockPlantDataManager();
      const mockAnnotationStorageManager = this.createMockAnnotationStorageManager();
      
      const syncManager = new window.RealTimeSyncManager(
        mockPlantDataManager,
        mockAnnotationStorageManager
      );
      
      // Test with first image (should have 2 future images)
      const currentImage = TEST_CONFIG.testImages[0];
      const currentPlant = {
        id: TEST_CONFIG.testPlantId,
        selectedViewAngle: TEST_CONFIG.testViewAngle
      };
      
      const futureImages = await syncManager.getFutureImages(currentImage, currentPlant);
      
      this.assert(futureImages.length === 2, `Should find 2 future images, found ${futureImages.length}`);
      this.assert(futureImages[0].id === TEST_CONFIG.testImages[1].id, 'First future image should be correct');
      this.assert(futureImages[1].id === TEST_CONFIG.testImages[2].id, 'Second future image should be correct');
      
      // Test with last image (should have 0 future images)
      const lastImage = TEST_CONFIG.testImages[2];
      const noFutureImages = await syncManager.getFutureImages(lastImage, currentPlant);
      
      this.assert(noFutureImages.length === 0, 'Last image should have no future images');
      
      this.logTestResult('testFutureImagesDetection', true, 'Future images detection tests passed');
      
    } catch (error) {
      this.logTestResult('testFutureImagesDetection', false, `Future images detection failed: ${error.message}`);
    }
  }

  /**
   * Test 3: Keypoint Addition Sync
   */
  async testKeypointAdditionSync() {
    console.log('🧪 Test 3: Keypoint Addition Sync');
    
    try {
      const mockPlantDataManager = this.createMockPlantDataManager();
      const mockAnnotationStorageManager = this.createMockAnnotationStorageManager();
      
      const syncManager = new window.RealTimeSyncManager(
        mockPlantDataManager,
        mockAnnotationStorageManager
      );
      
      syncManager.setEnabled(true);
      
      // Create test keypoint
      const testKeypoint = {
        id: 'test-keypoint-1',
        x: 100,
        y: 200,
        direction: 180,
        directionType: 'angle',
        order: 1,
        timestamp: new Date().toISOString()
      };
      
      const currentImage = TEST_CONFIG.testImages[0];
      const currentPlant = {
        id: TEST_CONFIG.testPlantId,
        selectedViewAngle: TEST_CONFIG.testViewAngle
      };
      
      // Perform sync
      const result = await syncManager.syncKeypointAddition(testKeypoint, currentImage, currentPlant);
      
      this.assert(result.success === true, 'Sync should succeed');
      this.assert(result.synced === 2, `Should sync to 2 images, synced to ${result.synced}`);
      
      // Verify keypoint was added to future images
      const futureImage1Annotations = this.mockAnnotations.get(TEST_CONFIG.testImages[1].id);
      const futureImage2Annotations = this.mockAnnotations.get(TEST_CONFIG.testImages[2].id);
      
      this.assert(futureImage1Annotations.length === 1, 'Future image 1 should have 1 annotation');
      this.assert(futureImage2Annotations.length === 1, 'Future image 2 should have 1 annotation');
      this.assert(futureImage1Annotations[0].id === testKeypoint.id, 'Synced keypoint should have correct ID');
      
      this.logTestResult('testKeypointAdditionSync', true, 'Keypoint addition sync tests passed');
      
    } catch (error) {
      this.logTestResult('testKeypointAdditionSync', false, `Keypoint addition sync failed: ${error.message}`);
    }
  }

  /**
   * Test 4: Keypoint Movement Sync
   */
  async testKeypointMovementSync() {
    console.log('🧪 Test 4: Keypoint Movement Sync');
    
    try {
      const mockPlantDataManager = this.createMockPlantDataManager();
      const mockAnnotationStorageManager = this.createMockAnnotationStorageManager();
      
      const syncManager = new window.RealTimeSyncManager(
        mockPlantDataManager,
        mockAnnotationStorageManager
      );
      
      syncManager.setEnabled(true);
      
      // Set up existing keypoint in future images (from previous test)
      const existingKeypoint = {
        id: 'test-keypoint-1',
        x: 100,
        y: 200,
        direction: 180,
        directionType: 'angle',
        order: 1
      };
      
      // Add to future images
      this.mockAnnotations.set(TEST_CONFIG.testImages[1].id, [{ ...existingKeypoint }]);
      this.mockAnnotations.set(TEST_CONFIG.testImages[2].id, [{ ...existingKeypoint }]);
      
      // Create moved keypoint
      const movedKeypoint = {
        ...existingKeypoint,
        x: 150,
        y: 250,
        timestamp: new Date().toISOString()
      };
      
      const previousPosition = { x: 100, y: 200 };
      const currentImage = TEST_CONFIG.testImages[0];
      const currentPlant = {
        id: TEST_CONFIG.testPlantId,
        selectedViewAngle: TEST_CONFIG.testViewAngle
      };
      
      // Perform movement sync
      const result = await syncManager.syncKeypointMovement(movedKeypoint, previousPosition, currentImage, currentPlant);
      
      this.assert(result.success === true, 'Movement sync should succeed');
      this.assert(result.synced === 2, `Should sync to 2 images, synced to ${result.synced}`);
      
      // Verify keypoint was moved in future images
      const futureImage1Annotations = this.mockAnnotations.get(TEST_CONFIG.testImages[1].id);
      const futureImage2Annotations = this.mockAnnotations.get(TEST_CONFIG.testImages[2].id);
      
      this.assert(futureImage1Annotations[0].x === 150, 'Keypoint should be moved to new X position');
      this.assert(futureImage1Annotations[0].y === 250, 'Keypoint should be moved to new Y position');
      this.assert(futureImage2Annotations[0].x === 150, 'All future images should have updated position');
      
      this.logTestResult('testKeypointMovementSync', true, 'Keypoint movement sync tests passed');
      
    } catch (error) {
      this.logTestResult('testKeypointMovementSync', false, `Keypoint movement sync failed: ${error.message}`);
    }
  }

  /**
   * Test 5: Disabled Sync Behavior
   */
  async testDisabledSyncBehavior() {
    console.log('🧪 Test 5: Disabled Sync Behavior');
    
    try {
      const mockPlantDataManager = this.createMockPlantDataManager();
      const mockAnnotationStorageManager = this.createMockAnnotationStorageManager();
      
      const syncManager = new window.RealTimeSyncManager(
        mockPlantDataManager,
        mockAnnotationStorageManager
      );
      
      // Ensure sync is disabled
      syncManager.setEnabled(false);
      
      const testKeypoint = {
        id: 'test-keypoint-disabled',
        x: 300,
        y: 400,
        direction: 0,
        directionType: 'angle',
        order: 2
      };
      
      const currentImage = TEST_CONFIG.testImages[0];
      const currentPlant = {
        id: TEST_CONFIG.testPlantId,
        selectedViewAngle: TEST_CONFIG.testViewAngle
      };
      
      // Attempt sync with disabled state
      const result = await syncManager.syncKeypointAddition(testKeypoint, currentImage, currentPlant);
      
      this.assert(result.success === true, 'Should succeed but with no sync');
      this.assert(result.synced === 0, 'Should not sync any images when disabled');
      this.assert(result.message.includes('disabled'), 'Message should indicate sync is disabled');
      
      this.logTestResult('testDisabledSyncBehavior', true, 'Disabled sync behavior tests passed');
      
    } catch (error) {
      this.logTestResult('testDisabledSyncBehavior', false, `Disabled sync behavior test failed: ${error.message}`);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Real-Time Sync Test Suite');
    console.log('=====================================');
    
    this.testResults = [];
    
    await this.testInitialization();
    await this.testFutureImagesDetection();
    await this.testKeypointAdditionSync();
    await this.testKeypointMovementSync();
    await this.testDisabledSyncBehavior();
    
    this.printTestSummary();
  }

  /**
   * Assert helper function
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Log test result
   */
  logTestResult(testName, passed, message) {
    const result = {
      testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${testName}: ${message}`);
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    console.log('\\n🧪 Test Suite Summary');
    console.log('=====================');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\\nFailed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`- ${result.testName}: ${result.message}`);
      });
    }
    
    console.log('\\n🔄 Real-Time Sync Testing Complete!');
  }
}

/**
 * Global function to run tests
 * Usage: runRealTimeSyncTests()
 */
window.runRealTimeSyncTests = async function() {
  const testSuite = new RealTimeSyncTestSuite();
  await testSuite.runAllTests();
};

/**
 * Auto-run tests when this script is loaded (if RealTimeSyncManager is available)
 */
if (typeof window !== 'undefined' && window.RealTimeSyncManager) {
  console.log('🧪 RealTimeSyncManager detected - Auto-running tests in 2 seconds...');
  setTimeout(() => {
    window.runRealTimeSyncTests();
  }, 2000);
} else {
  console.log('🧪 Real-Time Sync tests loaded. Run with: runRealTimeSyncTests()');
}

export { RealTimeSyncTestSuite };