/**
 * 自定义标注工具栏控制器
 * 
 * 功能：
 * - 管理工具栏中的自定义标注控件
 * - 提供快速模式切换功能
 * - 显示当前模式和类型状态
 * - 与CustomAnnotationManager集成
 */

export class CustomAnnotationToolbarController {
  constructor(customAnnotationManager, settingsController) {
    this.customAnnotationManager = customAnnotationManager;
    this.settingsController = settingsController;
    
    this.initializeElements();
    this.bindEvents();
    this.updateDisplay();
    
    console.log('CustomAnnotationToolbarController initialized');
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements() {
    // Mode status indicators
    this.customModeIndicator = document.getElementById('custom-mode-indicator');
    this.customTypeIndicator = document.getElementById('custom-type-indicator');
    
    // Controls
    this.toolbarCustomTypeSelect = document.getElementById('toolbar-custom-type-select');
    this.switchCustomModeBtn = document.getElementById('switch-custom-mode-btn');
    this.normalModeBtn = document.getElementById('normal-mode-btn');
    this.customSettingsBtn = document.getElementById('custom-settings-btn');
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // Custom type selector
    this.toolbarCustomTypeSelect.addEventListener('change', () => {
      this.onCustomTypeSelected();
    });
    
    // Mode switch buttons
    this.switchCustomModeBtn.addEventListener('click', () => {
      this.switchToCustomMode();
    });
    
    this.normalModeBtn.addEventListener('click', () => {
      this.switchToNormalMode();
    });
    
    // Settings button
    this.customSettingsBtn.addEventListener('click', () => {
      this.openSettings();
    });
    
    // Listen to CustomAnnotationManager events
    this.customAnnotationManager.addEventListener('onModeChange', () => {
      this.updateDisplay();
    });
    
    // Listen to type creation/deletion events
    this.customAnnotationManager.addEventListener('onTypeCreate', (data) => {
      console.log('Toolbar controller received onTypeCreate event:', data);
      this.refreshCustomTypeSelector();
    });
    
    this.customAnnotationManager.addEventListener('onTypeUpdate', (data) => {
      console.log('Toolbar controller received onTypeUpdate event:', data);
      this.refreshCustomTypeSelector();
    });
    
    this.customAnnotationManager.addEventListener('onTypeDelete', (data) => {
      console.log('Toolbar controller received onTypeDelete event:', data);
      this.refreshCustomTypeSelector();
    });
  }

  /**
   * 刷新自定义类型选择器
   */
  refreshCustomTypeSelector() {
    console.log('Refreshing custom type selector...');
    
    const customTypes = this.customAnnotationManager.getAllCustomTypes();
    console.log('Retrieved custom types:', customTypes);
    
    const currentSelection = this.toolbarCustomTypeSelect.value;
    
    // Clear existing options
    this.toolbarCustomTypeSelect.innerHTML = '<option value="">Select custom type...</option>';
    
    // Add custom types
    customTypes.forEach(type => {
      console.log('Adding type to selector:', type);
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = `${type.name} (${type.type})`;
      option.style.color = type.color;
      this.toolbarCustomTypeSelect.appendChild(option);
    });
    
    // Restore selection if still valid
    if (currentSelection && customTypes.find(t => t.id === currentSelection)) {
      this.toolbarCustomTypeSelect.value = currentSelection;
    }
    
    console.log('Custom type selector updated. Total options:', this.toolbarCustomTypeSelect.options.length);
    
    this.updateButtonStates();
  }

  /**
   * 处理自定义类型选择
   */
  onCustomTypeSelected() {
    this.updateButtonStates();
  }

  /**
   * 切换到自定义模式
   */
  switchToCustomMode() {
    const selectedTypeId = this.toolbarCustomTypeSelect.value;
    if (!selectedTypeId) {
      alert('Please select a custom type first.');
      return;
    }
    
    try {
      this.customAnnotationManager.setCustomAnnotationMode(selectedTypeId);
      this.updateDisplay();
      this.showModeChangeNotification('custom', selectedTypeId);
    } catch (error) {
      alert(`Error switching to custom mode: ${error.message}`);
    }
  }

  /**
   * 切换到正常模式
   */
  switchToNormalMode() {
    this.customAnnotationManager.setNormalMode();
    this.updateDisplay();
    this.showModeChangeNotification('normal');
  }

  /**
   * 打开设置窗口
   */
  openSettings() {
    this.settingsController.show();
  }

  /**
   * 更新显示状态
   */
  updateDisplay() {
    this.updateModeIndicators();
    this.updateButtonStates();
  }

  /**
   * 更新模式指示器
   */
  updateModeIndicators() {
    const currentMode = this.customAnnotationManager.currentMode;
    const selectedType = this.customAnnotationManager.getCurrentCustomType();
    
    // Update mode indicator
    if (currentMode === 'custom') {
      this.customModeIndicator.textContent = 'Custom';
      this.customModeIndicator.style.color = '#059669';
      this.customModeIndicator.style.fontWeight = '600';
    } else {
      this.customModeIndicator.textContent = 'Normal';
      this.customModeIndicator.style.color = 'var(--text-primary)';
      this.customModeIndicator.style.fontWeight = '500';
    }
    
    // Update type indicator
    if (selectedType) {
      this.customTypeIndicator.textContent = selectedType.name;
      this.customTypeIndicator.style.color = selectedType.color;
      this.customTypeIndicator.style.fontWeight = '600';
      
      // Add type badge
      const typeBadge = selectedType.type === 'point' ? '●' : '▭';
      this.customTypeIndicator.textContent = `${typeBadge} ${selectedType.name}`;
    } else {
      this.customTypeIndicator.textContent = 'None';
      this.customTypeIndicator.style.color = 'var(--text-secondary)';
      this.customTypeIndicator.style.fontWeight = '500';
    }
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates() {
    const currentMode = this.customAnnotationManager.currentMode;
    const selectedTypeId = this.toolbarCustomTypeSelect.value;
    const hasCustomTypes = this.customAnnotationManager.getAllCustomTypes().length > 0;
    
    // Update switch to custom button
    this.switchCustomModeBtn.disabled = !selectedTypeId || currentMode === 'custom';
    
    // Update normal mode button
    this.normalModeBtn.disabled = currentMode === 'normal';
    
    // Update custom type selector
    this.toolbarCustomTypeSelect.disabled = currentMode === 'custom';
    
    // Update button text based on state
    if (currentMode === 'custom') {
      this.switchCustomModeBtn.textContent = 'Using Custom';
      this.normalModeBtn.textContent = 'Exit Custom';
    } else {
      this.switchCustomModeBtn.textContent = 'Use Custom';
      this.normalModeBtn.textContent = 'Normal Mode';
    }
    
    // Show/hide controls based on availability
    if (!hasCustomTypes) {
      this.toolbarCustomTypeSelect.style.display = 'none';
      this.switchCustomModeBtn.style.display = 'none';
      this.normalModeBtn.style.display = 'none';
      
      // Show message to create types
      this.showNoTypesMessage();
    } else {
      this.toolbarCustomTypeSelect.style.display = 'block';
      this.switchCustomModeBtn.style.display = 'block';
      this.normalModeBtn.style.display = 'block';
      this.hideNoTypesMessage();
    }
  }

  /**
   * 显示无类型消息
   */
  showNoTypesMessage() {
    let message = document.getElementById('no-custom-types-message');
    if (!message) {
      message = document.createElement('div');
      message.id = 'no-custom-types-message';
      message.style.cssText = `
        padding: 8px;
        background: var(--bg-secondary);
        border: 1px dashed var(--border-color);
        border-radius: 4px;
        text-align: center;
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-bottom: 10px;
      `;
      message.innerHTML = `
        <div style="margin-bottom: 4px;">No custom types created</div>
        <div style="font-size: 0.7rem;">Click Settings to create types</div>
      `;
      
      this.toolbarCustomTypeSelect.parentNode.appendChild(message);
    }
    message.style.display = 'block';
  }

  /**
   * 隐藏无类型消息
   */
  hideNoTypesMessage() {
    const message = document.getElementById('no-custom-types-message');
    if (message) {
      message.style.display = 'none';
    }
  }

  /**
   * 显示模式切换通知
   */
  showModeChangeNotification(mode, typeId = null) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      font-size: 0.875rem;
      max-width: 300px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    if (mode === 'custom') {
      const customType = this.customAnnotationManager.getCustomType(typeId);
      const typeIcon = customType.type === 'point' ? '●' : '▭';
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="color: #059669; font-size: 1.2em;">🎯</span>
          <strong style="color: #059669;">Custom Mode Active</strong>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.8rem;">
          Type: <span style="color: ${customType.color}; font-weight: 600;">${typeIcon} ${customType.name}</span>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">
          ${customType.type === 'point' ? 'Click to place points' : 'Drag to draw regions'}
        </div>
      `;
    } else {
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-primary); font-size: 1.2em;">⚪</span>
          <strong style="color: var(--text-primary);">Normal Mode</strong>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.8rem;">
          Standard keypoint annotation
        </div>
      `;
    }
    
    // Add animation styles if not already present
    if (!document.getElementById('notification-animation-style')) {
      const style = document.createElement('style');
      style.id = 'notification-animation-style';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  /**
   * 初始化工具栏（在应用启动时调用）
   */
  initialize() {
    console.log('Initializing custom annotation toolbar controller...');
    this.refreshCustomTypeSelector();
    this.updateDisplay();
  }

  /**
   * 强制刷新工具栏状态（用于调试或手动同步）
   */
  forceRefresh() {
    console.log('Force refreshing toolbar controller...');
    this.refreshCustomTypeSelector();
    this.updateDisplay();
  }

  /**
   * 获取当前选中的自定义类型ID
   */
  getSelectedCustomTypeId() {
    return this.toolbarCustomTypeSelect.value;
  }

  /**
   * 设置选中的自定义类型
   */
  setSelectedCustomType(typeId) {
    this.toolbarCustomTypeSelect.value = typeId;
    this.updateButtonStates();
  }

  /**
   * 检查是否有可用的自定义类型
   */
  hasCustomTypes() {
    return this.customAnnotationManager.getAllCustomTypes().length > 0;
  }

  /**
   * 获取工具栏状态摘要
   */
  getStatusSummary() {
    const currentMode = this.customAnnotationManager.currentMode;
    const selectedType = this.customAnnotationManager.getCurrentCustomType();
    const totalTypes = this.customAnnotationManager.getAllCustomTypes().length;
    
    return {
      mode: currentMode,
      selectedType: selectedType ? {
        id: selectedType.id,
        name: selectedType.name,
        type: selectedType.type,
        color: selectedType.color
      } : null,
      totalCustomTypes: totalTypes,
      hasCustomTypes: totalTypes > 0
    };
  }
}