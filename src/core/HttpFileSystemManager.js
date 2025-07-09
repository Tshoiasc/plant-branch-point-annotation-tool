/**
 * HTTP文件系统管理器
 * 
 * 功能：
 * - 通过HTTP请求与后端通信
 * - 替代直接文件系统访问
 * - 支持植物数据和标注文件管理
 */

export class HttpFileSystemManager {
  constructor() {
    this.baseUrl = 'http://localhost:3003/api';
    this.datasetPath = '/Users/tshoiasc/Brassica napus dataset/dataset';
    this.isInitialized = false;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.connectionTimeout = 5000;
    this.lastConnectionCheck = 0;
    this.connectionCheckInterval = 30000;
  }

  /**
   * 初始化管理器，带重试机制
   */
  async initialize() {
    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);
      
      try {
        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          this.isInitialized = true;
          this.lastConnectionCheck = Date.now();
          console.log('HttpFileSystemManager 初始化成功');
          return true;
        }
        
        throw new Error('Backend server responded but reported failure');
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`连接超时 (${this.connectionTimeout}ms)`);
        }
        throw error;
      }
    }, '初始化管理器');
  }

  /**
   * 检查是否支持（始终返回true，因为使用HTTP）
   */
  static isSupported() {
    return true;
  }

  /**
   * 重试机制包装器
   */
  async withRetry(operation, operationName = '操作', maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`${operationName} 重试第 ${attempt - 1} 次...`);
          await this.delay(this.retryDelay * attempt);
        }
        
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isConnectionError(error) && attempt < maxRetries) {
          console.warn(`${operationName} 失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
          continue;
        }
        
        console.error(`${operationName} 最终失败:`, error);
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * 检查是否为连接错误
   */
  isConnectionError(error) {
    return error.message.includes('Failed to fetch') ||
           error.message.includes('ERR_CONNECTION_REFUSED') ||
           error.message.includes('网络错误') ||
           error.message.includes('连接超时') ||
           error.name === 'TypeError' && error.message.includes('fetch');
  }
  
  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 检查连接状态
   */
  async checkConnection() {
    const now = Date.now();
    if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
      return this.isInitialized;
    }
    
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      const isConnected = response.ok;
      this.isInitialized = isConnected;
      this.lastConnectionCheck = now;
      
      return isConnected;
    } catch (error) {
      this.isInitialized = false;
      this.lastConnectionCheck = now;
      return false;
    }
  }
  
  /**
   * 获取数据集信息
   */
  async getDatasetInfo() {
    await this.ensureConnection();
    
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/dataset-info`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      throw new Error(result.error || '获取数据集信息失败');
    }, '获取数据集信息');
  }
  
  /**
   * 确保连接可用
   */
  async ensureConnection() {
    if (!(await this.checkConnection())) {
      throw new Error('后端服务连接不可用，请确保服务器正在运行在 http://localhost:3003');
    }
  }

  /**
   * 遍历植物文件夹
   */
  async traversePlantDirectories() {
    await this.ensureConnection();
    
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/plant-directories`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`找到 ${result.data.length} 个有效植物文件夹`);
        return result.data;
      }
      
      throw new Error(result.error || '遍历植物文件夹失败');
    }, '遍历植物文件夹');
  }

  /**
   * 读取植物的图像文件
   */
  async readPlantImages(plantId) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }
    
    await this.ensureConnection();
    
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/plant-images/${encodeURIComponent(plantId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const imagesByView = result.data;
        
        const totalImages = Object.values(imagesByView).reduce((total, images) => total + images.length, 0);
        console.log(`植物 ${plantId} 总共 ${totalImages} 张图像`);
        
        return imagesByView;
      }
      
      throw new Error(result.error || '读取植物图像失败');
    }, `读取植物 ${plantId} 图像`);
  }

  /**
   * 获取图像文件URL
   */
  getImageUrl(plantId, viewAngle, imageName) {
    return `${this.baseUrl}/image/${plantId}/${viewAngle}/${imageName}`;
  }

  /**
   * 创建图像URL (替代createImageURL)
   */
  async createImageURL(imageData) {
    try {
      console.log('创建图像URL，imageData:', imageData);
      
      // 从imageData中提取信息
      const parts = imageData.id.split('_');
      console.log('图像ID分割结果:', parts);
      
      if (parts.length >= 3) {
        const plantId = parts[0];
        const viewAngle = parts[1];
        const imageName = parts.slice(2).join('_'); // 处理文件名中可能包含下划线的情况
        
        const imageUrl = this.getImageUrl(plantId, viewAngle, imageName);
        console.log('生成的图像URL:', imageUrl);
        
        return imageUrl;
      }
      
      throw new Error(`Invalid image data format. ID: ${imageData.id}, expected format: plantId_viewAngle_imageName`);
    } catch (error) {
      console.error(`创建图像URL失败 ${imageData.name}:`, error);
      console.error('imageData:', imageData);
      throw error;
    }
  }

  /**
   * 保存标注文件
   */
  async saveAnnotationFile(imageId, annotationData) {
    if (!imageId) {
      throw new Error('图像ID不能为空');
    }
    if (!annotationData) {
      throw new Error('标注数据不能为空');
    }
    
    await this.ensureConnection();
    
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/annotation/${encodeURIComponent(imageId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ annotationData })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`保存标注文件: ${imageId}`);
        return true;
      }
      
      throw new Error(result.error || '保存标注文件失败');
    }, `保存标注文件 ${imageId}`);
  }

  /**
   * 读取标注文件
   */
  async loadAnnotationFile(imageId) {
    try {
      const response = await fetch(`${this.baseUrl}/annotation/${imageId}`);
      const result = await response.json();
      
      if (result.success) {
        if (result.data) {
          console.log(`[标注] 成功读取 ${imageId}, 包含 ${result.data.annotations?.length || 0} 个标注点`);
        }
        return result.data;
      }
      
      throw new Error(result.error || '读取标注文件失败');
    } catch (error) {
      console.error(`[标注] 读取标注文件失败 (${imageId}):`, error);
      return null;
    }
  }

  /**
   * 获取所有标注文件列表
   */
  async getAllAnnotationFiles() {
    try {
      const response = await fetch(`${this.baseUrl}/annotations`);
      const result = await response.json();
      
      if (result.success) {
        console.log(`[标注] 扫描完成，找到 ${result.data.length} 个标注文件`);
        return result.data;
      }
      
      throw new Error(result.error || '获取标注文件列表失败');
    } catch (error) {
      console.error('[标注] 获取标注文件列表失败:', error);
      return [];
    }
  }

  /**
   * 删除标注文件
   */
  async deleteAnnotationFile(imageId) {
    try {
      const response = await fetch(`${this.baseUrl}/annotation/${imageId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`删除标注文件: ${imageId}`);
        return true;
      }
      
      throw new Error(result.error || '删除标注文件失败');
    } catch (error) {
      console.error(`删除标注文件失败 (${imageId}):`, error);
      return false;
    }
  }

  /**
   * 获取目录统计信息
   */
  async getDirectoryStats(dirPath = null) {
    try {
      const url = dirPath ? 
        `${this.baseUrl}/directory-stats?dirPath=${encodeURIComponent(dirPath)}` : 
        `${this.baseUrl}/directory-stats`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      throw new Error(result.error || '获取目录统计失败');
    } catch (error) {
      console.error('获取目录统计失败:', error);
      throw error;
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
   * 解析图像文件名中的时间信息
   */
  parseImageDateTime(filename) {
    const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
    const match = filename.match(regex);
    
    if (match) {
      const dateStr = match[1];
      const hourStr = match[2];
      const dateTime = new Date(`${dateStr}T${hourStr}:00:00`);
      return dateTime;
    }
    
    console.warn(`无法解析文件名时间信息: ${filename}`);
    return new Date(0);
  }

  /**
   * 格式化图像时间显示
   */
  formatImageTime(filename) {
    const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
    const match = filename.match(regex);
    
    if (match) {
      const dateStr = match[1];
      const hourStr = match[2];
      const date = new Date(`${dateStr}T${hourStr}:00:00`);
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    
    return filename;
  }

  /**
   * 获取所有跳过信息
   */
  async getAllSkipInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/skip-info`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      throw new Error(result.error || '获取跳过信息失败');
    } catch (error) {
      console.error('获取跳过信息失败:', error);
      return {};
    }
  }

  /**
   * 获取特定植物的跳过信息
   */
  async getSkipInfo(plantId) {
    try {
      const response = await fetch(`${this.baseUrl}/skip-info/${plantId}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      throw new Error(result.error || '获取跳过信息失败');
    } catch (error) {
      console.error(`获取植物 ${plantId} 跳过信息失败:`, error);
      return null;
    }
  }

  /**
   * 保存植物跳过信息
   */
  async saveSkipInfo(plantId, skipData) {
    try {
      const response = await fetch(`${this.baseUrl}/skip-info/${plantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ skipData })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`保存跳过信息: ${plantId}`);
        return true;
      }
      
      throw new Error(result.error || '保存跳过信息失败');
    } catch (error) {
      console.error(`保存植物 ${plantId} 跳过信息失败:`, error);
      throw error;
    }
  }

  /**
   * 删除植物跳过信息
   */
  async deleteSkipInfo(plantId) {
    try {
      const response = await fetch(`${this.baseUrl}/skip-info/${plantId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`删除跳过信息: ${plantId}`);
        return true;
      }
      
      throw new Error(result.error || '删除跳过信息失败');
    } catch (error) {
      console.error(`删除植物 ${plantId} 跳过信息失败:`, error);
      return false;
    }
  }

  /**
   * 清理资源（HTTP版本不需要实际清理）
   */
  cleanup() {
    console.log('HttpFileSystemManager 清理完成');
  }

  /**
   * 兼容性方法：获取annotations目录（HTTP版本返回虚拟状态）
   */
  getAnnotationsDirectory() {
    return this.isInitialized ? { exists: true } : null;
  }

  /**
   * 兼容性方法：确保annotations目录存在
   */
  async ensureAnnotationsDirectory() {
    // HTTP版本中，后端自动处理目录创建
    return { exists: true };
  }
}