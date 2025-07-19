/**
 * 🔧 Debug Script for Cross-Sectional Mode Issues
 * 
 * This script helps diagnose why images aren't switching and button text issues.
 * Run this in browser console to debug the problems.
 */

console.log('🔧 Debugging Cross-Sectional Mode Issues...\n');

// Test 1: Check if fixes are applied
console.log('=== Test 1: UI Text Fixes ===');
const modeSelector = document.getElementById('auto-direction-mode-selector');
if (modeSelector) {
  const options = Array.from(modeSelector.querySelectorAll('option'));
  options.forEach((option, index) => {
    const hasEnglish = !option.textContent.includes('横向') && !option.textContent.includes('纵向');
    console.log(`${hasEnglish ? '✅' : '❌'} Option ${index + 1}: ${option.textContent}`);
  });
} else {
  console.log('❌ Mode selector not found');
}

// Test 2: Check AnnotationTool state
console.log('\n=== Test 2: AnnotationTool State ===');
const annotationTool = window.PlantAnnotationTool?.annotationTool;
if (annotationTool) {
  console.log(`✅ AnnotationTool available`);
  console.log(`📋 Current mode: ${annotationTool.autoDirectionMode}`);
  console.log(`📋 Auto mode active: ${annotationTool.state.isAutoDirectionMode}`);
  console.log(`📋 Cross-sectional state: ${annotationTool.crossSectionalState ? 'Available' : 'Not initialized'}`);
  
  if (annotationTool.crossSectionalState) {
    const state = annotationTool.crossSectionalState;
    console.log(`📋 Cross-sectional progress: ${state.processedCount}/${state.totalCount}`);
    console.log(`📋 Current order: ${state.currentOrder}`);
    console.log(`📋 Current image index: ${state.currentImageIndex}`);
  }
} else {
  console.log('❌ AnnotationTool not available');
}

// Test 3: Check global functions
console.log('\n=== Test 3: Global Functions ===');
console.log(`${typeof window.handleImageSelect === 'function' ? '✅' : '❌'} window.handleImageSelect available`);
console.log(`${typeof window.navigateToNextImage === 'function' ? '✅' : '❌'} window.navigateToNextImage available`);

// Test 4: Check current image and annotations
console.log('\n=== Test 4: Current State ===');
const appState = window.PlantAnnotationTool?.appState;
if (appState) {
  console.log(`📋 Current plant: ${appState.currentPlant?.name || 'None'}`);
  console.log(`📋 Current image: ${appState.currentImage?.name || 'None'}`);
  console.log(`📋 Current view angle: ${appState.currentPlant?.selectedViewAngle || 'None'}`);
} else {
  console.log('❌ App state not available');
}

if (annotationTool && annotationTool.keypoints) {
  console.log(`📋 Current annotations: ${annotationTool.keypoints.length}`);
  const directionless = annotationTool.keypoints.filter(kp => !kp.direction || kp.direction === null);
  console.log(`📋 Directionless annotations: ${directionless.length}`);
}

// Test 5: Simulate cross-sectional mode start (if possible)
console.log('\n=== Test 5: Cross-Sectional Mode Test ===');
if (annotationTool && appState?.currentPlant) {
  console.log('🧪 Testing cross-sectional mode initialization...');
  
  // Check if there are multiple images
  const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
  if (plantDataManager) {
    plantDataManager.getPlantImages(
      appState.currentPlant.id,
      appState.currentPlant.selectedViewAngle
    ).then(images => {
      console.log(`📋 Total images in current view: ${images ? images.length : 0}`);
      
      if (images && images.length > 1) {
        console.log('✅ Multiple images available for cross-sectional processing');
        images.forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.name} (ID: ${img.id})`);
        });
      } else {
        console.log('⚠️ Only one image available - cross-sectional mode needs multiple images');
      }
    }).catch(error => {
      console.log('❌ Error getting images:', error);
    });
  }
} else {
  console.log('⚠️ Cannot test - plant not loaded or AnnotationTool not available');
}

// Test 6: Check for async errors
console.log('\n=== Test 6: Error Monitoring ===');
console.log('Monitoring for async errors for 5 seconds...');

let errorCount = 0;
const originalError = window.onerror;
const originalUnhandledRejection = window.onunhandledrejection;

window.onerror = function(message, source, lineno, colno, error) {
  if (message.includes('message channel closed')) {
    errorCount++;
    console.log(`🔍 Caught async error #${errorCount}: ${message}`);
  }
  if (originalError) originalError.apply(this, arguments);
};

window.onunhandledrejection = function(event) {
  if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
    errorCount++;
    console.log(`🔍 Caught unhandled rejection #${errorCount}: ${event.reason.message}`);
  }
  if (originalUnhandledRejection) originalUnhandledRejection.apply(this, arguments);
};

setTimeout(() => {
  window.onerror = originalError;
  window.onunhandledrejection = originalUnhandledRejection;
  
  if (errorCount === 0) {
    console.log('✅ No async errors detected in 5 seconds');
  } else {
    console.log(`⚠️ Detected ${errorCount} async errors - these may be causing image switching issues`);
  }
  
  console.log('\n📋 Debug Summary Complete');
  console.log('=====================================');
  console.log('To test cross-sectional mode:');
  console.log('1. Load a plant with multiple images');
  console.log('2. Add annotations to several images');
  console.log('3. Select "Vertical (Order by Order)" mode');
  console.log('4. Click "Auto Direction" button');
  console.log('5. Set direction for first annotation');
  console.log('6. Watch console for detailed switching logs');
}, 5000);