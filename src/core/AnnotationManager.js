/**
 * 标注管理器 - 批量加载优化版本
 * 
 * 功能：
 * - 批量获取所有植物和图像的标注数据
 * - 智能缓存和性能优化
 * - 与现有系统集成
 * - 避免单独的网络请求
 */

export class AnnotationManager {
  constructor(httpFileSystemManager) {
    this.httpManager = httpFileSystemManager;
    this.annotations = new Map(); // 标注缓存
    this.cacheTimestamps = new Map(); // 缓存时间戳
    this.isInitialized = false;
    this.cacheExpiration = 10 * 60 * 1000; // 10分钟缓存过期
    
    // 批量数据缓存
    this.bulkAnnotationData = null;
    this.bulkDataTimestamp = 0;
    
    // 性能指标
    this.performanceMetrics = {
      requestCount: 0,
      bulkRequestCount: 0,
      cacheHits: 0,
      networkTime: 0,
      totalAnnotations: 0
    };
  }

  /**
   * 初始化标注管理器
   */
  async initialize() {
    try {
      await this.httpManager.ensureConnection();
      this.isInitialized = true;
      console.log('[AnnotationManager] 初始化成功');
      return true;
    } catch (error) {
      console.error('[AnnotationManager] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保连接可用
   */
  async ensureConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    await this.httpManager.ensureConnection();
  }

  /**
   * 批量获取所有标注数据 (核心性能优化方法)
   */
  async getAllAnnotationsInBulk() {
    console.log('[AnnotationManager] 开始批量获取所有标注数据...');
    
    await this.ensureConnection();
    
    // 检查批量数据缓存
    if (this.bulkAnnotationData && !this.isBulkDataExpired()) {
      console.log('[AnnotationManager] 使用缓存的批量标注数据');
      this.performanceMetrics.cacheHits++;
      return this.bulkAnnotationData;
    }

    return this.httpManager.withRetry(async () => {
      const startTime = performance.now();
      // 🔧 FIX: Correct URL construction to avoid double /api/
      const baseUrl = this.httpManager.baseUrl.replace(/\/api$/, ''); // Remove trailing /api if present
      const url = `${baseUrl}/api/annotations/bulk`;
      console.log(`[AnnotationManager] 请求批量标注数据 URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        this.performanceMetrics.bulkRequestCount++;

        if (!response.ok) {
          if (response.status === 404) {
            console.warn('[AnnotationManager] 批量标注端点不存在，将回退到传统模式');
            return null; // 表示不支持批量API
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.performanceMetrics.networkTime += performance.now() - startTime;

        if (result.success) {
          // 缓存批量数据
          this.bulkAnnotationData = {
            plantAnnotations: result.data.plantAnnotations || {},
            imageAnnotations: result.data.imageAnnotations || {},
            statistics: result.data.statistics || {}
          };
          this.bulkDataTimestamp = Date.now();
          
          // 更新个别缓存以保持一致性
          this.updateIndividualCacheFromBulk();
          
          // 统计数据
          const plantCount = Object.keys(this.bulkAnnotationData.plantAnnotations).length;
          const imageCount = Object.keys(this.bulkAnnotationData.imageAnnotations).length;
          this.performanceMetrics.totalAnnotations = this.calculateTotalAnnotations();
          
          console.log(`[AnnotationManager] 成功获取批量标注数据: ${plantCount} 个植物, ${imageCount} 个图像, ${this.performanceMetrics.totalAnnotations} 个标注点`);
          
          return this.bulkAnnotationData;
        }

        throw new Error(result.error || '获取批量标注数据失败');
      } catch (fetchError) {
        this.performanceMetrics.networkTime += performance.now() - startTime;
        
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error(`网络连接失败: 无法连接到后端服务 (${url})`);
        }
        throw fetchError;
      }
    }, '批量获取标注数据');
  }

  /**
   * 获取植物标注数据 (优化版本，优先使用批量数据)
   */
  async getPlantAnnotations(plantId) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }

    await this.ensureConnection();
    
    const cacheKey = `plant_${plantId}`;
    
    // 首先检查是否有批量数据缓存
    if (this.bulkAnnotationData && !this.isBulkDataExpired()) {
      const plantAnnotations = this.bulkAnnotationData.plantAnnotations[plantId] || [];
      this.annotations.set(cacheKey, plantAnnotations);
      this.performanceMetrics.cacheHits++;
      return plantAnnotations;
    }
    
    // 检查独立缓存
    if (this.annotations.has(cacheKey) && !this.isCacheExpired(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.annotations.get(cacheKey);
    }

    // 回退到单独请求
    return this.getSinglePlantAnnotations(plantId);
  }

  /**
   * 获取图像标注数据 (优化版本，优先使用批量数据)
   */
  async getImageAnnotations(imageId) {
    if (!imageId) {
      throw new Error('图像ID不能为空');
    }

    await this.ensureConnection();
    
    const cacheKey = `image_${imageId}`;
    
    // 首先检查是否有批量数据缓存
    if (this.bulkAnnotationData && !this.isBulkDataExpired()) {
      const imageAnnotations = this.bulkAnnotationData.imageAnnotations[imageId] || [];
      this.annotations.set(cacheKey, imageAnnotations);
      this.performanceMetrics.cacheHits++;
      return imageAnnotations;
    }
    
    // 检查独立缓存
    if (this.annotations.has(cacheKey) && !this.isCacheExpired(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.annotations.get(cacheKey);
    }

    // 回退到单独请求
    return this.getSingleImageAnnotations(imageId);
  }

  /**
   * 获取快速标注统计（用于Badge更新）
   */
  async getQuickAnnotationStats() {
    console.log('[AnnotationManager] 获取快速标注统计...');
    
    try {
      const bulkData = await this.getAllAnnotationsInBulk();
      
      if (!bulkData) {
        console.warn('[AnnotationManager] 批量API不可用，回退到传统模式');
        return null;
      }
      
      const stats = {};
      
      // 计算每个植物的标注统计
      for (const [plantId, plantAnnotations] of Object.entries(bulkData.plantAnnotations)) {
        let imageAnnotationCount = 0;
        
        // 统计该植物所有图像的标注数
        for (const [imageId, imageAnnotations] of Object.entries(bulkData.imageAnnotations)) {
          if (imageId.startsWith(plantId + '_')) {
            imageAnnotationCount += imageAnnotations.length;
          }
        }
        
        stats[plantId] = {
          plantAnnotations: plantAnnotations.length,
          imageAnnotations: imageAnnotationCount,
          total: plantAnnotations.length + imageAnnotationCount
        };
      }
      
      console.log(`[AnnotationManager] 快速统计完成: ${Object.keys(stats).length} 个植物`);
      return stats;
    } catch (error) {
      console.error('[AnnotationManager] 获取快速标注统计失败:', error);
      return null;
    }
  }

  /**
   * 单独获取植物标注（回退方案）
   */
  async getSinglePlantAnnotations(plantId) {
    const startTime = performance.now();
    
    try {
      // 🔧 FIX: Consistent URL construction to avoid double /api/
      const baseUrl = this.httpManager.baseUrl.replace(/\/api$/, '');
      const url = `${baseUrl}/api/plant-annotations/${encodeURIComponent(plantId)}`;
      
      const response = await fetch(url);
      this.performanceMetrics.requestCount++;

      if (!response.ok) {
        if (response.status === 404) {
          const emptyResult = [];
          this.setCache(`plant_${plantId}`, emptyResult);
          return emptyResult;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.performanceMetrics.networkTime += performance.now() - startTime;

      if (result.success) {
        this.setCache(`plant_${plantId}`, result.data);
        return result.data;
      }

      throw new Error(result.error || '获取植物标注失败');
    } catch (fetchError) {
      this.performanceMetrics.networkTime += performance.now() - startTime;
      throw fetchError;
    }
  }

  /**
   * 单独获取图像标注（回退方案）
   */
  async getSingleImageAnnotations(imageId) {
    const startTime = performance.now();
    
    try {
      // 🔧 FIX: Consistent URL construction to avoid double /api/
      const baseUrl = this.httpManager.baseUrl.replace(/\/api$/, '');
      const url = `${baseUrl}/api/image-annotations/${encodeURIComponent(imageId)}`;
      
      const response = await fetch(url);
      this.performanceMetrics.requestCount++;

      if (!response.ok) {
        if (response.status === 404) {
          const emptyResult = [];
          this.setCache(`image_${imageId}`, emptyResult);
          return emptyResult;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.performanceMetrics.networkTime += performance.now() - startTime;

      if (result.success) {
        this.setCache(`image_${imageId}`, result.data);
        return result.data;
      }

      throw new Error(result.error || '获取图像标注失败');
    } catch (fetchError) {
      this.performanceMetrics.networkTime += performance.now() - startTime;
      throw fetchError;
    }
  }

  /**
   * 检查批量数据是否过期
   */
  isBulkDataExpired() {
    if (!this.bulkDataTimestamp) return true;
    return Date.now() - this.bulkDataTimestamp > this.cacheExpiration;
  }

  /**
   * 从批量数据更新个别缓存
   */
  updateIndividualCacheFromBulk() {
    if (!this.bulkAnnotationData) return;
    
    // 更新植物标注缓存
    for (const [plantId, annotations] of Object.entries(this.bulkAnnotationData.plantAnnotations)) {
      const cacheKey = `plant_${plantId}`;
      this.setCache(cacheKey, annotations);
    }
    
    // 更新图像标注缓存
    for (const [imageId, annotations] of Object.entries(this.bulkAnnotationData.imageAnnotations)) {
      const cacheKey = `image_${imageId}`;
      this.setCache(cacheKey, annotations);
    }
  }

  /**
   * 计算总标注数量
   */
  calculateTotalAnnotations() {
    if (!this.bulkAnnotationData) return 0;
    
    let total = 0;
    
    // 植物标注
    for (const annotations of Object.values(this.bulkAnnotationData.plantAnnotations)) {
      total += annotations.length;
    }
    
    // 图像标注
    for (const annotations of Object.values(this.bulkAnnotationData.imageAnnotations)) {
      total += annotations.length;
    }
    
    return total;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.annotations.clear();
    this.cacheTimestamps.clear();
    this.bulkAnnotationData = null;
    this.bulkDataTimestamp = 0;
    console.log('[AnnotationManager] 标注缓存已完全清除');
  }

  /**
   * 设置缓存
   */
  setCache(key, data) {
    this.annotations.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 检查缓存是否过期
   */
  isCacheExpired(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return true;
    return Date.now() - timestamp > this.cacheExpiration;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheSize: this.annotations.size,
      hasBulkData: !!this.bulkAnnotationData,
      bulkDataAge: this.bulkDataTimestamp ? Date.now() - this.bulkDataTimestamp : null,
      averageRequestTime: this.performanceMetrics.requestCount > 0 
        ? this.performanceMetrics.networkTime / this.performanceMetrics.requestCount 
        : 0
    };
  }

  /**
   * 强制刷新批量数据
   */
  async refreshBulkData() {
    console.log('[AnnotationManager] 强制刷新批量标注数据...');
    this.bulkAnnotationData = null;
    this.bulkDataTimestamp = 0;
    return await this.getAllAnnotationsInBulk();
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.clearCache();
    this.isInitialized = false;
    console.log('[AnnotationManager] 清理完成');
  }
}