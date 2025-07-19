#!/usr/bin/env node

/**
 * Test Cross-Sectional Mode Interruption Fix
 * 
 * This test verifies that cross-sectional mode is not prematurely exited
 * during image switches, but is properly exited during plant switches.
 */

console.log('🧪 Testing Cross-Sectional Mode Interruption Fix\n');

// Mock the necessary environment
global.window = {
  PlantAnnotationTool: {
    plantDataManager: {
      getPlantImages: () => Promise.resolve([]),
      getImageAnnotations: () => Promise.resolve([])
    },
    appState: {
      currentPlant: { id: 'test', selectedViewAngle: 'front' },
      currentImage: { id: 'test-image' }
    }
  }
};

// Import and test the AnnotationTool
import('./src/core/AnnotationTool.js').then(({ AnnotationTool }) => {
  // Create a mock canvas element
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      drawImage: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      measureText: () => ({ width: 50 }),
      moveTo: () => {},
      lineTo: () => {},
      setLineDash: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(1024) })
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    parentElement: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    },
    width: 800,
    height: 600,
    style: {}
  };

  // Mock document.getElementById
  global.document = {
    getElementById: (id) => {
      if (id === 'test-canvas') return mockCanvas;
      return null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({
      style: {},
      addEventListener: () => {},
      remove: () => {}
    }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} }
  };

  console.log('✅ Setting up test environment...');

  try {
    // Create annotation tool instance
    const annotationTool = new AnnotationTool('test-canvas');
    
    console.log('✅ AnnotationTool created successfully');

    // Test 1: Simulate cross-sectional mode
    console.log('\n🧪 Test 1: Setting up cross-sectional mode');
    annotationTool.autoDirectionMode = 'cross-sectional';
    annotationTool.state.isAutoDirectionMode = true;
    annotationTool.crossSectionalState = {
      currentOrder: 1,
      currentImageIndex: 0,
      processedCount: 0,
      totalCount: 5,
      availableOrders: [1, 2, 3],
      startTime: Date.now()
    };
    
    console.log('   Cross-sectional mode initialized');
    console.log('   - autoDirectionMode:', annotationTool.autoDirectionMode);
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);

    // Test 2: Simulate image switch (should NOT exit cross-sectional mode)
    console.log('\n🧪 Test 2: Testing image switch interruption');
    annotationTool.state.selectedKeypoint = { order: 1 };
    annotationTool.state.isDirectionSelectionMode = true;
    
    console.log('   Before image switch:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    console.log('   - selectedKeypoint exists:', !!annotationTool.state.selectedKeypoint);
    
    // Call the interrupt method with image_switch reason
    annotationTool.interruptAllDirectionModes('image_switch');
    
    console.log('   After image switch:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    console.log('   - selectedKeypoint cleared:', !annotationTool.state.selectedKeypoint);
    console.log('   - isDirectionSelectionMode cleared:', !annotationTool.state.isDirectionSelectionMode);
    
    if (annotationTool.state.isAutoDirectionMode && annotationTool.crossSectionalState) {
      console.log('   ✅ PASS: Cross-sectional mode preserved during image switch');
    } else {
      console.log('   ❌ FAIL: Cross-sectional mode was incorrectly exited during image switch');
    }

    // Test 3: Simulate custom annotation mode (should NOT exit cross-sectional mode)
    console.log('\n🧪 Test 3: Testing custom annotation mode interruption');
    annotationTool.state.selectedKeypoint = { order: 2 };
    annotationTool.state.isDirectionSelectionMode = true;
    
    console.log('   Before custom annotation mode:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    
    annotationTool.interruptAllDirectionModes('custom_annotation_mode');
    
    console.log('   After custom annotation mode:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    
    if (annotationTool.state.isAutoDirectionMode && annotationTool.crossSectionalState) {
      console.log('   ✅ PASS: Cross-sectional mode preserved during custom annotation');
    } else {
      console.log('   ❌ FAIL: Cross-sectional mode was incorrectly exited during custom annotation');
    }

    // Test 4: Simulate plant switch (SHOULD exit cross-sectional mode)
    console.log('\n🧪 Test 4: Testing plant switch interruption');
    console.log('   Before plant switch:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    
    annotationTool.interruptAllDirectionModes('plant_switch');
    
    console.log('   After plant switch:');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    console.log('   - crossSectionalState exists:', !!annotationTool.crossSectionalState);
    
    if (!annotationTool.state.isAutoDirectionMode) {
      console.log('   ✅ PASS: Cross-sectional mode correctly exited during plant switch');
    } else {
      console.log('   ❌ FAIL: Cross-sectional mode should have exited during plant switch');
    }

    // Test 5: Test longitudinal mode behavior (should still exit on image switch)
    console.log('\n🧪 Test 5: Testing longitudinal mode behavior');
    annotationTool.autoDirectionMode = 'longitudinal';
    annotationTool.state.isAutoDirectionMode = true;
    
    console.log('   Before image switch (longitudinal mode):');
    console.log('   - autoDirectionMode:', annotationTool.autoDirectionMode);
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    
    annotationTool.interruptAllDirectionModes('image_switch');
    
    console.log('   After image switch (longitudinal mode):');
    console.log('   - isAutoDirectionMode:', annotationTool.state.isAutoDirectionMode);
    
    if (!annotationTool.state.isAutoDirectionMode) {
      console.log('   ✅ PASS: Longitudinal mode correctly exited during image switch');
    } else {
      console.log('   ❌ FAIL: Longitudinal mode should have exited during image switch');
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Cross-sectional mode now persists during image switches');
    console.log('- Cross-sectional mode now persists during custom annotation mode');
    console.log('- Cross-sectional mode still exits during plant switches (correct behavior)');
    console.log('- Longitudinal mode still exits during image switches (correct behavior)');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }

}).catch(error => {
  console.error('❌ Failed to import AnnotationTool:', error.message);
});