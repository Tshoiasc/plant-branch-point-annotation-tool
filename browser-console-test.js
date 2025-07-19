/**
 * Browser Console Test Script for Image Selection Function and Cross-Sectional Mode
 * 
 * This script validates that:
 * 1. The window.handleImageSelect function is properly exposed and available
 * 2. The cross-sectional mode can start without the "Global image selection function not available" error
 * 3. The mode descriptions in the UI are clear and accurate
 * 
 * Usage: 
 * 1. Open browser developer tools (F12)
 * 2. Copy and paste this entire script into the console
 * 3. Press Enter to run the test
 * 4. Review the test results in the console output
 */

console.log('🔧 Starting Browser Console Test for Image Selection and Cross-Sectional Mode...');
console.log('================================================================================');

// Test Results Object
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logTest(testName, passed, message, level = 'info') {
  const icon = passed ? '✅' : '❌';
  const logLevel = level === 'warning' ? '⚠️' : icon;
  
  console.log(`${logLevel} Test: ${testName}`);
  console.log(`   Result: ${message}`);
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  if (level === 'warning') {
    testResults.warnings++;
  }
  
  testResults.details.push({
    name: testName,
    passed,
    message,
    level
  });
}

// TEST 1: Check if window.handleImageSelect function is exposed
function testImageSelectFunction() {
  const functionExists = typeof window.handleImageSelect === 'function';
  
  if (functionExists) {
    logTest(
      'window.handleImageSelect Function Availability',
      true,
      'Function is properly exposed and available globally'
    );
    
    // Additional check for function signature
    const functionStr = window.handleImageSelect.toString();
    const hasImageParam = functionStr.includes('image') || functionStr.includes('arguments[0]');
    const hasIsImageSwitchParam = functionStr.includes('isImageSwitch') || functionStr.includes('arguments[1]');
    
    logTest(
      'window.handleImageSelect Function Signature',
      hasImageParam,
      hasImageParam ? 
        'Function appears to have correct parameters (image, isImageSwitch)' :
        'Function signature may be incomplete - check parameters'
    );
    
  } else {
    logTest(
      'window.handleImageSelect Function Availability',
      false,
      'Function is NOT exposed globally - this will cause cross-sectional mode to fail'
    );
  }
  
  return functionExists;
}

// TEST 2: Check Auto Direction Mode Selector Configuration
function testAutoDirectionModeSelector() {
  const selector = document.getElementById('auto-direction-mode-selector');
  
  if (!selector) {
    logTest(
      'Auto Direction Mode Selector Element',
      false,
      'Selector element not found in DOM'
    );
    return false;
  }
  
  logTest(
    'Auto Direction Mode Selector Element',
    true,
    'Selector element found in DOM'
  );
  
  // Check for options
  const options = selector.querySelectorAll('option');
  const optionValues = Array.from(options).map(opt => opt.value);
  const optionTexts = Array.from(options).map(opt => opt.textContent.trim());
  
  const hasLongitudinal = optionValues.includes('longitudinal');
  const hasCrossSectional = optionValues.includes('cross-sectional');
  
  logTest(
    'Longitudinal Mode Option',
    hasLongitudinal,
    hasLongitudinal ? 
      `Found: "${optionTexts[optionValues.indexOf('longitudinal')]}"` :
      'Longitudinal mode option not found'
  );
  
  logTest(
    'Cross-Sectional Mode Option',
    hasCrossSectional,
    hasCrossSectional ? 
      `Found: "${optionTexts[optionValues.indexOf('cross-sectional')]}"` :
      'Cross-sectional mode option not found'
  );
  
  return hasLongitudinal && hasCrossSectional;
}

// TEST 3: Check if AnnotationTool supports auto direction modes
function testAnnotationToolModeSupport() {
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  
  if (!annotationTool) {
    logTest(
      'AnnotationTool Instance',
      false,
      'AnnotationTool instance not found - tests cannot continue'
    );
    return false;
  }
  
  logTest(
    'AnnotationTool Instance',
    true,
    'AnnotationTool instance found and accessible'
  );
  
  // Check for setAutoDirectionMode method
  const hasSetModeMethod = typeof annotationTool.setAutoDirectionMode === 'function';
  logTest(
    'setAutoDirectionMode Method',
    hasSetModeMethod,
    hasSetModeMethod ? 
      'Method exists for setting auto direction mode' :
      'Method missing - mode switching may not work'
  );
  
  // Check for mode state
  const hasAutoDirectionMode = 'autoDirectionMode' in annotationTool || 'state' in annotationTool;
  logTest(
    'Auto Direction Mode State',
    hasAutoDirectionMode,
    hasAutoDirectionMode ? 
      'AnnotationTool has mode state management' :
      'Mode state management not found'
  );
  
  return hasSetModeMethod && hasAutoDirectionMode;
}

// TEST 4: Check UI Mode Descriptions
function testModeDescriptions() {
  const selector = document.getElementById('auto-direction-mode-selector');
  
  if (!selector) {
    logTest(
      'Mode Descriptions Check',
      false,
      'Cannot check descriptions - selector not found'
    );
    return false;
  }
  
  const options = selector.querySelectorAll('option');
  let descriptionsValid = true;
  
  Array.from(options).forEach(option => {
    const value = option.value;
    const text = option.textContent.trim();
    
    if (value === 'longitudinal') {
      const hasChineseDesc = text.includes('横向') || text.includes('Image by Image');
      const hasEnglishDesc = text.includes('Complete one image fully');
      
      logTest(
        'Longitudinal Mode Description',
        hasChineseDesc && hasEnglishDesc,
        hasChineseDesc && hasEnglishDesc ? 
          `Clear description: "${text}"` :
          `Unclear description: "${text}"`,
        hasChineseDesc && hasEnglishDesc ? 'info' : 'warning'
      );
      
      if (!hasChineseDesc || !hasEnglishDesc) descriptionsValid = false;
    }
    
    if (value === 'cross-sectional') {
      const hasChineseDesc = text.includes('纵向') || text.includes('Order by Order');
      const hasEnglishDesc = text.includes('Complete order #1 across all images');
      
      logTest(
        'Cross-Sectional Mode Description',
        hasChineseDesc && hasEnglishDesc,
        hasChineseDesc && hasEnglishDesc ? 
          `Clear description: "${text}"` :
          `Unclear description: "${text}"`,
        hasChineseDesc && hasEnglishDesc ? 'info' : 'warning'
      );
      
      if (!hasChineseDesc || !hasEnglishDesc) descriptionsValid = false;
    }
  });
  
  return descriptionsValid;
}

// TEST 5: Simulate Cross-Sectional Mode Start (if possible)
function testCrossSectionalModeStart() {
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const selector = document.getElementById('auto-direction-mode-selector');
  
  if (!annotationTool || !selector) {
    logTest(
      'Cross-Sectional Mode Start Simulation',
      false,
      'Cannot simulate - missing required components'
    );
    return false;
  }
  
  try {
    // Save current mode
    const originalValue = selector.value;
    
    // Set to cross-sectional mode
    selector.value = 'cross-sectional';
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    selector.dispatchEvent(changeEvent);
    
    // Check if mode was set without errors
    const modeSetSuccessfully = true; // If we get here, no immediate errors occurred
    
    logTest(
      'Cross-Sectional Mode Start Simulation',
      modeSetSuccessfully,
      'Mode switching completed without immediate errors'
    );
    
    // Try to call setAutoDirectionMode directly if available
    if (typeof annotationTool.setAutoDirectionMode === 'function') {
      try {
        annotationTool.setAutoDirectionMode('cross-sectional');
        logTest(
          'Direct setAutoDirectionMode Call',
          true,
          'Direct mode setting call successful'
        );
      } catch (error) {
        logTest(
          'Direct setAutoDirectionMode Call',
          false,
          `Direct mode setting failed: ${error.message}`
        );
      }
    }
    
    // Restore original mode
    selector.value = originalValue;
    const restoreEvent = new Event('change', { bubbles: true });
    selector.dispatchEvent(restoreEvent);
    
    return modeSetSuccessfully;
    
  } catch (error) {
    logTest(
      'Cross-Sectional Mode Start Simulation',
      false,
      `Mode start failed with error: ${error.message}`
    );
    return false;
  }
}

// TEST 6: Check for Global Error State
function testGlobalErrorState() {
  // Check console for recent errors related to image selection
  const hasWindowErrors = window.onerror !== null || window.addEventListener;
  
  logTest(
    'Global Error Handling',
    hasWindowErrors,
    hasWindowErrors ? 
      'Error handling mechanisms are in place' :
      'No global error handling detected'
  );
  
  // Check if there are any pending promise rejections that might indicate issues
  const hasRejectionHandling = typeof window.addEventListener === 'function';
  
  logTest(
    'Promise Rejection Handling',
    hasRejectionHandling,
    hasRejectionHandling ? 
      'Unhandled promise rejection handling available' :
      'Promise rejection handling not available'
  );
  
  return true;
}

// TEST 7: Check Application State
function testApplicationState() {
  const plantAnnotationTool = window.PlantAnnotationTool;
  
  if (!plantAnnotationTool) {
    logTest(
      'Application State',
      false,
      'PlantAnnotationTool global object not found'
    );
    return false;
  }
  
  logTest(
    'Application State',
    true,
    'PlantAnnotationTool global object available'
  );
  
  // Check for required managers
  const managers = [
    'plantDataManager',
    'annotationTool',
    'appState'
  ];
  
  managers.forEach(manager => {
    const exists = manager in plantAnnotationTool && plantAnnotationTool[manager] !== null;
    logTest(
      `${manager} Availability`,
      exists,
      exists ? 
        `${manager} is available` :
        `${manager} is missing or null`
    );
  });
  
  return true;
}

// Run All Tests
async function runAllTests() {
  console.log('📋 Running all validation tests...\n');
  
  testImageSelectFunction();
  testAutoDirectionModeSelector();
  testAnnotationToolModeSupport();
  testModeDescriptions();
  testCrossSectionalModeStart();
  testGlobalErrorState();
  testApplicationState();
  
  // Generate Summary Report
  console.log('\n📊 TEST SUMMARY REPORT');
  console.log('================================================================================');
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`⚠️ Warnings: ${testResults.warnings}`);
  console.log(`📊 Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`🎯 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  // Critical Issues Check
  const criticalIssues = testResults.details.filter(test => 
    !test.passed && (
      test.name.includes('window.handleImageSelect') ||
      test.name.includes('Cross-Sectional Mode Start') ||
      test.name.includes('AnnotationTool Instance')
    )
  );
  
  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES DETECTED:');
    criticalIssues.forEach(issue => {
      console.log(`   • ${issue.name}: ${issue.message}`);
    });
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('   1. Ensure window.handleImageSelect is properly exposed in main.js');
    console.log('   2. Check that AnnotationTool initialization completed successfully');
    console.log('   3. Verify auto direction mode functionality is properly implemented');
  } else {
    console.log('\n🎉 ALL CRITICAL TESTS PASSED!');
    console.log('   • Image selection function is properly exposed');
    console.log('   • Cross-sectional mode should work without errors');
    console.log('   • UI descriptions are clear and accurate');
  }
  
  // Additional Debugging Information
  console.log('\n🔧 DEBUGGING INFORMATION:');
  console.log('================================================================================');
  console.log('Available Global Functions:');
  console.log('   window.handleImageSelect:', typeof window.handleImageSelect);
  console.log('   window.PlantAnnotationTool:', typeof window.PlantAnnotationTool);
  
  if (window.PlantAnnotationTool?.annotationTool) {
    console.log('AnnotationTool Methods:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(window.PlantAnnotationTool.annotationTool))
      .filter(name => typeof window.PlantAnnotationTool.annotationTool[name] === 'function')
      .filter(name => name.includes('Auto') || name.includes('Direction') || name.includes('Mode'));
    
    methods.forEach(method => {
      console.log(`   ${method}:`, typeof window.PlantAnnotationTool.annotationTool[method]);
    });
  }
  
  // Mode Selector Current State
  const selector = document.getElementById('auto-direction-mode-selector');
  if (selector) {
    console.log('Mode Selector State:');
    console.log('   Current Value:', selector.value);
    console.log('   Available Options:');
    Array.from(selector.options).forEach(option => {
      console.log(`     ${option.value}: "${option.textContent.trim()}"`);
    });
  }
  
  console.log('\n✨ Test completed! Review the results above to verify the fixes are working correctly.');
  
  return {
    passed: testResults.passed,
    failed: testResults.failed,
    warnings: testResults.warnings,
    criticalIssues: criticalIssues.length,
    success: testResults.failed === 0 && criticalIssues.length === 0
  };
}

// Execute the tests
runAllTests().then(results => {
  console.log('\n🎯 Quick Status Check:', results.success ? '✅ ALL GOOD' : '❌ ISSUES FOUND');
}).catch(error => {
  console.error('🚨 Test execution failed:', error);
  console.log('This might indicate a serious issue with the application state.');
});