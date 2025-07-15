/**
 * 标注数据存储管理器
 * 
 * 功能：
 * - 将标注数据保存为JSON文件到项目目录
 * - 从JSON文件加载标注数据
 * - 提供导出功能
 * - 管理标注历史和备份
 */

export class AnnotationStorageManager {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3002/api'; // 本地存储服务器
    this.annotations = new Map();
    this.imageAnnotations = new Map(); // 新增：按图像ID存储标注
    this.isInitialized = false;
    this.fileSystemManager = null; // 文件系统管理器
    this.useFileSystem = false; // 是否使用文件系统存储
  }

  /**
   * 设置文件系统管理器
   */
  setFileSystemManager(fileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.useFileSystem = !!fileSystemManager;
    console.log('[标注] 文件系统存储已启用');

    // 检查annotations目录句柄是否存在
    if (fileSystemManager) {
      const annotationsHandle = fileSystemManager.getAnnotationsDirectory();
      console.log(`[标注] setFileSystemManager: annotations句柄${annotationsHandle ? '存在' : '不存在'}`);
    }
  }

  /**
   * 初始化存储管理器
   */
  async initialize() {
    try {
      if (this.useFileSystem && this.fileSystemManager) {
        // 文件系统模式：扫描标注文件但不预加载到内存
        await this.scanAnnotationFiles();
        console.log('AnnotationStorageManager 初始化完成 (文件系统模式)');
        this.isInitialized = true;
        return;
      }

      // 如果没有启用文件系统，尝试服务器模式
      try {
        await this.loadAnnotationsFromServer();
        await this.loadImageAnnotationsFromServer();
        console.log('AnnotationStorageManager 初始化完成 (服务器模式)');
      } catch (serverError) {
        console.warn('服务器模式初始化失败，使用localStorage模式:', serverError.message);
        // 尝试从localStorage恢复数据
        this.loadFromLocalStorage();
        this.loadImageAnnotationsFromLocalStorage();
        console.log('AnnotationStorageManager 初始化完成 (localStorage模式)');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('初始化标注存储管理器失败:', error);
      this.isInitialized = true; // 即使失败也标记为已初始化，避免重复初始化
    }
  }

  /**
   * 从服务器加载标注数据
   */
  async loadAnnotationsFromServer() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/load-annotations`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // 将数据加载到Map中
        for (const [plantId, annotationData] of Object.entries(result.data.annotations || {})) {
          this.annotations.set(plantId, annotationData);
        }
        
        console.log(`从服务器加载了 ${this.annotations.size} 个植物的标注数据`);
        return result.data;
      } else {
        throw new Error(result.error || '加载标注数据失败');
      }
    } catch (error) {
      console.warn('从服务器加载标注数据失败，尝试从localStorage恢复:', error.message);
      this.loadFromLocalStorage();
      return { annotations: {} };
    }
  }

  /**
   * 保存标注数据到服务器
   */
  async saveAnnotationsToServer() {
    try {
      const exportData = {
        saveTime: new Date().toISOString(),
        totalPlants: this.annotations.size,
        annotations: {}
      };

      // 转换Map为普通对象
      for (const [plantId, annotationData] of this.annotations) {
        exportData.annotations[plantId] = annotationData;
      }

      // 发送保存请求到本地服务器
      const response = await fetch(`${this.apiBaseUrl}/save-annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`成功保存 ${this.annotations.size} 个植物的标注数据到服务器`);
        // 同时备份到localStorage
        this.saveToLocalStorage();
        return true;
      } else {
        throw new Error(result.error || '服务器保存失败');
      }
    } catch (error) {
      console.error('保存标注数据到服务器失败:', error);
      // 如果无法保存到服务器，至少保存到localStorage作为备份
      this.saveToLocalStorage();
      return false;
    }
  }

  /**
   * 保存到localStorage作为备份
   */
  saveToLocalStorage() {
    try {
      const data = {};
      for (const [plantId, annotationData] of this.annotations) {
        data[plantId] = annotationData;
      }
      localStorage.setItem('plant_annotations_backup', JSON.stringify({
        saveTime: new Date().toISOString(),
        annotations: data
      }));
      console.log('标注数据已备份到localStorage');
    } catch (error) {
      console.error('备份到localStorage失败:', error);
    }
  }

  /**
   * 从localStorage恢复数据
   */
  loadFromLocalStorage() {
    try {
      const backup = localStorage.getItem('plant_annotations_backup');
      if (backup) {
        const data = JSON.parse(backup);
        for (const [plantId, annotationData] of Object.entries(data.annotations || {})) {
          if (!this.annotations.has(plantId)) {
            this.annotations.set(plantId, annotationData);
          }
        }
        console.log('从localStorage恢复了备份数据');
      }
    } catch (error) {
      console.error('从localStorage恢复数据失败:', error);
    }
  }

  /**
   * 保存植物标注数据
   */
  async savePlantAnnotations(plantId, annotations, plantInfo = {}) {
    const annotationData = {
      plantId,
      annotations, // 当前选中图像的标注
      selectedImage: plantInfo.selectedImage?.name || null,
      selectedImagePath: plantInfo.selectedImage?.id || null,
      viewAngle: plantInfo.selectedViewAngle || null,
      status: annotations.length > 0 ? 'completed' : 'in-progress',
      lastModified: new Date().toISOString(),
      imageDateTime: plantInfo.selectedImage?.dateTime || null,
      keypointCount: annotations.length,
      
      // 时间序列数据支持
      timeSeriesData: plantInfo.timeSeriesData || null,
      isTimeSeriesEnabled: !!plantInfo.timeSeriesData,
      
      // 完整的视角和时间序列信息
      plantViewAngles: plantInfo.plantViewAngles || [], // 植株所有可用的视角
      selectedViewAngleHistory: plantInfo.selectedViewAngleHistory || {}, // 每个视角的选择历史
      timeSeriesMetadata: plantInfo.timeSeriesMetadata || {} // 时间序列元数据
    };

    this.annotations.set(plantId, annotationData);
    
    // 自动保存到文件
    await this.saveAnnotationsToServer();
    
    return annotationData;
  }

  /**
   * 获取植物标注数据
   */
  getPlantAnnotations(plantId) {
    const data = this.annotations.get(plantId);
    return data ? data.annotations : [];
  }

  /**
   * 获取植物标注状态
   */
  getPlantStatus(plantId) {
    const data = this.annotations.get(plantId);
    if (!data) return 'pending';
    
    return data.annotations.length > 0 ? 'completed' : 'in-progress';
  }

  /**
   * 获取所有已标注的植物ID
   */
  getAnnotatedPlantIds() {
    return Array.from(this.annotations.keys());
  }

  /**
   * 保存植株跳过信息
   */
  async saveSkipInfo(plantId, skipInfo) {
    try {
      // 获取或创建植株标注数据
      let annotationData = this.annotations.get(plantId);
      if (!annotationData) {
        annotationData = {
          plantId,
          annotations: [],
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          selectedViewAngle: null,
          selectedImage: null,
          plantViewAngles: [],
          selectedViewAngleHistory: {},
          timeSeriesMetadata: {}
        };
      }

      // 更新跳过信息
      annotationData.status = skipInfo.status;
      annotationData.skipReason = skipInfo.skipReason;
      annotationData.skipDate = skipInfo.skipDate;
      annotationData.lastModified = skipInfo.lastModified;

      this.annotations.set(plantId, annotationData);

      // 保存到文件系统或HTTP后端
      if (this.useFileSystem && this.fileSystemManager.saveSkipInfo) {
        try {
          // HTTP模式：通过API保存跳过信息
          await this.fileSystemManager.saveSkipInfo(plantId, annotationData);
          console.log(`植株 ${plantId} 跳过信息已保存到后端`);
        } catch (apiError) {
          console.warn('后端保存失败，使用localStorage备份:', apiError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 跳过信息已备份到localStorage`);
        }
      } else if (this.fileSystemManager && this.fileSystemManager.getAnnotationsDirectory()) {
        try {
          // 原有的文件系统模式
          const fileName = `${plantId}_skip_info.json`;
          const annotationsHandle = this.fileSystemManager.getAnnotationsDirectory();
          const fileHandle = await annotationsHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();

          await writable.write(JSON.stringify(annotationData, null, 2));
          await writable.close();

          console.log(`植株 ${plantId} 跳过信息已保存到文件系统: ${fileName}`);
        } catch (fsError) {
          console.warn('文件系统保存失败，使用localStorage备份:', fsError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 跳过信息已备份到localStorage`);
        }
      } else {
        // 如果文件系统不可用，保存到localStorage
        this.saveToLocalStorage();
        console.log(`植株 ${plantId} 跳过信息已保存到localStorage`);
      }

    } catch (error) {
      console.error(`保存植株 ${plantId} 跳过信息失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 NEW: 移除植株跳过信息
   */
  async removeSkipInfo(plantId) {
    try {
      // 从内存中移除跳过状态
      const annotationData = this.annotations.get(plantId);
      if (annotationData) {
        delete annotationData.status;
        delete annotationData.skipReason;
        delete annotationData.skipDate;
        annotationData.lastModified = new Date().toISOString();
        
        // 如果没有其他数据，完全移除
        if (!annotationData.annotations || annotationData.annotations.length === 0) {
          this.annotations.delete(plantId);
        }
      }

      // 从文件系统或HTTP后端移除
      if (this.useFileSystem && this.fileSystemManager.deleteSkipInfo) {
        try {
          // HTTP模式：通过API移除跳过信息
          await this.fileSystemManager.deleteSkipInfo(plantId);
          console.log(`植株 ${plantId} 跳过信息已从后端移除`);
        } catch (apiError) {
          console.warn('后端移除失败，使用localStorage清理:', apiError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 跳过信息已从localStorage清理`);
        }
      } else if (this.fileSystemManager && this.fileSystemManager.getAnnotationsDirectory()) {
        try {
          // 原有的文件系统模式：删除跳过信息文件
          const fileName = `${plantId}_skip_info.json`;
          const annotationsHandle = this.fileSystemManager.getAnnotationsDirectory();
          
          try {
            await annotationsHandle.removeEntry(fileName);
            console.log(`植株 ${plantId} 跳过信息文件已删除: ${fileName}`);
          } catch (removeError) {
            // 文件不存在是正常的
            if (removeError.name !== 'NotFoundError') {
              throw removeError;
            }
            console.log(`植株 ${plantId} 跳过信息文件不存在，无需删除`);
          }
        } catch (fsError) {
          console.warn('文件系统删除失败，使用localStorage清理:', fsError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 跳过信息已从localStorage清理`);
        }
      } else {
        // 如果文件系统不可用，从localStorage清理
        this.saveToLocalStorage();
        console.log(`植株 ${plantId} 跳过信息已从localStorage清理`);
      }

    } catch (error) {
      console.error(`移除植株 ${plantId} 跳过信息失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 FIX: Save plant status independently of annotations
   */
  async savePlantStatus(plantId, status) {
    try {
      // 获取或创建植株数据
      let annotationData = this.annotations.get(plantId);
      if (!annotationData) {
        annotationData = {
          plantId,
          annotations: [],
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          selectedViewAngle: null,
          selectedImage: null,
          plantViewAngles: [],
          selectedViewAngleHistory: {},
          timeSeriesMetadata: {}
        };
      }

      // 更新状态和时间戳
      annotationData.status = status;
      annotationData.lastModified = new Date().toISOString();

      this.annotations.set(plantId, annotationData);

      // 🔧 FIX: Use dedicated plant status API instead of skip-info API
      if (this.useFileSystem && this.fileSystemManager.savePlantStatus) {
        try {
          // HTTP模式：通过专用植物状态API保存
          await this.fileSystemManager.savePlantStatus(plantId, status);
          console.log(`植株 ${plantId} 状态 ${status} 已保存到专用API`);
        } catch (apiError) {
          console.warn('植物状态API保存失败，使用localStorage备份:', apiError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 状态已备份到localStorage`);
        }
      } else if (this.fileSystemManager && this.fileSystemManager.getAnnotationsDirectory()) {
        try {
          // 文件系统模式：保存为独立的状态文件
          const fileName = `${plantId}_status.json`;
          const annotationsHandle = this.fileSystemManager.getAnnotationsDirectory();
          const fileHandle = await annotationsHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();

          const statusData = {
            plantId,
            status,
            lastModified: new Date().toISOString(),
            timestamp: new Date().toISOString()
          };

          await writable.write(JSON.stringify(statusData, null, 2));
          await writable.close();

          console.log(`植株 ${plantId} 状态 ${status} 已保存到文件系统: ${fileName}`);
        } catch (fsError) {
          console.warn('文件系统保存状态失败，使用localStorage备份:', fsError);
          this.saveToLocalStorage();
          console.log(`植株 ${plantId} 状态已备份到localStorage`);
        }
      } else {
        // 如果文件系统不可用，保存到localStorage
        this.saveToLocalStorage();
        console.log(`植株 ${plantId} 状态 ${status} 已保存到localStorage`);
      }

      console.log(`[植物状态] ${plantId}: ${status} (独立保存完成)`);

    } catch (error) {
      console.error(`保存植株 ${plantId} 状态失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 FIX: Load plant status independently for status restoration
   */
  async loadPlantStatus(plantId) {
    try {
      console.log(`[状态加载] 开始为植物 ${plantId} 加载状态...`);
      console.log(`[状态加载] useFileSystem: ${this.useFileSystem}, fileSystemManager存在: ${!!this.fileSystemManager}`);
      
      // First check if we have status in memory
      const existingData = this.annotations.get(plantId);
      if (existingData && existingData.status) {
        console.log(`[植物状态] ${plantId}: 从内存加载状态 ${existingData.status}`);
        return existingData.status;
      }

      // 🔧 FIX: Try to load from dedicated plant status API first
      if (this.useFileSystem && this.fileSystemManager.getPlantStatus) {
        try {
          console.log(`[状态加载] 尝试从专用API加载植物 ${plantId} 状态...`);
          const statusData = await this.fileSystemManager.getPlantStatus(plantId);
          console.log(`[状态加载] 专用API响应:`, statusData);
          if (statusData && statusData.status) {
            console.log(`[植物状态] ${plantId}: 从专用API加载状态 ${statusData.status}`);
            return statusData.status;
          }
        } catch (apiError) {
          console.warn(`从专用API加载植株 ${plantId} 状态失败:`, apiError);
        }
      } else {
        console.log(`[状态加载] 跳过专用API: useFileSystem=${this.useFileSystem}, getPlantStatus存在=${!!this.fileSystemManager?.getPlantStatus}`);
      }

      // Fallback: Try to load from skip-info API for backwards compatibility
      if (this.useFileSystem && this.fileSystemManager.getSkipInfo) {
        try {
          const data = await this.fileSystemManager.getSkipInfo(plantId);
          if (data && data.status) {
            console.log(`[植物状态] ${plantId}: 从skip-info API加载状态 ${data.status} (向后兼容)`);
            return data.status;
          }
        } catch (skipError) {
          console.warn(`从skip-info API加载植株 ${plantId} 状态失败:`, skipError);
        }
      } else if (this.fileSystemManager && this.fileSystemManager.getAnnotationsDirectory()) {
        try {
          // 文件系统模式：尝试加载状态文件
          const fileName = `${plantId}_status.json`;
          const annotationsHandle = this.fileSystemManager.getAnnotationsDirectory();
          const fileHandle = await annotationsHandle.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          const content = await file.text();
          const statusData = JSON.parse(content);
          
          if (statusData.status) {
            console.log(`[植物状态] ${plantId}: 从文件系统加载状态 ${statusData.status}`);
            return statusData.status;
          }
        } catch (fsError) {
          // Status file doesn't exist, this is normal for pending plants
          console.log(`[植物状态] ${plantId}: 无状态文件，使用默认状态`);
        }
      }

      // Fallback to localStorage
      try {
        const localData = localStorage.getItem('plantAnnotations');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed[plantId] && parsed[plantId].status) {
            console.log(`[植物状态] ${plantId}: 从localStorage加载状态 ${parsed[plantId].status}`);
            return parsed[plantId].status;
          }
        }
      } catch (localError) {
        console.warn('从localStorage加载状态失败:', localError);
      }

      // Return null if no status found (let calling code decide default)
      console.log(`[植物状态] ${plantId}: 未找到持久化状态`);
      return null;

    } catch (error) {
      console.error(`加载植株 ${plantId} 状态失败:`, error);
      return null;
    }
  }

  /**
   * 检查植物是否有标注数据
   */
  hasAnnotations(plantId) {
    const data = this.annotations.get(plantId);
    return data && data.annotations.length > 0;
  }

  /**
   * 删除植物标注数据
   */
  async deletePlantAnnotations(plantId) {
    this.annotations.delete(plantId);
    await this.saveAnnotationsToServer();
  }

  /**
   * 获取标注进度统计
   */
  getAnnotationStats(totalPlants) {
    const annotatedCount = this.getAnnotatedPlantIds().length;
    const completedCount = Array.from(this.annotations.values())
      .filter(data => data.annotations.length > 0).length;

    return {
      total: totalPlants,
      annotated: annotatedCount,
      completed: completedCount,
      pending: totalPlants - annotatedCount,
      completionRate: totalPlants > 0 ? (completedCount / totalPlants * 100).toFixed(1) : 0
    };
  }

  /**
   * 导出所有标注数据
   */
  exportAllAnnotations() {
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      totalPlants: this.annotations.size,
      annotations: {}
    };

    for (const [plantId, annotationData] of this.annotations) {
      exportData.annotations[plantId] = {
        ...annotationData,
        exportedAt: new Date().toISOString()
      };
    }

    return exportData;
  }

  /**
   * 导出为JSON文件下载
   */
  downloadAnnotationsAsJSON() {
    const exportData = this.exportAllAnnotations();
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plant_annotations_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    return exportData;
  }

  /**
   * 导出所有图像的纯净标注数据（新的简化版本）
   * 返回格式：{ imageId: annotations[] }
   */
  async exportPureImageAnnotations() {
    const pureImageAnnotations = {};
    
    // 直接从imageAnnotations导出
    for (const [imageId, annotationData] of this.imageAnnotations) {
      if (annotationData.annotations && annotationData.annotations.length > 0) {
        pureImageAnnotations[imageId] = annotationData.annotations.map(annotation => ({
          id: annotation.id,
          x: annotation.x,
          y: annotation.y,
          timestamp: annotation.timestamp,
          direction: annotation.direction || 'right', // 包含新的方向信息
          order: annotation.order || 0 // 包含序号信息，兼容旧数据
        }));
      }
    }
    
    console.log(`导出 ${Object.keys(pureImageAnnotations).length} 张图像的纯净标注数据`);
    return pureImageAnnotations;
  }

  /**
   * 下载纯净的图像标注数据为JSON文件
   */
  async downloadPureImageAnnotationsAsJSON() {
    const pureAnnotations = await this.exportPureImageAnnotations();
    const stats = this.getPureAnnotationsStats(pureAnnotations);
    
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '2.0',
      format: 'pure_image_annotations',
      description: '每张图像对应的标注点数据，不包含内部管理信息',
      stats: {
        totalImages: stats.totalImages,
        annotatedImages: stats.annotatedImages,
        totalKeypoints: stats.totalKeypoints,
        completionRate: stats.completionRate
      },
      annotations: pureAnnotations
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pure_image_annotations_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log(`导出了 ${stats.annotatedImages} 张图像的纯净标注数据，共 ${stats.totalKeypoints} 个关键点`);
    
    return exportData;
  }

  /**
   * 获取纯净标注数据的统计信息
   */
  getPureAnnotationsStats(pureAnnotations) {
    const totalImages = Object.keys(pureAnnotations).length;
    let totalKeypoints = 0;
    
    for (const annotations of Object.values(pureAnnotations)) {
      totalKeypoints += annotations.length;
    }
    
    return {
      totalImages,
      annotatedImages: totalImages,
      totalKeypoints,
      averageKeypointsPerImage: totalImages > 0 ? (totalKeypoints / totalImages).toFixed(2) : 0,
      completionRate: '100.0' // 只包含有标注的图像
    };
  }

  /**
   * 设置时间序列管理器的引用
   */
  setTimeSeriesManager(timeSeriesManager) {
    this.timeSeriesManager = timeSeriesManager;
  }

  /**
   * 清理所有标注数据
   */
  async clearAllAnnotations() {
    this.annotations.clear();
    await this.saveAnnotationsToServer();
  }

  /**
   * 获取所有标注数据的摘要
   */
  getSummary() {
    const summary = {
      totalAnnotations: this.annotations.size,
      completedPlants: 0,
      totalKeypoints: 0,
      lastModified: null
    };

    for (const [plantId, data] of this.annotations) {
      if (data.annotations.length > 0) {
        summary.completedPlants++;
        summary.totalKeypoints += data.annotations.length;
        
        if (!summary.lastModified || data.lastModified > summary.lastModified) {
          summary.lastModified = data.lastModified;
        }
      }
    }

    return summary;
  }

  /**
   * 恢复时间序列数据到管理器
   */
  restoreTimeSeriesData(timeSeriesManager) {
    for (const [plantId, data] of this.annotations) {
      if (data.isTimeSeriesEnabled && data.timeSeriesData) {
        try {
          // 恢复时间序列标注数据
          this.restorePlantTimeSeriesData(timeSeriesManager, plantId, data);
          console.log(`恢复植株 ${plantId} 的时间序列数据`);
        } catch (error) {
          console.error(`恢复植株 ${plantId} 时间序列数据失败:`, error);
        }
      }
    }
  }

  /**
   * 恢复单个植株的时间序列数据
   */
  restorePlantTimeSeriesData(timeSeriesManager, plantId, annotationData) {
    const { timeSeriesData, viewAngle } = annotationData;
    
    if (!timeSeriesData || !viewAngle) return;
    
    // 恢复时间序列结构
    if (!timeSeriesManager.timeSequences.has(plantId)) {
      timeSeriesManager.timeSequences.set(plantId, new Map());
    }
    
    if (!timeSeriesManager.timeSeriesAnnotations.has(plantId)) {
      timeSeriesManager.timeSeriesAnnotations.set(plantId, new Map());
    }
    
    // 恢复时间序列
    const imageIds = timeSeriesData.annotationData.map(item => item.imageId);
    timeSeriesManager.timeSequences.get(plantId).set(viewAngle, imageIds);
    
    // 恢复标注数据
    const viewAnnotations = new Map();
    for (const item of timeSeriesData.annotationData) {
      viewAnnotations.set(item.imageId, {
        annotations: item.annotations,
        timestamp: item.metadata.timestamp,
        isManualAdjustment: item.metadata.isManualAdjustment,
        inheritedFrom: item.metadata.inheritedFrom
      });
    }
    
    timeSeriesManager.timeSeriesAnnotations.get(plantId).set(viewAngle, viewAnnotations);
    
    // 恢复手动调整记录
    const adjustmentKey = `${plantId}_${viewAngle}`;
    if (!timeSeriesManager.manualAdjustments.has(adjustmentKey)) {
      timeSeriesManager.manualAdjustments.set(adjustmentKey, new Set());
    }
    
    const manualAdjustments = timeSeriesManager.manualAdjustments.get(adjustmentKey);
    for (const item of timeSeriesData.annotationData) {
      if (item.metadata.isManualAdjustment) {
        manualAdjustments.add(item.imageId);
      }
    }
  }

  /**
   * 获取植株的视角选择历史
   */
  getPlantViewAngleHistory(plantId) {
    const data = this.annotations.get(plantId);
    return data?.selectedViewAngleHistory || {};
  }

  /**
   * 获取植株的完整标注摘要
   */
  getPlantAnnotationSummary(plantId) {
    const data = this.annotations.get(plantId);
    if (!data) return null;

    const summary = {
      plantId,
      status: data.status,
      lastModified: data.lastModified,
      selectedViewAngle: data.viewAngle,
      availableViewAngles: data.plantViewAngles || [],
      isTimeSeriesEnabled: data.isTimeSeriesEnabled,
      currentImageInfo: {
        imageName: data.selectedImage,
        imageId: data.selectedImagePath,
        dateTime: data.imageDateTime
      }
    };

    // 如果有时间序列数据，添加统计信息
    if (data.timeSeriesData) {
      summary.timeSeriesStats = {
        totalImages: data.timeSeriesData.totalImages,
        annotatedImages: data.timeSeriesData.annotationData.length,
        manualAdjustments: data.timeSeriesData.annotationData.filter(
          item => item.metadata.isManualAdjustment
        ).length
      };
    }

    return summary;
  }

  /**
   * 保存图像标注数据
   */
  async saveImageAnnotation(imageId, annotationData) {
    // 优先使用文件系统保存
    if (this.useFileSystem) {
      try {
        const success = await this.saveImageAnnotationToFileSystem(imageId, annotationData);
        if (success) {
          console.log(`成功保存图像 ${imageId} 的标注数据到文件系统`);
          // 只在文件系统保存成功时才更新内存（用于统计等功能）
          this.imageAnnotations.set(imageId, annotationData);
          // 备份到localStorage
          this.saveImageAnnotationsToLocalStorage();
          return true;
        }
      } catch (error) {
        console.error(`保存图像 ${imageId} 标注数据到文件系统失败:`, error);
      }
    } else {
      // 如果没有启用文件系统，更新内存
      this.imageAnnotations.set(imageId, annotationData);
    }

    // 如果文件系统保存失败或未启用，尝试保存到服务器
    try {
      const response = await fetch(`${this.apiBaseUrl}/save-image-annotation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
          annotationData
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`成功保存图像 ${imageId} 的标注数据到服务器`);
        // 备份到localStorage
        this.saveImageAnnotationsToLocalStorage();
        return true;
      } else {
        throw new Error(result.error || '服务器保存失败');
      }
    } catch (error) {
      console.error(`保存图像 ${imageId} 标注数据到服务器失败:`, error);
      // 如果无法保存到服务器，至少保存到localStorage作为备份
      this.saveImageAnnotationsToLocalStorage();
      return false;
    }
  }

  /**
   * 获取图像标注数据
   */
  async getImageAnnotation(imageId) {
    // 如果启用了文件系统，直接从文件系统读取
    if (this.useFileSystem && this.fileSystemManager) {
      try {
        const annotationData = await this.fileSystemManager.loadAnnotationFile(imageId);
        if (annotationData) {
          console.log(`[标注] 读取成功 ${imageId}: ${annotationData.annotations?.length || 0} 个标注点`);
        }
        return annotationData;
      } catch (error) {
        console.warn(`从文件系统加载标注失败 (${imageId}):`, error);
        return null;
      }
    }

    // 如果没有启用文件系统，从内存中获取（向后兼容）
    return this.imageAnnotations.get(imageId) || null;
  }

  /**
   * 从服务器加载图像标注数据
   */
  async loadImageAnnotationsFromServer() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/load-image-annotations`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // 将数据加载到Map中
        for (const [imageId, annotationData] of Object.entries(result.data.imageAnnotations || {})) {
          this.imageAnnotations.set(imageId, annotationData);
        }
        
        console.log(`从服务器加载了 ${this.imageAnnotations.size} 张图像的标注数据`);
        return result.data;
      } else {
        console.log('服务器没有图像标注数据或加载失败');
        return { imageAnnotations: {} };
      }
    } catch (error) {
      console.warn('从服务器加载图像标注数据失败，尝试从localStorage恢复:', error.message);
      this.loadImageAnnotationsFromLocalStorage();
      return { imageAnnotations: {} };
    }
  }

  /**
   * 保存图像标注到localStorage作为备份
   */
  saveImageAnnotationsToLocalStorage() {
    try {
      const data = {};
      for (const [imageId, annotationData] of this.imageAnnotations) {
        data[imageId] = annotationData;
      }
      localStorage.setItem('image_annotations_backup', JSON.stringify({
        saveTime: new Date().toISOString(),
        imageAnnotations: data
      }));
      console.log('图像标注数据已备份到localStorage');
    } catch (error) {
      console.error('备份图像标注到localStorage失败:', error);
    }
  }

  /**
   * 从localStorage恢复图像标注数据
   */
  loadImageAnnotationsFromLocalStorage() {
    try {
      const backup = localStorage.getItem('image_annotations_backup');
      if (backup) {
        const data = JSON.parse(backup);
        for (const [imageId, annotationData] of Object.entries(data.imageAnnotations || {})) {
          if (!this.imageAnnotations.has(imageId)) {
            this.imageAnnotations.set(imageId, annotationData);
          }
        }
        console.log('从localStorage恢复了图像标注备份数据');
      }
    } catch (error) {
      console.error('从localStorage恢复图像标注数据失败:', error);
    }
  }

  /**
   * 导出所有图像标注数据（新的简化版本）
   */
  exportAllImageAnnotations() {
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '2.0',
      format: 'simple_image_annotations',
      totalImages: this.imageAnnotations.size,
      annotations: {}
    };

    for (const [imageId, annotationData] of this.imageAnnotations) {
      if (annotationData.annotations && annotationData.annotations.length > 0) {
        exportData.annotations[imageId] = annotationData.annotations;
      }
    }

    return exportData;
  }

  /**
   * 获取所有有标注的图像统计
   */
  getImageAnnotationStats() {
    let annotatedImages = 0;
    let totalKeypoints = 0;

    for (const [imageId, annotationData] of this.imageAnnotations) {
      if (annotationData.annotations && annotationData.annotations.length > 0) {
        annotatedImages++;
        totalKeypoints += annotationData.annotations.length;
      }
    }

    return {
      totalImages: this.imageAnnotations.size,
      annotatedImages,
      totalKeypoints,
      averageKeypointsPerImage: annotatedImages > 0 ? (totalKeypoints / annotatedImages).toFixed(2) : 0
    };
  }

  /**
   * 从文件系统加载所有标注数据
   */
  async loadAnnotationsFromFileSystem() {
    if (!this.fileSystemManager) {
      throw new Error('文件系统管理器未设置');
    }

    console.log('开始从文件系统加载标注数据...');

    try {
      const imageIds = await this.fileSystemManager.getAllAnnotationFiles();
      console.log(`发现 ${imageIds.length} 个标注文件:`, imageIds);

      let loadedCount = 0;
      for (const imageId of imageIds) {
        try {
          const annotationData = await this.fileSystemManager.loadAnnotationFile(imageId);
          if (annotationData) {
            this.imageAnnotations.set(imageId, annotationData);
            loadedCount++;
            console.log(`成功加载标注文件: ${imageId}, 包含 ${annotationData.annotations?.length || 0} 个标注点`);
          }
        } catch (error) {
          console.error(`加载标注文件失败 (${imageId}):`, error);
        }
      }

      console.log(`从文件系统加载了 ${loadedCount} 个图像的标注数据，总计 ${this.imageAnnotations.size} 个图像在内存中`);
    } catch (error) {
      console.error('从文件系统加载标注数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存图像标注到文件系统
   */
  async saveImageAnnotationToFileSystem(imageId, annotationData) {
    if (!this.fileSystemManager) {
      console.warn('文件系统管理器未设置，跳过文件系统保存');
      return false;
    }

    try {
      await this.fileSystemManager.saveAnnotationFile(imageId, annotationData);
      return true;
    } catch (error) {
      console.error(`保存标注到文件系统失败 (${imageId}):`, error);
      return false;
    }
  }

  /**
   * 从文件系统删除图像标注
   */
  async deleteImageAnnotationFromFileSystem(imageId) {
    if (!this.fileSystemManager) {
      return false;
    }

    try {
      return await this.fileSystemManager.deleteAnnotationFile(imageId);
    } catch (error) {
      console.error(`从文件系统删除标注失败 (${imageId}):`, error);
      return false;
    }
  }

  /**
   * 扫描标注文件（用于统计，不加载到内存）
   */
  async scanAnnotationFiles() {
    if (!this.fileSystemManager) {
      return;
    }

    try {
      const imageIds = await this.fileSystemManager.getAllAnnotationFiles();
      // 这里只是为了触发扫描和日志输出，不实际加载到内存
      console.log(`[标注] 扫描完成，发现 ${imageIds.length} 个标注文件`);

      // 扫描跳过信息文件
      await this.scanSkipInfoFiles();
    } catch (error) {
      console.error('[标注] 扫描标注文件失败:', error);
    }
  }

  /**
   * 扫描跳过信息文件
   */
  async scanSkipInfoFiles() {
    if (!this.fileSystemManager) {
      return;
    }

    try {
      if (this.useFileSystem && this.fileSystemManager.getAllSkipInfo) {
        // HTTP模式：通过API获取跳过信息
        const skipInfoData = await this.fileSystemManager.getAllSkipInfo();
        
        let skipFileCount = 0;
        for (const [plantId, skipData] of Object.entries(skipInfoData)) {
          this.annotations.set(plantId, skipData);
          skipFileCount++;
          console.log(`[标注] 加载跳过信息: ${plantId} - ${skipData.skipReason}`);
        }
        
        if (skipFileCount > 0) {
          console.log(`[标注] 成功加载 ${skipFileCount} 个植株的跳过信息`);
        }
      } else {
        // 原有的文件系统模式
        const annotationsHandle = this.fileSystemManager.getAnnotationsDirectory();
        if (!annotationsHandle) {
          return;
        }

        let skipFileCount = 0;
        for await (const [name, handle] of annotationsHandle.entries()) {
          if (handle.kind === 'file' && name.endsWith('_skip_info.json')) {
            try {
              const file = await handle.getFile();
              const content = await file.text();
              const skipData = JSON.parse(content);

              // 将跳过信息加载到内存
              this.annotations.set(skipData.plantId, skipData);
              skipFileCount++;

              console.log(`[标注] 加载跳过信息: ${skipData.plantId} - ${skipData.skipReason}`);
            } catch (error) {
              console.warn(`[标注] 加载跳过信息文件失败 (${name}):`, error);
            }
          }
        }

        if (skipFileCount > 0) {
          console.log(`[标注] 成功加载 ${skipFileCount} 个植株的跳过信息`);
        }
      }
    } catch (error) {
      console.error('[标注] 扫描跳过信息文件失败:', error);
    }
  }
}