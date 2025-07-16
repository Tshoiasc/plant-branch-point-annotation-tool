/**
 * 分支点定位预览管理器
 * 
 * 功能：
 * - 在工作区左上角显示预览窗口
 * - 显示上一张图像的对应分支点位置
 * - 帮助标注者快速定位当前应该标注的位置
 * - 基于分支点序号的一致性逻辑
 */

export class BranchPointPreviewManager {
  constructor() {
    this.previewWindow = null;
    this.previewCanvas = null;
    this.previewCtx = null;
    this.previewTitle = null;
    this.previewLoading = null;
    this.noPreview = null;
    this.zoomSlider = null;
    this.zoomValue = null;
    this.plantDataManager = null;
    
    // 状态管理
    this.isVisible = false;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.windowStartX = 0;
    this.windowStartY = 0;
    this.zoomLevel = 2; // 默认2倍放大
    
    // 特定预览模式状态
    this.isShowingSpecificOrder = false; // 是否正在显示特定编号的预览
    this.specificTargetOrder = null; // 当前显示的特定编号
    
    // 上下文信息
    this.currentPlantId = null;
    this.currentViewAngle = null;
    this.currentImageIndex = -1;
    this.currentKeypointCount = 0; // 当前图像的标注点数量
    
    // 缓存数据，用于实时更新
    this.previousImageData = null;
    this.previousAnnotations = [];
    this.cachedImageElement = null; // 缓存加载的图像元素
    
    this.initializeElements();
  }

  /**
   * 初始化DOM元素
   */
  initializeElements() {
    this.previewWindow = document.getElementById('branch-point-preview');
    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewTitle = document.getElementById('preview-title');
    this.previewLoading = document.getElementById('preview-loading');
    this.noPreview = document.getElementById('no-preview');
    this.zoomSlider = document.getElementById('zoom-slider');
    this.zoomValue = document.getElementById('zoom-value');
    
    if (this.previewCanvas) {
      this.previewCtx = this.previewCanvas.getContext('2d');
      // 初始canvas尺寸
      this.updateCanvasSize();
      
      // 监听窗口大小变化
      const resizeObserver = new ResizeObserver(() => {
        this.updateCanvasSize();
        if (this.isVisible && this.previousImageData && this.previousAnnotations) {
          // 重新渲染预览
          this.renderPreview(this.previousImageData, this.previousAnnotations);
        }
      });
      
      if (this.previewWindow) {
        resizeObserver.observe(this.previewWindow);
      }
    }
    
    // 绑定缩放滑块事件
    this.bindZoomControls();
    
    // 绑定拖拽事件
    this.bindDragEvents();
    
    console.log('BranchPointPreviewManager 初始化完成');
  }

  /**
   * 更新canvas尺寸
   */
  updateCanvasSize() {
    if (!this.previewCanvas || !this.previewWindow) return;
    
    const container = this.previewCanvas.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const width = Math.max(100, containerRect.width - 4); // 减去padding
    const height = Math.max(80, containerRect.height - 4);
    
    // 只有在尺寸真正改变时才更新
    if (this.previewCanvas.width !== width || this.previewCanvas.height !== height) {
      this.previewCanvas.width = width;
      this.previewCanvas.height = height;
      this.previewCanvas.style.width = width + 'px';
      this.previewCanvas.style.height = height + 'px';
      
      console.log('Canvas尺寸更新:', width, 'x', height);
      
      // 尺寸改变后立即使用缓存数据重新渲染，避免白屏
      if (this.isVisible && this.cachedImageElement && this.previousAnnotations) {
        this.renderCachedPreview();
      } else if (this.isVisible && this.previousImageData && this.previousAnnotations) {
        // 如果没有缓存的图像元素，使用原始数据重新渲染
        setTimeout(() => {
          this.renderPreview(this.previousImageData, this.previousAnnotations);
        }, 50);
      }
    }
  }

  /**
   * 使用缓存的图像数据立即重新渲染预览
   */
  renderCachedPreview() {
    if (!this.cachedImageElement || !this.previousAnnotations || !this.previewCanvas || !this.previewCtx) {
      return;
    }
    
    // 获取下一个要标注的编号
    const nextOrder = this.getNextOrderToAnnotate();
    
    // 在上一张图像的标注中查找对应编号的标注点
    const targetAnnotation = this.previousAnnotations.find(annotation => annotation.order === nextOrder);
    
    // 如果没有对应编号的标注点，显示无预览
    if (!targetAnnotation) {
      this.showNoPreview(`上一张图像暂无第${nextOrder}个分支点`);
      return;
    }
    
    const img = this.cachedImageElement;
    
    try {
      // 计算局部区域（围绕目标标注点，根据缩放级别调整）
      const baseCropSize = 200; // 基础裁剪区域大小
      const cropSize = Math.round(baseCropSize / this.zoomLevel); // 根据缩放级别调整裁剪区域
      const centerX = targetAnnotation.x;
      const centerY = targetAnnotation.y;
      
      // 计算裁剪区域，确保不超出图像边界
      const cropX = Math.max(0, Math.min(img.width - cropSize, centerX - cropSize / 2));
      const cropY = Math.max(0, Math.min(img.height - cropSize, centerY - cropSize / 2));
      const actualCropWidth = Math.min(cropSize, img.width - cropX);
      const actualCropHeight = Math.min(cropSize, img.height - cropY);
      
      // 设置canvas尺寸
      const canvasWidth = this.previewCanvas.width;
      const canvasHeight = this.previewCanvas.height;
      
      // 清空canvas
      this.previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制局部放大图
      this.previewCtx.drawImage(
        img,
        cropX, cropY, actualCropWidth, actualCropHeight, // 源图裁剪区域
        0, 0, canvasWidth, canvasHeight // 目标区域
      );
      
      // 计算标注点在预览canvas中的位置
      const scaleX = canvasWidth / actualCropWidth;
      const scaleY = canvasHeight / actualCropHeight;
      const pointX = (centerX - cropX) * scaleX;
      const pointY = (centerY - cropY) * scaleY;
      
      // 绘制目标标注点（高亮）
      this.renderLocalizedAnnotation(pointX, pointY, nextOrder, targetAnnotation.direction);
      
      // 绘制其他标注点（如果在视图范围内）
      this.previousAnnotations.forEach((annotation) => {
        if (annotation.order === nextOrder) return; // 跳过目标点，已经绘制
        
        // 检查是否在裁剪区域内
        if (annotation.x >= cropX && annotation.x <= cropX + actualCropWidth &&
            annotation.y >= cropY && annotation.y <= cropY + actualCropHeight) {
          
          const otherX = (annotation.x - cropX) * scaleX;
          const otherY = (annotation.y - cropY) * scaleY;
          this.renderLocalizedAnnotation(otherX, otherY, annotation.order || 0, annotation.direction, false);
        }
      });
      
      // 绘制放大倍数提示
      this.renderZoomInfo(scaleX, scaleY);
      
      console.log('使用缓存数据快速重新渲染完成');
      
    } catch (error) {
      console.error('缓存渲染失败:', error);
      // 如果缓存渲染失败，回退到完整重新渲染
      if (this.previousImageData && this.previousAnnotations) {
        this.renderPreview(this.previousImageData, this.previousAnnotations);
      }
    }
  }

  /**
   * 绑定拖拽事件
   */
  bindDragEvents() {
    const header = document.querySelector('.preview-header');
    if (!header || !this.previewWindow) return;
    
    header.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startDrag(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.drag(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.endDrag();
    });
  }

  /**
   * 开始拖拽
   */
  startDrag(e) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    
    const rect = this.previewWindow.getBoundingClientRect();
    this.windowStartX = rect.left;
    this.windowStartY = rect.top;
    
    this.previewWindow.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  /**
   * 拖拽中
   */
  drag(e) {
    if (!this.isDragging) return;
    
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    
    const newX = this.windowStartX + deltaX;
    const newY = this.windowStartY + deltaY;
    
    // 限制在窗口范围内
    const maxX = window.innerWidth - this.previewWindow.offsetWidth;
    const maxY = window.innerHeight - this.previewWindow.offsetHeight;
    
    const constrainedX = Math.max(0, Math.min(maxX, newX));
    const constrainedY = Math.max(0, Math.min(maxY, newY));
    
    this.previewWindow.style.left = constrainedX + 'px';
    this.previewWindow.style.top = constrainedY + 'px';
  }

  /**
   * 结束拖拽
   */
  endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.previewWindow.style.cursor = '';
    document.body.style.userSelect = '';
  }

  /**
   * 设置植物数据管理器引用
   */
  setPlantDataManager(plantDataManager) {
    this.plantDataManager = plantDataManager;
  }

  /**
   * 显示/隐藏预览窗口
   */
  toggleVisibility(show = null) {
    if (!this.previewWindow) return;
    
    this.isVisible = show !== null ? show : !this.isVisible;
    
    if (this.isVisible) {
      this.previewWindow.classList.remove('hidden');
      this.updatePreview();
    } else {
      this.previewWindow.classList.add('hidden');
    }
    
    console.log(`分支点预览窗口: ${this.isVisible ? '显示' : '隐藏'}`);
  }

  /**
   * 更新当前上下文
   */
  async updateContext(plantId, viewAngle, imageIndex, currentKeypointCount = 0) {
    this.currentPlantId = plantId;
    this.currentViewAngle = viewAngle;
    this.currentImageIndex = imageIndex;
    this.currentKeypointCount = currentKeypointCount; // 当前图像的标注点数量
    
    if (this.isVisible) {
      await this.updatePreview();
    }
  }

  /**
   * 更新预览内容
   */
  async updatePreview() {
    if (!this.isVisible || !this.plantDataManager || !this.currentPlantId) {
      return;
    }
    
    try {
      this.showLoading(true);
      
      // 获取上一张图像
      const previousImageData = await this.getPreviousImage();
      
      if (!previousImageData) {
        this.showNoPreview('这是第一张图像');
        return;
      }
      
      // 获取上一张图像的标注数据
      const previousAnnotations = await this.plantDataManager.getImageAnnotations(previousImageData.id);
      
      if (!previousAnnotations || previousAnnotations.length === 0) {
        this.showNoPreview('上一张图像无标注');
        return;
      }
      
      // 更新预览标题
      this.updatePreviewTitle(previousImageData, previousAnnotations.length);
      
      // 渲染预览
      await this.renderPreview(previousImageData, previousAnnotations);
      
      this.showLoading(false);
      
    } catch (error) {
      console.error('更新分支点预览失败:', error);
      this.showNoPreview('预览加载失败');
    }
  }

  /**
   * 获取上一张图像
   */
  async getPreviousImage() {
    if (!this.plantDataManager || this.currentImageIndex <= 0) {
      return null;
    }
    
    try {
      const images = await this.plantDataManager.getPlantImages(
        this.currentPlantId, 
        this.currentViewAngle
      );
      
      const previousIndex = this.currentImageIndex - 1;
      return images[previousIndex] || null;
      
    } catch (error) {
      console.error('获取上一张图像失败:', error);
      return null;
    }
  }

  /**
   * 更新预览标题
   */
  updatePreviewTitle(imageData, annotationCount) {
    if (this.previewTitle) {
      const timeString = imageData.timeString || 'Unknown time';
      
      // 获取下一个要标注的编号（最小的缺失编号）
      const nextOrder = this.getNextOrderToAnnotate();
      
      this.previewTitle.textContent = `Reference: ${nextOrder}th branch point`;
      this.previewTitle.title = `${timeString} - Current need to annotate the position of the ${nextOrder}th branch point`;
    }
  }

  /**
   * 获取下一个要标注的编号（最小的缺失编号）- 支持自定义标注类型
   */
  getNextOrderToAnnotate() {
    // 从AnnotationTool获取下一个可用编号
    const annotationTool = window.PlantAnnotationTool?.annotationTool;
    if (!annotationTool) {
      console.warn('[预览] AnnotationTool不可用，使用后备方案');
      return this.currentKeypointCount + 1;
    }

    // 🔧 FIX: 检查是否处于自定义标注模式
    const customAnnotationManager = annotationTool.getCustomAnnotationManager();
    const isInCustomMode = customAnnotationManager?.isInCustomMode();
    
    if (isInCustomMode) {
      // 自定义标注模式：获取当前自定义类型的下一个编号
      const currentCustomType = customAnnotationManager.getCurrentCustomType();
      if (currentCustomType && typeof annotationTool.findNextAvailableOrderForType === 'function') {
        const nextOrder = annotationTool.findNextAvailableOrderForType(currentCustomType.id);
        console.log(`[预览] 自定义模式 - 从AnnotationTool获取${currentCustomType.id}类型的下一个编号: ${nextOrder}, 当前标注点数: ${this.currentKeypointCount}`);
        return nextOrder;
      }
    } else {
      // 常规标注模式：获取常规标注的下一个编号
      if (typeof annotationTool.findNextAvailableOrder === 'function') {
        const nextOrder = annotationTool.findNextAvailableOrder();
        console.log(`[预览] 常规模式 - 从AnnotationTool获取下一个编号: ${nextOrder}, 当前标注点数: ${this.currentKeypointCount}`);
        return nextOrder;
      }
    }

    // 后备方案：简单计算
    const fallbackOrder = this.currentKeypointCount + 1;
    console.log(`[预览] 使用后备方案计算下一个编号: ${fallbackOrder}, 当前标注点数: ${this.currentKeypointCount}`);
    return fallbackOrder;
  }

  /**
   * 渲染预览图像和标注
   */
  async renderPreview(imageData, annotations) {
    if (!this.previewCanvas || !this.previewCtx) return;
    
    // 获取下一个要标注的编号
    const nextOrder = this.getNextOrderToAnnotate();
    
    // 🔧 FIX: 根据当前标注模式进行不同的匹配逻辑
    const annotationTool = window.PlantAnnotationTool?.annotationTool;
    const customAnnotationManager = annotationTool?.getCustomAnnotationManager();
    const isInCustomMode = customAnnotationManager?.isInCustomMode();
    
    let targetAnnotation;
    let previewMessage;
    
    if (isInCustomMode) {
      // 自定义标注模式：匹配编号和自定义类型
      const currentCustomType = customAnnotationManager.getCurrentCustomType();
      if (currentCustomType) {
        targetAnnotation = annotations.find(annotation => 
          annotation.order === nextOrder && 
          annotation.annotationType === 'custom' && 
          annotation.customTypeId === currentCustomType.id
        );
        previewMessage = `上一张图像暂无第${nextOrder}个${currentCustomType.name}标注点`;
      } else {
        previewMessage = `上一张图像暂无第${nextOrder}个自定义标注点`;
      }
    } else {
      // 常规标注模式：只匹配编号和常规类型
      targetAnnotation = annotations.find(annotation => 
        annotation.order === nextOrder && 
        (annotation.annotationType === 'regular' || !annotation.annotationType)
      );
      previewMessage = `上一张图像暂无第${nextOrder}个分支点`;
    }
    
    // 如果没有对应的标注点，显示无预览
    if (!targetAnnotation) {
      this.showNoPreview(previewMessage);
      return;
    }
    
    this.hideLoading();
    this.hideNoPreview();
    
    try {
      console.log('开始加载预览图像:', imageData);
      
      // 获取图像URL的多种方式
      let imageURL;
      
      // 方式1：如果有file对象，直接使用
      if (imageData.file && imageData.file instanceof File) {
        imageURL = URL.createObjectURL(imageData.file);
        console.log('使用file对象创建URL:', imageURL);
      }
      // 方式2：如果有现成的URL
      else if (imageData.url) {
        imageURL = imageData.url;
        console.log('使用现有URL:', imageURL);
      }
      // 方式3：使用FileSystemManager (HTTP后端或传统文件系统)
      else if (this.plantDataManager?.fileSystemManager) {
        try {
          imageURL = await this.plantDataManager.fileSystemManager.createImageURL(imageData);
          console.log('使用FileSystemManager创建URL:', imageURL);
        } catch (error) {
          console.warn('FileSystemManager创建URL失败:', error);
          
          // 如果是传统文件系统，尝试直接从handle读取
          if (imageData.handle) {
            try {
              const file = await imageData.handle.getFile();
              imageURL = URL.createObjectURL(file);
              console.log('直接从handle创建URL:', imageURL);
            } catch (handleError) {
              console.error('从handle创建URL也失败:', handleError);
              throw new Error('无法获取图像数据：所有方法都失败');
            }
          } else {
            throw error;
          }
        }
      }
      else {
        throw new Error('无法获取图像数据：缺少必要的图像信息或文件系统管理器');
      }
      
      // 加载图像
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log('图像加载成功:', img.width, 'x', img.height);
          resolve();
        };
        img.onerror = (error) => {
          console.error('图像加载失败:', error);
          reject(new Error('图像加载失败'));
        };
        img.src = imageURL;
      });
      
      // 计算局部区域（围绕目标标注点，根据缩放级别调整）
      const baseCropSize = 200; // 基础裁剪区域大小
      const cropSize = Math.round(baseCropSize / this.zoomLevel); // 根据缩放级别调整裁剪区域
      const centerX = targetAnnotation.x;
      const centerY = targetAnnotation.y;
      
      // 计算裁剪区域，确保不超出图像边界
      const cropX = Math.max(0, Math.min(img.width - cropSize, centerX - cropSize / 2));
      const cropY = Math.max(0, Math.min(img.height - cropSize, centerY - cropSize / 2));
      const actualCropWidth = Math.min(cropSize, img.width - cropX);
      const actualCropHeight = Math.min(cropSize, img.height - cropY);
      
      // 设置canvas尺寸
      const canvasWidth = this.previewCanvas.width;
      const canvasHeight = this.previewCanvas.height;
      
      // 清空canvas
      this.previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制局部放大图
      this.previewCtx.drawImage(
        img,
        cropX, cropY, actualCropWidth, actualCropHeight, // 源图裁剪区域
        0, 0, canvasWidth, canvasHeight // 目标区域
      );
      
      // 计算标注点在预览canvas中的位置
      const scaleX = canvasWidth / actualCropWidth;
      const scaleY = canvasHeight / actualCropHeight;
      const pointX = (centerX - cropX) * scaleX;
      const pointY = (centerY - cropY) * scaleY;
      
      // 绘制目标标注点（高亮）
      this.renderLocalizedAnnotation(pointX, pointY, nextOrder, targetAnnotation.direction);
      
      // 绘制其他标注点（如果在视图范围内）
      annotations.forEach((annotation) => {
        if (annotation.order === nextOrder) return; // 跳过目标点，已经绘制
        
        // 检查是否在裁剪区域内
        if (annotation.x >= cropX && annotation.x <= cropX + actualCropWidth &&
            annotation.y >= cropY && annotation.y <= cropY + actualCropHeight) {
          
          const otherX = (annotation.x - cropX) * scaleX;
          const otherY = (annotation.y - cropY) * scaleY;
          this.renderLocalizedAnnotation(otherX, otherY, annotation.order || 0, annotation.direction, false);
        }
      });
      
      // 绘制放大倍数提示
      this.renderZoomInfo(scaleX, scaleY);
      
      // 缓存成功渲染的数据，用于实时更新
      this.previousImageData = imageData;
      this.previousAnnotations = annotations;
      this.cachedImageElement = img;
      
      // 清理临时URL
      if (imageURL && imageURL.startsWith('blob:') && !imageData.url) {
        setTimeout(() => URL.revokeObjectURL(imageURL), 5000);
      }
      
      console.log('预览渲染完成');
      
    } catch (error) {
      console.error('渲染预览失败:', error);
      this.showNoPreview(`预览加载失败: ${error.message}`);
    }
  }

  /**
   * 渲染局部化的标注点
   */
  renderLocalizedAnnotation(x, y, label, direction, isTarget = true) {
    // 根据是否为目标点设置样式
    let fillColor, radius, borderWidth;

    if (isTarget) {
      fillColor = '#ffeb3b'; // 黄色高亮
      radius = 5; // 缩小目标圆圈
      borderWidth = 2;

      // 绘制外圈提示（更小的虚线圆圈）
      this.previewCtx.beginPath();
      this.previewCtx.arc(x, y, radius + 3, 0, 2 * Math.PI);
      this.previewCtx.strokeStyle = '#ff9800';
      this.previewCtx.lineWidth = 1;
      this.previewCtx.setLineDash([2, 2]);
      this.previewCtx.stroke();
      this.previewCtx.setLineDash([]);
    } else {
      // 根据方向类型设置颜色
      if (typeof direction === 'number') {
        fillColor = '#4CAF50'; // 绿色表示角度方向
      } else {
        fillColor = direction === 'left' ? '#ff6666' : '#6666ff'; // 传统颜色
      }
      radius = 3;
      borderWidth = 1;
    }

    // 绘制标注点
    this.previewCtx.beginPath();
    this.previewCtx.arc(x, y, radius, 0, 2 * Math.PI);
    this.previewCtx.fillStyle = fillColor;
    this.previewCtx.fill();

    // 绘制边框
    this.previewCtx.strokeStyle = '#ffffff';
    this.previewCtx.lineWidth = borderWidth;
    this.previewCtx.stroke();

    // 绘制方向箭头（如果有方向信息）
    this.renderDirectionArrow(x, y, direction, isTarget);

    // 绘制序号
    this.previewCtx.fillStyle = isTarget ? '#000000' : '#ffffff';
    this.previewCtx.font = `bold ${isTarget ? 8 : 6}px Arial`;
    this.previewCtx.textAlign = 'center';
    this.previewCtx.textBaseline = 'middle';
    this.previewCtx.fillText(label.toString(), x, y);

    // 如果是目标点，添加小箭头指示
    if (isTarget) {
      this.previewCtx.fillStyle = '#ff9800';
      this.previewCtx.font = 'bold 8px Arial';
      this.previewCtx.fillText('▼', x, y - radius - 8);

      this.previewCtx.fillStyle = '#ff9800';
      this.previewCtx.font = 'bold 6px Arial';
      this.previewCtx.textAlign = 'center';
      this.previewCtx.fillText('目标', x, y + radius + 8);
    }
  }

  /**
   * 渲染方向箭头（与主标注区域样式一致）
   */
  renderDirectionArrow(x, y, direction, isTarget = false) {
    if (!direction) return;

    let angleDegrees;

    // 统一转换为角度
    if (typeof direction === 'number') {
      angleDegrees = direction;
    } else if (direction === 'left') {
      angleDegrees = 180;
    } else if (direction === 'right') {
      angleDegrees = 0;
    } else {
      return; // 无效方向
    }

    const angleRadians = angleDegrees * Math.PI / 180;

    // 根据是否为目标点调整尺寸
    const arrowLength = isTarget ? 15 : 10;
    const headLength = isTarget ? 4 : 3;
    const lineWidth = isTarget ? 2 : 1;

    // 计算箭头终点
    const endX = x + Math.cos(angleRadians) * arrowLength;
    const endY = y + Math.sin(angleRadians) * arrowLength;

    this.previewCtx.save();

    // 绘制虚线主线（绿色）
    this.previewCtx.strokeStyle = '#10b981'; // 与主标注区域相同的绿色
    this.previewCtx.lineWidth = lineWidth;
    this.previewCtx.setLineDash([4, 2]); // 虚线样式
    this.previewCtx.lineCap = 'round';

    this.previewCtx.beginPath();
    this.previewCtx.moveTo(x, y);
    this.previewCtx.lineTo(endX, endY);
    this.previewCtx.stroke();

    // 绘制箭头头部（实线）
    this.previewCtx.setLineDash([]);
    this.previewCtx.strokeStyle = '#10b981';
    this.previewCtx.lineWidth = lineWidth;
    this.previewCtx.lineCap = 'round';

    const headAngle1 = angleRadians + Math.PI * 0.8;
    const headAngle2 = angleRadians - Math.PI * 0.8;

    this.previewCtx.beginPath();
    this.previewCtx.moveTo(endX, endY);
    this.previewCtx.lineTo(endX + Math.cos(headAngle1) * headLength, endY + Math.sin(headAngle1) * headLength);
    this.previewCtx.moveTo(endX, endY);
    this.previewCtx.lineTo(endX + Math.cos(headAngle2) * headLength, endY + Math.sin(headAngle2) * headLength);
    this.previewCtx.stroke();

    this.previewCtx.restore();
  }

  /**
   * 渲染放大倍数信息
   */
  renderZoomInfo(scaleX, scaleY) {
    const actualScale = this.zoomLevel; // 使用用户设置的缩放级别
    const zoomText = `${actualScale}x放大`;
    
    this.previewCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.previewCtx.fillRect(5, 5, 60, 16);
    
    this.previewCtx.fillStyle = '#ffffff';
    this.previewCtx.font = '8px Arial';
    this.previewCtx.textAlign = 'left';
    this.previewCtx.textBaseline = 'middle';
    this.previewCtx.fillText(zoomText, 8, 13);
  }

  /**
   * 显示加载状态
   */
  showLoading(show) {
    if (this.previewLoading) {
      this.previewLoading.style.display = show ? 'block' : 'none';
    }
    if (this.noPreview) {
      this.noPreview.style.display = 'none';
    }
  }

  /**
   * 显示无预览状态
   */
  showNoPreview(message) {
    this.showLoading(false);
    if (this.noPreview) {
      this.noPreview.textContent = message;
      this.noPreview.style.display = 'block';
    }
    
    // 清空canvas
    if (this.previewCanvas && this.previewCtx) {
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }
  }

  /**
   * 当标注点变化时更新预览中的高亮
   */
  highlightCorrespondingPoints(currentAnnotations) {
    if (!this.isVisible || !currentAnnotations) return;
    
    // 这里可以实现高亮逻辑，比如当前正在标注的点在预览中特殊显示
    // 暂时简单重新渲染
    this.updatePreview();
  }

  /**
   * 获取指定编号的预期位置（用于自动切换功能）
   */
  async getExpectedPosition(targetOrder) {
    try {
      // 如果没有缓存的预览数据，先更新预览
      if (!this.previousImageData || !this.previousAnnotations) {
        console.log(`[预期位置] 没有缓存的预览数据，尝试获取上一张图像`);

        // 获取上一张图像
        const previousImageData = await this.getPreviousImage();
        if (!previousImageData) {
          console.log(`[预期位置] 没有上一张图像数据`);
          return null;
        }

        // 获取上一张图像的标注数据
        const previousAnnotations = await this.plantDataManager.getImageAnnotations(previousImageData.id);
        if (!previousAnnotations || previousAnnotations.length === 0) {
          console.log(`[预期位置] 上一张图像没有标注`);
          return null;
        }

        // 更新缓存
        this.previousImageData = previousImageData;
        this.previousAnnotations = previousAnnotations;
      }

      // 在上一张图像的标注中查找对应编号的标注点
      const targetAnnotation = this.previousAnnotations.find(annotation => annotation.order === targetOrder);

      if (!targetAnnotation) {
        console.log(`[预期位置] 上一张图像中未找到编号${targetOrder}的标注点`);
        return null;
      }

      console.log(`[预期位置] 找到编号${targetOrder}的参考位置: (${targetAnnotation.x.toFixed(1)}, ${targetAnnotation.y.toFixed(1)})`);

      return {
        x: targetAnnotation.x,
        y: targetAnnotation.y,
        order: targetAnnotation.order,
        sourceImage: this.previousImageData.timeString || '上一张图像'
      };

    } catch (error) {
      console.error('[预期位置] 获取预期位置失败:', error);
      return null;
    }
  }

  /**
   * 重置预览状态
   */
  reset() {
    this.currentPlantId = null;
    this.currentViewAngle = null;
    this.currentImageIndex = -1;
    this.previousImageData = null;
    this.previousAnnotations = [];
    
    if (this.isVisible) {
      this.showNoPreview('Please choose an image');
    }
  }

  /**
   * 获取预览状态
   */
  getStatus() {
    return {
      isVisible: this.isVisible,
      currentPlantId: this.currentPlantId,
      currentViewAngle: this.currentViewAngle,
      currentImageIndex: this.currentImageIndex,
      hasPreviousData: this.previousImageData !== null
    };
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    this.showLoading(false);
  }

  /**
   * 隐藏无预览状态
   */
  hideNoPreview() {
    if (this.noPreview) {
      this.noPreview.style.display = 'none';
    }
  }

  /**
   * 绑定缩放控制事件
   */
  bindZoomControls() {
    if (!this.zoomSlider || !this.zoomValue) return;
    
    this.zoomSlider.addEventListener('input', (e) => {
      this.zoomLevel = parseFloat(e.target.value);
      this.zoomValue.textContent = this.zoomLevel + 'x';
      
      // 立即使用缓存数据重新渲染，避免延迟
      if (this.isVisible && this.cachedImageElement && this.previousAnnotations) {
        this.renderCachedPreview();
      } else if (this.isVisible && this.previousImageData && this.previousAnnotations) {
        // 如果没有缓存，回退到完整重新渲染
        this.renderPreview(this.previousImageData, this.previousAnnotations);
      }
    });
    
    // 设置初始值
    this.zoomSlider.value = this.zoomLevel;
    this.zoomValue.textContent = this.zoomLevel + 'x';
  }

  /**
   * 显示特定编号的预览（拖动时使用）
   */
  async showSpecificOrderPreview(targetOrder) {
    if (!this.isVisible || !this.plantDataManager || !this.currentPlantId) {
      return;
    }
    
    // 标记当前处于特定预览模式
    this.isShowingSpecificOrder = true;
    this.specificTargetOrder = targetOrder;
    
    try {
      // 获取上一张图像
      const previousImageData = await this.getPreviousImage();
      
      if (!previousImageData) {
        this.showNoPreview('这是第一张图像');
        return;
      }
      
      // 获取上一张图像的标注数据
      const previousAnnotations = await this.plantDataManager.getImageAnnotations(previousImageData.id);
      
      if (!previousAnnotations || previousAnnotations.length === 0) {
        this.showNoPreview('上一张图像无标注');
        return;
      }
      
      // 查找对应编号的标注点
      const targetAnnotation = previousAnnotations.find(annotation => annotation.order === targetOrder);
      
      if (!targetAnnotation) {
        this.showNoPreview(`上一张图像无第${targetOrder}个分支点`);
        return;
      }
      
      // 更新预览标题
      this.updateSpecificPreviewTitle(previousImageData, targetOrder);
      
      // 渲染特定编号的预览
      await this.renderSpecificOrderPreview(previousImageData, previousAnnotations, targetOrder);
      
    } catch (error) {
      console.error('显示特定编号预览失败:', error);
      this.showNoPreview('预览加载失败');
    }
  }

  /**
   * 恢复正常预览显示
   */
  async restoreNormalPreview() {
    // 清除特定预览模式标记
    this.isShowingSpecificOrder = false;
    this.specificTargetOrder = null;
    
    // 恢复到正常的预览更新
    await this.updatePreview();
  }

  /**
   * 更新特定预览的标题
   */
  updateSpecificPreviewTitle(imageData, targetOrder) {
    if (this.previewTitle) {
      const timeString = imageData.timeString || '未知时间';
      this.previewTitle.textContent = `拖动中: 第${targetOrder}个分支点`;
      this.previewTitle.title = `${timeString} - 正在拖动第${targetOrder}个分支点，参考上一张图像位置`;
    }
  }

  /**
   * 渲染特定编号的预览
   */
  async renderSpecificOrderPreview(imageData, annotations, targetOrder) {
    if (!this.previewCanvas || !this.previewCtx) return;
    
    // 查找目标标注点
    const targetAnnotation = annotations.find(annotation => annotation.order === targetOrder);
    
    if (!targetAnnotation) {
      this.showNoPreview(`上一张图像暂无第${targetOrder}个分支点`);
      return;
    }
    
    this.hideLoading();
    this.hideNoPreview();
    
    try {
      console.log('渲染特定编号预览:', targetOrder);
      
      // 获取图像URL的多种方式（与renderPreview保持一致）
      let imageURL;
      
      // 方式1：如果有file对象，直接使用
      if (imageData.file && imageData.file instanceof File) {
        imageURL = URL.createObjectURL(imageData.file);
      }
      // 方式2：如果有现成的URL
      else if (imageData.url) {
        imageURL = imageData.url;
      }
      // 方式3：使用FileSystemManager (HTTP后端或传统文件系统)
      else if (this.plantDataManager?.fileSystemManager) {
        try {
          imageURL = await this.plantDataManager.fileSystemManager.createImageURL(imageData);
        } catch (error) {
          console.warn('FileSystemManager创建URL失败:', error);
          
          // 如果是传统文件系统，尝试直接从handle读取
          if (imageData.handle) {
            try {
              const file = await imageData.handle.getFile();
              imageURL = URL.createObjectURL(file);
            } catch (handleError) {
              console.error('从handle创建URL也失败:', handleError);
              throw new Error('无法获取图像数据：所有方法都失败');
            }
          } else {
            throw error;
          }
        }
      }
      else {
        throw new Error('无法获取图像数据：缺少必要的图像信息或文件系统管理器');
      }
      
      // 加载图像
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图像加载失败'));
        img.src = imageURL;
      });
      
      // 计算局部区域
      const baseCropSize = 200;
      const cropSize = Math.round(baseCropSize / this.zoomLevel);
      const centerX = targetAnnotation.x;
      const centerY = targetAnnotation.y;
      
      const cropX = Math.max(0, Math.min(img.width - cropSize, centerX - cropSize / 2));
      const cropY = Math.max(0, Math.min(img.height - cropSize, centerY - cropSize / 2));
      const actualCropWidth = Math.min(cropSize, img.width - cropX);
      const actualCropHeight = Math.min(cropSize, img.height - cropY);
      
      const canvasWidth = this.previewCanvas.width;
      const canvasHeight = this.previewCanvas.height;
      
      // 清空canvas
      this.previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制局部放大图
      this.previewCtx.drawImage(
        img,
        cropX, cropY, actualCropWidth, actualCropHeight,
        0, 0, canvasWidth, canvasHeight
      );
      
      // 计算标注点位置
      const scaleX = canvasWidth / actualCropWidth;
      const scaleY = canvasHeight / actualCropHeight;
      const pointX = (centerX - cropX) * scaleX;
      const pointY = (centerY - cropY) * scaleY;
      
      // 绘制目标标注点（特殊高亮）
      this.renderDraggedAnnotation(pointX, pointY, targetOrder, targetAnnotation.direction);
      
      // 绘制其他标注点
      annotations.forEach((annotation) => {
        if (annotation.order === targetOrder) return;
        
        if (annotation.x >= cropX && annotation.x <= cropX + actualCropWidth &&
            annotation.y >= cropY && annotation.y <= cropY + actualCropHeight) {
          
          const otherX = (annotation.x - cropX) * scaleX;
          const otherY = (annotation.y - cropY) * scaleY;
          this.renderLocalizedAnnotation(otherX, otherY, annotation.order || 0, annotation.direction, false);
        }
      });
      
      // 绘制放大倍数提示
      this.renderZoomInfo(scaleX, scaleY);
      
      // 清理临时URL
      if (imageURL && imageURL.startsWith('blob:') && !imageData.url) {
        setTimeout(() => URL.revokeObjectURL(imageURL), 5000);
      }
      
      console.log('特定编号预览渲染完成');
      
    } catch (error) {
      console.error('渲染特定编号预览失败:', error);
      this.showNoPreview(`预览加载失败: ${error.message}`);
    }
  }

  /**
   * 渲染被拖动的标注点（特殊样式）
   */
  renderDraggedAnnotation(x, y, label, direction) {
    // 使用特殊的颜色和样式表示正在拖动
    const fillColor = '#ff9800'; // 橙色表示拖动状态
    const radius = 6;
    const borderWidth = 3;
    
    // 绘制脉冲效果的外圈
    this.previewCtx.beginPath();
    this.previewCtx.arc(x, y, radius + 5, 0, 2 * Math.PI);
    this.previewCtx.strokeStyle = '#ff9800';
    this.previewCtx.lineWidth = 2;
    this.previewCtx.setLineDash([3, 3]);
    this.previewCtx.stroke();
    this.previewCtx.setLineDash([]);
    
    // 绘制主标注点
    this.previewCtx.beginPath();
    this.previewCtx.arc(x, y, radius, 0, 2 * Math.PI);
    this.previewCtx.fillStyle = fillColor;
    this.previewCtx.fill();
    
    // 绘制边框
    this.previewCtx.strokeStyle = '#ffffff';
    this.previewCtx.lineWidth = borderWidth;
    this.previewCtx.stroke();

    // 绘制方向箭头（如果有方向信息）
    this.renderDirectionArrow(x, y, direction, true);

    // 绘制序号
    this.previewCtx.fillStyle = '#000000';
    this.previewCtx.font = 'bold 9px Arial';
    this.previewCtx.textAlign = 'center';
    this.previewCtx.textBaseline = 'middle';
    this.previewCtx.fillText(label.toString(), x, y);
    
    // 添加拖动指示
    this.previewCtx.fillStyle = '#ff9800';
    this.previewCtx.font = 'bold 7px Arial';
    this.previewCtx.fillText('拖动中', x, y + radius + 12);
  }
} 