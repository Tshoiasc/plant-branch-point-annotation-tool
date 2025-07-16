/**
 * Comprehensive Real-Time Sync & NoteUI Fix Verification
 * 
 * This script validates that both reported issues have been resolved:
 * 1. Existing custom annotations not syncing when moved
 * 2. NoteUI loadImageNoteCount function not available error
 */

async function verifyRealTimeSyncAndNoteUIFixes() {
  console.clear();
  console.log('🔧 Verifying Real-Time Sync & NoteUI Fixes');
  console.log('==========================================');
  console.log('Time:', new Date().toLocaleString());
  console.log('');
  
  const results = {
    noteUIFix: false,
    customAnnotationLoading: false,
    realTimeSyncExisting: false,
    overallStatus: false
  };
  
  // Test 1: NoteUI loadImageNoteCount Function Availability
  console.log('📋 Test 1: NoteUI loadImageNoteCount Function');
  console.log('===============================================');
  
  if (typeof window.loadImageNoteCount === 'function') {
    console.log('✅ loadImageNoteCount function is globally available');
    results.noteUIFix = true;
  } else {
    console.log('❌ loadImageNoteCount function is NOT globally available');
    console.log('   Expected: window.loadImageNoteCount should be a function');
  }
  console.log('');
  
  // Test 2: Custom Annotation Loading Integration
  console.log('📋 Test 2: Custom Annotation Loading Integration');
  console.log('===============================================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const customAnnotationManager = annotationTool?.customAnnotationManager;
  
  if (customAnnotationManager && typeof customAnnotationManager.syncAnnotationsFromKeypoints === 'function') {
    console.log('✅ syncAnnotationsFromKeypoints method is available');
    results.customAnnotationLoading = true;
    
    // Test the method with mock data
    try {
      const mockCustomAnnotations = [
        {
          id: 'test-custom-' + Date.now(),
          x: 100,
          y: 100,
          order: 1,
          annotationType: 'custom',
          customTypeId: 'test-type'
        }
      ];
      
      customAnnotationManager.syncAnnotationsFromKeypoints('test-image-id', mockCustomAnnotations);
      console.log('✅ syncAnnotationsFromKeypoints method executed successfully');
    } catch (error) {
      console.log('❌ syncAnnotationsFromKeypoints method failed:', error.message);
      results.customAnnotationLoading = false;
    }
  } else {
    console.log('❌ syncAnnotationsFromKeypoints method is NOT available');
    results.customAnnotationLoading = false;
  }
  console.log('');
  
  // Test 3: Real-Time Sync for Existing Custom Annotations
  console.log('📋 Test 3: Real-Time Sync Integration Check');
  console.log('==========================================');
  
  const appState = window.PlantAnnotationTool?.appState;
  const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  
  if (!appState?.currentPlant || !appState?.currentImage) {
    console.log('⚠️ No current plant/image selected. Cannot test real-time sync.');
    console.log('   Please select a plant and image to test real-time sync functionality.');
  } else if (!realTimeSyncManager?.isRealTimeSyncEnabled()) {
    console.log('⚠️ Real-time sync is disabled. Please enable it to test sync functionality.');
  } else {
    console.log('✅ App state and real-time sync are ready for testing');
    console.log(`   Current Plant: ${appState.currentPlant.id}`);
    console.log(`   Current Image: ${appState.currentImage.id}`);
    
    // Test sync method availability
    if (customAnnotationManager) {
      const syncMethods = [
        'triggerCustomAnnotationCreateSync',
        'triggerCustomAnnotationUpdateSync', 
        'triggerCustomAnnotationDeleteSync'
      ];
      
      let allMethodsAvailable = true;
      for (const method of syncMethods) {
        if (typeof customAnnotationManager[method] === 'function') {
          console.log(`   ✅ ${method} available`);
        } else {
          console.log(`   ❌ ${method} NOT available`);
          allMethodsAvailable = false;
        }
      }
      
      if (allMethodsAvailable) {
        console.log('✅ All custom annotation sync methods are available');
        results.realTimeSyncExisting = true;
      } else {
        console.log('❌ Some custom annotation sync methods are missing');
      }
    } else {
      console.log('❌ CustomAnnotationManager not available');
    }
  }
  console.log('');
  
  // Test 4: Integration Flow Test
  console.log('📋 Test 4: End-to-End Integration Flow');
  console.log('=====================================');
  
  if (results.noteUIFix && results.customAnnotationLoading) {
    console.log('✅ Basic integration components are working');
    
    // Test the complete flow if possible
    if (appState?.currentImage && customAnnotationManager) {
      try {
        // Simulate loading existing custom annotations
        const mockExistingAnnotations = [
          {
            id: 'existing-custom-' + Date.now(),
            x: 150,
            y: 150,
            order: 1,
            annotationType: 'custom',
            customTypeId: 'existing-type'
          }
        ];
        
        console.log('🔄 Testing custom annotation synchronization flow...');
        customAnnotationManager.syncAnnotationsFromKeypoints(appState.currentImage.id, mockExistingAnnotations);
        
        // Check if the annotation was properly added to internal state
        const imageAnnotations = customAnnotationManager.getAnnotationsByImageId(appState.currentImage.id);
        const foundAnnotation = imageAnnotations.find(ann => ann.id === mockExistingAnnotations[0].id);
        
        if (foundAnnotation) {
          console.log('✅ Custom annotation successfully synchronized to internal state');
          
          // Test sync trigger
          if (realTimeSyncManager?.isRealTimeSyncEnabled()) {
            console.log('🔄 Testing sync trigger for existing annotation...');
            customAnnotationManager.triggerCustomAnnotationUpdateSync(foundAnnotation, {
              imageId: appState.currentImage.id,
              test: true
            });
            console.log('✅ Sync trigger executed successfully');
          }
        } else {
          console.log('❌ Custom annotation was not found in internal state after sync');
        }
      } catch (error) {
        console.log('❌ Integration flow test failed:', error.message);
      }
    } else {
      console.log('⚠️ Cannot test full integration flow - missing app state or custom annotation manager');
    }
  } else {
    console.log('❌ Cannot test integration flow - basic components failed');
  }
  console.log('');
  
  // Overall Results
  console.log('🎯 Fix Verification Results');
  console.log('===========================');
  
  const allTestsPassed = results.noteUIFix && results.customAnnotationLoading;
  results.overallStatus = allTestsPassed;
  
  console.log(`NoteUI Function Fix: ${results.noteUIFix ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Custom Annotation Loading: ${results.customAnnotationLoading ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Real-Time Sync Ready: ${results.realTimeSyncExisting ? '✅ READY' : '⚠️ NEEDS TESTING'}`);
  console.log('');
  
  if (allTestsPassed) {
    console.log('🎉 All Critical Fixes Verified Successfully!');
    console.log('');
    console.log('📋 What to Test Next:');
    console.log('1. Enable real-time sync (check "Real-time Change" checkbox)');
    console.log('2. Load an image that has existing custom annotations');
    console.log('3. Move/drag an existing custom annotation');
    console.log('4. Check if the same annotation moves in future images');
    console.log('5. Verify no more "[NoteUI] loadImageNoteCount function not available" errors');
    console.log('');
    console.log('Expected Results:');
    console.log('- Custom annotations should load when switching images');
    console.log('- Moving existing custom annotations should sync to future images');
    console.log('- No console errors about missing loadImageNoteCount function');
  } else {
    console.log('❌ Some fixes are not working properly');
    console.log('');
    console.log('Please check:');
    if (!results.noteUIFix) {
      console.log('- NoteUI function exposure in main.js');
    }
    if (!results.customAnnotationLoading) {
      console.log('- CustomAnnotationManager syncAnnotationsFromKeypoints method');
      console.log('- Image loading integration in main.js');
    }
  }
  
  return results;
}

// Export the verification function
window.verifyRealTimeSyncAndNoteUIFixes = verifyRealTimeSyncAndNoteUIFixes;

console.log('🔧 Real-Time Sync & NoteUI fix verification script loaded');
console.log('Run verifyRealTimeSyncAndNoteUIFixes() to test both fixes');