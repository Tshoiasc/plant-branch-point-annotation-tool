/**
 * 自定义标注渲染器
 * 
 * 功能：
 * - 渲染自定义点标注和区域标注
 * - 提供视觉反馈和交互
 * - 支持编号系统和颜色自定义
 * - 与AnnotationTool集成
 */

export class CustomAnnotationRenderer {
  constructor(annotationTool, customAnnotationManager) {
    this.annotationTool = annotationTool;
    this.customAnnotationManager = customAnnotationManager;
    this.ctx = annotationTool.ctx;
    this.canvas = annotationTool.canvas;
    
    // 渲染配置
    this.config = {
      // 基础配置
      basePointRadius: 8,
      minPointRadius: 4,
      maxPointRadius: 20,
      pointScaleFactor: 0.8,
      
      // 颜色配置
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      regionBorderWidth: 2,
      regionFillAlpha: 0.2,
      
      // 标签配置
      baseLabelFontSize: 12,
      labelOffset: 16,
      labelThresholdScale: 0.6,
      tinyThresholdScale: 0.3,
      
      // 状态配置
      hoverAlpha: 0.8,
      selectedAlpha: 0.9
    };
    
    // 当前状态
    this.hoveredAnnotation = null;
    this.selectedAnnotation = null;
    
    // 拖拽状态
    this.draggedAnnotation = null;
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.isDragging = false;
    
    console.log('CustomAnnotationRenderer initialized');
  }

  /**
   * 获取自定义标注显示策略
   */
  getCustomAnnotationDisplayStrategy() {
    const scale = this.annotationTool.state.scale;
    
    // 计算实际的标注点半径
    const smallRadius = 3; // 更小的默认点半径
    let actualRadius;
    
    if (scale >= 1.5) {
      // 大缩放：使用能容纳文字的最小圆圈
      const fontSize = Math.max(10, Math.min(16, 12 * scale));
      const textBasedRadius = Math.max(8, fontSize * 0.7);
      const maxRadiusForLargeScale = Math.min(12, 8 + (scale - 1.5) * 2);
      
      actualRadius = Math.min(textBasedRadius, maxRadiusForLargeScale);
      actualRadius = Math.max(8, actualRadius);
    } else {
      // 默认和小缩放：使用更小的点
      actualRadius = smallRadius + (scale - 0.1) * 1.5;
      actualRadius = Math.max(smallRadius, Math.min(6, actualRadius));
    }
    
    return {
      scale: scale,
      radius: actualRadius,
      showInternalLabel: scale >= 1.5,
      showExternalLabel: scale >= this.config.tinyThresholdScale,
      showMinimalMode: scale < this.config.tinyThresholdScale,
      fontSize: Math.max(10, Math.min(16, 12 * scale)),
      directionFontSize: Math.max(8, Math.min(12, 10 * scale)),
      labelOffset: Math.max(8, this.config.labelOffset * Math.min(scale, 1.5)),
      borderWidth: Math.max(1, Math.min(3, this.config.pointBorderWidth * scale))
    };
  }
  /**
   * 渲染当前图像的所有自定义标注
   */
  renderCustomAnnotations(currentImageId) {
    if (!currentImageId) return;
    
    const annotations = this.customAnnotationManager.getAnnotationsByImageId(currentImageId);
    if (annotations.length === 0 && !this.annotationTool.state.isCustomRegionDragging) return;
    
    // 获取显示策略
    const displayStrategy = this.getCustomAnnotationDisplayStrategy();
    
    // 按类型分组渲染
    const pointAnnotations = annotations.filter(ann => {
      const type = this.customAnnotationManager.getCustomType(ann.typeId);
      return type?.type === 'point';
    });
    
    const regionAnnotations = annotations.filter(ann => {
      const type = this.customAnnotationManager.getCustomType(ann.typeId);
      return type?.type === 'region';
    });
    
    // 先渲染区域，再渲染点（点在上层）
    regionAnnotations.forEach(annotation => {
      this.renderRegionAnnotation(annotation, displayStrategy);
    });
    
    pointAnnotations.forEach(annotation => {
      this.renderPointAnnotation(annotation, displayStrategy);
    });
    
    // 渲染拖拽预览
    this.renderDragPreview(displayStrategy);
  }

  /**
   * 渲染点标注
   */
  renderPointAnnotation(annotation, displayStrategy) {
    const customType = this.customAnnotationManager.getCustomType(annotation.typeId);
    if (!customType) return;
    
    const screenPos = this.annotationTool.imageToScreen(annotation.x, annotation.y);
    
    // 确定透明度
    let alpha = 1;
    if (this.hoveredAnnotation === annotation) {
      alpha = this.config.hoverAlpha;
    } else if (this.selectedAnnotation === annotation) {
      alpha = this.config.selectedAlpha;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    
    // 绘制点
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, displayStrategy.radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = customType.color;
    this.ctx.fill();
    
    // 绘制边框
    this.ctx.strokeStyle = this.config.pointBorderColor;
    this.ctx.lineWidth = displayStrategy.borderWidth;
    this.ctx.stroke();
    
    // 根据显示策略绘制标签
    if (displayStrategy.showInternalLabel) {
      // 在标注点内部显示序号
      this.ctx.fillStyle = this.config.pointBorderColor;
      this.ctx.font = `bold ${displayStrategy.fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(annotation.order.toString(), screenPos.x, screenPos.y);
    } else if (displayStrategy.showExternalLabel) {
      // 在标注点外部显示标签
      this.renderPointLabel(annotation, screenPos, customType, alpha, displayStrategy);
    } else if (displayStrategy.showMinimalMode) {
      // 极小模式：只显示标注点，悬停时显示详细信息
      if (this.hoveredAnnotation === annotation) {
        this.createTooltip(screenPos.x, screenPos.y, annotation.order, customType, annotation, displayStrategy);
      }
    }
    
    this.ctx.restore();
  }

  /**
   * 渲染区域标注
   */
  renderRegionAnnotation(annotation, displayStrategy) {
    const customType = this.customAnnotationManager.getCustomType(annotation.typeId);
    if (!customType) return;
    
    const topLeft = this.annotationTool.imageToScreen(annotation.x, annotation.y);
    const bottomRight = this.annotationTool.imageToScreen(
      annotation.x + annotation.width,
      annotation.y + annotation.height
    );
    
    const screenWidth = bottomRight.x - topLeft.x;
    const screenHeight = bottomRight.y - topLeft.y;
    
    // 确定透明度
    let alpha = 1;
    if (this.hoveredAnnotation === annotation) {
      alpha = this.config.hoverAlpha;
    } else if (this.selectedAnnotation === annotation) {
      alpha = this.config.selectedAlpha;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    
    // 绘制填充区域
    this.ctx.fillStyle = customType.color;
    this.ctx.globalAlpha = alpha * this.config.regionFillAlpha;
    this.ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    
    // 绘制边框（使用缩放相关的线宽）
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = customType.color;
    this.ctx.lineWidth = displayStrategy.borderWidth;
    this.ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    
    // 绘制编号（在区域中心）
    const centerX = topLeft.x + screenWidth / 2;
    const centerY = topLeft.y + screenHeight / 2;
    
    if (displayStrategy.showInternalLabel && Math.min(screenWidth, screenHeight) > 20) {
      // 在区域内部显示编号
      this.ctx.fillStyle = customType.color;
      this.ctx.font = `bold ${displayStrategy.fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(annotation.order.toString(), centerX, centerY);
    }
    
    // 绘制外部标签
    if (displayStrategy.showExternalLabel) {
      this.renderRegionLabel(annotation, { x: centerX, y: topLeft.y }, customType, alpha, displayStrategy);
    }
    
    this.ctx.restore();
  }

  /**
   * 渲染点标注标签
   */
  renderPointLabel(annotation, screenPos, customType, alpha, displayStrategy) {
    const labelY = screenPos.y - displayStrategy.radius - displayStrategy.labelOffset;
    
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    
    // 创建标签文本
    const labelText = `${customType.name} #${annotation.order}`;
    this.ctx.font = `${displayStrategy.fontSize}px Arial`;
    const textMetrics = this.ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    
    // 绘制标签背景
    const padding = 4;
    this.ctx.fillStyle = customType.color;
    this.ctx.fillRect(
      screenPos.x - textWidth / 2 - padding,
      labelY - displayStrategy.fontSize / 2 - padding,
      textWidth + padding * 2,
      displayStrategy.fontSize + padding * 2
    );
    
    // 绘制标签文本
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, screenPos.x, labelY);
    
    this.ctx.restore();
  }

  /**
   * 渲染区域标注标签
   */
  renderRegionLabel(annotation, screenPos, customType, alpha, displayStrategy) {
    const labelY = screenPos.y - displayStrategy.labelOffset;
    
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    
    // 创建标签文本
    const labelText = `${customType.name} #${annotation.order}`;
    this.ctx.font = `${displayStrategy.fontSize}px Arial`;
    const textMetrics = this.ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    
    // 绘制标签背景
    const padding = 4;
    this.ctx.fillStyle = customType.color;
    this.ctx.fillRect(
      screenPos.x - textWidth / 2 - padding,
      labelY - displayStrategy.fontSize / 2 - padding,
      textWidth + padding * 2,
      displayStrategy.fontSize + padding * 2
    );
    
    // 绘制标签文本
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, screenPos.x, labelY);
    
    this.ctx.restore();
  }

  /**
   * 检查鼠标位置是否在自定义标注上
   */
  getCustomAnnotationAt(screenPos, currentImageId) {
    if (!currentImageId) return null;
    
    const annotations = this.customAnnotationManager.getAnnotationsByImageId(currentImageId);
    
    // 按渲染顺序的反序检查（点在区域之上）
    const pointAnnotations = annotations.filter(ann => {
      const type = this.customAnnotationManager.getCustomType(ann.typeId);
      return type?.type === 'point';
    });
    
    const regionAnnotations = annotations.filter(ann => {
      const type = this.customAnnotationManager.getCustomType(ann.typeId);
      return type?.type === 'region';
    });
    
    // 先检查点标注
    for (const annotation of pointAnnotations) {
      if (this.isPointInAnnotation(screenPos, annotation)) {
        return annotation;
      }
    }
    
    // 再检查区域标注
    for (const annotation of regionAnnotations) {
      if (this.isPointInAnnotation(screenPos, annotation)) {
        return annotation;
      }
    }
    
    return null;
  }

  /**
   * 检查点是否在标注内
   */
  isPointInAnnotation(screenPos, annotation) {
    const customType = this.customAnnotationManager.getCustomType(annotation.typeId);
    if (!customType) return false;
    
    const displayStrategy = this.getCustomAnnotationDisplayStrategy();
    
    if (customType.type === 'point') {
      const annotationScreenPos = this.annotationTool.imageToScreen(annotation.x, annotation.y);
      const distance = Math.sqrt(
        Math.pow(screenPos.x - annotationScreenPos.x, 2) +
        Math.pow(screenPos.y - annotationScreenPos.y, 2)
      );
      return distance <= displayStrategy.radius + 5; // 5px tolerance
    } else if (customType.type === 'region') {
      const topLeft = this.annotationTool.imageToScreen(annotation.x, annotation.y);
      const bottomRight = this.annotationTool.imageToScreen(
        annotation.x + annotation.width,
        annotation.y + annotation.height
      );
      
      return screenPos.x >= topLeft.x && screenPos.x <= bottomRight.x &&
             screenPos.y >= topLeft.y && screenPos.y <= bottomRight.y;
    }
    
    return false;
  }

  /**
   * 设置悬停的标注
   */
  setHoveredAnnotation(annotation) {
    this.hoveredAnnotation = annotation;
  }

  /**
   * 设置选中的标注
   */
  setSelectedAnnotation(annotation) {
    this.selectedAnnotation = annotation;
  }

  /**
   * 获取悬停的标注
   */
  getHoveredAnnotation() {
    return this.hoveredAnnotation;
  }

  /**
   * 获取选中的标注
   */
  getSelectedAnnotation() {
    return this.selectedAnnotation;
  }

  /**
   * 清除悬停状态
   */
  clearHover() {
    this.hoveredAnnotation = null;
  }

  /**
   * 清除选中状态
   */
  clearSelection() {
    this.selectedAnnotation = null;
  }

  /**
   * 创建悬停提示
   */
  createTooltip(x, y, order, customType, annotation, displayStrategy) {
    // 只在极小模式下显示提示
    const canvas = this.canvas;
    const container = canvas.parentElement;
    
    // 移除已存在的提示
    const existingTooltip = container.querySelector('.custom-annotation-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // 创建提示元素
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-annotation-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
    `;
    
    const coordinateText = `(${Math.round(annotation.x)}, ${Math.round(annotation.y)})`;
    tooltip.innerHTML = `
      <div>${customType.name} #${order}</div>
      <div style="font-size: 10px; opacity: 0.8;">Position: ${coordinateText}</div>
    `;
    
    // 计算提示位置
    const rect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const offsetX = rect.left - containerRect.left;
    const offsetY = rect.top - containerRect.top;
    
    tooltip.style.left = (offsetX + x - 60) + 'px';
    tooltip.style.top = (offsetY + y - 60) + 'px';
    
    container.appendChild(tooltip);
    
    // 自动移除提示
    setTimeout(() => {
      if (tooltip.parentElement) {
        tooltip.remove();
      }
    }, 2000);
  }
  /**
   * 渲染拖拽预览（区域标注）
   */
  renderDragPreview(displayStrategy) {
    if (!this.annotationTool.state.isCustomRegionDragging) return;
    
    const startScreenPos = this.annotationTool.state.customRegionStartPoint;
    const currentScreenPos = this.annotationTool.state.customRegionCurrentPoint;
    
    if (!startScreenPos || !currentScreenPos) return;
    
    const customType = this.customAnnotationManager.getCurrentCustomType();
    if (!customType || customType.type !== 'region') return;
    
    const left = Math.min(startScreenPos.x, currentScreenPos.x);
    const top = Math.min(startScreenPos.y, currentScreenPos.y);
    const width = Math.abs(currentScreenPos.x - startScreenPos.x);
    const height = Math.abs(currentScreenPos.y - startScreenPos.y);
    
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;
    
    // 绘制预览填充
    this.ctx.fillStyle = customType.color;
    this.ctx.fillRect(left, top, width, height);
    
    // 绘制预览边框（使用缩放相关的线宽）
    this.ctx.strokeStyle = customType.color;
    this.ctx.lineWidth = displayStrategy ? displayStrategy.borderWidth : 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(left, top, width, height);
    
    // 绘制尺寸信息
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillStyle = '#000000';
    this.ctx.font = `${displayStrategy ? displayStrategy.fontSize : 12}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const sizeText = `${Math.round(width)}x${Math.round(height)}`;
    this.ctx.fillText(sizeText, left + width/2, top + height/2);
    
    this.ctx.restore();
  }

  /**
   * 渲染点预览（点标注）
   */
  renderPointPreview(screenPos, customType) {
    if (!customType || customType.type !== 'point') return;
    
    this.ctx.save();
    this.ctx.globalAlpha = 0.7;
    
    // 绘制预览点
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, this.config.pointRadius, 0, 2 * Math.PI);
    this.ctx.fillStyle = customType.color;
    this.ctx.fill();
    
    // 绘制预览边框
    this.ctx.strokeStyle = this.config.pointBorderColor;
    this.ctx.lineWidth = this.config.pointBorderWidth;
    this.ctx.setLineDash([3, 3]);
    this.ctx.stroke();
    
    // 绘制预览标签
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = this.config.pointBorderColor;
    this.ctx.font = `bold ${this.config.labelFontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('?', screenPos.x, screenPos.y);
    
    this.ctx.restore();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * 开始拖拽自定义标注
   */
  startDrag(annotation, screenPosition) {
    this.draggedAnnotation = annotation;
    this.dragStartPosition = {
      screen: screenPosition,
      annotation: {
        x: annotation.x,
        y: annotation.y,
        ...(annotation.width && { width: annotation.width }),
        ...(annotation.height && { height: annotation.height })
      }
    };
    this.dragCurrentPosition = screenPosition;
    this.isDragging = true;
    
    console.log('Started dragging custom annotation:', annotation.id);
  }
  
  /**
   * 更新拖拽位置
   */
  updateDrag(screenPosition) {
    if (!this.isDragging || !this.draggedAnnotation || !this.dragStartPosition) {
      return false;
    }
    
    this.dragCurrentPosition = screenPosition;
    
    // 计算拖拽偏移量
    const deltaX = screenPosition.x - this.dragStartPosition.screen.x;
    const deltaY = screenPosition.y - this.dragStartPosition.screen.y;
    
    // 转换为图像坐标偏移
    const imageDeltaX = deltaX / this.annotationTool.state.scale;
    const imageDeltaY = deltaY / this.annotationTool.state.scale;
    
    // 更新标注位置
    this.draggedAnnotation.x = this.dragStartPosition.annotation.x + imageDeltaX;
    this.draggedAnnotation.y = this.dragStartPosition.annotation.y + imageDeltaY;
    
    // 确保标注保持在图像边界内
    this.constrainAnnotationPosition(this.draggedAnnotation);
    
    return true;
  }
  
  /**
   * 完成拖拽
   */
  finishDrag() {
    if (!this.isDragging || !this.draggedAnnotation) {
      return null;
    }
    
    const draggedAnnotation = this.draggedAnnotation;
    const startPosition = this.dragStartPosition;
    
    // 检查是否有实际移动
    const moved = Math.abs(draggedAnnotation.x - startPosition.annotation.x) > 1 ||
                  Math.abs(draggedAnnotation.y - startPosition.annotation.y) > 1;
    
    // 清除拖拽状态
    this.draggedAnnotation = null;
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.isDragging = false;
    
    console.log('Finished dragging custom annotation:', draggedAnnotation.id, 'Moved:', moved);
    
    return {
      annotation: draggedAnnotation,
      moved: moved,
      startPosition: startPosition.annotation
    };
  }
  
  /**
   * 取消拖拽
   */
  cancelDrag() {
    if (!this.isDragging || !this.draggedAnnotation || !this.dragStartPosition) {
      return;
    }
    
    // 恢复原始位置
    this.draggedAnnotation.x = this.dragStartPosition.annotation.x;
    this.draggedAnnotation.y = this.dragStartPosition.annotation.y;
    
    if (this.dragStartPosition.annotation.width) {
      this.draggedAnnotation.width = this.dragStartPosition.annotation.width;
    }
    if (this.dragStartPosition.annotation.height) {
      this.draggedAnnotation.height = this.dragStartPosition.annotation.height;
    }
    
    // 清除拖拽状态
    this.draggedAnnotation = null;
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.isDragging = false;
    
    console.log('Cancelled dragging custom annotation');
  }
  
  /**
   * 约束标注位置在图像边界内
   */
  constrainAnnotationPosition(annotation) {
    if (!this.annotationTool.imageElement) return;
    
    const imageWidth = this.annotationTool.imageElement.width;
    const imageHeight = this.annotationTool.imageElement.height;
    
    // 约束位置
    annotation.x = Math.max(0, Math.min(imageWidth, annotation.x));
    annotation.y = Math.max(0, Math.min(imageHeight, annotation.y));
    
    // 对于区域标注，还需要约束尺寸
    if (annotation.width && annotation.height) {
      annotation.width = Math.min(annotation.width, imageWidth - annotation.x);
      annotation.height = Math.min(annotation.height, imageHeight - annotation.y);
    }
  }
  
  /**
   * 检查是否正在拖拽
   */
  isDraggingAnnotation() {
    return this.isDragging;
  }
  
  /**
   * 获取当前拖拽的标注
   */
  getDraggedAnnotation() {
    return this.draggedAnnotation;
  }
  
  /**
   * 渲染拖拽预览效果
   */
  renderDragPreview(displayStrategy) {
    if (!this.isDragging || !this.draggedAnnotation) return;
    
    const customType = this.customAnnotationManager.getCustomType(this.draggedAnnotation.typeId);
    if (!customType) return;
    
    // 绘制拖拽预览（半透明）
    this.ctx.save();
    this.ctx.globalAlpha = 0.6;
    
    if (customType.type === 'point') {
      this.renderPointAnnotation(this.draggedAnnotation, displayStrategy);
    } else if (customType.type === 'region') {
      this.renderRegionAnnotation(this.draggedAnnotation, displayStrategy);
    }
    
    this.ctx.restore();
  }
}