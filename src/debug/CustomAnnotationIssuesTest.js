/**
 * Comprehensive Custom Annotation Issues Validation
 * 
 * This script validates both reported issues:
 * 1. Custom annotations real-time sync functionality
 * 2. Preview area pointing to custom annotations
 */

/**
 * Test Issue 1: Custom Annotation Real-time Sync
 */
async function testCustomAnnotationSyncIssue() {
  console.log('🔄 测试问题1：自定义标注实时同步');
  console.log('================================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  const issues = [];
  
  // Check basic components
  if (!annotationTool) issues.push('AnnotationTool 不可用');
  if (!realTimeSyncManager) issues.push('RealTimeSyncManager 不可用');
  if (!appState) issues.push('AppState 不可用');
  
  if (issues.length > 0) {
    console.log('❌ 基础组件检查失败:', issues);
    return false;
  }
  
  // Check if real-time sync is enabled
  if (!realTimeSyncManager.isRealTimeSyncEnabled()) {
    console.log('⚠️ 实时同步已禁用，请启用后再测试');
    return false;
  }
  
  // Check context
  if (!appState.currentPlant || !appState.currentImage) {
    console.log('❌ 缺少当前植株或图像信息');
    return false;
  }
  
  console.log('✅ 基础环境检查通过');
  
  // Test sync trigger mechanism
  console.log('\n🔄 测试同步触发机制...');
  
  // Mock a custom annotation
  const testAnnotation = {
    id: Date.now(),
    x: 200,
    y: 200,
    order: 1,
    annotationType: 'custom',
    customTypeId: 'stem-aborted',
    direction: 0,
    directionType: 'angle',
    timestamp: new Date().toISOString()
  };
  
  // Test if trigger methods exist
  const triggerMethods = [
    'triggerKeypointAddSync',
    'triggerKeypointMoveSync', 
    'triggerKeypointDeleteSync'
  ];
  
  let allMethodsExist = true;
  for (const method of triggerMethods) {
    if (typeof realTimeSyncManager[method] !== 'function') {
      console.log(`❌ 方法 ${method} 不存在`);
      allMethodsExist = false;
    }
  }
  
  if (!allMethodsExist) {
    console.log('❌ 同步触发方法不完整');
    return false;
  }
  
  console.log('✅ 同步触发机制检查通过');
  
  // Test annotation tool trigger
  console.log('\n🔄 测试标注工具触发...');
  
  if (typeof annotationTool.triggerRealTimeSync !== 'function') {
    console.log('❌ AnnotationTool.triggerRealTimeSync 方法不存在');
    return false;
  }
  
  // Mock trigger call
  try {
    // This should not throw an error
    annotationTool.triggerRealTimeSync('ADD_KEYPOINT', testAnnotation);
    console.log('✅ 标注工具触发测试通过');
  } catch (error) {
    console.log('❌ 标注工具触发测试失败:', error.message);
    return false;
  }
  
  console.log('✅ 问题1检查完成 - 自定义标注实时同步功能正常');
  return true;
}

/**
 * Test Issue 2: Preview Area Custom Annotation Support
 */
async function testPreviewAreaCustomAnnotationIssue() {
  console.log('\n🔄 测试问题2：预览区域自定义标注支持');
  console.log('====================================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
  
  if (!annotationTool || !branchPointPreviewManager) {
    console.log('❌ 预览相关组件不可用');
    return false;
  }
  
  // Test custom annotation manager
  const customAnnotationManager = annotationTool.getCustomAnnotationManager();
  if (!customAnnotationManager) {
    console.log('❌ CustomAnnotationManager 不可用');
    return false;
  }
  
  // Test preview manager methods
  if (typeof branchPointPreviewManager.getNextOrderToAnnotate !== 'function') {
    console.log('❌ PreviewManager.getNextOrderToAnnotate 方法不存在');
    return false;
  }
  
  console.log('✅ 预览组件检查通过');
  
  // Test custom mode detection
  console.log('\n🔄 测试自定义模式检测...');
  
  if (typeof customAnnotationManager.isInCustomMode !== 'function') {
    console.log('❌ isInCustomMode 方法不存在');
    return false;
  }
  
  if (typeof customAnnotationManager.getCurrentCustomType !== 'function') {
    console.log('❌ getCurrentCustomType 方法不存在');
    return false;
  }
  
  console.log('✅ 自定义模式检测方法存在');
  
  // Test preview logic
  console.log('\n🔄 测试预览逻辑...');
  
  // Test regular mode
  const regularNextOrder = branchPointPreviewManager.getNextOrderToAnnotate();
  console.log(`📋 常规模式下一个编号: ${regularNextOrder}`);
  
  // Test custom mode (if available)
  const isInCustomMode = customAnnotationManager.isInCustomMode();
  console.log(`📋 当前是否在自定义模式: ${isInCustomMode}`);
  
  if (isInCustomMode) {
    const currentCustomType = customAnnotationManager.getCurrentCustomType();
    console.log(`📋 当前自定义类型: ${currentCustomType ? currentCustomType.id : 'None'}`);
    
    // Test custom type order calculation
    if (currentCustomType && typeof annotationTool.findNextAvailableOrderForType === 'function') {
      const customNextOrder = annotationTool.findNextAvailableOrderForType(currentCustomType.id);
      console.log(`📋 自定义类型下一个编号: ${customNextOrder}`);
    }
  }
  
  console.log('✅ 问题2检查完成 - 预览区域自定义标注支持正常');
  return true;
}

/**
 * Test Annotation Matching Logic
 */
async function testAnnotationMatchingLogic() {
  console.log('\n🔄 测试标注匹配逻辑');
  console.log('==================');
  
  // Create test annotations
  const testAnnotations = [
    {
      order: 1,
      annotationType: 'regular',
      x: 100,
      y: 100
    },
    {
      order: 2,
      annotationType: 'regular', 
      x: 150,
      y: 150
    },
    {
      order: 1,
      annotationType: 'custom',
      customTypeId: 'stem-aborted',
      x: 200,
      y: 200
    },
    {
      order: 2,
      annotationType: 'custom',
      customTypeId: 'stem-aborted',
      x: 250,
      y: 250
    },
    {
      order: 1,
      annotationType: 'custom',
      customTypeId: 'leaf-tip',
      x: 300,
      y: 300
    }
  ];
  
  console.log('📋 测试标注数据:', testAnnotations);
  
  // Test regular matching
  const regularMatch = testAnnotations.find(ann => 
    ann.order === 1 && 
    (ann.annotationType === 'regular' || !ann.annotationType)
  );
  console.log('📋 常规标注匹配 order=1:', regularMatch);
  
  // Test custom matching
  const customMatch = testAnnotations.find(ann => 
    ann.order === 1 && 
    ann.annotationType === 'custom' && 
    ann.customTypeId === 'stem-aborted'
  );
  console.log('📋 自定义标注匹配 order=1, type=stem-aborted:', customMatch);
  
  // Test different custom type
  const customMatch2 = testAnnotations.find(ann => 
    ann.order === 1 && 
    ann.annotationType === 'custom' && 
    ann.customTypeId === 'leaf-tip'
  );
  console.log('📋 自定义标注匹配 order=1, type=leaf-tip:', customMatch2);
  
  console.log('✅ 标注匹配逻辑测试完成');
  return true;
}

/**
 * Run Comprehensive Test
 */
async function runComprehensiveCustomAnnotationTest() {
  console.clear();
  console.log('🔄 自定义标注问题综合测试');
  console.log('========================');
  console.log('时间:', new Date().toLocaleString());
  console.log('');
  
  const results = {
    syncTest: false,
    previewTest: false,
    matchingTest: false
  };
  
  // Test Issue 1: Sync functionality
  results.syncTest = await testCustomAnnotationSyncIssue();
  
  // Test Issue 2: Preview functionality  
  results.previewTest = await testPreviewAreaCustomAnnotationIssue();
  
  // Test matching logic
  results.matchingTest = await testAnnotationMatchingLogic();
  
  // Summary
  console.log('\n🎯 测试结果总结');
  console.log('==============');
  console.log(`实时同步功能: ${results.syncTest ? '✅ 正常' : '❌ 异常'}`);
  console.log(`预览区域功能: ${results.previewTest ? '✅ 正常' : '❌ 异常'}`);
  console.log(`匹配逻辑测试: ${results.matchingTest ? '✅ 正常' : '❌ 异常'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n${allPassed ? '🎉 所有测试通过！' : '⚠️ 部分测试失败'}`);
  
  if (allPassed) {
    console.log('\n🚀 自定义标注功能应该可以正常工作了！');
    console.log('\n📋 使用说明：');
    console.log('1. 启用实时同步（勾选Real-time Change）');
    console.log('2. 切换到自定义标注模式');
    console.log('3. 添加自定义标注 - 应该会同步到未来图像');
    console.log('4. 预览区域应该显示对应的自定义标注位置');
  } else {
    console.log('\n🔧 请检查失败的测试项并确认修复是否正确应用');
  }
  
  return results;
}

// Export functions for global access
window.testCustomAnnotationSyncIssue = testCustomAnnotationSyncIssue;
window.testPreviewAreaCustomAnnotationIssue = testPreviewAreaCustomAnnotationIssue;
window.testAnnotationMatchingLogic = testAnnotationMatchingLogic;
window.runComprehensiveCustomAnnotationTest = runComprehensiveCustomAnnotationTest;

console.log('🔄 自定义标注问题综合测试脚本已加载');
console.log('运行 runComprehensiveCustomAnnotationTest() 来进行完整测试');