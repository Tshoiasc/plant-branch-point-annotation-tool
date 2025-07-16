/**
 * Custom Annotation Real-time Sync Test
 * 
 * This script helps test and debug custom annotation real-time synchronization
 * Run this in the browser console to test the functionality.
 */

/**
 * Test Custom Annotation Real-time Sync
 */
async function testCustomAnnotationSync() {
  console.log('🔄 测试自定义标注实时同步功能');
  console.log('============================');
  
  const annotationTool = window.PlantAnnotationTool?.annotationTool;
  const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
  const appState = window.PlantAnnotationTool?.appState;
  
  if (!annotationTool || !realTimeSyncManager || !appState) {
    console.log('❌ 测试失败：缺少必要的组件');
    return false;
  }
  
  // Check if real-time sync is enabled
  const isEnabled = realTimeSyncManager.isRealTimeSyncEnabled();
  console.log(`🔄 实时同步状态: ${isEnabled ? '启用' : '禁用'}`);
  
  if (!isEnabled) {
    console.log('⚠️ 请先启用实时同步功能（勾选Real-time Change复选框）');
    return false;
  }
  
  // Check if we have current plant and image
  if (!appState.currentPlant || !appState.currentImage) {
    console.log('❌ 测试失败：缺少当前植株或图像信息');
    return false;
  }
  
  console.log(`🔄 当前植株: ${appState.currentPlant.id}`);
  console.log(`🔄 当前图像: ${appState.currentImage.id}`);
  
  // Get future images
  const futureImages = await realTimeSyncManager.getFutureImages(
    appState.currentImage, 
    appState.currentPlant
  );
  
  console.log(`🔄 找到 ${futureImages.length} 个未来图像`);
  
  if (futureImages.length === 0) {
    console.log('⚠️ 没有未来图像可供同步测试');
    return false;
  }
  
  // Check if we're in custom annotation mode
  const customAnnotationManager = annotationTool.getCustomAnnotationManager();
  const isInCustomMode = customAnnotationManager?.isInCustomMode();
  const currentCustomType = customAnnotationManager?.getCurrentCustomType();
  
  console.log(`🔄 自定义标注模式: ${isInCustomMode ? '启用' : '禁用'}`);
  if (isInCustomMode && currentCustomType) {
    console.log(`🔄 当前自定义类型: ${currentCustomType.id} (${currentCustomType.name})`);
  }
  
  // Test sync trigger
  console.log('\n🔄 测试同步触发...');
  
  // Create a test custom annotation
  const testCustomType = currentCustomType || { id: 'test-type', name: 'Test Type' };
  const testKeypoint = {
    id: Date.now(),
    x: 100,
    y: 100,
    order: 1,
    annotationType: 'custom',
    customTypeId: testCustomType.id,
    direction: 0,
    directionType: 'angle',
    timestamp: new Date().toISOString()
  };
  
  console.log('🔄 测试自定义标注数据:', testKeypoint);
  
  try {
    // Test sync manually
    const result = await realTimeSyncManager.syncKeypointAddition(
      testKeypoint,
      appState.currentImage,
      appState.currentPlant
    );
    
    console.log('🔄 同步测试结果:', result);
    
    if (result.success) {
      console.log(`✅ 自定义标注同步成功！已同步到 ${result.synced} 个未来图像`);
      
      // Verify sync by checking future images
      console.log('\n🔄 验证同步结果...');
      for (let i = 0; i < Math.min(futureImages.length, 3); i++) {
        const futureImage = futureImages[i];
        const annotationData = await realTimeSyncManager.annotationStorageManager.getImageAnnotation(futureImage.id);
        
        if (annotationData && annotationData.annotations) {
          const matchingAnnotation = annotationData.annotations.find(ann => 
            ann.order === testKeypoint.order && 
            ann.annotationType === 'custom' && 
            ann.customTypeId === testKeypoint.customTypeId
          );
          
          if (matchingAnnotation) {
            console.log(`✅ 在图像 ${futureImage.id} 中找到匹配的自定义标注`);
          } else {
            console.log(`❌ 在图像 ${futureImage.id} 中未找到匹配的自定义标注`);
          }
        } else {
          console.log(`❌ 图像 ${futureImage.id} 没有标注数据`);
        }
      }
      
      return true;
    } else {
      console.log(`❌ 自定义标注同步失败: ${result.message}`);
      return false;
    }
    
  } catch (error) {
    console.log('❌ 同步测试时发生错误:', error);
    return false;
  }
}

/**
 * Monitor Real-time Sync Events
 */
function monitorCustomAnnotationSync() {
  console.log('🔄 开始监控自定义标注同步事件...');
  console.log('=====================================');
  console.log('请执行以下操作来测试：');
  console.log('1. 启用实时同步（勾选Real-time Change）');
  console.log('2. 切换到自定义标注模式');
  console.log('3. 添加、移动或删除自定义标注');
  console.log('4. 观察控制台输出');
  console.log('');
  console.log('查找以下关键日志：');
  console.log('- 🔄 触发实时同步: ADD_KEYPOINT (isCustom: true)');
  console.log('- 🔄 Added new custom(...) keypoint');
  console.log('- 🔄 Synced to X future images');
}

// Export functions for global access
window.testCustomAnnotationSync = testCustomAnnotationSync;
window.monitorCustomAnnotationSync = monitorCustomAnnotationSync;

console.log('🔄 自定义标注同步测试脚本已加载');
console.log('运行 testCustomAnnotationSync() 来测试同步功能');
console.log('运行 monitorCustomAnnotationSync() 来监控同步事件');