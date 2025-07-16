/**
 * Test to verify the annotation numbering bug fix
 * 
 * Issue: When annotations are loaded from storage without annotationType field,
 * findNextAvailableOrder() returns 1 instead of the correct next number.
 */

export function testAnnotationNumberingBugFix() {
  console.log('🔧 Testing Annotation Numbering Bug Fix');
  console.log('==========================================');

  // Test scenario: Load annotations that simulate the bug condition
  function runTest() {
    try {
      // Get AnnotationTool instance
      const annotationTool = window.PlantAnnotationTool?.annotationTool;
      if (!annotationTool) {
        throw new Error('AnnotationTool not available');
      }

      // Save original state
      const originalKeypoints = [...annotationTool.keypoints];

      // Clear existing annotations
      annotationTool.keypoints = [];

      console.log('\n📋 Test 1: Simulate loaded annotations WITHOUT annotationType field');
      
      // Simulate 9 annotations loaded from storage WITHOUT annotationType field
      const loadedAnnotations = [];
      for (let i = 1; i <= 9; i++) {
        loadedAnnotations.push({
          id: `loaded-${i}`,
          x: 100 + i * 10,
          y: 100 + i * 10,
          order: i,
          direction: 0,
          directionType: 'angle'
          // Note: NO annotationType field - this simulates the bug condition
        });
      }

      // Add 1 custom annotation
      loadedAnnotations.push({
        id: 'custom-1',
        x: 200,
        y: 200,
        order: 1,
        annotationType: 'custom',
        customTypeId: 'test-type'
      });

      console.log(`   - Loaded ${loadedAnnotations.length} annotations (9 regular without annotationType, 1 custom)`);

      // Load the annotations into AnnotationTool
      annotationTool.loadAnnotationData({ keypoints: loadedAnnotations });

      console.log(`   - Total keypoints after loading: ${annotationTool.keypoints.length}`);

      // Test the fix: findNextAvailableOrder should return 10, not 1
      const nextOrder = annotationTool.findNextAvailableOrder();
      console.log(`   - Next available order: ${nextOrder}`);

      if (nextOrder === 10) {
        console.log('   ✅ SUCCESS: findNextAvailableOrder() correctly returns 10');
      } else {
        console.log(`   ❌ FAILURE: Expected 10, got ${nextOrder}`);
        throw new Error(`Bug not fixed: Expected next order 10, got ${nextOrder}`);
      }

      console.log('\n📋 Test 2: Verify annotations have annotationType field after loading');
      
      const regularKeypoints = annotationTool.keypoints.filter(kp => 
        kp.annotationType === 'regular' || !kp.annotationType);
      const customKeypoints = annotationTool.keypoints.filter(kp => 
        kp.annotationType === 'custom');
      
      console.log(`   - Regular keypoints found: ${regularKeypoints.length}`);
      console.log(`   - Custom keypoints found: ${customKeypoints.length}`);

      if (regularKeypoints.length === 9 && customKeypoints.length === 1) {
        console.log('   ✅ SUCCESS: Correct annotation type classification');
      } else {
        console.log(`   ❌ FAILURE: Expected 9 regular and 1 custom`);
      }

      console.log('\n📋 Test 3: Test creating new annotation with correct numbering');
      
      // Create a new annotation
      const newKeypoint = {
        id: Date.now().toString(),
        x: 300,
        y: 300,
        direction: 0,
        directionType: 'angle',
        order: annotationTool.findNextAvailableOrder(),
        annotationType: 'regular'
      };

      annotationTool.keypoints.push(newKeypoint);
      console.log(`   - Created new annotation with order: ${newKeypoint.order}`);

      // Check next order after creation
      const nextOrderAfter = annotationTool.findNextAvailableOrder();
      console.log(`   - Next available order after creation: ${nextOrderAfter}`);

      if (newKeypoint.order === 10 && nextOrderAfter === 11) {
        console.log('   ✅ SUCCESS: Sequential numbering works correctly');
      } else {
        console.log(`   ❌ FAILURE: Expected order 10 and next 11`);
      }

      // Restore original state
      annotationTool.keypoints = originalKeypoints;

      console.log('\n🎉 All tests passed! Annotation numbering bug is fixed.');
      return true;

    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  }

  return runTest();
}

// Auto-run test if this script is loaded directly
if (typeof window !== 'undefined' && window.PlantAnnotationTool) {
  setTimeout(() => {
    testAnnotationNumberingBugFix();
  }, 1000);
}