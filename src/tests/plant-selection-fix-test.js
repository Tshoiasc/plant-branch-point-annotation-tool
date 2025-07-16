/**
 * Plant Selection Error Fix Validation Test
 * 
 * Tests that plant selection works without clearCustomAnnotationsWithoutSave error
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

// Test the fixed functionality
async function testPlantSelectionFix() {
  console.log('🧪 Testing plant selection fix...');
  
  try {
    // Import the fixed AnnotationTool
    const { AnnotationTool } = await import('../core/AnnotationTool.js');
    
    // Create an instance
    const annotationTool = new AnnotationTool('test-canvas');
    
    // Add some test annotations
    annotationTool.addKeypointWithDirection(100, 200, 0); // Regular annotation
    console.log('✅ Regular annotation added');
    
    // Test clearKeypointsWithoutSave (the method that was causing the error)
    annotationTool.clearKeypointsWithoutSave();
    console.log('✅ clearKeypointsWithoutSave() executed without error');
    
    // Test clearKeypoints as well
    annotationTool.addKeypointWithDirection(150, 250, 90);
    annotationTool.clearKeypoints();
    console.log('✅ clearKeypoints() executed without error');
    
    // Test clearImage (which calls clearKeypointsWithoutSave)
    annotationTool.clearImage();
    console.log('✅ clearImage() executed without error');
    
    console.log('🎉 All tests passed! Plant selection error is fixed.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testPlantSelectionFix().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});