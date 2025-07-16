/**
 * Minimal Unified Annotation System Test
 * 
 * Tests the core unified annotation functionality without browser dependencies
 */

// Mock minimal localStorage
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

// Mock minimal DOM environment
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

// Test the unified annotation system
async function testUnifiedSystem() {
  console.log('🧪 Testing unified annotation system core functionality...');
  
  let passed = 0;
  let total = 0;
  
  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.log(`❌ ${message}`);
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
    annotationTool.imageElement = { width: 800, height: 600 };
    annotationTool.imageLoaded = true;
    
    // Create custom type
    const customType = customAnnotationManager.createCustomType({
      id: 'test-type',
      name: 'Test Type',
      type: 'point',
      color: '#ff0000'
    });
    
    console.log('\n📋 Running core functionality tests...');
    
    // Test 1: Direct keypoint creation with unified system
    console.log('\n🔸 Test 1: Direct keypoint creation');
    const regularKeypoint = {
      id: Date.now(),
      x: 100,
      y: 200,
      direction: 0,
      annotationType: 'regular',
      order: 1
    };
    
    const customKeypoint = {
      id: Date.now() + 1,
      x: 150,
      y: 250,
      direction: null,
      annotationType: 'custom',
      customTypeId: 'test-type',
      order: 2
    };
    
    // Add keypoints directly to the array
    annotationTool.keypoints.push(regularKeypoint);
    annotationTool.keypoints.push(customKeypoint);
    
    assert(annotationTool.keypoints.length === 2, 'Two keypoints added to unified array');
    assert(annotationTool.keypoints[0].annotationType === 'regular', 'First keypoint is regular type');
    assert(annotationTool.keypoints[1].annotationType === 'custom', 'Second keypoint is custom type');
    
    // Test 2: Unified data export
    console.log('\n🔸 Test 2: Unified data export');
    const exportedData = annotationTool.getAnnotationData();
    assert(exportedData.keypoints.length === 2, 'Export includes all keypoints');
    assert(exportedData.keypoints[0].annotationType === 'regular', 'Exported regular keypoint has correct type');
    assert(exportedData.keypoints[1].annotationType === 'custom', 'Exported custom keypoint has correct type');
    assert(exportedData.keypoints[1].customTypeId === 'test-type', 'Exported custom keypoint has correct customTypeId');
    
    // Test 3: Unified data loading
    console.log('\n🔸 Test 3: Unified data loading');
    const testData = {
      keypoints: [
        {
          id: 3,
          x: 300,
          y: 400,
          direction: 90,
          annotationType: 'regular',
          order: 3
        },
        {
          id: 4,
          x: 350,
          y: 450,
          direction: null,
          annotationType: 'custom',
          customTypeId: 'test-type',
          order: 4
        }
      ]
    };
    
    annotationTool.loadAnnotationData(testData);
    assert(annotationTool.keypoints.length === 2, 'Loaded data replaces existing keypoints');
    assert(annotationTool.keypoints[0].annotationType === 'regular', 'Loaded regular keypoint has correct type');
    assert(annotationTool.keypoints[1].annotationType === 'custom', 'Loaded custom keypoint has correct type');
    
    // Test 4: Unified deletion
    console.log('\n🔸 Test 4: Unified deletion');
    const keypointToDelete = annotationTool.keypoints[0];
    annotationTool.removeKeypoint(keypointToDelete);
    assert(annotationTool.keypoints.length === 1, 'Keypoint removed from unified array');
    assert(annotationTool.keypoints[0].annotationType === 'custom', 'Remaining keypoint is custom type');
    
    // Test 5: Unified clearing
    console.log('\n🔸 Test 5: Unified clearing');
    annotationTool.clearKeypointsWithoutSave();
    assert(annotationTool.keypoints.length === 0, 'All keypoints cleared from unified array');
    
    // Test 6: Order assignment system
    console.log('\n🔸 Test 6: Order assignment system');
    const order1 = annotationTool.findNextAvailableOrder();
    assert(order1 === 1, 'First available order is 1');
    
    // Add some keypoints with gaps
    annotationTool.keypoints.push({ id: 5, order: 1, annotationType: 'regular' });
    annotationTool.keypoints.push({ id: 6, order: 3, annotationType: 'regular' });
    
    const order2 = annotationTool.findNextAvailableOrder();
    assert(order2 === 2, 'Next available order fills gap (order 2)');
    
    console.log(`\n🎯 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Unified annotation system core functionality is working correctly.');
      return true;
    } else {
      console.log(`❌ ${total - passed} tests failed.`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test
testUnifiedSystem().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});