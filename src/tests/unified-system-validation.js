/**
 * Unified Annotation System Validation
 * 
 * Validates that the unified annotation system is working correctly
 */

// Mock DOM and environment
const mockCanvas = {
  getContext: () => ({
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    drawImage: () => {},
    fillText: () => {},
    measureText: () => ({ width: 50 }),
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    setLineDash: () => {}
  }),
  addEventListener: () => {},
  style: {},
  width: 800,
  height: 600,
  parentElement: {
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    querySelectorAll: () => []
  }
};

global.document = {
  getElementById: () => mockCanvas,
  createElement: () => ({ appendChild: () => {} }),
  head: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = {
  PlantAnnotationTool: {
    appState: {
      currentImage: { id: 'test-image', name: 'test.jpg' },
      currentPlant: { id: 'test-plant', name: 'Test Plant' }
    }
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock localStorage
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

// Test the unified annotation system
async function validateUnifiedSystem() {
  console.log('🧪 Validating unified annotation system...');
  
  let passed = 0;
  let total = 0;
  
  function test(name, testFn) {
    total++;
    try {
      testFn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
  
  try {
    // Import modules
    const { AnnotationTool } = await import('../core/AnnotationTool.js');
    const { CustomAnnotationManager } = await import('../core/CustomAnnotationManager.js');
    
    // Initialize system
    const customAnnotationManager = new CustomAnnotationManager();
    const annotationTool = new AnnotationTool('test-canvas');
    annotationTool.customAnnotationManager = customAnnotationManager;
    
    // Mock loaded image to allow annotation creation
    annotationTool.imageElement = {
      width: 800,
      height: 600
    };
    annotationTool.imageLoaded = true;
    
    // Create custom type
    const customType = customAnnotationManager.createCustomType({
      id: 'test-type',
      name: 'Test Type',
      type: 'point',
      color: '#ff0000'
    });
    
    console.log('\n📋 Running validation tests...');
    
    // Test 1: Regular annotation creation
    test('Regular annotation creation', () => {
      const keypoint = annotationTool.addKeypointWithDirection(100, 200, 0);
      if (!keypoint || keypoint.annotationType !== 'regular') {
        throw new Error('Regular annotation creation failed');
      }
    });
    
    // Test 2: Custom annotation creation
    test('Custom annotation creation', () => {
      const keypoint = annotationTool.addCustomPointAnnotation(150, 250, customType.id);
      if (!keypoint || keypoint.annotationType !== 'custom') {
        throw new Error('Custom annotation creation failed');
      }
    });
    
    // Test 3: Unified storage
    test('Unified storage in keypoints array', () => {
      if (annotationTool.keypoints.length !== 2) {
        throw new Error(`Expected 2 keypoints, got ${annotationTool.keypoints.length}`);
      }
    });
    
    // Test 4: Annotation type distinction
    test('Annotation type distinction', () => {
      const regularCount = annotationTool.keypoints.filter(kp => kp.annotationType === 'regular').length;
      const customCount = annotationTool.keypoints.filter(kp => kp.annotationType === 'custom').length;
      
      if (regularCount !== 1 || customCount !== 1) {
        throw new Error(`Expected 1 regular and 1 custom, got ${regularCount} regular and ${customCount} custom`);
      }
    });
    
    // Test 5: Unified deletion
    test('Unified deletion system', () => {
      const beforeCount = annotationTool.keypoints.length;
      const lastKeypoint = annotationTool.keypoints[annotationTool.keypoints.length - 1];
      
      // Test removeCustomAnnotation on custom annotation
      if (lastKeypoint.annotationType === 'custom') {
        annotationTool.removeCustomAnnotation(lastKeypoint);
      } else {
        annotationTool.removeKeypoint(lastKeypoint);
      }
      
      const afterCount = annotationTool.keypoints.length;
      if (afterCount !== beforeCount - 1) {
        throw new Error(`Deletion failed: expected ${beforeCount - 1}, got ${afterCount}`);
      }
    });
    
    // Test 6: Data export includes all annotations
    test('Data export includes all annotations', () => {
      const data = annotationTool.getAnnotationData();
      if (data.keypoints.length !== 1) {
        throw new Error(`Expected 1 keypoint in export, got ${data.keypoints.length}`);
      }
    });
    
    // Test 7: Unified clearing
    test('Unified clearing system', () => {
      annotationTool.clearKeypoints();
      if (annotationTool.keypoints.length !== 0) {
        throw new Error(`Clear failed: expected 0 keypoints, got ${annotationTool.keypoints.length}`);
      }
    });
    
    // Test 8: Fixed plant selection methods
    test('Plant selection methods work without error', () => {
      annotationTool.clearKeypointsWithoutSave();
      annotationTool.clearKeypoints();
      annotationTool.clearImage();
      // If we reach here, no errors were thrown
    });
    
    console.log(`\n🎯 Validation Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Unified annotation system is working correctly.');
      return true;
    } else {
      console.log(`❌ ${total - passed} tests failed.`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

// Run validation
validateUnifiedSystem().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Validation execution failed:', error);
  process.exit(1);
});