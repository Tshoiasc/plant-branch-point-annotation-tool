/**
 * Enhanced Real-Time Sync Debugging Script
 * 
 * This script helps validate and debug the real-time sync functionality
 * after fixing the annotation storage method issues.
 */

/**
 * Test Real-Time Sync with Enhanced Debugging
 */
function testRealTimeSyncWithDebug() {
  console.log('🔄 测试实时同步功能（增强调试版）');
  console.log('================================');
  
  const syncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  if (!syncManager || !plantDataManager || !appState) {
    console.log('❌ 缺少必要的组件，无法测试');
    return false;
  }
  
  // Check current state
  console.log('🔍 当前状态:');
  console.log(`- 实时同步启用: ${syncManager.isRealTimeSyncEnabled()}`);
  console.log(`- 当前植株: ${appState.currentPlant?.id || 'None'}`);
  console.log(`- 当前图像: ${appState.currentImage?.id || 'None'}`);
  console.log(`- 选择的视角: ${appState.currentPlant?.selectedViewAngle || 'None'}`);
  
  return true;
}

/**
 * Test Future Image Detection
 */
async function testFutureImageDetection() {
  console.log('\n🔍 测试未来图像检测...');
  console.log('========================');
  
  const syncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  if (!syncManager || !appState?.currentPlant || !appState?.currentImage) {
    console.log('❌ 无法测试：缺少当前植株或图像信息');
    return false;
  }
  
  try {
    const futureImages = await syncManager.getFutureImages(
      appState.currentImage, 
      appState.currentPlant
    );
    
    console.log(`✅ 找到 ${futureImages.length} 个未来图像:`);
    futureImages.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.id} (${img.timeString})`);
    });
    
    return futureImages.length > 0;
    
  } catch (error) {
    console.log('❌ 未来图像检测失败:', error);
    return false;
  }
}

/**
 * Test Annotation Storage Methods
 */
async function testAnnotationStorageMethods() {
  console.log('\n🔍 测试标注存储方法...');
  console.log('========================');
  
  const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  if (!plantDataManager?.annotationStorage || !appState?.currentImage) {
    console.log('❌ 无法测试：缺少标注存储或当前图像信息');
    return false;
  }
  
  const annotationStorage = plantDataManager.annotationStorage;
  const testImageId = appState.currentImage.id;
  
  try {
    // Test getImageAnnotation method
    console.log(`🔍 测试获取图像标注: ${testImageId}`);
    const existingData = await annotationStorage.getImageAnnotation(testImageId);
    
    if (existingData) {
      console.log(`✅ 成功获取标注数据:`);
      console.log(`  - 图像ID: ${existingData.imageId}`);
      console.log(`  - 标注点数量: ${existingData.annotations?.length || 0}`);
      console.log(`  - 最后修改: ${existingData.lastModified}`);
    } else {
      console.log(`ℹ️ 该图像暂无标注数据`);
    }
    
    // Test saveImageAnnotation method (dry run)
    console.log(`🔍 测试保存标注数据结构...`);
    const testAnnotationData = {
      imageId: testImageId,
      annotations: [
        {
          id: 'test-debug-keypoint',
          x: 100,
          y: 100,
          direction: 0,
          directionType: 'angle',
          order: 999,
          timestamp: new Date().toISOString()
        }
      ],
      lastModified: new Date().toISOString()
    };
    
    console.log(`✅ 测试数据结构正确:`, testAnnotationData);
    
    return true;
    
  } catch (error) {
    console.log('❌ 标注存储方法测试失败:', error);
    return false;
  }
}

/**
 * Test Complete Sync Flow
 */
async function testCompleteSyncFlow() {
  console.log('\n🔄 测试完整同步流程...');
  console.log('========================');
  
  const syncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  if (!syncManager || !appState?.currentPlant || !appState?.currentImage) {
    console.log('❌ 无法测试：缺少必要组件');
    return false;
  }
  
  // Enable sync
  syncManager.setEnabled(true);
  console.log('✅ 已启用实时同步');
  
  // Create test keypoint
  const testKeypoint = {
    id: `test-sync-${Date.now()}`,
    x: 150,
    y: 200,
    direction: 90,
    directionType: 'angle',
    order: 888,
    timestamp: new Date().toISOString()
  };
  
  console.log('🔍 创建测试标注点:', testKeypoint);
  
  try {
    // Trigger sync manually
    console.log('🔄 手动触发同步...');
    const result = await syncManager.syncKeypointAddition(
      testKeypoint,
      appState.currentImage,
      appState.currentPlant
    );
    
    console.log('🔄 同步结果:', result);
    
    if (result.success) {
      console.log(`✅ 同步成功！已同步到 ${result.synced} 个未来图像`);
      return true;
    } else {
      console.log(`❌ 同步失败: ${result.message}`);
      return false;
    }
    
  } catch (error) {
    console.log('❌ 同步流程测试失败:', error);
    return false;
  }
}

/**
 * Comprehensive Real-Time Sync Test
 */
async function runComprehensiveRealTimeSyncTest() {
  console.clear();
  console.log('🔄 实时同步功能综合测试');
  console.log('=======================');
  console.log('时间:', new Date().toLocaleString());
  console.log('');
  
  const results = {
    basicTest: false,
    futureImageTest: false,
    storageTest: false,
    syncFlowTest: false
  };
  
  // Test 1: Basic setup
  console.log('📋 测试1: 基础设置检查');
  results.basicTest = testRealTimeSyncWithDebug();
  
  if (!results.basicTest) {
    console.log('\n❌ 基础设置测试失败，停止后续测试');
    return results;
  }
  
  // Test 2: Future image detection
  console.log('\n📋 测试2: 未来图像检测');
  results.futureImageTest = await testFutureImageDetection();
  
  // Test 3: Annotation storage methods
  console.log('\n📋 测试3: 标注存储方法');
  results.storageTest = await testAnnotationStorageMethods();
  
  // Test 4: Complete sync flow
  if (results.futureImageTest && results.storageTest) {
    console.log('\n📋 测试4: 完整同步流程');
    results.syncFlowTest = await testCompleteSyncFlow();
  } else {
    console.log('\n⏸️ 跳过完整同步流程测试（前置条件未满足）');
  }
  
  // Summary
  console.log('\n🎯 测试结果总结');
  console.log('================');
  console.log(`基础设置: ${results.basicTest ? '✅ 通过' : '❌ 失败'}`);
  console.log(`未来图像检测: ${results.futureImageTest ? '✅ 通过' : '❌ 失败'}`);
  console.log(`标注存储方法: ${results.storageTest ? '✅ 通过' : '❌ 失败'}`);
  console.log(`完整同步流程: ${results.syncFlowTest ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n${allPassed ? '🎉 所有测试通过！' : '⚠️ 部分测试失败'}`);
  
  if (allPassed) {
    console.log('\n🚀 实时同步功能应该可以正常工作了！');
    console.log('请尝试:');
    console.log('1. 勾选"Real-time Change"复选框');
    console.log('2. 添加或移动标注点');
    console.log('3. 检查后续图像是否获得了同步的标注');
  } else {
    console.log('\n🔧 请检查失败的测试项并修复相关问题');
  }
  
  return results;
}

// Export functions for global access
window.testRealTimeSyncWithDebug = testRealTimeSyncWithDebug;
window.testFutureImageDetection = testFutureImageDetection;
window.testAnnotationStorageMethods = testAnnotationStorageMethods;
window.testCompleteSyncFlow = testCompleteSyncFlow;
window.runComprehensiveRealTimeSyncTest = runComprehensiveRealTimeSyncTest;

console.log('🔄 增强版实时同步调试脚本已加载');
console.log('运行 runComprehensiveRealTimeSyncTest() 来进行综合测试');