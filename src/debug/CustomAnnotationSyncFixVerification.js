/**
 * Custom Annotation Real-Time Sync Fix Verification
 * 
 * This script validates that the appState fix resolves the sync issue
 */

async function verifyCustomAnnotationSyncFix() {
  console.clear();
  console.log('🔧 Verifying Custom Annotation Real-Time Sync Fix');
  console.log('==============================================');
  console.log('Time:', new Date().toLocaleString());
  console.log('');
  
  const issues = [];
  
  // Check if components are available
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const appState = window.PlantAnnotationTool?.appState;
  const customAnnotationManager = annotationTool?.customAnnotationManager;
  
  console.log('📋 Component Availability Check:');
  console.log(`  AnnotationTool: ${annotationTool ? '✅' : '❌'}`);
  console.log(`  RealTimeSyncManager: ${realTimeSyncManager ? '✅' : '❌'}`);
  console.log(`  AppState: ${appState ? '✅' : '❌'}`);
  console.log(`  CustomAnnotationManager: ${customAnnotationManager ? '✅' : '❌'}`);
  console.log('');
  
  if (!annotationTool || !realTimeSyncManager || !appState || !customAnnotationManager) {
    console.log('❌ Missing required components, cannot proceed with sync test');
    return false;
  }
  
  // Check app state validity
  console.log('📋 App State Check:');
  console.log(`  Current Plant: ${appState.currentPlant ? appState.currentPlant.id : 'None'}`);
  console.log(`  Current Image: ${appState.currentImage ? appState.currentImage.id : 'None'}`);
  console.log(`  View Angle: ${appState.currentPlant?.selectedViewAngle || 'None'}`);
  console.log('');
  
  if (!appState.currentPlant || !appState.currentImage) {
    console.log('⚠️ No current plant/image selected. Please select a plant and image for sync testing.');
    return false;
  }
  
  // Check real-time sync status
  const isSyncEnabled = realTimeSyncManager.isRealTimeSyncEnabled();
  console.log('📋 Real-Time Sync Status:');
  console.log(`  Enabled: ${isSyncEnabled ? '✅' : '❌'}`);
  console.log('');
  
  if (!isSyncEnabled) {
    console.log('⚠️ Real-time sync is disabled. Please enable it (check "Real-time Change" checkbox).');
    return false;
  }
  
  // Test sync method availability
  console.log('📋 Sync Method Check:');
  const methods = [
    'triggerCustomAnnotationCreateSync',
    'triggerCustomAnnotationUpdateSync', 
    'triggerCustomAnnotationDeleteSync'
  ];
  
  for (const method of methods) {
    const available = typeof customAnnotationManager[method] === 'function';
    console.log(`  ${method}: ${available ? '✅' : '❌'}`);
    if (!available) issues.push(`Missing method: ${method}`);
  }
  console.log('');
  
  // Test RealTimeSyncManager method
  const hasCustomSync = typeof realTimeSyncManager.triggerCustomAnnotationSync === 'function';
  console.log('📋 RealTimeSyncManager Method:');
  console.log(`  triggerCustomAnnotationSync: ${hasCustomSync ? '✅' : '❌'}`);
  console.log('');
  
  if (!hasCustomSync) {
    issues.push('Missing triggerCustomAnnotationSync method in RealTimeSyncManager');
  }
  
  // Simulate sync data to test context structure
  console.log('📋 Context Structure Test:');
  try {
    // Create mock annotation
    const mockAnnotation = {
      id: 'test-' + Date.now(),
      x: 100,
      y: 100,
      order: 1,
      annotationType: 'custom',
      customTypeId: 'test-type'
    };
    
    // Test each sync method's context preparation
    const testMethods = [
      { name: 'CREATE', method: 'triggerCustomAnnotationCreateSync' },
      { name: 'UPDATE', method: 'triggerCustomAnnotationUpdateSync' },
      { name: 'DELETE', method: 'triggerCustomAnnotationDeleteSync' }
    ];
    
    for (const { name, method } of testMethods) {
      console.log(`  Testing ${name} context preparation...`);
      
      // Temporarily override the real sync to capture context
      const originalTrigger = realTimeSyncManager.triggerCustomAnnotationSync;
      let capturedSyncData = null;
      
      realTimeSyncManager.triggerCustomAnnotationSync = function(syncData) {
        capturedSyncData = syncData;
        console.log(`    Context captured for ${name}:`, syncData.context);
      };
      
      try {
        // Call the sync method
        customAnnotationManager[method](mockAnnotation, { test: 'context' });
        
        // Verify context has required fields
        if (capturedSyncData && capturedSyncData.context) {
          const ctx = capturedSyncData.context;
          const hasPlantId = !!ctx.plantId;
          const hasImageId = !!ctx.imageId;
          const hasViewAngle = !!ctx.viewAngle;
          const hasAppState = !!ctx.appState;
          
          console.log(`    ${name} Context Fields:`);
          console.log(`      plantId: ${hasPlantId ? '✅' : '❌'}`);
          console.log(`      imageId: ${hasImageId ? '✅' : '❌'}`);
          console.log(`      viewAngle: ${hasViewAngle ? '✅' : '❌'}`);
          console.log(`      appState: ${hasAppState ? '✅' : '❌'}`);
          
          if (!hasAppState) {
            issues.push(`${name} method missing appState in context`);
          }
        } else {
          issues.push(`${name} method failed to create sync data`);
        }
      } catch (error) {
        console.log(`    ❌ ${name} method error:`, error.message);
        issues.push(`${name} method threw error: ${error.message}`);
      }
      
      // Restore original method
      realTimeSyncManager.triggerCustomAnnotationSync = originalTrigger;
    }
  } catch (error) {
    console.log('❌ Context structure test failed:', error.message);
    issues.push(`Context test error: ${error.message}`);
  }
  
  console.log('');
  
  // Summary
  console.log('🎯 Fix Verification Results:');
  console.log('===========================');
  
  if (issues.length === 0) {
    console.log('✅ All checks passed! The appState fix has been successfully applied.');
    console.log('');
    console.log('🚀 Custom annotation real-time sync should now work properly!');
    console.log('');
    console.log('📋 To test:');
    console.log('1. Ensure real-time sync is enabled (Real-time Change checkbox)');
    console.log('2. Switch to custom annotation mode');
    console.log('3. Add/update/delete custom annotations');
    console.log('4. Check console for sync success messages');
    console.log('5. Verify annotations appear in future images');
    return true;
  } else {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
    console.log('🔧 Please review the implementation and ensure all fixes are properly applied.');
    return false;
  }
}

// Export function
window.verifyCustomAnnotationSyncFix = verifyCustomAnnotationSyncFix;

console.log('🔧 Custom annotation sync fix verification script loaded');
console.log('Run verifyCustomAnnotationSyncFix() in browser console to test the fix');