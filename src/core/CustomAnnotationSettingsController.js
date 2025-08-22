/**
 * 自定义标注设置窗口控制器
 * 
 * 功能：
 * - 管理自定义标注类型的创建、编辑、删除
 * - 提供模式切换界面
 * - 处理导入导出功能
 * - 与CustomAnnotationManager集成
 */

export class CustomAnnotationSettingsController {
  constructor(customAnnotationManager) {
    this.customAnnotationManager = customAnnotationManager;
    this.modal = null;
    this.currentEditingTypeId = null;
    this.currentTab = 'manage-types';
    
    this.initializeElements();
    this.bindEvents();
    
    console.log('CustomAnnotationSettingsController initialized');
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements() {
    this.modal = document.getElementById('custom-annotation-settings-modal');
    this.closeBtn = document.getElementById('custom-annotation-settings-close');
    
    // Tab elements
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    // Manage Types tab elements
    this.customTypesList = document.getElementById('custom-types-list');
    this.noCustomTypesMessage = document.getElementById('no-custom-types');
    this.addTypeBtn = document.getElementById('add-custom-type-btn');
    this.typeFormSection = document.getElementById('type-form-section');
    this.typeForm = document.getElementById('custom-type-form');
    this.formTitle = document.getElementById('form-title');
    this.formSubmitText = document.getElementById('form-submit-text');
    this.cancelFormBtn = document.getElementById('cancel-form-btn');
    
    // Form inputs
    this.typeNameInput = document.getElementById('type-name');
    this.typeIdInput = document.getElementById('type-id');
    this.typeTypeSelect = document.getElementById('type-type');
    this.typeColorInput = document.getElementById('type-color');
    this.typeColorTextInput = document.getElementById('type-color-text');
    this.typeDescriptionInput = document.getElementById('type-description');
    this.typeCategoryInput = document.getElementById('type-category');
    // Default angle for keypoint types
    this.typeDefaultAngleGroup = document.getElementById('type-default-angle-group');
    this.typeDefaultAngleInput = document.getElementById('type-default-angle');
    this.typeIsDirectionalInput = document.getElementById('type-is-directional');
    this.associateTypeSelect = document.getElementById('associate-type-select');
    
    // Current Mode tab elements
    this.currentModeValue = document.getElementById('current-mode-value');
    this.currentTypeValue = document.getElementById('current-type-value');
    this.switchToNormalBtn = document.getElementById('switch-to-normal-btn');
    this.selectCustomTypeSelect = document.getElementById('select-custom-type');
    this.switchToCustomBtn = document.getElementById('switch-to-custom-btn');
    
    // Export/Import tab elements
    this.exportTypesCount = document.getElementById('export-types-count');
    this.exportAnnotationsCount = document.getElementById('export-annotations-count');
    this.exportCustomDataBtn = document.getElementById('export-custom-data-btn');
    this.selectImportFileBtn = document.getElementById('select-import-file-btn');
    this.importFileInput = document.getElementById('import-file-input');
    this.importFileInfo = document.getElementById('import-file-info');
    this.importFileName = document.getElementById('import-file-name');
    this.importExecuteBtn = document.getElementById('import-execute-btn');
    this.importResults = document.getElementById('import-results');
    this.importResultsContent = document.getElementById('import-results-content');
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // Modal close
    this.closeBtn.addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });
    
    // Tab switching
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        this.switchTab(tabName);
      });
    });
    
    // Manage Types tab events
    this.addTypeBtn.addEventListener('click', () => this.showAddTypeForm());
    this.cancelFormBtn.addEventListener('click', () => this.hideTypeForm());
    this.typeForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    
    // Color input synchronization
    this.typeColorInput.addEventListener('input', () => {
      this.typeColorTextInput.value = this.typeColorInput.value;
    });
    this.typeColorTextInput.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(this.typeColorTextInput.value)) {
        this.typeColorInput.value = this.typeColorTextInput.value;
      }
    });
    
    // Type name to ID auto-generation
    this.typeNameInput.addEventListener('input', () => {
      if (!this.currentEditingTypeId) {
        const id = this.generateIdFromName(this.typeNameInput.value);
        this.typeIdInput.value = id;
      }
    });

    // Populate association options when opening form or list refreshes
    // (called from showAddTypeForm/editCustomType via helper)

    // Show/hide default angle field when type changes
    this.typeTypeSelect.addEventListener('change', () => this.updateAngleVisibility());
    
    // Current Type events: selection-driven, no buttons
    if (this.switchToNormalBtn) {
      this.switchToNormalBtn.style.display = 'none';
    }
    if (this.switchToCustomBtn) {
      this.switchToCustomBtn.style.display = 'none';
    }
    this.selectCustomTypeSelect.addEventListener('change', () => {
      const typeId = this.selectCustomTypeSelect.value;
      if (typeId) {
        this.customAnnotationManager.setCustomAnnotationMode(typeId);
      } else {
        this.customAnnotationManager.setNormalMode();
      }
      this.updateModeDisplay();
    });
    
    // Export/Import tab events
    this.exportCustomDataBtn.addEventListener('click', () => this.exportCustomData());
    this.selectImportFileBtn.addEventListener('click', () => this.importFileInput.click());
    this.importFileInput.addEventListener('change', () => this.handleFileSelection());
    this.importExecuteBtn.addEventListener('click', () => this.executeImport());
    
    // Listen to CustomAnnotationManager events
    this.customAnnotationManager.addEventListener('onModeChange', (data) => {
      this.updateModeDisplay();
    });
  }

  /**
   * 显示设置窗口
   */
  show() {
    this.refreshAllData();
    this.modal.style.display = 'flex';
  }

  /**
   * 隐藏设置窗口
   */
  hide() {
    this.modal.style.display = 'none';
    this.hideTypeForm();
  }

  /**
   * 切换选项卡
   */
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab buttons
    this.tabButtons.forEach(button => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Update tab contents
    this.tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Refresh data for the active tab
    this.refreshTabData(tabName);
  }

  /**
   * 刷新指定选项卡的数据
   */
  refreshTabData(tabName) {
    switch (tabName) {
      case 'manage-types':
        this.refreshCustomTypesList();
        break;
      case 'current-mode':
        this.updateModeDisplay();
        this.refreshCustomTypeSelector();
        break;
      case 'export-import':
        this.updateExportStats();
        break;
    }
  }

  /**
   * 刷新所有数据
   */
  refreshAllData() {
    this.refreshCustomTypesList();
    this.updateModeDisplay();
    this.refreshCustomTypeSelector();
    this.updateExportStats();
  }

  /**
   * 刷新自定义类型列表
   */
  refreshCustomTypesList() {
    const customTypes = this.customAnnotationManager.getAllCustomTypes();
    
    if (customTypes.length === 0) {
      this.customTypesList.innerHTML = `
        <div id="no-custom-types" class="placeholder-message" style="text-align: center; color: #6b7280; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
          <h4 style="margin: 0 0 8px 0;">No Custom Types Created</h4>
          <p style="margin: 0;">Create custom annotation types for special keypoints and regions</p>
        </div>
      `;
    } else {
      const typesList = customTypes.map(type => this.createTypeItemHTML(type)).join('');
      this.customTypesList.innerHTML = typesList;
      
      // Bind action buttons
      this.bindTypeActionButtons();

      // Also refresh associate options if form is visible
      if (this.typeFormSection && this.typeFormSection.style.display !== 'none' && this.associateTypeSelect) {
        this.populateAssociateOptions(this.currentEditingTypeId);
      }
    }
  }

  /**
   * 填充关联类型下拉（排除自身）
   */
  populateAssociateOptions(currentId) {
    if (!this.associateTypeSelect) return;
    const types = this.customAnnotationManager.getAllCustomTypes();
    this.associateTypeSelect.innerHTML = '<option value="">None</option>';
    types.forEach(t => {
      if (t.id === currentId) return;
      const opt = document.createElement('option');
      opt.value = t.id;
      const label = t.type === 'point' ? 'keypoint' : (t.type === 'region' ? 'rectangle' : t.type);
      opt.textContent = `${t.name} (${label})`;
      this.associateTypeSelect.appendChild(opt);
    });
  }

  /**
   * 创建类型项HTML
   */
  createTypeItemHTML(type) {
    const typeLabel = type.type === 'point' ? 'keypoint' : (type.type === 'region' ? 'rectangle' : type.type);
    return `
      <div class="custom-type-item" data-type-id="${type.id}">
        <div class="custom-type-info">
          <div class="type-color-preview" style="background-color: ${type.color};"></div>
          <div class="type-details">
            <div class="type-name">${type.name}</div>
            <div class="type-meta">
              <span class="type-badge ${type.type}">${typeLabel}</span>
              <span>ID: ${type.id}</span>
              ${type.metadata?.category ? `<span>Category: ${type.metadata.category}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="type-actions">
          <button class="type-action-btn edit" data-action="edit" data-type-id="${type.id}">Edit</button>
          <button class="type-action-btn delete" data-action="delete" data-type-id="${type.id}">Delete</button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定类型操作按钮事件
   */
  bindTypeActionButtons() {
    const actionButtons = this.customTypesList.querySelectorAll('.type-action-btn');
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        const typeId = button.dataset.typeId;
        
        if (action === 'edit') {
          this.editCustomType(typeId);
        } else if (action === 'delete') {
          this.deleteCustomType(typeId);
        }
      });
    });
  }

  /**
   * 显示添加类型表单
   */
  showAddTypeForm() {
    this.currentEditingTypeId = null;
    this.formTitle.textContent = 'Add New Type';
    this.formSubmitText.textContent = 'Create Type';
    this.typeForm.reset();
    this.typeColorInput.value = '#ff6b35';
    this.typeColorTextInput.value = '#ff6b35';
    if (this.typeDefaultAngleInput) {
      this.typeDefaultAngleInput.value = '';
    }
    if (this.associateTypeSelect) {
      this.populateAssociateOptions(null);
      this.associateTypeSelect.value = '';
    }
    this.typeFormSection.style.display = 'block';
    this.updateAngleVisibility();
  }

  /**
   * 编辑自定义类型
   */
  editCustomType(typeId) {
    const type = this.customAnnotationManager.getCustomType(typeId);
    if (!type) return;
    
    this.currentEditingTypeId = typeId;
    this.formTitle.textContent = 'Edit Type';
    this.formSubmitText.textContent = 'Update Type';
    
    // Fill form with existing data
    this.typeNameInput.value = type.name;
    this.typeIdInput.value = type.id;
    this.typeTypeSelect.value = type.type;
    this.typeColorInput.value = type.color;
    this.typeColorTextInput.value = type.color;
    this.typeDescriptionInput.value = type.description || '';
    this.typeCategoryInput.value = type.metadata?.category || '';
    if (this.typeDefaultAngleInput) {
      const angle = type.metadata?.defaultAngle;
      this.typeDefaultAngleInput.value = (angle ?? '').toString();
    }
    if (this.typeIsDirectionalInput) {
      this.typeIsDirectionalInput.checked = !!type.metadata?.isDirectional;
    }
    if (this.associateTypeSelect) {
      this.populateAssociateOptions(typeId);
      this.associateTypeSelect.value = type.metadata?.associateTypeId || '';
    }
    
    // Disable ID and geometry fields for editing
    this.typeIdInput.disabled = true;
    this.typeTypeSelect.disabled = true;
    
    this.typeFormSection.style.display = 'block';
    this.updateAngleVisibility();
  }

  /**
   * 删除自定义类型
   */
  deleteCustomType(typeId) {
    const type = this.customAnnotationManager.getCustomType(typeId);
    if (!type) return;
    
    if (confirm(`Are you sure you want to delete the custom type "${type.name}"? This will also delete all annotations of this type.`)) {
      this.customAnnotationManager.deleteCustomType(typeId);
      this.refreshCustomTypesList();
      this.refreshCustomTypeSelector();
    }
  }

  /**
   * 隐藏类型表单
   */
  hideTypeForm() {
    this.typeFormSection.style.display = 'none';
    this.currentEditingTypeId = null;
    this.typeIdInput.disabled = false;
    this.typeTypeSelect.disabled = false;
  }

  /**
   * 处理表单提交
   */
  handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(this.typeForm);
    const typeData = {
      id: formData.get('id'),
      name: formData.get('name'),
      type: formData.get('type'),
      color: formData.get('color'),
      description: formData.get('description'),
      metadata: {
        category: formData.get('category')
      }
    };

    // Directional toggle
    if (this.typeIsDirectionalInput && this.typeIsDirectionalInput.checked) {
      typeData.metadata.isDirectional = true;
    } else {
      typeData.metadata.isDirectional = false;
    }
    // Association selection
    if (this.associateTypeSelect && this.associateTypeSelect.value) {
      typeData.metadata.associateTypeId = this.associateTypeSelect.value;
    } else {
      delete typeData.metadata.associateTypeId;
    }

    // Attach default angle for keypoint types
    if (typeData.type === 'point') {
      const rawAngle = (this.typeDefaultAngleInput?.value || '').trim();
      if (rawAngle !== '') {
        const parsed = parseFloat(rawAngle);
        if (!Number.isNaN(parsed)) {
          typeData.metadata.defaultAngle = parsed;
        }
      }
    }
    
    try {
      if (this.currentEditingTypeId) {
        // Update existing type
        // Do not allow changing geometry type on update
        const { type, ...safeUpdate } = typeData;
        this.customAnnotationManager.updateCustomType(this.currentEditingTypeId, safeUpdate);
      } else {
        // Create new type
        this.customAnnotationManager.createCustomType(typeData);
      }
      
      this.hideTypeForm();
      this.refreshCustomTypesList();
      this.refreshCustomTypeSelector();
      
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * 从名称生成ID
   */
  generateIdFromName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * 更新模式显示
   */
  updateModeDisplay() {
    const currentMode = this.customAnnotationManager.currentMode;
    const selectedType = this.customAnnotationManager.getCurrentCustomType();
    
    this.currentModeValue.textContent = currentMode === 'custom' ? 'Type' : 'Off';
    this.currentTypeValue.textContent = selectedType ? selectedType.name : 'None';
    
    // Update button states
    if (this.switchToNormalBtn) {
      this.switchToNormalBtn.disabled = currentMode === 'normal';
    }
  }

  /**
   * 刷新自定义类型选择器
   */
  refreshCustomTypeSelector() {
    const customTypes = this.customAnnotationManager.getAllCustomTypes();
    
    this.selectCustomTypeSelect.innerHTML = '<option value="">Choose a type...</option>';
    
    customTypes.forEach(type => {
      // 将内置类型放到列表顶部
      const option = document.createElement('option');
      option.value = type.id;
      const typeLabel = type.type === 'point' ? 'keypoint' : (type.type === 'region' ? 'rectangle' : type.type);
      const prefix = type.metadata?.builtin ? '★ ' : '';
      option.textContent = `${prefix}${type.name} (${typeLabel})`;
      this.selectCustomTypeSelect.appendChild(option);
    });

    // 如果列表存在内置类型，将其移到第一项之后
    const options = Array.from(this.selectCustomTypeSelect.options);
    const builtinIdx = options.findIndex(opt => opt.value === 'builtin-regular-keypoint');
    if (builtinIdx > 1) {
      const opt = options[builtinIdx];
      this.selectCustomTypeSelect.remove(builtinIdx);
      this.selectCustomTypeSelect.add(opt, 1);
    }
    
    if (this.switchToCustomBtn) {
      this.switchToCustomBtn.disabled = true;
    }
  }

  /**
   * 切换到正常模式
   */
  switchToNormalMode() {
    this.customAnnotationManager.setNormalMode();
    this.updateModeDisplay();
  }

  /**
   * 切换到自定义模式
   */
  switchToCustomMode() {
    const selectedTypeId = this.selectCustomTypeSelect.value;
    if (!selectedTypeId) return;
    
    try {
      this.customAnnotationManager.setCustomAnnotationMode(selectedTypeId);
      this.updateModeDisplay();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * 根据选择的类型显示/隐藏默认角度字段
   */
  updateAngleVisibility() {
    if (!this.typeDefaultAngleGroup) return;
    const isPoint = this.typeTypeSelect.value === 'point';
    this.typeDefaultAngleGroup.style.display = isPoint ? 'flex' : 'none';
  }

  /**
   * 更新导出统计
   */
  updateExportStats() {
    const customTypes = this.customAnnotationManager.getAllCustomTypes();
    const stats = this.customAnnotationManager.getStats();
    
    this.exportTypesCount.textContent = customTypes.length;
    this.exportAnnotationsCount.textContent = stats.totalAnnotations;
    
    // 🔧 NEW: 添加当前图像的标注统计
    const appState = window.PlantAnnotationTool?.appState;
    const currentImageId = appState?.currentImage?.id;
    
    if (currentImageId) {
      const imageStats = this.customAnnotationManager.getAnnotationStats(currentImageId);
      this.updateCurrentImageStats(imageStats);
    }
  }

  /**
   * 更新当前图像的标注统计显示
   * @param {Object} imageStats - 图像统计信息
   */
  updateCurrentImageStats(imageStats) {
    // 检查是否存在当前图像统计显示区域
    let currentImageStatsDiv = document.getElementById('current-image-stats');
    if (!currentImageStatsDiv) {
      // 创建统计显示区域
      currentImageStatsDiv = document.createElement('div');
      currentImageStatsDiv.id = 'current-image-stats';
      currentImageStatsDiv.style.cssText = `
        margin-top: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      `;
      
      // 将其添加到导出统计后面
      const exportSection = document.querySelector('.export-stats');
      if (exportSection) {
        exportSection.appendChild(currentImageStatsDiv);
      }
    }
    
    // 更新统计内容
    let statsHtml = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">
        📊 Current Image Statistics
      </div>
      <div style="margin-bottom: 8px;">
        Total Annotations: <span style="font-weight: 600;">${imageStats.total}</span>
      </div>
    `;
    
    if (imageStats.total > 0) {
      statsHtml += `
        <div style="margin-bottom: 8px;">
          Order Range: #${imageStats.orderRange.min} - #${imageStats.orderRange.max}
        </div>
      `;
      
      if (imageStats.gaps.length > 0) {
        statsHtml += `
          <div style="margin-bottom: 8px; color: #f59e0b;">
            ⚠️ Missing Numbers: ${imageStats.gaps.join(', ')}
          </div>
        `;
      }
      
      // 按类型统计
      const typeStats = Object.entries(imageStats.byType).map(([typeId, info]) => {
        return `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 12px; height: 12px; background: ${info.typeColor}; border-radius: 50%;"></div>
            <span>${info.typeName}: ${info.count}</span>
          </div>
        `;
      }).join('');
      
      if (typeStats) {
        statsHtml += `
          <div style="margin-top: 12px;">
            <div style="font-weight: 600; margin-bottom: 6px; color: #374151;">By Type:</div>
            ${typeStats}
          </div>
        `;
      }
    }
    
    currentImageStatsDiv.innerHTML = statsHtml;
  }

  /**
   * 导出自定义数据
   */
  exportCustomData() {
    const exportData = this.customAnnotationManager.exportData();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_annotations_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('Custom annotation data exported');
  }

  /**
   * 处理文件选择
   */
  handleFileSelection() {
    const file = this.importFileInput.files[0];
    if (file) {
      this.importFileName.textContent = file.name;
      this.importFileInfo.style.display = 'flex';
      this.importResults.style.display = 'none';
    } else {
      this.importFileInfo.style.display = 'none';
    }
  }

  /**
   * 执行导入
   */
  async executeImport() {
    const file = this.importFileInput.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      const result = this.customAnnotationManager.importData(importData);
      
      if (result.success) {
        this.importResultsContent.innerHTML = `
          <div style="color: #059669;">
            ✅ Import successful!<br>
            Imported ${importData.customTypes?.length || 0} custom types and ${importData.customAnnotations?.length || 0} annotations.
          </div>
        `;
        
        // Refresh all data
        this.refreshAllData();
      } else {
        this.importResultsContent.innerHTML = `
          <div style="color: #dc2626;">
            ❌ Import failed: ${result.error}
          </div>
        `;
      }
      
      this.importResults.style.display = 'block';
      
    } catch (error) {
      this.importResultsContent.innerHTML = `
        <div style="color: #dc2626;">
          ❌ Error reading file: ${error.message}
        </div>
      `;
      this.importResults.style.display = 'block';
    }
  }
}