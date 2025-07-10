/**
 * 笔记管理器
 * 
 * 功能：
 * - 管理植物级和图像级笔记
 * - 与HttpFileSystemManager集成
 * - 独立于跳过功能的笔记系统
 * - 支持搜索、过滤和统计
 */

export class NoteManager {
  constructor(httpFileSystemManager) {
    this.httpManager = httpFileSystemManager;
    this.notes = new Map(); // 笔记缓存
    this.cacheTimestamps = new Map(); // 缓存时间戳
    this.isInitialized = false;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟缓存过期
    this.requestQueue = new Map(); // 请求队列防止重复请求
    this.noteCounts = new Map(); // 笔记数量缓存
  }

  /**
   * 初始化笔记管理器
   */
  async initialize() {
    try {
      await this.httpManager.ensureConnection();
      this.isInitialized = true;
      console.log('NoteManager 初始化成功');
      return true;
    } catch (error) {
      console.error('NoteManager 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保连接可用
   */
  async ensureConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    await this.httpManager.ensureConnection();
  }

  /**
   * 添加植物笔记
   */
  async addPlantNote(plantId, noteData) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }
    if (!noteData.title || !noteData.content) {
      throw new Error('笔记标题和内容不能为空');
    }

    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/plant/${encodeURIComponent(plantId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // 更新缓存
        this.invalidateCache(plantId);
        console.log(`植物笔记创建成功: ${result.data.noteId}`);
        return result.data.noteId;
      }

      throw new Error(result.error || '创建植物笔记失败');
    }, `创建植物 ${plantId} 笔记`);
  }

  /**
   * 添加图像笔记
   */
  async addImageNote(plantId, imageId, noteData) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }
    if (!imageId) {
      throw new Error('图像ID不能为空');
    }
    if (!noteData.title || !noteData.content) {
      throw new Error('笔记标题和内容不能为空');
    }

    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/image/${encodeURIComponent(plantId)}/${encodeURIComponent(imageId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // 更新缓存
        this.invalidateCache(plantId, imageId);
        console.log(`图像笔记创建成功: ${result.data.noteId}`);
        return result.data.noteId;
      }

      throw new Error(result.error || '创建图像笔记失败');
    }, `创建图像 ${imageId} 笔记`);
  }

  /**
   * 获取植物笔记
   */
  async getPlantNotes(plantId) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }

    await this.ensureConnection();

    const cacheKey = `plant_${plantId}`;
    if (this.notes.has(cacheKey)) {
      return this.notes.get(cacheKey);
    }

    return this.httpManager.withRetry(async () => {
      const url = `${this.httpManager.baseUrl}/notes/plant/${encodeURIComponent(plantId)}`;
      console.log(`[NoteManager] 请求植物笔记 URL: ${url}`);
      
      try {
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`[NoteManager] 请求失败: ${response.status} ${response.statusText}`);
          
          // 提供更详细的错误信息
          if (response.status === 404) {
            throw new Error(`植物笔记端点不存在 (404): ${url}`);
          } else if (response.status === 500) {
            throw new Error(`服务器内部错误 (500): 请检查后端服务状态`);
          } else if (response.status === 403) {
            throw new Error(`访问被拒绝 (403): 请检查权限设置`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        const result = await response.json();

        if (result.success) {
          // 缓存结果
          this.notes.set(cacheKey, result.data);
          console.log(`[NoteManager] 成功获取植物 ${plantId} 的 ${result.data.length} 条笔记`);
          return result.data;
        }

        throw new Error(result.error || '获取植物笔记失败');
      } catch (fetchError) {
        // 网络错误处理
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error(`网络连接失败: 无法连接到后端服务 (${url})`);
        }
        throw fetchError;
      }
    }, `获取植物 ${plantId} 笔记`);
  }

  /**
   * 获取图像笔记
   */
  async getImageNotes(plantId, imageId) {
    if (!plantId) {
      throw new Error('植物ID不能为空');
    }
    if (!imageId) {
      throw new Error('图像ID不能为空');
    }

    await this.ensureConnection();

    const cacheKey = `image_${plantId}_${imageId}`;
    if (this.notes.has(cacheKey)) {
      return this.notes.get(cacheKey);
    }

    return this.httpManager.withRetry(async () => {
      const url = `${this.httpManager.baseUrl}/notes/image/${encodeURIComponent(plantId)}/${encodeURIComponent(imageId)}`;
      console.log(`[NoteManager] 请求图像笔记 URL: ${url}`);
      
      try {
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`[NoteManager] 请求失败: ${response.status} ${response.statusText}`);
          
          // 提供更详细的错误信息
          if (response.status === 404) {
            throw new Error(`图像笔记端点不存在 (404): ${url}`);
          } else if (response.status === 500) {
            throw new Error(`服务器内部错误 (500): 请检查后端服务状态`);
          } else if (response.status === 403) {
            throw new Error(`访问被拒绝 (403): 请检查权限设置`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        const result = await response.json();

        if (result.success) {
          // 缓存结果
          this.notes.set(cacheKey, result.data);
          console.log(`[NoteManager] 成功获取图像 ${imageId} 的 ${result.data.length} 条笔记`);
          return result.data;
        }

        throw new Error(result.error || '获取图像笔记失败');
      } catch (fetchError) {
        // 网络错误处理
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error(`网络连接失败: 无法连接到后端服务 (${url})`);
        }
        throw fetchError;
      }
    }, `获取图像 ${imageId} 笔记`);
  }

  /**
   * 更新笔记
   */
  async updateNote(noteId, updates) {
    if (!noteId) {
      throw new Error('笔记ID不能为空');
    }

    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/${encodeURIComponent(noteId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // 清除相关缓存
        this.clearCache();
        console.log(`笔记更新成功: ${noteId}`);
        return result.data;
      }

      throw new Error(result.error || '更新笔记失败');
    }, `更新笔记 ${noteId}`);
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId) {
    if (!noteId) {
      throw new Error('笔记ID不能为空');
    }

    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/${encodeURIComponent(noteId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // 清除相关缓存
        this.clearCache();
        console.log(`笔记删除成功: ${noteId}`);
        return true;
      }

      throw new Error(result.error || '删除笔记失败');
    }, `删除笔记 ${noteId}`);
  }

  /**
   * 获取单个笔记
   */
  async getNote(noteId) {
    if (!noteId) {
      throw new Error('笔记ID不能为空');
    }

    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/${encodeURIComponent(noteId)}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || '获取笔记失败');
    }, `获取笔记 ${noteId}`);
  }

  /**
   * 搜索笔记
   */
  async searchNotes(query, filters = {}) {
    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const searchParams = new URLSearchParams();
      
      if (query) {
        searchParams.append('query', query);
      }
      
      if (filters.plantId) {
        searchParams.append('plantId', filters.plantId);
      }
      
      if (filters.noteType) {
        searchParams.append('noteType', filters.noteType);
      }
      
      if (filters.author) {
        searchParams.append('author', filters.author);
      }

      const response = await fetch(`${this.httpManager.baseUrl}/notes/search?${searchParams}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || '搜索笔记失败');
    }, '搜索笔记');
  }

  /**
   * 获取笔记统计
   */
  async getStats() {
    await this.ensureConnection();

    return this.httpManager.withRetry(async () => {
      const response = await fetch(`${this.httpManager.baseUrl}/notes/stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || '获取笔记统计失败');
    }, '获取笔记统计');
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.notes.clear();
    console.log('笔记缓存已清除');
  }

  /**
   * 使特定缓存失效
   */
  invalidateCache(plantId, imageId = null) {
    const plantKey = `plant_${plantId}`;
    this.notes.delete(plantKey);
    
    if (imageId) {
      const imageKey = `image_${plantId}_${imageId}`;
      this.notes.delete(imageKey);
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      cacheSize: this.notes.size,
      isInitialized: this.isInitialized,
      cacheKeys: Array.from(this.notes.keys())
    };
  }

  /**
   * 验证笔记数据格式
   */
  validateNoteData(noteData) {
    const errors = [];

    if (!noteData.title || noteData.title.trim() === '') {
      errors.push('标题不能为空');
    }

    if (!noteData.content || noteData.content.trim() === '') {
      errors.push('内容不能为空');
    }

    if (noteData.title && noteData.title.length > 100) {
      errors.push('标题长度不能超过100字符');
    }

    if (noteData.content && noteData.content.length > 5000) {
      errors.push('内容长度不能超过5000字符');
    }

    if (noteData.noteType && !['general', 'observation', 'annotation'].includes(noteData.noteType)) {
      errors.push('笔记类型必须是 general、observation 或 annotation');
    }

    if (noteData.tags && !Array.isArray(noteData.tags)) {
      errors.push('标签必须是数组');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 格式化笔记数据用于显示
   */
  formatNoteForDisplay(note) {
    return {
      ...note,
      formattedTimestamp: new Date(note.timestamp).toLocaleString('zh-CN'),
      formattedLastModified: new Date(note.lastModified).toLocaleString('zh-CN'),
      shortContent: note.content.length > 100 ? 
        note.content.substring(0, 100) + '...' : 
        note.content,
      tagsText: note.tags.join(', ')
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.clearCache();
    this.isInitialized = false;
    
    // 清理定时器（如果有）
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    console.log('NoteManager 清理完成');
  }

  /**
   * 启动自动清理
   */
  startAutoCleanup() {
    // 每10分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000);
  }

  /**
   * 检查缓存是否过期
   */
  isCacheExpired(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return true;
    return Date.now() - timestamp > this.cacheExpiration;
  }

  /**
   * 设置缓存
   */
  setCache(key, data) {
    this.notes.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 防重复请求装饰器
   */
  async withRequestDeduplication(key, requestFn) {
    // 如果已有相同请求在进行，返回该请求
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key);
    }

    // 创建新请求
    const requestPromise = requestFn();
    this.requestQueue.set(key, requestPromise);

    try {
      const result = await requestPromise;
      this.requestQueue.delete(key);
      return result;
    } catch (error) {
      this.requestQueue.delete(key);
      throw error;
    }
  }

  /**
   * 获取笔记数量（快速检查）
   */
  async getNoteCount(plantId, imageId = null) {
    const countKey = imageId ? `image_${plantId}_${imageId}` : `plant_${plantId}`;
    
    // 如果有缓存的数量，直接返回
    if (this.noteCounts.has(countKey)) {
      return this.noteCounts.get(countKey);
    }

    // 如果有完整的笔记缓存，计算数量
    const cacheKey = imageId ? `image_${plantId}_${imageId}` : `plant_${plantId}`;
    if (this.notes.has(cacheKey) && !this.isCacheExpired(cacheKey)) {
      const notes = this.notes.get(cacheKey);
      const count = notes.length;
      this.noteCounts.set(countKey, count);
      return count;
    }

    // 异步获取笔记（不阻塞UI）
    this.loadNotesAsync(plantId, imageId);
    return 0; // 返回默认值
  }

  /**
   * 异步加载笔记（后台加载）
   */
  async loadNotesAsync(plantId, imageId = null) {
    try {
      if (imageId) {
        await this.getImageNotes(plantId, imageId);
      } else {
        await this.getPlantNotes(plantId);
      }
    } catch (error) {
      console.warn('后台加载笔记失败:', error);
    }
  }

  /**
   * 预加载笔记（性能优化）
   */
  async preloadNotes(plantId, imageIds = []) {
    const promises = [];
    
    // 预加载植物笔记
    promises.push(this.loadNotesAsync(plantId));
    
    // 预加载图像笔记
    imageIds.forEach(imageId => {
      promises.push(this.loadNotesAsync(plantId, imageId));
    });
    
    try {
      await Promise.allSettled(promises);
      console.log(`预加载完成: 植物 ${plantId} 和 ${imageIds.length} 个图像的笔记`);
    } catch (error) {
      console.warn('预加载笔记失败:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > this.cacheExpiration) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.notes.delete(key);
      this.cacheTimestamps.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存`);
    }
  }
}