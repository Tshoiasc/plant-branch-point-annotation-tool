/**
 * Real-Time Sync Validation Script
 * 
 * This script helps validate that the real-time sync feature is working correctly.
 * Run this in the browser console to test the functionality.
 */

/**
 * Validate Real-Time Sync Setup
 */
function validateRealTimeSyncSetup() {
  console.log('🔄 验证实时同步设置...');
  console.log('========================');
  
  const issues = [];
  let score = 0;
  const maxScore = 8;
  
  // Test 1: Check if RealTimeSyncManager is imported
  if (typeof window.RealTimeSyncManager !== 'undefined') {
    console.log('✅ RealTimeSyncManager 类已加载');
    score++;
  } else {
    console.log('❌ RealTimeSyncManager 类未找到');
    issues.push('RealTimeSyncManager class not loaded');
  }
  
  // Test 2: Check if manager instance is available
  const syncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  if (syncManager) {
    console.log('✅ RealTimeSyncManager 实例已初始化');
    score++;
  } else {
    console.log('❌ RealTimeSyncManager 实例未找到');
    issues.push('RealTimeSyncManager instance not initialized');
  }
  
  // Test 3: Check checkbox element
  const checkbox = document.getElementById('real-time-change-checkbox');
  if (checkbox) {
    console.log('✅ 实时同步复选框元素存在');
    score++;
  } else {
    console.log('❌ 实时同步复选框元素未找到');
    issues.push('Checkbox element not found');
  }
  
  // Test 4: Check if event handler is attached
  if (checkbox && checkbox.onclick !== null || checkbox.onchange !== null) {
    console.log('✅ 复选框事件处理器已绑定');
    score++;
  } else {
    console.log('❌ 复选框事件处理器未绑定');
    issues.push('Checkbox event handler not attached');
  }
  
  // Test 5: Check PlantDataManager
  const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
  if (plantDataManager) {
    console.log('✅ PlantDataManager 可用');
    score++;
  } else {
    console.log('❌ PlantDataManager 不可用');
    issues.push('PlantDataManager not available');
  }
  
  // Test 6: Check AnnotationStorageManager
  const annotationStorage = plantDataManager?.annotationStorage;
  if (annotationStorage) {
    console.log('✅ AnnotationStorageManager 可用');
    score++;
  } else {
    console.log('❌ AnnotationStorageManager 不可用');
    issues.push('AnnotationStorageManager not available');
  }
  
  // Test 7: Check if sync manager methods exist
  if (syncManager && typeof syncManager.setEnabled === 'function') {
    console.log('✅ 同步管理器方法可用');
    score++;
  } else {
    console.log('❌ 同步管理器方法不可用');
    issues.push('Sync manager methods not available');
  }
  
  // Test 8: Check AnnotationTool
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  if (annotationTool && typeof annotationTool.triggerRealTimeSync === 'function') {
    console.log('✅ AnnotationTool 同步触发器可用');
    score++;
  } else {
    console.log('❌ AnnotationTool 同步触发器不可用');
    issues.push('AnnotationTool sync trigger not available');
  }
  
  // Summary
  console.log('\\n🔄 验证结果');
  console.log('============');
  console.log(`总分: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);
  
  if (issues.length > 0) {
    console.log('\\n❌ 发现的问题:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  } else {
    console.log('\\n✅ 所有检查都通过了！');
  }
  
  return { score, maxScore, issues, success: issues.length === 0 };
}

/**
 * Test Real-Time Sync Functionality
 */
function testRealTimeSyncFunctionality() {
  console.log('\\n🧪 测试实时同步功能...');
  console.log('========================');
  
  const syncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  if (!syncManager) {
    console.log('❌ 无法测试：同步管理器不可用');
    return false;
  }
  
  // Test toggle functionality
  console.log('🔄 测试同步开关...');
  
  // Test enable
  syncManager.setEnabled(true);
  if (syncManager.isRealTimeSyncEnabled()) {
    console.log('✅ 同步开启功能正常');
  } else {
    console.log('❌ 同步开启功能异常');
    return false;
  }
  
  // Test disable
  syncManager.setEnabled(false);
  if (!syncManager.isRealTimeSyncEnabled()) {
    console.log('✅ 同步关闭功能正常');
  } else {
    console.log('❌ 同步关闭功能异常');
    return false;
  }
  
  // Test checkbox sync
  const checkbox = document.getElementById('real-time-change-checkbox');
  if (checkbox) {
    console.log('🔄 测试复选框同步...');
    
    // Enable via checkbox
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    
    if (syncManager.isRealTimeSyncEnabled()) {
      console.log('✅ 复选框开启同步正常');
    } else {
      console.log('❌ 复选框开启同步异常');
      return false;
    }
    
    // Disable via checkbox
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    
    if (!syncManager.isRealTimeSyncEnabled()) {
      console.log('✅ 复选框关闭同步正常');
    } else {
      console.log('❌ 复选框关闭同步异常');
      return false;
    }
  }
  
  console.log('\\n✅ 功能测试完成！');
  return true;
}

/**
 * Check Console for Sync Messages
 */
function enableSyncLogging() {
  console.log('\\n🔍 启用同步日志监控...');
  console.log('=======================');
  console.log('现在请尝试以下操作:');
  console.log('1. 勾选"Real-time Change"复选框');
  console.log('2. 添加一个新的标注点');
  console.log('3. 移动一个现有的标注点');
  console.log('4. 观察控制台日志中的同步消息');
  console.log('\\n查找以下日志消息:');
  console.log('- 🔄 实时变更同步: 开启/关闭');
  console.log('- 🔄 触发实时同步: ADD_KEYPOINT/MOVE_KEYPOINT');
  console.log('- 🔄 Found X future images for sync');
  console.log('- 🔄 Synced to X future images');
}

/**
 * Main validation function
 */
function runRealTimeSyncValidation() {
  console.clear();
  console.log('🔄 实时同步功能验证');
  console.log('====================');
  console.log('时间:', new Date().toLocaleString());
  console.log('');
  
  const setupResult = validateRealTimeSyncSetup();
  
  if (setupResult.success) {
    const functionalityResult = testRealTimeSyncFunctionality();
    
    if (functionalityResult) {
      enableSyncLogging();
      console.log('\\n🎉 实时同步功能验证完成！功能正常。');
    } else {
      console.log('\\n❌ 功能测试失败！');
    }
  } else {
    console.log('\\n❌ 设置验证失败！请检查初始化问题。');
  }
  
  return setupResult;
}

// Auto-run validation if this script is loaded
console.log('🔄 实时同步验证脚本已加载');
console.log('运行 runRealTimeSyncValidation() 来验证功能');

// Export for global access
window.runRealTimeSyncValidation = runRealTimeSyncValidation;
window.validateRealTimeSyncSetup = validateRealTimeSyncSetup;
window.testRealTimeSyncFunctionality = testRealTimeSyncFunctionality;
window.enableSyncLogging = enableSyncLogging;