/**
 * 标注工具组件
 * 
 * 功能：
 * - Canvas图像渲染和缩放
 * - 触摸板缩放支持 (0.1x-10x)
 * - 关键点添加、删除、拖拽
 * - 撤销/重做功能
 * - 视图状态管理
 */

export class AnnotationTool {
  constructor(canvasId, options = {}) {
    console.log('[调试] AnnotationTool 构造函数被调用', { canvasId, timestamp: Date.now() });

    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.options = {
      minZoom: 0.1,
      maxZoom: 10,
      zoomSpeed: 0.1,
      // 标注点基础配置
      baseKeypointRadius: 8,               // 基础标注点半径
      minKeypointRadius: 4,                // 最小标注点半径  
      maxKeypointRadius: 20,               // 最大标注点半径
      keypointScaleFactor: 0.8,            // 标注点缩放因子
      // 颜色配置
      keypointLeftColor: '#ff4444',        // 左侧关键点颜色
      keypointRightColor: '#4444ff',       // 右侧关键点颜色
      keypointHoverColor: '#ff6666',
      keypointSelectedColor: '#ffaa00',    // 选中关键点颜色
      keypointBorderColor: '#ffffff',
      keypointBorderWidth: 2,
      // 标签显示配置
      labelThresholdScale: 0.6,            // 标签外部显示的缩放阈值
      tinyThresholdScale: 0.3,             // 极小显示模式的缩放阈值
      labelOffset: 15,                     // 外部标签偏移距离
      // 方向标注配置
      directionThreshold: 20,              // 最小拖拽距离阈值
      directionArrowLength: 40,            // 方向箭头长度
      ...options
    };
    
    // 状态管理
    this.state = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      isPanning: false,
      lastPanPoint: null,
      // 新增：方向标注状态
      isDirectionDragging: false,
      dragStartPoint: null,
      currentDragPoint: null,
      previewKeypoint: null,
      // 新增：选中和方向选择状态
      selectedKeypoint: null,               // 当前选中的关键点
      isDirectionSelectionMode: false,     // 是否处于方向选择模式
      directionSelectionPoint: null,       // 方向选择的鼠标位置
      // 新增：自动化方向选择状态
      isAutoDirectionMode: false,          // 是否处于自动化方向选择模式
      autoDirectionIndex: 0,               // 当前自动选择的关键点索引
      autoDirectionKeypoints: [],          // 需要自动选择方向的关键点列表
      // 🔧 NEW: 多方向标注状态
      isDirectionCountMode: false,         // 是否处于方向数量选择模式
      currentDirectionCount: 1,            // 当前方向数量
      directionsSet: 0,                    // 已设置的方向数量
      // 新增：自动切换到预期位置
      autoMoveToExpectedPosition: false,   // 是否自动切换到预期位置
      // 新增：自定义区域拖拽状态
      isCustomRegionDragging: false,       // 是否正在拖拽自定义区域
      customRegionStartPoint: null,        // 区域拖拽开始点
      customRegionCurrentPoint: null       // 区域拖拽当前点
    };
    
    // 图像相关
    this.currentImage = null;
    this.imageElement = null;
    this.imageLoaded = false;
    
    // 标注数据
    this.keypoints = [];
    this.hoveredKeypoint = null;
    this.draggedKeypoint = null;
    
    // 历史管理（撤销/重做）
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    
    // 自定义标注系统
    this.customAnnotationManager = null;
    this.customAnnotationRenderer = null;
    
    // 自定义标注拖拽状态
    this.customAnnotationDragState = {
      isDragging: false,
      draggedAnnotation: null,
      startPosition: null
    };
    
    // 绑定事件
    this.bindEvents();
    
    // 初始化Canvas
    this.initializeCanvas();
    
    // 初始化自定义标注系统 - 异步但立即开始
    this.initializeCustomAnnotationSystem();
    
    console.log('AnnotationTool initialized with advanced direction annotation support and custom annotations');
  }

  /**
   * 初始化Canvas
   */
  initializeCanvas() {
    // 🔧 FIX: Add resize state tracking and debouncing
    this.resizeState = {
      isResizing: false,
      lastResizeTime: 0,
      debounceTimeout: null,
      dimensionsHistory: []
    };
    
    // 延迟设置Canvas尺寸，确保容器已正确渲染
    setTimeout(() => {
      this.resizeCanvasWithRetry();
    }, 200);
    
    // 设置Canvas样式
    this.canvas.style.cursor = 'crosshair';
    
    // 🔧 FIX: Debounced window resize listener to prevent excessive resizing
    window.addEventListener('resize', () => {
      this.debouncedResize();
    });
  }

  /**
   * 带重试机制的Canvas尺寸调整
   */
  resizeCanvasWithRetry(retryCount = 0) {
    const maxRetries = 10;
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // 检查容器尺寸是否有效
    if (rect.width === 0 || rect.height === 0) {
      if (retryCount < maxRetries) {
        console.warn(`Canvas容器尺寸为0，延迟重试... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          this.resizeCanvasWithRetry(retryCount + 1);
        }, 300); // 增加重试间隔
        return;
      } else {
        console.error('Canvas容器尺寸始终为0，使用默认尺寸');
        // 使用默认尺寸
        this.canvas.width = 600;
        this.canvas.height = 400;
        this.canvas.style.width = '600px';
        this.canvas.style.height = '400px';
        this.render();
        return;
      }
    }
    
    // 设置正确的尺寸
    this.resizeCanvas();
    this.render();
  }

  /**
   * 🔧 ENHANCED: Debounced resize handler to prevent resize loops
   */
  debouncedResize() {
    const now = Date.now();
    
    // 🔧 FIX: Prevent resize loops with timing checks
    if (this.resizeState.isResizing && (now - this.resizeState.lastResizeTime) < 100) {
      console.debug('Resize loop detected, skipping resize');
      return;
    }
    
    // Clear existing debounce timeout
    if (this.resizeState.debounceTimeout) {
      clearTimeout(this.resizeState.debounceTimeout);
    }
    
    // Debounce resize calls
    this.resizeState.debounceTimeout = setTimeout(() => {
      this.resizeCanvas();
      this.render();
    }, 150); // 150ms debounce
  }

  /**
   * 调整Canvas尺寸 - Enhanced with loop prevention
   */
  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // 确保容器有有效尺寸
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Canvas容器尺寸无效，跳过调整');
      return;
    }
    
    // 🔧 FIX: Prevent resize loops by checking if dimensions actually changed
    const currentDimensions = `${rect.width}x${rect.height}`;
    const history = this.resizeState.dimensionsHistory;
    
    // Check if we're oscillating between dimensions
    if (history.length >= 3) {
      const recent = history.slice(-3);
      if (recent.includes(currentDimensions) && recent.filter(d => d === currentDimensions).length >= 2) {
        console.warn(`Canvas resize oscillation detected (${currentDimensions}), stabilizing...`);
        return;
      }
    }
    
    // Record dimension change
    history.push(currentDimensions);
    if (history.length > 5) {
      history.shift(); // Keep only recent 5 changes
    }
    
    // 🔧 FIX: Set resize state to prevent recursive calls
    this.resizeState.isResizing = true;
    this.resizeState.lastResizeTime = Date.now();
    
    try {
      // 设置Canvas实际尺寸
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      
      // 设置Canvas显示尺寸
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      
      console.log(`Canvas resized to ${rect.width}x${rect.height}`);
      
      // 🔧 FIX: Only call fitToScreen if not already in resize process
      if (this.imageLoaded && this.imageElement && !this.resizeState.fittingToScreen) {
        this.safeFitToScreen();
      }
    } finally {
      // Reset resize state after a delay
      setTimeout(() => {
        this.resizeState.isResizing = false;
      }, 200);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    console.log('[调试] bindEvents 被调用，绑定鼠标事件监听器', { timestamp: Date.now() });

    // 鼠标事件
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    
    // 触摸板缩放
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    
    // 键盘事件
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // 防止上下文菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * 加载图像
   * @param {Object} imageData - 图像数据
   * @param {boolean} preserveView - 是否保持当前视图状态（缩放和位置）
   */
  async loadImage(imageData, preserveView = false) {
    try {
      console.log('Loading image:', imageData.name);
      
      // 🔧 NEW: 图像切换时中断所有方向相关模式
      this.interruptAllDirectionModes('image_switch');
      
      this.currentImage = imageData;
      this.imageLoaded = false;
      
      // 检查plantDataManager是否可用
      if (!window.PlantAnnotationTool || !window.PlantAnnotationTool.plantDataManager) {
        throw new Error('PlantDataManager未初始化，请刷新页面重试');
      }
      
      const plantDataManager = window.PlantAnnotationTool.plantDataManager;
      
      if (!plantDataManager.fileSystemManager) {
        throw new Error('FileSystemManager未初始化，请刷新页面重试');
      }
      
      // 获取图像URL
      const imageURL = await plantDataManager.fileSystemManager.createImageURL(imageData);
      
      // 创建图像元素
      this.imageElement = new Image();
      
      return new Promise((resolve, reject) => {
        this.imageElement.onload = () => {
          this.imageLoaded = true;
          console.log(`Image loaded: ${this.imageElement.width}x${this.imageElement.height}`);

          // 根据preserveView参数决定是否重置视图
          if (!preserveView) {
            // 🔧 FIX: Use safe fit to screen to prevent resize loops
            this.safeFitToScreen();
            console.log('重置视图到适合屏幕');
          } else {
            console.log('保持当前视图状态');
          }

          // 注意：不再自动清空标注点，让外部调用者决定是否需要清空
          // this.clearKeypoints(); // 移除这行

          // 渲染
          this.render();

          resolve();
        };
        
        this.imageElement.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        this.imageElement.src = imageURL;
      });
      
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  }

  /**
   * 🔧 ENHANCED: Safe fit to screen with loop prevention
   */
  safeFitToScreen() {
    // Prevent recursive fit-to-screen calls
    if (this.resizeState.fittingToScreen) {
      console.debug('fitToScreen already in progress, skipping');
      return;
    }
    
    this.resizeState.fittingToScreen = true;
    
    try {
      this.fitToScreen();
    } finally {
      // Reset flag after processing
      setTimeout(() => {
        this.resizeState.fittingToScreen = false;
      }, 50);
    }
  }

  /**
   * 适应屏幕尺寸 - Enhanced with stability checks
   */
  fitToScreen() {
    if (!this.imageElement || !this.imageLoaded) return;
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const imageWidth = this.imageElement.width;
    const imageHeight = this.imageElement.height;
    
    // 🔧 FIX: Validate canvas and image dimensions
    if (canvasWidth <= 0 || canvasHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      console.warn('Invalid dimensions for fit to screen, skipping');
      return;
    }
    
    // 计算缩放比例（保持宽高比）
    const scaleX = (canvasWidth * 0.9) / imageWidth;
    const scaleY = (canvasHeight * 0.9) / imageHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // 🔧 FIX: Add scale change detection to prevent unnecessary updates
    const newScale = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, scale));
    const scaleChange = Math.abs(newScale - this.state.scale);
    
    // Only update if scale change is significant (more than 1%)
    if (scaleChange > 0.01) {
      this.state.scale = newScale;
      
      // 居中显示
      this.state.translateX = (canvasWidth - imageWidth * this.state.scale) / 2;
      this.state.translateY = (canvasHeight - imageHeight * this.state.scale) / 2;
      
      this.updateZoomInfo();
      console.log(`Fit to screen: scale=${this.state.scale.toFixed(2)} (change: ${scaleChange.toFixed(3)})`);
    } else {
      console.debug(`Scale change too small (${scaleChange.toFixed(3)}), skipping update`);
    }
  }

  /**
   * 重置视图
   */
  resetView() {
    if (!this.imageElement || !this.imageLoaded) return;
    
    this.state.scale = 1;
    this.state.translateX = 0;
    this.state.translateY = 0;
    
    this.updateZoomInfo();
    this.render();
  }

  /**
   * 清空图像和重置视图 - 用于植物切换时完全清空工作区
   */
  clearImage() {
    console.log('清空图像和重置视图');
    
    // 🔧 NEW: 植物切换时中断所有方向相关模式
    this.interruptAllDirectionModes('plant_switch');
    
    // 清空图像相关状态
    this.currentImage = null;
    this.imageElement = null;
    this.imageLoaded = false;
    
    // 重置视图状态
    this.state.scale = 1;
    this.state.translateX = 0;
    this.state.translateY = 0;
    
    // 🔧 FIX: 清空标注点但不触发自动保存（防止覆盖已保存的数据）
    this.clearKeypointsWithoutSave();
    
    // 🔧 FIX: Additional safety - clear any keypoint labels that might remain
    this.clearKeypointLabels();
    
    // 更新显示
    this.updateZoomInfo();
    this.render(); // 现在会显示占位符而不是图像和标注点
  }

  /**
   * 渲染Canvas
   */
  render() {
    // 清空Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.imageElement || !this.imageLoaded) {
      this.renderPlaceholder();
      return;
    }
    
    // 保存Canvas状态
    this.ctx.save();
    
    // 应用变换
    this.ctx.translate(this.state.translateX, this.state.translateY);
    this.ctx.scale(this.state.scale, this.state.scale);
    
    // 绘制图像
    this.ctx.drawImage(this.imageElement, 0, 0);
    
    // 恢复Canvas状态
    this.ctx.restore();
    
    // 绘制标注点（在变换后绘制，保持固定大小）
    this.renderKeypoints();
    
    // 绘制自定义标注
    this.renderCustomAnnotations();
  }

  /**
   * 渲染占位符
   */
  renderPlaceholder() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.ctx.fillStyle = '#f3f4f6';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#6b7280';
    this.ctx.font = '16px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Please choose image to annotate', centerX, centerY);
  }

  /**
   * 渲染标注点（统一版本，支持自定义类型）
   */
  renderKeypoints() {
    // 🔧 FIX: Don't render keypoints when no image is loaded to prevent "ghost" annotations
    if (!this.imageElement || !this.imageLoaded) {
      console.log('[AnnotationTool] Skipping keypoint render - no image loaded');
      return;
    }
    
    // 清除所有标签元素
    this.clearKeypointLabels();
    
    // 获取当前的显示策略
    const displayStrategy = this.getKeypointDisplayStrategy();
    
    // 渲染已存在的标注点
    this.keypoints.forEach((keypoint, index) => {
      const screenPos = this.imageToScreen(keypoint.x, keypoint.y);
      
      // 🔄 NEW: 统一渲染系统 - 支持自定义类型
      if (keypoint.annotationType === 'custom') {
        this.renderCustomKeypoint(keypoint, screenPos, displayStrategy);
      } else {
        this.renderRegularKeypoint(keypoint, screenPos, displayStrategy, index);
      }
    });
    
    // 渲染拖拽预览
    if (this.state.isDirectionDragging && this.state.previewKeypoint) {
      const previewPos = this.imageToScreen(this.state.previewKeypoint.x, this.state.previewKeypoint.y);
      const direction = this.state.previewKeypoint.direction;
      const fillColor = direction === 'left' ? this.options.keypointLeftColor : this.options.keypointRightColor;
      
      // 半透明预览
      this.ctx.globalAlpha = 0.7;
      this.renderSingleKeypoint(previewPos.x, previewPos.y, fillColor, '?', direction, displayStrategy);
      this.ctx.globalAlpha = 1.0;
      
      // 绘制拖拽指示器
      this.renderDragIndicator();
    }
    
    // 渲染自定义区域拖拽预览
    if (this.state.isCustomRegionDragging) {
      this.renderCustomRegionPreview();
    }
    
    // 渲染方向选择指引
    if (this.state.isDirectionSelectionMode && this.state.selectedKeypoint && this.state.directionSelectionPoint) {
      this.renderDirectionSelectionGuide();
    }
    
    // 更新缩放级别指示器
    this.updateZoomIndicator(displayStrategy);
    
    // 更新标注点大小信息
    this.updateAnnotationSizeInfo(displayStrategy);
  }

  /**
   * 🔄 NEW: 渲染常规标注点
   */
  renderRegularKeypoint(keypoint, screenPos, displayStrategy, index) {
    // 确定颜色（根据方向和选中状态）
    const isHovered = this.hoveredKeypoint === keypoint;
    const isSelected = this.state.selectedKeypoint === keypoint;
    let fillColor;
    
    if (isSelected) {
      fillColor = this.options.keypointSelectedColor;
    } else if (isHovered) {
      fillColor = this.options.keypointHoverColor;
    } else if (keypoint.directionType === 'angle' || typeof keypoint.direction === 'number') {
      // 角度类型使用特殊颜色
      fillColor = '#00aa00'; // 绿色表示已设置角度
    } else if (keypoint.direction === 'left') {
      fillColor = this.options.keypointLeftColor;
    } else if (keypoint.direction === 'right') {
      fillColor = this.options.keypointRightColor;
    } else {
      // 无方向标注点使用紫色
      fillColor = '#9333ea'; // 紫色表示无方向
    }
    
    // 使用标注点的序号，如果没有则使用索引+1作为后备
    const displayOrder = keypoint.order || (index + 1);
    
    this.renderSingleKeypoint(screenPos.x, screenPos.y, fillColor, displayOrder, keypoint.direction, displayStrategy, keypoint);

    // 🔧 NEW: 绘制多方向箭头（如果有多个方向）
    if (keypoint.directions && keypoint.directions.length > 1) {
      this.renderMultipleDirections(keypoint);
    } else {
      // 绘制单一方向箭头（支持所有类型的方向）
      this.renderDirectionIndicator(screenPos.x, screenPos.y, keypoint.direction, keypoint);
    }
  }
  
  /**
   * 🔄 NEW: 渲染自定义标注点
   */
  renderCustomKeypoint(keypoint, screenPos, displayStrategy) {
    const customType = this.getCustomType(keypoint.customTypeId);
    if (!customType) {
      console.warn(`Custom type ${keypoint.customTypeId} not found`);
      return;
    }
    
    // 确定透明度
    const isHovered = this.hoveredKeypoint === keypoint;
    const isSelected = this.state.selectedKeypoint === keypoint;
    let alpha = 1;
    
    if (isSelected) {
      alpha = 0.9;
    } else if (isHovered) {
      alpha = 0.8;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    
    if (keypoint.width && keypoint.height) {
      // 渲染区域标注
      this.renderCustomRegion(keypoint, screenPos, customType, displayStrategy);
    } else {
      // 渲染点标注
      this.renderCustomPoint(keypoint, screenPos, customType, displayStrategy);
    }
    
    this.ctx.restore();
  }
  
  /**
   * 🔄 NEW: 渲染自定义点标注
   */
  renderCustomPoint(keypoint, screenPos, customType, displayStrategy) {
    // 绘制点
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, displayStrategy.radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = customType.color;
    this.ctx.fill();
    
    // 绘制边框
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = displayStrategy.borderWidth;
    this.ctx.stroke();
    
    // 绘制标签
    if (displayStrategy.showInternalLabel) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `bold ${displayStrategy.fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(keypoint.order.toString(), screenPos.x, screenPos.y);
    } else if (displayStrategy.showExternalLabel) {
      this.renderCustomPointLabel(keypoint, screenPos, customType, displayStrategy);
    }
  }
  
  /**
   * 🔄 NEW: 渲染自定义区域标注
   */
  renderCustomRegion(keypoint, screenPos, customType, displayStrategy) {
    // 计算区域屏幕坐标
    const bottomRightScreen = this.imageToScreen(
      keypoint.x + keypoint.width,
      keypoint.y + keypoint.height
    );
    
    const screenWidth = bottomRightScreen.x - screenPos.x;
    const screenHeight = bottomRightScreen.y - screenPos.y;
    
    // 绘制填充区域
    this.ctx.fillStyle = customType.color;
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
    
    // 绘制边框
    this.ctx.globalAlpha = 1.0;
    this.ctx.strokeStyle = customType.color;
    this.ctx.lineWidth = displayStrategy.borderWidth;
    this.ctx.strokeRect(screenPos.x, screenPos.y, screenWidth, screenHeight);
    
    // 绘制标签（在中心）
    const centerX = screenPos.x + screenWidth / 2;
    const centerY = screenPos.y + screenHeight / 2;
    
    if (displayStrategy.showInternalLabel && Math.min(screenWidth, screenHeight) > 20) {
      this.ctx.fillStyle = customType.color;
      this.ctx.font = `bold ${displayStrategy.fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(keypoint.order.toString(), centerX, centerY);
    }
    
    if (displayStrategy.showExternalLabel) {
      this.renderCustomRegionLabel(keypoint, { x: centerX, y: screenPos.y }, customType, displayStrategy);
    }
  }
  
  /**
   * 🔄 NEW: 渲染自定义点标签
   */
  renderCustomPointLabel(keypoint, screenPos, customType, displayStrategy) {
    const labelY = screenPos.y - displayStrategy.radius - displayStrategy.labelOffset;
    
    this.ctx.save();
    
    // 创建标签文本
    const labelText = `${customType.name} #${keypoint.order}`;
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
   * 🔄 NEW: 渲染自定义区域标签
   */
  renderCustomRegionLabel(keypoint, screenPos, customType, displayStrategy) {
    const labelY = screenPos.y - displayStrategy.labelOffset;
    
    this.ctx.save();
    
    // 创建标签文本
    const labelText = `${customType.name} #${keypoint.order}`;
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
   * 🔄 NEW: 渲染自定义区域拖拽预览
   */
  renderCustomRegionPreview() {
    if (!this.state.isCustomRegionDragging) return;
    
    const startScreenPos = this.state.customRegionStartPoint;
    const currentScreenPos = this.state.customRegionCurrentPoint;
    
    if (!startScreenPos || !currentScreenPos) return;
    
    const customType = this.customAnnotationManager?.getCurrentCustomType();
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
    
    // 绘制预览边框
    this.ctx.strokeStyle = customType.color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(left, top, width, height);
    
    // 绘制尺寸信息
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const sizeText = `${Math.round(width)}x${Math.round(height)}`;
    this.ctx.fillText(sizeText, left + width/2, top + height/2);
    
    this.ctx.restore();
  }
  
  /**
   * 渲染单个标注点
   */
  renderSingleKeypoint(x, y, fillColor, label, direction, strategy, keypoint = null) {
    // 绘制标注点圆圈
    this.ctx.beginPath();
    this.ctx.arc(x, y, strategy.radius, 0, 2 * Math.PI);
    
    // 填充
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    
    // 边框
    this.ctx.strokeStyle = this.options.keypointBorderColor;
    this.ctx.lineWidth = strategy.borderWidth;
    this.ctx.stroke();
    
    // 根据显示策略绘制标签
    if (strategy.showInternalLabel) {
      // 在标注点内部显示序号
      this.ctx.fillStyle = this.options.keypointBorderColor;
      this.ctx.font = `bold ${strategy.fontSize}px Inter, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label.toString(), x, y);
      
      // 不再在标注点上方显示方向符号，改为使用虚线箭头
      
    } else if (strategy.showExternalLabel) {
      // 在标注点外部显示标签
      this.createExternalLabel(x, y, label, direction, fillColor, strategy);
      
    } else if (strategy.showMinimalMode) {
      // 极小模式：只显示标注点，悬停时显示详细信息
      if (keypoint && this.hoveredKeypoint === keypoint) {
        this.createTooltip(x, y, label, direction, keypoint);
      }
    }
  }

  /**
   * 渲染拖拽指示器
   */
  renderDragIndicator() {
    if (!this.state.dragStartPoint || !this.state.currentDragPoint) return;
    
    const startX = this.state.dragStartPoint.x;
    const startY = this.state.dragStartPoint.y;
    const currentX = this.state.currentDragPoint.x;
    const currentY = this.state.currentDragPoint.y;
    
    // 计算拖拽距离和方向
    const deltaX = currentX - startX;
    const distance = Math.sqrt(deltaX * deltaX + (currentY - startY) * (currentY - startY));
    
    if (distance >= this.options.directionThreshold) {
      // 绘制拖拽线条
      this.ctx.strokeStyle = deltaX < 0 ? this.options.keypointLeftColor : this.options.keypointRightColor;
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([5, 5]);
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
      
      // 重置线条样式
      this.ctx.setLineDash([]);
      
      // 绘制方向文字
      const midX = (startX + currentX) / 2;
      const midY = (startY + currentY) / 2 - 20;
      
      this.ctx.fillStyle = deltaX < 0 ? this.options.keypointLeftColor : this.options.keypointRightColor;
      this.ctx.font = 'bold 14px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(deltaX < 0 ? '← 左侧' : '右侧 →', midX, midY);
    }
  }

  /**
   * 图像坐标转屏幕坐标
   */
  imageToScreen(imageX, imageY) {
    return {
      x: imageX * this.state.scale + this.state.translateX,
      y: imageY * this.state.scale + this.state.translateY
    };
  }

  /**
   * 屏幕坐标转图像坐标
   */
  screenToImage(screenX, screenY) {
    return {
      x: (screenX - this.state.translateX) / this.state.scale,
      y: (screenY - this.state.translateY) / this.state.scale
    };
  }

  /**
   * 获取鼠标相对Canvas的位置
   */
  getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /**
   * 🔧 NEW: Calculate the visible image bounds in screen coordinates
   */
  getVisibleImageBounds() {
    if (!this.imageElement || !this.imageLoaded) {
      return null;
    }

    // Image dimensions in screen space
    const imageWidth = this.imageElement.width * this.state.scale;
    const imageHeight = this.imageElement.height * this.state.scale;
    
    // Image position in screen space (top-left corner)
    const imageLeft = this.state.translateX;
    const imageTop = this.state.translateY;
    
    // Calculate visible bounds (intersection with canvas)
    const visibleBounds = {
      left: Math.max(0, imageLeft),
      top: Math.max(0, imageTop),
      right: Math.min(this.canvas.width, imageLeft + imageWidth),
      bottom: Math.min(this.canvas.height, imageTop + imageHeight),
      // Also store the full image bounds for reference
      imageLeft,
      imageTop,
      imageRight: imageLeft + imageWidth,
      imageBottom: imageTop + imageHeight
    };
    
    // 🔧 DEBUG: Log bounds occasionally for troubleshooting
    if (Math.random() < 0.001) { // 0.1% chance to log
      console.log('[AnnotationTool] Image bounds debug:', {
        imageSize: { width: this.imageElement.width, height: this.imageElement.height },
        canvasSize: { width: this.canvas.width, height: this.canvas.height },
        scale: this.state.scale,
        translate: { x: this.state.translateX, y: this.state.translateY },
        visibleBounds,
        imageLoaded: this.imageLoaded
      });
    }
    
    return visibleBounds;
  }

  /**
   * 🔧 NEW: Check if a screen point is within the visible image area
   */
  isPointInVisibleImage(screenX, screenY) {
    const bounds = this.getVisibleImageBounds();
    if (!bounds) {
      return false;
    }
    
    // Check if point is within the visible image area (intersection of image and canvas)
    return screenX >= bounds.left && 
           screenX <= bounds.right && 
           screenY >= bounds.top && 
           screenY <= bounds.bottom;
  }

  /**
   * 🔧 NEW: Check if image coordinates are valid and within image boundaries
   */
  isImageCoordinateValid(imageX, imageY) {
    if (!this.imageElement || !this.imageLoaded) {
      return false;
    }
    
    return imageX >= 0 && 
           imageX <= this.imageElement.width && 
           imageY >= 0 && 
           imageY <= this.imageElement.height;
  }

  /**
   * 🔧 NEW: Comprehensive bounds checking for annotation creation
   */
  canCreateAnnotationAt(screenX, screenY) {
    // Check if image is loaded
    if (!this.imageElement || !this.imageLoaded) {
      console.warn('[AnnotationTool] Cannot create annotation: no image loaded');
      return false;
    }

    // Check if point is within visible image area
    if (!this.isPointInVisibleImage(screenX, screenY)) {
      console.warn('[AnnotationTool] Cannot create annotation: position is outside visible image area');
      return false;
    }

    // Double-check with image coordinates
    const imagePos = this.screenToImage(screenX, screenY);
    if (!this.isImageCoordinateValid(imagePos.x, imagePos.y)) {
      console.warn('[AnnotationTool] Cannot create annotation: position is outside image boundaries');
      return false;
    }

    return true;
  }

  /**
   * 🔧 NEW: Silent bounds checking for cursor state (no console warnings)
   */
  canAnnotateAtSilent(screenX, screenY) {
    // Check if image is loaded
    if (!this.imageElement || !this.imageLoaded) {
      return false;
    }

    // Check if point is within visible image area
    if (!this.isPointInVisibleImage(screenX, screenY)) {
      return false;
    }

    // Double-check with image coordinates
    const imagePos = this.screenToImage(screenX, screenY);
    if (!this.isImageCoordinateValid(imagePos.x, imagePos.y)) {
      return false;
    }

    return true;
  }

  /**
   * 🔧 DEBUG: Manual bounds checking for troubleshooting
   */
  debugBoundsAt(screenX, screenY) {
    console.log('[AnnotationTool] Debug bounds check at:', { screenX, screenY });
    
    if (!this.imageElement || !this.imageLoaded) {
      console.log('❌ Image not loaded');
      return false;
    }
    
    const bounds = this.getVisibleImageBounds();
    console.log('📐 Visible bounds:', bounds);
    
    const inVisibleArea = this.isPointInVisibleImage(screenX, screenY);
    console.log('🎯 In visible area:', inVisibleArea);
    
    const imagePos = this.screenToImage(screenX, screenY);
    const validCoords = this.isImageCoordinateValid(imagePos.x, imagePos.y);
    console.log('📍 Image coords:', imagePos, 'Valid:', validCoords);
    
    const finalResult = this.canAnnotateAtSilent(screenX, screenY);
    console.log('✅ Final result:', finalResult);
    
    return finalResult;
  }

  /**
   * 处理鼠标按下
   */
  handleMouseDown(event) {
    console.log('[调试] handleMouseDown 被调用', {
      button: event.button,
      timestamp: Date.now(),
      target: event.target.tagName,
      isTrusted: event.isTrusted,
      type: event.type,
      eventPhase: event.eventPhase,
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      stackTrace: new Error().stack
    });

    const mousePos = this.getMousePos(event);

    if (event.button === 0) { // 左键
      if (event.shiftKey) {
        // Shift + 左键：开始平移
        this.state.isPanning = true;
        this.state.lastPanPoint = mousePos;
        this.canvas.style.cursor = 'grabbing';
      } else {
        // 检查是否点击了自定义标注
        const clickedCustomAnnotation = this.getCustomAnnotationAt(mousePos);
        
        if (clickedCustomAnnotation) {
          // 处理自定义标注点击
          this.handleCustomAnnotationClick(clickedCustomAnnotation, mousePos);
          
          // 开始拖拽自定义标注
          this.startCustomAnnotationDrag(clickedCustomAnnotation, mousePos);
          return;
        }
        
        // 检查是否点击了标注点
        const clickedKeypoint = this.getKeypointAt(mousePos);
        
        if (clickedKeypoint) {
          console.log('[调试] 点击了标注点', {
            clickedKeypoint: clickedKeypoint.order,
            isDirectionSelectionMode: this.state.isDirectionSelectionMode,
            selectedKeypoint: this.state.selectedKeypoint?.order,
            isSameKeypoint: this.state.selectedKeypoint === clickedKeypoint
          });

          // 如果处于方向选择模式且点击的是已选中的标注点，处理方向选择
          if (this.state.isDirectionSelectionMode && this.state.selectedKeypoint === clickedKeypoint) {
            console.log('[调试] 处理方向选择');
            this.handleDirectionSelection(mousePos);
            return;
          }

          // 如果不是在处理方向选择，则开始拖拽标注点
          // 但是首先检查这是否是一个点击（而不是拖拽）
          this.draggedKeypoint = clickedKeypoint;
          this.state.dragStartPoint = mousePos;
          this.state.mouseDownTime = Date.now(); // 记录按下时间
          this.state.wasDraggedDuringSession = false; // 重置拖拽标记
          this.canvas.style.cursor = 'grabbing';

          // 重要：点击了标注点就直接返回，不要继续执行后面的逻辑
          return;
        } else {
          // 如果处于方向选择模式，处理方向选择
          if (this.state.isDirectionSelectionMode) {
            // 无论是自动模式还是手动模式，点击空白区域都应该设置方向
            console.log('[调试] 方向选择模式下点击，处理方向选择');
            this.handleDirectionSelection(mousePos);
            return;
          }

          // 🔧 FIX: Check if image is loaded before allowing annotation creation
          if (!this.imageElement || !this.imageLoaded) {
            console.warn('[AnnotationTool] Cannot create annotation: no image loaded');
            if (window.PlantAnnotationTool?.showError) {
              window.PlantAnnotationTool.showError('No Image Loaded', 'Please select and load an image before creating annotations.');
            }
            return;
          }

          // 检查是否处于自定义标注模式
          if (this.customAnnotationManager && this.customAnnotationManager.isInCustomMode()) {
            // 处理自定义标注模式下的点击
            this.handleCustomAnnotationMode(mousePos);
            return;
          }

          // 记录空白区域点击，准备创建标注点
          this.state.blankAreaClickStart = mousePos;
          this.state.mouseDownTime = Date.now();
          this.state.wasDraggedDuringSession = false;
        }
      }
    } else if (event.button === 2) { // 右键
      if (this.state.isAutoDirectionMode) {
        // 右键暂停自动化方向升级模式
        this.pauseAutoDirectionMode();
      } else if (this.state.isDirectionSelectionMode) {
        // 右键取消方向选择
        this.cancelDirectionSelection(true); // 强制退出
      }
    } else if (event.button === 1) { // 🔧 NEW: 中键 - 方向数量选择
      this.handleMiddleMouseButton(mousePos);
    }
  }

  /**
   * 处理鼠标移动
   */
  handleMouseMove(event) {
    const mousePos = this.getMousePos(event);
    
    if (this.state.isPanning && this.state.lastPanPoint) {
      // 平移图像
      const deltaX = mousePos.x - this.state.lastPanPoint.x;
      const deltaY = mousePos.y - this.state.lastPanPoint.y;
      
      this.state.translateX += deltaX;
      this.state.translateY += deltaY;
      
      this.state.lastPanPoint = mousePos;
      this.render();
      
    } else if (this.draggedKeypoint) {
      // 拖拽标注点
      const imagePos = this.screenToImage(mousePos.x, mousePos.y);
      
      // 🔧 FIX: Constrain dragged keypoint to stay within image boundaries
      if (this.isImageCoordinateValid(imagePos.x, imagePos.y)) {
        this.draggedKeypoint.x = imagePos.x;
        this.draggedKeypoint.y = imagePos.y;
        
        // 标记已经进行了拖拽
        this.state.wasDraggedDuringSession = true;
        
        this.render();
        
        // 通知预览管理器显示被拖动点对应的预览
        this.notifyDraggedKeypointPreview(this.draggedKeypoint);
      }
      // If the position is invalid, don't update the keypoint position (ignore the movement)
      
    } else if (this.customAnnotationDragState.isDragging) {
      // 拖拽自定义标注
      this.updateCustomAnnotationDrag(mousePos);

    } else if (this.state.blankAreaClickStart) {
      // 检查是否开始了拖拽（从空白区域点击开始）
      const distance = Math.sqrt(
        Math.pow(mousePos.x - this.state.blankAreaClickStart.x, 2) +
        Math.pow(mousePos.y - this.state.blankAreaClickStart.y, 2)
      );

      if (distance >= this.options.directionThreshold) {
        // 距离足够，标记为拖拽状态
        this.state.wasDraggedDuringSession = true;

        // 开始方向拖拽
        this.startDirectionAnnotation(this.state.blankAreaClickStart);
        this.state.blankAreaClickStart = null; // 清除空白点击状态
        this.updateDirectionDragging(mousePos);
      }

    } else if (this.state.isDirectionDragging) {
      // 方向拖拽处理
      this.updateDirectionDragging(mousePos);

    } else if (this.state.isCustomRegionDragging) {
      // 自定义区域拖拽处理
      this.updateCustomRegionDrag(mousePos);

    } else if (this.state.isDirectionSelectionMode) {
      // 方向选择模式下的鼠标移动
      this.state.directionSelectionPoint = mousePos;
      
      // 🔧 FIX: Proper cursor management for direction selection mode
      let directionCursor = 'crosshair'; // Default for direction selection
      
      // Check if we're hovering over the selected keypoint for better UX
      if (this.state.selectedKeypoint) {
        const keypointScreen = this.imageToScreen(
          this.state.selectedKeypoint.x,
          this.state.selectedKeypoint.y
        );
        const distance = Math.sqrt(
          Math.pow(mousePos.x - keypointScreen.x, 2) +
          Math.pow(mousePos.y - keypointScreen.y, 2)
        );
        
        // If hovering over the selected keypoint, show pointer cursor
        if (distance <= (this.options.baseKeypointRadius * 2)) {
          directionCursor = 'pointer';
        }
      }
      
      // Update cursor for direction selection mode
      if (this.canvas.style.cursor !== directionCursor) {
        this.canvas.style.cursor = directionCursor;
      }
      
      this.render();
      
    } else {
      // 检查是否悬停在自定义标注上
      const hoveredCustomAnnotation = this.getCustomAnnotationAt(mousePos);
      
      if (hoveredCustomAnnotation) {
        // 悬停在自定义标注上
        this.canvas.style.cursor = 'pointer';
        
        // 更新悬停状态
        if (this.customAnnotationRenderer) {
          this.customAnnotationRenderer.setHoveredAnnotation(hoveredCustomAnnotation);
        }
        
        this.render();
        return;
      } else {
        // 清除悬停状态
        if (this.customAnnotationRenderer) {
          this.customAnnotationRenderer.setHoveredAnnotation(null);
        }
      }
      
      // 检查悬停的标注点
      const hoveredKeypoint = this.getKeypointAt(mousePos);
      
      // 🔧 FIX: Always check cursor state for better responsiveness
      let newCursor = 'crosshair'; // Default cursor
      
      // 🔧 FIX: Special handling for auto direction mode
      if (this.state.isAutoDirectionMode) {
        // In auto direction mode, provide different cursor feedback
        if (hoveredKeypoint) {
          newCursor = 'pointer'; // Can click keypoints in auto mode
        } else {
          newCursor = 'crosshair'; // Allow normal interaction in auto mode
        }
      } else if (this.customAnnotationManager && this.customAnnotationManager.isInCustomMode()) {
        // 🔧 FIX: Custom annotation mode - maintain crosshair cursor for annotation purposes
        if (hoveredKeypoint) {
          newCursor = 'pointer'; // Can still interact with existing keypoints
        } else {
          // Check if mouse is within valid annotation area
          const canAnnotate = this.canAnnotateAtSilent(mousePos.x, mousePos.y);
          newCursor = canAnnotate ? 'crosshair' : 'not-allowed';
        }
      } else {
        // Normal mode cursor logic
        if (hoveredKeypoint) {
          newCursor = 'pointer';
        } else {
          // Check if mouse is within valid annotation area
          const canAnnotate = this.canAnnotateAtSilent(mousePos.x, mousePos.y);
          newCursor = canAnnotate ? 'crosshair' : 'not-allowed';
        }
      }
      
      // Update cursor if it changed
      if (this.canvas.style.cursor !== newCursor) {
        this.canvas.style.cursor = newCursor;
      }
      
      // Update hovered keypoint and render if it changed
      if (hoveredKeypoint !== this.hoveredKeypoint) {
        this.hoveredKeypoint = hoveredKeypoint;
        this.render();
      }
    }
  }

  /**
   * 处理鼠标抬起
   */
  handleMouseUp(event) {
    const mousePos = this.getMousePos(event);
    
    if (this.state.isPanning) {
      this.state.isPanning = false;
      this.state.lastPanPoint = null;
      this.canvas.style.cursor = 'crosshair';
    }
    
    // 检查是否是简单点击（没有拖拽）
    if (this.draggedKeypoint) {
      // 检查是否有实际移动
      const startPos = this.state.dragStartPoint || mousePos;
      const distance = Math.sqrt(
        Math.pow(mousePos.x - startPos.x, 2) +
        Math.pow(mousePos.y - startPos.y, 2)
      );

      // 检查是否在短时间内进行了拖拽操作
      const currentTime = Date.now();
      const timeSinceMouseDown = currentTime - (this.state.mouseDownTime || currentTime);
      const wasDragged = this.state.wasDraggedDuringSession || false;

      // 更严格的点击判断：距离小且时间短且没有拖拽过
      if (distance < 8 && timeSinceMouseDown < 200 && !wasDragged) {
        // 这是一个快速点击，不是拖拽
        this.handleKeypointClick(this.draggedKeypoint);
      } else {
        // 这是拖拽，保存状态
        this.saveState();
        this.autoSaveCurrentImage();
        
        // 🔄 NEW: 实时同步 - 标注点移动
        this.triggerRealTimeSync('MOVE_KEYPOINT', this.draggedKeypoint, this.state.dragStartPoint);
      }

      // 重置拖拽状态
      this.draggedKeypoint = null;
      this.state.wasDraggedDuringSession = false;
      this.state.mouseDownTime = null;
      this.canvas.style.cursor = 'crosshair';
      this.restoreNormalPreview();
    }
    
    // 检查是否是空白区域的简单点击（创建无方向点）
    if (this.state.blankAreaClickStart) {
      const distance = Math.sqrt(
        Math.pow(mousePos.x - this.state.blankAreaClickStart.x, 2) +
        Math.pow(mousePos.y - this.state.blankAreaClickStart.y, 2)
      );

      const currentTime = Date.now();
      const timeSinceMouseDown = currentTime - (this.state.mouseDownTime || currentTime);
      const wasDragged = this.state.wasDraggedDuringSession || false;

      // 判断是否是简单点击：距离小、时间短、没有拖拽
      if (distance < 8 && timeSinceMouseDown < 300 && !wasDragged) {
        // 创建无方向标注点
        this.createNoDirectionKeypoint(this.state.blankAreaClickStart);
      }

      // 清除空白点击状态
      this.state.blankAreaClickStart = null;
      this.state.mouseDownTime = null;
      this.state.wasDraggedDuringSession = false;
    }

    
    // 完成自定义标注拖拽
    if (this.customAnnotationDragState.isDragging) {
      this.finishCustomAnnotationDrag();
    }
    
    if (this.state.isDirectionDragging) {
      // 完成方向标注
      this.finishDirectionAnnotation();
    }
    
    if (this.state.isCustomRegionDragging) {
      // 完成自定义区域拖拽
      this.finishCustomRegionDrag();
    }
  }

  /**
   * 创建无方向标注点
   */
  createNoDirectionKeypoint(mousePos) {
    // 🔧 FIX: Comprehensive bounds checking for annotation creation
    if (!this.canCreateAnnotationAt(mousePos.x, mousePos.y)) {
      if (window.PlantAnnotationTool?.showError) {
        window.PlantAnnotationTool.showError('Invalid Position', 'Annotations can only be placed within the image area. Please click directly on the image.');
      }
      return;
    }

    const imagePos = this.screenToImage(mousePos.x, mousePos.y);

    // 🔧 NEW: 创建支持多方向的标注点
    const keypoint = {
      id: Date.now().toString(),
      x: imagePos.x,
      y: imagePos.y,
      direction: null, // 保持向后兼容
      directionType: null,
      directions: [], // 🔧 NEW: 支持多方向的数组
      maxDirections: 1, // 🔧 NEW: 最大方向数，默认为1
      order: this.findNextAvailableOrder(),
      annotationType: 'regular' // 🔧 FIX: Add missing annotationType to fix numbering bug
    };

    this.keypoints.push(keypoint);
    this.saveState();
    this.autoSaveCurrentImage();
    this.render();

    // 🔄 NEW: 实时同步 - 新标注点创建
    this.triggerRealTimeSync('ADD_KEYPOINT', keypoint);

    // 同步分支点预览
    this.syncBranchPointPreview();

    // 自动切换到预期位置（标注点创建后）
    this.moveToNextExpectedPosition();

    console.log(`创建无方向标注点 #${keypoint.order} at (${imagePos.x.toFixed(1)}, ${imagePos.y.toFixed(1)})`);
    console.log(`当前标注点总数: ${this.keypoints.length}, 下一个编号: ${this.findNextAvailableOrder()}`);
  }

  /**
   * 选择关键点
   */
  selectKeypoint(keypoint) {
    console.log('[调试] selectKeypoint 被调用', {
      keypoint: keypoint.order,
      currentDirection: keypoint.direction,
      directionType: keypoint.directionType
    });

    // 🔧 BUG FIX: 确保标注点具有多方向支持
    this.ensureMultiDirectionSupport(keypoint);

    this.state.selectedKeypoint = keypoint;
    this.state.isDirectionSelectionMode = true;
    this.state.directionSelectionPoint = null;

    console.log('[调试] 方向选择模式状态', {
      isDirectionSelectionMode: this.state.isDirectionSelectionMode,
      selectedKeypoint: this.state.selectedKeypoint?.order,
      isAutoDirectionMode: this.state.isAutoDirectionMode
    });

    // 🔧 FIX: Set appropriate cursor for direction selection mode
    this.canvas.style.cursor = 'crosshair';

    // 通知预览管理器显示这个点的预览
    this.notifySelectedKeypointPreview(keypoint);

    this.render();
    console.log(`Selected keypoint #${keypoint.order} for direction selection`);
  }

  /**
   * 处理关键点点击
   */
  handleKeypointClick(keypoint) {
    console.log('[调试] handleKeypointClick 被调用', {
      keypoint: keypoint.order,
      isAutoDirectionMode: this.state.isAutoDirectionMode,
      isDirectionSelectionMode: this.state.isDirectionSelectionMode,
      currentSelectedKeypoint: this.state.selectedKeypoint?.order
    });

    if (this.state.isAutoDirectionMode) {
      // 自动化模式下，选择当前关键点
      this.selectKeypoint(keypoint);
    } else {
      // 普通模式下，总是选择关键点进入方向选择模式
      // 无论是否已经处于方向选择模式
      this.selectKeypoint(keypoint);
    }
  }

  /**
   * 处理方向选择
   */
  handleDirectionSelection(mousePos) {
    console.log('[调试] handleDirectionSelection 被调用', {
      selectedKeypoint: this.state.selectedKeypoint,
      mousePos,
      isAutoDirectionMode: this.state.isAutoDirectionMode
    });

    if (!this.state.selectedKeypoint) {
      console.log('[调试] 没有选中的标注点，退出方向选择');
      return;
    }

    const keypointScreen = this.imageToScreen(
      this.state.selectedKeypoint.x,
      this.state.selectedKeypoint.y
    );

    // 计算方向角度
    const deltaX = mousePos.x - keypointScreen.x;
    const deltaY = mousePos.y - keypointScreen.y;
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

    // 标准化角度到 0-360 度
    const normalizedAngle = (angle + 360) % 360;

    // 🔧 NEW: 记录点击坐标
    const imagePos = this.screenToImage(mousePos.x, mousePos.y);
    const clickData = {
      x: imagePos.x,
      y: imagePos.y,
      screenX: mousePos.x,
      screenY: mousePos.y,
      timestamp: Date.now()
    };

    console.log('[调试] 计算的角度信息', {
      deltaX, deltaY, angle, normalizedAngle,
      clickData,
      keypointBefore: {...this.state.selectedKeypoint}
    });

    // 🔧 NEW: 支持多方向设置
    if (this.state.selectedKeypoint.maxDirections > 1) {
      // 多方向模式
      const direction = { 
        angle: normalizedAngle, 
        type: 'angle',
        clickPosition: clickData  // 🔧 NEW: 记录点击位置
      };
      
      if (this.addDirectionToKeypoint(this.state.selectedKeypoint, direction)) {
        // 🔧 FIX: Only increment counter after successful addition
        this.state.directionsSet++;
        
        console.log(`[多方向] 设置方向 ${this.state.directionsSet}/${this.state.selectedKeypoint.maxDirections}: ${normalizedAngle.toFixed(1)}°`);
        
        // 更新进度显示
        this.showMultiDirectionProgress();
        
        // 🔄 NEW: 实时同步 - 多方向编辑
        this.triggerRealTimeSync('EDIT_DIRECTION', this.state.selectedKeypoint);
        
        // 🔧 FIX: Check actual directions count, not counter
        if (this.state.selectedKeypoint.directions.length >= this.state.selectedKeypoint.maxDirections) {
          console.log('[多方向] 所有方向设置完成');
          this.finishMultiDirectionSetting();
        }
      }
    } else {
      // 单方向模式（原有逻辑）
      // 更新关键点方向
      const oldDirection = this.state.selectedKeypoint.direction;
      this.state.selectedKeypoint.direction = normalizedAngle;
      this.state.selectedKeypoint.directionType = 'angle'; // 标记为角度类型
      
      // 🔧 NEW: 记录点击坐标
      this.state.selectedKeypoint.directionClick = clickData;
      
      // 同时更新directions数组以保持一致性
      this.state.selectedKeypoint.directions = [{ 
        angle: normalizedAngle, 
        type: 'angle',
        clickPosition: clickData  // 🔧 NEW: 记录点击位置
      }];

      console.log('[调试] 方向更新', {
        keypointId: this.state.selectedKeypoint.id,
        order: this.state.selectedKeypoint.order,
        oldDirection,
        newDirection: normalizedAngle,
        clickData,
        keypointAfter: {...this.state.selectedKeypoint}
      });
      
      // 🔄 NEW: 实时同步 - 单方向编辑
      this.triggerRealTimeSync('EDIT_DIRECTION', this.state.selectedKeypoint);
      
      // 如果是自动化模式，立即切换到下一个标注点
      if (this.state.isAutoDirectionMode) {
        console.log('[调试] 自动模式，立即切换到下一个标注点');
        this.selectNextAutoDirectionKeypoint();
      } else {
        console.log('[调试] 非自动模式，取消方向选择');
        this.cancelDirectionSelection(true); // 强制退出

        // 自动切换到预期位置（仅在非自动模式下，自动模式有自己的切换逻辑）
        this.moveToNextExpectedPosition();
      }
    }
  }

  /**
   * 取消方向选择
   */
  cancelDirectionSelection(forceExit = false) {
    console.log('[调试] cancelDirectionSelection 被调用', {
      wasInDirectionMode: this.state.isDirectionSelectionMode,
      selectedKeypoint: this.state.selectedKeypoint?.order,
      isAutoMode: this.state.isAutoDirectionMode,
      forceExit
    });

    this.state.selectedKeypoint = null;
    this.state.isDirectionSelectionMode = false;
    this.state.directionSelectionPoint = null;

    // 只有在强制退出或非自动模式时才退出自动模式
    if (this.state.isAutoDirectionMode && forceExit) {
      console.log('[调试] 强制退出自动模式');
      this.exitAutoDirectionMode();
    } else if (this.state.isAutoDirectionMode) {
      console.log('[调试] 自动模式中取消方向选择，但保持自动模式');
      // 在自动模式下，只是清除当前选择，不退出自动模式
    }

    // 🔧 FIX: Reset cursor to appropriate state when exiting direction selection
    if (this.state.isAutoDirectionMode) {
      // In auto mode, maintain crosshair cursor
      this.canvas.style.cursor = 'crosshair';
    } else {
      // In normal mode, reset to default crosshair
      this.canvas.style.cursor = 'crosshair';
    }

    this.restoreNormalPreview();
    this.render();
    console.log('Direction selection cancelled');
  }

  /**
   * 开始自动化方向选择模式（专门用于升级传统标注）
   */
  startAutoDirectionMode() {
    console.log('[调试] startAutoDirectionMode 被调用');

    // 先清理之前的状态
    if (this.state.isDirectionSelectionMode || this.state.isAutoDirectionMode) {
      console.log('[调试] 清理之前的方向选择状态');
      this.state.selectedKeypoint = null;
      this.state.isDirectionSelectionMode = false;
      this.state.directionSelectionPoint = null;
      this.state.isAutoDirectionMode = false;
    }

    // 找到所有需要设置方向的标注点（传统left/right标注点 + 无方向标注点）
    const needDirectionKeypoints = this.keypoints.filter(kp => {
      // 传统left/right标注点
      const isLegacy = (kp.direction === 'left' || kp.direction === 'right') &&
                      kp.directionType !== 'angle' &&
                      typeof kp.direction !== 'number';

      // 无方向标注点
      const isNoDirection = kp.direction === null || kp.direction === undefined;

      return isLegacy || isNoDirection;
    });

    console.log('[调试] 找到需要设置方向的标注点', needDirectionKeypoints.map(kp => ({
      order: kp.order,
      direction: kp.direction,
      directionType: kp.directionType,
      type: kp.direction === null ? '无方向' : '传统方向'
    })));

    if (needDirectionKeypoints.length === 0) {
      console.log('没有需要设置方向的标注点');
      // 显示提示信息
      if (window.showInfo) {
        window.showInfo('无需设置', '当前图像没有需要设置方向的标注点');
      }
      return false;
    }

    // 按序号排序
    needDirectionKeypoints.sort((a, b) => (a.order || 0) - (b.order || 0));

    this.state.isAutoDirectionMode = true;
    this.state.autoDirectionKeypoints = needDirectionKeypoints;
    this.state.autoDirectionIndex = 0;

    console.log('[调试] 设置自动模式状态', {
      isAutoDirectionMode: this.state.isAutoDirectionMode,
      autoDirectionKeypoints: this.state.autoDirectionKeypoints.length,
      autoDirectionIndex: this.state.autoDirectionIndex
    });

    // 选择第一个关键点并自动放大
    this.selectKeypointWithZoom(needDirectionKeypoints[0]);

    console.log(`开始自动化方向设置模式，共 ${needDirectionKeypoints.length} 个标注点需要设置方向`);

    // 显示提示信息
    if (window.showInfo) {
      window.showInfo('方向设置模式', `开始为 ${needDirectionKeypoints.length} 个标注点设置方向。移动鼠标选择方向，点击确认，右键暂停。`);
    }

    return true;
  }

  /**
   * 选择关键点并自动放大到该位置
   */
  selectKeypointWithZoom(keypoint) {
    console.log('[调试] selectKeypointWithZoom 开始', {
      keypoint: keypoint.order,
      isAutoMode: this.state.isAutoDirectionMode,
      isDirectionMode: this.state.isDirectionSelectionMode
    });

    // 先选择关键点
    this.selectKeypoint(keypoint);

    console.log('[调试] selectKeypoint 完成后状态', {
      isAutoMode: this.state.isAutoDirectionMode,
      isDirectionMode: this.state.isDirectionSelectionMode,
      selectedKeypoint: this.state.selectedKeypoint?.order
    });

    // 自动放大到关键点位置
    const defaultAutoScale = 2.5; // 默认的自动化放大倍数
    const currentScale = this.state.scale;

    // 如果当前缩放大于默认值，保持当前缩放；否则使用默认值
    const targetScale = Math.max(currentScale, defaultAutoScale);
    const newScale = Math.min(targetScale, this.options.maxZoom);

    // 计算画布中心
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // 计算标注点在新缩放下的位置，使其居中
    this.state.scale = newScale;
    this.state.translateX = centerX - (keypoint.x * newScale);
    this.state.translateY = centerY - (keypoint.y * newScale);

    // 确保图像不会超出边界
    this.constrainView();

    this.updateZoomInfo();
    this.render();

    const scaleAction = currentScale >= defaultAutoScale ? '保持当前缩放' : '使用默认缩放';
    console.log(`自动居中到标注点 #${keypoint.order}，缩放: ${newScale.toFixed(1)}x (${scaleAction})`);

    // 添加视觉提示
    this.showKeypointFocusHint(keypoint);

    console.log('[调试] selectKeypointWithZoom 完成后状态', {
      isAutoMode: this.state.isAutoDirectionMode,
      isDirectionMode: this.state.isDirectionSelectionMode,
      selectedKeypoint: this.state.selectedKeypoint?.order
    });
  }

  /**
   * 显示标注点聚焦提示
   */
  showKeypointFocusHint(keypoint) {
    // 创建一个临时的聚焦效果
    const originalRender = this.render.bind(this);
    let pulseCount = 0;
    const maxPulses = 3;

    const pulse = () => {
      if (pulseCount >= maxPulses) {
        return;
      }

      // 绘制脉冲效果
      const screenPos = this.imageToScreen(keypoint.x, keypoint.y);
      const ctx = this.ctx;

      ctx.save();
      ctx.globalAlpha = 0.6 - (pulseCount * 0.2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);

      const radius = 30 + (pulseCount * 10);
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();

      pulseCount++;
      if (pulseCount < maxPulses) {
        setTimeout(pulse, 200);
      }
    };

    // 延迟一点开始脉冲效果
    setTimeout(pulse, 100);
  }

  /**
   * 约束视图，确保不超出合理边界
   */
  constrainView() {
    if (!this.imageElement) return;

    const imageWidth = this.imageElement.width * this.state.scale;
    const imageHeight = this.imageElement.height * this.state.scale;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // 如果图像小于画布，居中显示
    if (imageWidth < canvasWidth) {
      this.state.translateX = (canvasWidth - imageWidth) / 2;
    } else {
      // 确保图像不会移出画布太远
      const maxTranslateX = 0;
      const minTranslateX = canvasWidth - imageWidth;
      this.state.translateX = Math.max(minTranslateX, Math.min(maxTranslateX, this.state.translateX));
    }

    if (imageHeight < canvasHeight) {
      this.state.translateY = (canvasHeight - imageHeight) / 2;
    } else {
      const maxTranslateY = 0;
      const minTranslateY = canvasHeight - imageHeight;
      this.state.translateY = Math.max(minTranslateY, Math.min(maxTranslateY, this.state.translateY));
    }
  }

  /**
   * 选择下一个自动方向选择的关键点
   */
  selectNextAutoDirectionKeypoint() {
    this.state.autoDirectionIndex++;

    if (this.state.autoDirectionIndex >= this.state.autoDirectionKeypoints.length) {
      // 当前图片的所有标注点都已完成
      const totalUpgraded = this.state.autoDirectionKeypoints.length;
      console.log(`当前图片方向设置完成，共设置了 ${totalUpgraded} 个标注点`);

      // 尝试切换到下一张图片继续自动化
      if (this.tryAutoSwitchToNextImage()) {
        console.log('自动切换到下一张图片继续方向设置');
        return;
      }

      // 没有下一张图片，完全结束自动化模式
      this.exitAutoDirectionMode();
      this.resetAutoDirectionButton();

      // 显示完成提示
      if (window.showSuccess) {
        window.showSuccess('全部完成', `自动化方向设置已完成！`);
      }
      return;
    }

    const nextKeypoint = this.state.autoDirectionKeypoints[this.state.autoDirectionIndex];
    this.selectKeypointWithZoom(nextKeypoint);

    const progress = `${this.state.autoDirectionIndex + 1}/${this.state.autoDirectionKeypoints.length}`;
    console.log(`自动选择下一个传统标注点 #${nextKeypoint.order} (${progress})`);

    // 显示进度提示
    if (window.showInfo) {
      window.showInfo('升级进度', `正在升级第 ${this.state.autoDirectionIndex + 1} 个，共 ${this.state.autoDirectionKeypoints.length} 个传统标注点`);
    }
  }

  /**
   * 显示自动模式完成提示
   */
  showAutoModeCompletionHint() {
    // 创建完成提示元素
    const hint = document.createElement('div');
    hint.className = 'auto-direction-completion-hint';
    hint.textContent = '🎉 自动化方向选择已完成！';
    hint.style.cssText = `
      position: absolute;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      animation: completionBounce 0.6s ease-out;
    `;
    
    // 添加动画样式
    if (!document.getElementById('completion-animation-style')) {
      const style = document.createElement('style');
      style.id = 'completion-animation-style';
      style.textContent = `
        @keyframes completionBounce {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(0.8);
          }
          50% {
            transform: translateX(-50%) translateY(0) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 添加到canvas容器
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.appendChild(hint);
      
      // 3秒后自动移除
      setTimeout(() => {
        if (hint.parentElement) {
          hint.remove();
        }
      }, 3000);
    }
  }

  /**
   * 退出自动化方向选择模式
   */
  exitAutoDirectionMode() {
    console.log('[调试] exitAutoDirectionMode 被调用', {
      stackTrace: new Error().stack
    });

    this.state.isAutoDirectionMode = false;
    this.state.autoDirectionKeypoints = [];
    this.state.autoDirectionIndex = 0;

    // 清理方向选择状态，但不需要强制退出（因为已经在退出了）
    this.state.selectedKeypoint = null;
    this.state.isDirectionSelectionMode = false;
    this.state.directionSelectionPoint = null;

    this.restoreNormalPreview();
    this.render();

    console.log('Exited auto direction mode');
  }

  /**
   * 通知预览管理器显示选中关键点的预览
   */
  notifySelectedKeypointPreview(keypoint) {
    const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
    
    if (branchPointPreviewManager && keypoint && keypoint.order) {
      branchPointPreviewManager.showSpecificOrderPreview(keypoint.order);
    }
  }

  /**
   * 恢复正常的预览显示
   */
  restoreNormalPreview() {
    // 通过全局对象访问分支点预览管理器
    const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
    
    if (branchPointPreviewManager) {
      // 恢复到显示下一个要标注编号的预览
      branchPointPreviewManager.restoreNormalPreview();
    }
  }

  /**
   * 处理右键菜单
   */
  handleContextMenu(event) {
    event.preventDefault();
    
    const mousePos = this.getMousePos(event);
    
    // 首先检查是否点击了自定义标注
    const clickedCustomAnnotation = this.getCustomAnnotationAt(mousePos);
    if (clickedCustomAnnotation) {
      this.removeCustomAnnotation(clickedCustomAnnotation);
      return;
    }
    
    // 如果没有自定义标注，检查常规关键点
    const clickedKeypoint = this.getKeypointAt(mousePos);
    if (clickedKeypoint) {
      this.removeKeypoint(clickedKeypoint);
    }
  }

  /**
   * 处理滚轮缩放
   */
  handleWheel(event) {
    event.preventDefault();
    
    // 🔧 NEW: 如果处于方向数量模式，用滚轮调整方向数量
    if (this.state.isDirectionCountMode) {
      this.handleScrollWheel(event);
      return;
    }
    
    const mousePos = this.getMousePos(event);
    const delta = -event.deltaY;
    const zoomFactor = 1 + (delta > 0 ? this.options.zoomSpeed : -this.options.zoomSpeed);
    
    this.zoomAt(mousePos.x, mousePos.y, zoomFactor);
  }

  /**
   * 在指定点缩放
   */
  zoomAt(x, y, factor) {
    const newScale = this.state.scale * factor;
    
    // 限制缩放范围
    if (newScale < this.options.minZoom || newScale > this.options.maxZoom) {
      return;
    }
    
    // 计算缩放后的位移
    this.state.translateX = x - (x - this.state.translateX) * factor;
    this.state.translateY = y - (y - this.state.translateY) * factor;
    this.state.scale = newScale;
    
    this.updateZoomInfo();
    this.render();
  }

  /**
   * 处理键盘按下
   */
  handleKeyDown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // 在输入框中时不处理
    }
    
    switch (event.key) {
      case ' ':
        event.preventDefault();
        // 空格键准备平移
        break;
        
      case 'r':
      case 'R':
        event.preventDefault();
        this.resetView();
        break;
        
      case '1':
        event.preventDefault();
        this.setZoom(1);
        break;
        
      case 'z':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (event.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        }
        break;
        
      case 'y':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.redo();
        }
        break;
    }
  }

  /**
   * 处理键盘抬起
   */
  handleKeyUp(event) {
    // 可以在这里处理键盘抬起事件
  }

  /**
   * 设置缩放级别
   */
  setZoom(scale) {
    if (!this.imageElement || !this.imageLoaded) return;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.zoomAt(centerX, centerY, scale / this.state.scale);
  }

  /**
   * 更新缩放信息显示
   */
  updateZoomInfo() {
    const zoomElement = document.getElementById('zoom-level');
    if (zoomElement) {
      zoomElement.textContent = Math.round(this.state.scale * 100) + '%';
    }
  }

  /**
   * 获取指定位置的标注点
   */
  getKeypointAt(screenPos) {
    const threshold = this.options.baseKeypointRadius + 5;
    
    return this.keypoints.find(keypoint => {
      const keypointScreen = this.imageToScreen(keypoint.x, keypoint.y);
      const distance = Math.sqrt(
        Math.pow(screenPos.x - keypointScreen.x, 2) +
        Math.pow(screenPos.y - keypointScreen.y, 2)
      );
      return distance <= threshold;
    });
  }

  /**
   * 添加标注点（向后兼容方法）
   */
  addKeypoint(screenPos, direction = 'right') {
    // 🔧 FIX: Use comprehensive bounds checking for annotation creation
    if (!this.canCreateAnnotationAt(screenPos.x, screenPos.y)) {
      console.warn('[AnnotationTool] Cannot add keypoint: position is outside valid annotation area');
      return;
    }
    
    const imagePos = this.screenToImage(screenPos.x, screenPos.y);
    this.addKeypointWithDirection(imagePos.x, imagePos.y, direction);
  }

  /**
   * 添加带方向的标注点（支持自定义类型）
   */
  addKeypointWithDirection(x, y, direction, customTypeId = null, width = null, height = null) {
    // 🔧 FIX: Ensure image is loaded before creating keypoints
    if (!this.imageElement || !this.imageLoaded) {
      console.warn('[AnnotationTool] Cannot add keypoint: no image loaded');
      return;
    }

    // 🔧 FIX: 使用类型特定的序号分配
    const order = customTypeId ? this.findNextAvailableOrderForType(customTypeId) : this.findNextAvailableOrder();

    // 统一方向格式：将传统的left/right转换为角度
    let normalizedDirection = direction;
    if (direction === 'left') {
      normalizedDirection = 180; // 左侧为180度
    } else if (direction === 'right') {
      normalizedDirection = 0;   // 右侧为0度
    } else if (typeof direction === 'number') {
      normalizedDirection = direction;
    } else {
      normalizedDirection = 0;   // 默认为右侧
    }

    const keypoint = {
      id: Date.now(),
      x: x,
      y: y,
      timestamp: new Date().toISOString(),
      direction: normalizedDirection,
      directionType: 'angle', // 标记为角度类型
      order: order,  // 添加序号字段
      
      // 🔄 NEW: 统一标注系统 - 支持自定义类型
      annotationType: customTypeId ? 'custom' : 'regular',
      ...(customTypeId && { customTypeId }),
      ...(width && { width }),
      ...(height && { height })
    };

    this.keypoints.push(keypoint);
    this.saveState();
    this.render();

    // 自动保存到当前图像
    this.autoSaveCurrentImage();

    // 🔄 NEW: 实时同步 - 标注点添加
    this.triggerRealTimeSync('ADD_KEYPOINT', keypoint);

    // 同步分支点预览
    this.syncBranchPointPreview();

    // 自动切换到预期位置（标注点创建后）
    this.moveToNextExpectedPosition();

    const typeDesc = customTypeId ? `custom(${customTypeId})` : 'regular';
    const directionDesc = typeof normalizedDirection === 'number' ? `${normalizedDirection}°` : normalizedDirection;
    console.log(`Added ${typeDesc} keypoint #${order} at (${x.toFixed(1)}, ${y.toFixed(1)}) with direction ${directionDesc}`);
    
    return keypoint;
  }

  /**
   * 🔄 NEW: 添加自定义点标注（统一到keypoints系统）
   */
  addCustomPointAnnotation(x, y, customTypeId) {
    return this.addKeypointWithDirection(x, y, null, customTypeId);
  }
  
  /**
   * 🔄 NEW: 添加自定义区域标注（统一到keypoints系统）
   */
  addCustomRegionAnnotation(x, y, width, height, customTypeId) {
    return this.addKeypointWithDirection(x, y, null, customTypeId, width, height);
  }
  
  /**
   * 🔄 NEW: 获取自定义类型定义
   */
  getCustomType(customTypeId) {
    // 🔧 FIX: 直接从CustomAnnotationManager获取自定义类型
    if (this.customAnnotationManager) {
      return this.customAnnotationManager.getCustomType(customTypeId);
    }
    return this.customTypes?.get(customTypeId) || null;
  }
  
  /**
   * 🔄 NEW: 设置自定义类型定义
   */
  setCustomTypes(customTypes) {
    this.customTypes = customTypes;
  }
  
  /**
   * 🔄 NEW: 处理自定义标注模式下的点击（统一版本）
   */
  handleUnifiedCustomAnnotationMode(mousePos) {
    if (!this.customAnnotationManager) {
      console.warn('Custom annotation manager not available');
      return;
    }
    
    try {
      const customType = this.customAnnotationManager.getCurrentCustomType();
      if (!customType) {
        console.warn('No custom type selected');
        return;
      }
      
      const imagePos = this.screenToImage(mousePos.x, mousePos.y);
      
      if (customType.type === 'point') {
        // 创建自定义点标注
        const keypoint = this.addCustomPointAnnotation(imagePos.x, imagePos.y, customType.id);
        if (keypoint) {
          console.log('Created unified custom point annotation:', keypoint);
        }
      } else if (customType.type === 'region') {
        // 开始拖拽区域标注
        this.startUnifiedCustomRegionDrag(mousePos, customType.id);
      }
    } catch (error) {
      console.error('Failed to handle unified custom annotation mode:', error);
    }
  }
  
  /**
   * 🔄 NEW: 开始统一的自定义区域拖拽
   */
  startUnifiedCustomRegionDrag(mousePos, customTypeId) {
    if (!this.canCreateAnnotationAt(mousePos.x, mousePos.y)) {
      console.warn('Cannot create custom region annotation: position is outside valid area');
      return;
    }

    this.state.isCustomRegionDragging = true;
    this.state.customRegionStartPoint = mousePos;
    this.state.customRegionCurrentPoint = mousePos;
    this.state.customRegionTypeId = customTypeId;
    this.canvas.style.cursor = 'crosshair';
    
    console.log('Started unified custom region drag at:', mousePos);
  }
  
  /**
   * 🔄 NEW: 完成统一的自定义区域拖拽
   */
  finishUnifiedCustomRegionDrag() {
    if (!this.state.isCustomRegionDragging || !this.state.customRegionStartPoint || !this.state.customRegionCurrentPoint) {
      this.resetCustomRegionDrag();
      return;
    }

    const startPos = this.screenToImage(this.state.customRegionStartPoint.x, this.state.customRegionStartPoint.y);
    const endPos = this.screenToImage(this.state.customRegionCurrentPoint.x, this.state.customRegionCurrentPoint.y);

    // 检查拖拽距离是否足够
    const width = Math.abs(endPos.x - startPos.x);
    const height = Math.abs(endPos.y - startPos.y);
    const minSize = 10; // 最小区域尺寸

    if (width < minSize || height < minSize) {
      console.log('Region too small, ignoring');
      this.resetCustomRegionDrag();
      return;
    }

    // 计算区域位置
    const x = Math.min(startPos.x, endPos.x);
    const y = Math.min(startPos.y, endPos.y);
    
    // 创建自定义区域标注
    const keypoint = this.addCustomRegionAnnotation(x, y, width, height, this.state.customRegionTypeId);
    
    if (keypoint) {
      console.log('Created unified custom region annotation:', keypoint);
    }

    this.resetCustomRegionDrag();
  }
  
  /**
   * 🔧 NEW: 为特定自定义类型找到下一个可用的编号（独立计数）
   */
  findNextAvailableOrderForType(customTypeId) {
    // 只考虑相同自定义类型的标注
    const sameTypeKeypoints = this.keypoints.filter(kp => 
      kp.annotationType === 'custom' && kp.customTypeId === customTypeId
    );
    
    if (sameTypeKeypoints.length === 0) {
      return 1;
    }
    
    // 获取该类型所有现有的编号并排序
    const existingOrders = sameTypeKeypoints
      .map(kp => kp.order || 0)
      .filter(order => order > 0)
      .sort((a, b) => a - b);
    
    // 找到最小的缺失编号
    for (let i = 1; i <= existingOrders.length + 1; i++) {
      if (!existingOrders.includes(i)) {
        return i;
      }
    }
    
    // 如果没有缺失，返回下一个编号
    return existingOrders.length + 1;
  }

  /**
   * 找到下一个可用的编号（最小的缺失编号）- 只考虑常规标注
   */
  findNextAvailableOrder() {
    // 🔧 FIX: 只考虑常规标注的序号，实现独立计数
    // 🐛 BUGFIX: Include fallback for annotations without annotationType field (loaded from storage)
    const regularKeypoints = this.keypoints.filter(kp => 
      kp.annotationType === 'regular' || !kp.annotationType);
    
    if (regularKeypoints.length === 0) {
      return 1;
    }
    
    // 获取所有现有的编号并排序
    const existingOrders = regularKeypoints
      .map(kp => kp.order || 0)
      .filter(order => order > 0)
      .sort((a, b) => a - b);
    
    // 找到最小的缺失编号
    for (let i = 1; i <= existingOrders.length + 1; i++) {
      if (!existingOrders.includes(i)) {
        return i;
      }
    }
    
    // 如果没有缺失，返回下一个编号
    return existingOrders.length + 1;
  }

  /**
   * 删除标注点
   */
  removeKeypoint(keypoint) {
    const index = this.keypoints.indexOf(keypoint);
    if (index !== -1) {
      const removed = this.keypoints.splice(index, 1)[0];
      
      // 不再重新整理序号，保持其他标注点的编号不变
      // this.reorderKeypoints(); // 移除这行
      
      this.saveState();
      this.render();
      
      // 触发实时同步删除（如果启用）
      this.triggerRealTimeSync('DELETE_KEYPOINT', removed);
      
      // 自动保存到当前图像
      this.autoSaveCurrentImage();
      
      // 同步分支点预览
      this.syncBranchPointPreview();
      
      console.log(`Removed keypoint #${removed.order || 'unknown'} (id: ${keypoint.id})`);
      console.log(`下一个新增标注点将使用编号: ${this.findNextAvailableOrder()}`);
    }
  }

  /**
   * 清空所有标注点
   */
  clearKeypoints() {
    if (this.keypoints.length > 0) {
      this.keypoints = [];
      this.saveState();
      this.render();
      
      // 自动保存到当前图像（清空状态）
      this.autoSaveCurrentImage();
      
      // 同步分支点预览
      this.syncBranchPointPreview();
      
      console.log('Cleared all keypoints (unified system)');
    }
  }

  /**
   * 清空所有标注点但不触发自动保存 - 用于工作区清理（统一版本）
   */
  clearKeypointsWithoutSave() {
    if (this.keypoints.length > 0) {
      this.keypoints = [];
      this.saveState();
      this.render();
      
      // 同步分支点预览但不保存
      this.syncBranchPointPreview();
      
      console.log('Cleared all keypoints (without auto-save, unified system)');
    }
  }

  /**
   * 重新整理标注点序号，确保序号连续
   */
  reorderKeypoints() {
    // 先按照当前序号排序（如果有的话）
    this.keypoints.sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      return orderA - orderB;
    });
    
    // 重新分配连续的序号
    for (let i = 0; i < this.keypoints.length; i++) {
      this.keypoints[i].order = i + 1;
    }
    
    console.log(`Reordered ${this.keypoints.length} keypoints`);
  }

  /**
   * 保存状态到历史记录
   */
  saveState() {
    const state = {
      keypoints: JSON.parse(JSON.stringify(this.keypoints)),
      timestamp: Date.now()
    };
    
    // 移除当前位置之后的历史记录
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // 添加新状态
    this.history.push(state);
    this.historyIndex = this.history.length - 1;
    
    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * 撤销
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.keypoints = JSON.parse(JSON.stringify(state.keypoints));
      this.render();
      
      // 自动保存到当前图像
      this.autoSaveCurrentImage();
      
      // 同步分支点预览
      this.syncBranchPointPreview();
      
      console.log('Undo');
    }
  }

  /**
   * 重做
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.keypoints = JSON.parse(JSON.stringify(state.keypoints));
      this.render();
      
      // 自动保存到当前图像
      this.autoSaveCurrentImage();
      
      // 同步分支点预览
      this.syncBranchPointPreview();
      
      console.log('Redo');
    }
  }

  /**
   * 获取标注数据（统一版本，包含自定义标注）
   */
  getAnnotationData() {
    return {
      keypoints: this.keypoints.map(kp => ({...kp})), // 包含所有标注：常规 + 自定义
      imageInfo: this.currentImage ? {
        name: this.currentImage.name,
        width: this.imageElement?.width,
        height: this.imageElement?.height
      } : null,
      viewState: {
        scale: this.state.scale,
        translateX: this.state.translateX,
        translateY: this.state.translateY
      }
    };
  }

  /**
   * 加载标注数据（统一版本，包含自定义标注）
   */
  loadAnnotationData(data) {
    if (data.keypoints) {
      this.keypoints = data.keypoints.map(kp => ({...kp})); // 包含所有标注：常规 + 自定义

      // 🔧 DISABLED: 为没有序号的旧数据添加序号（兼容性处理）
      // IMPORTANT: This automatic renumbering was causing order inconsistencies
      // across frames in real-time sync. Annotations should maintain their
      // original order numbers to ensure consistent synchronization.
      // this.ensureKeypointOrders();
      
      console.log(`🔄 Loaded ${this.keypoints.length} keypoints (auto-renumbering disabled)`);
    }

    if (data.viewState) {
      this.state.scale = data.viewState.scale || 1;
      this.state.translateX = data.viewState.translateX || 0;
      this.state.translateY = data.viewState.translateY || 0;
      this.updateZoomInfo();
    }

    this.saveState();
    this.render();
  }

  /**
   * 确保所有标注点都有序号（兼容性处理）- 统一系统版本
   */
  ensureKeypointOrders() {
    // 🔧 FIX: 使用类型感知的序号检查，与PlantDataManager保持一致
    
    // 按类型分组标注点
    const annotationsByType = {};
    
    this.keypoints.forEach(keypoint => {
      const typeKey = keypoint.annotationType === 'custom' 
        ? `custom:${keypoint.customTypeId || 'unknown'}`
        : 'regular';
      
      if (!annotationsByType[typeKey]) {
        annotationsByType[typeKey] = [];
      }
      annotationsByType[typeKey].push(keypoint);
    });
    
    let hasOrderIssues = false;
    let totalFixed = 0;
    
    // 为每个类型独立检查序号
    Object.entries(annotationsByType).forEach(([typeKey, typeAnnotations]) => {
      let typeHasIssues = false;
      
      // 检查该类型是否有序号问题
      for (let i = 0; i < typeAnnotations.length; i++) {
        if (typeof typeAnnotations[i].order !== 'number' || typeAnnotations[i].order <= 0) {
          typeHasIssues = true;
          break;
        }
      }
      
      // 检查该类型内部是否有重复序号
      if (!typeHasIssues) {
        const orders = typeAnnotations.map(kp => kp.order);
        const uniqueOrders = [...new Set(orders)];
        if (uniqueOrders.length !== orders.length) {
          typeHasIssues = true;
        }
      }
      
      // 如果该类型有序号问题，重新分配
      if (typeHasIssues) {
        console.log(`发现 ${typeKey} 类型标注序号问题，正在为 ${typeAnnotations.length} 个标注点分配序号...`);
        hasOrderIssues = true;
        
        // 按照原有顺序为该类型分配序号（从1开始）
        for (let i = 0; i < typeAnnotations.length; i++) {
          typeAnnotations[i].order = i + 1;
        }
        
        totalFixed += typeAnnotations.length;
        console.log(`已为 ${typeKey} 类型分配序号：1-${typeAnnotations.length}`);
      }
    });
    
    if (hasOrderIssues) {
      console.log('发现传统数据或序号问题，正在为标注点添加/修复序号...');
      console.log(`序号修复完成：共修复 ${totalFixed} 个标注点，保持类型特定编号系统`);
    }
  }

  /**
   * 销毁组件
   */
  destroy() {
    // 移除事件监听器
    // 这里应该移除所有绑定的事件监听器，但为了简化暂时省略
    
    // 清理资源
    if (this.imageElement && this.imageElement.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.imageElement.src);
    }
    
    console.log('AnnotationTool destroyed');
  }

  /**
   * 开始方向标注
   */
  startDirectionAnnotation(mousePos) {
    // 🔧 FIX: Use comprehensive bounds checking for direction annotation creation
    if (!this.canCreateAnnotationAt(mousePos.x, mousePos.y)) {
      if (window.PlantAnnotationTool?.showError) {
        window.PlantAnnotationTool.showError('Invalid Position', 'Direction annotations can only be placed within the image area. Please click directly on the image.');
      }
      return;
    }
    
    const imagePos = this.screenToImage(mousePos.x, mousePos.y);
    
    this.state.isDirectionDragging = true;
    this.state.dragStartPoint = mousePos;
    this.state.currentDragPoint = mousePos;
    this.state.previewKeypoint = {
      x: imagePos.x,
      y: imagePos.y,
      direction: 0, // 默认方向（0度，向右）
      directionType: 'angle'
    };
    
    this.canvas.style.cursor = 'grabbing';
    console.log('Started direction annotation');
  }

  /**
   * 更新方向拖拽
   */
  updateDirectionDragging(mousePos) {
    this.state.currentDragPoint = mousePos;

    // 计算拖拽方向角度
    const deltaX = mousePos.x - this.state.dragStartPoint.x;
    const deltaY = mousePos.y - this.state.dragStartPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance >= this.options.directionThreshold) {
      // 计算角度（0-360度）
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      const normalizedAngle = (angle + 360) % 360;

      this.state.previewKeypoint.direction = normalizedAngle;
      this.state.previewKeypoint.directionType = 'angle';
    } else {
      // 距离不够，使用默认方向
      this.state.previewKeypoint.direction = 0; // 默认向右
      this.state.previewKeypoint.directionType = 'angle';
    }

    this.render();
  }

  /**
   * 完成方向标注
   */
  finishDirectionAnnotation() {
    if (!this.state.previewKeypoint) {
      this.resetDirectionDragging();
      return;
    }

    // 计算拖拽距离
    const deltaX = this.state.currentDragPoint.x - this.state.dragStartPoint.x;
    const deltaY = this.state.currentDragPoint.y - this.state.dragStartPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let direction, directionType;

    if (distance >= this.options.directionThreshold) {
      // 拖拽距离足够，使用计算的角度方向
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      direction = (angle + 360) % 360;
      directionType = 'angle';

      console.log(`Added keypoint with angle direction ${direction.toFixed(1)}° at (${this.state.previewKeypoint.x.toFixed(1)}, ${this.state.previewKeypoint.y.toFixed(1)})`);
    } else {
      // 拖拽距离不够，当作普通点击，添加默认角度方向
      direction = 0; // 默认向右（0度）
      directionType = 'angle';

      console.log(`Added default keypoint (0°) at (${this.state.previewKeypoint.x.toFixed(1)}, ${this.state.previewKeypoint.y.toFixed(1)})`);
    }

    // 添加带角度方向的标注点
    this.addKeypointWithDirection(
      this.state.previewKeypoint.x,
      this.state.previewKeypoint.y,
      direction
    );

    this.resetDirectionDragging();
  }

  /**
   * 重置方向拖拽状态
   */
  resetDirectionDragging() {
    this.state.isDirectionDragging = false;
    this.state.dragStartPoint = null;
    this.state.currentDragPoint = null;
    this.state.previewKeypoint = null;
    this.canvas.style.cursor = 'crosshair';
    this.render();
  }

  /**
   * 获取标注点显示策略
   */
  getKeypointDisplayStrategy() {
    const scale = this.state.scale;
    
    // 计算实际的标注点半径（默认使用更小的基础半径）
    const smallRadius = 2; // 更小的默认点半径
    let actualRadius;
    
    if (scale >= 1.5) {
      // 大缩放：使用能容纳文字的最小圆圈
      const fontSize = Math.max(10, Math.min(16, 12 * scale));
      
      // 根据文字大小计算合适的圆圈半径
      // 文字高度约等于fontSize，需要留一点边距
      const textBasedRadius = Math.max(8, fontSize * 0.7); // 文字大小的70%作为半径
      
      // 限制最大半径，在高缩放时不要让圆圈过大
      const maxRadiusForLargeScale = Math.min(12, 8 + (scale - 1.5) * 2); // 最大12px，缓慢增长
      
      actualRadius = Math.min(textBasedRadius, maxRadiusForLargeScale);
      actualRadius = Math.max(8, actualRadius); // 最小保证8px
    } else {
      // 默认和小缩放：使用更小的点
      actualRadius = smallRadius + (scale - 0.1) * 1.5; // 从2px到4px的范围
      actualRadius = Math.max(smallRadius, Math.min(4, actualRadius));
    }
    
    return {
      scale: scale,
      radius: actualRadius,
      showInternalLabel: scale >= 1.5, // 只有在1.5倍缩放以上才内部显示
      showExternalLabel: scale >= this.options.tinyThresholdScale, // 大部分情况下外部显示
      showMinimalMode: scale < this.options.tinyThresholdScale,
      fontSize: Math.max(10, Math.min(16, 12 * scale)),
      directionFontSize: Math.max(8, Math.min(12, 10 * scale)),
      labelOffset: 8, // 更小的偏移距离
      borderWidth: Math.max(1, Math.min(2, 1.5 * scale))
    };
  }

  /**
   * 创建外部标签
   */
  createExternalLabel(x, y, label, direction, fillColor, strategy) {
    const canvas = this.canvas;
    const container = canvas.parentElement;
    
    // 创建标签元素
    const labelElement = document.createElement('div');
    labelElement.className = `keypoint-label ${direction === 'left' ? 'left-direction' : 'right-direction'}`;
    labelElement.textContent = label.toString();
    labelElement.dataset.keypointId = `${x}-${y}`;
    
    // 计算标签位置
    const rect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const offsetX = rect.left - containerRect.left;
    const offsetY = rect.top - containerRect.top;
    
    // 根据标注点大小调整标签位置，让标签距离更远
    const labelOffsetY = strategy.radius < 4 ? 12 : 15;
    
    labelElement.style.left = (offsetX + x - 6) + 'px'; // 居中对齐，稍微调整
    labelElement.style.top = (offsetY + y - strategy.radius - labelOffsetY) + 'px';
    
    container.appendChild(labelElement);
  }

  /**
   * 创建悬停提示
   */
  createTooltip(x, y, label, direction, keypoint) {
    const canvas = this.canvas;
    const container = canvas.parentElement;
    
    // 移除已存在的提示
    const existingTooltip = container.querySelector('.keypoint-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // 创建提示元素
    const tooltip = document.createElement('div');
    tooltip.className = 'keypoint-tooltip';
    
    const directionText = direction === 'left' ? '左侧' : '右侧';
    const coordinateText = `(${Math.round(keypoint.x)}, ${Math.round(keypoint.y)})`;
    
    tooltip.innerHTML = `
      <div>分支点 #${label}</div>
      <div>方向: ${directionText}</div>
      <div>位置: ${coordinateText}</div>
    `;
    
    // 计算提示位置
    const rect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const offsetX = rect.left - containerRect.left;
    const offsetY = rect.top - containerRect.top;
    
    tooltip.style.left = (offsetX + x - 60) + 'px';
    tooltip.style.top = (offsetY + y - 80) + 'px';
    
    container.appendChild(tooltip);
    
    // 自动移除提示
    setTimeout(() => {
      if (tooltip.parentElement) {
        tooltip.remove();
      }
    }, 3000);
  }

  /**
   * 清除所有标注点标签
   */
  clearKeypointLabels() {
    if (!this.canvas || !this.canvas.parentElement) return;
    
    const container = this.canvas.parentElement;
    const labels = container.querySelectorAll('.keypoint-label');
    labels.forEach(label => label.remove());
  }

  /**
   * 更新缩放级别指示器
   */
  updateZoomIndicator(strategy) {
    const indicator = document.getElementById('zoom-indicator');
    if (!indicator) return;
    
    // 移除所有状态类
    indicator.classList.remove('small', 'tiny');
    
    if (strategy.showMinimalMode) {
      indicator.classList.add('tiny');
    } else if (strategy.showExternalLabel) {
      indicator.classList.add('small');
    }
  }

  /**
   * 更新标注点大小信息
   */
  updateAnnotationSizeInfo(strategy) {
    const sizeInfo = document.getElementById('annotation-size-info');
    const sizeText = document.getElementById('size-info-text');
    
    if (!sizeInfo || !sizeText) return;
    
    let statusText = '';
    let showInfo = false;
    
    if (strategy.showMinimalMode) {
      statusText = '标注点: 极小模式（悬停查看详情）';
      showInfo = true;
    } else if (strategy.showExternalLabel) {
      statusText = '标注点: 外部标签模式';
      showInfo = true;
    } else {
      statusText = '标注点: 正常大小';
      showInfo = this.keypoints.length > 0 && (strategy.scale < 0.8 || strategy.scale > 3);
    }
    
    sizeText.textContent = statusText;
    
    if (showInfo) {
      sizeInfo.classList.add('visible');
      
      // 自动隐藏
      setTimeout(() => {
        if (sizeInfo) {
          sizeInfo.classList.remove('visible');
        }
      }, 2000);
    } else {
      sizeInfo.classList.remove('visible');
    }
  }

  /**
   * 同步分支点预览
   */
  syncBranchPointPreview() {
    // 通过全局对象访问分支点预览管理器
    const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
    const appState = window.PlantAnnotationTool?.appState;
    
    if (branchPointPreviewManager && appState?.currentPlant && appState?.currentImage) {
      // 获取当前标注点数量并更新预览上下文
      const currentKeypointCount = this.keypoints.length;
      
      // 异步更新预览上下文
      setTimeout(async () => {
        try {
          const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
          if (plantDataManager) {
            const images = await plantDataManager.getPlantImages(
              appState.currentPlant.id, 
              appState.currentPlant.selectedViewAngle
            );
            const imageIndex = images.findIndex(img => img.id === appState.currentImage.id);
            
            await branchPointPreviewManager.updateContext(
              appState.currentPlant.id,
              appState.currentPlant.selectedViewAngle,
              imageIndex,
              currentKeypointCount
            );
          }
        } catch (error) {
          console.warn('同步分支点预览失败:', error);
        }
      }, 100);
    }
  }

  /**
   * 通知预览管理器显示被拖动点对应的预览
   */
  notifyDraggedKeypointPreview(keypoint) {
    // 通过全局对象访问分支点预览管理器
    const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
    
    if (branchPointPreviewManager && keypoint && keypoint.order) {
      // 告诉预览管理器显示这个编号的预览
      branchPointPreviewManager.showSpecificOrderPreview(keypoint.order);
    }
  }

  /**
   * 自动保存当前图像
   */
  async autoSaveCurrentImage() {
    try {
      const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
      const appState = window.PlantAnnotationTool?.appState;
      
      if (!plantDataManager || !appState?.currentPlant || !appState?.currentImage) {
        console.warn('自动保存跳过：缺少必要的上下文信息');
        return;
      }
      
      // 🔧 FIX: 检查 currentImage 的有效性，防止 null 引用错误
      if (!appState.currentImage || !appState.currentImage.id) {
        console.warn('自动保存跳过：当前图像信息无效');
        return;
      }
      
      // 获取当前标注数据
      const annotationData = this.getAnnotationData();
      
      // 保存到当前图像（即使没有标注点也要保存，表示清空状态）
      await plantDataManager.saveImageAnnotations(
        appState.currentImage.id,
        annotationData.keypoints
      );
      
      console.log(`自动保存完成：${annotationData.keypoints.length} 个标注点已保存到图像 ${appState.currentImage.id}`);
      
      // 🔧 FIX: 自动保存后立即刷新缩略图状态（通过全局函数访问）
      try {
        // 尝试通过window对象访问全局函数
        const refreshFunction = window.refreshThumbnailAnnotationStatus;
        if (typeof refreshFunction === 'function') {
          await refreshFunction(appState.currentImage.id);
          console.log('自动保存后缩略图状态已刷新');
        } else {
          console.warn('refreshThumbnailAnnotationStatus 函数未找到，跳过缩略图刷新');
        }
      } catch (refreshError) {
        console.warn('刷新缩略图状态失败:', refreshError);
      }
      
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }

  /**
   * 🔄 触发实时同步操作
   * @param {string} operationType - 操作类型 ('ADD_KEYPOINT', 'MOVE_KEYPOINT', 'DELETE_KEYPOINT', 'EDIT_DIRECTION')
   * @param {object} keypoint - 相关的关键点数据
   * @param {object} previousPosition - 之前的位置（仅移动操作需要）
   */
  triggerRealTimeSync(operationType, keypoint, previousPosition = null) {
    try {
      // 获取实时同步管理器
      const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
      
      if (!realTimeSyncManager) {
        console.warn('🔄 实时同步管理器未找到，跳过同步操作');
        return;
      }

      // 检查是否启用了实时同步
      if (!realTimeSyncManager.isRealTimeSyncEnabled()) {
        console.log('🔄 实时同步已禁用，跳过同步操作');
        return;
      }

      // 获取当前上下文
      const appState = window.PlantAnnotationTool?.appState;
      if (!appState?.currentPlant || !appState?.currentImage) {
        console.warn('🔄 缺少当前植株或图像信息，跳过同步操作');
        return;
      }

      // 🔧 Enhanced Debug: Log detailed keypoint information
      const keypointInfo = {
        id: keypoint?.id,
        order: keypoint?.order,
        annotationType: keypoint?.annotationType,
        customTypeId: keypoint?.customTypeId,
        x: keypoint?.x,
        y: keypoint?.y
      };

      console.log(`🔄 触发实时同步: ${operationType}`, {
        keypoint: keypointInfo,
        plant: appState.currentPlant.id,
        image: appState.currentImage.id,
        isCustom: keypoint?.annotationType === 'custom'
      });

      // 🔧 FIX: Route custom annotations to custom annotation sync methods
      // This is crucial for proper order-based synchronization
      const isCustomAnnotation = keypoint?.annotationType === 'custom';
      
      if (isCustomAnnotation) {
        // Use custom annotation sync methods for custom annotations
        console.log(`🔄 Using custom annotation sync for ${operationType}`);
        
        switch (operationType) {
          case 'ADD_KEYPOINT':
            // Create sync data for custom annotation creation
            const createSyncData = {
              type: 'CUSTOM_ANNOTATION_CREATE',
              annotation: keypoint,
              context: {
                imageId: appState.currentImage.id,
                plantId: appState.currentPlant.id,
                viewAngle: appState.currentPlant.selectedViewAngle,
                appState: appState
              },
              timestamp: new Date().toISOString()
            };
            realTimeSyncManager.triggerCustomAnnotationSync(createSyncData);
            break;
            
          case 'MOVE_KEYPOINT':
            // Create sync data for custom annotation update
            const updateSyncData = {
              type: 'CUSTOM_ANNOTATION_UPDATE',
              annotation: keypoint,
              context: {
                imageId: appState.currentImage.id,
                plantId: appState.currentPlant.id,
                viewAngle: appState.currentPlant.selectedViewAngle,
                appState: appState,
                positionChange: {
                  from: previousPosition,
                  to: { x: keypoint.x, y: keypoint.y }
                }
              },
              timestamp: new Date().toISOString()
            };
            realTimeSyncManager.triggerCustomAnnotationSync(updateSyncData);
            break;
            
          case 'DELETE_KEYPOINT':
            // Create sync data for custom annotation deletion
            const deleteSyncData = {
              type: 'CUSTOM_ANNOTATION_DELETE',
              annotation: keypoint,
              context: {
                imageId: appState.currentImage.id,
                plantId: appState.currentPlant.id,
                viewAngle: appState.currentPlant.selectedViewAngle,
                appState: appState
              },
              timestamp: new Date().toISOString()
            };
            realTimeSyncManager.triggerCustomAnnotationSync(deleteSyncData);
            break;
            
          default:
            console.warn(`🔄 未知的自定义标注同步操作类型: ${operationType}`);
        }
      } else {
        // Use regular keypoint sync methods for regular annotations
        console.log(`🔄 Using regular keypoint sync for ${operationType}`);
        
        switch (operationType) {
          case 'ADD_KEYPOINT':
            realTimeSyncManager.triggerKeypointAddSync(
              keypoint,
              appState.currentImage,
              appState.currentPlant
            );
            break;
            
          case 'MOVE_KEYPOINT':
            realTimeSyncManager.triggerKeypointMoveSync(
              keypoint,
              previousPosition,
              appState.currentImage,
              appState.currentPlant
            );
            break;
            
          case 'DELETE_KEYPOINT':
            realTimeSyncManager.triggerKeypointDeleteSync(
              keypoint,
              appState.currentImage,
              appState.currentPlant
            );
            break;
            
          case 'EDIT_DIRECTION':
            realTimeSyncManager.triggerDirectionEditSync(
              keypoint,
              appState.currentImage,
              appState.currentPlant
            );
            break;
            
          default:
            console.warn(`🔄 未知的常规标注同步操作类型: ${operationType}`);
        }
      }
      
    } catch (error) {
      console.error('🔄 触发实时同步失败:', error);
    }
  }

  /**
   * 渲染方向指示器（统一处理所有方向类型）
   */
  renderDirectionIndicator(x, y, direction, keypoint) {
    if (!direction) return;

    let angleDegrees;
    let directionText = '';

    // 统一转换为角度
    if (typeof direction === 'number') {
      // 已经是角度
      angleDegrees = direction;
      directionText = `${angleDegrees.toFixed(1)}°`;
    } else if (direction === 'left') {
      // 左侧：180度
      angleDegrees = 180;
      directionText = '左侧 (180°)';
    } else if (direction === 'right') {
      // 右侧：0度
      angleDegrees = 0;
      directionText = '右侧 (0°)';
    } else {
      return; // 未知方向类型
    }

    this.renderDirectionArrow(x, y, angleDegrees, directionText, keypoint);
  }

  /**
   * 渲染方向箭头（改进版 - 虚线从中心延伸）
   */
  renderDirectionArrow(x, y, angleDegrees, directionText, keypoint) {
    const angleRadians = angleDegrees * Math.PI / 180;
    const arrowLength = this.options.directionArrowLength;

    // 计算箭头终点
    const endX = x + Math.cos(angleRadians) * arrowLength;
    const endY = y + Math.sin(angleRadians) * arrowLength;

    // 绘制虚线主线
    this.ctx.strokeStyle = '#10b981'; // 绿色
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([8, 4]); // 虚线样式
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // 重置虚线样式
    this.ctx.setLineDash([]);

    // 绘制箭头头部（实线）
    const headAngle1 = angleRadians + Math.PI * 0.8;
    const headAngle2 = angleRadians - Math.PI * 0.8;
    const headLength = 15;

    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX + Math.cos(headAngle1) * headLength, endY + Math.sin(headAngle1) * headLength);
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX + Math.cos(headAngle2) * headLength, endY + Math.sin(headAngle2) * headLength);
    this.ctx.stroke();

    // 绘制方向文本（带背景）
    const textOffset = 20;
    const textX = endX + Math.cos(angleRadians) * textOffset;
    const textY = endY + Math.sin(angleRadians) * textOffset;

    // 测量文本尺寸
    this.ctx.font = 'bold 11px Arial';
    const textMetrics = this.ctx.measureText(directionText);
    const textWidth = textMetrics.width;
    const textHeight = 11;

    // 绘制文本背景
    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    this.ctx.fillRect(textX - textWidth/2 - 3, textY - textHeight/2 - 2, textWidth + 6, textHeight + 4);

    // 绘制文本
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(directionText, textX, textY);
  }

  /**
   * 渲染方向选择指引
   */
  renderDirectionSelectionGuide() {
    if (!this.state.selectedKeypoint || !this.state.directionSelectionPoint) return;

    const keypointScreen = this.imageToScreen(
      this.state.selectedKeypoint.x,
      this.state.selectedKeypoint.y
    );

    const guideX = this.state.directionSelectionPoint.x;
    const guideY = this.state.directionSelectionPoint.y;

    // 计算距离，只有足够远才显示指引
    const distance = Math.sqrt(
      Math.pow(guideX - keypointScreen.x, 2) +
      Math.pow(guideY - keypointScreen.y, 2)
    );

    if (distance < 20) return; // 距离太近不显示

    // 绘制虚线指引线
    this.ctx.strokeStyle = '#f59e0b'; // 橙色
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([8, 4]);
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(keypointScreen.x, keypointScreen.y);
    this.ctx.lineTo(guideX, guideY);
    this.ctx.stroke();

    // 绘制箭头头部
    const deltaX = guideX - keypointScreen.x;
    const deltaY = guideY - keypointScreen.y;
    const angle = Math.atan2(deltaY, deltaX);
    const normalizedAngle = (angle * 180 / Math.PI + 360) % 360;

    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    const headLength = 12;

    this.ctx.setLineDash([]); // 实线箭头
    this.ctx.beginPath();
    this.ctx.moveTo(guideX, guideY);
    this.ctx.lineTo(guideX + Math.cos(headAngle1) * headLength, guideY + Math.sin(headAngle1) * headLength);
    this.ctx.moveTo(guideX, guideY);
    this.ctx.lineTo(guideX + Math.cos(headAngle2) * headLength, guideY + Math.sin(headAngle2) * headLength);
    this.ctx.stroke();

    // 绘制角度文本（带背景）
    const textOffset = 25;
    const textX = guideX + Math.cos(angle) * textOffset;
    const textY = guideY + Math.sin(angle) * textOffset;
    const angleText = `${normalizedAngle.toFixed(1)}°`;

    // 测量文本尺寸
    this.ctx.font = 'bold 12px Arial';
    const textMetrics = this.ctx.measureText(angleText);
    const textWidth = textMetrics.width;
    const textHeight = 12;

    // 绘制文本背景
    this.ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    this.ctx.fillRect(textX - textWidth/2 - 4, textY - textHeight/2 - 2, textWidth + 8, textHeight + 4);

    // 绘制文本
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(angleText, textX, textY);

    // 重置线条样式
    this.ctx.setLineDash([]);
  }

  /**
   * 升级传统方向到角度方向
   */
  upgradeLegacyDirections() {
    let upgraded = 0;

    this.keypoints.forEach(keypoint => {
      if (keypoint.direction === 'left' && keypoint.directionType !== 'angle') {
        keypoint.direction = 180;
        keypoint.directionType = 'angle';
        upgraded++;
      } else if (keypoint.direction === 'right' && keypoint.directionType !== 'angle') {
        keypoint.direction = 0;
        keypoint.directionType = 'angle';
        upgraded++;
      }
    });

    if (upgraded > 0) {
      console.log(`Upgraded ${upgraded} legacy direction annotations to angle format`);
      this.saveState();
      this.render();
      this.autoSaveCurrentImage();
    }

    return upgraded;
  }

  /**
   * 设置自动切换到预期位置功能
   */
  setAutoMoveToExpectedPosition(enabled) {
    this.state.autoMoveToExpectedPosition = enabled;
    console.log(`自动切换到预期位置: ${enabled ? '开启' : '关闭'}`);
  }

  /**
   * 获取目标缩放倍数（锁定倍数优先，否则保持当前倍数）
   */
  getTargetScale() {
    // 获取锁定倍数设置
    if (typeof window.getZoomLockSettings === 'function') {
      const zoomSettings = window.getZoomLockSettings();
      if (zoomSettings.isLocked) {
        console.log(`[自动切换] 使用锁定倍数: ${zoomSettings.lockValue}x`);
        return zoomSettings.lockValue;
      }
    }

    // 非锁定状态：保持当前倍数
    console.log(`[自动切换] 保持当前倍数: ${this.state.scale.toFixed(1)}x`);
    return this.state.scale;
  }

  /**
   * 移动视角到最高标记点并保持当前缩放
   */
  moveToHighestKeypoint() {
    if (!this.keypoints || this.keypoints.length === 0) {
      console.log('没有标注点，无法移动视角');
      return false;
    }

    // 找到序号最大的标注点
    const highestKeypoint = this.keypoints.reduce((highest, current) => {
      const currentOrder = current.order || 0;
      const highestOrder = highest.order || 0;
      return currentOrder > highestOrder ? current : highest;
    });

    console.log(`移动视角到最高标记点 #${highestKeypoint.order}`);

    // 保持当前缩放，只移动视角中心
    const currentScale = this.state.scale;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // 计算新的平移，使最高标记点居中
    this.state.translateX = centerX - (highestKeypoint.x * currentScale);
    this.state.translateY = centerY - (highestKeypoint.y * currentScale);

    // 确保图像不会超出边界
    this.constrainView();

    this.updateZoomInfo();
    this.render();

    console.log(`视角已移动到标注点 #${highestKeypoint.order}，保持缩放: ${currentScale.toFixed(1)}x`);
    return true;
  }

  /**
   * 移动到预期位置（基于预览图中的参考位置）
   * @param {boolean} isImageSwitch - 是否是图片切换触发的
   */
  async moveToExpectedPosition(isImageSwitch = false) {
    if (!this.state.autoMoveToExpectedPosition) {
      return; // 功能未开启
    }

    try {
      if (isImageSwitch) {
        // 图片切换时的逻辑：分析切换到的新图像
        await this.handleImageSwitchAutoMove();
      } else {
        // 标注点创建后的逻辑：移动到下一个预期位置
        await this.moveToNextExpectedPosition();
      }
    } catch (error) {
      console.error('[自动切换] 移动到预期位置失败:', error);
    }
  }

  /**
   * 处理图片切换时的自动移动
   */
  async handleImageSwitchAutoMove() {
    // 分析新图像（当前加载的图像）的标注情况
    const newImageAnnotations = this.keypoints || [];

    console.log(`[自动切换] 图片切换：新图像有 ${newImageAnnotations.length} 个标注点`);

    if (newImageAnnotations.length === 0) {
      // 情况1: 新图像没有标注，移动到1号点位置
      console.log('[自动切换] 新图像没有标注，移动到1号点位置');
      await this.moveToPosition1();
    } else {
      // 检查新图像的标注点是否都没有方向
      const hasDirectionAnnotations = newImageAnnotations.some(kp =>
        kp.direction !== null && kp.direction !== undefined &&
        (typeof kp.direction === 'number' || kp.directionType === 'angle')
      );

      if (!hasDirectionAnnotations) {
        // 情况2: 新图像有标注但都没有方向，移动到几何中心
        console.log('[自动切换] 新图像有无方向标注，移动到几何中心');
        this.moveToAnnotationsCenter();
      } else {
        // 情况3: 新图像有方向标注，保持当前位置不动
        console.log('[自动切换] 新图像有方向标注，保持当前位置');
      }
    }
  }

  /**
   * 移动到1号位置（从预览图获取）
   */
  async moveToPosition1() {
    try {
      // 获取分支点预览管理器
      const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
      if (!branchPointPreviewManager) {
        console.log('[自动切换] 预览管理器不可用，无法获取1号位置');
        return;
      }

      // 获取1号位置
      const position1 = await branchPointPreviewManager.getExpectedPosition(1);

      if (position1) {
        console.log(`[自动切换] 移动到1号位置: (${position1.x.toFixed(1)}, ${position1.y.toFixed(1)})`);

        // 检查是否需要应用锁定倍数
        const zoomSettings = typeof window.getZoomLockSettings === 'function' ? window.getZoomLockSettings() : { isLocked: false };

        if (zoomSettings.isLocked) {
          // 锁定状态：使用锁定倍数
          this.state.scale = zoomSettings.lockValue;
          console.log(`[自动切换] 应用锁定倍数: ${zoomSettings.lockValue}x`);
        } else {
          // 非锁定状态：保持当前倍数
          console.log(`[自动切换] 保持当前倍数: ${this.state.scale.toFixed(1)}x`);
        }

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 计算新的位置
        this.state.translateX = centerX - (position1.x * this.state.scale);
        this.state.translateY = centerY - (position1.y * this.state.scale);

        // 确保图像不会超出边界
        this.constrainView();

        this.updateZoomInfo();
        this.render();

        console.log(`[自动切换] 视角已移动到1号位置，缩放: ${this.state.scale.toFixed(1)}x`);
      } else {
        console.log(`[自动切换] 未找到1号位置的参考坐标`);
      }
    } catch (error) {
      console.error('[自动切换] 移动到1号位置失败:', error);
    }
  }

  /**
   * 移动到所有标注点的几何中心
   */
  moveToAnnotationsCenter() {
    const annotations = this.keypoints || [];
    if (annotations.length === 0) {
      return;
    }

    // 计算几何中心
    let sumX = 0, sumY = 0;
    for (const annotation of annotations) {
      sumX += annotation.x;
      sumY += annotation.y;
    }

    const centerX_img = sumX / annotations.length;
    const centerY_img = sumY / annotations.length;

    console.log(`[自动切换] 移动到标注点几何中心: (${centerX_img.toFixed(1)}, ${centerY_img.toFixed(1)}), 共${annotations.length}个标注点`);

    // 检查是否需要应用锁定倍数
    const zoomSettings = typeof window.getZoomLockSettings === 'function' ? window.getZoomLockSettings() : { isLocked: false };

    if (zoomSettings.isLocked) {
      // 锁定状态：使用锁定倍数
      this.state.scale = zoomSettings.lockValue;
      console.log(`[自动切换] 应用锁定倍数: ${zoomSettings.lockValue}x`);
    } else {
      // 非锁定状态：保持当前倍数
      console.log(`[自动切换] 保持当前倍数: ${this.state.scale.toFixed(1)}x`);
    }

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // 计算新的位置
    this.state.translateX = centerX - (centerX_img * this.state.scale);
    this.state.translateY = centerY - (centerY_img * this.state.scale);

    // 确保图像不会超出边界
    this.constrainView();

    this.updateZoomInfo();
    this.render();

    console.log(`[自动切换] 视角已移动到标注点几何中心，缩放: ${this.state.scale.toFixed(1)}x`);
  }

  /**
   * 移动到下一个预期位置（原有逻辑）
   */
  async moveToNextExpectedPosition() {
    try {
      // 获取分支点预览管理器
      const branchPointPreviewManager = window.PlantAnnotationTool?.branchPointPreviewManager;
      if (!branchPointPreviewManager) {
        console.log('[自动切换] 预览管理器不可用');
        return;
      }

      // 获取下一个要标注的编号
      const nextOrder = this.findNextAvailableOrder();

      // 从预览管理器获取预期位置
      const expectedPosition = await branchPointPreviewManager.getExpectedPosition(nextOrder);

      if (expectedPosition) {
        console.log(`[自动切换] 移动到预期位置: 编号${nextOrder}, 坐标(${expectedPosition.x.toFixed(1)}, ${expectedPosition.y.toFixed(1)})`);

        // 检查是否需要应用锁定倍数
        const zoomSettings = typeof window.getZoomLockSettings === 'function' ? window.getZoomLockSettings() : { isLocked: false };

        if (zoomSettings.isLocked) {
          // 锁定状态：使用锁定倍数
          this.state.scale = zoomSettings.lockValue;
          console.log(`[自动切换] 应用锁定倍数: ${zoomSettings.lockValue}x`);
        } else {
          // 非锁定状态：保持当前倍数
          console.log(`[自动切换] 保持当前倍数: ${this.state.scale.toFixed(1)}x`);
        }

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 计算新的位置
        this.state.translateX = centerX - (expectedPosition.x * this.state.scale);
        this.state.translateY = centerY - (expectedPosition.y * this.state.scale);

        // 确保图像不会超出边界
        this.constrainView();

        this.updateZoomInfo();
        this.render();

        console.log(`[自动切换] 视角已移动到预期位置，缩放: ${this.state.scale.toFixed(1)}x`);
      } else {
        console.log(`[自动切换] 未找到编号${nextOrder}的预期位置`);
      }
    } catch (error) {
      console.error('[自动切换] 移动到下一个预期位置失败:', error);
    }
  }

  /**
   * 尝试自动切换到下一张图片继续自动化
   */
  tryAutoSwitchToNextImage() {
    // 检查是否有全局的图片导航功能
    if (typeof window.navigateToNextImage === 'function') {
      // 调用全局的下一张图片函数（自动化模式，不循环）
      window.navigateToNextImage(true).then(success => {
        if (success) {
          // 切换成功，延迟一点时间等待图片加载，然后重新开始自动化
          setTimeout(() => {
            this.restartAutoDirectionMode();
          }, 300);
        } else {
          // 没有下一张图片，结束自动化
          console.log('没有更多图片，结束自动化');
          this.exitAutoDirectionMode();
          this.resetAutoDirectionButton();

          if (window.showSuccess) {
            window.showSuccess('全部完成', '所有图片的方向设置已完成！');
          }
        }
      });
      return true; // 表示已经处理了切换逻辑
    }

    // 如果没有全局导航函数，尝试模拟右箭头键
    if (typeof window.handleKeyDown === 'function') {
      const rightArrowEvent = {
        key: 'ArrowRight',
        preventDefault: () => {},
        stopPropagation: () => {}
      };

      window.handleKeyDown(rightArrowEvent);

      // 延迟一点时间等待图片切换，然后重新开始自动化
      setTimeout(() => {
        this.restartAutoDirectionMode();
      }, 200);
      return true;
    }

    return false; // 无法切换到下一张图片
  }

  /**
   * 重新开始自动化方向设置模式（用于图片切换后）
   */
  restartAutoDirectionMode() {
    console.log('[调试] 重新开始自动化方向设置模式');

    // 清除当前状态
    this.state.isAutoDirectionMode = false;
    this.state.autoDirectionKeypoints = [];
    this.state.autoDirectionIndex = 0;

    // 重新启动自动化模式
    const success = this.startAutoDirectionMode();
    if (!success) {
      // 如果新图片没有需要设置方向的点，结束自动化
      console.log('新图片没有需要设置方向的标注点，结束自动化');
      this.exitAutoDirectionMode();
      this.resetAutoDirectionButton();

      if (window.showInfo) {
        window.showInfo('自动化完成', '已完成所有图片的方向设置');
      }
    }
  }

  /**
   * 重置自动化方向选择按钮状态
   */
  resetAutoDirectionButton() {
    const autoDirectionBtn = document.getElementById('auto-direction-btn');
    if (autoDirectionBtn) {
      console.log('[调试] 重置按钮状态为正常模式');

      // 移除暂停模式的事件监听器
      if (autoDirectionBtn._pauseHandler) {
        autoDirectionBtn.removeEventListener('click', autoDirectionBtn._pauseHandler);
        autoDirectionBtn._pauseHandler = null;
      }

      // 更新按钮外观
      autoDirectionBtn.textContent = 'Auto Direction';
      autoDirectionBtn.classList.remove('active');

      // 重新添加原始的点击事件
      if (window.handleAutoDirectionSelection) {
        autoDirectionBtn.addEventListener('click', window.handleAutoDirectionSelection);
      }
    }
  }

  /**
   * 暂停自动化方向升级模式
   */
  pauseAutoDirectionMode() {
    if (!this.state.isAutoDirectionMode) return;

    const remaining = this.state.autoDirectionKeypoints.length - this.state.autoDirectionIndex;
    const completed = this.state.autoDirectionIndex;

    this.exitAutoDirectionMode();

    // 重置按钮状态
    this.resetAutoDirectionButton();

    console.log(`方向升级模式已暂停，已完成 ${completed} 个，剩余 ${remaining} 个`);

    // 显示暂停提示
    if (window.showInfo) {
      window.showInfo('升级暂停', `已完成 ${completed} 个标注点的升级，剩余 ${remaining} 个。可重新点击"自动化方向选择"继续。`);
    }
  }

  /**
   * 开始自定义标注拖拽
   */
  startCustomAnnotationDrag(annotation, mousePos) {
    if (!this.customAnnotationRenderer) return;
    
    this.customAnnotationDragState.isDragging = true;
    this.customAnnotationDragState.draggedAnnotation = annotation;
    this.customAnnotationDragState.startPosition = mousePos;
    
    // 通知渲染器开始拖拽
    this.customAnnotationRenderer.startDrag(annotation, mousePos);
    
    this.canvas.style.cursor = 'grabbing';
    console.log('Started custom annotation drag:', annotation.id);
  }
  
  /**
   * 更新自定义标注拖拽
   */
  updateCustomAnnotationDrag(mousePos) {
    if (!this.customAnnotationRenderer || !this.customAnnotationDragState.isDragging) return;
    
    // 更新拖拽位置
    const updated = this.customAnnotationRenderer.updateDrag(mousePos);
    
    if (updated) {
      this.render();
    }
  }
  
  /**
   * 完成自定义标注拖拽
   */
  finishCustomAnnotationDrag() {
    if (!this.customAnnotationRenderer || !this.customAnnotationDragState.isDragging) return;
    
    // 完成拖拽
    const result = this.customAnnotationRenderer.finishDrag();
    
    if (result && result.moved) {
      // 标注被移动了，触发保存和同步
      this.customAnnotationManager.saveToStorage();
      
      // 触发更新事件
      this.customAnnotationManager.triggerEvent('onAnnotationUpdate', result.annotation);
      
      // 实时同步
      this.customAnnotationManager.triggerCustomAnnotationUpdateSync(result.annotation, {
        imageId: this.getAppState()?.currentImage?.id,
        positionChange: {
          from: result.startPosition,
          to: {
            x: result.annotation.x,
            y: result.annotation.y
          }
        },
        timestamp: new Date().toISOString()
      });
      
      // 🔧 FIX: 更新预览区域 - 同步分支点预览
      this.syncBranchPointPreview();
      
      console.log('Custom annotation dragged and saved:', result.annotation.id);
    }
    
    // 清除拖拽状态
    this.customAnnotationDragState.isDragging = false;
    this.customAnnotationDragState.draggedAnnotation = null;
    this.customAnnotationDragState.startPosition = null;
    
    this.canvas.style.cursor = 'crosshair';
    this.render();
  }
  
  /**
   * 取消自定义标注拖拽
   */
  cancelCustomAnnotationDrag() {
    if (!this.customAnnotationRenderer || !this.customAnnotationDragState.isDragging) return;
    
    // 取消拖拽
    this.customAnnotationRenderer.cancelDrag();
    
    // 清除拖拽状态
    this.customAnnotationDragState.isDragging = false;
    this.customAnnotationDragState.draggedAnnotation = null;
    this.customAnnotationDragState.startPosition = null;
    
    this.canvas.style.cursor = 'crosshair';
    this.render();
    
    console.log('Cancelled custom annotation drag');
  }
  
  /**
   * 获取应用状态
   */
  getAppState() {
    return window.PlantAnnotationTool?.appState;
  }
  
  /**
   * 初始化自定义标注系统
   */
  async initializeCustomAnnotationSystem() {
    try {
      // 动态导入自定义标注管理器
      const { CustomAnnotationManager } = await import('./CustomAnnotationManager.js');
      this.customAnnotationManager = new CustomAnnotationManager(this);
      
      // 🔄 NEW: 设置实时同步管理器
      const realTimeSyncManager = window.PlantAnnotationTool?.realTimeSyncManager;
      if (realTimeSyncManager) {
        this.customAnnotationManager.setRealTimeSyncManager(realTimeSyncManager);
        console.log('Custom annotation real-time sync manager connected');
      } else {
        console.warn('Real-time sync manager not available for custom annotations');
      }
      
      // 🔧 NEW: 添加模式变化监听器同步分支点预览
      this.customAnnotationManager.addEventListener('onModeChange', (data) => {
        console.log('Mode changed:', data.mode, 'Type:', data.typeId);
        this.syncBranchPointPreview();
      });
      
      console.log('CustomAnnotationManager initialized');
      
      // 动态导入自定义标注渲染器
      const { CustomAnnotationRenderer } = await import('./CustomAnnotationRenderer.js');
      this.customAnnotationRenderer = new CustomAnnotationRenderer(this, this.customAnnotationManager);
      console.log('CustomAnnotationRenderer initialized');
      
      // 标记系统已就绪
      this.customAnnotationSystemReady = true;
      
      // 通知系统自定义标注系统已准备就绪
      if (window.onCustomAnnotationSystemReady && typeof window.onCustomAnnotationSystemReady === 'function') {
        setTimeout(() => {
          window.onCustomAnnotationSystemReady();
        }, 100); // 给一个小延迟确保完全初始化
      }
      
    } catch (error) {
      console.warn('Failed to initialize custom annotation system:', error);
    }
  }

  /**
   * 渲染自定义标注（统一版本）
   * 注意：在统一系统中，自定义标注已经集成到keypoints数组中，
   * 并通过renderKeypoints方法统一渲染，此方法仅保留兼容性
   */
  renderCustomAnnotations() {
    // 在统一系统中，自定义标注已经通过 renderKeypoints() 方法渲染
    // 这里保留方法以维持兼容性，但不执行任何操作
    console.debug('renderCustomAnnotations called (unified system - no action needed)');
  }

  /**
   * 获取指定位置的自定义标注（统一版本）
   */
  getCustomAnnotationAt(mousePos) {
    // 在统一系统中，自定义标注存储在keypoints数组中
    const threshold = this.options.baseKeypointRadius + 5;
    
    return this.keypoints.find(keypoint => {
      // 只检查自定义标注
      if (keypoint.annotationType !== 'custom') return false;
      
      const keypointScreen = this.imageToScreen(keypoint.x, keypoint.y);
      
      if (keypoint.width && keypoint.height) {
        // 区域标注 - 检查是否在矩形区域内
        const bottomRight = this.imageToScreen(keypoint.x + keypoint.width, keypoint.y + keypoint.height);
        return mousePos.x >= keypointScreen.x && mousePos.x <= bottomRight.x &&
               mousePos.y >= keypointScreen.y && mousePos.y <= bottomRight.y;
      } else {
        // 点标注 - 检查距离
        const distance = Math.sqrt(
          Math.pow(mousePos.x - keypointScreen.x, 2) +
          Math.pow(mousePos.y - keypointScreen.y, 2)
        );
        return distance <= threshold;
      }
    }) || null;
  }

  /**
   * 处理自定义标注点击（统一版本）
   */
  handleCustomAnnotationClick(customAnnotation, mousePos) {
    // 在统一系统中，自定义标注点击处理与常规标注相同
    console.log('Custom annotation clicked:', customAnnotation.id, 'type:', customAnnotation.annotationType);
    
    // 可以在这里添加自定义标注特有的点击逻辑
    // 例如显示自定义标注的详细信息
    const customType = this.getCustomType(customAnnotation.customTypeId);
    if (customType) {
      console.log('Custom type:', customType.name, 'color:', customType.color);
    }
  }

  /**
   * 处理自定义标注模式下的点击
   */
  handleCustomAnnotationMode(mousePos) {
    if (!this.customAnnotationManager) {
      console.warn('Custom annotation manager not available');
      return;
    }
    
    // 🔧 NEW: 进入自定义标注模式时中断所有方向相关模式
    this.interruptAllDirectionModes('custom_annotation_mode');
    
    try {
      const appState = window.PlantAnnotationTool?.appState;
      const currentImageId = appState?.currentImage?.id;
      
      if (!currentImageId) {
        console.warn('No current image ID available for custom annotation');
        return;
      }
      
      const customType = this.customAnnotationManager.getCurrentCustomType();
      if (!customType) {
        console.warn('No custom type selected');
        return;
      }
      
      if (customType.type === 'region') {
        // 区域类型：开始拖拽
        this.startCustomRegionDrag(mousePos);
      } else if (customType.type === 'point') {
        // 点类型：使用统一系统直接创建点
        const imagePos = this.screenToImage(mousePos.x, mousePos.y);
        
        // 🔧 FIX: 使用统一系统方法创建自定义点标注
        const keypoint = this.addCustomPointAnnotation(imagePos.x, imagePos.y, customType.id);
        
        if (keypoint) {
          console.log('Created unified custom point annotation:', keypoint);
          // 渲染已经在addCustomPointAnnotation中触发
        } else {
          console.warn('Failed to create custom point annotation');
        }
      }
    } catch (error) {
      console.warn('Failed to handle custom annotation mode:', error);
    }
  }

  /**
   * 开始自定义区域拖拽
   */
  startCustomRegionDrag(mousePos) {
    if (!this.canCreateAnnotationAt(mousePos.x, mousePos.y)) {
      console.warn('Cannot create custom region annotation: position is outside valid area');
      return;
    }

    this.state.isCustomRegionDragging = true;
    this.state.customRegionStartPoint = mousePos;
    this.state.customRegionCurrentPoint = mousePos;
    this.canvas.style.cursor = 'crosshair';
    
    console.log('Started custom region drag at:', mousePos);
  }

  /**
   * 更新自定义区域拖拽
   */
  updateCustomRegionDrag(mousePos) {
    if (!this.state.isCustomRegionDragging) return;
    
    this.state.customRegionCurrentPoint = mousePos;
    this.render(); // 重新渲染以显示拖拽预览
  }

  /**
   * 完成自定义区域拖拽
   */
  finishCustomRegionDrag() {
    if (!this.state.isCustomRegionDragging || !this.state.customRegionStartPoint || !this.state.customRegionCurrentPoint) {
      this.resetCustomRegionDrag();
      return;
    }

    const startPos = this.screenToImage(this.state.customRegionStartPoint.x, this.state.customRegionStartPoint.y);
    const endPos = this.screenToImage(this.state.customRegionCurrentPoint.x, this.state.customRegionCurrentPoint.y);

    // 检查拖拽距离是否足够
    const width = Math.abs(endPos.x - startPos.x);
    const height = Math.abs(endPos.y - startPos.y);
    const minSize = 10; // 最小区域尺寸

    if (width < minSize || height < minSize) {
      console.log('Region too small, ignoring');
      this.resetCustomRegionDrag();
      return;
    }

    // 获取当前图像ID
    const appState = window.PlantAnnotationTool?.appState;
    const imageId = appState?.currentImage?.id;

    if (!imageId) {
      console.warn('No current image ID available for custom region annotation');
      this.resetCustomRegionDrag();
      return;
    }

    // 创建区域标注
    try {
      const currentCustomType = this.customAnnotationManager.getCurrentCustomType();
      if (!currentCustomType) {
        console.warn('No custom type selected for region annotation');
        this.resetCustomRegionDrag();
        return;
      }
      
      // 计算区域位置
      const x = Math.min(startPos.x, endPos.x);
      const y = Math.min(startPos.y, endPos.y);
      
      // 🔧 FIX: 使用统一系统方法创建自定义区域标注
      const keypoint = this.addCustomRegionAnnotation(x, y, width, height, currentCustomType.id);
      
      if (keypoint) {
        console.log('Created unified custom region annotation:', keypoint);
        // 渲染已经在addCustomRegionAnnotation中触发
      } else {
        console.warn('Failed to create custom region annotation');
      }
    } catch (error) {
      console.error('Error creating custom region annotation:', error);
    }

    this.resetCustomRegionDrag();
  }

  /**
   * 重置自定义区域拖拽状态
   */
  resetCustomRegionDrag() {
    this.state.isCustomRegionDragging = false;
    this.state.customRegionStartPoint = null;
    this.state.customRegionCurrentPoint = null;
    this.canvas.style.cursor = 'crosshair';
    this.render();
  }

  /**
   * 删除自定义标注（统一版本）
   * @param {Object} customAnnotation - 要删除的自定义标注 keypoint
   */
  removeCustomAnnotation(customAnnotation) {
    // 在统一系统中，自定义标注也是keypoint，直接调用removeKeypoint
    this.removeKeypoint(customAnnotation);
  }

  /**
   * 获取自定义标注管理器
   */
  getCustomAnnotationManager() {
    return this.customAnnotationManager;
  }

  /**
   * 获取自定义标注渲染器
   */
  getCustomAnnotationRenderer() {
    return this.customAnnotationRenderer;
  }

  // 🔧 NEW: Multi-Direction Annotation Methods
  
  /**
   * 处理中键点击 - 进入/退出方向数量选择模式
   */
  handleMiddleMouseButton(mousePos) {
    // 只有在选中了标注点时才允许进入方向数量模式
    if (!this.state.selectedKeypoint) {
      console.log('[多方向] 未选中标注点，忽略中键点击');
      return;
    }

    if (this.state.isDirectionCountMode) {
      // 退出方向数量模式并应用选择的方向数量
      this.exitDirectionCountMode();
    } else {
      // 进入方向数量模式
      this.enterDirectionCountMode();
    }
  }

  /**
   * 进入方向数量选择模式
   */
  enterDirectionCountMode() {
    console.log('[多方向] 进入方向数量选择模式');
    
    this.state.isDirectionCountMode = true;
    this.state.currentDirectionCount = this.state.selectedKeypoint.maxDirections || 1;
    
    // 显示提示信息
    this.showDirectionCountPrompt('使用滚轮调整方向数量，再次按中键确认');
    
    // 改变光标样式
    this.canvas.style.cursor = 'help';
  }

  /**
   * 退出方向数量选择模式
   */
  exitDirectionCountMode() {
    console.log('[多方向] 退出方向数量选择模式，应用方向数量:', this.state.currentDirectionCount);
    
    // 应用选择的方向数量到当前标注点
    if (this.state.selectedKeypoint) {
      // 🔧 BUG FIX: 确保标注点具有多方向支持
      this.ensureMultiDirectionSupport(this.state.selectedKeypoint);
      
      this.state.selectedKeypoint.maxDirections = this.state.currentDirectionCount;
      
      // 如果新的方向数量小于已有方向数量，需要截断
      if (this.state.selectedKeypoint.directions.length > this.state.currentDirectionCount) {
        this.state.selectedKeypoint.directions = this.state.selectedKeypoint.directions.slice(0, this.state.currentDirectionCount);
        console.log('[多方向] 截断directions数组到', this.state.currentDirectionCount, '个');
      }
    }
    
    this.state.isDirectionCountMode = false;
    this.hideDirectionCountPrompt();
    
    // 恢复光标样式
    this.canvas.style.cursor = 'crosshair';
    
    // 开始设置方向
    this.startMultiDirectionSetting();
  }

  /**
   * 处理滚轮调整方向数量
   */
  handleScrollWheel(event) {
    if (!this.state.isDirectionCountMode) {
      return;
    }

    const delta = -event.deltaY;
    const direction = delta > 0 ? 1 : -1;
    
    // 调整方向数量（限制在1-8之间）
    const newCount = Math.max(1, Math.min(8, this.state.currentDirectionCount + direction));
    
    if (newCount !== this.state.currentDirectionCount) {
      this.state.currentDirectionCount = newCount;
      this.updateDirectionCountDisplay();
      console.log('[多方向] 方向数量调整为:', newCount);
    }
  }

  /**
   * 显示方向数量提示
   */
  showDirectionCountPrompt(message) {
    // 创建或更新提示框
    let prompt = document.getElementById('direction-count-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'direction-count-prompt';
      prompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
        font-family: Arial, sans-serif;
      `;
      document.body.appendChild(prompt);
    }
    
    prompt.innerHTML = `
      <div style="margin-bottom: 8px;">${message}</div>
      <div style="font-size: 18px; font-weight: bold; text-align: center;">
        方向数量: ${this.state.currentDirectionCount}
      </div>
    `;
  }

  /**
   * 隐藏方向数量提示
   */
  hideDirectionCountPrompt() {
    const prompt = document.getElementById('direction-count-prompt');
    if (prompt) {
      prompt.remove();
    }
  }

  /**
   * 更新方向数量显示
   */
  updateDirectionCountDisplay() {
    const prompt = document.getElementById('direction-count-prompt');
    if (prompt) {
      prompt.innerHTML = `
        <div style="margin-bottom: 8px;">使用滚轮调整方向数量，再次按中键确认</div>
        <div style="font-size: 18px; font-weight: bold; text-align: center;">
          方向数量: ${this.state.currentDirectionCount}
        </div>
      `;
    }
  }

  /**
   * 开始多方向设置
   */
  startMultiDirectionSetting() {
    if (!this.state.selectedKeypoint) {
      return;
    }

    // 🔧 FIX: Initialize counter based on existing directions
    this.state.directionsSet = this.state.selectedKeypoint.directions.length;
    this.state.isDirectionSelectionMode = true;
    
    // 显示进度提示
    this.showMultiDirectionProgress();
    
    console.log(`[多方向] 开始设置 ${this.state.selectedKeypoint.maxDirections} 个方向 (已有 ${this.state.directionsSet} 个)`);
  }

  /**
   * 显示多方向设置进度
   */
  showMultiDirectionProgress() {
    const keypoint = this.state.selectedKeypoint;
    if (!keypoint) return;
    
    // 🔧 FIX: Use actual directions count for accuracy
    const actualDirections = keypoint.directions.length;
    const progress = `${actualDirections}/${keypoint.maxDirections}`;
    
    let message;
    if (actualDirections >= keypoint.maxDirections) {
      message = `所有方向已设置完成 ${progress}`;
    } else {
      message = `设置方向 ${progress} - 点击设置第 ${actualDirections + 1} 个方向`;
    }
    
    // 更新或创建进度提示
    let progressPrompt = document.getElementById('multi-direction-progress');
    if (!progressPrompt) {
      progressPrompt = document.createElement('div');
      progressPrompt.id = 'multi-direction-progress';
      progressPrompt.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 10000;
        pointer-events: none;
        font-family: Arial, sans-serif;
      `;
      document.body.appendChild(progressPrompt);
    }
    
    progressPrompt.textContent = message;
    
    // 🔧 FIX: Auto-hide progress when all directions are set
    if (actualDirections >= keypoint.maxDirections) {
      setTimeout(() => {
        this.hideMultiDirectionProgress();
      }, 2000); // Hide after 2 seconds
    }
  }

  /**
   * 隐藏多方向设置进度
   */
  hideMultiDirectionProgress() {
    const progressPrompt = document.getElementById('multi-direction-progress');
    if (progressPrompt) {
      progressPrompt.remove();
    }
  }

  /**
   * 添加方向到标注点
   */
  addDirectionToKeypoint(keypoint, direction) {
    // 🔧 BUG FIX: 确保标注点具有多方向支持
    this.ensureMultiDirectionSupport(keypoint);
    
    if (keypoint.directions.length >= keypoint.maxDirections) {
      console.warn('[多方向] 已达到最大方向数量:', keypoint.maxDirections);
      return false;
    }
    
    keypoint.directions.push(direction);
    console.log('[多方向] 添加方向成功:', direction, '到keypoint #' + keypoint.order);
    return true;
  }

  /**
   * 从标注点移除方向
   */
  removeDirectionFromKeypoint(keypoint, index) {
    // 🔧 BUG FIX: 确保标注点具有多方向支持
    this.ensureMultiDirectionSupport(keypoint);
    
    if (index < 0 || index >= keypoint.directions.length) {
      console.warn('[多方向] 无效的方向索引:', index);
      return false;
    }
    
    const removedDirection = keypoint.directions[index];
    keypoint.directions.splice(index, 1);
    console.log('[多方向] 移除方向成功:', removedDirection, '从keypoint #' + keypoint.order);
    return true;
  }

  /**
   * 完成多方向设置
   */
  finishMultiDirectionSetting() {
    console.log('[多方向] 完成多方向设置');
    
    // 清理UI提示
    this.hideMultiDirectionProgress();
    
    // 🔧 FIX: Ensure state consistency before cleanup
    if (this.state.selectedKeypoint) {
      // Sync counter with actual directions
      this.state.directionsSet = this.state.selectedKeypoint.directions.length;
      
      // 🔧 FIX: Verify completion state
      const isComplete = this.state.selectedKeypoint.directions.length >= this.state.selectedKeypoint.maxDirections;
      console.log(`[多方向] 设置状态: ${this.state.selectedKeypoint.directions.length}/${this.state.selectedKeypoint.maxDirections} (${isComplete ? '完成' : '未完成'})`);
    }
    
    // 重置状态
    this.state.isDirectionSelectionMode = false;
    this.state.directionsSet = 0;
    this.state.selectedKeypoint = null;
    
    // 恢复光标样式
    this.canvas.style.cursor = 'crosshair';
    
    // 保存状态
    this.saveState();
    this.autoSaveCurrentImage();
    
    // 同步分支点预览
    this.syncBranchPointPreview();
    
    // 自动切换到预期位置
    this.moveToNextExpectedPosition();
    
    console.log('[多方向] 多方向设置完成');
  }

  /**
   * 中断方向数量模式
   */
  interruptDirectionCountMode(reason) {
    if (this.state.isDirectionCountMode) {
      console.log('[多方向] 方向数量模式被中断:', reason);
      
      this.state.isDirectionCountMode = false;
      this.state.currentDirectionCount = 1;
      this.state.selectedKeypoint = null;
      
      this.hideDirectionCountPrompt();
      this.hideMultiDirectionProgress();
      
      // 恢复光标样式
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * 中断多方向设置模式
   */
  interruptMultiDirectionSetting(reason) {
    if (this.state.isDirectionSelectionMode && this.state.selectedKeypoint && this.state.selectedKeypoint.maxDirections > 1) {
      console.log('[多方向] 多方向设置被中断:', reason);
      
      // 🔧 FIX: Ensure progress display is properly cleaned up
      this.hideMultiDirectionProgress();
      
      // 重置状态
      this.state.isDirectionSelectionMode = false;
      this.state.directionsSet = 0;
      this.state.selectedKeypoint = null;
      
      // 恢复光标样式
      this.canvas.style.cursor = 'crosshair';
      
      // 重新渲染以清除任何视觉提示
      this.render();
    }
  }

  /**
   * 中断所有方向相关模式
   */
  interruptAllDirectionModes(reason) {
    console.log('[多方向] 中断所有方向模式:', reason);
    
    // 中断方向数量模式
    this.interruptDirectionCountMode(reason);
    
    // 中断多方向设置模式
    this.interruptMultiDirectionSetting(reason);
    
    // 中断常规方向选择模式
    if (this.state.isDirectionSelectionMode) {
      this.cancelDirectionSelection(true);
    }
    
    // 中断自动化方向模式
    if (this.state.isAutoDirectionMode) {
      this.exitAutoDirectionMode();
    }
  }

  /**
   * 检查标注点是否可以有多个方向
   */
  canHaveMultipleDirections(keypoint) {
    return keypoint && keypoint.annotationType === 'regular';
  }

  /**
   * 🔧 BUG FIX: 确保标注点具有多方向支持的必要属性
   */
  ensureMultiDirectionSupport(keypoint) {
    if (!keypoint) return;
    
    // 确保directions数组存在
    if (!keypoint.directions) {
      keypoint.directions = [];
      
      // 如果有旧的单方向数据，迁移到新格式
      if (keypoint.direction !== null && keypoint.direction !== undefined) {
        if (typeof keypoint.direction === 'number') {
          keypoint.directions.push({ angle: keypoint.direction, type: 'angle' });
        } else if (keypoint.direction === 'left') {
          keypoint.directions.push({ angle: 180, type: 'angle' });
        } else if (keypoint.direction === 'right') {
          keypoint.directions.push({ angle: 0, type: 'angle' });
        }
        console.log('[多方向] 迁移单方向数据到新格式:', keypoint.direction, '→', keypoint.directions);
      }
    }
    
    // 确保maxDirections属性存在
    if (!keypoint.maxDirections) {
      keypoint.maxDirections = Math.max(1, keypoint.directions.length);
      console.log('[多方向] 初始化maxDirections为', keypoint.maxDirections, 'for keypoint #' + keypoint.order);
    }
    
    // 确保annotationType存在
    if (!keypoint.annotationType) {
      keypoint.annotationType = 'regular';
    }
  }

  /**
   * 渲染多个方向箭头
   */
  renderMultipleDirections(keypoint) {
    // 🔧 BUG FIX: 确保标注点具有多方向支持
    this.ensureMultiDirectionSupport(keypoint);
    
    // 如果没有方向数据，不渲染
    if (keypoint.directions.length === 0) {
      return;
    }

    const screenPos = this.imageToScreen(keypoint.x, keypoint.y);
    
    keypoint.directions.forEach((direction, index) => {
      const angleDegrees = direction.angle;
      const directionText = `${(index + 1)}/${keypoint.directions.length}`;
      
      // 渲染方向箭头，使用不同的颜色或样式来区分
      this.renderDirectionArrow(screenPos.x, screenPos.y, angleDegrees, directionText, keypoint);
    });
  }

  /**
   * 渲染方向箭头（改进版 - 支持多方向显示）
   */
  renderDirectionArrow(x, y, angleDegrees, directionText, keypoint) {
    const angleRadians = angleDegrees * Math.PI / 180;
    const arrowLength = this.options.directionArrowLength;

    // 计算箭头终点
    const endX = x + Math.cos(angleRadians) * arrowLength;
    const endY = y + Math.sin(angleRadians) * arrowLength;

    // 绘制虚线主线
    this.ctx.strokeStyle = '#10b981'; // 绿色
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([8, 4]); // 虚线样式
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // 重置虚线样式
    this.ctx.setLineDash([]);

    // 绘制箭头头部（实线）
    const headAngle1 = angleRadians + Math.PI * 0.8;
    const headAngle2 = angleRadians - Math.PI * 0.8;
    const headLength = 15;

    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX + Math.cos(headAngle1) * headLength, endY + Math.sin(headAngle1) * headLength);
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(endX + Math.cos(headAngle2) * headLength, endY + Math.sin(headAngle2) * headLength);
    this.ctx.stroke();

    // 绘制方向文本（带背景）
    const textOffset = 20;
    const textX = endX + Math.cos(angleRadians) * textOffset;
    const textY = endY + Math.sin(angleRadians) * textOffset;

    // 测量文本尺寸
    this.ctx.font = 'bold 11px Arial';
    const textMetrics = this.ctx.measureText(directionText);
    const textWidth = textMetrics.width;
    const textHeight = 11;

    // 绘制文本背景
    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    this.ctx.fillRect(textX - textWidth/2 - 3, textY - textHeight/2 - 2, textWidth + 6, textHeight + 4);

    // 绘制文本
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(directionText, textX, textY);
  }

  /**
   * 🔧 NEW: Enhanced direction data structure with click coordinates
   */
  enhanceDirectionData(keypoint, clickData) {
    return {
      ...keypoint,
      directionClick: {
        x: clickData.clickX,
        y: clickData.clickY,
        screenX: clickData.screenX,
        screenY: clickData.screenY,
        timestamp: clickData.timestamp
      }
    };
  }

  /**
   * 🔧 NEW: Enhanced multi-direction data structure with click coordinates
   */
  enhanceMultiDirectionData(keypoint, clickDataArray) {
    const enhancedDirections = keypoint.directions.map((direction, index) => {
      const clickData = clickDataArray[index];
      return {
        ...direction,
        clickPosition: clickData ? {
          x: clickData.clickX,
          y: clickData.clickY,
          screenX: clickData.screenX,
          screenY: clickData.screenY,
          timestamp: clickData.timestamp
        } : null
      };
    });

    return {
      ...keypoint,
      directions: enhancedDirections
    };
  }

  /**
   * 🔧 NEW: Handle direction selection click with coordinate recording
   */
  handleDirectionSelectionClick(event) {
    if (!this.state.selectedKeypoint || !this.state.isDirectionSelectionMode) {
      return;
    }

    const screenCoords = this.getEventCoordinates(event);
    const imageCoords = this.screenToImage(screenCoords.x, screenCoords.y);
    
    // Validate click coordinates
    if (!this.validateDirectionClick(this.state.selectedKeypoint, {
      clickX: imageCoords.x,
      clickY: imageCoords.y,
      screenX: screenCoords.x,
      screenY: screenCoords.y
    })) {
      return;
    }

    // Calculate angle from keypoint to click position
    const angle = this.calculateAngleFromClick(this.state.selectedKeypoint, imageCoords);
    
    // Record click data
    const clickData = {
      x: imageCoords.x,
      y: imageCoords.y,
      screenX: screenCoords.x,
      screenY: screenCoords.y,
      timestamp: Date.now()
    };

    // Update keypoint with direction and click data
    this.state.selectedKeypoint.direction = angle;
    this.state.selectedKeypoint.directionType = 'angle';
    this.state.selectedKeypoint.directionClick = clickData;

    // Trigger UI update
    this.render();
    
    // Exit direction selection mode
    this.state.isDirectionSelectionMode = false;
    this.state.selectedKeypoint = null;
  }

  /**
   * 🔧 NEW: Validate direction click coordinates
   */
  validateDirectionClick(keypoint, clickData) {
    // Check if click is within image bounds
    if (!this.isClickWithinImageBounds(clickData)) {
      return false;
    }

    // Check if click is within canvas bounds
    if (!this.isClickWithinCanvasBounds(clickData)) {
      return false;
    }

    return true;
  }

  /**
   * 🔧 NEW: Calculate angle from keypoint to click position
   */
  calculateAngleFromClick(keypoint, clickPosition) {
    const deltaX = clickPosition.x - keypoint.x;
    const deltaY = clickPosition.y - keypoint.y;
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  /**
   * 🔧 NEW: Check if click is within canvas bounds
   */
  isClickWithinCanvasBounds(clickData) {
    return clickData.screenX >= 0 && clickData.screenX <= this.canvas.width &&
           clickData.screenY >= 0 && clickData.screenY <= this.canvas.height;
  }

  /**
   * 🔧 NEW: Check if click is within image bounds
   */
  isClickWithinImageBounds(clickData) {
    if (!this.currentImage) return false;
    
    return clickData.x >= 0 && clickData.x <= this.currentImage.width &&
           clickData.y >= 0 && clickData.y <= this.currentImage.height;
  }

  /**
   * 🔧 NEW: Convert screen coordinates to image coordinates
   */
  screenToImage(screenX, screenY) {
    const imageX = (screenX - this.state.translateX) / this.state.scale;
    const imageY = (screenY - this.state.translateY) / this.state.scale;
    return { x: imageX, y: imageY };
  }

  /**
   * 🔧 NEW: Handle multi-direction click with coordinate recording
   */
  handleMultiDirectionClick(event) {
    if (!this.state.selectedKeypoint || !this.state.selectedKeypoint.maxDirections) {
      return false;
    }

    const keypoint = this.state.selectedKeypoint;
    if (keypoint.directions.length >= keypoint.maxDirections) {
      return false;
    }

    const screenCoords = this.getEventCoordinates(event);
    const imageCoords = this.screenToImage(screenCoords.x, screenCoords.y);
    
    // Calculate angle and add new direction
    const angle = this.calculateAngleFromClick(keypoint, imageCoords);
    
    keypoint.directions.push({
      angle: angle,
      type: 'angle',
      clickPosition: {
        x: imageCoords.x,
        y: imageCoords.y,
        screenX: screenCoords.x,
        screenY: screenCoords.y,
        timestamp: Date.now()
      }
    });

    return true;
  }

  /**
   * 🔧 NEW: Get annotation data with click coordinates
   */
  getAnnotationData() {
    return {
      keypoints: this.keypoints.map(kp => ({
        ...kp,
        directionClick: kp.directionClick || null
      }))
    };
  }

  /**
   * 🔧 NEW: Serialize annotation data with click coordinates
   */
  serializeAnnotationData(keypoints) {
    return JSON.stringify(keypoints.map(kp => ({
      ...kp,
      directionClick: kp.directionClick || null
    })));
  }

  /**
   * 🔧 NEW: Deserialize annotation data with click coordinates
   */
  deserializeAnnotationData(data) {
    const keypoints = JSON.parse(data);
    return keypoints.map(kp => ({
      ...kp,
      directionClick: kp.directionClick || null
    }));
  }

  /**
   * 🔧 NEW: Get event coordinates from mouse/touch event
   */
  getEventCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}