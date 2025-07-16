/**
 * 自定义标注管理器
 * 
 * 功能：
 * - 管理自定义标注类型（特殊关键点和关键区域）
 * - 支持点击式标注（点）和拖拽式标注（区域）
 * - 提供颜色自定义和元数据管理
 * - 支持编号系统和实时同步
 * - 与现有标注系统集成
 */

export class CustomAnnotationManager {
  constructor() {
    // 自定义标注类型存储
    this.customTypes = new Map();
    
    // 自定义标注数据存储 (imageId -> annotations[])
    this.customAnnotations = new Map();
    
    // 当前状态
    this.isEnabled = true;
    this.currentMode = 'normal'; // 'normal' | 'custom'
    this.selectedCustomType = null;
    
    // 配置
    this.config = {
      maxCustomTypes: 20,
      maxAnnotationsPerImage: 100,
      minRegionSize: 10,
      defaultPointRadius: 8,
      defaultRegionStrokeWidth: 2
    };
    
    // 实时同步管理器引用
    this.realTimeSyncManager = null;
    
    // 事件处理器
    this.eventHandlers = {
      onAnnotationCreate: [],
      onAnnotationUpdate: [],
      onAnnotationDelete: [],
      onModeChange: [],
      onTypeCreate: [],
      onTypeUpdate: [],
      onTypeDelete: []
    };
    
    // 加载已保存的数据
    this.loadFromStorage();
    
    console.log('CustomAnnotationManager initialized');
  }

  /**
   * 创建自定义标注类型
   * @param {Object} typeData - 类型数据
   * @returns {Object} 创建的类型对象
   */
  createCustomType(typeData) {
    const { id, name, type, color, description = '', metadata = {} } = typeData;
    
    // 验证必要字段
    if (!id || !name || !type || !color) {
      throw new Error('Missing required fields: id, name, type, color');
    }
    
    // 验证类型
    if (!['point', 'region'].includes(type)) {
      throw new Error('Invalid type: must be "point" or "region"');
    }
    
    // 检查是否已存在
    if (this.customTypes.has(id)) {
      throw new Error(`Custom type with id "${id}" already exists`);
    }
    
    // 检查数量限制
    if (this.customTypes.size >= this.config.maxCustomTypes) {
      throw new Error(`Maximum number of custom types (${this.config.maxCustomTypes}) reached`);
    }
    
    // 创建类型对象
    const customType = {
      id,
      name,
      type,
      color,
      description,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.customTypes.set(id, customType);
    
    // 触发类型创建事件
    this.triggerEvent('onTypeCreate', { type: customType });
    
    // 🔄 NEW: 实时同步 - 自定义类型创建
    this.triggerCustomTypeCreateSync(customType, {
      timestamp: new Date().toISOString()
    });
    
    // 自动保存数据
    this.saveToStorage();
    
    // 🔄 NEW: 集成数据库自动保存
    this.triggerDatabaseAutoSave();
    
    console.log(`Created custom type: ${id} (${name})`);
    return customType;
  }

  /**
   * 更新自定义标注类型
   * @param {string} id - 类型ID
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新后的类型对象
   */
  updateCustomType(id, updateData) {
    const existingType = this.customTypes.get(id);
    if (!existingType) {
      throw new Error(`Custom type with id "${id}" not found`);
    }
    
    // 不允许更改ID和type
    const { id: newId, type: newType, ...allowedUpdates } = updateData;
    
    if (newId && newId !== id) {
      console.warn('Cannot change custom type ID');
    }
    
    if (newType && newType !== existingType.type) {
      console.warn('Cannot change custom type type');
    }
    
    // 更新类型
    const updatedType = {
      ...existingType,
      ...allowedUpdates,
      updatedAt: new Date().toISOString()
    };
    
    this.customTypes.set(id, updatedType);
    
    // 触发类型更新事件
    this.triggerEvent('onTypeUpdate', { type: updatedType });
    
    console.log(`Updated custom type: ${id}`);
    return updatedType;
  }

  /**
   * 删除自定义标注类型
   * @param {string} id - 类型ID
   * @returns {boolean} 是否成功删除
   */
  deleteCustomType(id) {
    if (!this.customTypes.has(id)) {
      return false;
    }
    
    // 删除相关标注
    this.deleteAnnotationsByTypeId(id);
    
    // 删除类型
    this.customTypes.delete(id);
    
    // 触发类型删除事件
    this.triggerEvent('onTypeDelete', { typeId: id });
    
    // 如果当前选中的是被删除的类型，切换回正常模式
    if (this.selectedCustomType === id) {
      this.setNormalMode();
    }
    
    console.log(`Deleted custom type: ${id}`);
    return true;
  }

  /**
   * 获取所有自定义类型
   * @returns {Array} 自定义类型数组
   */
  getAllCustomTypes() {
    return Array.from(this.customTypes.values());
  }

  /**
   * 获取指定类型
   * @param {string} id - 类型ID
   * @returns {Object|null} 类型对象
   */
  getCustomType(id) {
    return this.customTypes.get(id) || null;
  }

  /**
   * 创建自定义标注
   * @param {Object} annotationData - 标注数据
   * @returns {Object} 创建的标注对象
   */
  createCustomAnnotation(annotationData) {
    const { typeId, x, y, width, height, imageId, metadata = {} } = annotationData;
    
    // 验证必要字段
    if (!typeId || !imageId || x === undefined || y === undefined) {
      throw new Error('Missing required fields: typeId, imageId, x, y');
    }
    
    // 验证类型是否存在
    const customType = this.customTypes.get(typeId);
    if (!customType) {
      throw new Error(`Custom type with id "${typeId}" not found`);
    }
    
    // 验证区域类型的尺寸
    if (customType.type === 'region') {
      if (width === undefined || height === undefined) {
        throw new Error('Width and height are required for region annotations');
      }
      if (width < this.config.minRegionSize || height < this.config.minRegionSize) {
        throw new Error(`Region size must be at least ${this.config.minRegionSize}px`);
      }
    }
    
    // 获取或创建图像标注数组
    if (!this.customAnnotations.has(imageId)) {
      this.customAnnotations.set(imageId, []);
    }
    
    const imageAnnotations = this.customAnnotations.get(imageId);
    
    // 检查数量限制
    if (imageAnnotations.length >= this.config.maxAnnotationsPerImage) {
      throw new Error(`Maximum number of annotations per image (${this.config.maxAnnotationsPerImage}) reached`);
    }
    
    // 🔧 FIX: 生成特定类型的下一个序号（每种类型独立计数）
    const order = this.getNextOrderNumber(imageId, typeId);
    
    // 创建标注对象
    const annotation = {
      id: this.generateAnnotationId(),
      typeId,
      x,
      y,
      ...(customType.type === 'region' && { width, height }),
      imageId,
      order,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    imageAnnotations.push(annotation);
    
    // 触发事件
    this.triggerEvent('onAnnotationCreate', annotation);
    
    // 🔄 NEW: 实时同步 - 自定义标注创建
    this.triggerCustomAnnotationCreateSync(annotation, {
      imageId: imageId,
      typeId: typeId,
      timestamp: new Date().toISOString()
    });
    
    // 自动保存数据
    this.saveToStorage();
    
    // 🔄 NEW: 集成数据库自动保存
    this.triggerDatabaseAutoSave();
    
    console.log(`Created custom annotation: ${annotation.id} (type: ${typeId}, order: ${order})`);
    return annotation;
  }

  /**
   * 获取指定图像的标注
   * @param {string} imageId - 图像ID
   * @returns {Array} 标注数组
   */
  getAnnotationsByImageId(imageId) {
    return this.customAnnotations.get(imageId) || [];
  }

  /**
   * 删除自定义标注
   * @param {string} annotationId - 标注ID
   * @returns {boolean} 是否成功删除
   */
  deleteCustomAnnotation(annotationId) {
    for (const [imageId, annotations] of this.customAnnotations.entries()) {
      const index = annotations.findIndex(ann => ann.id === annotationId);
      if (index !== -1) {
        const deletedAnnotation = annotations.splice(index, 1)[0];
        
        // 如果图像没有标注了，删除图像条目
        if (annotations.length === 0) {
          this.customAnnotations.delete(imageId);
        }
        
        // 触发事件
        this.triggerEvent('onAnnotationDelete', deletedAnnotation);
        
        // 🔄 NEW: 实时同步 - 自定义标注删除
        this.triggerCustomAnnotationDeleteSync(deletedAnnotation, {
          imageId: imageId,
          typeId: deletedAnnotation.typeId,
          timestamp: new Date().toISOString()
        });
        
        // 自动保存数据
        this.saveToStorage();
        
        // 🔄 NEW: 集成数据库自动保存
        this.triggerDatabaseAutoSave();
        
        console.log(`Deleted custom annotation: ${annotationId}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 根据类型ID删除所有标注
   * @param {string} typeId - 类型ID
   */
  deleteAnnotationsByTypeId(typeId) {
    let deletedCount = 0;
    
    for (const [imageId, annotations] of this.customAnnotations.entries()) {
      const originalLength = annotations.length;
      const filtered = annotations.filter(ann => ann.typeId !== typeId);
      
      if (filtered.length !== originalLength) {
        deletedCount += originalLength - filtered.length;
        
        if (filtered.length === 0) {
          this.customAnnotations.delete(imageId);
        } else {
          this.customAnnotations.set(imageId, filtered);
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} annotations of type ${typeId}`);
    }
  }

  /**
   * 设置自定义标注模式
   * @param {string} typeId - 类型ID
   */
  setCustomAnnotationMode(typeId) {
    const customType = this.customTypes.get(typeId);
    if (!customType) {
      throw new Error(`Custom type with id "${typeId}" not found`);
    }
    
    this.currentMode = 'custom';
    this.selectedCustomType = typeId;
    
    // 触发模式变化事件
    this.triggerEvent('onModeChange', {
      mode: 'custom',
      typeId,
      customType
    });
    
    console.log(`Switched to custom annotation mode: ${typeId}`);
  }

  /**
   * 设置正常模式
   */
  setNormalMode() {
    this.currentMode = 'normal';
    this.selectedCustomType = null;
    
    // 触发模式变化事件
    this.triggerEvent('onModeChange', {
      mode: 'normal',
      typeId: null,
      customType: null
    });
    
    console.log('Switched to normal annotation mode');
  }

  /**
   * 检查是否处于自定义模式
   * @returns {boolean} 是否处于自定义模式
   */
  isInCustomMode() {
    return this.currentMode === 'custom' && this.selectedCustomType !== null;
  }

  /**
   * 获取当前选中的自定义类型
   * @returns {Object|null} 当前选中的类型对象
   */
  getCurrentCustomType() {
    if (!this.selectedCustomType) {
      return null;
    }
    return this.customTypes.get(this.selectedCustomType);
  }

  /**
   * 处理画布点击（点类型标注）
   * @param {Object} clickData - 点击数据（包含图像坐标）
   * @returns {Object} 处理结果
   */
  handleCanvasClick(clickData) {
    if (!this.isInCustomMode()) {
      return { success: false, reason: 'Not in custom mode' };
    }
    
    const customType = this.getCurrentCustomType();
    if (!customType) {
      return { success: false, reason: 'No custom type selected' };
    }
    
    if (customType.type !== 'point') {
      return { success: false, reason: 'Selected type is not a point type' };
    }
    
    // 验证点击数据
    if (!clickData.imageId || typeof clickData.x !== 'number' || typeof clickData.y !== 'number') {
      return { success: false, reason: 'Invalid click data' };
    }
    
    try {
      const annotation = this.createCustomAnnotation({
        typeId: customType.id,
        x: clickData.x,
        y: clickData.y,
        imageId: clickData.imageId
      });
      
      return { success: true, annotation };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * 处理区域拖拽（区域类型标注）
   * @param {Object} dragData - 拖拽数据
   * @returns {Object} 处理结果
   */
  handleRegionDrag(dragData) {
    if (!this.isInCustomMode()) {
      return { success: false, reason: 'Not in custom mode' };
    }
    
    const customType = this.getCurrentCustomType();
    if (!customType) {
      return { success: false, reason: 'No custom type selected' };
    }
    
    if (customType.type !== 'region') {
      return { success: false, reason: 'Selected type is not a region type' };
    }
    
    const { startX, startY, endX, endY, imageId } = dragData;
    
    // 计算区域位置和尺寸
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    try {
      const annotation = this.createCustomAnnotation({
        typeId: customType.id,
        x,
        y,
        width,
        height,
        imageId
      });
      
      return { success: true, annotation };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * 获取下一个序号
   * @param {string} imageId - 图像ID
   * @param {string} typeId - 类型ID（可选，用于按类型编号）
   * @returns {number} 下一个序号
   */
  getNextOrderNumber(imageId, typeId = null) {
    const annotations = this.getAnnotationsByImageId(imageId);
    
    // 如果指定了类型ID，只考虑该类型的标注
    const relevantAnnotations = typeId 
      ? annotations.filter(ann => ann.typeId === typeId)
      : annotations;
    
    if (relevantAnnotations.length === 0) {
      return 1;
    }
    
    const maxOrder = Math.max(...relevantAnnotations.map(ann => ann.order || 0));
    return maxOrder + 1;
  }

  /**
   * 重新整理指定图像的标注序号，确保序号连续
   * @param {string} imageId - 图像ID
   * @param {string} typeId - 类型ID（可选，只重新整理指定类型）
   */
  reorderAnnotations(imageId, typeId = null) {
    const annotations = this.getAnnotationsByImageId(imageId);
    
    if (typeId) {
      // 只重新整理指定类型的标注
      const typeAnnotations = annotations.filter(ann => ann.typeId === typeId);
      typeAnnotations.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      typeAnnotations.forEach((annotation, index) => {
        annotation.order = index + 1;
        annotation.updatedAt = new Date().toISOString();
      });
      
      console.log(`Reordered ${typeAnnotations.length} annotations of type ${typeId} for image ${imageId}`);
    } else {
      // 重新整理所有标注
      annotations.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      annotations.forEach((annotation, index) => {
        annotation.order = index + 1;
        annotation.updatedAt = new Date().toISOString();
      });
      
      console.log(`Reordered ${annotations.length} annotations for image ${imageId}`);
    }
    
    // 保存更改
    this.saveToStorage();
    
    // 🔄 NEW: 集成数据库自动保存
    this.triggerDatabaseAutoSave();
    
    // 触发更新事件
    this.triggerEvent('onAnnotationUpdate', { imageId, typeId });
  }

  /**
   * 获取标注统计信息（按类型）
   * @param {string} imageId - 图像ID
   * @returns {Object} 统计信息
   */
  getAnnotationStats(imageId) {
    const annotations = this.getAnnotationsByImageId(imageId);
    const stats = {
      total: annotations.length,
      byType: {},
      orderRange: { min: 0, max: 0 },
      gaps: []
    };
    
    if (annotations.length === 0) {
      return stats;
    }
    
    // 按类型统计
    annotations.forEach(annotation => {
      const typeId = annotation.typeId;
      if (!stats.byType[typeId]) {
        const customType = this.getCustomType(typeId);
        stats.byType[typeId] = {
          count: 0,
          typeName: customType?.name || 'Unknown',
          typeColor: customType?.color || '#000000',
          annotationType: customType?.type || 'unknown'
        };
      }
      stats.byType[typeId].count++;
    });
    
    // 序号范围和间隙检测
    const orders = annotations.map(ann => ann.order || 0).filter(order => order > 0).sort((a, b) => a - b);
    if (orders.length > 0) {
      stats.orderRange.min = orders[0];
      stats.orderRange.max = orders[orders.length - 1];
      
      // 检测序号间隙
      for (let i = orders[0]; i <= orders[orders.length - 1]; i++) {
        if (!orders.includes(i)) {
          stats.gaps.push(i);
        }
      }
    }
    
    return stats;
  }

  /**
   * 查找具有指定序号的标注
   * @param {string} imageId - 图像ID
   * @param {number} order - 序号
   * @returns {Object|null} 标注对象
   */
  findAnnotationByOrder(imageId, order) {
    const annotations = this.getAnnotationsByImageId(imageId);
    return annotations.find(ann => ann.order === order) || null;
  }

  /**
   * 更新标注序号
   * @param {string} annotationId - 标注ID
   * @param {number} newOrder - 新序号
   * @returns {boolean} 是否成功更新
   */
  updateAnnotationOrder(annotationId, newOrder) {
    for (const [imageId, annotations] of this.customAnnotations.entries()) {
      const annotation = annotations.find(ann => ann.id === annotationId);
      if (annotation) {
        // 检查新序号是否与其他标注冲突
        const conflictAnnotation = annotations.find(ann => ann.id !== annotationId && ann.order === newOrder);
        if (conflictAnnotation) {
          console.warn(`Order ${newOrder} is already used by annotation ${conflictAnnotation.id}`);
          return false;
        }
        
        const oldOrder = annotation.order;
        annotation.order = newOrder;
        annotation.updatedAt = new Date().toISOString();
        
        // 触发更新事件
        this.triggerEvent('onAnnotationUpdate', annotation);
        
        // 🔄 NEW: 实时同步 - 标注序号更新
        this.triggerCustomAnnotationUpdateSync(annotation, {
          imageId: imageId,
          orderChange: { from: oldOrder, to: newOrder },
          timestamp: new Date().toISOString()
        });
        
        // 保存更改
        this.saveToStorage();
        
        // 🔄 NEW: 集成数据库自动保存
        this.triggerDatabaseAutoSave();
        
        console.log(`Updated annotation ${annotationId} order from ${oldOrder} to ${newOrder}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 生成标注ID
   * @returns {string} 标注ID
   */
  generateAnnotationId() {
    return `custom_ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 导出数据
   * @returns {Object} 导出的数据
   */
  exportData() {
    const customTypes = Array.from(this.customTypes.values());
    const customAnnotations = [];
    
    for (const [imageId, annotations] of this.customAnnotations.entries()) {
      customAnnotations.push(...annotations);
    }
    
    return {
      version: '1.0',
      exportTime: new Date().toISOString(),
      customTypes,
      customAnnotations
    };
  }

  /**
   * 导入数据
   * @param {Object} importData - 导入的数据
   * @returns {Object} 导入结果
   */
  importData(importData) {
    try {
      const { version, customTypes = [], customAnnotations = [] } = importData;
      
      if (version !== '1.0') {
        console.warn(`Importing data with version ${version}, expected 1.0`);
      }
      
      // 导入自定义类型
      for (const typeData of customTypes) {
        if (!this.customTypes.has(typeData.id)) {
          this.customTypes.set(typeData.id, typeData);
        }
      }
      
      // 导入标注
      for (const annotation of customAnnotations) {
        if (!this.customAnnotations.has(annotation.imageId)) {
          this.customAnnotations.set(annotation.imageId, []);
        }
        
        const imageAnnotations = this.customAnnotations.get(annotation.imageId);
        
        // 避免重复导入
        if (!imageAnnotations.find(ann => ann.id === annotation.id)) {
          imageAnnotations.push(annotation);
        }
      }
      
      console.log(`Imported ${customTypes.length} custom types and ${customAnnotations.length} annotations`);
      return { success: true };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 添加事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  addEventListener(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(handler);
  }

  /**
   * 移除事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  removeEventListener(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      const index = this.eventHandlers[eventName].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[eventName].splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {any} data - 事件数据
   */
  triggerEvent(eventName, data) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * 设置实时同步管理器
   * @param {Object} realTimeSyncManager - 实时同步管理器
   */
  setRealTimeSyncManager(realTimeSyncManager) {
    this.realTimeSyncManager = realTimeSyncManager;
    console.log('Real-time sync manager set for custom annotations');
  }

  /**
   * 触发自定义标注创建的实时同步
   * @param {Object} annotation - 标注数据
   * @param {Object} context - 上下文信息 (imageId, plantId等)
   */
  triggerCustomAnnotationCreateSync(annotation, context = {}) {
    if (!this.realTimeSyncManager || !this.realTimeSyncManager.isRealTimeSyncEnabled()) {
      console.log('🔄 Custom annotation real-time sync disabled, skipping create sync');
      return;
    }

    try {
      // 获取当前应用状态
      const appState = window.PlantAnnotationTool?.appState;
      if (!appState?.currentPlant || !appState?.currentImage) {
        console.warn('🔄 缺少当前植株或图像信息，跳过自定义标注同步');
        return;
      }

      const syncData = {
        type: 'CUSTOM_ANNOTATION_CREATE',
        annotation: annotation,
        context: {
          ...context,
          plantId: appState.currentPlant.id,
          imageId: appState.currentImage.id,
          viewAngle: appState.currentPlant.selectedViewAngle,
          appState: appState
        },
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Triggering custom annotation create sync:', syncData);
      
      // Call the real-time sync manager's custom annotation sync method
      if (typeof this.realTimeSyncManager.triggerCustomAnnotationSync === 'function') {
        this.realTimeSyncManager.triggerCustomAnnotationSync(syncData);
      } else {
        console.warn('🔄 Real-time sync manager does not support custom annotation sync');
      }
    } catch (error) {
      console.error('🔄 Failed to trigger custom annotation create sync:', error);
    }
  }

  /**
   * 触发自定义标注更新的实时同步
   * @param {Object} annotation - 更新后的标注数据
   * @param {Object} context - 上下文信息
   */
  triggerCustomAnnotationUpdateSync(annotation, context = {}) {
    if (!this.realTimeSyncManager || !this.realTimeSyncManager.isRealTimeSyncEnabled()) {
      console.log('🔄 Custom annotation real-time sync disabled, skipping update sync');
      return;
    }

    try {
      // 🔧 FIX: 获取当前应用状态 - 与create方法保持一致
      const appState = window.PlantAnnotationTool?.appState;
      if (!appState?.currentPlant || !appState?.currentImage) {
        console.warn('🔄 缺少当前植株或图像信息，跳过自定义标注更新同步');
        return;
      }

      const syncData = {
        type: 'CUSTOM_ANNOTATION_UPDATE',
        annotation: annotation,
        context: {
          ...context,
          plantId: appState.currentPlant.id,
          imageId: appState.currentImage.id,
          viewAngle: appState.currentPlant.selectedViewAngle,
          appState: appState
        },
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Triggering custom annotation update sync:', syncData);
      
      if (typeof this.realTimeSyncManager.triggerCustomAnnotationSync === 'function') {
        this.realTimeSyncManager.triggerCustomAnnotationSync(syncData);
      } else {
        console.warn('🔄 Real-time sync manager does not support custom annotation sync');
      }
    } catch (error) {
      console.error('🔄 Failed to trigger custom annotation update sync:', error);
    }
  }

  /**
   * 触发自定义标注删除的实时同步
   * @param {Object} annotation - 被删除的标注数据
   * @param {Object} context - 上下文信息
   */
  triggerCustomAnnotationDeleteSync(annotation, context = {}) {
    if (!this.realTimeSyncManager || !this.realTimeSyncManager.isRealTimeSyncEnabled()) {
      console.log('🔄 Custom annotation real-time sync disabled, skipping delete sync');
      return;
    }

    try {
      // 🔧 FIX: 获取当前应用状态 - 与create方法保持一致
      const appState = window.PlantAnnotationTool?.appState;
      if (!appState?.currentPlant || !appState?.currentImage) {
        console.warn('🔄 缺少当前植株或图像信息，跳过自定义标注删除同步');
        return;
      }

      const syncData = {
        type: 'CUSTOM_ANNOTATION_DELETE',
        annotation: annotation,
        context: {
          ...context,
          plantId: appState.currentPlant.id,
          imageId: appState.currentImage.id,
          viewAngle: appState.currentPlant.selectedViewAngle,
          appState: appState
        },
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Triggering custom annotation delete sync:', syncData);
      
      if (typeof this.realTimeSyncManager.triggerCustomAnnotationSync === 'function') {
        this.realTimeSyncManager.triggerCustomAnnotationSync(syncData);
      } else {
        console.warn('🔄 Real-time sync manager does not support custom annotation sync');
      }
    } catch (error) {
      console.error('🔄 Failed to trigger custom annotation delete sync:', error);
    }
  }

  /**
   * 触发自定义类型创建的实时同步
   * @param {Object} customType - 自定义类型数据
   * @param {Object} context - 上下文信息
   */
  triggerCustomTypeCreateSync(customType, context = {}) {
    if (!this.realTimeSyncManager || !this.realTimeSyncManager.isRealTimeSyncEnabled()) {
      console.log('🔄 Custom type real-time sync disabled, skipping create sync');
      return;
    }

    try {
      const syncData = {
        type: 'CUSTOM_TYPE_CREATE',
        customType: customType,
        context: context,
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Triggering custom type create sync:', syncData);
      
      if (typeof this.realTimeSyncManager.triggerCustomAnnotationSync === 'function') {
        this.realTimeSyncManager.triggerCustomAnnotationSync(syncData);
      } else {
        console.warn('🔄 Real-time sync manager does not support custom annotation sync');
      }
    } catch (error) {
      console.error('🔄 Failed to trigger custom type create sync:', error);
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const totalTypes = this.customTypes.size;
    let totalAnnotations = 0;
    let annotatedImages = 0;
    
    for (const [imageId, annotations] of this.customAnnotations.entries()) {
      if (annotations.length > 0) {
        annotatedImages++;
        totalAnnotations += annotations.length;
      }
    }
    
    return {
      totalTypes,
      totalAnnotations,
      annotatedImages,
      averageAnnotationsPerImage: annotatedImages > 0 ? (totalAnnotations / annotatedImages).toFixed(2) : 0
    };
  }

  /**
   * 保存数据到localStorage
   */
  saveToStorage() {
    try {
      const data = {
        customTypes: Array.from(this.customTypes.entries()),
        customAnnotations: Array.from(this.customAnnotations.entries()),
        version: '1.0',
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem('customAnnotationData', JSON.stringify(data));
      console.log('Custom annotation data saved to localStorage');
    } catch (error) {
      console.error('Failed to save custom annotation data:', error);
    }
  }

  /**
   * 从localStorage加载数据
   */
  loadFromStorage() {
    try {
      const savedData = localStorage.getItem('customAnnotationData');
      if (!savedData) {
        console.log('No saved custom annotation data found');
        return;
      }

      const data = JSON.parse(savedData);
      
      // 恢复自定义类型
      if (data.customTypes) {
        this.customTypes.clear();
        data.customTypes.forEach(([id, type]) => {
          this.customTypes.set(id, type);
        });
      }
      
      // 恢复自定义标注
      if (data.customAnnotations) {
        this.customAnnotations.clear();
        data.customAnnotations.forEach(([imageId, annotations]) => {
          this.customAnnotations.set(imageId, annotations);
        });
      }
      
      console.log(`Loaded custom annotation data from localStorage (version: ${data.version})`);
      
      // 触发事件通知UI更新 - 为每个加载的类型触发事件
      if (data.customTypes && data.customTypes.length > 0) {
        console.log(`Triggering type events for ${data.customTypes.length} loaded types`);
        // 延迟触发事件，确保所有UI组件都已初始化
        setTimeout(() => {
          data.customTypes.forEach(([id, type]) => {
            this.triggerEvent('onTypeCreate', { type });
          });
        }, 100);
      }
      
    } catch (error) {
      console.error('Failed to load custom annotation data:', error);
    }
  }

  /**
   * 清除localStorage中的数据
   */
  clearStorage() {
    try {
      localStorage.removeItem('customAnnotationData');
      console.log('Custom annotation data cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear custom annotation data:', error);
    }
  }
  
  /**
   * 🔄 NEW: 触发数据库自动保存
   */
  async triggerDatabaseAutoSave() {
    try {
      // 通过全局对象访问AnnotationTool的自动保存功能
      const annotationTool = window.PlantAnnotationTool?.annotationTool;
      if (annotationTool && typeof annotationTool.autoSaveCurrentImage === 'function') {
        await annotationTool.autoSaveCurrentImage();
        console.log('Custom annotation database auto-save triggered');
      } else {
        console.warn('AnnotationTool auto-save not available');
      }
    } catch (error) {
      console.error('Failed to trigger database auto-save:', error);
    }
  }
  
  /**
   * 🔄 NEW: 获取自定义标注数据用于数据库保存
   */
  getCustomAnnotationsForSave(imageId) {
    const annotations = this.getAnnotationsByImageId(imageId);
    return annotations.map(annotation => {
      const customType = this.getCustomType(annotation.typeId);
      return {
        ...annotation,
        customType: customType ? {
          id: customType.id,
          name: customType.name,
          type: customType.type,
          color: customType.color,
          description: customType.description
        } : null
      };
    });
  }
  
  /**
   * 🔄 NEW: 从数据库保存数据中恢复自定义标注
   */
  loadCustomAnnotationsFromSave(imageId, savedCustomAnnotations) {
    if (!savedCustomAnnotations || !Array.isArray(savedCustomAnnotations)) {
      return;
    }
    
    // 确保图像标注数组存在
    if (!this.customAnnotations.has(imageId)) {
      this.customAnnotations.set(imageId, []);
    }
    
    const imageAnnotations = this.customAnnotations.get(imageId);
    
    // 加载自定义标注
    savedCustomAnnotations.forEach(savedAnnotation => {
      // 检查是否已存在
      const exists = imageAnnotations.find(ann => ann.id === savedAnnotation.id);
      if (!exists) {
        // 移除customType字段（这是为了保存而添加的），保持标注数据的纯净
        const { customType, ...annotation } = savedAnnotation;
        imageAnnotations.push(annotation);
      }
    });
    
    console.log(`Loaded ${savedCustomAnnotations.length} custom annotations for image ${imageId}`);
  }
  
  /**
   * 🔧 FIX: 从主键点数组同步自定义标注到内部状态
   * @param {string} imageId - 图像ID
   * @param {Array} customAnnotations - 自定义标注数组
   */
  syncAnnotationsFromKeypoints(imageId, customAnnotations) {
    if (!imageId || !customAnnotations || customAnnotations.length === 0) {
      return;
    }
    
    // 确保图像标注数组存在
    if (!this.customAnnotations.has(imageId)) {
      this.customAnnotations.set(imageId, []);
    }
    
    const imageAnnotations = this.customAnnotations.get(imageId);
    
    // 为每个自定义标注添加到内部状态
    customAnnotations.forEach(annotation => {
      // 检查是否已存在
      const existingIndex = imageAnnotations.findIndex(existing => existing.id === annotation.id);
      
      if (existingIndex === -1) {
        // 创建标注副本并添加到内部状态
        const annotationCopy = { ...annotation };
        imageAnnotations.push(annotationCopy);
        console.log(`[同步] 添加自定义标注到内部状态: ${annotation.id} (类型: ${annotation.customTypeId})`);
      } else {
        // 更新现有标注
        imageAnnotations[existingIndex] = { ...annotation };
        console.log(`[同步] 更新自定义标注在内部状态: ${annotation.id} (类型: ${annotation.customTypeId})`);
      }
    });
    
    // 保存到localStorage
    this.saveToStorage();
    
    console.log(`[同步] 同步了 ${customAnnotations.length} 个自定义标注到图像 ${imageId}`);
  }
  
  /**
   * 🔄 NEW: 接收来自实时同步的自定义标注创建事件
   * @param {Object} syncData - 同步数据
   */
  handleCustomAnnotationCreateFromSync(syncData) {
    try {
      if (!syncData.annotation) {
        console.warn('🔄 Invalid sync data for custom annotation create');
        return;
      }

      const { annotation, context } = syncData;
      
      // 检查是否已存在该标注
      const existingAnnotations = this.getAnnotationsByImageId(context.imageId);
      const exists = existingAnnotations.find(ann => ann.id === annotation.id);
      
      if (exists) {
        console.log('🔄 Custom annotation already exists, skipping');
        return;
      }

      // 确保自定义类型存在
      if (!this.customTypes.has(annotation.typeId)) {
        console.warn(`🔄 Custom type ${annotation.typeId} not found for synced annotation`);
        return;
      }

      // 确保图像标注数组存在
      if (!this.customAnnotations.has(context.imageId)) {
        this.customAnnotations.set(context.imageId, []);
      }

      // 添加标注（不触发同步，避免循环）
      this.customAnnotations.get(context.imageId).push(annotation);
      
      // 触发UI更新事件
      this.triggerEvent('onAnnotationCreate', annotation);
      
      // 保存到本地存储
      this.saveToStorage();
      
      console.log('🔄 Custom annotation created from sync:', annotation.id);
    } catch (error) {
      console.error('🔄 Failed to handle custom annotation create from sync:', error);
    }
  }

  /**
   * 🔄 NEW: 接收来自实时同步的自定义标注更新事件
   * @param {Object} syncData - 同步数据
   */
  handleCustomAnnotationUpdateFromSync(syncData) {
    try {
      if (!syncData.annotation) {
        console.warn('🔄 Invalid sync data for custom annotation update');
        return;
      }

      const { annotation, context } = syncData;
      
      // 查找并更新标注
      const imageAnnotations = this.getAnnotationsByImageId(context.imageId);
      const existingIndex = imageAnnotations.findIndex(ann => ann.id === annotation.id);
      
      if (existingIndex === -1) {
        console.warn('🔄 Custom annotation not found for update from sync:', annotation.id);
        return;
      }

      // 更新标注（不触发同步，避免循环）
      imageAnnotations[existingIndex] = { ...imageAnnotations[existingIndex], ...annotation };
      
      // 触发UI更新事件
      this.triggerEvent('onAnnotationUpdate', annotation);
      
      // 保存到本地存储
      this.saveToStorage();
      
      console.log('🔄 Custom annotation updated from sync:', annotation.id);
    } catch (error) {
      console.error('🔄 Failed to handle custom annotation update from sync:', error);
    }
  }

  /**
   * 🔄 NEW: 接收来自实时同步的自定义标注删除事件
   * @param {Object} syncData - 同步数据
   */
  handleCustomAnnotationDeleteFromSync(syncData) {
    try {
      if (!syncData.annotation) {
        console.warn('🔄 Invalid sync data for custom annotation delete');
        return;
      }

      const { annotation, context } = syncData;
      
      // 查找并删除标注
      const imageAnnotations = this.getAnnotationsByImageId(context.imageId);
      const existingIndex = imageAnnotations.findIndex(ann => ann.id === annotation.id);
      
      if (existingIndex === -1) {
        console.warn('🔄 Custom annotation not found for delete from sync:', annotation.id);
        return;
      }

      // 删除标注（不触发同步，避免循环）
      imageAnnotations.splice(existingIndex, 1);
      
      // 如果图像没有标注了，删除图像条目
      if (imageAnnotations.length === 0) {
        this.customAnnotations.delete(context.imageId);
      }
      
      // 触发UI更新事件
      this.triggerEvent('onAnnotationDelete', annotation);
      
      // 保存到本地存储
      this.saveToStorage();
      
      console.log('🔄 Custom annotation deleted from sync:', annotation.id);
    } catch (error) {
      console.error('🔄 Failed to handle custom annotation delete from sync:', error);
    }
  }

  /**
   * 🔄 NEW: 接收来自实时同步的自定义类型创建事件
   * @param {Object} syncData - 同步数据
   */
  handleCustomTypeCreateFromSync(syncData) {
    try {
      if (!syncData.customType) {
        console.warn('🔄 Invalid sync data for custom type create');
        return;
      }

      const { customType } = syncData;
      
      // 检查是否已存在该类型
      if (this.customTypes.has(customType.id)) {
        console.log('🔄 Custom type already exists, skipping');
        return;
      }

      // 添加类型（不触发同步，避免循环）
      this.customTypes.set(customType.id, customType);
      
      // 触发UI更新事件
      this.triggerEvent('onTypeCreate', { type: customType });
      
      // 保存到本地存储
      this.saveToStorage();
      
      console.log('🔄 Custom type created from sync:', customType.id);
    } catch (error) {
      console.error('🔄 Failed to handle custom type create from sync:', error);
    }
  }

  /**
   * 🔄 NEW: 处理来自实时同步的所有自定义标注相关事件
   * @param {Object} syncData - 同步数据
   */
  handleSyncEvent(syncData) {
    if (!syncData || !syncData.type) {
      console.warn('🔄 Invalid sync data received');
      return;
    }

    console.log('🔄 Processing custom annotation sync event:', syncData.type);

    switch (syncData.type) {
      case 'CUSTOM_ANNOTATION_CREATE':
        this.handleCustomAnnotationCreateFromSync(syncData);
        break;
      case 'CUSTOM_ANNOTATION_UPDATE':
        this.handleCustomAnnotationUpdateFromSync(syncData);
        break;
      case 'CUSTOM_ANNOTATION_DELETE':
        this.handleCustomAnnotationDeleteFromSync(syncData);
        break;
      case 'CUSTOM_TYPE_CREATE':
        this.handleCustomTypeCreateFromSync(syncData);
        break;
      default:
        console.warn('🔄 Unknown custom annotation sync event type:', syncData.type);
    }
  }
}