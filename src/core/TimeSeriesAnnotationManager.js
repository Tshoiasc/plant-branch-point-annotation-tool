/**
 * 时间序列标注管理器
 * 
 * 功能：
 * - 管理植株在不同时间点的标注数据
 * - 支持标注传播（首次标注自动应用到所有时间点）
 * - 支持微调（调整后向后传播到后续时间点）
 * - 处理时间序列的标注继承和覆盖
 */

export class TimeSeriesAnnotationManager {
  constructor() {
    // 存储格式：plantId -> viewAngle -> imageId -> annotations
    this.timeSeriesAnnotations = new Map();
    // 存储图像的时间顺序：plantId -> viewAngle -> [imageId...]
    this.timeSequences = new Map();
    // 标记哪些是用户手动调整的时间点
    this.manualAdjustments = new Map();
  }

  /**
   * 初始化植株的时间序列
   */
  initializePlantTimeSeries(plantId, viewAngle, images) {
    const plantKey = `${plantId}_${viewAngle}`;
    
    // 按时间排序图像
    const sortedImages = images.sort((a, b) => a.dateTime - b.dateTime);
    const imageIds = sortedImages.map(img => img.id);
    
    // 存储时间序列
    if (!this.timeSequences.has(plantId)) {
      this.timeSequences.set(plantId, new Map());
    }
    this.timeSequences.get(plantId).set(viewAngle, imageIds);
    
    // 初始化标注存储
    if (!this.timeSeriesAnnotations.has(plantId)) {
      this.timeSeriesAnnotations.set(plantId, new Map());
    }
    if (!this.timeSeriesAnnotations.get(plantId).has(viewAngle)) {
      this.timeSeriesAnnotations.get(plantId).set(viewAngle, new Map());
    }
    
    console.log(`初始化植株 ${plantId} 视角 ${viewAngle} 的时间序列，共 ${imageIds.length} 个时间点`);
    
    return {
      plantId,
      viewAngle,
      imageIds,
      totalImages: imageIds.length,
      firstImageId: imageIds[0],
      lastImageId: imageIds[imageIds.length - 1]
    };
  }

  /**
   * 保存标注并处理传播逻辑
   */
  saveAnnotations(plantId, viewAngle, imageId, annotations, isManualAdjustment = false) {
    const plantAnnotations = this.timeSeriesAnnotations.get(plantId);
    if (!plantAnnotations) {
      throw new Error(`植株 ${plantId} 未初始化`);
    }

    const viewAnnotations = plantAnnotations.get(viewAngle);
    if (!viewAnnotations) {
      throw new Error(`植株 ${plantId} 视角 ${viewAngle} 未初始化`);
    }

    const timeSequence = this.timeSequences.get(plantId)?.get(viewAngle);
    if (!timeSequence) {
      throw new Error(`植株 ${plantId} 视角 ${viewAngle} 时间序列未初始化`);
    }

    const currentImageIndex = timeSequence.indexOf(imageId);
    if (currentImageIndex === -1) {
      throw new Error(`图像 ${imageId} 不在时间序列中`);
    }

    // 保存当前时间点的标注
    viewAnnotations.set(imageId, {
      annotations,
      timestamp: new Date().toISOString(),
      isManualAdjustment
    });

    // 记录手动调整
    if (isManualAdjustment) {
      const adjustmentKey = `${plantId}_${viewAngle}`;
      if (!this.manualAdjustments.has(adjustmentKey)) {
        this.manualAdjustments.set(adjustmentKey, new Set());
      }
      this.manualAdjustments.get(adjustmentKey).add(imageId);
    }

    // 处理传播逻辑
    this.propagateAnnotations(plantId, viewAngle, imageId, annotations, currentImageIndex);

    console.log(`保存植株 ${plantId} 视角 ${viewAngle} 图像 ${imageId} 的标注，包含 ${annotations.length} 个关键点`);
    
    return {
      savedImageId: imageId,
      propagatedCount: this.getPropagationCount(plantId, viewAngle, currentImageIndex),
      isFirstAnnotation: currentImageIndex === 0 && !isManualAdjustment,
      isManualAdjustment
    };
  }

  /**
   * 标注传播逻辑
   */
  propagateAnnotations(plantId, viewAngle, sourceImageId, annotations, sourceImageIndex) {
    const timeSequence = this.timeSequences.get(plantId).get(viewAngle);
    const viewAnnotations = this.timeSeriesAnnotations.get(plantId).get(viewAngle);
    const adjustmentKey = `${plantId}_${viewAngle}`;
    const manualAdjustments = this.manualAdjustments.get(adjustmentKey) || new Set();

    // 如果这是首次标注（第一张图像），传播到所有未手动调整的时间点
    if (sourceImageIndex === 0) {
      for (let i = 1; i < timeSequence.length; i++) {
        const targetImageId = timeSequence[i];
        
        // 如果该时间点没有被手动调整过，应用标注
        if (!manualAdjustments.has(targetImageId)) {
          viewAnnotations.set(targetImageId, {
            annotations: this.deepCloneAnnotations(annotations),
            timestamp: new Date().toISOString(),
            isManualAdjustment: false,
            inheritedFrom: sourceImageId
          });
        }
      }
      console.log(`从首个图像 ${sourceImageId} 传播标注到后续 ${timeSequence.length - 1} 个时间点`);
    } 
    // 如果这是中间时间点的调整，向后传播
    else {
      let propagatedCount = 0;
      for (let i = sourceImageIndex + 1; i < timeSequence.length; i++) {
        const targetImageId = timeSequence[i];
        
        // 如果后续时间点没有更新的手动调整，应用当前调整
        if (!manualAdjustments.has(targetImageId)) {
          viewAnnotations.set(targetImageId, {
            annotations: this.deepCloneAnnotations(annotations),
            timestamp: new Date().toISOString(),
            isManualAdjustment: false,
            inheritedFrom: sourceImageId
          });
          propagatedCount++;
        } else {
          // 遇到手动调整的时间点，停止传播
          break;
        }
      }
      
      if (propagatedCount > 0) {
        console.log(`从时间点 ${sourceImageIndex} 向后传播标注到 ${propagatedCount} 个时间点`);
      }
    }
  }

  /**
   * 获取指定时间点的标注
   */
  getAnnotations(plantId, viewAngle, imageId) {
    const viewAnnotations = this.timeSeriesAnnotations.get(plantId)?.get(viewAngle);
    if (!viewAnnotations) {
      return [];
    }

    const annotationData = viewAnnotations.get(imageId);
    return annotationData ? annotationData.annotations : [];
  }

  /**
   * 获取标注的元数据
   */
  getAnnotationMetadata(plantId, viewAngle, imageId) {
    const viewAnnotations = this.timeSeriesAnnotations.get(plantId)?.get(viewAngle);
    if (!viewAnnotations) {
      return null;
    }

    const data = viewAnnotations.get(imageId);
    if (!data) {
      return null;
    }

    const timeSequence = this.timeSequences.get(plantId)?.get(viewAngle);
    const imageIndex = timeSequence ? timeSequence.indexOf(imageId) : -1;

    return {
      hasAnnotations: data.annotations.length > 0,
      isManualAdjustment: data.isManualAdjustment,
      inheritedFrom: data.inheritedFrom,
      timestamp: data.timestamp,
      imageIndex,
      isFirstImage: imageIndex === 0,
      isLastImage: imageIndex === timeSequence.length - 1
    };
  }

  /**
   * 获取传播统计信息
   */
  getPropagationCount(plantId, viewAngle, fromIndex) {
    const timeSequence = this.timeSequences.get(plantId)?.get(viewAngle);
    if (!timeSequence) return 0;

    if (fromIndex === 0) {
      // 首次标注，计算传播到的总数
      return timeSequence.length - 1;
    } else {
      // 中间调整，计算向后传播的数量
      const adjustmentKey = `${plantId}_${viewAngle}`;
      const manualAdjustments = this.manualAdjustments.get(adjustmentKey) || new Set();
      
      let count = 0;
      for (let i = fromIndex + 1; i < timeSequence.length; i++) {
        if (!manualAdjustments.has(timeSequence[i])) {
          count++;
        } else {
          break;
        }
      }
      return count;
    }
  }

  /**
   * 检查是否有标注数据
   */
  hasAnnotations(plantId, viewAngle, imageId) {
    const annotations = this.getAnnotations(plantId, viewAngle, imageId);
    return annotations.length > 0;
  }

  /**
   * 获取植株视角的标注统计
   */
  getAnnotationStats(plantId, viewAngle) {
    const timeSequence = this.timeSequences.get(plantId)?.get(viewAngle);
    if (!timeSequence) {
      return { total: 0, annotated: 0, manual: 0, inherited: 0 };
    }

    const viewAnnotations = this.timeSeriesAnnotations.get(plantId)?.get(viewAngle);
    if (!viewAnnotations) {
      return { total: timeSequence.length, annotated: 0, manual: 0, inherited: 0 };
    }

    let annotated = 0;
    let manual = 0;
    let inherited = 0;

    for (const imageId of timeSequence) {
      const data = viewAnnotations.get(imageId);
      if (data && data.annotations.length > 0) {
        annotated++;
        if (data.isManualAdjustment) {
          manual++;
        } else if (data.inheritedFrom) {
          inherited++;
        }
      }
    }

    return {
      total: timeSequence.length,
      annotated,
      manual,
      inherited,
      coverage: ((annotated / timeSequence.length) * 100).toFixed(1)
    };
  }

  /**
   * 深度克隆标注数据
   */
  deepCloneAnnotations(annotations) {
    return annotations.map(annotation => ({
      ...annotation,
      x: annotation.x,
      y: annotation.y
    }));
  }

  /**
   * 清除植株的所有标注
   */
  clearPlantAnnotations(plantId, viewAngle) {
    const plantAnnotations = this.timeSeriesAnnotations.get(plantId);
    if (plantAnnotations && plantAnnotations.has(viewAngle)) {
      plantAnnotations.get(viewAngle).clear();
    }

    const adjustmentKey = `${plantId}_${viewAngle}`;
    if (this.manualAdjustments.has(adjustmentKey)) {
      this.manualAdjustments.get(adjustmentKey).clear();
    }

    console.log(`清除植株 ${plantId} 视角 ${viewAngle} 的所有标注`);
  }

  /**
   * 导出时间序列标注数据
   */
  exportTimeSeriesData(plantId, viewAngle) {
    const timeSequence = this.timeSequences.get(plantId)?.get(viewAngle);
    const viewAnnotations = this.timeSeriesAnnotations.get(plantId)?.get(viewAngle);
    
    if (!timeSequence || !viewAnnotations) {
      return null;
    }

    const exportData = {
      plantId,
      viewAngle,
      totalImages: timeSequence.length,
      annotationData: []
    };

    for (const imageId of timeSequence) {
      const data = viewAnnotations.get(imageId);
      if (data) {
        exportData.annotationData.push({
          imageId,
          annotations: data.annotations,
          metadata: {
            timestamp: data.timestamp,
            isManualAdjustment: data.isManualAdjustment,
            inheritedFrom: data.inheritedFrom
          }
        });
      }
    }

    return exportData;
  }

  /**
   * 导出所有图像的纯净标注数据（不包含内部管理信息）
   * 返回格式：{ imageId: annotations[] }
   */
  exportAllImageAnnotations() {
    const allImageAnnotations = {};
    
    // 遍历所有植株
    for (const [plantId, plantData] of this.timeSeriesAnnotations) {
      // 遍历每个植株的所有视角
      for (const [viewAngle, viewAnnotations] of plantData) {
        // 遍历该视角的所有图像
        for (const [imageId, annotationData] of viewAnnotations) {
          // 包含所有有标注的图像，不管是原始、继承还是微调的
          if (annotationData.annotations && annotationData.annotations.length > 0) {
            // 只保存纯净的标注点数据，移除内部管理信息
            allImageAnnotations[imageId] = annotationData.annotations.map(annotation => ({
              id: annotation.id,
              x: annotation.x,
              y: annotation.y,
              timestamp: annotation.timestamp
            }));
          }
        }
      }
    }
    
    return allImageAnnotations;
  }

  /**
   * 导出指定植株的所有图像标注数据
   */
  exportPlantImageAnnotations(plantId) {
    const plantImageAnnotations = {};
    const plantData = this.timeSeriesAnnotations.get(plantId);
    
    if (!plantData) {
      return plantImageAnnotations;
    }
    
    // 遍历该植株的所有视角
    for (const [viewAngle, viewAnnotations] of plantData) {
      // 遍历该视角的所有图像
      for (const [imageId, annotationData] of viewAnnotations) {
        if (annotationData.annotations && annotationData.annotations.length > 0) {
          // 只保存纯净的标注点数据
          plantImageAnnotations[imageId] = annotationData.annotations.map(annotation => ({
            id: annotation.id,
            x: annotation.x,
            y: annotation.y,
            timestamp: annotation.timestamp
          }));
        }
      }
    }
    
    return plantImageAnnotations;
  }

  /**
   * 获取标注数据统计信息
   */
  getExportStats() {
    let totalImages = 0;
    let annotatedImages = 0;
    let totalKeypoints = 0;
    const plantStats = {};
    
    for (const [plantId, plantData] of this.timeSeriesAnnotations) {
      let plantImages = 0;
      let plantAnnotatedImages = 0;
      let plantKeypoints = 0;
      
      for (const [viewAngle, viewAnnotations] of plantData) {
        for (const [imageId, annotationData] of viewAnnotations) {
          plantImages++;
          totalImages++;
          
          if (annotationData.annotations && annotationData.annotations.length > 0) {
            plantAnnotatedImages++;
            annotatedImages++;
            plantKeypoints += annotationData.annotations.length;
            totalKeypoints += annotationData.annotations.length;
          }
        }
      }
      
      plantStats[plantId] = {
        totalImages: plantImages,
        annotatedImages: plantAnnotatedImages,
        totalKeypoints: plantKeypoints,
        completionRate: plantImages > 0 ? ((plantAnnotatedImages / plantImages) * 100).toFixed(1) : 0
      };
    }
    
    return {
      totalImages,
      annotatedImages,
      totalKeypoints,
      completionRate: totalImages > 0 ? ((annotatedImages / totalImages) * 100).toFixed(1) : 0,
      plantStats
    };
  }

  /**
   * 调试：获取时间序列管理器的当前状态
   */
  getDebugStatus() {
    const status = {
      plantsCount: this.timeSeriesAnnotations.size,
      totalSequences: 0,
      totalAnnotatedImages: 0,
      plantDetails: {}
    };
    
    for (const [plantId, plantData] of this.timeSeriesAnnotations) {
      const plantDetail = {
        viewAnglesCount: plantData.size,
        viewAngles: {}
      };
      
      for (const [viewAngle, viewAnnotations] of plantData) {
        status.totalSequences++;
        const annotatedImages = Array.from(viewAnnotations.values()).filter(
          data => data.annotations && data.annotations.length > 0
        ).length;
        
        status.totalAnnotatedImages += annotatedImages;
        
        plantDetail.viewAngles[viewAngle] = {
          totalImages: viewAnnotations.size,
          annotatedImages,
          imageIds: Array.from(viewAnnotations.keys())
        };
      }
      
      status.plantDetails[plantId] = plantDetail;
    }
    
    console.log('时间序列管理器状态:', status);
    return status;
  }

  /**
   * 调试：强制导出所有时间序列数据（详细版本）
   */
  exportAllTimeSeriesDataDebug() {
    const debugData = {
      managedPlants: this.timeSeriesAnnotations.size,
      allData: {}
    };
    
    for (const [plantId, plantData] of this.timeSeriesAnnotations) {
      debugData.allData[plantId] = {};
      
      for (const [viewAngle, viewAnnotations] of plantData) {
        debugData.allData[plantId][viewAngle] = {};
        
        for (const [imageId, annotationData] of viewAnnotations) {
          debugData.allData[plantId][viewAngle][imageId] = {
            hasAnnotations: !!(annotationData.annotations && annotationData.annotations.length > 0),
            annotationCount: annotationData.annotations?.length || 0,
            annotations: annotationData.annotations || [],
            metadata: {
              timestamp: annotationData.timestamp,
              isManualAdjustment: annotationData.isManualAdjustment,
              inheritedFrom: annotationData.inheritedFrom
            }
          };
        }
      }
    }
    
    console.log('时间序列详细数据:', debugData);
    return debugData;
  }
} 