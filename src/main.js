/**
 * 植物图像关键点标注工具 - 主应用入口
 * 
 * 功能：
 * - 应用初始化和加载
 * - File System Access API 支持检测
 * - 基础UI交互绑定
 * - 浏览器兼容性检查
 */

import { FileSystemManager } from './core/FileSystemManager.js';
import { PlantDataManager } from './core/PlantDataManager.js';
import { AnnotationTool } from './core/AnnotationTool.js';
import { BranchPointPreviewManager } from './core/BranchPointPreviewManager.js';
import { NoteManager } from './core/NoteManager.js';
import { NoteUI } from './core/NoteUI.js';
import { AnnotationManager } from './core/AnnotationManager.js';
import { BulkLoadingPerformanceMonitor } from './utils/BulkLoadingPerformanceMonitor.js';
import RealTimeSyncManager from './core/RealTimeSyncManager.js';
import { CustomAnnotationToolbarController } from './core/CustomAnnotationToolbarController.js';
import { CustomAnnotationSettingsController } from './core/CustomAnnotationSettingsController.js';

// 🔧 FIX: Global error handling to prevent uncaught promise errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', event.reason);
  
  // Check if it's the common Chrome extension message channel error
  if (event.reason && typeof event.reason === 'object' && 
      event.reason.message && event.reason.message.includes('message channel closed')) {
    console.warn('Chrome extension message channel error detected - this is usually harmless');
    event.preventDefault(); // Prevent the error from being logged to console
    return;
  }
  
  // Log other unhandled rejections but don't prevent them
  console.error('Unhandled promise rejection details:', {
    reason: event.reason,
    promise: event.promise,
    stack: event.reason?.stack
  });
});

// 🔧 FIX: Global error handler for uncaught exceptions
window.addEventListener('error', (event) => {
  console.error('🚨 Uncaught Error:', event.error);
  
  // Check for async listener errors specifically
  if (event.error && event.error.message && 
      event.error.message.includes('asynchronous response')) {
    console.warn('Async response listener error detected - likely Chrome extension related');
    return;
  }
  
  console.error('Global error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

// DOM元素引用
let app = null;
let loadingScreen = null;
let mainApp = null;
let errorModal = null;

// 管理器实例
let plantDataManager = null;
let annotationTool = null;
let branchPointPreviewManager = null;
let noteManager = null;
let noteUI = null;
let annotationManager = null;
let realTimeSyncManager = null;
let performanceMonitor = null;
let currentDataset = null;
let customAnnotationToolbarController = null;
let customAnnotationSettingsController = null;

// 应用状态
const appState = {
  isInitialized: false,
  hasBackendAccess: false,
  currentDatasetPath: null,
  plants: [],
  currentPlant: null,
  currentImage: null,
  annotations: new Map()
};

/**
 * 初始化自定义标注控制器
 */
function initializeCustomAnnotationControllers() {
  // 防止重复初始化
  if (customAnnotationSettingsController || customAnnotationToolbarController) {
    console.log('Custom annotation controllers already initialized, skipping...');
    return;
  }
  
  if (!annotationTool || !annotationTool.customAnnotationManager) {
    console.warn('CustomAnnotationManager not ready, retrying...');
    setTimeout(() => {
      initializeCustomAnnotationControllers();
    }, 200);
    return;
  }
  
  try {
    // 创建设置控制器 - 传入正确的参数
    customAnnotationSettingsController = new CustomAnnotationSettingsController(annotationTool.customAnnotationManager);
    
    // 创建工具栏控制器，传入正确的参数
    customAnnotationToolbarController = new CustomAnnotationToolbarController(
      annotationTool.customAnnotationManager,
      customAnnotationSettingsController
    );
    
    // 初始化工具栏控制器
    customAnnotationToolbarController.initialize();
    
    // 全局引用
    window.PlantAnnotationTool.customAnnotationToolbarController = customAnnotationToolbarController;
    window.PlantAnnotationTool.customAnnotationSettingsController = customAnnotationSettingsController;
    
    console.log('自定义标注控制器初始化成功');
  } catch (error) {
    console.error('自定义标注控制器初始化失败:', error);
  }
}

// 设置回调函数
window.onCustomAnnotationSystemReady = initializeCustomAnnotationControllers;

/**
 * 应用初始化
 */
async function initializeApp() {
  console.log('初始化植物图像关键点标注工具...');
  
  try {
    // 全屏加载进度管理
    updateFullscreenLoading(10, 'Initializing managers...', 'Setting up core components');
    
    // 获取DOM元素引用
    app = document.getElementById('app');
    loadingScreen = document.getElementById('loading-screen');
    mainApp = document.getElementById('main-app');
    errorModal = document.getElementById('error-modal');
    
    updateFullscreenLoading(20, 'Creating data managers...', 'Initializing plant data manager');
    
    // 初始化管理器
    plantDataManager = new PlantDataManager();

    // 注意：不在这里初始化annotationStorage，等到选择数据集时再初始化
    
    updateFullscreenLoading(30, 'Setting up window objects...', 'Making managers globally available');
    
    // 立即设置window对象，确保其他模块可以访问
    window.PlantAnnotationTool = {
      appState,
      plantDataManager,
      annotationTool: null, // 稍后设置
      showError,
      hideError,
      updateProgressInfo
    };
    
    updateFullscreenLoading(40, 'Initializing annotation tool...', 'Setting up the annotation interface');
    
    // 初始化标注工具
    try {
      console.log('[调试] 在initializeApp开始时初始化AnnotationTool');
      annotationTool = new AnnotationTool('annotation-canvas');
      window.PlantAnnotationTool.annotationTool = annotationTool;
    } catch (error) {
      console.warn('AnnotationTool初始化延迟:', error.message);
      // Canvas可能还没有准备好，稍后再试
    }
    
    updateFullscreenLoading(50, 'Setting up preview manager...', 'Initializing branch point preview functionality');
    
    // 初始化分支点预览管理器
    try {
      branchPointPreviewManager = new BranchPointPreviewManager();
      branchPointPreviewManager.setPlantDataManager(plantDataManager);
      window.PlantAnnotationTool.branchPointPreviewManager = branchPointPreviewManager;
    } catch (error) {
      console.warn('BranchPointPreviewManager初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(52, 'Setting up custom annotation system...', 'Initializing custom annotation controllers');
    
    // 初始化自定义标注系统 - 需要等待异步加载完成
    try {
      // 等待annotation tool的自定义标注系统异步加载完成
      setTimeout(() => {
        initializeCustomAnnotationControllers();
      }, 500); // 给动态导入一些时间来完成
      
      console.log('自定义标注系统初始化已启动');
    } catch (error) {
      console.warn('自定义标注系统初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(55, 'Setting up note system...', 'Initializing note management functionality');
    
    // 初始化笔记系统
    try {
      noteManager = new NoteManager(plantDataManager.fileSystemManager);
      noteUI = new NoteUI(noteManager);
      
      // 启动自动清理
      noteManager.startAutoCleanup();
      
      window.PlantAnnotationTool.noteManager = noteManager;
      window.PlantAnnotationTool.noteUI = noteUI;
      console.log('笔记系统初始化成功');
    } catch (error) {
      console.warn('NoteManager初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(60, 'Setting up annotation manager...', 'Initializing bulk annotation loading system');
    
    // 初始化标注管理器
    try {
      annotationManager = new AnnotationManager(plantDataManager.fileSystemManager);
      
      window.PlantAnnotationTool.annotationManager = annotationManager;
      console.log('标注管理器初始化成功');
    } catch (error) {
      console.warn('AnnotationManager初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(63, 'Setting up real-time sync...', 'Initializing real-time synchronization manager');
    
    // 初始化实时同步管理器
    try {
      realTimeSyncManager = new RealTimeSyncManager(plantDataManager, plantDataManager.annotationStorage);
      
      window.PlantAnnotationTool.realTimeSyncManager = realTimeSyncManager;
      console.log('🔄 实时同步管理器初始化成功');
    } catch (error) {
      console.warn('🔄 RealTimeSyncManager初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(65, 'Setting up performance monitoring...', 'Initializing bulk loading performance tracking');
    
    // 初始化性能监控器
    try {
      performanceMonitor = new BulkLoadingPerformanceMonitor();
      
      window.PlantAnnotationTool.performanceMonitor = performanceMonitor;
      console.log('性能监控器初始化成功');
    } catch (error) {
      console.warn('性能监控器初始化延迟:', error.message);
    }
    
    updateFullscreenLoading(70, 'Checking compatibility...', 'Verifying browser support and backend connection');
    
    // 检查浏览器兼容性
    await checkBrowserCompatibility();
    
    updateFullscreenLoading(70, 'Setting up interface...', 'Binding event listeners and UI components');
    
    // 绑定基础事件监听器
    bindEventListeners();
    
    updateFullscreenLoading(80, 'Finalizing setup...', 'Completing initialization process');
    
    // 模拟加载过程
    await simulateLoading();
    
    // 显示主应用界面
    showMainApp();
    
    // 确保标注工具已初始化（避免重复初始化）
    if (!annotationTool) {
      try {
        console.log('[调试] 在initializeApp中初始化AnnotationTool');
        annotationTool = new AnnotationTool('annotation-canvas');
        window.PlantAnnotationTool.annotationTool = annotationTool;
      } catch (error) {
        console.error('无法初始化AnnotationTool:', error);
      }
    } else {
      console.log('[调试] AnnotationTool已存在，跳过初始化');
    }
    
    updateFullscreenLoading(90, 'Connecting to dataset...', 'Automatically connecting to plant dataset');
    
    // 自动连接数据集
    setTimeout(async () => {
      try {
        await autoConnectDataset();
      } catch (error) {
        console.error('自动连接数据集失败:', error);
        hideFullscreenLoading();
        showError('自动连接数据集失败', error.message);
      }
    }, 500); // 给用户看到最后的加载进度
    
    appState.isInitialized = true;
    console.log('应用初始化完成');
    
  } catch (error) {
    console.error('应用初始化失败:', error);
    hideFullscreenLoading();
    showError('应用初始化失败', error.message);
  }
}

/**
 * 检查浏览器兼容性
 */
async function checkBrowserCompatibility() {
  console.log('检查浏览器兼容性...');
  
  // 检查后端服务连接
  try {
    const isConnected = await plantDataManager.fileSystemManager.checkConnection();
    if (isConnected) {
      await plantDataManager.fileSystemManager.initialize();
      appState.hasBackendAccess = true;
      console.log('✅ 后端服务连接成功');
    } else {
      throw new Error('后端服务不可用');
    }
  } catch (error) {
    appState.hasBackendAccess = false;
    const errorMessage = error.message.includes('fetch') || error.message.includes('ERR_CONNECTION_REFUSED') ?
      '后端服务未启动，请运行 ./start-backend.sh 启动服务器' :
      error.message;
    console.warn('❌ 后端服务连接失败:', errorMessage);
  }
  
  // 检查其他必要的API
  const requiredAPIs = [
    { name: 'Canvas API', check: () => !!document.createElement('canvas').getContext },
    { name: 'IndexedDB', check: () => !!window.indexedDB },
    { name: 'Web Workers', check: () => !!window.Worker },
    { name: 'Intersection Observer', check: () => !!window.IntersectionObserver }
  ];
  
  const unsupportedAPIs = requiredAPIs.filter(api => !api.check());
  
  if (unsupportedAPIs.length > 0) {
    const missingAPIs = unsupportedAPIs.map(api => api.name).join(', ');
    throw new Error(`浏览器不支持以下必要API: ${missingAPIs}`);
  }
  
  console.log('✅ 浏览器兼容性检查通过');
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
  console.log('绑定事件监听器...');
  
  // 选择数据集按钮
  const selectDatasetBtn = document.getElementById('select-dataset-btn');
  if (selectDatasetBtn) {
    selectDatasetBtn.addEventListener('click', handleSelectDataset);
  }
  
  // 错误模态框关闭按钮
  const errorCloseBtn = document.getElementById('error-close-btn');
  if (errorCloseBtn) {
    errorCloseBtn.addEventListener('click', hideError);
  }
  
  // 视图控制按钮
  const resetZoomBtn = document.getElementById('reset-zoom-btn');
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => {
      if (annotationTool) {
        annotationTool.resetView();
      }
    });
  }
  
  const fitScreenBtn = document.getElementById('fit-screen-btn');
  if (fitScreenBtn) {
    fitScreenBtn.addEventListener('click', () => {
      if (annotationTool) {
        annotationTool.fitToScreen();
      }
    });
  }
  
  // 视角选择按钮事件委托
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-view-angle')) {
      const viewAngle = event.target.dataset.viewAngle;
      handleViewAngleSelect(viewAngle);
    }
  });
  
  // 标注控制按钮
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (annotationTool) {
        annotationTool.undo();
      }
    });
  }
  
  const redoBtn = document.getElementById('redo-btn');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      if (annotationTool) {
        annotationTool.redo();
      }
    });
  }
  
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', handleClearAllAnnotations);
  }
  
  // 分支点预览切换按钮
  const togglePreviewBtn = document.getElementById('toggle-preview-btn');
  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', () => {
      if (branchPointPreviewManager) {
        branchPointPreviewManager.toggleVisibility();
      }
    });
  }


  
  // 自动化方向选择按钮
  const autoDirectionBtn = document.getElementById('auto-direction-btn');
  if (autoDirectionBtn) {
    autoDirectionBtn.addEventListener('click', handleAutoDirectionSelection);
  }

  // 锁定倍数控件
  const zoomLockCheckbox = document.getElementById('zoom-lock-checkbox');
  const zoomLockValue = document.getElementById('zoom-lock-value');
  if (zoomLockCheckbox && zoomLockValue) {
    zoomLockCheckbox.addEventListener('change', handleZoomLockChange);
    zoomLockValue.addEventListener('change', handleZoomLockValueChange);
  }

  // 自动切换到预期位置控件
  const autoMoveCheckbox = document.getElementById('auto-move-checkbox');
  if (autoMoveCheckbox) {
    autoMoveCheckbox.addEventListener('change', handleAutoMoveChange);
  }

  // 🔄 实时变更同步控件
  const realTimeChangeCheckbox = document.getElementById('real-time-change-checkbox');
  if (realTimeChangeCheckbox) {
    realTimeChangeCheckbox.addEventListener('change', handleRealTimeChangeChange);
  }

  // 跳过植株模态框事件
  const skipModalClose = document.getElementById('skip-modal-close');
  const skipCancelBtn = document.getElementById('skip-cancel-btn');
  const skipConfirmBtn = document.getElementById('skip-confirm-btn');

  if (skipModalClose) {
    skipModalClose.addEventListener('click', hideSkipPlantModal);
  }

  if (skipCancelBtn) {
    skipCancelBtn.addEventListener('click', hideSkipPlantModal);
  }

  if (skipConfirmBtn) {
    skipConfirmBtn.addEventListener('click', confirmSkipPlant);
  }

  // 模态框背景点击关闭
  const skipModal = document.getElementById('skip-plant-modal');
  if (skipModal) {
    skipModal.addEventListener('click', (e) => {
      if (e.target === skipModal) {
        hideSkipPlantModal();
      }
    });
  }

  // 状态过滤器
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', handleStatusFilterChange);
  }

  // 植株搜索
  const plantSearch = document.getElementById('plant-search');
  if (plantSearch) {
    plantSearch.addEventListener('input', handlePlantSearchInput);
  }
  
  // 标注操作按钮
  const saveAnnotationBtn = document.getElementById('save-annotation-btn');
  if (saveAnnotationBtn) {
    saveAnnotationBtn.addEventListener('click', handleSaveAnnotation);
  }
  
  // 保存标注模态框事件
  const saveAnnotationCancelBtn = document.getElementById('save-annotation-cancel-btn');
  if (saveAnnotationCancelBtn) {
    saveAnnotationCancelBtn.addEventListener('click', hideSaveAnnotationModal);
  }
  
  const saveAnnotationConfirmBtn = document.getElementById('save-annotation-confirm-btn');
  if (saveAnnotationConfirmBtn) {
    saveAnnotationConfirmBtn.addEventListener('click', () => {
      const selectedMode = document.querySelector('input[name="save-mode"]:checked');
      if (selectedMode) {
        const isManualAdjustment = selectedMode.value === 'current-only';
        performSaveAnnotation(isManualAdjustment);
      }
    });
  }
  
  const completePlantBtn = document.getElementById('complete-plant-btn');
  if (completePlantBtn) {
    completePlantBtn.addEventListener('click', handleCompletePlant);
  }
  
  const exportDataBtn = document.getElementById('export-data-btn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', handleExportData);
  }
  
  // 🔧 NEW: Delete Plant Annotations button
  const deletePlantAnnotationsBtn = document.getElementById('delete-plant-annotations-btn');
  if (deletePlantAnnotationsBtn) {
    deletePlantAnnotationsBtn.addEventListener('click', handleDeletePlantAnnotations);
  }
  
  // 🔧 NEW: Delete Plant Annotations modal events
  const deleteModalClose = document.getElementById('delete-modal-close');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
  const deleteConfirmationCheckbox = document.getElementById('delete-confirmation-checkbox');
  
  if (deleteModalClose) {
    deleteModalClose.addEventListener('click', hideDeletePlantAnnotationsModal);
  }
  
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', hideDeletePlantAnnotationsModal);
  }
  
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', confirmDeletePlantAnnotations);
  }
  
  if (deleteConfirmationCheckbox) {
    deleteConfirmationCheckbox.addEventListener('change', handleDeleteConfirmationChange);
  }
  
  // 🔧 NEW: Delete modal background click close
  const deleteModal = document.getElementById('delete-plant-annotations-modal');
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        hideDeletePlantAnnotationsModal();
      }
    });
  }
  
  // 键盘快捷键
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // 防止右键菜单（在标注区域）
  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  // 植物更新事件监听
  document.addEventListener('plantUpdated', handlePlantUpdated);
  
  // 模态框背景点击关闭事件
  const errorModal = document.getElementById('error-modal');
  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) {
        hideError();
      }
    });
  }
  
  const saveAnnotationModal = document.getElementById('save-annotation-modal');
  if (saveAnnotationModal) {
    saveAnnotationModal.addEventListener('click', (e) => {
      if (e.target === saveAnnotationModal) {
        hideSaveAnnotationModal();
      }
    });
  }
  
  // 🔧 NEW: Unskip Plant Modal Events
  const unskipModalClose = document.getElementById('unskip-modal-close');
  const unskipCancelBtn = document.getElementById('unskip-cancel-btn');
  const unskipConfirmBtn = document.getElementById('unskip-confirm-btn');
  
  if (unskipModalClose) {
    unskipModalClose.addEventListener('click', hideUnskipPlantModal);
  }
  
  if (unskipCancelBtn) {
    unskipCancelBtn.addEventListener('click', hideUnskipPlantModal);
  }
  
  if (unskipConfirmBtn) {
    unskipConfirmBtn.addEventListener('click', confirmUnskipPlant);
  }
  
  // 🔧 NEW: Uncomplete Plant Modal Events
  const uncompleteModalClose = document.getElementById('uncomplete-modal-close');
  const uncompleteCancelBtn = document.getElementById('uncomplete-cancel-btn');
  const uncompleteConfirmBtn = document.getElementById('uncomplete-confirm-btn');
  
  if (uncompleteModalClose) {
    uncompleteModalClose.addEventListener('click', hideUncompletePlantModal);
  }
  
  if (uncompleteCancelBtn) {
    uncompleteCancelBtn.addEventListener('click', hideUncompletePlantModal);
  }
  
  if (uncompleteConfirmBtn) {
    uncompleteConfirmBtn.addEventListener('click', confirmUncompletePlant);
  }
  
  // 🔧 NEW: Modal background click close events
  const unskipModal = document.getElementById('unskip-plant-modal');
  if (unskipModal) {
    unskipModal.addEventListener('click', (e) => {
      if (e.target === unskipModal) {
        hideUnskipPlantModal();
      }
    });
  }
  
  const uncompleteModal = document.getElementById('uncomplete-plant-modal');
  if (uncompleteModal) {
    uncompleteModal.addEventListener('click', (e) => {
      if (e.target === uncompleteModal) {
        hideUncompletePlantModal();
      }
    });
  }
  
  console.log('✅ 事件监听器绑定完成');
}

/**
 * 处理数据集选择
 */
async function handleSelectDataset() {
  console.log('开始连接数据集...');
  
  // 确保plantDataManager已初始化
  if (!plantDataManager) {
    console.error('PlantDataManager未初始化');
    showError('系统错误', '数据管理器未正确初始化，请刷新页面重试');
    return;
  }
  
  try {
    // 显示加载状态
    const selectBtn = document.getElementById('select-dataset-btn');
    const originalText = selectBtn.textContent;
    selectBtn.textContent = 'Connecting...';
    selectBtn.disabled = true;
    
    // 检查后端连接
    updateProgressInfo('Connecting to backend...');
    const datasetInfo = await plantDataManager.fileSystemManager.getDatasetInfo();
    
    if (!datasetInfo) {
      throw new Error('无法连接到后端服务，请确保后端服务已启动');
    }

    console.log('连接的数据集:', datasetInfo.datasetPath);

    // 验证目录结构
    await validateDatasetStructure();

    // 使用PlantDataManager加载数据集
    updateProgressInfo('Loading plants...');
    const plants = await plantDataManager.loadDataset();
    
    // 更新应用状态
    appState.currentDatasetPath = datasetInfo.datasetPath;
    appState.plants = plants;
    currentDataset = {
      path: datasetInfo.datasetPath,
      name: 'Brassica napus dataset',
      plantCount: plants.length
    };
    
    // 更新UI
    updateProgressInfo(`Loaded ${plants.length} plants`);
    selectBtn.textContent = 'Reconnect Dataset';
    
    // 显示植物列表
    renderPlantList(plants);
    
    // 初始更新统计显示
    updateProgressStats();
    
    console.log(`成功加载数据集: ${plants.length} 个植物`);
    
  } catch (error) {
    console.error('选择数据集失败:', error);
    
    showError('连接数据集失败', error.message);
  } finally {
    // 恢复按钮状态
    const selectBtn = document.getElementById('select-dataset-btn');
    selectBtn.textContent = appState.currentDatasetPath ? '重新连接数据集' : '连接数据集';
    selectBtn.disabled = false;
  }
}

/**
 * 验证数据集目录结构
 */
async function validateDatasetStructure() {
  console.log('验证数据集结构...');
  
  try {
    // 通过HTTP后端获取植物文件夹列表
    const plantDirectories = await plantDataManager.fileSystemManager.traversePlantDirectories();
    
    if (!plantDirectories || plantDirectories.length === 0) {
      throw new Error('数据集中未找到植物文件夹（以BR开头的文件夹）');
    }
    
    // 验证至少一个植物文件夹的结构
    const firstPlant = plantDirectories[0];
    const imagesByView = await plantDataManager.fileSystemManager.readPlantImages(firstPlant.id);
    
    if (!imagesByView || Object.keys(imagesByView).length === 0) {
      throw new Error(`植物文件夹 ${firstPlant.id} 中未找到有效的视角目录`);
    }
    
    // 检查是否有sv-000视角
    if (!imagesByView['sv-000'] || imagesByView['sv-000'].length === 0) {
      throw new Error(`植物文件夹 ${firstPlant.id} 中未找到 sv-000 视角图像`);
    }
    
    console.log(`✅ 数据集结构验证通过，发现 ${plantDirectories.length} 个植物文件夹`);
    
  } catch (error) {
    console.error('数据集结构验证失败:', error);
    throw error;
  }
}

/**
 * 更新统计进度条显示 - 🔧 ENHANCED: Plant-based progress instead of image-based
 */
function updateProgressStats() {
  if (!plantDataManager) {
    hideProgressStats();
    return;
  }

  const progressStats = plantDataManager.getProgress();

  // 获取DOM元素
  const progressStatsElement = document.getElementById('progress-stats');
  const completedImagesCount = document.getElementById('completed-images-count');
  const totalImagesCount = document.getElementById('total-images-count');
  const completionPercentage = document.getElementById('completion-percentage');
  const completedPlantsCount = document.getElementById('completed-plants-count');
  const totalPlantsCount = document.getElementById('total-plants-count');
  const progressBarFill = document.getElementById('progress-bar-fill');

  if (!progressStatsElement) return;

  // 显示统计区域
  progressStatsElement.style.display = 'block';

  // 🔧 FIX: Change from image count to plant count display
  // Update completed plants count in the main progress display
  if (completedImagesCount) {
    const totalCompleted = progressStats.totalCompleted || (progressStats.completed + progressStats.skipped);
    completedImagesCount.textContent = totalCompleted; // Now shows completed plants instead of images
  }
  
  if (totalImagesCount) {
    totalImagesCount.textContent = progressStats.total; // Now shows total plants instead of images
  }

  // 更新完成百分比（基于植株完成率）
  if (completionPercentage) {
    completionPercentage.textContent = progressStats.completionRate + '%';
  }

  // 更新植株数量详细信息（显示总完成数，包括跳过的）
  if (completedPlantsCount) {
    const totalCompleted = progressStats.totalCompleted || (progressStats.completed + progressStats.skipped);
    const skippedText = progressStats.skipped > 0 ? ` (${progressStats.skipped} skipped)` : '';
    completedPlantsCount.textContent = `${totalCompleted} plants finished ${skippedText}`;
  }

  if (totalPlantsCount) {
    totalPlantsCount.textContent = `Total ${progressStats.total} plants`;
  }

  // 更新进度条（使用植株完成率，包含跳过的植株）
  if (progressBarFill) {
    const percentage = parseFloat(progressStats.completionRate) || 0;
    progressBarFill.style.width = percentage + '%';
    
    // 根据完成度改变进度条颜色
    if (percentage >= 100) {
      progressBarFill.style.background = 'linear-gradient(90deg, #059669 0%, #047857 100%)';
    } else if (percentage >= 75) {
      progressBarFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else if (percentage >= 50) {
      progressBarFill.style.background = 'linear-gradient(90deg, #34d399 0%, #10b981 100%)';
    } else if (percentage >= 25) {
      progressBarFill.style.background = 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)';
    } else {
      progressBarFill.style.background = 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)';
    }
  }

  // 🔧 FIX: Update console log to show plant-based progress
  const totalCompleted = progressStats.totalCompleted || (progressStats.completed + progressStats.skipped);
  console.log(`统计更新: ${totalCompleted}/${progressStats.total} 植株 (${progressStats.completionRate}%)`);
}

/**
 * 隐藏统计进度条
 */
function hideProgressStats() {
  const progressStatsElement = document.getElementById('progress-stats');
  if (progressStatsElement) {
    progressStatsElement.style.display = 'none';
  }
}

/**
 * 渲染植物列表
 */
function renderPlantList(plants) {
  const container = document.getElementById('plant-list-container');
  if (!container) return;
  
  // 清空现有内容
  container.innerHTML = '';
  
  if (plants.length === 0) {
    container.innerHTML = '<div class="no-data">no data</div>';
    return;
  }
  
  // 创建植物列表项
  plants.forEach(plant => {
    const plantItem = createPlantListItem(plant);
    container.appendChild(plantItem);
  });
  
  // 更新统计显示
  updateProgressStats();
  
  // 🔧 OPTIMIZED: Auto-load note badges immediately upon plant list render
  const updateBadgesInstantly = async () => {
    console.log('[Badge Update] Starting automatic badge loading for all plants');
    
    // Wait for note system with more aggressive retry for better UX
    let retryCount = 0;
    const maxRetries = 15; // Increased retries
    const retryDelay = 300; // Reduced delay for faster startup
    
    while (retryCount < maxRetries) {
      if (window.PlantAnnotationTool?.noteManager && window.PlantAnnotationTool?.noteUI) {
        try {
          console.log('[Badge Update] Note system available, starting bulk badge update');
          const startTime = performance.now();
          
          // Try to use pre-cached bulk data first (fastest option)
          let bulkData = window.PlantAnnotationTool.noteManager.bulkNoteData;
          
          if (!bulkData) {
            console.log('[Badge Update] No pre-cached data, fetching bulk notes for instant display...');
            try {
              bulkData = await window.PlantAnnotationTool.noteManager.getAllNotesInBulk();
              console.log('[Badge Update] Bulk data fetched successfully');
            } catch (bulkError) {
              console.warn('[Badge Update] Bulk API failed, using optimized individual requests:', bulkError.message);
              // Fall back to individual badge updates but with optimized approach
              await window.PlantAnnotationTool.noteUI.updateAllPlantNoteBadges();
              const endTime = performance.now();
              console.log(`[Badge Update] Individual badge update completed in ${(endTime - startTime).toFixed(2)}ms`);
              return;
            }
          }
          
          if (bulkData) {
            // Use instant bulk badge update
            await window.PlantAnnotationTool.noteUI.updateAllPlantNoteBadgesFromBulk(bulkData);
            const endTime = performance.now();
            console.log(`[Badge Update] INSTANT bulk badge update completed in ${(endTime - startTime).toFixed(2)}ms`);
            console.log('[Badge Update] ✅ All plant note badges are now visible immediately');
          } else {
            // Ultimate fallback to individual updates
            console.log('[Badge Update] Using fallback individual badge updates');
            await window.PlantAnnotationTool.noteUI.updateAllPlantNoteBadges();
            const endTime = performance.now();
            console.log(`[Badge Update] Fallback badge update completed in ${(endTime - startTime).toFixed(2)}ms`);
          }
          
          return; // Success, exit retry loop
        } catch (error) {
          console.error('[Badge Update] Badge update failed:', error);
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error('[Badge Update] Max retries reached, badge update failed permanently');
            return;
          }
        }
      } else {
        console.log(`[Badge Update] Note system not ready, retry ${retryCount + 1}/${maxRetries}`);
        retryCount++;
      }
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    console.warn('[Badge Update] ❌ Note system initialization timeout, badges will load later');
  };
  
  // Start badge update immediately, but don't block plant list rendering
  setTimeout(updateBadgesInstantly, 100);
  
  console.log(`渲染了 ${plants.length} 个植物列表项`);
}

/**
 * Create plant list item with note indicators
 */
function createPlantListItem(plant) {
  const item = document.createElement('div');
  item.className = 'plant-item';
  item.dataset.plantId = plant.id;
  
  // Status icon
  const statusIcon = getStatusIcon(plant.status);
  
  // Image count info
  const imageCountText = plant.imageCount > 0 ? 
    `${plant.imageCount} images` : 
    (plant.hasImages ? 'loading...' : 'no image');
  
  // View angle info
  const viewAnglesText = plant.viewAngles.length > 0 ? 
    `view: ${plant.viewAngles.join(', ')}` :
    'view: checking...';
    
  // Selected view info
  const selectedViewText = plant.selectedViewAngle ? 
    `Chosen: ${plant.selectedViewAngle}` : '';
  
  // 🔧 NEW: State-based button system for skip/unskip and complete/uncomplete
  const isSkipped = plant.status === 'skipped';
  const isCompleted = plant.status === 'completed';
  
  // 🔧 FIX: Ensure CSS classes reflect current state
  if (isSkipped) {
    item.classList.add('skipped');
  } else {
    item.classList.remove('skipped');
  }

  // Skip reason display
  const skipReasonHtml = isSkipped && plant.skipReason ?
    `<div class="skip-reason">skip reason: ${plant.skipReason}</div>` : '';

  // 🔧 NEW: Dynamic button generation based on plant state
  let stateButtonsHtml = '';
  
  // Only Skip/Unskip button - Complete functionality is handled by main interface
  if (isSkipped) {
    stateButtonsHtml += `<button class="skip-button unskip-variant" onclick="handleUnskipPlant('${plant.id}', event)">Unskip</button>`;
  } else {
    stateButtonsHtml += `<button class="skip-button" onclick="showSkipPlantModal('${plant.id}', event)">Skip</button>`;
  }

  item.innerHTML = `
    <div class="plant-item-content">
      <div class="plant-header">
        <div class="plant-status">${statusIcon}</div>
        <div class="plant-id">${plant.id}</div>
        <div class="right-box">
          <div class="plant-note-badge" id="note-badge-${plant.id}" style="display: none;"></div>
          <div class="state-buttons">${stateButtonsHtml}</div>
        </div>
      </div>
      <div class="plant-info">
        <div class="image-count">${imageCountText}</div>
        <div class="status-text">${getStatusText(plant.status)}</div>
      </div>
      <div class="plant-view-info">
        <div class="view-angles">${viewAnglesText}</div>
        ${selectedViewText ? `<div class="selected-view">${selectedViewText}</div>` : ''}
      </div>
      ${skipReasonHtml}
    </div>
  `;
  
  // Click event
  item.addEventListener('click', () => handlePlantSelect(plant));
  
  // Note: Badge updates are handled by NoteUI.updateAllPlantNoteBadges()
  // No individual loading needed here to avoid race conditions
  
  return item;
}

/**
 * Load and display image note count with refresh detection
 */
async function loadImageNoteCount(plantId, imageId) {
  try {
    // Check if note system is available
    if (!window.PlantAnnotationTool || !window.PlantAnnotationTool.noteManager) {
      console.warn(`[Thumbnail] Note system not available for ${imageId}`);
      return;
    }
    
    const noteManager = window.PlantAnnotationTool.noteManager;
    console.log(`[Thumbnail] Loading note count for ${plantId}/${imageId}`);
    
    // 🔧 FIX: Check if this is a forced refresh (no cache) scenario
    const isDirectRefresh = arguments[2]; // Hidden parameter for direct refresh flag
    let notes;
    
    if (isDirectRefresh) {
      // Force direct API call without cache
      console.log(`[Thumbnail] Using direct API for forced refresh of ${imageId}`);
      try {
        const response = await fetch(`${noteManager.baseUrl}/notes/image/${plantId}/${imageId}`);
        if (response.ok) {
          const result = await response.json();
          notes = result.success ? (result.data || []) : [];
        } else {
          notes = [];
        }
      } catch (directError) {
        console.warn(`[Thumbnail] Direct API failed, falling back to cache for ${imageId}:`, directError);
        notes = await noteManager.getImageNotes(plantId, imageId);
      }
    } else {
      // Normal cached operation
      notes = await noteManager.getImageNotes(plantId, imageId);
    }
    
    const noteCount = notes ? notes.length : 0;
    console.log(`[Thumbnail] Found ${noteCount} notes for ${imageId}`);
    
    const badge = document.getElementById(`image-note-badge-${imageId}`);
    if (badge) {
      console.log(`[Thumbnail] Badge element found for ${imageId}`);
      if (noteCount > 0) {
        badge.innerHTML = `<span class="image-note-count">📝 ${noteCount}</span>`;
        badge.style.display = 'inline-block';
        badge.className = 'image-note-badge';
        console.log(`[Thumbnail] Badge updated with ${noteCount} notes for ${imageId}`);
      } else {
        // 🔧 FIX: Clear badge when no notes exist
        badge.innerHTML = '';
        badge.style.display = 'none';
        console.log(`[Thumbnail] Badge cleared for ${imageId} (no notes)`);
      }
      console.log(`[Thumbnail] Badge updated for ${imageId}: ${noteCount} notes`);
    } else {
      console.error(`[Thumbnail] Badge element NOT FOUND for ${imageId} (ID: image-note-badge-${imageId})`);
    }
  } catch (error) {
    // Silently handle errors - note loading is not critical for UI
    console.error(`[Thumbnail] Note loading failed for image ${imageId}:`, error.message);
    
    // 🔧 FIX: Clear badge on error to prevent stale data
    const badge = document.getElementById(`image-note-badge-${imageId}`);
    if (badge) {
      badge.innerHTML = '';
      badge.style.display = 'none';
      console.log(`[Thumbnail] Badge cleared on error for ${imageId}`);
    }
  }
}

// 🔧 FIX: 将加载图像笔记计数函数暴露到全局，供NoteUI调用
window.loadImageNoteCount = loadImageNoteCount;

/**
 * 获取状态图标
 */
function getStatusIcon(status) {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in-progress':
      return '🔄';
    case 'skipped':
      return '⏭️';
    case 'pending':
    default:
      return '⭕';
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
  switch (status) {
    case 'completed':
      return 'Finished';
    case 'in-progress':
      return 'In progress';
    case 'skipped':
      return 'Skipped';
    case 'pending':
    default:
      return 'Not started';
  }
}

/**
 * 初始化工作区到空状态
 */
function initializeEmptyWorkspace() {
  console.log('初始化空工作区状态');
  
  // 清空应用状态
  appState.currentPlant = null;
  appState.currentImage = null;
  
  // 清空工作区
  clearWorkspaceState();
  
  // 🔧 FIX: Ensure branch point preview is reset in empty workspace state  
  if (branchPointPreviewManager) {
    branchPointPreviewManager.reset();
    console.log('[EmptyWorkspace] Branch point preview reset - entering empty state');
  }
  
  // 隐藏视角选择区域
  const viewAngleSection = document.getElementById('view-angle-section');
  if (viewAngleSection) {
    viewAngleSection.style.display = 'none';
  }
  
  // 🔧 FIX: Clear image note button badge when initializing empty workspace
  if (window.PlantAnnotationTool?.noteUI) {
    window.PlantAnnotationTool.noteUI.updateImageNoteButton(null, null);
    console.log('[EmptyWorkspace] Image note button badge cleared');
  }
  
  // 更新进度信息
  updateProgressInfo('Please connect to dataset and select a plant');
  
  // 🔧 NEW: Update delete button state when workspace is empty
  updateDeletePlantAnnotationsButtonState();
  
  // 🔧 NEW: Update complete plant button state when workspace is empty
  updateCompletePlantButtonState();
}

/**
 * 清空工作区状态
 */
function clearWorkspaceState() {
  console.log('清空工作区状态');
  
  // 清空标注工具 - 使用新的clearImage方法完全清空图像
  if (annotationTool) {
    annotationTool.clearImage(); // 🔧 FIX: 使用clearImage替代resetView，防止显示残留图像
  }
  
  // 🔧 FIX: Reset branch point preview when clearing workspace (no previous image context)
  if (branchPointPreviewManager) {
    branchPointPreviewManager.reset();
    console.log('[Workspace] Branch point preview reset - no previous image context');
  }
  
  // 🔧 FIX: 在清空工作区后再设置 currentImage 为 null（防止自动保存引用错误）
  appState.currentImage = null;
  
  // 隐藏状态显示
  hideAnnotationStatusDisplay();
  
  // 清空缩略图容器
  const thumbnailContainer = document.getElementById('thumbnail-container');
  if (thumbnailContainer) {
    thumbnailContainer.innerHTML = '<div class="no-images">Please choose view</div>';
  }
  
  // 重置视角按钮
  const viewAngleButtons = document.querySelectorAll('.btn-view-angle');
  viewAngleButtons.forEach(button => {
    button.classList.remove('selected');
    button.disabled = true;
  });
  
  // 清空当前植物标题
  const titleElement = document.getElementById('current-plant-title');
  if (titleElement && !appState.currentPlant) {
    titleElement.textContent = 'Plant: Please select';
  }
  
  // 🔧 FIX: Clear image note button badge when no image is selected
  if (window.PlantAnnotationTool?.noteUI) {
    window.PlantAnnotationTool.noteUI.updateImageNoteButton(null, null);
    console.log('[Workspace] Image note button badge cleared');
  }
}

/**
 * 处理植物选择
 */
async function handlePlantSelect(plant) {
  console.log('选择植物:', plant.id);
  
  // 确保plantDataManager已初始化
  if (!plantDataManager) {
    console.error('PlantDataManager未初始化');
    showError('系统错误', '数据管理器未正确初始化，请刷新页面重试');
    return;
  }
  
  try {
    // 🔧 FIX: 在切换植物前先保存当前图像的标注（防止标注丢失）
    if (appState.currentImage && annotationTool) {
      try {
        const currentAnnotations = annotationTool.getAnnotationData();
        if (currentAnnotations.keypoints.length > 0) {
          console.log('植物切换前自动保存当前图像标注:', appState.currentImage.id);
          await plantDataManager.saveImageAnnotations(
            appState.currentImage.id,
            currentAnnotations.keypoints
          );
          console.log('植物切换前标注保存成功');
          
          // 🔧 FIX: 植物切换前保存后立即刷新缩略图状态
          await refreshThumbnailAnnotationStatus(appState.currentImage.id);
          console.log('植物切换前缩略图状态已刷新');
        }
      } catch (error) {
        console.warn('植物切换前自动保存标注失败:', error);
        // 不阻断切换流程，但记录错误
      }
    }
    
    // 清空工作区状态 - 当切换植物时
    clearWorkspaceState();
    
    // 更新当前植物
    appState.currentPlant = plant;
    
    // 更新UI
    updateCurrentPlantTitle(plant);
    updatePlantItemSelection(plant.id);
    
    // 加载植物图像数据（所有视角）
    updateProgressInfo(`Loading ${plant.id} image data...`);
    const imagesByView = await plantDataManager.getPlantImages(plant.id);
    
    console.log(`植物 ${plant.id} 图像数据:`, imagesByView);
    
    // 更新笔记系统当前植物
    if (window.PlantAnnotationTool?.noteUI) {
      window.PlantAnnotationTool.noteUI.setCurrentPlant(plant.id);
    }

    // 预加载笔记（性能优化）
    if (window.PlantAnnotationTool?.noteManager) {
      // 获取植物的所有图像ID进行预加载
      const allImageIds = Object.values(imagesByView).flat().map(img => img.id);
      window.PlantAnnotationTool.noteManager.preloadNotes(plant.id, allImageIds.slice(0, 5)); // 只预加载前5个
    }
    
    // 显示视角选择界面
    await showViewAngleSelection(plant, imagesByView);
    
    updateProgressInfo(`Loaded ${plant.id} - Total ${plant.imageCount} images`);
    
    // 🔧 NEW: Update delete button state when plant is selected
    updateDeletePlantAnnotationsButtonState();
    
    // 🔧 NEW: Update complete plant button state when plant is selected
    updateCompletePlantButtonState();
    
  } catch (error) {
    console.error('选择植物失败:', error);
    showError('加载植物数据失败', error.message);
  }
}

/**
 * 显示视角选择界面
 */
async function showViewAngleSelection(plant, imagesByView) {
  const viewAngleSection = document.getElementById('view-angle-section');
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const viewAngleInfo = document.getElementById('view-angle-info');
  
  if (!viewAngleSection || !thumbnailContainer || !viewAngleInfo) return;
  
  // 显示视角选择区域
  viewAngleSection.style.display = 'block';
  
  // 清空缩略图
  thumbnailContainer.innerHTML = '<div class="no-images">Please choose view</div>';
  
  // 更新视角信息
  const availableViews = Object.keys(imagesByView).filter(view => imagesByView[view].length > 0);
  viewAngleInfo.textContent = `available view: ${availableViews.length}`;
  
  // 更新视角按钮状态
  const viewAngleButtons = document.querySelectorAll('.btn-view-angle');
  viewAngleButtons.forEach(button => {
    const viewAngle = button.dataset.viewAngle;
    const hasImages = imagesByView[viewAngle] && imagesByView[viewAngle].length > 0;
    
    button.disabled = !hasImages;
    button.classList.remove('selected');
    
    // 更新按钮文本，显示图像数量
    const imageCount = hasImages ? imagesByView[viewAngle].length : 0;
    const buttonText = button.textContent.split('(')[0].trim();
    button.textContent = `${buttonText} (${imageCount})`;
    
    if (hasImages) {
      button.title = `${viewAngle}: ${imageCount} images`;
    } else {
      button.title = `${viewAngle}: no image`;
    }
  });
  
  // 如果已经选择了视角，自动选中
  if (plant.selectedViewAngle) {
    const selectedButton = document.querySelector(`[data-view-angle="${plant.selectedViewAngle}"]`);
    if (selectedButton && !selectedButton.disabled) {
      selectedButton.classList.add('selected');
      // 显示该视角的图像
      await renderImageThumbnails(imagesByView[plant.selectedViewAngle] || []);
    }
  }
}

/**
 * 处理视角选择
 */
async function handleViewAngleSelect(viewAngle) {
  console.log('选择视角:', viewAngle);
  
  if (!appState.currentPlant) {
    showError('操作失败', '请先选择植物');
    return;
  }
  
  try {
    // 更新视角按钮状态
    const viewAngleButtons = document.querySelectorAll('.btn-view-angle');
    viewAngleButtons.forEach(button => {
      button.classList.remove('selected');
      if (button.dataset.viewAngle === viewAngle) {
        button.classList.add('selected');
      }
    });
    
    // 设置植物的选中视角
    plantDataManager.setSelectedViewAngle(appState.currentPlant.id, viewAngle);
    appState.currentPlant.selectedViewAngle = viewAngle;
    
    // 获取该视角的图像
    updateProgressInfo(`Loading ${viewAngle} image view...`);
    const images = await plantDataManager.getPlantImages(appState.currentPlant.id, viewAngle);
    
    console.log(`${viewAngle} 视角包含 ${images.length} 张图像`);

    // 显示图像缩略图
    await renderImageThumbnails(images);
    
    // 如果有图像，自动选择第一张（首次加载）
    if (images.length > 0) {
      await handleImageSelect(images[0], false);
    }
    
    updateProgressInfo(`已选择 ${viewAngle} 视角 - ${images.length} 张图像`);
    
  } catch (error) {
    console.error('选择视角失败:', error);
    showError('加载视角数据失败', error.message);
  }
}

/**
 * 更新当前植物标题
 */
function updateCurrentPlantTitle(plant) {
  const titleElement = document.getElementById('current-plant-title');
  if (titleElement) {
    titleElement.textContent = `Plant: ${plant.id}`;
  }
}

/**
 * 更新植物列表项选中状态
 */
function updatePlantItemSelection(selectedPlantId) {
  // 清除所有选中状态
  document.querySelectorAll('.plant-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // 设置新的选中状态
  const selectedItem = document.querySelector(`[data-plant-id="${selectedPlantId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
}

/**
 * 渲染图像缩略图
 */
async function renderImageThumbnails(images) {
  const container = document.getElementById('thumbnail-container');
  if (!container) return;

  // 清空现有内容
  container.innerHTML = '';

  if (images.length === 0) {
    container.innerHTML = '<div class="no-images">该植物暂无图像</div>';
    return;
  }

  // 创建缩略图（异步检查标注状态）
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const thumbnail = await createImageThumbnail(image, i === 0);
    container.appendChild(thumbnail);
  }

  console.log(`渲染了 ${images.length} 个图像缩略图`);
}

/**
 * Create image thumbnail with note indicators
 */
async function createImageThumbnail(image, isFirst = false) {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'image-thumbnail';
  thumbnail.dataset.imageId = image.id;

  if (isFirst) {
    thumbnail.classList.add('selected');
  }

  // Check for annotations
  let hasAnnotations = false;
  let annotationCount = 0;

  try {
    if (plantDataManager) {
      const annotations = await plantDataManager.getImageAnnotations(image.id);
      if (annotations && annotations.length > 0) {
        hasAnnotations = true;
        annotationCount = annotations.length;
        thumbnail.classList.add('has-annotations');
      }
    }
  } catch (error) {
    // Ignore errors, continue rendering
  }

  thumbnail.innerHTML = `
    <div class="thumbnail-image">
      <img src="" alt="${image.name}" data-src="${image.id}" />
      <div class="thumbnail-loading">Loading...</div>
      ${hasAnnotations ? `<div class="annotation-badge">${annotationCount}</div>` : ''}
      <div class="image-note-badge" id="image-note-badge-${image.id}" style="display: none;"></div>
    </div>
    <div class="thumbnail-info">
      <div class="image-time">${image.timeString}</div>
      ${hasAnnotations ? '<div class="annotation-status">✓ Annotated</div>' : ''}
    </div>
  `;

  // Click event (image switching)

/**
 * 刷新缩略图标注状态 - 用于自动保存后的UI同步
 */
async function refreshThumbnailAnnotationStatus(imageId) {
  console.log(`[缩略图刷新] 开始刷新图像: ${imageId}`);
  
  const thumbnail = document.querySelector(`[data-image-id="${imageId}"]`);
  if (!thumbnail) {
    console.warn(`[缩略图刷新] 找不到图像 ${imageId} 的缩略图元素`);
    return;
  }
  
  try {
    console.log(`[缩略图刷新] 正在获取图像 ${imageId} 的标注数据...`);
    const annotations = await plantDataManager.getImageAnnotations(imageId);
    const hasAnnotations = annotations && annotations.length > 0;
    const annotationCount = annotations ? annotations.length : 0;
    
    console.log(`[缩略图刷新] 图像 ${imageId} 标注数据: ${annotationCount} 个标注点`);
    
    // 更新缩略图类
    if (hasAnnotations) {
      thumbnail.classList.add('has-annotations');
      console.log(`[缩略图刷新] 添加了 has-annotations 类`);
    } else {
      thumbnail.classList.remove('has-annotations');
      console.log(`[缩略图刷新] 移除了 has-annotations 类`);
    }
    
    // 更新标注徽章
    let annotationBadge = thumbnail.querySelector('.annotation-badge');
    if (hasAnnotations) {
      if (!annotationBadge) {
        annotationBadge = document.createElement('div');
        annotationBadge.className = 'annotation-badge';
        thumbnail.querySelector('.thumbnail-image').appendChild(annotationBadge);
        console.log(`[缩略图刷新] 创建了新的标注徽章`);
      }
      annotationBadge.textContent = annotationCount;
      console.log(`[缩略图刷新] 更新徽章数量: ${annotationCount}`);
    } else if (annotationBadge) {
      annotationBadge.remove();
      console.log(`[缩略图刷新] 移除了标注徽章`);
    }
    
    // 更新标注状态文本
    let statusElement = thumbnail.querySelector('.annotation-status');
    if (hasAnnotations) {
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'annotation-status';
        statusElement.textContent = '✓ Annotated';
        thumbnail.querySelector('.thumbnail-info').appendChild(statusElement);
        console.log(`[缩略图刷新] 创建了 '✓ Annotated' 状态`);
      }
    } else if (statusElement) {
      statusElement.remove();
      console.log(`[缩略图刷新] 移除了 '✓ Annotated' 状态`);
    }
    
    console.log(`[缩略图刷新] 完成刷新图像 ${imageId}`);
    
  } catch (error) {
    console.error(`[缩略图刷新] 刷新失败:`, error);
  }
}

// 🔧 FIX: 将刷新函数暴露到全局，供AnnotationTool调用
window.refreshThumbnailAnnotationStatus = refreshThumbnailAnnotationStatus;
  thumbnail.addEventListener('click', () => handleImageSelect(image, true));

  // Async load image
  loadThumbnailImage(thumbnail, image);
  
  // Async load note count
  if (appState.currentPlant) {
    loadImageNoteCount(appState.currentPlant.id, image.id);
  }

  return thumbnail;
}

/**
 * 异步加载缩略图图像
 */
async function loadThumbnailImage(thumbnailElement, imageData) {
  try {
    const imgElement = thumbnailElement.querySelector('img');
    const loadingElement = thumbnailElement.querySelector('.thumbnail-loading');
    
    // 检查plantDataManager是否已初始化
    if (!plantDataManager || !plantDataManager.fileSystemManager) {
      console.error('PlantDataManager或FileSystemManager未初始化');
      loadingElement.textContent = '初始化错误';
      loadingElement.style.color = '#dc2626';
      return;
    }
    
    // 创建图像URL
    const imageURL = await plantDataManager.fileSystemManager.createImageURL(imageData);
    
    // 加载图像
    imgElement.onload = () => {
      loadingElement.style.display = 'none';
      imgElement.style.display = 'block';
    };
    
    imgElement.onerror = () => {
      loadingElement.textContent = '加载失败';
      loadingElement.style.color = '#dc2626';
    };
    
    imgElement.src = imageURL;
    
  } catch (error) {
    console.error('加载缩略图失败:', error);
    const loadingElement = thumbnailElement.querySelector('.thumbnail-loading');
    loadingElement.textContent = '加载失败';
    loadingElement.style.color = '#dc2626';
  }
}

/**
 * 处理图像选择
 */
async function handleImageSelect(image, isImageSwitch = true) {
  try {
    console.log('选择图像:', image.name);
    
    // 保存当前图像的标注（如果有的话）
    if (appState.currentImage && annotationTool) {
      try {
        const currentAnnotations = annotationTool.getAnnotationData();
        if (currentAnnotations.keypoints.length > 0) {
          await plantDataManager.saveImageAnnotations(
            appState.currentImage.id,
            currentAnnotations.keypoints
          );
          console.log('自动保存了当前图像的标注');
          
          // 🔧 FIX: 自动保存后立即刷新缩略图状态
          await refreshThumbnailAnnotationStatus(appState.currentImage.id);
          console.log('自动保存后缩略图状态已刷新');
        }
      } catch (error) {
        console.warn('自动保存当前标注失败:', error);
      }
    }
    
    // 检测是否为该植物的首张图像加载
    const isFirstImageForPlant = !appState.currentImage || 
                                (appState.currentPlant && appState.currentImage && 
                                 !appState.currentImage.id.startsWith(appState.currentPlant.id));
    
    // 更新应用状态
    appState.currentImage = image;
    
    // 更新缩略图选中状态
    updateImageThumbnailSelection(image.id);
    
    // 更新笔记系统当前图像
    if (window.PlantAnnotationTool?.noteUI) {
      window.PlantAnnotationTool.noteUI.setCurrentImage(image.id);
    }
    
    // 设置植物的选中图像（重要：这里恢复了原来的逻辑）
    if (appState.currentPlant) {
      plantDataManager.setSelectedImage(appState.currentPlant.id, image);
    }
    
    // 加载图像到标注工具
    if (annotationTool) {
      // 强制刷新Canvas尺寸，确保正确计算
      annotationTool.resizeCanvas();

      // 获取锁定倍数设置和自动切换设置
      const zoomSettings = getZoomLockSettings();
      const autoMoveSettings = getAutoMoveSettings();

      // 决定是否保持视图状态：只有在非首张图像且是图像切换时才保持
      const shouldPreserveView = isImageSwitch && !isFirstImageForPlant;
      console.log(`[调试] isImageSwitch: ${isImageSwitch}, isFirstImageForPlant: ${isFirstImageForPlant}, shouldPreserveView: ${shouldPreserveView}`);
      
      await annotationTool.loadImage(image, shouldPreserveView);

      // 应用锁定倍数设置或确保首张图像适合屏幕
      if (isFirstImageForPlant) {
        // 首张图像始终适合屏幕
        console.log('首张图像：重置视图到适合屏幕');
        setTimeout(() => {
          annotationTool.fitToScreen();
        }, 100); // 短暂延迟确保图像加载完成
      } else if (isImageSwitch && zoomSettings.isLocked) {
        // 图片切换且启用了锁定倍数
        annotationTool.setZoom(zoomSettings.lockValue);
        console.log(`图片切换：应用锁定倍数 ${zoomSettings.lockValue}x`);
      } else if (isImageSwitch) {
        console.log('图片切换：保持当前缩放和视图状态');
      } else {
        console.log('其他情况：重置视图到适合屏幕');
        annotationTool.fitToScreen();
      }
      
      // 加载已有的标注数据
      try {
        console.log(`[标注] 开始加载图像标注: ${image.id}`);
        const existingAnnotations = await plantDataManager.getImageAnnotations(image.id);
        if (existingAnnotations && existingAnnotations.length > 0) {
          annotationTool.loadAnnotationData({ keypoints: existingAnnotations });
          console.log(`[标注] 加载了 ${existingAnnotations.length} 个已有标注点`);
          
          // 🔧 FIX: 同步自定义标注到CustomAnnotationManager内部状态
          if (annotationTool.customAnnotationManager) {
            const customAnnotations = existingAnnotations.filter(ann => ann.annotationType === 'custom');
            if (customAnnotations.length > 0) {
              console.log(`[自定义标注] 发现 ${customAnnotations.length} 个自定义标注，同步到CustomAnnotationManager`);
              annotationTool.customAnnotationManager.syncAnnotationsFromKeypoints(image.id, customAnnotations);
            }
          }

          // 🔧 FIX: 只有在开启自动移动时才移动视角到最高标记点
          if (annotationTool.state.autoMoveToExpectedPosition) {
            setTimeout(() => {
              annotationTool.moveToHighestKeypoint();
              console.log('[自动移动] 移动视角到最高标记点（auto-move已开启）');
            }, 100); // 稍微延迟确保渲染完成
          } else {
            console.log('[自动移动] 跳过移动到最高标记点（auto-move已关闭）');
          }
        } else {
          // 如果没有已有标注，清空标注工具
          annotationTool.clearKeypoints();
          console.log(`[标注] 图像 ${image.id} 无标注数据`);
        }
      } catch (error) {
        console.warn('[标注] 加载标注数据失败:', error);
        annotationTool.clearKeypoints();
      }
    } else {
      console.error('AnnotationTool未初始化');
      showError('标注工具错误', '标注工具未正确初始化，请刷新页面重试');
    }
    
    // 更新分支点预览
    if (branchPointPreviewManager && appState.currentPlant) {
      try {
        const images = await plantDataManager.getPlantImages(
          appState.currentPlant.id, 
          appState.currentPlant.selectedViewAngle
        );
        const imageIndex = images.findIndex(img => img.id === image.id);
        const currentKeypointCount = annotationTool ? annotationTool.keypoints.length : 0;
        
        await branchPointPreviewManager.updateContext(
          appState.currentPlant.id,
          appState.currentPlant.selectedViewAngle,
          imageIndex,
          currentKeypointCount
        );
      } catch (error) {
        console.warn('更新分支点预览失败:', error);
      }
    }
    
    // 更新标注状态显示
    await updateAnnotationStatusDisplay();

    // 自动切换到预期位置（如果开启）
    if (annotationTool) {
      setTimeout(() => {
        annotationTool.moveToExpectedPosition(isImageSwitch);
      }, 100); // 稍微延迟确保渲染完成
    }

    console.log('图像选择完成');
    
  } catch (error) {
    console.error('图像选择失败:', error);
    showError('图像加载失败', error.message);
  }
}

/**
 * 更新缩略图选择状态并滚动到对应位置
 */
function updateImageThumbnailSelection(selectedImageId) {
  // 清除所有选中状态
  document.querySelectorAll('.image-thumbnail').forEach(thumb => {
    thumb.classList.remove('selected');
  });
  
  // 设置新的选中状态
  const selectedThumb = document.querySelector(`[data-image-id="${selectedImageId}"]`);
  if (selectedThumb) {
    selectedThumb.classList.add('selected');
    
    // 滚动到选中的缩略图
    scrollToThumbnail(selectedThumb);
  }
}

/**
 * 滚动到指定的缩略图，使其在视图垂直中央
 */
function scrollToThumbnail(thumbnailElement) {
  const container = document.getElementById('thumbnail-container');
  if (!container || !thumbnailElement) return;
  
  try {
    // 获取容器和缩略图的尺寸信息
    const containerRect = container.getBoundingClientRect();
    const thumbnailRect = thumbnailElement.getBoundingClientRect();
    
    // 计算需要滚动的距离，使缩略图在容器垂直中央
    const containerScrollTop = container.scrollTop;
    const thumbnailOffsetTop = thumbnailElement.offsetTop;
    const containerHeight = containerRect.height;
    const thumbnailHeight = thumbnailRect.height;
    
    // 计算目标滚动位置：缩略图中心对齐到容器中心
    const targetScrollTop = thumbnailOffsetTop - (containerHeight / 2) + (thumbnailHeight / 2);
    
    // 平滑滚动到目标位置
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
    
    console.log(`滚动到缩略图: ${thumbnailElement.dataset.imageId}`);
    
  } catch (error) {
    console.warn('滚动到缩略图失败:', error);
  }
}

/**
 * 更新标注状态显示
 */
async function updateAnnotationStatusDisplay() {
  if (!appState.currentPlant || !appState.currentImage) {
    hideAnnotationStatusDisplay();
    return;
  }

  const statusSection = document.getElementById('annotation-status-section');
  const currentImageIndex = document.getElementById('current-image-index');
  const annotationSource = document.getElementById('annotation-source');
  const timeSeriesStats = document.getElementById('time-series-stats');
  const manualAdjustmentNotice = document.getElementById('manual-adjustment-notice');

  if (!statusSection) return;

  // 显示状态区域
  statusSection.style.display = 'block';

  try {
    // 获取当前视角的所有图像
    const images = await plantDataManager.getPlantImages(
      appState.currentPlant.id, 
      appState.currentPlant.selectedViewAngle
    );
    
    const currentIndex = images.findIndex(img => img.id === appState.currentImage.id);
    
    // 更新当前图像索引
    currentImageIndex.textContent = currentIndex >= 0 ? 
      `${currentIndex + 1} / ${images.length}` : 
      '- / -';

    // 检查当前图像是否有标注
    const savedAnnotations = await plantDataManager.getImageAnnotations(appState.currentImage.id);
    const hasAnnotations = savedAnnotations && savedAnnotations.length > 0;

    // 更新标注来源
    if (hasAnnotations) {
      annotationSource.textContent = 'Document';
    } else {
      annotationSource.textContent = 'No annotation';
    }

    // 计算视角统计
    let annotatedCount = 0;
    for (const image of images) {
      const imageAnnotations = await plantDataManager.getImageAnnotations(image.id);
      if (imageAnnotations && imageAnnotations.length > 0) {
        annotatedCount++;
      }
    }
    
    const coverage = images.length > 0 ? Math.round((annotatedCount / images.length) * 100) : 0;
    timeSeriesStats.textContent = `${annotatedCount}/${images.length} (${coverage}%)`;

    // 隐藏微调模式通知（新方案不需要）
    manualAdjustmentNotice.style.display = 'none';
    
  } catch (error) {
    console.error('更新标注状态显示失败:', error);
    hideAnnotationStatusDisplay();
  }
}

/**
 * 隐藏标注状态显示
 */
function hideAnnotationStatusDisplay() {
  const statusSection = document.getElementById('annotation-status-section');
  const manualAdjustmentNotice = document.getElementById('manual-adjustment-notice');

  if (statusSection) statusSection.style.display = 'none';
  if (manualAdjustmentNotice) manualAdjustmentNotice.style.display = 'none';
}

/**
 * 处理保存标注 - 显示模态框
 */
async function handleSaveAnnotation() {
  if (!annotationTool || !appState.currentPlant) {
    showError('保存失败', '请先选择植物和图像');
    return;
  }
  
  const annotationData = annotationTool.getAnnotationData();
  
  if (annotationData.keypoints.length === 0) {
    showError('保存失败', '请先添加标注点');
    return;
  }
  
  // 显示保存确认模态框
  showSaveAnnotationModal();
}

/**
 * 显示保存标注模态框
 */
function showSaveAnnotationModal() {
  const modal = document.getElementById('save-annotation-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * 隐藏保存标注模态框
 */
function hideSaveAnnotationModal() {
  const modal = document.getElementById('save-annotation-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * 执行实际的保存操作
 */
async function performSaveAnnotation(isManualAdjustment) {
  if (!annotationTool || !appState.currentPlant) {
    showError('保存失败', '请先选择植物和图像');
    return;
  }
  
  try {
    const annotationData = annotationTool.getAnnotationData();
    
    if (annotationData.keypoints.length === 0) {
      showError('保存失败', '请先添加标注点');
      return;
    }
    
    // 获取方向保存模式
    const directionSaveMode = document.querySelector('input[name="direction-save-mode"]:checked');
    const saveDirectionsOnly = directionSaveMode && directionSaveMode.value === 'directions-only';
    
    // 保存标注数据
    const saveResult = await plantDataManager.savePlantAnnotations(
      appState.currentPlant.id, 
      annotationData.keypoints, 
      isManualAdjustment,
      { saveDirectionsOnly } // 传递方向保存选项
    );
    
    updateProgressInfo(saveResult.message || `已保存 ${annotationData.keypoints.length} 个标注点`);
    
    // 更新状态显示
    updateAnnotationStatusDisplay();
    
    // 更新统计显示
    updateProgressStats();
    
    // 更新分支点预览（重新计算标注点数量）
    if (branchPointPreviewManager && appState.currentPlant && appState.currentImage) {
      const images = await plantDataManager.getPlantImages(
        appState.currentPlant.id, 
        appState.currentPlant.selectedViewAngle
      );
      const imageIndex = images.findIndex(img => img.id === appState.currentImage.id);
      const currentAnnotations = await plantDataManager.getImageAnnotations(appState.currentImage.id);
      const currentKeypointCount = currentAnnotations ? currentAnnotations.length : 0;
      
      await branchPointPreviewManager.updateContext(
        appState.currentPlant.id,
        appState.currentPlant.selectedViewAngle,
        imageIndex,
        currentKeypointCount
      );
    }
    
    console.log('标注数据已保存到持久化存储');
    
    // 🔧 FIX: 立即刷新当前图像的缩略图标注状态
    if (appState.currentImage) {
      await refreshThumbnailAnnotationStatus(appState.currentImage.id);
      console.log('缩略图标注状态已刷新');
    }
    
    // 🔧 FIX: 如果是传播保存，刷新所有受影响的缩略图
    if (!isManualAdjustment && saveResult.affectedImages && saveResult.affectedImages.length > 0) {
      console.log(`刷新 ${saveResult.affectedImages.length} 个受影响图像的缩略图状态`);
      for (const imageId of saveResult.affectedImages) {
        await refreshThumbnailAnnotationStatus(imageId);
      }
    }
    
    // 🔧 FIX: 刷新植物笔记徽章（标注可能影响笔记统计）
    if (window.PlantAnnotationTool?.noteUI && appState.currentPlant) {
      await window.PlantAnnotationTool.noteUI.updatePlantNoteBadge(appState.currentPlant.id);
      console.log('植物笔记徽章已刷新');
    }
    
    // 隐藏模态框
    hideSaveAnnotationModal();
    
  } catch (error) {
    console.error('保存标注失败:', error);
    showError('保存失败', `保存标注数据时出错: ${error.message}`);
  }
}

/**
 * 🔧 NEW: 处理完成/撤销完成植物 (统一处理函数)
 */
function handleCompletePlant() {
  if (!appState.currentPlant) {
    showError('操作失败', '请先选择植物');
    return;
  }
  
  const plant = appState.currentPlant;
  
  // 根据当前状态决定操作
  if (plant.status === 'completed') {
    // 如果已完成，则撤销完成
    showUncompletePlantModal(plant.id);
  } else {
    // 如果未完成，则完成植物
    if (plant.status === 'skipped') {
      showError('操作错误', '无法完成已跳过的植株，请先撤销跳过');
      return;
    }
    
    const confirmMessage = `确定要标记植株 "${plant.id}" 为已完成吗？`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      // 标记植物为已完成
      plantDataManager.updatePlantStatus(plant.id, 'completed');
      plant.status = 'completed';
      
      // 重新渲染植株列表项
      const plantItem = document.querySelector(`[data-plant-id="${plant.id}"]`);
      if (plantItem) {
        const newItem = createPlantListItem(plant);
        plantItem.parentNode.replaceChild(newItem, plantItem);
        
        // 🔧 FIX: Update note badge for the re-rendered plant item
        if (window.PlantAnnotationTool?.noteUI) {
          setTimeout(() => {
            window.PlantAnnotationTool.noteUI.updatePlantNoteBadge(plant.id);
          }, 100);
        }
      }
      
      // 更新统计显示
      updateProgressStats();
      
      // 更新按钮状态
      updateCompletePlantButtonState();
      
      showSuccess('完成成功', `植株 ${plant.id} 已标记为完成`);
      
      // 查找下一个未完成的植物
      const nextPlant = plantDataManager.getNextPendingPlant(plant.id);
      
      if (nextPlant) {
        // 询问是否跳转到下一个植物
        const shouldNavigate = confirm(`植株 ${plant.id} 已完成！\n\n是否跳转到下一个未完成的植株 ${nextPlant.id}？`);
        if (shouldNavigate) {
          handlePlantSelect(nextPlant);
          updateProgressInfo(`已完成 ${plant.id}，跳转到 ${nextPlant.id}`);
        }
      } else {
        updateProgressInfo('恭喜！所有植物都已完成标注');
      }
      
    } catch (error) {
      console.error('完成植物失败:', error);
      showError('操作失败', error.message);
    }
  }
}

/**
 * 处理导出数据
 */
async function handleExportData() {
  if (!plantDataManager) {
    showError('导出失败', '请先加载数据集');
    return;
  }
  
  try {
    // 显示导出格式选择
    await showExportOptionsModal();
    
  } catch (error) {
    console.error('导出数据失败:', error);
    showError('导出失败', error.message);
  }
}

/**
 * 显示导出选项模态框
 */
async function showExportOptionsModal() {
  // Create modal HTML
  const modalHTML = `
    <div id="export-modal" class="modal" style="display: flex;">
      <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
        <h3>Export Annotation Data</h3>

        <!-- Statistics Area -->
        <div id="export-stats" style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px;">
          <div style="font-weight: 600; margin-bottom: 10px;">Data Statistics:</div>
          <div id="stats-content">Loading...</div>
        </div>

        <!-- Preview Area -->
        <div style="margin: 20px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
            <h4 style="margin: 0;">Export Data Preview</h4>
            <button id="refresh-preview-btn" class="btn btn-secondary" style="padding: 5px 15px; font-size: 14px;">Refresh Preview</button>
          </div>
          <div id="export-preview" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; max-height: 400px; overflow-y: auto;">
            Generating preview...
          </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button id="export-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button id="export-confirm-btn" class="btn btn-primary">Confirm Export</button>
        </div>
      </div>
    </div>
  `;
  
  // 移除已存在的模态框
  const existingModal = document.getElementById('export-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // 添加到body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 获取统计信息并显示
  await updateExportStats();

  // 生成导出预览
  await generateExportPreview();

  // 绑定事件
  document.getElementById('export-cancel-btn').addEventListener('click', () => {
    document.getElementById('export-modal').remove();
  });

  document.getElementById('export-confirm-btn').addEventListener('click', async () => {
    document.getElementById('export-modal').remove();
    await performExport();
  });

  document.getElementById('refresh-preview-btn').addEventListener('click', async () => {
    await generateExportPreview();
  });
}

/**
 * 更新导出统计信息
 */
async function updateExportStats() {
  const statsContent = document.getElementById('stats-content');
  if (!statsContent) return;

  try {
    // 直接从文件系统获取标注数据统计
    const exportData = await getDirectExportData();
    const stats = calculateExportStats(exportData);

    const html = `
      <div>📊 Annotated Images: <strong>${stats.annotatedImages}</strong></div>
      <div>🎯 Total Keypoints: <strong>${stats.totalKeypoints}</strong></div>
      <div>📈 Average per Image: <strong>${stats.averageKeypointsPerImage}</strong> keypoints</div>
      <div style="margin-top: 10px; color: #059669;">✅ Pure annotation data, ready for data analysis</div>
      <div style="color: #059669;">✅ Includes all annotated images and skipped plant information</div>
    `;

    statsContent.innerHTML = html;
  } catch (error) {
    console.error('Failed to get export statistics:', error);
    statsContent.innerHTML = '<div style="color: #dc2626;">Failed to load statistics, please check console</div>';
  }
}

/**
 * 执行导出
 */
async function performExport() {
  try {
    // 获取纯净的标注数据
    const exportData = await getDirectExportData();
    const stats = calculateExportStats(exportData);

    if (stats.annotatedImages === 0) {
      showError('Export Failed', 'No annotation data available for export');
      return;
    }

    // 创建导出数据结构
    const finalExportData = {
      exportTime: new Date().toISOString(),
      version: '3.0',
      format: 'pure_annotations',
      description: 'Pure annotation data, including image annotations and skipped plant information',
      stats: {
        annotatedImages: stats.annotatedImages,
        totalKeypoints: stats.totalKeypoints,
        averageKeypointsPerImage: stats.averageKeypointsPerImage,
        skippedPlants: stats.skippedPlants
      },
      annotations: exportData.annotations,
      skippedPlants: exportData.skippedPlants
    };

    // 下载文件
    const blob = new Blob([JSON.stringify(finalExportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    const message = `Exported annotation data for ${stats.annotatedImages} images with ${stats.totalKeypoints} keypoints`;
    updateProgressInfo(message);
    console.log('Annotation data exported', finalExportData);

  } catch (error) {
    console.error('Failed to export data:', error);
    showError('Export Failed', error.message);
  }
}

/**
 * 直接从文件系统获取导出数据
 */
async function getDirectExportData() {
  const exportData = {
    annotations: {},
    skippedPlants: {}
  };

  if (!plantDataManager || !plantDataManager.annotationStorage) {
    throw new Error('数据管理器未初始化');
  }

  const annotationStorage = plantDataManager.annotationStorage;

  // 获取所有标注文件
  if (annotationStorage.useFileSystem && annotationStorage.fileSystemManager) {
    const annotationsHandle = annotationStorage.fileSystemManager.getAnnotationsDirectory();
    if (!annotationsHandle) {
      throw new Error('无法访问标注目录');
    }

    // 扫描所有文件
    for await (const [name, handle] of annotationsHandle.entries()) {
      if (handle.kind === 'file' && name.endsWith('.json')) {
        try {
          const file = await handle.getFile();
          const content = await file.text();
          const data = JSON.parse(content);

          if (name.endsWith('_skip_info.json')) {
            // 跳过信息文件
            const plantId = name.replace('_skip_info.json', '');
            exportData.skippedPlants[plantId] = {
              plantId: data.plantId,
              skipReason: data.skipReason,
              skipDate: data.skipDate,
              status: data.status
            };
          } else {
            // 标注文件
            const imageId = name.replace('.json', '');
            if (data.annotations && data.annotations.length > 0) {
              // 如果没有plantId，尝试从imageId推断
              const plantId = data.plantId || inferPlantIdFromImageId(imageId);

              exportData.annotations[imageId] = {
                imageId: data.imageId || imageId,
                plantId: plantId,
                annotations: data.annotations,
                timestamp: data.timestamp,
                version: data.version
              };
            }
          }
        } catch (error) {
          console.warn(`读取文件失败 (${name}):`, error);
        }
      }
    }
  } else {
    // 从内存中获取数据（兼容模式）
    for (const [plantId, annotationData] of annotationStorage.annotations) {
      if (annotationData.status === 'skipped') {
        exportData.skippedPlants[plantId] = {
          plantId,
          skipReason: annotationData.skipReason,
          skipDate: annotationData.skipDate,
          status: annotationData.status
        };
      }
    }

    // 获取图像标注数据
    for (const [imageId, annotationData] of annotationStorage.imageAnnotations) {
      if (annotationData.annotations && annotationData.annotations.length > 0) {
        exportData.annotations[imageId] = {
          imageId,
          plantId: annotationData.plantId,
          annotations: annotationData.annotations,
          timestamp: annotationData.timestamp,
          version: annotationData.version
        };
      }
    }
  }

  return exportData;
}

/**
 * 计算导出数据统计
 */
function calculateExportStats(exportData) {
  const annotatedImages = Object.keys(exportData.annotations).length;
  const skippedPlants = Object.keys(exportData.skippedPlants).length;

  let totalKeypoints = 0;
  for (const imageData of Object.values(exportData.annotations)) {
    totalKeypoints += imageData.annotations.length;
  }

  const averageKeypointsPerImage = annotatedImages > 0 ?
    (totalKeypoints / annotatedImages).toFixed(1) : '0';

  return {
    annotatedImages,
    totalKeypoints,
    averageKeypointsPerImage,
    skippedPlants
  };
}

/**
 * 处理植物更新事件
 */
function handlePlantUpdated(event) {
  const { plant } = event.detail;
  
  // 更新列表中的植物项
  const plantItem = document.querySelector(`[data-plant-id="${plant.id}"]`);
  if (plantItem) {
    // 更新状态图标
    const statusElement = plantItem.querySelector('.plant-status');
    if (statusElement) {
      statusElement.textContent = getStatusIcon(plant.status);
    }
    
    // 更新状态文本
    const statusTextElement = plantItem.querySelector('.status-text');
    if (statusTextElement) {
      statusTextElement.textContent = getStatusText(plant.status);
    }
    
    // 更新图像数量
    const imageCountElement = plantItem.querySelector('.image-count');
    if (imageCountElement && plant.imageCount > 0) {
      imageCountElement.textContent = `${plant.imageCount} images`;
    }
    
    // 更新视角信息
    const viewAnglesElement = plantItem.querySelector('.view-angles');
    if (viewAnglesElement) {
      const viewAnglesText = plant.viewAngles.length > 0 ? 
        `view: ${plant.viewAngles.join(', ')}` :
        'view: detecting...';
      viewAnglesElement.textContent = viewAnglesText;
    }
    
    // 更新选中视角信息
    const plantViewInfo = plantItem.querySelector('.plant-view-info');
    if (plantViewInfo) {
      let selectedViewElement = plantViewInfo.querySelector('.selected-view');
      if (plant.selectedViewAngle) {
        if (!selectedViewElement) {
          selectedViewElement = document.createElement('div');
          selectedViewElement.className = 'selected-view';
          plantViewInfo.appendChild(selectedViewElement);
        }
        selectedViewElement.textContent = `Choosed: ${plant.selectedViewAngle}`;
      } else if (selectedViewElement) {
        selectedViewElement.remove();
      }
    }
  }
  
  // 更新统计显示
  updateProgressStats();
  
  // 更新旧的进度信息
  const progress = plantDataManager.getProgress();
  updateProgressInfo(`Progress: ${progress.completed}/${progress.total} (${progress.completionRate}%)`);
}

/**
 * 键盘快捷键处理
 */
function handleKeyboardShortcuts(event) {
  // 全局快捷键
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'o':
        event.preventDefault();
        handleSelectDataset();
        break;
      case 's':
        event.preventDefault();
        handleSaveAnnotation();
        break;
    }
  }
  
  // 应用快捷键（仅在主应用显示时）
  if (mainApp && mainApp.style.display !== 'none') {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        handleCompletePlant();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        navigateToPreviousImage();
        break;
      case 'ArrowRight':
        event.preventDefault();
        navigateToNextImage();
        break;
    }
  }
}

/**
 * 模拟加载过程
 */
async function simulateLoading() {
  const loadingTexts = [
    '正在初始化标注工具...',
    '检查浏览器兼容性...',
    '加载组件模块...',
    '准备用户界面...'
  ];
  
  const loadingP = loadingScreen.querySelector('p');
  
  for (const text of loadingTexts) {
    loadingP.textContent = text;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * 显示主应用界面
 */
function showMainApp() {
  loadingScreen.style.display = 'none';
  mainApp.style.display = 'flex';
  
  // 确保界面完全渲染后再检查和初始化AnnotationTool
  setTimeout(() => {
    if (!annotationTool) {
      try {
        console.log('[调试] 在showMainApp中延迟初始化AnnotationTool');
        annotationTool = new AnnotationTool('annotation-canvas');
        window.PlantAnnotationTool.annotationTool = annotationTool;
        console.log('AnnotationTool延迟初始化完成');
      } catch (error) {
        console.error('延迟初始化AnnotationTool失败:', error);
      }
    } else {
      console.log('[调试] AnnotationTool已存在，跳过延迟初始化，调整Canvas尺寸');
      // 如果已经初始化，强制重新调整Canvas尺寸
      annotationTool.resizeCanvas();
    }
    
    // 确保分支点预览管理器已初始化
    if (!branchPointPreviewManager) {
      try {
        branchPointPreviewManager = new BranchPointPreviewManager();
        branchPointPreviewManager.setPlantDataManager(plantDataManager);
        window.PlantAnnotationTool.branchPointPreviewManager = branchPointPreviewManager;
        console.log('BranchPointPreviewManager延迟初始化完成');
      } catch (error) {
        console.error('延迟初始化BranchPointPreviewManager失败:', error);
      }
    }
  }, 300);
}

/**
 * 更新进度信息
 */
function updateProgressInfo(text) {
  const progressText = document.getElementById('progress-text');
  if (progressText) {
    progressText.textContent = text;
  }
}

/**
 * 显示错误信息
 */
function showError(title, message) {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage && errorModal) {
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
  }
  console.error(`${title}: ${message}`);
}

/**
 * 隐藏错误信息
 */
function hideError() {
  if (errorModal) {
    errorModal.style.display = 'none';
  }
}

/**
 * 显示成功信息
 */
function showSuccess(title, message) {
  // 使用updateProgressInfo显示成功消息
  updateProgressInfo(`✅ ${title}: ${message}`);
  console.log(`${title}: ${message}`);
}

/**
 * 应用入口点
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，开始初始化应用...');
  initializeApp();
});

// 开发环境调试
if (import.meta.env?.DEV) {
  window.DEBUG_APP_STATE = appState;
  window.DEBUG_PLANT_MANAGER = () => window.PlantAnnotationTool?.plantDataManager;
  window.DEBUG_ANNOTATION_TOOL = () => window.PlantAnnotationTool?.annotationTool;
  
  // 添加时间序列导出调试功能
  window.DEBUG_TIME_SERIES_EXPORT = async () => {
    const plantManager = window.PlantAnnotationTool?.plantDataManager;
    if (plantManager) {
      return await plantManager.debugTimeSeriesExport();
    } else {
      console.error('PlantDataManager未初始化');
      return null;
    }
  };
  
  // 添加立即导出纯净数据的调试功能
  window.DEBUG_EXPORT_PURE = async () => {
    const plantManager = window.PlantAnnotationTool?.plantDataManager;
    if (plantManager) {
      const pureData = await plantManager.exportPureImageAnnotations();
      console.log('调试：纯净导出数据', pureData);
      return pureData;
    } else {
      console.error('PlantDataManager未初始化');
      return null;
    }
  };
  
  // 临时修复脚本：为传统标注数据添加序号字段
  window.fixLegacyDataOrder = async function() {
    console.log('=== 开始修复传统数据的序号字段 ===');
    
    try {
      // 获取植物数据管理器和存储管理器
      const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
      if (!plantDataManager) {
        throw new Error('植物数据管理器未初始化，请先加载数据集');
      }
      
      const annotationStorage = plantDataManager.annotationStorage;
      if (!annotationStorage) {
        throw new Error('标注存储管理器未找到');
      }
      
      console.log('正在扫描图像标注数据...');
      
      let processedImages = 0;
      let fixedAnnotations = 0;
      let totalAnnotations = 0;
      
      // 处理imageAnnotations中的数据
      for (const [imageId, annotationData] of annotationStorage.imageAnnotations) {
        if (annotationData.annotations && annotationData.annotations.length > 0) {
          processedImages++;
          
          let hasOrderIssues = false;
          const annotations = annotationData.annotations;
          totalAnnotations += annotations.length;
          
          // 检查是否有标注点没有序号
          for (let i = 0; i < annotations.length; i++) {
            if (typeof annotations[i].order !== 'number' || annotations[i].order <= 0) {
              hasOrderIssues = true;
              break;
            }
          }
          
          // 检查序号是否重复或不连续
          if (!hasOrderIssues) {
            const orders = annotations.map(kp => kp.order).sort((a, b) => a - b);
            for (let i = 0; i < orders.length; i++) {
              if (orders[i] !== i + 1) {
                hasOrderIssues = true;
                break;
              }
            }
          }
          
          // 如果有问题，修复序号
          if (hasOrderIssues) {
            console.log(`修复图像 ${imageId} 的 ${annotations.length} 个标注点的序号...`);
            
            // 按照原有顺序分配序号（保持传统数据的顺序不变）
            for (let i = 0; i < annotations.length; i++) {
              annotations[i].order = i + 1;
            }
            
            fixedAnnotations += annotations.length;
            
            // 重新保存到存储
            await annotationStorage.saveImageAnnotation(imageId, annotationData);
            
            console.log(`✓ 已修复图像 ${imageId}：分配序号 1-${annotations.length}`);
          }
        }
      }
      
      // 处理植物标注数据中的annotations字段
      console.log('正在扫描植物标注数据...');
      
      let processedPlants = 0;
      let fixedPlantAnnotations = 0;
      
      for (const [plantId, plantData] of annotationStorage.annotations) {
        if (plantData.annotations && plantData.annotations.length > 0) {
          processedPlants++;
          
          let hasOrderIssues = false;
          const annotations = plantData.annotations;
          
          // 检查是否有标注点没有序号
          for (let i = 0; i < annotations.length; i++) {
            if (typeof annotations[i].order !== 'number' || annotations[i].order <= 0) {
              hasOrderIssues = true;
              break;
            }
          }
          
          // 检查序号是否重复或不连续
          if (!hasOrderIssues) {
            const orders = annotations.map(kp => kp.order).sort((a, b) => a - b);
            for (let i = 0; i < orders.length; i++) {
              if (orders[i] !== i + 1) {
                hasOrderIssues = true;
                break;
              }
            }
          }
          
          // 如果有问题，修复序号
          if (hasOrderIssues) {
            console.log(`修复植物 ${plantId} 的 ${annotations.length} 个标注点的序号...`);
            
            // 按照原有顺序分配序号
            for (let i = 0; i < annotations.length; i++) {
              annotations[i].order = i + 1;
            }
            
            fixedPlantAnnotations += annotations.length;
            
            console.log(`✓ 已修复植物 ${plantId}：分配序号 1-${annotations.length}`);
          }
        }
      }
      
      // 保存所有修改到服务器
      if (fixedAnnotations > 0 || fixedPlantAnnotations > 0) {
        console.log('正在保存修复的数据到服务器...');
        await annotationStorage.saveAnnotationsToServer();
        console.log('✓ 所有修复的数据已保存');
      }
      
      // 输出修复结果
      console.log('=== 修复完成 ===');
      console.log(`扫描了 ${processedImages} 张图像的标注数据`);
      console.log(`扫描了 ${processedPlants} 个植物的标注数据`);
      console.log(`总计 ${totalAnnotations} 个标注点`);
      console.log(`修复了 ${fixedAnnotations} 个图像标注点的序号`);
      console.log(`修复了 ${fixedPlantAnnotations} 个植物标注点的序号`);
      
      if (fixedAnnotations === 0 && fixedPlantAnnotations === 0) {
        console.log('✅ 所有数据的序号都是正确的，无需修复');
      } else {
        console.log(`✅ 已成功修复 ${fixedAnnotations + fixedPlantAnnotations} 个标注点的序号`);
      }
      
      // 建议用户重新加载页面以确保数据生效
      if (fixedAnnotations > 0 || fixedPlantAnnotations > 0) {
        console.log('💡 建议重新加载页面以确保修复的数据完全生效');
      }
      
      return {
        success: true,
        processedImages,
        processedPlants,
        totalAnnotations,
        fixedAnnotations,
        fixedPlantAnnotations,
        totalFixed: fixedAnnotations + fixedPlantAnnotations
      };
      
    } catch (error) {
      console.error('修复传统数据失败:', error);
      console.log('❌ 修复过程中发生错误，请检查控制台输出');
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // 调试标注文件读取
  window.DEBUG_ANNOTATION_FILE = async (imageId) => {
    if (plantDataManager && plantDataManager.fileSystemManager) {
      try {
        console.log(`[调试] 尝试读取标注文件: ${imageId}`);
        const data = await plantDataManager.fileSystemManager.loadAnnotationFile(imageId);
        console.log(`[调试] 标注文件内容:`, data);
        return data;
      } catch (error) {
        console.error(`[调试] 读取失败:`, error);
        return null;
      }
    }
    return null;
  };

  // 调试：查找有标注数据的文件
  window.DEBUG_FIND_ANNOTATED_FILES = async (maxCheck = 10) => {
    if (plantDataManager && plantDataManager.fileSystemManager) {
      try {
        const allFiles = await plantDataManager.fileSystemManager.getAllAnnotationFiles();
        console.log(`[调试] 总共 ${allFiles.length} 个标注文件，检查前 ${maxCheck} 个...`);

        const annotatedFiles = [];
        for (let i = 0; i < Math.min(maxCheck, allFiles.length); i++) {
          const imageId = allFiles[i];
          const data = await plantDataManager.fileSystemManager.loadAnnotationFile(imageId);
          if (data && data.annotations && data.annotations.length > 0) {
            annotatedFiles.push({
              imageId,
              annotationCount: data.annotations.length,
              data
            });
            console.log(`[调试] 找到有标注的文件: ${imageId} (${data.annotations.length} 个标注点)`);
          }
        }

        console.log(`[调试] 检查完成，找到 ${annotatedFiles.length} 个有标注数据的文件`);
        return annotatedFiles;
      } catch (error) {
        console.error(`[调试] 查找失败:`, error);
        return [];
      }
    }
    return [];
  };

  console.log('开发模式：调试对象已绑定到window');
  console.log('可用调试方法:');
  console.log('- DEBUG_TIME_SERIES_EXPORT() - 检查时间序列导出状态');
  console.log('- DEBUG_EXPORT_PURE() - 检查纯净导出数据');
  console.log('- DEBUG_ANNOTATION_FILE(imageId) - 调试标注文件读取');
  console.log('- DEBUG_FIND_ANNOTATED_FILES(maxCheck) - 查找有标注数据的文件');
  console.log('- fixLegacyDataOrder() - 修复传统数据的序号字段');
  console.log('- MIGRATE_PLANT_STATUS() - 🔧 NEW: 迁移植物完成状态数据');
  
  // 🔧 NEW: Migration script for plant completion status
  window.MIGRATE_PLANT_STATUS = async function() {
    console.log('=== 开始迁移植物完成状态数据 ===');
    
    try {
      const plantDataManager = window.PlantAnnotationTool?.plantDataManager;
      if (!plantDataManager) {
        throw new Error('PlantDataManager未初始化，请先加载数据集');
      }
      
      console.log('正在扫描所有植物状态...');
      
      const plants = plantDataManager.getPlantList();
      let migratedCount = 0;
      let alreadyCorrectCount = 0;
      
      for (const plant of plants) {
        const plantId = plant.id;
        console.log(`检查植物 ${plantId}，当前状态: ${plant.status}`);
        
        // Skip already skipped plants
        if (plant.status === 'skipped') {
          console.log(`${plantId}: 保持跳过状态`);
          alreadyCorrectCount++;
          continue;
        }
        
        // Check if plant has annotations
        let hasAnnotations = false;
        try {
          const annotations = plantDataManager.getPlantAnnotations(plantId);
          hasAnnotations = annotations && annotations.length > 0;
        } catch (error) {
          console.warn(`无法检查 ${plantId} 的标注:`, error);
        }
        
        let newStatus;
        if (hasAnnotations && plant.status === 'completed') {
          // 🔧 MIGRATION LOGIC: Plants with annotations that were auto-marked as completed
          // should be set to 'completed' to maintain existing user expectations
          newStatus = 'completed';
          console.log(`${plantId}: 有标注且已标记完成 → 保持 completed 状态 (迁移兼容)`);
          alreadyCorrectCount++;
        } else if (hasAnnotations && plant.status !== 'completed') {
          // Plants with annotations but not explicitly completed should be in-progress
          newStatus = 'in-progress';
          plantDataManager.updatePlantStatus(plantId, newStatus);
          console.log(`${plantId}: 有标注但未明确完成 → 设置为 in-progress`);
          migratedCount++;
        } else if (!hasAnnotations) {
          // Plants without annotations should be pending
          newStatus = 'pending';
          if (plant.status !== 'pending') {
            plantDataManager.updatePlantStatus(plantId, newStatus);
            console.log(`${plantId}: 无标注 → 设置为 pending`);
            migratedCount++;
          } else {
            alreadyCorrectCount++;
          }
        } else {
          alreadyCorrectCount++;
        }
      }
      
      console.log('=== 迁移完成 ===');
      console.log(`总计扫描 ${plants.length} 个植物`);
      console.log(`迁移了 ${migratedCount} 个植物的状态`);
      console.log(`${alreadyCorrectCount} 个植物状态已正确`);
      
      // Refresh UI to show updated status
      if (renderPlantList && typeof renderPlantList === 'function') {
        renderPlantList(plants);
        console.log('UI已刷新以显示新状态');
      }
      
      if (updateProgressStats && typeof updateProgressStats === 'function') {
        updateProgressStats();
        console.log('进度统计已更新');
      }
      
      console.log('💡 现在，只有点击 "Complete Plant" 按钮的植物才会标记为 completed');
      console.log('💡 有标注但未点击完成按钮的植物显示为 in-progress');
      
      return {
        success: true,
        totalPlants: plants.length,
        migratedCount,
        alreadyCorrectCount
      };
      
    } catch (error) {
      console.error('迁移植物状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * 生成导出数据预览
 */
async function generateExportPreview() {
  const previewContainer = document.getElementById('export-preview');
  if (!previewContainer) return;

  try {
    previewContainer.innerHTML = '正在生成预览...';

    // 获取导出数据
    const exportData = await getDirectExportData();

    if (Object.keys(exportData.annotations).length === 0 && Object.keys(exportData.skippedPlants).length === 0) {
      previewContainer.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">No annotation data available</div>';
      return;
    }

    // 生成预览HTML
    const previewHTML = generateSimplePreviewHTML(exportData);
    previewContainer.innerHTML = previewHTML;

    // 绑定展开/折叠事件
    bindPreviewEvents();

  } catch (error) {
    console.error('Failed to generate export preview:', error);
    previewContainer.innerHTML = '<div style="color: #dc2626;">Failed to generate preview, please check console</div>';
  }
}

/**
 * 从图像ID推断植株ID
 */
function inferPlantIdFromImageId(imageId) {
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
 * 生成简化的预览HTML
 */
function generateSimplePreviewHTML(exportData) {
  let html = '';

  // Display annotation data
  const annotationCount = Object.keys(exportData.annotations).length;
  if (annotationCount > 0) {
    html += `
      <div style="margin-bottom: 20px;">
        <div style="font-weight: 600; margin-bottom: 10px; color: #374151;">
          📊 Annotation Data (${annotationCount} images)
        </div>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px;">
    `;

    // 显示前10个标注数据作为预览
    const imageIds = Object.keys(exportData.annotations).slice(0, 10);
    for (const imageId of imageIds) {
      const data = exportData.annotations[imageId];
      // 如果没有plantId，尝试从imageId推断
      const plantId = data.plantId || inferPlantIdFromImageId(imageId);

      html += `
        <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 13px;">
          <div style="font-weight: 500;">${imageId}</div>
          <div style="color: #6b7280;">
            Plant: ${plantId} |
            Keypoints: ${data.annotations.length} |
            Time: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
          </div>
        </div>
      `;
    }

    if (annotationCount > 10) {
      html += `<div style="text-align: center; color: #6b7280; margin-top: 10px;">... ${annotationCount - 10} more images</div>`;
    }

    html += '</div></div>';
  }

  // Display skipped plants
  const skippedCount = Object.keys(exportData.skippedPlants).length;
  if (skippedCount > 0) {
    html += `
      <div style="margin-bottom: 20px;">
        <div style="font-weight: 600; margin-bottom: 10px; color: #374151;">
          ⏭️ Skipped Plants (${skippedCount})
        </div>
        <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px;">
    `;

    for (const [plantId, data] of Object.entries(exportData.skippedPlants)) {
      html += `
        <div style="margin-bottom: 8px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 13px;">
          <div style="font-weight: 500;">${plantId}</div>
          <div style="color: #92400e;">
            Reason: ${data.skipReason} |
            Time: ${data.skipDate ? new Date(data.skipDate).toLocaleString() : 'N/A'}
          </div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  if (html === '') {
    html = '<div style="color: #6b7280; text-align: center; padding: 20px;">No data available</div>';
  }

  return html;
}

/**
 * 按植株和视角分组图像数据
 */
function groupImagesByPlantAndView(imageData) {
  const groupedData = {};
  
  for (const [imageId, annotations] of Object.entries(imageData)) {
    // 解析图像ID获取植株和视角信息
    const parts = imageId.split('_');
    if (parts.length >= 2) {
      const plantId = parts[0]; // BR017-028111
      const viewAngle = parts[1]; // sv-000
      
      if (!groupedData[plantId]) {
        groupedData[plantId] = {};
      }
      
      if (!groupedData[plantId][viewAngle]) {
        groupedData[plantId][viewAngle] = [];
      }
      
      groupedData[plantId][viewAngle].push({
        imageId,
        annotations,
        imageName: imageId,
        keypointCount: annotations.length
      });
    }
  }
  
  // 按时间排序每个视角的图像
  for (const plantId of Object.keys(groupedData)) {
    for (const viewAngle of Object.keys(groupedData[plantId])) {
      groupedData[plantId][viewAngle].sort((a, b) => {
        return a.imageId.localeCompare(b.imageId);
      });
    }
  }
  
  return groupedData;
}

/**
 * 生成预览HTML
 */
async function generatePreviewHTML(groupedData) {
  const plantIds = Object.keys(groupedData).sort();
  
  if (plantIds.length === 0) {
    return '<div style="color: #6b7280; text-align: center; padding: 20px;">暂无数据</div>';
  }
  
  let html = `
    <div style="margin-bottom: 15px; font-weight: 600; color: #374151;">
      共 ${plantIds.length} 个植株参与导出
    </div>
  `;
  
  for (const plantId of plantIds) {
    const plantData = groupedData[plantId];
    const viewAngles = Object.keys(plantData);
    const totalImages = Object.values(plantData).reduce((sum, images) => sum + images.length, 0);
    const totalKeypoints = Object.values(plantData).reduce((sum, images) => 
      sum + images.reduce((imgSum, img) => imgSum + img.keypointCount, 0), 0
    );
    
    html += `
      <div class="preview-plant" style="border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 15px; overflow: hidden;">
        <div class="preview-plant-header" style="background: #f3f4f6; padding: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
             onclick="togglePlantPreview('${plantId}')">
          <div>
            <span style="font-weight: 600; color: #1f2937;">🌱 ${plantId}</span>
            <span style="color: #6b7280; margin-left: 10px;">
              ${viewAngles.length} views • ${totalImages} images • ${totalKeypoints} 个标注点
            </span>
          </div>
          <span class="preview-toggle" style="color: #6b7280;">▼</span>
        </div>
        <div class="preview-plant-content" id="preview-${plantId}" style="display: none;">
          ${generateViewAnglesHTML(plantId, plantData)}
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * 生成视角HTML
 */
function generateViewAnglesHTML(plantId, plantData) {
  let html = '';
  
  for (const [viewAngle, images] of Object.entries(plantData)) {
    const totalKeypoints = images.reduce((sum, img) => sum + img.keypointCount, 0);
    
    html += `
      <div class="preview-view-angle" style="border-top: 1px solid #e5e7eb;">
        <div class="preview-view-header" style="background: #fafafa; padding: 10px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
             onclick="toggleViewPreview('${plantId}', '${viewAngle}')">
          <div>
            <span style="font-weight: 500; color: #374151;">📷 ${viewAngle}</span>
            <span style="color: #6b7280; margin-left: 10px;">
              ${images.length} images • ${totalKeypoints} annotations
            </span>
          </div>
          <span class="preview-toggle" style="color: #6b7280;">▶</span>
        </div>
        <div class="preview-view-content" id="preview-${plantId}-${viewAngle}" style="display: none; padding: 10px 15px;">
          ${generateImagesHTML(images)}
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * 生成图像HTML
 */
function generateImagesHTML(images) {
  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">';
  
  for (const image of images) {
    // 正确提取文件名 - 从完整的imageId中提取最后的文件名部分
    const fileName = extractDisplayFileName(image.imageName);
    
    html += `
      <div class="preview-image" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 10px;">
          <div style="font-weight: 500; color: #374151; font-size: 14px; word-break: break-all;" title="${image.imageName}">
            📄 ${fileName}
          </div>
          <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">
            ${image.keypointCount} 个标注点
          </div>
        </div>
        
        <div class="preview-annotations" style="background: #f8fafc; border-radius: 6px; padding: 10px;">
          <div style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px;">标注点预览:</div>
          <div class="annotation-preview-container" style="position: relative; width: 100%; height: 200px; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; background: #f9fafb;">
            <canvas 
              class="annotation-preview-canvas" 
              data-image-id="${image.imageId}"
              data-annotations='${JSON.stringify(image.annotations)}'
              style="width: 100%; height: 100%; cursor: pointer;"
              title="点击查看大图"
              onclick="showImageDetail('${image.imageId}')"
            ></canvas>
            <div class="preview-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #6b7280; font-size: 12px;">
              加载中...
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * 正确提取显示用的文件名
 */
function extractDisplayFileName(imageName) {
  // 从imageId中提取有意义的部分
  // 例如: BR017-028111_sv-000_BR017-028111-2018-07-09_00_VIS_sv_000-0-0-0.png
  // 提取: BR017-028111-2018-07-09_00_VIS_sv_000-0-0-0.png
  
  const parts = imageName.split('_');
  if (parts.length >= 3) {
    // 从第三部分开始是有意义的文件名信息
    return parts.slice(2).join('_');
  }
  
  // 如果格式不符合预期，返回原始名称
  return imageName;
}

/**
 * 绑定预览事件
 */
function bindPreviewEvents() {
  // 植株展开/折叠事件通过onclick属性绑定
  window.togglePlantPreview = function(plantId) {
    const content = document.getElementById(`preview-${plantId}`);
    const toggle = content.parentElement.querySelector('.preview-plant-header .preview-toggle');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '▲';
      // 展开时渲染canvas
      setTimeout(() => renderPreviewCanvases(content), 100);
    } else {
      content.style.display = 'none';
      toggle.textContent = '▼';
    }
  };
  
  // 视角展开/折叠事件
  window.toggleViewPreview = function(plantId, viewAngle) {
    const content = document.getElementById(`preview-${plantId}-${viewAngle}`);
    const toggle = content.parentElement.querySelector('.preview-view-header .preview-toggle');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '▼';
      // 展开时渲染canvas
      setTimeout(() => renderPreviewCanvases(content), 100);
    } else {
      content.style.display = 'none';
      toggle.textContent = '▶';
    }
  };
  
  // 显示图像详情
  window.showImageDetail = function(imageId) {
    showImageDetailModal(imageId);
  };
  
  // 渲染所有可见的canvas
  setTimeout(() => {
    const allCanvases = document.querySelectorAll('.annotation-preview-canvas');
    allCanvases.forEach(canvas => {
      if (isElementVisible(canvas)) {
        renderAnnotationPreview(canvas);
      }
    });
  }, 500);
}

/**
 * 渲染预览区域内的所有canvas
 */
function renderPreviewCanvases(container) {
  const canvases = container.querySelectorAll('.annotation-preview-canvas');
  canvases.forEach(canvas => {
    if (isElementVisible(canvas)) {
      renderAnnotationPreview(canvas);
    }
  });
}

/**
 * 检查元素是否可见
 */
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * 渲染单个标注预览canvas
 */
async function renderAnnotationPreview(canvas) {
  try {
    const imageId = canvas.dataset.imageId;
    const annotations = JSON.parse(canvas.dataset.annotations);
    const loadingElement = canvas.parentElement.querySelector('.preview-loading');
    
    // 检查是否已经渲染过
    if (canvas.dataset.rendered === 'true') {
      return;
    }
    
    // 显示加载状态
    if (loadingElement) {
      loadingElement.style.display = 'block';
      loadingElement.textContent = '加载图像...';
    }
    
    // 获取图像数据
    const imageData = await getImageDataFromId(imageId);
    if (!imageData) {
      throw new Error('无法获取图像数据');
    }
    
    // 加载图像
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('图像加载失败'));
      image.src = imageData.url;
    });
    
    // 设置canvas尺寸
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const targetWidth = containerRect.width - 2; // 减去边框
    const targetHeight = containerRect.height - 2;
    
    canvas.width = targetWidth * window.devicePixelRatio;
    canvas.height = targetHeight * window.devicePixelRatio;
    canvas.style.width = targetWidth + 'px';
    canvas.style.height = targetHeight + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // 计算图像适应容器的尺寸
    const imgAspect = image.width / image.height;
    const containerAspect = targetWidth / targetHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspect > containerAspect) {
      // 图像较宽，以宽度为准
      drawWidth = targetWidth;
      drawHeight = targetWidth / imgAspect;
      offsetX = 0;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      // 图像较高，以高度为准
      drawHeight = targetHeight;
      drawWidth = targetHeight * imgAspect;
      offsetX = (targetWidth - drawWidth) / 2;
      offsetY = 0;
    }
    
    // 绘制图像
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    
    // 绘制标注点
    if (annotations && annotations.length > 0) {
      // 计算标注点在canvas中的位置
      const scaleX = drawWidth / image.width;
      const scaleY = drawHeight / image.height;
      
      annotations.forEach((annotation, index) => {
        const x = annotation.x * scaleX + offsetX;
        const y = annotation.y * scaleY + offsetY;
        
        // 绘制标注点
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // 绘制标注点编号
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), x, y);
      });
    }
    
    // 隐藏加载状态
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // 标记为已渲染
    canvas.dataset.rendered = 'true';
    
  } catch (error) {
    console.error('渲染标注预览失败:', error);
    const loadingElement = canvas.parentElement.querySelector('.preview-loading');
    if (loadingElement) {
      loadingElement.textContent = '加载失败';
      loadingElement.style.color = '#dc2626';
    }
  }
}

/**
 * 从图像ID获取图像数据
 */
async function getImageDataFromId(imageId) {
  try {
    // 从imageId中解析植株ID
    const parts = imageId.split('_');
    if (parts.length < 2) {
      throw new Error('无效的图像ID格式');
    }
    
    const plantId = parts[0];
    const viewAngle = parts[1];
    
    // 获取植株的图像数据
    if (!plantDataManager) {
      throw new Error('PlantDataManager未初始化');
    }
    
    const images = await plantDataManager.getPlantImages(plantId, viewAngle);
    const targetImage = images.find(img => img.id === imageId);
    
    if (!targetImage) {
      throw new Error(`未找到图像: ${imageId}`);
    }
    
    // 创建图像URL
    const imageURL = await plantDataManager.fileSystemManager.createImageURL(targetImage);
    
    return {
      url: imageURL,
      data: targetImage
    };
    
  } catch (error) {
    console.error('获取图像数据失败:', error);
    return null;
  }
}

/**
 * 显示图像详情模态框
 */
function showImageDetailModal(imageId) {
  // 创建详情模态框 - 简单实现，显示原图和标注点
  const modalHTML = `
    <div id="image-detail-modal" class="modal" style="display: flex; z-index: 2000;">
      <div class="modal-content" style="max-width: 90vw; max-height: 90vh; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0;">图像详情</h3>
          <button onclick="closeImageDetailModal()" class="modal-close"></button>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px; word-break: break-all;">
            ${imageId}
          </div>
          <div style="max-width: 100%; max-height: 70vh; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <canvas id="detail-canvas" style="max-width: 100%; height: auto;"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 移除已存在的详情模态框
  const existingModal = document.getElementById('image-detail-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // 添加到body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 渲染大图
  renderImageDetail(imageId);
  
  // 绑定关闭事件
  window.closeImageDetailModal = function() {
    const modal = document.getElementById('image-detail-modal');
    if (modal) {
      modal.remove();
    }
  };
}

/**
 * 渲染图像详情
 */
async function renderImageDetail(imageId) {
  const canvas = document.getElementById('detail-canvas');
  if (!canvas) return;
  
  try {
    // 获取标注数据
    const previewCanvas = document.querySelector(`[data-image-id="${imageId}"]`);
    const annotations = previewCanvas ? JSON.parse(previewCanvas.dataset.annotations) : [];
    
    // 获取图像数据
    const imageData = await getImageDataFromId(imageId);
    if (!imageData) {
      throw new Error('无法获取图像数据');
    }
    
    // 加载图像
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('图像加载失败'));
      image.src = imageData.url;
    });
    
    // 设置canvas尺寸（保持原图比例，但限制最大尺寸）
    const maxWidth = 800;
    const maxHeight = 600;
    
    let drawWidth = image.width;
    let drawHeight = image.height;
    
    if (drawWidth > maxWidth || drawHeight > maxHeight) {
      const scale = Math.min(maxWidth / drawWidth, maxHeight / drawHeight);
      drawWidth *= scale;
      drawHeight *= scale;
    }
    
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    
    const ctx = canvas.getContext('2d');
    
    // 绘制图像
    ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
    
    // 绘制标注点
    if (annotations && annotations.length > 0) {
      const scaleX = drawWidth / image.width;
      const scaleY = drawHeight / image.height;
      
      annotations.forEach((annotation, index) => {
        const x = annotation.x * scaleX;
        const y = annotation.y * scaleY;
        
        // 绘制标注点
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // 绘制标注点编号
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), x, y);
      });
    }
    
  } catch (error) {
    console.error('渲染图像详情失败:', error);
    canvas.parentElement.innerHTML = '<div style="color: #dc2626; padding: 20px;">图像加载失败</div>';
  }
}

// 全局函数：切换分支点预览
window.toggleBranchPointPreview = function(show = null) {
  if (branchPointPreviewManager) {
    branchPointPreviewManager.toggleVisibility(show);
  }
};

/**
 * 导航到上一张图片
 */
async function navigateToPreviousImage() {
  if (!appState.currentPlant || !appState.currentImage) {
    console.log('没有当前植物或图像，无法导航');
    return;
  }
  
  try {
    // 获取当前视角的所有图像
    const images = await plantDataManager.getPlantImages(
      appState.currentPlant.id, 
      appState.currentPlant.selectedViewAngle
    );
    
    if (images.length <= 1) {
      console.log('只有一张图像，无法导航到上一张');
      return;
    }
    
    // 找到当前图像的索引
    const currentIndex = images.findIndex(img => img.id === appState.currentImage.id);
    
    if (currentIndex === -1) {
      console.warn('未找到当前图像在列表中的位置');
      return;
    }
    
    // 计算上一张图像的索引（循环到最后一张）
    const previousIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    const previousImage = images[previousIndex];
    
    console.log(`导航：从第${currentIndex + 1}张切换到第${previousIndex + 1}张`);
    
    // 切换到上一张图像
    await handleImageSelect(previousImage, true);
    
  } catch (error) {
    console.error('导航到上一张图像失败:', error);
    showError('图像导航失败', error.message);
  }
}

/**
 * 导航到下一张图片
 * @param {boolean} autoMode - 是否为自动化模式（不循环回第一张）
 * @returns {boolean} 是否成功切换到下一张图片
 */
async function navigateToNextImage(autoMode = false) {
  if (!appState.currentPlant || !appState.currentImage) {
    console.log('没有当前植物或图像，无法导航');
    return false;
  }

  try {
    // 获取当前视角的所有图像
    const images = await plantDataManager.getPlantImages(
      appState.currentPlant.id,
      appState.currentPlant.selectedViewAngle
    );

    if (images.length <= 1) {
      console.log('只有一张图像，无法导航到下一张');
      return false;
    }

    // 找到当前图像的索引
    const currentIndex = images.findIndex(img => img.id === appState.currentImage.id);

    if (currentIndex === -1) {
      console.warn('未找到当前图像在列表中的位置');
      return false;
    }

    // 检查是否已经是最后一张
    if (currentIndex === images.length - 1) {
      if (autoMode) {
        console.log('自动化模式：已经是最后一张图片，不循环');
        return false;
      }
      // 非自动化模式：循环到第一张
    }

    // 计算下一张图像的索引
    const nextIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    const nextImage = images[nextIndex];

    console.log(`导航：从第${currentIndex + 1}张切换到第${nextIndex + 1}张`);

    // 切换到下一张图像
    await handleImageSelect(nextImage, true);
    return true;

  } catch (error) {
    console.error('导航到下一张图像失败:', error);
    showError('图像导航失败', error.message);
    return false;
  }
}

/**
 * 处理自动化方向选择（传统标注升级）
 */
function handleAutoDirectionSelection() {
  if (!annotationTool) {
    showError('功能不可用', '标注工具未初始化');
    return;
  }

  // 检查是否有标注点
  if (!annotationTool.keypoints || annotationTool.keypoints.length === 0) {
    showError('传统标注升级', '当前图像没有标注点，请先添加标注点');
    return;
  }

  // 启动自动化方向升级模式
  const success = annotationTool.startAutoDirectionMode();

  if (!success) {
    // startAutoDirectionMode 内部已经显示了提示信息
    return;
  }

  // 更新按钮状态
  const autoDirectionBtn = document.getElementById('auto-direction-btn');
  if (autoDirectionBtn) {
    console.log('[调试] 更新按钮状态为自动模式');

    // 先移除现有的事件监听器
    autoDirectionBtn.removeEventListener('click', handleAutoDirectionSelection);

    // 更新按钮外观
    autoDirectionBtn.textContent = 'Exit Auto Mode';
    autoDirectionBtn.classList.add('active');

    // 创建新的事件处理函数
    const pauseHandler = () => {
      console.log('[调试] 自动化按钮被点击，暂停模式');
      annotationTool.pauseAutoDirectionMode();
    };

    // 添加新的事件监听器
    autoDirectionBtn.addEventListener('click', pauseHandler);

    // 保存处理函数引用，以便后续移除
    autoDirectionBtn._pauseHandler = pauseHandler;
  }

  updateProgressInfo('传统标注升级模式已启动。移动鼠标选择方向，左键确认，右键暂停。');
}

/**
 * 显示跳过植株模态框
 */
function showSkipPlantModal(plantId, event) {
  // 阻止事件冒泡，避免触发植株选择
  if (event) {
    event.stopPropagation();
  }

  const plant = appState.plants.find(p => p.id === plantId);
  if (!plant) {
    showError('错误', '未找到指定的植株');
    return;
  }

  // 设置植株名称
  const plantNameElement = document.getElementById('skip-plant-name');
  if (plantNameElement) {
    plantNameElement.textContent = plant.id;
  }

  // 清空之前的输入
  const reasonTextarea = document.getElementById('skip-reason');
  if (reasonTextarea) {
    reasonTextarea.value = '';
  }

  // 显示模态框
  const modal = document.getElementById('skip-plant-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.dataset.plantId = plantId;

    // 聚焦到文本框
    setTimeout(() => {
      if (reasonTextarea) {
        reasonTextarea.focus();
      }
    }, 100);
  }
}

/**
 * 隐藏跳过植株模态框
 */
function hideSkipPlantModal() {
  const modal = document.getElementById('skip-plant-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.dataset.plantId = '';
  }
}

/**
 * 确认跳过植株
 */
async function confirmSkipPlant() {
  const modal = document.getElementById('skip-plant-modal');
  const plantId = modal?.dataset.plantId;
  const reasonTextarea = document.getElementById('skip-reason');
  const reason = reasonTextarea?.value.trim();

  if (!plantId) {
    showError('错误', '未找到要跳过的植株');
    return;
  }

  if (!reason) {
    showError('输入错误', '请输入跳过原因');
    reasonTextarea?.focus();
    return;
  }

  try {
    // 更新植株状态
    await plantDataManager.skipPlant(plantId, reason);

    // 更新UI
    const plant = appState.plants.find(p => p.id === plantId);
    if (plant) {
      plant.status = 'skipped';
      plant.skipReason = reason;
      plant.skipDate = new Date().toISOString();

      // 重新渲染植株列表项
      const plantItem = document.querySelector(`[data-plant-id="${plantId}"]`);
      if (plantItem) {
        const newItem = createPlantListItem(plant);
        plantItem.parentNode.replaceChild(newItem, plantItem);
        
        // 🔧 FIX: Update note badge for the re-rendered plant item
        if (window.PlantAnnotationTool?.noteUI) {
          setTimeout(() => {
            window.PlantAnnotationTool.noteUI.updatePlantNoteBadge(plantId);
          }, 100);
        }
      }

      // 更新统计
      updateProgressStats();

      // 如果当前选中的是被跳过的植株，清除选择
      if (appState.currentPlant?.id === plantId) {
        console.log('当前植株被跳过，初始化空工作区');
        initializeEmptyWorkspace();
      }
    }

    hideSkipPlantModal();
    showSuccess('跳过成功', `植株 ${plantId} 已标记为跳过`);

  } catch (error) {
    console.error('跳过植株失败:', error);
    showError('跳过失败', error.message);
  }
}

/**
 * 🔧 NEW: 处理撤销跳过植株 - 显示确认模态框
 */
async function handleUnskipPlant(plantId, event) {
  // 阻止事件冒泡，避免触发植株选择
  if (event) {
    event.stopPropagation();
  }

  const plant = appState.plants.find(p => p.id === plantId);
  if (!plant) {
    showError('错误', '未找到指定的植株');
    return;
  }

  if (plant.status !== 'skipped') {
    showError('操作错误', '植株当前状态不是跳过状态');
    return;
  }

  // 显示撤销跳过确认模态框
  showUnskipPlantModal(plantId, plant.skipReason);
}

/**
 * 🔧 NEW: 处理撤销完成植株 - 显示确认模态框
 */
async function handleUncompletePlant(plantId, event) {
  // 阻止事件冒泡，避免触发植株选择
  if (event) {
    event.stopPropagation();
  }

  const plant = appState.plants.find(p => p.id === plantId);
  if (!plant) {
    showError('错误', '未找到指定的植株');
    return;
  }

  if (plant.status !== 'completed') {
    showError('操作错误', '植株当前状态不是已完成状态');
    return;
  }

  // 显示撤销完成确认模态框
  showUncompletePlantModal(plantId);
}

/**
 * 处理状态过滤器变化
 */
function handleStatusFilterChange() {
  const statusFilter = document.getElementById('status-filter');
  const searchInput = document.getElementById('plant-search');

  if (!statusFilter || !plantDataManager) return;

  const selectedStatus = statusFilter.value;
  const searchQuery = searchInput?.value.trim() || '';

  // 应用过滤
  applyPlantsFilter(selectedStatus, searchQuery);
}

/**
 * 处理植株搜索输入
 */
function handlePlantSearchInput() {
  const statusFilter = document.getElementById('status-filter');
  const searchInput = document.getElementById('plant-search');

  if (!searchInput || !plantDataManager) return;

  const searchQuery = searchInput.value.trim();
  const selectedStatus = statusFilter?.value || 'all';

  // 应用过滤
  applyPlantsFilter(selectedStatus, searchQuery);
}

/**
 * 应用植株过滤
 */
function applyPlantsFilter(status, searchQuery) {
  if (!plantDataManager) return;

  let filteredPlants = plantDataManager.filterPlantsByStatus(status);

  // 如果有搜索查询，进一步过滤
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    filteredPlants = filteredPlants.filter(plant =>
      plant.id.toLowerCase().includes(lowerQuery) ||
      plant.name.toLowerCase().includes(lowerQuery)
    );
  }

  // 重新渲染植株列表
  renderPlantList(filteredPlants);

  console.log(`过滤结果: 状态=${status}, 搜索="${searchQuery}", 结果=${filteredPlants.length}个植株`);
}

/**
 * 🔧 NEW: 显示撤销跳过植株模态框
 */
function showUnskipPlantModal(plantId, skipReason) {
  const modal = document.getElementById('unskip-plant-modal');
  const plantIdElement = document.getElementById('unskip-plant-id');
  const skipReasonElement = document.getElementById('unskip-skip-reason');
  const newStatusElement = document.getElementById('unskip-new-status');
  
  if (!modal) {
    console.error('Unskip plant modal not found');
    return;
  }

  // 设置植株信息
  if (plantIdElement) {
    plantIdElement.textContent = plantId;
  }
  
  if (skipReasonElement) {
    skipReasonElement.textContent = skipReason || '无';
  }

  // 🔧 FIX: Set the new status that will be applied
  if (newStatusElement) {
    newStatusElement.textContent = 'Pending (will be determined by annotations)';
  }

  // 显示模态框
  modal.style.display = 'flex';
  modal.dataset.plantId = plantId;
}

/**
 * 🔧 NEW: 隐藏撤销跳过植株模态框
 */
function hideUnskipPlantModal() {
  const modal = document.getElementById('unskip-plant-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.dataset.plantId = '';
  }
}

/**
 * 🔧 NEW: 确认撤销跳过植株
 */
async function confirmUnskipPlant() {
  const modal = document.getElementById('unskip-plant-modal');
  const plantId = modal?.dataset.plantId;

  if (!plantId) {
    showError('错误', '未找到要撤销跳过的植株');
    return;
  }

  try {
    // 调用PlantDataManager的撤销跳过方法
    await plantDataManager.unskipPlant(plantId);
    console.log(`[Debug] 后端unskip操作完成，植物ID: ${plantId}`);

    // 更新本地植株对象
    const plant = appState.plants.find(p => p.id === plantId);
    if (plant) {
      console.log(`[Debug] 更新前植物状态: ${plant.status}, skipReason: ${plant.skipReason}`);
      
      const annotations = await plantDataManager.getPlantAnnotations(plantId);
      plant.status = (annotations && annotations.length > 0) ? 'in-progress' : 'pending';
      delete plant.skipReason;
      delete plant.skipDate;
      
      console.log(`[Debug] 更新后植物状态: ${plant.status}, skipReason: ${plant.skipReason}`);

      // 重新渲染植株列表项
      const plantItem = document.querySelector(`[data-plant-id="${plantId}"]`);
      if (plantItem) {
        const newItem = createPlantListItem(plant);
        plantItem.parentNode.replaceChild(newItem, plantItem);
        console.log(`[Debug] 植物列表项已重新渲染: ${plantId}`);
        
        // 🔧 FIX: Update note badge for the re-rendered plant item
        if (window.PlantAnnotationTool?.noteUI) {
          setTimeout(() => {
            window.PlantAnnotationTool.noteUI.updatePlantNoteBadge(plantId);
          }, 100);
        }
      }

      // 更新统计
      updateProgressStats();
      
      // 🔧 NEW: Update complete plant button state after uncomplete
      updateCompletePlantButtonState();
    }

    hideUnskipPlantModal();
    showSuccess('撤销成功', `植株 ${plantId} 已恢复到正常状态`);

  } catch (error) {
    console.error('撤销跳过植株失败:', error);
    showError('撤销失败', error.message);
  }
}

/**
 * 🔧 NEW: 显示撤销完成植株模态框
 */
function showUncompletePlantModal(plantId) {
  const modal = document.getElementById('uncomplete-plant-modal');
  const plantIdElement = document.getElementById('uncomplete-plant-id');
  
  if (!modal) {
    console.error('Uncomplete plant modal not found');
    return;
  }

  // 设置植株信息
  if (plantIdElement) {
    plantIdElement.textContent = plantId;
  }

  // 显示模态框
  modal.style.display = 'flex';
  modal.dataset.plantId = plantId;
}

/**
 * 🔧 NEW: 隐藏撤销完成植株模态框
 */
function hideUncompletePlantModal() {
  const modal = document.getElementById('uncomplete-plant-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.dataset.plantId = '';
  }
}

/**
 * 🔧 NEW: 确认撤销完成植株
 */
async function confirmUncompletePlant() {
  const modal = document.getElementById('uncomplete-plant-modal');
  const plantId = modal?.dataset.plantId;

  if (!plantId) {
    showError('错误', '未找到要撤销完成的植株');
    return;
  }

  try {
    // 调用PlantDataManager的撤销完成方法
    await plantDataManager.uncompletePlant(plantId);

    // 更新本地植株对象
    const plant = appState.plants.find(p => p.id === plantId);
    if (plant) {
      const annotations = await plantDataManager.getPlantAnnotations(plantId);
      plant.status = (annotations && annotations.length > 0) ? 'in-progress' : 'pending';

      // 重新渲染植株列表项
      const plantItem = document.querySelector(`[data-plant-id="${plantId}"]`);
      if (plantItem) {
        const newItem = createPlantListItem(plant);
        plantItem.parentNode.replaceChild(newItem, plantItem);
        
        // 🔧 FIX: Update note badge for the re-rendered plant item
        if (window.PlantAnnotationTool?.noteUI) {
          setTimeout(() => {
            window.PlantAnnotationTool.noteUI.updatePlantNoteBadge(plantId);
          }, 100);
        }
      }

      // 更新统计
      updateProgressStats();
      
      // 🔧 NEW: Update complete plant button state after uncomplete
      updateCompletePlantButtonState();
    }

    hideUncompletePlantModal();
    showSuccess('撤销成功', `植株 ${plantId} 已恢复到进行中状态`);

  } catch (error) {
    console.error('撤销完成植株失败:', error);
    showError('撤销失败', error.message);
  }
}

// 将函数添加到全局对象，以便AnnotationTool可以访问
window.handleAutoDirectionSelection = handleAutoDirectionSelection;
window.navigateToNextImage = navigateToNextImage;
window.showSkipPlantModal = showSkipPlantModal;

// 🔧 NEW: Global functions for state reversal operations
window.handleUnskipPlant = handleUnskipPlant;

/**
 * 处理锁定倍数开关变化
 */
function handleZoomLockChange() {
  const zoomLockCheckbox = document.getElementById('zoom-lock-checkbox');
  const zoomLockValue = document.getElementById('zoom-lock-value');

  if (zoomLockCheckbox && zoomLockValue) {
    const isLocked = zoomLockCheckbox.checked;
    zoomLockValue.disabled = !isLocked;

    console.log(`缩放锁定: ${isLocked ? '开启' : '关闭'}`);

    if (isLocked) {
      const lockValue = parseFloat(zoomLockValue.value);
      console.log(`锁定倍数设置为: ${lockValue}x`);
    }
  }
}

/**
 * 处理锁定倍数值变化
 */
function handleZoomLockValueChange() {
  const zoomLockValue = document.getElementById('zoom-lock-value');
  if (zoomLockValue) {
    const lockValue = parseFloat(zoomLockValue.value);
    console.log(`锁定倍数更新为: ${lockValue}x`);
  }
}

/**
 * 处理自动切换到预期位置开关变化
 */
function handleAutoMoveChange() {
  const autoMoveCheckbox = document.getElementById('auto-move-checkbox');

  if (autoMoveCheckbox) {
    const isEnabled = autoMoveCheckbox.checked;
    console.log(`自动切换到预期位置: ${isEnabled ? '开启' : '关闭'}`);

    // 通知AnnotationTool更新设置
    if (annotationTool && typeof annotationTool.setAutoMoveToExpectedPosition === 'function') {
      annotationTool.setAutoMoveToExpectedPosition(isEnabled);
    }
  }
}

/**
 * 🔄 处理实时变更同步开关变化
 */
function handleRealTimeChangeChange() {
  const realTimeChangeCheckbox = document.getElementById('real-time-change-checkbox');
  
  if (realTimeChangeCheckbox) {
    const isEnabled = realTimeChangeCheckbox.checked;
    console.log(`🔄 实时变更同步: ${isEnabled ? '开启' : '关闭'}`);
    
    // 通知RealTimeSyncManager更新设置
    if (realTimeSyncManager && typeof realTimeSyncManager.setEnabled === 'function') {
      realTimeSyncManager.setEnabled(isEnabled);
    }
    
    // 立即更新进度信息以反映状态变化
    updateProgressInfo(`实时变更同步已${isEnabled ? '开启' : '关闭'}`);
  }
}

/**
 * 获取自动切换设置
 */
function getAutoMoveSettings() {
  const autoMoveCheckbox = document.getElementById('auto-move-checkbox');
  return {
    isEnabled: autoMoveCheckbox ? autoMoveCheckbox.checked : false
  };
}

/**
 * 获取锁定倍数设置
 */
function getZoomLockSettings() {
  const zoomLockCheckbox = document.getElementById('zoom-lock-checkbox');
  const zoomLockValue = document.getElementById('zoom-lock-value');

  if (zoomLockCheckbox && zoomLockValue) {
    return {
      isLocked: zoomLockCheckbox.checked,
      lockValue: parseFloat(zoomLockValue.value) || 2.5
    };
  }

  return { isLocked: false, lockValue: 2.5 };
}

/**
 * 更新全屏加载进度
 */
function updateFullscreenLoading(progress, subtitle, details) {
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const loadingSubtitle = document.getElementById('loading-subtitle');
  const loadingDetails = document.getElementById('loading-details');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${progress}%`;
  }
  
  if (loadingSubtitle) {
    loadingSubtitle.textContent = subtitle;
  }
  
  if (loadingDetails) {
    loadingDetails.textContent = details;
  }
}

/**
 * 隐藏全屏加载指示器
 */
function hideFullscreenLoading() {
  const fullscreenLoading = document.getElementById('fullscreen-loading');
  if (fullscreenLoading) {
    fullscreenLoading.style.display = 'none';
  }
}

/**
 * 自动连接数据集 - 完整批量加载版本 (带性能监控)
 */
async function autoConnectDataset() {
  console.log('开始自动连接数据集 - 完整批量加载模式...');
  
  // 🔧 PERFORMANCE: 开始性能监控
  if (performanceMonitor) {
    performanceMonitor.startMonitoring();
    performanceMonitor.addCheckpoint('开始数据集连接');
  }
  
  try {
    updateFullscreenLoading(5, 'Connecting to backend...', 'Establishing connection to the dataset service');
    
    // 检查后端连接
    let datasetInfo;
    try {
      datasetInfo = await plantDataManager.fileSystemManager.getDatasetInfo();
      performanceMonitor?.addCheckpoint('后端连接成功');
    } catch (connectionError) {
      performanceMonitor?.recordError(connectionError, '后端连接失败');
      throw new ConnectionError(
        '无法连接到后端服务',
        '请确保后端服务已启动。运行 ./start-backend.sh 启动服务器',
        {
          originalError: connectionError,
          serverUrl: 'http://localhost:3003',
          suggestion: '尝试运行: ./start-backend.sh'
        }
      );
    }
    
    if (!datasetInfo) {
      const error = new Error('后端服务响应异常：数据集信息为空');
      performanceMonitor?.recordError(error, '数据集信息验证');
      throw error;
    }

    console.log('连接的数据集:', datasetInfo.datasetPath);

    updateFullscreenLoading(15, 'Validating dataset structure...', 'Checking plant directories and structure');

    // 验证目录结构
    await validateDatasetStructure();
    performanceMonitor?.addCheckpoint('目录结构验证完成');

    updateFullscreenLoading(25, 'Loading plant data...', 'Scanning plant directories and loading basic info');

    // 使用PlantDataManager加载数据集
    const plants = await plantDataManager.loadDataset();
    performanceMonitor?.recordDataLoaded('plants', plants.length);
    
    // 更新应用状态
    appState.currentDatasetPath = datasetInfo.datasetPath;
    appState.plants = plants;
    currentDataset = {
      path: datasetInfo.datasetPath,
      name: 'Brassica napus dataset',
      plantCount: plants.length
    };
    
    console.log(`植物数据加载完成: ${plants.length} 个植物`);

    // 🔧 PERFORMANCE OPTIMIZATION: 并行加载所有数据类型
    updateFullscreenLoading(40, 'Loading all data types...', 'Bulk loading annotations, notes, and statistics');
    performanceMonitor?.addCheckpoint('开始并行数据加载');

    const loadingTasks = [];
    const loadingResults = {
      annotations: null,
      notes: null,
      annotationsLoaded: false,
      notesLoaded: false,
      errors: []
    };

    // 任务1: 批量加载标注数据
    if (window.PlantAnnotationTool?.annotationManager) {
      loadingTasks.push(
        window.PlantAnnotationTool.annotationManager.getAllAnnotationsInBulk()
          .then(bulkAnnotations => {
            if (bulkAnnotations) {
              loadingResults.annotations = bulkAnnotations;
              loadingResults.annotationsLoaded = true;
              performanceMonitor?.recordNetworkRequest('annotations', true);
              performanceMonitor?.recordDataLoaded('annotations', 
                Object.keys(bulkAnnotations.plantAnnotations || {}).length + 
                Object.keys(bulkAnnotations.imageAnnotations || {}).length
              );
              console.log('[批量加载] 标注数据加载成功');
              updateFullscreenLoading(60, 'Annotations loaded successfully...', 'Processing bulk annotation data');
            } else {
              console.log('[批量加载] 标注批量API不可用，将使用懒加载模式');
              performanceMonitor?.recordFallback('标注批量API不可用');
            }
          })
          .catch(error => {
            console.warn('[批量加载] 标注数据加载失败:', error.message);
            performanceMonitor?.recordError(error, '标注数据批量加载');
            loadingResults.errors.push(`标注加载失败: ${error.message}`);
          })
      );
    }

    // 任务2: 批量加载笔记数据
    if (window.PlantAnnotationTool?.noteManager) {
      loadingTasks.push(
        window.PlantAnnotationTool.noteManager.getAllNotesInBulk()
          .then(bulkNotes => {
            if (bulkNotes) {
              loadingResults.notes = bulkNotes;
              loadingResults.notesLoaded = true;
              performanceMonitor?.recordNetworkRequest('notes', true);
              performanceMonitor?.recordDataLoaded('notes',
                Object.keys(bulkNotes.plantNotes || {}).length +
                Object.keys(bulkNotes.imageNotes || {}).length
              );
              console.log('[批量加载] 笔记数据加载成功');
              updateFullscreenLoading(80, 'Notes loaded successfully...', 'Processing bulk note data');
            } else {
              console.log('[批量加载] 笔记批量API不可用，将使用懒加载模式');
              performanceMonitor?.recordFallback('笔记批量API不可用');
            }
          })
          .catch(error => {
            console.warn('[批量加载] 笔记数据加载失败:', error.message);
            performanceMonitor?.recordError(error, '笔记数据批量加载');
            loadingResults.errors.push(`笔记加载失败: ${error.message}`);
          })
      );
    }

    // 等待所有加载任务完成
    await Promise.allSettled(loadingTasks);
    performanceMonitor?.addCheckpoint('并行数据加载完成');

    updateFullscreenLoading(90, 'Processing loaded data...', 'Updating caches and preparing UI components');

    // 生成最终状态消息
    const loadedComponents = [];
    if (loadingResults.annotationsLoaded) {
      const annotationStats = loadingResults.annotations.statistics || {};
      const totalAnnotations = annotationStats.totalAnnotations || 0;
      loadedComponents.push(`${totalAnnotations} annotations`);
    }
    if (loadingResults.notesLoaded) {
      const noteStats = loadingResults.notes.statistics || {};
      const totalNotes = noteStats.totalNotes || 0;
      loadedComponents.push(`${totalNotes} notes`);
    }

    const loadedMessage = loadedComponents.length > 0 
      ? `All data loaded: ${plants.length} plants, ${loadedComponents.join(', ')}`
      : `Dataset loaded: ${plants.length} plants (bulk APIs not available)`;

    updateFullscreenLoading(95, 'Finalizing initialization...', loadedMessage);

    // 🔧 PERFORMANCE: 预填充缓存以获得即时徽章更新
    if (loadingResults.notesLoaded && window.PlantAnnotationTool?.noteUI) {
      try {
        await window.PlantAnnotationTool.noteUI.updateAllPlantNoteBadgesFromBulk(loadingResults.notes);
        performanceMonitor?.addCheckpoint('笔记徽章预填充完成');
        console.log('[批量加载] 笔记徽章预填充完成');
      } catch (error) {
        console.warn('[批量加载] 笔记徽章预填充失败:', error.message);
        performanceMonitor?.recordError(error, '笔记徽章预填充');
      }
    }

    updateFullscreenLoading(100, 'Initialization complete!', 'All systems ready - entering main application');
    
    // 🔧 WAIT FOR COMPLETE LOADING: 只有在所有数据加载完成后才进入主应用
    console.log(`[完整加载] 数据加载完成 - 标注: ${loadingResults.annotationsLoaded}, 笔记: ${loadingResults.notesLoaded}`);
    
    if (loadingResults.errors.length > 0) {
      console.warn('[完整加载] 部分数据加载失败:', loadingResults.errors);
    }

    // 🔧 PERFORMANCE: 结束性能监控并生成报告
    let performanceReport = null;
    if (performanceMonitor) {
      performanceReport = performanceMonitor.endMonitoring();
      console.log('🚀 [性能报告] 批量加载性能:', performanceReport);
      
      // 将性能报告存储到全局对象中以便调试
      window.PlantAnnotationTool.lastPerformanceReport = performanceReport;
    }

    // 短暂显示成功状态，然后进入主应用
    setTimeout(() => {
      hideFullscreenLoading();
      
      // 显示植物列表
      renderPlantList(plants);
      
      // 初始更新统计显示
      updateProgressStats();
      
      // 更新进度信息
      updateProgressInfo(loadedMessage);
      
      // 显示性能信息（如果有的话）
      if (performanceReport && performanceReport.performanceGrade) {
        const gradeMsg = `性能评级: ${performanceReport.performanceGrade} (${performanceReport.summary.totalLoadingTime})`;
        console.log(`[完整加载] ${gradeMsg}`);
      }
      
      console.log(`[完整加载] 应用启动完成: ${plants.length} 个植物, 标注已加载: ${loadingResults.annotationsLoaded}, 笔记已加载: ${loadingResults.notesLoaded}`);
    }, 1500); // 稍长的延迟以显示完成状态
    
  } catch (error) {
    console.error('自动连接数据集失败:', error);
    
    // 记录错误到性能监控
    performanceMonitor?.recordError(error, '数据集连接失败');
    performanceMonitor?.endMonitoring();
    
    if (error instanceof ConnectionError) {
      hideFullscreenLoading();
      showConnectionError(error);
    } else {
      hideFullscreenLoading();
      showError('数据集连接失败', `${error.message}\n\n请检查网络连接和后端服务状态`);
    }
    
    throw error;
  }
}

/**
 * 自定义连接错误类
 */
class ConnectionError extends Error {
  constructor(title, message, details = {}) {
    super(message);
    this.name = 'ConnectionError';
    this.title = title;
    this.details = details;
  }
}

/**
 * 显示连接错误的专门处理
 */
function showConnectionError(error) {
  const errorMessage = `${error.title}\n\n${error.message}`;
  const detailMessage = error.details.suggestion ? 
    `\n\n建议解决方案：\n${error.details.suggestion}` : '';
  
  showError(
    '后端服务连接失败', 
    errorMessage + detailMessage + '\n\n服务器地址: ' + (error.details.serverUrl || 'http://localhost:3003')
  );
  
  // 添加重试按钮到错误模态框
  addRetryButton();
}

/**
 * 添加重试按钮到错误模态框
 */
function addRetryButton() {
  const errorModal = document.getElementById('error-modal');
  if (!errorModal) return;
  
  // 检查是否已存在重试按钮
  if (errorModal.querySelector('.retry-button')) return;
  
  const retryButton = document.createElement('button');
  retryButton.textContent = '重试连接';
  retryButton.className = 'retry-button';
  retryButton.style.cssText = `
    margin-left: 10px;
    padding: 8px 16px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  retryButton.onclick = async () => {
    errorModal.style.display = 'none';
    showFullscreenLoading();
    
    try {
      await autoConnectDataset();
    } catch (retryError) {
      console.error('重试失败:', retryError);
    }
  };
  
  // 添加到错误模态框的按钮区域
  const buttonArea = errorModal.querySelector('.error-buttons') || errorModal;
  buttonArea.appendChild(retryButton);
}

// 🔧 NEW: Delete Plant Annotations Functionality

/**
 * 🔧 NEW: Setup deletion scope options in the modal
 */
async function setupDeletionScopeOptions(plantId) {
  const modal = document.getElementById('delete-plant-annotations-modal');
  const futureImagesInfo = document.getElementById('future-images-info');
  const futureImagesCount = document.getElementById('future-images-count');
  
  // Reset deletion scope to default
  const plantAllOption = modal.querySelector('input[name="deletion-scope"][value="plant-all"]');
  if (plantAllOption) {
    plantAllOption.checked = true;
  }
  
  // Hide future images info initially
  if (futureImagesInfo) {
    futureImagesInfo.style.display = 'none';
  }
  
  // Check if there's a current image context for spreading deletion
  if (appState.currentImage && appState.currentPlant && appState.currentPlant.id === plantId) {
    try {
      // Get future images for spreading deletion
      const futureImages = await getFutureImagesForClearing();
      const futureCount = futureImages ? futureImages.length : 0;
      
      if (futureCount > 0) {
        // Show future images info
        if (futureImagesInfo && futureImagesCount) {
          futureImagesCount.textContent = futureCount;
          futureImagesInfo.style.display = 'block';
        }
        
        // Enable current+future option
        const currentFutureOption = modal.querySelector('input[name="deletion-scope"][value="current-and-future"]');
        if (currentFutureOption) {
          currentFutureOption.disabled = false;
          currentFutureOption.parentElement.style.opacity = '1';
        }
        
        // Enable current-only option
        const currentOnlyOption = modal.querySelector('input[name="deletion-scope"][value="current-only"]');
        if (currentOnlyOption) {
          currentOnlyOption.disabled = false;
          currentOnlyOption.parentElement.style.opacity = '1';
        }
      } else {
        // Disable current+future option if no future images
        disableScopeOption('current-and-future', 'No future images available');
        disableScopeOption('current-only', 'Current image only (basic clear)');
      }
    } catch (error) {
      console.warn('Failed to check future images for deletion scope:', error);
      disableScopeOption('current-and-future', 'Cannot determine future images');
      disableScopeOption('current-only', 'Current image context unavailable');
    }
  } else {
    // No current image context - disable spreading options
    disableScopeOption('current-and-future', 'No current image selected');
    disableScopeOption('current-only', 'No current image selected');
  }
  
  // Add event listener for scope changes
  const scopeOptions = modal.querySelectorAll('input[name="deletion-scope"]');
  scopeOptions.forEach(option => {
    option.addEventListener('change', handleDeletionScopeChange);
  });
}

/**
 * 🔧 NEW: Disable a deletion scope option with reason
 */
function disableScopeOption(value, reason) {
  const modal = document.getElementById('delete-plant-annotations-modal');
  const option = modal.querySelector(`input[name="deletion-scope"][value="${value}"]`);
  if (option) {
    option.disabled = true;
    option.parentElement.style.opacity = '0.5';
    option.parentElement.title = reason;
  }
}

/**
 * 🔧 NEW: Handle deletion scope change
 */
function handleDeletionScopeChange() {
  const selectedScope = document.querySelector('input[name="deletion-scope"]:checked');
  const confirmCheckbox = document.getElementById('delete-confirmation-checkbox');
  const confirmButton = document.getElementById('delete-confirm-btn');
  
  if (selectedScope) {
    const scope = selectedScope.value;
    
    // Update confirmation text based on scope
    const confirmText = confirmCheckbox.parentElement.querySelector('span');
    if (confirmText) {
      switch (scope) {
        case 'plant-all':
          confirmText.textContent = 'I understand that this action is irreversible and will delete all annotation data for this plant';
          break;
        case 'current-and-future':
          confirmText.textContent = 'I understand that this action is irreversible and will delete current and future annotations';
          break;
        case 'current-only':
          confirmText.textContent = 'I understand that this action is irreversible and will delete the current image annotations';
          break;
      }
    }
    
    // Update button text based on scope
    if (confirmButton) {
      switch (scope) {
        case 'plant-all':
          confirmButton.textContent = '🗑️ Delete All Plant Annotations';
          break;
        case 'current-and-future':
          confirmButton.textContent = '⚡ Delete Current + Future';
          break;
        case 'current-only':
          confirmButton.textContent = '🗑️ Delete Current Image';
          break;
      }
    }
  }
}

/**
 * Handle delete plant annotations button click
 */
async function handleDeletePlantAnnotations() {
  if (!appState.currentPlant) {
    showError('删除失败', '请先选择植物');
    return;
  }
  
  console.log(`[Delete Plant] 开始删除植物 ${appState.currentPlant.id} 的标注`);
  
  // Show the confirmation modal and load statistics
  await showDeletePlantAnnotationsModal(appState.currentPlant.id);
}

/**
 * Show delete plant annotations modal with statistics
 */
async function showDeletePlantAnnotationsModal(plantId) {
  const modal = document.getElementById('delete-plant-annotations-modal');
  const plantIdElement = document.getElementById('delete-plant-id');
  const statsLoading = document.getElementById('stats-loading');
  const statsContent = document.getElementById('stats-content');
  const confirmCheckbox = document.getElementById('delete-confirmation-checkbox');
  const confirmButton = document.getElementById('delete-confirm-btn');
  
  if (!modal) return;
  
  // Reset modal state
  plantIdElement.textContent = plantId;
  statsLoading.style.display = 'block';
  statsContent.style.display = 'none';
  confirmCheckbox.checked = false;
  confirmButton.disabled = true;
  
  // 🔧 NEW: Setup deletion scope options
  setupDeletionScopeOptions(plantId);
  
  // Show modal
  modal.style.display = 'flex';
  
  try {
    // Load plant annotation statistics
    console.log(`[Delete Plant] 加载植物 ${plantId} 的统计信息`);
    const response = await fetch(`http://localhost:3003/api/annotations/plant/${plantId}/stats`);
    const result = await response.json();
    
    if (result.success) {
      // Update statistics display
      document.getElementById('annotation-files-count').textContent = result.statistics.annotationFiles;
      document.getElementById('annotation-points-count').textContent = result.statistics.totalAnnotationPoints;
      document.getElementById('related-files-count').textContent = result.statistics.relatedFiles;
      document.getElementById('total-files-count').textContent = result.statistics.totalFiles;
      
      // Show statistics
      statsLoading.style.display = 'none';
      statsContent.style.display = 'block';
      
      console.log(`[Delete Plant] 统计加载完成: ${result.statistics.totalFiles} 个文件, ${result.statistics.totalAnnotationPoints} 个标注点`);
      
      // Store statistics for later use
      modal.dataset.plantStats = JSON.stringify(result.statistics);
    } else {
      throw new Error(result.error || '获取统计信息失败');
    }
  } catch (error) {
    console.error(`[Delete Plant] 加载统计信息失败:`, error);
    statsLoading.innerHTML = `<span style="color: #dc2626;">❌ 加载统计信息失败: ${error.message}</span>`;
  }
}

/**
 * Hide delete plant annotations modal
 */
function hideDeletePlantAnnotationsModal() {
  const modal = document.getElementById('delete-plant-annotations-modal');
  if (modal) {
    modal.style.display = 'none';
    
    // Reset modal state
    const confirmCheckbox = document.getElementById('delete-confirmation-checkbox');
    const confirmButton = document.getElementById('delete-confirm-btn');
    if (confirmCheckbox) confirmCheckbox.checked = false;
    if (confirmButton) {
      confirmButton.disabled = true;
      // 🔧 FIX: Also restore button text to default when hiding modal
      confirmButton.textContent = '🗑️ Delete All Annotations';
    }
  }
}

/**
 * Handle confirmation checkbox change
 */
function handleDeleteConfirmationChange() {
  const confirmCheckbox = document.getElementById('delete-confirmation-checkbox');
  const confirmButton = document.getElementById('delete-confirm-btn');
  
  if (confirmCheckbox && confirmButton) {
    confirmButton.disabled = !confirmCheckbox.checked;
  }
}

/**
 * Confirm and execute plant annotations deletion
 */
async function confirmDeletePlantAnnotations() {
  if (!appState.currentPlant) {
    showError('删除失败', '未选择植物');
    return;
  }
  
  const plantId = appState.currentPlant.id;
  const modal = document.getElementById('delete-plant-annotations-modal');
  const confirmButton = document.getElementById('delete-confirm-btn');
  
  if (!modal || !confirmButton) return;
  
  // 🔧 NEW: Get selected deletion scope
  const selectedScope = modal.querySelector('input[name="deletion-scope"]:checked');
  const deletionScope = selectedScope ? selectedScope.value : 'plant-all';
  
  try {
    // Show loading state
    const originalText = confirmButton.textContent;
    confirmButton.textContent = '⏳ Deleting...';
    confirmButton.disabled = true;
    
    console.log(`[Delete Plant] 开始删除植物 ${plantId} 的标注，范围: ${deletionScope}`);
    
    let result;
    
    switch (deletionScope) {
      case 'plant-all':
        // Execute full plant deletion via API
        result = await executeFullPlantDeletion(plantId);
        break;
        
      case 'current-and-future':
        // Execute spreading deletion
        result = await executeSpreadingDeletion(plantId);
        break;
        
      case 'current-only':
        // Execute current image only deletion
        result = await executeCurrentImageDeletion(plantId);
        break;
        
      default:
        throw new Error(`Unknown deletion scope: ${deletionScope}`);
    }
    
    if (result.success) {
      console.log(`[Delete Plant] 删除成功:`, result.statistics);
      
      // 🔧 FIX: Restore button text before hiding modal
      confirmButton.textContent = originalText;
      
      // Hide modal
      hideDeletePlantAnnotationsModal();
      
      // Show success message with statistics
      const stats = result.statistics;
      const successMessage = createSuccessMessage(plantId, deletionScope, stats);
      showSuccess('删除成功', successMessage);
      
      // Update progress and UI
      updateProgressInfo(`植物 ${plantId} 的标注数据已删除 (${deletionScope})`);
      
      // Handle UI updates based on deletion scope
      await handlePostDeletionUpdates(plantId, deletionScope);
      
    } else {
      throw new Error(result.error || '删除操作失败');
    }
    
  } catch (error) {
    console.error(`[Delete Plant] 删除植物 ${plantId} 失败:`, error);
    
    // Restore button state
    confirmButton.textContent = originalText;
    confirmButton.disabled = false;
    
    showError('删除失败', `删除植物 ${plantId} 的标注数据时出错: ${error.message}`);
  }
}

/**
 * 🔧 NEW: Execute full plant deletion via API
 */
async function executeFullPlantDeletion(plantId) {
  const response = await fetch(`http://localhost:3003/api/annotations/plant/${plantId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
}

/**
 * 🔧 NEW: Execute spreading deletion (current + future images)
 */
async function executeSpreadingDeletion(plantId) {
  if (!appState.currentImage || !appState.currentPlant) {
    throw new Error('No current image context for spreading deletion');
  }
  
  try {
    // Get future images
    const futureImages = await getFutureImagesForClearing();
    const allImages = [appState.currentImage, ...futureImages];
    
    let deletedCount = 0;
    let errors = [];
    
    // Delete annotations for each image
    for (const image of allImages) {
      try {
        // 🔧 FIX: For current image, clear workspace FIRST to prevent auto-save interference
        if (image.id === appState.currentImage.id && annotationTool) {
          console.log(`[Spreading Delete] Clearing current image workspace: ${image.id}`);
          annotationTool.clearKeypoints();
          
          // Update annotation status display immediately to reflect cleared state
          if (typeof updateAnnotationStatusDisplay === 'function') {
            setTimeout(updateAnnotationStatusDisplay, 100);
          }
        }
        
        // Clear annotation storage for this image
        await clearAnnotationsForImage(image.id);
        
        deletedCount++;
        updateProgressInfo(`已清除 ${deletedCount}/${allImages.length} 个图像...`);
      } catch (error) {
        console.error(`Failed to clear image ${image.id}:`, error);
        errors.push(`${image.id}: ${error.message}`);
      }
    }
    
    // Update thumbnails
    if (window.refreshThumbnailAnnotationStatus) {
      for (const image of allImages) {
        await window.refreshThumbnailAnnotationStatus(image.id);
      }
    }
    
    return {
      success: true,
      statistics: {
        totalFilesDeleted: deletedCount,
        totalFilesProcessed: allImages.length,
        annotationFilesDeleted: deletedCount,
        relatedFilesDeleted: 0,
        backupPath: 'N/A (in-memory operation)',
        errors: errors
      }
    };
    
  } catch (error) {
    console.error('Spreading deletion failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔧 NEW: Execute current image only deletion
 */
async function executeCurrentImageDeletion(plantId) {
  if (!appState.currentImage) {
    throw new Error('No current image selected');
  }
  
  try {
    await clearAnnotationsForImage(appState.currentImage.id);
    
    // Update thumbnail
    if (window.refreshThumbnailAnnotationStatus) {
      await window.refreshThumbnailAnnotationStatus(appState.currentImage.id);
    }
    
    // Clear from annotation tool
    if (annotationTool) {
      annotationTool.clearKeypoints();
    }
    
    return {
      success: true,
      statistics: {
        totalFilesDeleted: 1,
        totalFilesProcessed: 1,
        annotationFilesDeleted: 1,
        relatedFilesDeleted: 0,
        backupPath: 'N/A (single image operation)'
      }
    };
    
  } catch (error) {
    console.error('Current image deletion failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔧 NEW: Create success message based on deletion scope
 */
function createSuccessMessage(plantId, deletionScope, stats) {
  let message = `植物 ${plantId} 的标注数据删除完成\n\n`;
  
  switch (deletionScope) {
    case 'plant-all':
      message += `删除文件: ${stats.totalFilesDeleted}/${stats.totalFilesProcessed}\n`;
      message += `标注文件: ${stats.annotationFilesDeleted}\n`;
      message += `相关文件: ${stats.relatedFilesDeleted}\n`;
      if (stats.backupPath) {
        message += `备份已创建: ${stats.backupPath}`;
      }
      break;
      
    case 'current-and-future':
      message += `传播删除完成\n`;
      message += `处理图像: ${stats.totalFilesDeleted}/${stats.totalFilesProcessed}\n`;
      if (stats.errors && stats.errors.length > 0) {
        message += `错误: ${stats.errors.length} 个图像删除失败`;
      }
      break;
      
    case 'current-only':
      message += `当前图像标注已清除\n`;
      message += `图像ID: ${appState.currentImage?.id || 'unknown'}`;
      break;
  }
  
  return message;
}

/**
 * 🔧 NEW: Handle post-deletion UI updates based on scope
 */
async function handlePostDeletionUpdates(plantId, deletionScope) {
  switch (deletionScope) {
    case 'plant-all':
      // Clear current workspace if this was the current plant
      if (appState.currentPlant && appState.currentPlant.id === plantId) {
        initializeEmptyWorkspace();
        
        // Update plant status in the list
        const plant = appState.plants.find(p => p.id === plantId);
        if (plant) {
          plant.status = 'pending'; // Reset to pending after deletion
          
          // Re-render the plant list item
          const plantItem = document.querySelector(`[data-plant-id="${plantId}"]`);
          if (plantItem) {
            const newItem = createPlantListItem(plant);
            plantItem.parentNode.replaceChild(newItem, plantItem);
          }
        }
      }
      break;
      
    case 'current-and-future':
    case 'current-only':
      // Update annotation status display
      if (typeof updateAnnotationStatusDisplay === 'function') {
        await updateAnnotationStatusDisplay();
      }
      break;
  }
  
  // Update statistics for all deletion scopes
  if (typeof updateProgressStats === 'function') {
    updateProgressStats();
  }
  
  // Refresh note badges (since annotations are deleted, notes might be affected)
  if (window.PlantAnnotationTool?.noteUI) {
    await window.PlantAnnotationTool.noteUI.updateAllPlantNoteBadges();
  }
}

/**
 * 🔧 NEW: Update complete plant button state based on current plant selection
 */
function updateCompletePlantButtonState() {
  const completeButton = document.getElementById('complete-plant-btn');
  if (!completeButton) return;
  
  if (appState.currentPlant) {
    const plant = appState.currentPlant;
    
    if (plant.status === 'completed') {
      // Show as uncomplete button
      completeButton.textContent = 'Uncomplete Plant';
      completeButton.className = 'btn btn-warning';
      completeButton.title = `撤销完成植株 ${plant.id}`;
      completeButton.disabled = false;
    } else if (plant.status === 'skipped') {
      // Disable for skipped plants
      completeButton.textContent = 'Complete Plant';
      completeButton.className = 'btn btn-success';
      completeButton.title = '无法完成已跳过的植株，请先撤销跳过';
      completeButton.disabled = true;
    } else {
      // Show as complete button (pending/in-progress)
      completeButton.textContent = 'Complete Plant';
      completeButton.className = 'btn btn-success';
      completeButton.title = `标记植株 ${plant.id} 为完成`;
      completeButton.disabled = false;
    }
  } else {
    // No plant selected
    completeButton.textContent = 'Complete Plant';
    completeButton.className = 'btn btn-success';
    completeButton.title = '请先选择植物';
    completeButton.disabled = true;
  }
}

/**
 * Update delete button state based on current plant selection
 */
function updateDeletePlantAnnotationsButtonState() {
  const deleteButton = document.getElementById('delete-plant-annotations-btn');
  if (!deleteButton) return;
  
  if (appState.currentPlant) {
    deleteButton.disabled = false;
    deleteButton.title = `删除植物 ${appState.currentPlant.id} 的所有标注数据`;
  } else {
    deleteButton.disabled = true;
    deleteButton.title = '请先选择植物';
  }
}

// 将删除按钮状态更新函数暴露到全局，供其他模块调用
window.updateDeletePlantAnnotationsButtonState = updateDeletePlantAnnotationsButtonState;

/**
 * 🔧 SIMPLIFIED: Handle clear all annotations - simple current image only
 */
async function handleClearAllAnnotations() {
  if (!annotationTool) {
    showError('清除失败', '标注工具未初始化');
    return;
  }
  
  const currentAnnotations = annotationTool.getAnnotationData();
  if (currentAnnotations.keypoints.length === 0) {
    showError('清除失败', '当前图像没有标注点');
    return;
  }
  
  // Simple confirmation dialog without spreading options
  const message = `确定要清除当前图像的 ${currentAnnotations.keypoints.length} 个标注点吗？`;
  
  if (confirm(message)) {
    // Clear current image only
    annotationTool.clearKeypoints();
    updateProgressInfo('已清除当前图像的标注');
    
    // Update thumbnail status
    if (window.refreshThumbnailAnnotationStatus && appState.currentImage) {
      await window.refreshThumbnailAnnotationStatus(appState.currentImage.id);
    }
    
    // Update annotation status display
    if (typeof updateAnnotationStatusDisplay === 'function') {
      updateAnnotationStatusDisplay();
    }
  }
}

/**
 * 🔧 REMOVED: Handle spreading clear (Shift+Click) 
 * This functionality has been moved to delete-plant-annotations-btn
 * to avoid duplication and user confusion.
 */
// async function handleSpreadingClear() { ... } - REMOVED

/**
 * 🔧 NEW: Get future images for clearing (simplified version)
 */
async function getFutureImagesForClearing() {
  if (!appState.currentImage || !appState.currentPlant || !plantDataManager) {
    return [];
  }
  
  try {
    // Get all images for current plant and view angle
    const allImages = await plantDataManager.getPlantImages(
      appState.currentPlant.id, 
      appState.currentPlant.selectedViewAngle
    );
    
    if (!allImages || allImages.length === 0) {
      return [];
    }
    
    // Find current image index
    const currentImageIndex = allImages.findIndex(img => img.id === appState.currentImage.id);
    if (currentImageIndex === -1) {
      return [];
    }
    
    // Get current image date for comparison
    const currentImage = allImages[currentImageIndex];
    const currentDate = new Date(currentImage.dateTime);
    
    // Filter future images (images with later dates)
    const futureImages = allImages.filter(img => {
      const imgDate = new Date(img.dateTime);
      return imgDate > currentDate;
    });
    
    // Sort by date
    futureImages.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    return futureImages;
    
  } catch (error) {
    console.error('Failed to get future images:', error);
    return [];
  }
}

/**
 * 🔧 NEW: Clear annotations for a specific image
 */
async function clearAnnotationsForImage(imageId) {
  if (!plantDataManager) {
    throw new Error('PlantDataManager not available');
  }
  
  try {
    // Save empty annotations (effectively clearing them)
    await plantDataManager.saveImageAnnotations(imageId, []);
    console.log(`Cleared annotations for image: ${imageId}`);
  } catch (error) {
    console.error(`Failed to clear annotations for image ${imageId}:`, error);
    throw error;
  }
}

/**
 * 🔧 NEW: Perform clear operation with optional spreading
 */
async function performClearOperation(options) {
  if (!annotationTool || !appState.currentImage || !appState.currentPlant) {
    showError('清除失败', '应用状态无效');
    return;
  }
  
  const { clearScope, clearAllPoints, clearAnnotationsOnly } = options;
  
  try {
    // Always clear current image first
    console.log('Clearing annotations for current image:', appState.currentImage.id);
    
    if (clearAllPoints) {
      annotationTool.clearKeypoints();
    } else if (clearAnnotationsOnly) {
      // Clear only annotations but preserve UI state
      annotationTool.clearKeypointsWithoutSave();
    }
    
    let processedImages = 1; // Current image
    let affectedImages = [appState.currentImage.id];
    
    // If spreading deletion is requested
    if (clearScope === 'current-and-future' && annotationSpreadingManager) {
      // Show progress modal
      const progressModalId = spreadingModalManager.showSpreadProgress({
        operationId: `clear-spread-${Date.now()}`,
        totalImages: 0, // Will be updated
        onCancel: () => {
          console.log('User cancelled clear spreading operation');
        }
      });
      
      try {
        // Get future images
        const futureImages = await annotationSpreadingManager.getFutureImages(
          appState.currentImage.id,
          appState.currentPlant.id,
          appState.currentPlant.selectedViewAngle
        );
        
        if (futureImages.length > 0) {
          // Update progress modal with actual count
          spreadingModalManager.updateSpreadProgress(progressModalId, {
            completed: 1,
            total: futureImages.length + 1,
            status: 'Clearing future images...'
          });
          
          // Perform spreading deletion
          const result = await annotationSpreadingManager.spreadDeletionToFuture(
            appState.currentImage.id,
            appState.currentPlant.id,
            appState.currentPlant.selectedViewAngle,
            {
              clearAllPoints,
              clearAnnotationsOnly,
              batchSize: spreadingConfigManager?.getConfigValue('spreadBehavior.batchSize') || 10,
              onProgress: (progress) => {
                spreadingModalManager.updateSpreadProgress(progressModalId, {
                  ...progress,
                  completed: progress.completed + 1, // +1 for current image already processed
                  total: futureImages.length + 1
                });
              }
            }
          );
          
          processedImages += result.processedImages || 0;
          affectedImages = affectedImages.concat(result.affectedImages || []);
        }
        
        // Close progress modal
        spreadingModalManager.closeModal(progressModalId);
        
      } catch (error) {
        console.error('Spreading deletion failed:', error);
        spreadingModalManager.closeModal(progressModalId);
        spreadingModalManager.showError(
          'Spreading Deletion Failed',
          `Failed to clear annotations from future images: ${error.message}`
        );
      }
    }
    
    // Show success message
    const message = clearScope === 'current-and-future' 
      ? `成功清除 ${processedImages} 个图像的标注`
      : '成功清除当前图像的标注';
    
    updateProgressInfo(message);
    
    // Refresh thumbnails for affected images
    if (affectedImages.length > 0) {
      for (const imageId of affectedImages) {
        await refreshThumbnailAnnotationStatus(imageId);
      }
    }
    
    // Update statistics
    updateProgressStats();
    
    // Update annotation status display
    updateAnnotationStatusDisplay();
    
    console.log(`Clear operation completed. Processed ${processedImages} images.`);
    
    // Show success modal for spreading operations
    if (clearScope === 'current-and-future' && processedImages > 1) {
      spreadingModalManager.showSuccess(
        'Clear Complete',
        `Successfully cleared annotations from ${processedImages} images in the time series.`
      );
    }
    
  } catch (error) {
    console.error('Clear operation failed:', error);
    showError('清除失败', `清除标注时出错: ${error.message}`);
  }
}