/**
 * Multi-Direction Annotation Demo
 * 
 * This demo shows how to use the new multi-direction annotation feature.
 */

function demonstrateMultiDirectionAnnotation() {
  console.clear();
  console.log('🎯 Multi-Direction Annotation Feature Demo');
  console.log('==========================================');
  console.log('Time:', new Date().toLocaleString());
  console.log('');
  
  // Step 1: Check if the feature is available
  console.log('📋 Step 1: Feature Availability Check');
  console.log('====================================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  if (!annotationTool) {
    console.log('❌ AnnotationTool not available');
    console.log('Please make sure the plant annotation tool is initialized');
    return;
  }
  
  console.log('✅ AnnotationTool available');
  
  // Check if multi-direction methods exist
  const requiredMethods = [
    'handleMiddleMouseButton',
    'handleScrollWheel',
    'enterDirectionCountMode',
    'exitDirectionCountMode',
    'interruptAllDirectionModes',
    'addDirectionToKeypoint',
    'renderMultipleDirections'
  ];
  
  const missingMethods = requiredMethods.filter(method => 
    typeof annotationTool[method] !== 'function'
  );
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing methods:', missingMethods.join(', '));
    return;
  }
  
  console.log('✅ All required methods available');
  console.log('');
  
  // Step 2: Usage Instructions
  console.log('📋 Step 2: How to Use Multi-Direction Annotation');
  console.log('===============================================');
  console.log('');
  
  console.log('🎯 Basic Workflow:');
  console.log('1. 📍 Create annotation points normally (left click)');
  console.log('2. 👆 Click on an annotation point to select it');
  console.log('3. 🖱️ Press middle mouse button to enter direction count mode');
  console.log('4. 🎛️ Use scroll wheel to adjust direction count (1-8)');
  console.log('5. 🖱️ Press middle mouse button again to confirm');
  console.log('6. 👆 Click to set each direction one by one');
  console.log('7. ✅ Process completes automatically when all directions are set');
  console.log('');
  
  console.log('🎯 Interaction Details:');
  console.log('• Middle mouse button: Enter/exit direction count selection');
  console.log('• Scroll wheel: Adjust direction count (only in selection mode)');
  console.log('• Left click: Set direction (after count is confirmed)');
  console.log('• Right click: Cancel/interrupt any direction operation');
  console.log('');
  
  console.log('🎯 Interruption Scenarios:');
  console.log('• Image switching: Automatically interrupts all direction modes');
  console.log('• Plant switching: Automatically interrupts all direction modes');
  console.log('• Custom annotation mode: Automatically interrupts all direction modes');
  console.log('• Manual cancellation: Right click or escape key');
  console.log('');
  
  // Step 3: Current State Check
  console.log('📋 Step 3: Current State');
  console.log('=======================');
  
  const currentState = {
    isDirectionCountMode: annotationTool.state.isDirectionCountMode,
    isDirectionSelectionMode: annotationTool.state.isDirectionSelectionMode,
    selectedKeypoint: annotationTool.state.selectedKeypoint,
    currentDirectionCount: annotationTool.state.currentDirectionCount,
    directionsSet: annotationTool.state.directionsSet
  };
  
  console.log('Current annotation tool state:', currentState);
  
  // Check for existing annotation points
  const keypointCount = annotationTool.keypoints?.length || 0;
  console.log(`Total annotation points: ${keypointCount}`);
  
  if (keypointCount > 0) {
    const multiDirectionPoints = annotationTool.keypoints.filter(kp => 
      kp.maxDirections > 1 || (kp.directions && kp.directions.length > 1)
    );
    console.log(`Multi-direction points: ${multiDirectionPoints.length}`);
    
    if (multiDirectionPoints.length > 0) {
      console.log('Multi-direction point details:');
      multiDirectionPoints.forEach((point, index) => {
        console.log(`  ${index + 1}. Point #${point.order}: ${point.directions?.length || 0}/${point.maxDirections || 1} directions`);
      });
    }
  }
  console.log('');
  
  // Step 4: Demo Example
  console.log('📋 Step 4: Demo Example (Simulated)');
  console.log('===================================');
  console.log('');
  
  console.log('🎯 Creating a demo keypoint with 3 directions:');
  
  // Create a mock keypoint for demonstration
  const demoKeypoint = {
    id: 'demo-keypoint-' + Date.now(),
    x: 100,
    y: 100,
    order: 999,
    directions: [
      { angle: 0, type: 'angle' },
      { angle: 120, type: 'angle' },
      { angle: 240, type: 'angle' }
    ],
    maxDirections: 3,
    annotationType: 'regular'
  };
  
  console.log('Demo keypoint created:', {
    id: demoKeypoint.id,
    order: demoKeypoint.order,
    maxDirections: demoKeypoint.maxDirections,
    currentDirections: demoKeypoint.directions.length,
    directions: demoKeypoint.directions.map(d => `${d.angle}°`)
  });
  
  console.log('');
  console.log('🎯 Testing direction manipulation:');
  
  // Test adding a direction
  const newDirection = { angle: 180, type: 'angle' };
  const canAdd = annotationTool.addDirectionToKeypoint(demoKeypoint, newDirection);
  console.log(`Can add direction: ${canAdd}`);
  
  if (canAdd) {
    console.log('Direction added successfully');
    console.log('Updated directions:', demoKeypoint.directions.map(d => `${d.angle}°`));
  }
  
  // Test removing a direction
  const canRemove = annotationTool.removeDirectionFromKeypoint(demoKeypoint, 0);
  console.log(`Can remove direction: ${canRemove}`);
  
  if (canRemove) {
    console.log('Direction removed successfully');
    console.log('Updated directions:', demoKeypoint.directions.map(d => `${d.angle}°`));
  }
  
  console.log('');
  
  // Step 5: Testing Instructions
  console.log('📋 Step 5: Manual Testing Instructions');
  console.log('=====================================');
  console.log('');
  
  console.log('🧪 To test the multi-direction feature:');
  console.log('1. 🖼️ Load an image in the annotation tool');
  console.log('2. 📍 Create a regular annotation point (left click)');
  console.log('3. 🔍 Click on the point to select it (should highlight)');
  console.log('4. 🖱️ Press middle mouse button (should show direction count prompt)');
  console.log('5. 🎛️ Scroll up/down to change direction count (watch the prompt)');
  console.log('6. 🖱️ Press middle mouse button again (should start direction setting)');
  console.log('7. 👆 Click to set each direction (should show progress)');
  console.log('8. ✅ After setting all directions, mode should exit automatically');
  console.log('');
  
  console.log('🧪 To test interruption handling:');
  console.log('1. 🖱️ Enter direction count mode (middle mouse button)');
  console.log('2. 🔄 Switch to another image (should interrupt)');
  console.log('3. 🖱️ Or enter direction count mode again');
  console.log('4. 🎨 Switch to custom annotation mode (should interrupt)');
  console.log('5. 🖱️ Or enter direction count mode again');
  console.log('6. 🌱 Switch to another plant (should interrupt)');
  console.log('');
  
  console.log('🎯 Expected Visual Feedback:');
  console.log('• Direction count prompt appears with current count');
  console.log('• Progress indicator shows directions set vs total');
  console.log('• Multiple arrows render for multi-direction points');
  console.log('• Cursor changes appropriately for each mode');
  console.log('• All prompts disappear when interrupted');
  console.log('');
  
  // Step 6: Troubleshooting
  console.log('📋 Step 6: Troubleshooting');
  console.log('=========================');
  console.log('');
  
  console.log('❓ Common Issues:');
  console.log('• Middle mouse button not working:');
  console.log('  - Check if browser blocks middle mouse events');
  console.log('  - Try in different browser or check mouse settings');
  console.log('');
  console.log('• Scroll wheel not adjusting count:');
  console.log('  - Make sure you are in direction count mode first');
  console.log('  - Check browser console for error messages');
  console.log('');
  console.log('• Interruption not working:');
  console.log('  - Check if interruption methods are properly called');
  console.log('  - Look for console logs with "[多方向]" prefix');
  console.log('');
  console.log('• Visual rendering issues:');
  console.log('  - Check if renderMultipleDirections is called');
  console.log('  - Verify direction data structure is correct');
  console.log('');
  
  console.log('🎉 Multi-Direction Annotation Demo Complete!');
  console.log('');
  console.log('Next: Try the feature manually with the instructions above');
}

// Export the demo function
window.demonstrateMultiDirectionAnnotation = demonstrateMultiDirectionAnnotation;

console.log('🎯 Multi-direction annotation demo script loaded');
console.log('Run demonstrateMultiDirectionAnnotation() to see the demo');