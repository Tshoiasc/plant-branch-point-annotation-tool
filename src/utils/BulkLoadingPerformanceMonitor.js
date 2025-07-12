/**
 * Bulk Loading Performance Monitor
 * 
 * 功能：
 * - 监控批量加载性能
 * - 跟踪缓存效果
 * - 性能指标收集和报告
 * - 自动优化建议
 */

export class BulkLoadingPerformanceMonitor {
  constructor() {
    this.metrics = {
      // 加载性能
      loadingStartTime: null,
      loadingEndTime: null,
      totalLoadingTime: 0,
      
      // 数据统计
      plantsLoaded: 0,
      annotationsLoaded: 0,
      notesLoaded: 0,
      
      // 网络性能
      networkRequests: 0,
      bulkRequests: 0,
      individualRequests: 0,
      totalDataTransferred: 0,
      
      // 缓存性能
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0,
      
      // 错误统计
      errors: [],
      fallbacksUsed: 0,
      
      // 用户体验
      timeToFirstInteraction: 0,
      timeToFullyLoaded: 0
    };
    
    this.isMonitoring = false;
    this.startTime = null;
    this.checkpoints = [];
  }

  /**
   * 开始监控加载过程
   */
  startMonitoring() {
    this.isMonitoring = true;
    this.startTime = performance.now();
    this.metrics.loadingStartTime = Date.now();
    this.checkpoints = [];
    
    console.log('[性能监控] 开始监控批量加载过程');
  }

  /**
   * 添加检查点
   */
  addCheckpoint(name, details = {}) {
    if (!this.isMonitoring) return;
    
    const checkpoint = {
      name,
      timestamp: performance.now(),
      relativeTime: performance.now() - this.startTime,
      details
    };
    
    this.checkpoints.push(checkpoint);
    console.log(`[性能监控] ${name}: ${checkpoint.relativeTime.toFixed(2)}ms`, details);
  }

  /**
   * 记录数据加载完成
   */
  recordDataLoaded(type, count, dataSize = 0) {
    switch (type) {
      case 'plants':
        this.metrics.plantsLoaded = count;
        break;
      case 'annotations':
        this.metrics.annotationsLoaded = count;
        break;
      case 'notes':
        this.metrics.notesLoaded = count;
        break;
    }
    
    this.metrics.totalDataTransferred += dataSize;
    this.addCheckpoint(`${type} 数据加载完成`, { count, dataSize: `${(dataSize / 1024).toFixed(2)}KB` });
  }

  /**
   * 记录网络请求
   */
  recordNetworkRequest(type, isBulk = false) {
    this.metrics.networkRequests++;
    
    if (isBulk) {
      this.metrics.bulkRequests++;
    } else {
      this.metrics.individualRequests++;
    }
    
    this.addCheckpoint(`网络请求: ${type}`, { isBulk, total: this.metrics.networkRequests });
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(type, cacheSize = 0) {
    this.metrics.cacheHits++;
    this.metrics.cacheSize = cacheSize;
    
    console.log(`[缓存命中] ${type} - 总命中: ${this.metrics.cacheHits}`);
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(type) {
    this.metrics.cacheMisses++;
    
    console.log(`[缓存未命中] ${type} - 总未命中: ${this.metrics.cacheMisses}`);
  }

  /**
   * 记录错误
   */
  recordError(error, context = '') {
    this.metrics.errors.push({
      error: error.message,
      context,
      timestamp: Date.now()
    });
    
    console.error(`[性能监控] 错误记录: ${context}`, error);
  }

  /**
   * 记录回退使用
   */
  recordFallback(reason) {
    this.metrics.fallbacksUsed++;
    
    this.addCheckpoint('使用回退方案', { reason, totalFallbacks: this.metrics.fallbacksUsed });
  }

  /**
   * 结束监控并生成报告
   */
  endMonitoring() {
    if (!this.isMonitoring) return null;
    
    this.isMonitoring = false;
    this.metrics.loadingEndTime = Date.now();
    this.metrics.totalLoadingTime = performance.now() - this.startTime;
    
    const report = this.generatePerformanceReport();
    console.log('[性能监控] 加载完成，生成性能报告:', report);
    
    return report;
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport() {
    const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0 
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(1)
      : 0;

    const bulkRequestRatio = this.metrics.networkRequests > 0
      ? (this.metrics.bulkRequests / this.metrics.networkRequests * 100).toFixed(1)
      : 0;

    const report = {
      // 总体性能
      summary: {
        totalLoadingTime: `${this.metrics.totalLoadingTime.toFixed(2)}ms`,
        dataLoaded: {
          plants: this.metrics.plantsLoaded,
          annotations: this.metrics.annotationsLoaded,
          notes: this.metrics.notesLoaded
        },
        networkRequests: this.metrics.networkRequests,
        dataTransferred: `${(this.metrics.totalDataTransferred / 1024).toFixed(2)}KB`
      },
      
      // 网络性能
      networkPerformance: {
        totalRequests: this.metrics.networkRequests,
        bulkRequests: this.metrics.bulkRequests,
        individualRequests: this.metrics.individualRequests,
        bulkRequestRatio: `${bulkRequestRatio}%`,
        averageRequestSize: this.metrics.networkRequests > 0 
          ? `${(this.metrics.totalDataTransferred / this.metrics.networkRequests / 1024).toFixed(2)}KB`
          : '0KB'
      },
      
      // 缓存性能
      cachePerformance: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: `${cacheHitRate}%`,
        cacheSize: `${(this.metrics.cacheSize / 1024).toFixed(2)}KB`
      },
      
      // 错误和回退
      reliability: {
        errors: this.metrics.errors.length,
        fallbacksUsed: this.metrics.fallbacksUsed,
        errorDetails: this.metrics.errors
      },
      
      // 检查点时间线
      timeline: this.checkpoints,
      
      // 性能评级
      performanceGrade: this.calculatePerformanceGrade(),
      
      // 优化建议
      optimizationSuggestions: this.generateOptimizationSuggestions()
    };

    return report;
  }

  /**
   * 计算性能评级
   */
  calculatePerformanceGrade() {
    let score = 100;
    
    // 加载时间评分
    if (this.metrics.totalLoadingTime > 5000) {
      score -= 30; // 超过5秒扣30分
    } else if (this.metrics.totalLoadingTime > 2000) {
      score -= 15; // 超过2秒扣15分
    } else if (this.metrics.totalLoadingTime > 1000) {
      score -= 5; // 超过1秒扣5分
    }
    
    // 网络请求评分
    const requestEfficiency = this.metrics.bulkRequests / (this.metrics.networkRequests || 1);
    if (requestEfficiency < 0.5) {
      score -= 20; // 批量请求比例低于50%扣20分
    } else if (requestEfficiency < 0.8) {
      score -= 10; // 批量请求比例低于80%扣10分
    }
    
    // 缓存效率评分
    const cacheHitRate = this.metrics.cacheHits / ((this.metrics.cacheHits + this.metrics.cacheMisses) || 1);
    if (cacheHitRate < 0.6) {
      score -= 15; // 缓存命中率低于60%扣15分
    } else if (cacheHitRate < 0.8) {
      score -= 8; // 缓存命中率低于80%扣8分
    }
    
    // 错误和回退评分
    score -= this.metrics.errors.length * 5; // 每个错误扣5分
    score -= this.metrics.fallbacksUsed * 3; // 每次回退扣3分
    
    // 确保分数在0-100之间
    score = Math.max(0, Math.min(100, score));
    
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions() {
    const suggestions = [];
    
    // 加载时间建议
    if (this.metrics.totalLoadingTime > 2000) {
      suggestions.push({
        category: '加载性能',
        suggestion: '考虑实现数据分页或增量加载',
        priority: 'high',
        impact: '减少初始加载时间50%+'
      });
    }
    
    // 网络请求建议
    const bulkRatio = this.metrics.bulkRequests / (this.metrics.networkRequests || 1);
    if (bulkRatio < 0.8) {
      suggestions.push({
        category: '网络优化',
        suggestion: '增加批量API的使用，减少单独请求',
        priority: 'high',
        impact: '减少网络请求80%+'
      });
    }
    
    // 缓存建议
    const cacheHitRate = this.metrics.cacheHits / ((this.metrics.cacheHits + this.metrics.cacheMisses) || 1);
    if (cacheHitRate < 0.7) {
      suggestions.push({
        category: '缓存优化',
        suggestion: '优化缓存策略，增加缓存时间或改进缓存键设计',
        priority: 'medium',
        impact: '提高响应速度30%+'
      });
    }
    
    // 错误处理建议
    if (this.metrics.errors.length > 0) {
      suggestions.push({
        category: '错误处理',
        suggestion: '改进错误处理和重试机制',
        priority: 'medium',
        impact: '提高系统稳定性'
      });
    }
    
    // 回退建议
    if (this.metrics.fallbacksUsed > 0) {
      suggestions.push({
        category: '兼容性',
        suggestion: '确保批量API的可用性，减少回退方案的使用',
        priority: 'low',
        impact: '提高性能一致性'
      });
    }
    
    return suggestions;
  }

  /**
   * 导出性能数据
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      report: this.generatePerformanceReport(),
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 重置所有指标
   */
  reset() {
    this.metrics = {
      loadingStartTime: null,
      loadingEndTime: null,
      totalLoadingTime: 0,
      plantsLoaded: 0,
      annotationsLoaded: 0,
      notesLoaded: 0,
      networkRequests: 0,
      bulkRequests: 0,
      individualRequests: 0,
      totalDataTransferred: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0,
      errors: [],
      fallbacksUsed: 0,
      timeToFirstInteraction: 0,
      timeToFullyLoaded: 0
    };
    
    this.isMonitoring = false;
    this.startTime = null;
    this.checkpoints = [];
    
    console.log('[性能监控] 指标已重置');
  }
}