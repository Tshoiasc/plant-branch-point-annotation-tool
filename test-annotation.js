/**
 * 测试标注文件创建工具
 * 用于验证文件系统标注功能
 */

// 创建测试标注数据
function createTestAnnotation(imageId) {
  return {
    plantId: "test-plant",
    imageId: imageId,
    annotations: [
      {
        id: Date.now(),
        x: 100,
        y: 150,
        timestamp: new Date().toISOString(),
        direction: "left",
        order: 1
      },
      {
        id: Date.now() + 1,
        x: 200,
        y: 250,
        timestamp: new Date().toISOString(),
        direction: "right", 
        order: 2
      }
    ],
    timestamp: new Date().toISOString(),
    version: '2.0'
  };
}

// 测试文件系统功能
async function testFileSystemAnnotation() {
  console.log('开始测试文件系统标注功能...');
  
  // 检查是否支持File System Access API
  if (!('showDirectoryPicker' in window)) {
    console.error('浏览器不支持File System Access API');
    return;
  }
  
  try {
    // 选择目录
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    
    console.log('选择的目录:', directoryHandle.name);
    
    // 创建annotations子目录
    let annotationsHandle;
    try {
      annotationsHandle = await directoryHandle.getDirectoryHandle('annotations');
      console.log('找到现有的annotations目录');
    } catch (error) {
      annotationsHandle = await directoryHandle.getDirectoryHandle('annotations', { create: true });
      console.log('创建了新的annotations目录');
    }
    
    // 创建测试标注文件
    const testImageId = 'test-image-001';
    const testData = createTestAnnotation(testImageId);
    
    const fileName = `${testImageId}.json`;
    const fileHandle = await annotationsHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(JSON.stringify(testData, null, 2));
    await writable.close();
    
    console.log(`创建测试标注文件: ${fileName}`);
    console.log('测试数据:', testData);
    
    // 验证读取
    const readFileHandle = await annotationsHandle.getFileHandle(fileName);
    const file = await readFileHandle.getFile();
    const content = await file.text();
    const readData = JSON.parse(content);
    
    console.log('读取验证成功:', readData);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 在控制台中运行测试
console.log('测试工具已加载。运行 testFileSystemAnnotation() 来测试文件系统功能。');
