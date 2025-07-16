/**
 * Type-Specific Ordering Fix Test
 * 
 * Verifies that each custom type has independent order counting
 */

// Mock environment
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

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
  getElementById: (id) => {
    if (id === 'test-canvas') return mockCanvas;
    return {
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      textContent: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
  },
  createElement: () => ({ appendChild: () => {} }),
  head: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = {
  PlantAnnotationTool: {
    appState: {
      currentImage: { id: 'test-image-1', name: 'test.jpg' },
      currentPlant: { id: 'test-plant-1', name: 'Test Plant' }
    }
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Test the type-specific ordering fix
async function testTypeSpecificOrdering() {
  console.log('🔧 Testing Type-Specific Ordering Fix');
  console.log('=' .repeat(60));
  
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
    
    // Mock loaded image
    annotationTool.imageElement = { width: 800, height: 600 };
    annotationTool.imageLoaded = true;
    
    // Create different custom types
    const stemAbortedType = customAnnotationManager.createCustomType({
      id: 'stem-aborted',
      name: 'Stem Aborted',
      type: 'point',
      color: '#ff0000'
    });
    
    const rootTipType = customAnnotationManager.createCustomType({
      id: 'root-tip',
      name: 'Root Tip',
      type: 'point',
      color: '#00ff00'
    });
    
    const leafDamageType = customAnnotationManager.createCustomType({
      id: 'leaf-damage',
      name: 'Leaf Damage',
      type: 'region',
      color: '#0000ff'
    });
    
    console.log('\n📋 Testing type-specific ordering...');
    
    // Test 1: Regular annotations have independent ordering
    test('Regular annotations have independent ordering', () => {
      const regular1 = annotationTool.addKeypointWithDirection(100, 100, 0);
      const regular2 = annotationTool.addKeypointWithDirection(200, 200, 90);
      
      if (regular1.order !== 1 || regular2.order !== 2) {
        throw new Error(`Regular annotations should have orders 1,2 but got ${regular1.order},${regular2.order}`);
      }
      
      if (regular1.annotationType !== 'regular' || regular2.annotationType !== 'regular') {
        throw new Error('Regular annotations should have annotationType: regular');
      }
    });
    
    // Test 2: Each custom type has independent ordering
    test('Each custom type has independent ordering', () => {
      // Create first set of annotations
      const stem1 = annotationTool.addCustomPointAnnotation(300, 300, stemAbortedType.id);
      const root1 = annotationTool.addCustomPointAnnotation(400, 400, rootTipType.id);
      const leaf1 = annotationTool.addCustomRegionAnnotation(500, 500, 50, 50, leafDamageType.id);
      
      // Each type should start at order 1
      if (stem1.order !== 1) {
        throw new Error(`stem-aborted #1 should have order 1, got ${stem1.order}`);
      }
      if (root1.order !== 1) {
        throw new Error(`root-tip #1 should have order 1, got ${root1.order}`);
      }
      if (leaf1.order !== 1) {
        throw new Error(`leaf-damage #1 should have order 1, got ${leaf1.order}`);
      }
      
      // Create second set
      const stem2 = annotationTool.addCustomPointAnnotation(310, 310, stemAbortedType.id);
      const root2 = annotationTool.addCustomPointAnnotation(410, 410, rootTipType.id);
      const leaf2 = annotationTool.addCustomRegionAnnotation(510, 510, 60, 60, leafDamageType.id);
      
      // Each type should now be at order 2
      if (stem2.order !== 2) {
        throw new Error(`stem-aborted #2 should have order 2, got ${stem2.order}`);
      }
      if (root2.order !== 2) {
        throw new Error(`root-tip #2 should have order 2, got ${root2.order}`);
      }
      if (leaf2.order !== 2) {
        throw new Error(`leaf-damage #2 should have order 2, got ${leaf2.order}`);
      }
    });
    
    // Test 3: Verify current annotation counts
    test('Verify current annotation counts', () => {
      const regularCount = annotationTool.keypoints.filter(kp => kp.annotationType === 'regular').length;
      const stemCount = annotationTool.keypoints.filter(kp => kp.customTypeId === 'stem-aborted').length;
      const rootCount = annotationTool.keypoints.filter(kp => kp.customTypeId === 'root-tip').length;
      const leafCount = annotationTool.keypoints.filter(kp => kp.customTypeId === 'leaf-damage').length;
      
      if (regularCount !== 2) {
        throw new Error(`Expected 2 regular annotations, got ${regularCount}`);
      }
      if (stemCount !== 2) {
        throw new Error(`Expected 2 stem-aborted annotations, got ${stemCount}`);
      }
      if (rootCount !== 2) {
        throw new Error(`Expected 2 root-tip annotations, got ${rootCount}`);
      }
      if (leafCount !== 2) {
        throw new Error(`Expected 2 leaf-damage annotations, got ${leafCount}`);
      }
    });
    
    // Test 4: Test gap filling within types
    test('Gap filling works within each type', () => {
      // Remove the first stem-aborted annotation (order 1)
      const stemAnnotations = annotationTool.keypoints.filter(kp => kp.customTypeId === 'stem-aborted');
      const stemToRemove = stemAnnotations.find(kp => kp.order === 1);
      annotationTool.removeKeypoint(stemToRemove);
      
      // Add new stem-aborted annotation - should get order 1 (fill gap)
      const stem3 = annotationTool.addCustomPointAnnotation(320, 320, stemAbortedType.id);
      
      if (stem3.order !== 1) {
        throw new Error(`New stem-aborted should fill gap with order 1, got ${stem3.order}`);
      }
      
      // Other types should be unaffected
      const rootAnnotations = annotationTool.keypoints.filter(kp => kp.customTypeId === 'root-tip');
      const rootOrders = rootAnnotations.map(kp => kp.order).sort();
      
      if (rootOrders[0] !== 1 || rootOrders[1] !== 2) {
        throw new Error(`root-tip orders should still be [1,2], got [${rootOrders.join(',')}]`);
      }
    });
    
    // Test 5: Test data export includes type-specific ordering
    test('Data export preserves type-specific ordering', () => {
      const exportData = annotationTool.getAnnotationData();
      
      // Group by type
      const byType = {};
      exportData.keypoints.forEach(kp => {
        const typeKey = kp.annotationType === 'regular' ? 'regular' : kp.customTypeId;
        if (!byType[typeKey]) byType[typeKey] = [];
        byType[typeKey].push(kp);
      });
      
      // Check that each type has proper sequential ordering
      Object.entries(byType).forEach(([typeKey, annotations]) => {
        const orders = annotations.map(kp => kp.order).sort((a, b) => a - b);
        const expectedOrders = Array.from({length: orders.length}, (_, i) => i + 1);
        
        // Allow for gaps (since we removed one annotation)
        if (typeKey === 'stem-aborted') {
          // Should have orders [1, 2] after gap filling
          if (orders.length !== 2 || orders[0] !== 1 || orders[1] !== 2) {
            throw new Error(`stem-aborted should have orders [1,2], got [${orders.join(',')}]`);
          }
        } else {
          // Other types should have sequential ordering
          const hasValidOrdering = orders.every((order, index) => order === expectedOrders[index]);
          if (!hasValidOrdering) {
            throw new Error(`${typeKey} should have sequential ordering, got [${orders.join(',')}]`);
          }
        }
      });
    });
    
    // Test 6: Test type-specific ordering methods
    test('Type-specific ordering methods work correctly', () => {
      // Test findNextAvailableOrderForType
      const nextStemOrder = annotationTool.findNextAvailableOrderForType('stem-aborted');
      const nextRootOrder = annotationTool.findNextAvailableOrderForType('root-tip');
      const nextLeafOrder = annotationTool.findNextAvailableOrderForType('leaf-damage');
      
      if (nextStemOrder !== 3) {
        throw new Error(`Next stem-aborted order should be 3, got ${nextStemOrder}`);
      }
      if (nextRootOrder !== 3) {
        throw new Error(`Next root-tip order should be 3, got ${nextRootOrder}`);
      }
      if (nextLeafOrder !== 3) {
        throw new Error(`Next leaf-damage order should be 3, got ${nextLeafOrder}`);
      }
      
      // Test regular annotation ordering
      const nextRegularOrder = annotationTool.findNextAvailableOrder();
      if (nextRegularOrder !== 3) {
        throw new Error(`Next regular order should be 3, got ${nextRegularOrder}`);
      }
    });
    
    console.log(`\n🎯 Test Results: ${passed}/${total} tests passed`);
    
    // Show final state
    console.log('\n📊 Final Annotation State:');
    const finalCounts = {};
    annotationTool.keypoints.forEach(kp => {
      const typeKey = kp.annotationType === 'regular' ? 'regular' : kp.customTypeId;
      if (!finalCounts[typeKey]) finalCounts[typeKey] = [];
      finalCounts[typeKey].push(kp.order);
    });
    
    Object.entries(finalCounts).forEach(([type, orders]) => {
      console.log(`   ${type}: orders [${orders.sort((a, b) => a - b).join(', ')}]`);
    });
    
    if (passed === total) {
      console.log('\n🎉 Type-specific ordering fix is working correctly!');
      console.log('✅ Each custom type has independent order counting');
      console.log('✅ Regular annotations have independent ordering');
      console.log('✅ Gap filling works within each type');
      return true;
    } else {
      console.log(`\n❌ ${total - passed} tests failed - fix needs additional work`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test
testTypeSpecificOrdering().then(success => {
  console.log('\n' + '=' .repeat(60));
  if (success) {
    console.log('🎉 FIX VERIFIED: Type-specific ordering is working correctly!');
    console.log('📋 Each custom type now has independent order counting');
  } else {
    console.log('❌ FIX VALIDATION FAILED: Additional work required');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});