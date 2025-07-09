/**
 * 文件系统访问管理器
 * 
 * 功能：
 * - 目录和文件访问管理
 * - 权限验证和持久化
 * - 浏览器兼容性处理
 * - 文件读取和缓存
 */

export class FileSystemManager {
  constructor() {
    this.directoryHandles = new Map();
    this.fileCache = new Map();
    this.permissions = new Map();
  }

  /**
   * 检查File System Access API支持
   */
  static isSupported() {
    return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window;
  }

  /**
   * 选择数据集根目录
   */
  async selectDatasetDirectory() {
    if (!FileSystemManager.isSupported()) {
      throw new Error('当前浏览器不支持 File System Access API');
    }

    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',  // 请求读写权限
        startIn: 'documents'
      });

      console.log('[标注] 选择数据集目录:', directoryHandle.name);

      // 缓存目录句柄
      this.directoryHandles.set('dataset', directoryHandle);

      // 验证读写权限
      await this.verifyPermission(directoryHandle, 'readwrite');

      // 获取或创建annotations目录
      await this.ensureAnnotationsDirectory(directoryHandle);

      return directoryHandle;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('selectDatasetDirectory: 用户取消了目录选择');
        return null;
      }
      console.error('selectDatasetDirectory: 选择目录失败:', error);
      throw error;
    }
  }

  /**
   * 验证并请求目录访问权限
   */
  async verifyPermission(directoryHandle, mode = 'read') {
    const options = {};
    if (mode === 'readwrite') {
      options.mode = 'readwrite';
    }

    // 检查现有权限
    if ((await directoryHandle.queryPermission(options)) === 'granted') {
      return true;
    }

    // 请求权限
    if ((await directoryHandle.requestPermission(options)) === 'granted') {
      this.permissions.set(directoryHandle.name, { mode, granted: true });
      return true;
    }

    return false;
  }

  /**
   * 确保annotations目录存在
   */
  async ensureAnnotationsDirectory(datasetHandle) {
    try {
      // 尝试获取现有的annotations目录
      const annotationsHandle = await datasetHandle.getDirectoryHandle('annotations');
      this.directoryHandles.set('annotations', annotationsHandle);
      console.log('[标注] 找到现有的annotations目录');

      // 统计annotations目录中的文件
      let fileCount = 0;
      for await (const [name, handle] of annotationsHandle.entries()) {
        if (handle.kind === 'file' && name.endsWith('.json')) {
          fileCount++;
        }
      }
      console.log(`[标注] annotations目录包含 ${fileCount} 个JSON文件`);

      return annotationsHandle;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        try {
          // 创建annotations目录
          const annotationsHandle = await datasetHandle.getDirectoryHandle('annotations', { create: true });
          this.directoryHandles.set('annotations', annotationsHandle);
          console.log('[标注] 创建了新的annotations目录');
          return annotationsHandle;
        } catch (createError) {
          console.error('ensureAnnotationsDirectory: 创建annotations目录失败:', createError);
          throw createError;
        }
      } else {
        console.error('ensureAnnotationsDirectory: 访问annotations目录失败:', error);
        throw error;
      }
    }
  }

  /**
   * 获取annotations目录句柄
   */
  getAnnotationsDirectory() {
    const handle = this.directoryHandles.get('annotations');
    console.log(`[标注] getAnnotationsDirectory: ${handle ? '找到句柄' : '句柄不存在'}`);
    return handle;
  }

  /**
   * 保存标注文件
   */
  async saveAnnotationFile(imageId, annotationData) {
    const annotationsHandle = this.getAnnotationsDirectory();
    if (!annotationsHandle) {
      throw new Error('annotations目录未初始化');
    }

    try {
      const fileName = `${imageId}.json`;
      const fileHandle = await annotationsHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      await writable.write(JSON.stringify(annotationData, null, 2));
      await writable.close();

      console.log(`保存标注文件: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`保存标注文件失败 (${imageId}):`, error);
      throw error;
    }
  }

  /**
   * 读取标注文件
   */
  async loadAnnotationFile(imageId) {
    const annotationsHandle = this.getAnnotationsDirectory();
    if (!annotationsHandle) {
      return null;
    }

    // 尝试多种文件名格式
    const possibleFileNames = [
      `${imageId}.json`,        // 标准格式
      `${imageId}.png.json`,    // 带扩展名格式
      `${imageId}.jpg.json`     // 其他扩展名格式
    ];

    for (const fileName of possibleFileNames) {
      try {
        const fileHandle = await annotationsHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();

        const data = JSON.parse(content);
        console.log(`[标注] 成功读取 ${fileName}, 包含 ${data.annotations?.length || 0} 个标注点`);
        return data;
      } catch (error) {
        if (error.name === 'NotFoundError') {
          continue; // 尝试下一个文件名
        }
        console.error(`[标注] 读取标注文件失败 (${fileName}):`, error);
        throw error;
      }
    }

    return null;
  }

  /**
   * 获取所有标注文件列表
   */
  async getAllAnnotationFiles() {
    const annotationsHandle = this.getAnnotationsDirectory();
    if (!annotationsHandle) {
      console.log('[标注] annotations目录句柄不存在');
      return [];
    }

    const files = [];
    try {
      for await (const [name, handle] of annotationsHandle.entries()) {
        if (handle.kind === 'file' && name.endsWith('.json')) {
          let imageId;
          if (name.endsWith('.png.json')) {
            imageId = name.replace('.png.json', '.png');
          } else if (name.endsWith('.jpg.json')) {
            imageId = name.replace('.jpg.json', '.jpg');
          } else {
            imageId = name.replace('.json', '');
          }
          files.push(imageId);
        }
      }
    } catch (error) {
      console.error('[标注] 获取标注文件列表失败:', error);
    }

    console.log(`[标注] 扫描完成，找到 ${files.length} 个标注文件`);
    return files;
  }

  /**
   * 删除标注文件
   */
  async deleteAnnotationFile(imageId) {
    const annotationsHandle = this.getAnnotationsDirectory();
    if (!annotationsHandle) {
      return false;
    }

    try {
      const fileName = `${imageId}.json`;
      await annotationsHandle.removeEntry(fileName);
      console.log(`删除标注文件: ${fileName}`);
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        return true; // 文件本来就不存在
      }
      console.error(`删除标注文件失败 (${imageId}):`, error);
      return false;
    }
  }

  /**
   * 遍历植物文件夹
   */
  async traversePlantDirectories(datasetHandle) {
    const plantFolders = [];
    
    console.log('开始遍历植物文件夹...');
    
    for await (const [name, handle] of datasetHandle.entries()) {
      if (handle.kind === 'directory' && name.startsWith('BR')) {
        console.log(`发现植物文件夹: ${name}`);
        
        // 检查是否有sv-000子目录
        const hasSV000 = await this.checkSV000Directory(handle);
        
        if (hasSV000) {
          plantFolders.push({
            id: name,
            name: name,
            handle: handle,
            hasImages: false, // 将在后续检查中设置
            imageCount: 0
          });
        } else {
          console.warn(`植物文件夹 ${name} 缺少 sv-000 子目录`);
        }
      }
    }
    
    console.log(`找到 ${plantFolders.length} 个有效植物文件夹`);
    return plantFolders;
  }

  /**
   * 检查sv-000子目录是否存在
   */
  async checkSV000Directory(plantHandle) {
    try {
      for await (const [name, handle] of plantHandle.entries()) {
        if (handle.kind === 'directory' && name.toLowerCase() === 'sv-000') {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('检查sv-000目录时出错:', error);
      return false;
    }
  }

  /**
   * 读取植物的图像文件
   */
  async readPlantImages(plantHandle) {
    const viewAngles = ['sv-000', 'sv-045', 'sv-090']; // 支持的视角
    const imagesByView = {};
    
    try {
      for (const viewAngle of viewAngles) {
        imagesByView[viewAngle] = [];
        
        try {
          // 查找视角目录
          const viewHandle = await this.getDirectoryHandle(plantHandle, viewAngle);
          if (!viewHandle) {
            console.log(`植物 ${plantHandle.name} 没有 ${viewAngle} 视角`);
            continue;
          }
          
          console.log(`读取植物 ${plantHandle.name} 的 ${viewAngle} 视角图像...`);
          
          // 读取视角目录中的图像
          const images = [];
          for await (const entry of viewHandle.values()) {
            if (entry.kind === 'file' && this.isImageFile(entry.name)) {
              const fileHandle = entry;
              const file = await fileHandle.getFile();
              
              const imageData = {
                id: `${plantHandle.name}_${viewAngle}_${entry.name}`,
                name: entry.name,
                viewAngle: viewAngle,
                handle: fileHandle,
                file: file,
                size: file.size,
                lastModified: file.lastModified,
                dateTime: this.parseImageDateTime(entry.name),
                timeString: this.formatImageTime(entry.name)
              };
              
              images.push(imageData);
            }
          }
          
          // 按时间排序
          images.sort((a, b) => a.dateTime - b.dateTime);
          imagesByView[viewAngle] = images;
          
          console.log(`${viewAngle} 视角找到 ${images.length} 张图像`);
          
        } catch (error) {
          console.warn(`读取 ${viewAngle} 视角失败:`, error);
          imagesByView[viewAngle] = [];
        }
      }
      
      // 计算总图像数量
      const totalImages = Object.values(imagesByView).reduce((total, images) => total + images.length, 0);
      console.log(`植物 ${plantHandle.name} 总共 ${totalImages} 张图像`);
      
      return imagesByView;
      
    } catch (error) {
      console.error(`读取植物 ${plantHandle.name} 图像失败:`, error);
      return {};
    }
  }

  /**
   * 解析图像文件名中的时间信息
   */
  parseImageDateTime(filename) {
    // 匹配格式: BR017-028111-2018-06-06_00_VIS_sv_000-0-0-0.png
    // 支持多种视角：sv_000, sv_045, sv_090
    const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
    const match = filename.match(regex);
    
    if (match) {
      const dateStr = match[1]; // 2018-06-06
      const hourStr = match[2]; // 00
      
      const dateTime = new Date(`${dateStr}T${hourStr}:00:00`);
      
      return dateTime; // 直接返回Date对象用于排序
    }
    
    console.warn(`无法解析文件名时间信息: ${filename}`);
    // 返回一个很早的时间，确保无法解析的文件排在前面
    return new Date(0);
  }

  /**
   * 获取图像文件的File对象
   */
  async getImageFile(imageData) {
    const cacheKey = `${imageData.plantId}_${imageData.name}`;
    
    // 检查缓存
    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey);
    }
    
    try {
      const file = await imageData.handle.getFile();
      
      // 缓存文件对象（但要注意内存使用）
      this.fileCache.set(cacheKey, file);
      
      // 如果缓存过大，清理旧条目
      if (this.fileCache.size > 50) {
        const firstKey = this.fileCache.keys().next().value;
        this.fileCache.delete(firstKey);
      }
      
      return file;
    } catch (error) {
      console.error(`获取图像文件失败 ${imageData.name}:`, error);
      throw error;
    }
  }

  /**
   * 创建图像的Blob URL
   */
  async createImageURL(imageData) {
    try {
      const file = await this.getImageFile(imageData);
      return URL.createObjectURL(file);
    } catch (error) {
      console.error(`创建图像URL失败 ${imageData.name}:`, error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理Blob URLs
    for (const url of this.fileCache.values()) {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
    
    this.fileCache.clear();
    this.directoryHandles.clear();
    this.permissions.clear();
  }

  /**
   * 获取目录统计信息
   */
  async getDirectoryStats(directoryHandle) {
    let folderCount = 0;
    let fileCount = 0;
    
    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === 'directory') {
        folderCount++;
      } else {
        fileCount++;
      }
    }
    
    return { folderCount, fileCount };
  }

  /**
   * 获取子目录句柄
   */
  async getDirectoryHandle(parentHandle, dirName) {
    try {
      // 先尝试直接匹配
      for await (const [name, handle] of parentHandle.entries()) {
        if (handle.kind === 'directory' && name.toLowerCase() === dirName.toLowerCase()) {
          return handle;
        }
      }
      return null;
    } catch (error) {
      console.error(`获取目录 ${dirName} 失败:`, error);
      return null;
    }
  }

  /**
   * 检查是否为图像文件
   */
  isImageFile(filename) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  /**
   * 格式化图像时间显示
   */
  formatImageTime(filename) {
    // 重新解析获取详细信息用于显示
    const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
    const match = filename.match(regex);
    
    if (match) {
      const dateStr = match[1]; // 2018-06-06
      const hourStr = match[2]; // 00
      
      const date = new Date(`${dateStr}T${hourStr}:00:00`);
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    
    return filename; // 如果无法解析，返回原文件名
  }
} 