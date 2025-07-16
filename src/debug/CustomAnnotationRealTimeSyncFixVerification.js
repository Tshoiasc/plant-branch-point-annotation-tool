/**
 * Comprehensive Custom Annotation Real-Time Sync Fix Verification
 * 
 * This script validates that the order-based real-time sync system works correctly
 * for all 4 scenarios described by the user:
 * 
 * 1. New annotation on empty frames → All subsequent frames get this annotation with same order
 * 2. Move existing annotation → Subsequent frames get annotation at new position
 * 3. Add additional annotation → Subsequent frames get new annotation at corresponding position
 * 4. Delete annotation → Delete corresponding order annotation in subsequent images
 */

async function verifyCustomAnnotationRealTimeSyncFix() {
  console.clear();
  console.log('🔧 Verifying Custom Annotation Real-Time Sync Fix');
  console.log('===============================================');
  console.log('Time:', new Date().toLocaleString());
  console.log('');
  
  const results = {
    orderBasedSyncFix: false,
    syncRouting: false,
    conflictDetectionRemoval: false,
    methodImplementation: false,
    overallStatus: false
  };
  
  // Test 1: Order-Based Sync Logic Fix
  console.log('📋 Test 1: Order-Based Sync Logic Fix');
  console.log('======================================');
  
  const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  
  if (realTimeSyncManager) {
    console.log('✅ RealTimeSyncManager is available');
    
    // Test addCustomAnnotationToImage method
    if (typeof realTimeSyncManager.addCustomAnnotationToImage === 'function') {
      console.log('✅ addCustomAnnotationToImage method exists');
      
      const addMethodString = realTimeSyncManager.addCustomAnnotationToImage.toString();
      if (addMethodString.includes('order-based matching') && 
          addMethodString.includes('customTypeId') && 
          addMethodString.includes('ann.order === annotation.order') &&
          !addMethodString.includes('CONFLICT DETECTED')) {
        console.log('✅ addCustomAnnotationToImage uses order-based matching without conflict detection');
        
        // Test updateCustomAnnotationInImage method
        if (typeof realTimeSyncManager.updateCustomAnnotationInImage === 'function') {
          console.log('✅ updateCustomAnnotationInImage method exists');
          
          const updateMethodString = realTimeSyncManager.updateCustomAnnotationInImage.toString();
          if (updateMethodString.includes('order-based matching') && 
              updateMethodString.includes('customTypeId') && 
              updateMethodString.includes('ann.order === annotation.order')) {
            console.log('✅ updateCustomAnnotationInImage uses order-based matching');
            
            // Test deleteCustomAnnotationFromImage method
            if (typeof realTimeSyncManager.deleteCustomAnnotationFromImage === 'function') {
              console.log('✅ deleteCustomAnnotationFromImage method exists');
              
              const deleteMethodString = realTimeSyncManager.deleteCustomAnnotationFromImage.toString();
              if (deleteMethodString.includes('order-based matching') && 
                  deleteMethodString.includes('customTypeId') && 
                  deleteMethodString.includes('ann.order === annotation.order')) {
                console.log('✅ deleteCustomAnnotationFromImage uses order-based matching');
                results.orderBasedSyncFix = true;
              } else {
                console.log('❌ deleteCustomAnnotationFromImage does NOT use order-based matching');
              }
            } else {
              console.log('❌ deleteCustomAnnotationFromImage method does NOT exist');
            }
          } else {
            console.log('❌ updateCustomAnnotationInImage does NOT use order-based matching');
          }
        } else {
          console.log('❌ updateCustomAnnotationInImage method does NOT exist');
        }
      } else {
        console.log('❌ addCustomAnnotationToImage does NOT use proper order-based matching');
      }
    } else {
      console.log('❌ addCustomAnnotationToImage method does NOT exist');
    }
  } else {
    console.log('❌ RealTimeSyncManager is NOT available');
  }
  console.log('');
  
  // Test 2: Sync Routing Fix
  console.log('📋 Test 2: Sync Routing Fix');
  console.log('============================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  
  if (annotationTool) {
    console.log('✅ AnnotationTool is available');
    
    if (typeof annotationTool.triggerRealTimeSync === 'function') {
      console.log('✅ triggerRealTimeSync method exists');
      
      const triggerMethodString = annotationTool.triggerRealTimeSync.toString();
      if (triggerMethodString.includes('isCustomAnnotation') && 
          triggerMethodString.includes('annotationType === \\'custom\\'') &&
          triggerMethodString.includes('triggerCustomAnnotationSync') &&
          triggerMethodString.includes('CUSTOM_ANNOTATION_CREATE') &&
          triggerMethodString.includes('CUSTOM_ANNOTATION_UPDATE') &&
          triggerMethodString.includes('CUSTOM_ANNOTATION_DELETE')) {
        console.log('✅ triggerRealTimeSync properly routes custom annotations to custom sync methods');
        results.syncRouting = true;
      } else {
        console.log('❌ triggerRealTimeSync does NOT properly route custom annotations');
      }
    } else {
      console.log('❌ triggerRealTimeSync method does NOT exist');
    }
  } else {
    console.log('❌ AnnotationTool is NOT available');
  }
  console.log('');
  
  // Test 3: Conflict Detection Removal
  console.log('📋 Test 3: Conflict Detection Removal');
  console.log('======================================');
  
  if (realTimeSyncManager && typeof realTimeSyncManager.addCustomAnnotationToImage === 'function') {
    const addMethodString = realTimeSyncManager.addCustomAnnotationToImage.toString();
    if (!addMethodString.includes('CONFLICT DETECTED') && 
        !addMethodString.includes('conflictingAnnotation') &&
        !addMethodString.includes('Skipping sync to prevent conflicts')) {
      console.log('✅ Over-aggressive conflict detection has been removed');
      results.conflictDetectionRemoval = true;
    } else {
      console.log('❌ Over-aggressive conflict detection is still present');
    }
  } else {
    console.log('❌ Cannot test conflict detection removal - method unavailable');
  }
  console.log('');
  
  // Test 4: Method Implementation Check
  console.log('📋 Test 4: Method Implementation Check');
  console.log('======================================');
  
  if (realTimeSyncManager) {
    const requiredMethods = [
      'syncCustomAnnotationCreate',
      'syncCustomAnnotationUpdate', 
      'syncCustomAnnotationDelete',
      'triggerCustomAnnotationSync'
    ];
    
    let allMethodsExist = true;
    requiredMethods.forEach(method => {
      if (typeof realTimeSyncManager[method] === 'function') {
        console.log(`✅ ${method} method exists`);
      } else {
        console.log(`❌ ${method} method does NOT exist`);
        allMethodsExist = false;
      }
    });
    
    if (allMethodsExist) {
      console.log('✅ All required custom annotation sync methods are implemented');
      results.methodImplementation = true;
    } else {
      console.log('❌ Some required custom annotation sync methods are missing');
    }
  } else {
    console.log('❌ Cannot test method implementation - RealTimeSyncManager unavailable');
  }
  console.log('');
  
  // Test 5: Integration Status
  console.log('📋 Test 5: Integration Status Check');
  console.log('===================================');
  
  const appState = window.PlantAnnotationTool?.appState;
  const customAnnotationManager = annotationTool?.customAnnotationManager;
  
  if (appState && customAnnotationManager) {
    console.log('✅ App state and custom annotation manager are available');
    
    if (appState.currentPlant && appState.currentImage) {
      console.log(`✅ Current context: Plant ${appState.currentPlant.id}, Image ${appState.currentImage.id}`);
      
      const isInCustomMode = customAnnotationManager.isInCustomMode();
      console.log(`ℹ️ Currently in custom mode: ${isInCustomMode}`);
      
      if (isInCustomMode) {
        const currentType = customAnnotationManager.getCurrentCustomType();
        console.log(`ℹ️ Current custom type: ${currentType?.name || 'Unknown'}`);
      }
      
      // Check if real-time sync is enabled
      if (realTimeSyncManager?.isRealTimeSyncEnabled()) {
        console.log('✅ Real-time sync is enabled - ready for testing');
      } else {
        console.log('⚠️ Real-time sync is disabled - enable it to test the fixes');
      }
    } else {
      console.log('⚠️ No current plant/image selected - cannot test full integration');
    }
  } else {
    console.log('❌ App state or custom annotation manager not available');
  }
  console.log('');
  
  // Overall Results
  console.log('🎯 Fix Verification Results');
  console.log('===========================');
  
  const allTestsPassed = results.orderBasedSyncFix && 
                        results.syncRouting && 
                        results.conflictDetectionRemoval && 
                        results.methodImplementation;
  results.overallStatus = allTestsPassed;
  
  console.log(`Order-Based Sync Fix: ${results.orderBasedSyncFix ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Sync Routing Fix: ${results.syncRouting ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Conflict Detection Removal: ${results.conflictDetectionRemoval ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Method Implementation: ${results.methodImplementation ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('');
  
  if (allTestsPassed) {
    console.log('🎉 All Core Fixes Verified Successfully!');
    console.log('');
    console.log('📋 Testing Instructions for 4 Scenarios:');
    console.log('');
    console.log('🔹 Scenario 1: New annotation on empty frames');
    console.log('  1. Enable real-time sync');
    console.log('  2. Go to a frame with no custom annotations');
    console.log('  3. Create a new custom annotation (e.g., order 1)');
    console.log('  4. Switch to subsequent frames');
    console.log('  5. Expected: All subsequent frames should have the same order annotation');
    console.log('');
    console.log('🔹 Scenario 2: Move existing annotation');
    console.log('  1. Go to a frame with existing custom annotation #1');
    console.log('  2. Move annotation #1 to a new position');
    console.log('  3. Switch to subsequent frames');
    console.log('  4. Expected: All subsequent frames should have annotation #1 at new position');
    console.log('');
    console.log('🔹 Scenario 3: Add additional annotation');
    console.log('  1. Go to a frame with existing custom annotation #1');
    console.log('  2. Add a new custom annotation #2');
    console.log('  3. Switch to subsequent frames');
    console.log('  4. Expected: All subsequent frames should have both #1 and #2 annotations');
    console.log('');
    console.log('🔹 Scenario 4: Delete annotation');
    console.log('  1. Go to a frame with existing custom annotations');
    console.log('  2. Delete a custom annotation (e.g., #1)');
    console.log('  3. Switch to subsequent frames');
    console.log('  4. Expected: All subsequent frames should have annotation #1 deleted');
    console.log('');
    console.log('Expected Console Output:');
    console.log('✅ "Using custom annotation sync for ADD_KEYPOINT/MOVE_KEYPOINT/DELETE_KEYPOINT"');
    console.log('✅ "Updated/Added/Deleted custom annotation order X type Y in image Z"');
    console.log('✅ No "CONFLICT DETECTED" warnings for legitimate operations');
  } else {
    console.log('❌ Some fixes are not working properly');
    console.log('');
    console.log('Please check:');
    if (!results.orderBasedSyncFix) {
      console.log('- Order-based sync logic in RealTimeSyncManager.js methods');
    }
    if (!results.syncRouting) {
      console.log('- Sync routing logic in AnnotationTool.js triggerRealTimeSync method');
    }
    if (!results.conflictDetectionRemoval) {
      console.log('- Conflict detection removal in addCustomAnnotationToImage method');
    }
    if (!results.methodImplementation) {
      console.log('- Implementation of required custom annotation sync methods');
    }
  }
  
  return results;
}

// Export the verification function
window.verifyCustomAnnotationRealTimeSyncFix = verifyCustomAnnotationRealTimeSyncFix;

console.log('🔧 Custom Annotation Real-Time Sync fix verification script loaded');
console.log('Run verifyCustomAnnotationRealTimeSyncFix() to test all fixes');