/**
 * 植物数据管理器
 * 
 * 功能：
 * - 植物数据的加载和解析
 * - 图像时间排序和管理
 * - 标注状态跟踪
 * - 数据缓存和性能优化
 */

import { HttpFileSystemManager } from './HttpFileSystemManager.js';
import { AnnotationStorageManager } from './AnnotationStorageManager.js';
import { TimeSeriesAnnotationManager } from './TimeSeriesAnnotationManager.js';

export class PlantDataManager {
  constructor() {
    this.fileSystemManager = new HttpFileSystemManager();
    this.annotationStorage = new AnnotationStorageManager();
    this.timeSeriesManager = new TimeSeriesAnnotationManager();
    this.plants = new Map();
    this.plantImages = new Map();
    this.annotationStatus = new Map();
    this.loadingPlants = new Set();
  }

  /**
   * 初始化数据管理器
   */
  async initialize() {
    try {
      // 初始化HTTP文件系统管理器
      await this.fileSystemManager.initialize();
      
      await this.annotationStorage.initialize();
      
      // 恢复时间序列数据到管理器
      this.annotationStorage.restoreTimeSeriesData(this.timeSeriesManager);
      
      // 设置时间序列管理器的引用到存储管理器
      this.annotationStorage.setTimeSeriesManager(this.timeSeriesManager);
      
      console.log('PlantDataManager 初始化完成');
    } catch (error) {
      console.error('PlantDataManager 初始化失败:', error);
    }
  }

  /**
   * 加载数据集中的所有植物
   */
  async loadDataset() {
    console.log('开始加载数据集...');

    try {
      // 注意：不要在这里cleanup，因为会清除annotations目录句柄
      // 只清理植物相关数据
      this.plants.clear();
      this.plantImages.clear();
      this.annotationStatus.clear();
      this.loadingPlants.clear();

      // 设置文件系统管理器到标注存储
      this.annotationStorage.setFileSystemManager(this.fileSystemManager);

      // 重新初始化标注存储以使用文件系统
      this.annotationStorage.isInitialized = false;
      await this.annotationStorage.initialize();

      // 初始化时间序列相关功能
      this.annotationStorage.restoreTimeSeriesData(this.timeSeriesManager);
      this.annotationStorage.setTimeSeriesManager(this.timeSeriesManager);
      
      // 遍历植物文件夹（不再需要传入datasetHandle）
      const plantFolders = await this.fileSystemManager.traversePlantDirectories();
      
      if (plantFolders.length === 0) {
        throw new Error('数据集中未找到有效的植物文件夹');
      }
      
      // 批量加载植物基本信息
      const plants = [];
      for (const plantFolder of plantFolders) {
        const plant = await this.createPlantData(plantFolder);
        plants.push(plant);
        this.plants.set(plant.id, plant);
      }
      
      // 从持久化存储恢复标注状态
      await this.restoreAnnotationStatus(plants);
      
      // 按植物ID排序
      plants.sort((a, b) => a.id.localeCompare(b.id));
      
      console.log(`成功加载 ${plants.length} 个植物`);
      return plants;
      
    } catch (error) {
      console.error('加载数据集失败:', error);
      throw error;
    }
  }

  /**
   * 恢复植物的标注状态
   */
  async restoreAnnotationStatus(plants) {
    if (this.annotationStorage.useFileSystem) {
      // 文件系统模式：检查每个植物的标注文件
      await this.restoreAnnotationStatusFromFileSystem(plants);
    } else {
      // 服务器模式：使用原有逻辑
      const annotatedPlantIds = this.annotationStorage.getAnnotatedPlantIds();

      for (const plant of plants) {
        if (annotatedPlantIds.includes(plant.id)) {
          const status = this.annotationStorage.getPlantStatus(plant.id);
          const annotations = this.annotationStorage.getPlantAnnotations(plant.id);
          const summary = this.annotationStorage.getPlantAnnotationSummary(plant.id);

          plant.status = status;
          plant.annotations = annotations;

          // 恢复跳过信息
          const annotationData = this.annotationStorage.annotations.get(plant.id);
          if (annotationData && annotationData.status === 'skipped') {
            plant.skipReason = annotationData.skipReason;
            plant.skipDate = annotationData.skipDate;
          }

          // 恢复视角选择信息
          if (summary) {
            plant.selectedViewAngle = summary.selectedViewAngle;
            plant.viewAngles = summary.availableViewAngles;

            const skipInfo = plant.status === 'skipped' ? ` (跳过: ${plant.skipReason})` : '';
            console.log(`恢复植株 ${plant.id} 的标注状态: ${status}, 视角: ${summary.selectedViewAngle}, ${annotations.length} 个标注点${skipInfo}`);
          }

          // 缓存到内存
          this.annotationStatus.set(plant.id, annotations);
        }
      }
    }
  }

  /**
   * 从文件系统恢复植物标注状态（批量优化版）
   */
  async restoreAnnotationStatusFromFileSystem(plants) {
    console.log('[标注] 开始从文件系统恢复植物状态...');

    // 🚀 PERFORMANCE OPTIMIZATION: Try bulk loading first
    let bulkAnnotationData = null;
    try {
      // Try to get bulk annotation data if AnnotationManager is available
      if (window.PlantAnnotationTool?.annotationManager) {
        console.log('[标注] 尝试使用批量标注数据进行快速状态恢复...');
        bulkAnnotationData = await window.PlantAnnotationTool.annotationManager.getAllAnnotationsInBulk();
        
        if (bulkAnnotationData) {
          console.log('[标注] 批量标注数据获取成功，使用高性能模式');
          await this.restoreStatusFromBulkData(plants, bulkAnnotationData);
          return; // Skip individual file reads completely
        }
      }
    } catch (error) {
      console.warn('[标注] 批量加载失败，回退到单独文件读取模式:', error);
    }

    // 🔄 FALLBACK: Individual file reading (legacy mode)
    console.log('[标注] 使用传统单独文件读取模式');
    await this.restoreStatusFromIndividualFiles(plants);
  }

  /**
   * 从批量数据恢复植物状态（高性能模式）
   */
  async restoreStatusFromBulkData(plants, bulkData) {
    console.log('[标注] 使用批量数据进行快速状态恢复...');
    const startTime = performance.now();
    
    // Create lookup maps for fast access
    const imageAnnotationsMap = bulkData.imageAnnotations || {};
    const plantAnnotationsMap = bulkData.plantAnnotations || {};
    
    for (const plant of plants) {
      try {
        let hasAnnotations = false;
        let totalAnnotations = 0;
        let selectedViewAngle = null;
        const viewAngleStats = {};

        // 获取植物的所有图像（如果还没有加载）
        if (!this.plantImages.has(plant.id)) {
          const imagesByView = await this.fileSystemManager.readPlantImages(plant.id);
          this.plantImages.set(plant.id, imagesByView);
        }

        const imagesByView = this.plantImages.get(plant.id);

        // 检查每个视角的标注情况 - 使用内存查找而非文件读取
        for (const [viewAngle, images] of Object.entries(imagesByView)) {
          let viewAnnotationCount = 0;

          for (const image of images) {
            // 🚀 FAST LOOKUP: Use in-memory data instead of file reads
            const imageAnnotations = imageAnnotationsMap[image.id];
            if (imageAnnotations && imageAnnotations.length > 0) {
              hasAnnotations = true;
              const count = imageAnnotations.length;
              totalAnnotations += count;
              viewAnnotationCount += count;

              // 记录最常用的视角作为选中视角
              if (!selectedViewAngle || viewAnnotationCount > (viewAngleStats[selectedViewAngle] || 0)) {
                selectedViewAngle = viewAngle;
              }
            }
          }

          if (viewAnnotationCount > 0) {
            viewAngleStats[viewAngle] = viewAnnotationCount;
          }
        }

        // 检查植物级标注
        const plantAnnotations = plantAnnotationsMap[plant.id];
        if (plantAnnotations && plantAnnotations.length > 0) {
          hasAnnotations = true;
          totalAnnotations += plantAnnotations.length;
        }

        // 检查是否有跳过信息
        const skipData = this.annotationStorage.annotations.get(plant.id);
        if (skipData && skipData.status === 'skipped') {
          // 恢复跳过状态
          plant.status = 'skipped';
          plant.skipReason = skipData.skipReason;
          plant.skipDate = skipData.skipDate;
        } else {
          // 🔧 FIX: Check for persisted completion status from dedicated API in bulk mode too
          console.log(`[批量恢复] 检查植物 ${plant.id} 的专用状态API...`);
          const persistedStatus = await this.annotationStorage.loadPlantStatus(plant.id);
          console.log(`[批量恢复] 植物 ${plant.id} 专用API状态: ${persistedStatus}`);
          
          if (persistedStatus === 'completed') {
            // 保持已完成状态，即使没有标注数据  
            plant.status = 'completed';
            plant.selectedViewAngle = selectedViewAngle;
            console.log(`[批量恢复] 植物 ${plant.id}: completed (从专用API恢复)`);
          } else if (hasAnnotations) {
            // 🔧 FIX: Plants with annotations are 'in-progress', not auto-completed
            plant.status = 'in-progress';
            plant.selectedViewAngle = selectedViewAngle;
            console.log(`[批量恢复] 植物 ${plant.id}: in-progress (有标注数据)`);
          } else {
            // 无标注数据且无持久化状态
            plant.status = 'pending';
            console.log(`[批量恢复] 植物 ${plant.id}: pending (无数据)`);
          }
        }

      } catch (error) {
        console.warn(`[标注] 检查植物 ${plant.id} 状态失败:`, error);
        plant.status = 'pending';
      }
    }

    const endTime = performance.now();
    console.log(`[标注] 批量状态恢复完成，耗时: ${(endTime - startTime).toFixed(2)}ms`);
  }

  /**
   * 从单独文件恢复植物状态（传统模式）
   */
  async restoreStatusFromIndividualFiles(plants) {
    console.log('[标注] 使用传统文件读取模式恢复状态...');

    // 获取所有标注文件列表（一次性获取）
    const allAnnotationFiles = await this.annotationStorage.fileSystemManager.getAllAnnotationFiles();
    const annotationFileSet = new Set(allAnnotationFiles);

    for (const plant of plants) {
      try {
        let hasAnnotations = false;
        let totalAnnotations = 0;
        let selectedViewAngle = null;
        const viewAngleStats = {};

        // 获取植物的所有图像（如果还没有加载）
        if (!this.plantImages.has(plant.id)) {
          const imagesByView = await this.fileSystemManager.readPlantImages(plant.id);
          this.plantImages.set(plant.id, imagesByView);
        }

        const imagesByView = this.plantImages.get(plant.id);

        // 检查每个视角的标注情况
        for (const [viewAngle, images] of Object.entries(imagesByView)) {
          let viewAnnotationCount = 0;

          for (const image of images) {
            // 快速检查：如果标注文件存在于列表中，才尝试读取
            if (annotationFileSet.has(image.id)) {
              const annotationData = await this.annotationStorage.getImageAnnotation(image.id);
              if (annotationData && annotationData.annotations && annotationData.annotations.length > 0) {
                hasAnnotations = true;
                const count = annotationData.annotations.length;
                totalAnnotations += count;
                viewAnnotationCount += count;

                // 记录最常用的视角作为选中视角
                if (!selectedViewAngle || viewAnnotationCount > (viewAngleStats[selectedViewAngle] || 0)) {
                  selectedViewAngle = viewAngle;
                }
              }
            }
          }

          if (viewAnnotationCount > 0) {
            viewAngleStats[viewAngle] = viewAnnotationCount;
          }
        }

        // 检查是否有跳过信息
        const skipData = this.annotationStorage.annotations.get(plant.id);
        if (skipData && skipData.status === 'skipped') {
          // 恢复跳过状态
          plant.status = 'skipped';
          plant.skipReason = skipData.skipReason;
          plant.skipDate = skipData.skipDate;
          console.log(`[标注] 植物 ${plant.id}: skipped (${skipData.skipReason})`);
        } else {
          // 🔧 FIX: Check for persisted completion status before applying default logic
          console.log(`[状态恢复] 开始检查植物 ${plant.id} 的持久化状态...`);
          const persistedStatus = await this.annotationStorage.loadPlantStatus(plant.id);
          console.log(`[状态恢复] 植物 ${plant.id} 持久化状态结果: ${persistedStatus}`);
          
          if (persistedStatus === 'completed') {
            // 保持已完成状态，即使没有标注数据
            plant.status = 'completed';
            plant.selectedViewAngle = selectedViewAngle;
            console.log(`[标注] 植物 ${plant.id}: completed (从持久化存储恢复)`);
          } else if (hasAnnotations) {
            // 🔧 FIX: Plants with annotations are 'in-progress', not auto-completed
            plant.status = 'in-progress';
            plant.selectedViewAngle = selectedViewAngle;
            console.log(`[标注] 植物 ${plant.id}: in-progress, 选中视角: ${selectedViewAngle} (${totalAnnotations} 个标注点)`);
          } else {
            // 无标注数据且无持久化状态
            plant.status = 'pending';
            console.log(`[标注] 植物 ${plant.id}: pending (无标注数据且无持久化状态)`);
          }
        }

      } catch (error) {
        console.warn(`[标注] 检查植物 ${plant.id} 状态失败:`, error);
        plant.status = 'pending';
      }
    }

    console.log('[标注] 植物状态恢复完成');
  }

  /**
   * 创建植物数据对象
   */
  async createPlantData(plantFolder) {
    const plant = {
      id: plantFolder.id,
      name: plantFolder.name,
      path: plantFolder.path, // HTTP版本使用path而不是handle
      status: 'pending', // pending, in-progress, completed
      imageCount: 0,
      hasImages: false,
      viewAngles: [], // 可用的视角列表
      selectedViewAngle: null, // 用户选择的视角
      selectedImage: null,
      annotations: [],
      lastModified: null,
      loadedAt: new Date().toISOString()
    };
    
    // 异步加载图像数量（不阻塞主流程）
    this.loadPlantImageCount(plant);
    
    return plant;
  }

  /**
   * 异步加载植物的图像数量
   */
  async loadPlantImageCount(plant) {
    if (this.loadingPlants.has(plant.id)) {
      return;
    }
    
    this.loadingPlants.add(plant.id);
    
    try {
      const imagesByView = await this.fileSystemManager.readPlantImages(plant.id);
      
      // 统计各视角的图像数量
      const viewAngles = Object.keys(imagesByView).filter(view => imagesByView[view].length > 0);
      const totalImages = Object.values(imagesByView).reduce((total, images) => total + images.length, 0);
      
      // 更新植物信息
      plant.viewAngles = viewAngles;
      plant.imageCount = totalImages;
      plant.hasImages = totalImages > 0;
      
      // 缓存图像数据
      if (totalImages > 0) {
        this.plantImages.set(plant.id, imagesByView);
      }
      
      console.log(`植物 ${plant.id} 包含 ${totalImages} 张图像，视角: ${viewAngles.join(', ')}`);
      
      // 触发UI更新事件
      this.emitPlantUpdated(plant);
      
    } catch (error) {
      console.error(`加载植物 ${plant.id} 图像信息失败:`, error);
      plant.hasImages = false;
      plant.imageCount = 0;
      plant.viewAngles = [];
    } finally {
      this.loadingPlants.delete(plant.id);
    }
  }

  /**
   * 获取植物列表
   */
  getPlantList() {
    return Array.from(this.plants.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * 根据ID获取植物
   */
  getPlant(plantId) {
    return this.plants.get(plantId);
  }

  /**
   * 获取植物的图像列表（指定视角）
   */
  async getPlantImages(plantId, viewAngle = null) {
    // 检查缓存
    if (this.plantImages.has(plantId)) {
      const imagesByView = this.plantImages.get(plantId);
      
      if (viewAngle) {
        return imagesByView[viewAngle] || [];
      } else {
        // 如果没有指定视角，返回所有视角的数据
        return imagesByView;
      }
    }
    
    // 如果正在加载，等待完成
    if (this.loadingPlants.has(plantId)) {
      return new Promise((resolve) => {
        const checkLoading = () => {
          if (!this.loadingPlants.has(plantId)) {
            const imagesByView = this.plantImages.get(plantId) || {};
            resolve(viewAngle ? (imagesByView[viewAngle] || []) : imagesByView);
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    }
    
    // 立即加载
    const plant = this.plants.get(plantId);
    if (!plant) {
      throw new Error(`植物 ${plantId} 不存在`);
    }
    
    try {
      const imagesByView = await this.fileSystemManager.readPlantImages(plant.id);
      this.plantImages.set(plantId, imagesByView);
      
      if (viewAngle) {
        return imagesByView[viewAngle] || [];
      } else {
        return imagesByView;
      }
    } catch (error) {
      console.error(`获取植物 ${plantId} 图像失败:`, error);
      return viewAngle ? [] : {};
    }
  }

  /**
   * 🔧 FIXED: 更新植物状态 - 始终保存状态到持久化存储
   */
  updatePlantStatus(plantId, status) {
    const plant = this.plants.get(plantId);
    if (plant) {
      plant.status = status;
      plant.lastModified = new Date().toISOString();

      // 🔧 FIX: Always save plant status to persistent storage, regardless of annotations
      if (this.annotationStorage) {
        // Use the new savePlantStatus method for independent status persistence
        this.annotationStorage.savePlantStatus(plantId, status)
          .then(() => {
            console.log(`[状态更新] ${plantId}: ${status} - 已保存到持久化存储`);
          })
          .catch(error => {
            console.error('保存植物状态失败:', error);
            // 备用方案：如果有标注数据，尝试传统的保存方法
            const annotations = this.getPlantAnnotations(plantId);
            if (annotations.length > 0) {
              const plantInfo = {
                selectedImage: plant.selectedImage,
                selectedViewAngle: plant.selectedViewAngle
              };
              return this.annotationStorage.savePlantAnnotations(plantId, annotations, plantInfo);
            }
          });
      }

      this.emitPlantUpdated(plant);
    }
  }

  /**
   * 跳过植株
   */
  async skipPlant(plantId, reason) {
    const plant = this.plants.get(plantId);
    if (!plant) {
      throw new Error(`植株 ${plantId} 不存在`);
    }

    // 更新植株状态
    plant.status = 'skipped';
    plant.skipReason = reason;
    plant.skipDate = new Date().toISOString();
    plant.lastModified = new Date().toISOString();

    // 保存跳过信息到持久化存储
    try {
      const skipInfo = {
        status: 'skipped',
        skipReason: reason,
        skipDate: plant.skipDate,
        lastModified: plant.lastModified
      };

      await this.annotationStorage.saveSkipInfo(plantId, skipInfo);
      console.log(`植株 ${plantId} 已标记为跳过: ${reason}`);

      this.emitPlantUpdated(plant);

    } catch (error) {
      console.error(`保存植株 ${plantId} 跳过信息失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 NEW: 撤销跳过植株
   */
  async unskipPlant(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant) {
      throw new Error(`植株 ${plantId} 不存在`);
    }

    if (plant.status !== 'skipped') {
      throw new Error(`植株 ${plantId} 当前状态不是跳过状态`);
    }

    try {
      // 确定新状态：如果有标注数据则为 in-progress，否则为 pending
      const annotations = await this.getPlantAnnotations(plantId);
      const newStatus = (annotations && annotations.length > 0) ? 'in-progress' : 'pending';

      // 更新植株状态
      plant.status = newStatus;
      plant.lastModified = new Date().toISOString();
      
      // 清除跳过相关信息
      delete plant.skipReason;
      delete plant.skipDate;

      // 移除持久化存储中的跳过信息
      await this.annotationStorage.removeSkipInfo(plantId);
      
      // 更新植株状态到持久化存储
      await this.annotationStorage.savePlantStatus(plantId, newStatus);

      console.log(`植株 ${plantId} 已撤销跳过状态，新状态: ${newStatus}`);
      this.emitPlantUpdated(plant);

    } catch (error) {
      console.error(`撤销植株 ${plantId} 跳过状态失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 NEW: 撤销完成植株
   */
  async uncompletePlant(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant) {
      throw new Error(`植株 ${plantId} 不存在`);
    }

    if (plant.status !== 'completed') {
      throw new Error(`植株 ${plantId} 当前状态不是已完成状态`);
    }

    try {
      // 确定新状态：如果有标注数据则为 in-progress，否则为 pending
      const annotations = await this.getPlantAnnotations(plantId);
      const newStatus = (annotations && annotations.length > 0) ? 'in-progress' : 'pending';

      // 更新植株状态
      plant.status = newStatus;
      plant.lastModified = new Date().toISOString();

      // 更新植株状态到持久化存储
      await this.annotationStorage.savePlantStatus(plantId, newStatus);

      console.log(`植株 ${plantId} 已撤销完成状态，新状态: ${newStatus}`);
      this.emitPlantUpdated(plant);

    } catch (error) {
      console.error(`撤销植株 ${plantId} 完成状态失败:`, error);
      throw error;
    }
  }

  /**
   * 设置植物的选中视角
   */
  setSelectedViewAngle(plantId, viewAngle) {
    const plant = this.plants.get(plantId);
    if (plant) {
      plant.selectedViewAngle = viewAngle;
      plant.selectedImage = null; // 重置选中的图像
      
      // 如果植物状态还是pending，更新为in-progress
      if (plant.status === 'pending') {
        this.updatePlantStatus(plantId, 'in-progress');
      }
      
      this.emitPlantUpdated(plant);
    }
  }

  /**
   * 设置植物的选中图像
   */
  setSelectedImage(plantId, imageData) {
    const plant = this.plants.get(plantId);
    if (plant) {
      plant.selectedImage = imageData;
      
      // 自动设置视角（如果还没有设置的话）
      if (!plant.selectedViewAngle && imageData.viewAngle) {
        plant.selectedViewAngle = imageData.viewAngle;
      }

      // 初始化时间序列（如果还没有初始化）
      if (plant.selectedViewAngle) {
        this.initializeTimeSeriesIfNeeded(plantId, plant.selectedViewAngle);
      }
      
      // 如果植物状态还是pending，更新为in-progress
      if (plant.status === 'pending') {
        this.updatePlantStatus(plantId, 'in-progress');
      }
      
      this.emitPlantUpdated(plant);
    }
  }

  /**
   * 初始化时间序列（如果需要）
   */
  async initializeTimeSeriesIfNeeded(plantId, viewAngle) {
    try {
      const images = await this.getPlantImages(plantId, viewAngle);
      if (images.length > 0) {
        const seriesInfo = this.timeSeriesManager.initializePlantTimeSeries(plantId, viewAngle, images);
        console.log(`初始化时间序列: ${seriesInfo.totalImages} 张图像`);
        return seriesInfo;
      }
    } catch (error) {
      console.error('初始化时间序列失败:', error);
    }
    return null;
  }

  /**
   * 获取植物的标注数据（新的简化方案）
   */
  async savePlantAnnotations(plantId, annotations, isManualAdjustment = false, options = {}) {
    const plant = this.plants.get(plantId);
    if (!plant) {
      throw new Error(`植株 ${plantId} 不存在`);
    }

    if (!plant.selectedImage || !plant.selectedViewAngle) {
      throw new Error('请先选择图像和视角');
    }

    const currentImageId = plant.selectedImage.id;
    const viewAngle = plant.selectedViewAngle;

    try {
      // 获取该视角的所有图像
      const images = await this.getPlantImages(plantId, viewAngle);
      const currentImageIndex = images.findIndex(img => img.id === currentImageId);
      
      if (currentImageIndex === -1) {
        throw new Error('当前图像不在图像列表中');
      }

      let savedCount = 0;
      
      if (isManualAdjustment) {
        // 仅保存当前图像
        await this.saveAnnotationToFile(plantId, currentImageId, annotations, options);
        savedCount = 1;
        console.log(`保存标注到当前图像: ${currentImageId}`);
      } else {
        // 向后传播：保存到当前图像及后续所有图像
        for (let i = currentImageIndex; i < images.length; i++) {
          const imageId = images[i].id;
          await this.saveAnnotationToFile(plantId, imageId, annotations, options);
          savedCount++;
        }
        console.log(`向后传播保存标注到 ${savedCount} 张图像`);
      }

      // 🔧 FIX: Update plant status - only set to in-progress when saving annotations
      // Completion status should only be set explicitly via Complete Plant button
      plant.annotations = annotations;
      plant.lastModified = new Date().toISOString();
      plant.status = annotations.length > 0 ? 'in-progress' : 'pending';

      // 更新内存缓存
      this.annotationStatus.set(plantId, annotations);

      // 触发UI更新
      this.emitPlantUpdated(plant);

      const directionInfo = options.saveDirectionsOnly ? ' (仅方向信息)' : '';
      const message = isManualAdjustment ? 
        `已保存到当前图像${directionInfo}` : 
        `已传播保存到 ${savedCount} 张图像${directionInfo}`;

      return {
        success: true,
        savedCount,
        message,
        viewAngle: viewAngle,
        isManualAdjustment,
        saveDirectionsOnly: options.saveDirectionsOnly
      };
      
    } catch (error) {
      console.error(`保存植株 ${plantId} 标注数据失败:`, error);
      throw error;
    }
  }

  /**
   * 保存标注数据到特定图像文件
   */
  async saveAnnotationToFile(plantId, imageId, annotations, options = {}) {
    let finalAnnotations = annotations;
    
    // 如果只保存方向信息，需要合并现有的位置信息
    if (options.saveDirectionsOnly) {
      const existingData = await this.annotationStorage.getImageAnnotation(imageId);
      if (existingData && existingData.annotations) {
        finalAnnotations = this.mergeDirectionData(existingData.annotations, annotations);
      }
    }
    
    // 为每个图像创建独立的标注文件
    const annotationData = {
      plantId,
      imageId,
      annotations: finalAnnotations,
      timestamp: new Date().toISOString(),
      version: '2.0' // 新版本标记
    };

    // 保存到持久化存储
    await this.annotationStorage.saveImageAnnotation(imageId, annotationData);
  }

  /**
   * 合并方向数据（仅更新方向信息，保持位置不变）
   */
  mergeDirectionData(existingAnnotations, newAnnotations) {
    const merged = [...existingAnnotations];
    
    // 为每个新标注点的方向信息更新对应的现有标注点
    newAnnotations.forEach(newAnnotation => {
      const existingIndex = merged.findIndex(existing => existing.order === newAnnotation.order);
      
      if (existingIndex !== -1) {
        // 只更新方向相关信息，保持位置不变
        merged[existingIndex] = {
          ...merged[existingIndex],
          direction: newAnnotation.direction,
          directionType: newAnnotation.directionType,
          timestamp: new Date().toISOString()
        };
      } else {
        // 如果没有找到对应的标注点，添加新的
        merged.push(newAnnotation);
      }
    });
    
    return merged;
  }

  /**
   * 保存标注数据到指定图像（自动保存专用）
   */
  async saveImageAnnotations(imageId, annotations) {
    try {
      // 获取当前植株ID
      const currentPlantId = window.appState?.currentPlant?.id || this.getCurrentPlantIdFromImage(imageId);

      // 创建标注数据结构
      const annotationData = {
        imageId,
        plantId: currentPlantId,
        annotations,
        timestamp: new Date().toISOString(),
        version: '2.0'
      };

      // 保存到持久化存储
      await this.annotationStorage.saveImageAnnotation(imageId, annotationData);

      console.log(`自动保存完成：图像 ${imageId} (植株: ${currentPlantId}) 的 ${annotations.length} 个标注点`);

    } catch (error) {
      console.error('自动保存图像标注失败:', error);
      throw error;
    }
  }

  /**
   * 从图像ID推断植株ID
   */
  getCurrentPlantIdFromImage(imageId) {
    // 尝试从图像ID中提取植株ID
    // 图像ID格式通常是: BR017-028122_sv-000_BR017-028122-2018-07-04_00_VIS_sv_000-0-0-0.png
    // 植株ID通常是: BR017-028122

    if (imageId.includes('_')) {
      const parts = imageId.split('_');
      if (parts.length > 0) {
        // 取第一部分作为植株ID
        return parts[0];
      }
    }

    // 如果无法解析，尝试从文件名中提取
    if (imageId.includes('-')) {
      const parts = imageId.split('-');
      if (parts.length >= 2) {
        // 组合前两部分作为植株ID (如 BR017-028122)
        return `${parts[0]}-${parts[1]}`;
      }
    }

    // 最后的备选方案：返回原始imageId的前缀
    return imageId.split('.')[0].split('_')[0];
  }

  /**
   * 获取特定图像的标注数据
   */
  async getImageAnnotations(imageId) {
    try {
      const annotationData = await this.annotationStorage.getImageAnnotation(imageId);

      if (!annotationData || !annotationData.annotations) {
        return [];
      }

      const annotations = annotationData.annotations;

      // 为传统数据添加序号（兼容性处理）
      this.ensureAnnotationOrders(annotations);

      return annotations;
    } catch (error) {
      console.error('获取图像标注失败:', error);
      return [];
    }
  }

  /**
   * 获取植物的标注数据（简化版本）
   */
  getPlantAnnotations(plantId, imageId = null) {
    if (imageId) {
      // 直接从文件读取指定图像的标注
      return this.getImageAnnotations(imageId);
    }

    // 如果没有指定图像，返回植物的当前标注状态
    return this.annotationStatus.get(plantId) || [];
  }

  /**
   * 获取当前图像的标注元数据
   */
  getCurrentImageAnnotationMetadata(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant || !plant.selectedImage || !plant.selectedViewAngle) {
      return null;
    }

    return this.timeSeriesManager.getAnnotationMetadata(
      plantId,
      plant.selectedViewAngle,
      plant.selectedImage.id
    );
  }

  /**
   * 获取植株视角的时间序列统计
   */
  getPlantTimeSeriesStats(plantId, viewAngle) {
    return this.timeSeriesManager.getAnnotationStats(plantId, viewAngle);
  }

  /**
   * 检查是否为手动调整模式
   */
  shouldShowManualAdjustmentMode(plantId) {
    const metadata = this.getCurrentImageAnnotationMetadata(plantId);
    if (!metadata) return false;

    // 如果不是第一张图像，且已有标注，显示微调模式
    return !metadata.isFirstImage && metadata.hasAnnotations;
  }

  /**
   * 获取下一个未完成的植物
   */
  getNextPendingPlant(currentPlantId = null) {
    const plants = this.getPlantList();
    
    if (!currentPlantId) {
      // 返回第一个未完成的植物
      return plants.find(plant => plant.status !== 'completed');
    }
    
    // 找到当前植物的索引
    const currentIndex = plants.findIndex(plant => plant.id === currentPlantId);
    
    if (currentIndex === -1) {
      return plants.find(plant => plant.status !== 'completed');
    }
    
    // 从当前植物的下一个开始查找
    for (let i = currentIndex + 1; i < plants.length; i++) {
      if (plants[i].status !== 'completed') {
        return plants[i];
      }
    }
    
    // 如果没找到，从头开始查找
    for (let i = 0; i < currentIndex; i++) {
      if (plants[i].status !== 'completed') {
        return plants[i];
      }
    }
    
    return null; // 所有植物都已完成
  }

  /**
   * 获取详细的图片统计信息
   */
  getDetailedImageStats() {
    const plants = this.getPlantList();
    let totalImages = 0;
    let completedImages = 0;
    let totalPlants = plants.length;
    let completedPlants = 0;
    
    const plantStats = [];

    for (const plant of plants) {
      const plantImageCount = plant.imageCount || 0;
      totalImages += plantImageCount;
      
      const plantStat = {
        plantId: plant.id,
        imageCount: plantImageCount,
        status: plant.status,
        isCompleted: plant.status === 'completed'
      };
      
      if (plant.status === 'completed') {
        completedPlants++;
        completedImages += plantImageCount;
      }
      
      plantStats.push(plantStat);
    }

    const completionRate = totalImages > 0 ? (completedImages / totalImages * 100) : 0;
    const plantCompletionRate = totalPlants > 0 ? (completedPlants / totalPlants * 100) : 0;

    return {
      totalImages,
      completedImages,
      totalPlants,
      completedPlants,
      completionRate: completionRate.toFixed(1),
      plantCompletionRate: plantCompletionRate.toFixed(1),
      pendingImages: totalImages - completedImages,
      plantStats
    };
  }

  /**
   * 获取简化的图片统计信息
   */
  getImageStats() {
    const detailed = this.getDetailedImageStats();
    return {
      totalImages: detailed.totalImages,
      completedImages: detailed.completedImages,
      totalPlants: detailed.totalPlants,
      completedPlants: detailed.completedPlants,
      completionRate: detailed.completionRate
    };
  }

  /**
   * 获取进度统计
   */
  getProgress() {
    const plants = this.getPlantList();
    const total = plants.length;
    
    // 使用持久化存储的统计信息
    const persistentStats = this.annotationStorage.getAnnotationStats(total);
    
    // 结合内存中的状态
    const completed = plants.filter(plant => plant.status === 'completed').length;
    const inProgress = plants.filter(plant => plant.status === 'in-progress').length;
    const pending = plants.filter(plant => plant.status === 'pending').length;
    const skipped = plants.filter(plant => plant.status === 'skipped').length;

    // 计算总完成数（包括跳过的植株）
    const totalCompleted = completed + skipped;

    // 添加图片统计
    const imageStats = this.getImageStats();

    return {
      total,
      completed: Math.max(completed, persistentStats.completed),
      inProgress,
      pending,
      skipped,
      totalCompleted, // 新增：包含跳过的总完成数
      completionRate: total > 0 ? (Math.max(totalCompleted, persistentStats.completed + skipped) / total * 100).toFixed(1) : 0,
      persistent: persistentStats,
      images: imageStats
    };
  }

  /**
   * 搜索植物
   */
  searchPlants(query) {
    if (!query) {
      return this.getPlantList();
    }
    
    const lowerQuery = query.toLowerCase();
    return this.getPlantList().filter(plant => 
      plant.id.toLowerCase().includes(lowerQuery) ||
      plant.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 按状态过滤植物
   */
  filterPlantsByStatus(status) {
    if (status === 'all') {
      return this.getPlantList();
    }
    
    return this.getPlantList().filter(plant => plant.status === status);
  }

  /**
   * 触发植物更新事件
   */
  emitPlantUpdated(plant) {
    // 触发自定义事件
    const event = new CustomEvent('plantUpdated', {
      detail: { plant }
    });
    document.dispatchEvent(event);
  }

  /**
   * 清理资源和缓存
   */
  cleanup() {
    this.plants.clear();
    this.plantImages.clear();
    this.annotationStatus.clear();
    this.loadingPlants.clear();
    
    if (this.fileSystemManager) {
      this.fileSystemManager.cleanup();
    }
  }

  /**
   * 导出所有标注数据
   */
  exportAllAnnotations() {
    // 使用持久化存储的导出功能
    return this.annotationStorage.exportAllAnnotations();
  }

  /**
   * 下载标注数据为JSON文件
   */
  downloadAnnotationsAsJSON() {
    return this.annotationStorage.downloadAnnotationsAsJSON();
  }

  /**
   * 导出所有图像的纯净标注数据（新格式）
   * 不包含时间序列管理的内部信息，直接输出图像ID对应的标注点
   */
  async exportPureImageAnnotations() {
    return await this.annotationStorage.exportPureImageAnnotations();
  }

  /**
   * 下载纯净的图像标注数据为JSON文件
   */
  async downloadPureImageAnnotationsAsJSON() {
    return await this.annotationStorage.downloadPureImageAnnotationsAsJSON();
  }

  /**
   * 获取导出数据的统计信息
   */
  async getExportStats() {
    const pureAnnotations = await this.exportPureImageAnnotations();
    const timeSeriesStats = this.timeSeriesManager.getExportStats();
    
    return {
      pureFormat: this.annotationStorage.getPureAnnotationsStats(pureAnnotations),
      timeSeriesFormat: timeSeriesStats,
      recommendation: '建议使用纯净格式进行数据分析和处理'
    };
  }

  /**
   * 调试：检查时间序列数据状态和导出问题
   */
  async debugTimeSeriesExport() {
    console.log('=== 时间序列导出调试 ===');
    
    // 1. 检查时间序列管理器状态
    const timeSeriesStatus = this.timeSeriesManager.getDebugStatus();
    
    // 2. 检查时间序列管理器中的详细数据
    const timeSeriesData = this.timeSeriesManager.exportAllTimeSeriesDataDebug();
    
    // 3. 检查导出的纯净数据
    const pureAnnotations = await this.exportPureImageAnnotations();
    console.log('导出的纯净标注数据:', pureAnnotations);
    
    // 4. 检查存储管理器中的数据
    const storageAnnotations = this.annotationStorage.annotations;
    console.log('存储管理器中的数据:', Array.from(storageAnnotations.entries()));
    
    // 5. 比较数据差异
    const comparison = {
      timeSeriesManagerImages: timeSeriesStatus.totalAnnotatedImages,
      pureExportImages: Object.keys(pureAnnotations).length,
      storageManagerPlants: storageAnnotations.size
    };
    
    console.log('数据比较:', comparison);
    
    return {
      timeSeriesStatus,
      timeSeriesData,
      pureAnnotations,
      storageData: Array.from(storageAnnotations.entries()),
      comparison
    };
  }

  /**
   * 保存标注状态到本地存储
   */
  saveAnnotationStatus(plantId, data) {
    try {
      const storageKey = `plant_annotation_${plantId}`;
      const savedData = {
        ...data,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(savedData));
    } catch (error) {
      console.error('保存标注状态失败:', error);
    }
  }

  /**
   * 从本地存储加载标注状态
   */
  loadAnnotationStatus(plantId) {
    try {
      const storageKey = `plant_annotation_${plantId}`;
      const saved = localStorage.getItem(storageKey);
      
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载标注状态失败:', error);
    }
    
    return null;
  }

  /**
   * 🔧 FIXED: 确保标注数据都有序号（支持类型特定编号系统）
   * 为缺少序号的标注点分配序号，但保持类型特定的编号系统
   */
  ensureAnnotationOrders(annotations) {
    if (!annotations || annotations.length === 0) {
      return;
    }
    
    // 🔧 FIX: 按类型分组标注点
    const annotationsByType = {};
    
    // 分组：regular, 和各种自定义类型
    annotations.forEach(annotation => {
      // 🐛 BUGFIX: Ensure all annotations have annotationType field set
      if (!annotation.annotationType) {
        // 🔧 FIX: Smart detection - check if this is actually a custom annotation
        if (annotation.customTypeId) {
          annotation.annotationType = 'custom'; // Preserve custom type
        } else {
          annotation.annotationType = 'regular'; // Default to regular for missing field
        }
      }
      
      const typeKey = annotation.annotationType === 'custom' 
        ? `custom:${annotation.customTypeId || 'unknown'}`
        : 'regular';
      
      if (!annotationsByType[typeKey]) {
        annotationsByType[typeKey] = [];
      }
      annotationsByType[typeKey].push(annotation);
    });
    
    let totalFixed = 0;
    
    // 🔧 FIX: 为每个类型独立处理序号
    Object.entries(annotationsByType).forEach(([typeKey, typeAnnotations]) => {
      let hasOrderIssues = false;
      
      // 检查该类型是否有序号问题
      for (let i = 0; i < typeAnnotations.length; i++) {
        if (typeof typeAnnotations[i].order !== 'number' || typeAnnotations[i].order <= 0) {
          hasOrderIssues = true;
          break;
        }
      }
      
      // 检查该类型内部是否有重复序号
      if (!hasOrderIssues) {
        const orders = typeAnnotations.map(kp => kp.order);
        const uniqueOrders = [...new Set(orders)];
        if (uniqueOrders.length !== orders.length) {
          hasOrderIssues = true;
        }
      }
      
      // 如果该类型有序号问题，重新分配
      if (hasOrderIssues) {
        console.log(`发现 ${typeKey} 类型标注序号问题，正在为 ${typeAnnotations.length} 个标注点分配序号...`);
        
        // 按照原有顺序为该类型分配序号（从1开始）
        for (let i = 0; i < typeAnnotations.length; i++) {
          typeAnnotations[i].order = i + 1;
        }
        
        totalFixed += typeAnnotations.length;
        console.log(`已为 ${typeKey} 类型分配序号：1-${typeAnnotations.length}`);
      }
    });
    
    if (totalFixed > 0) {
      console.log(`序号修复完成：共修复 ${totalFixed} 个标注点，保持类型特定编号系统`);
    }
  }
} 