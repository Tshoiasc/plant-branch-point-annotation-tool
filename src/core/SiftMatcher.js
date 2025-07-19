/**
 * SIFT 图像匹配算法
 * 
 * 基于JavaScript的SIFT特征匹配实现，用于标注点精确匹配
 * 支持SIFT特征检测、模板匹配和自适应匹配策略
 */

export class SiftMatcher {
  constructor() {
    this.searchConfigs = [
      { boxSize: 30, searchRadius: 40 },
      { boxSize: 40, searchRadius: 60 },
      { boxSize: 50, searchRadius: 80 },
      { boxSize: 60, searchRadius: 100 }
    ];
    
    this.qualityThreshold = 0.7;
    this.ratioThreshold = 0.7;
    this.minMatches = 3;
  }

  /**
   * 校准标注点位置
   * @param {Array} referenceAnnotations - 基准标注点
   * @param {Array} targetAnnotations - 目标标注点
   * @param {ImageData} referenceImageData - 基准图像数据
   * @param {ImageData} targetImageData - 目标图像数据
   * @returns {Array} 校准后的标注点
   */
  async calibrateAnnotations(referenceAnnotations, targetAnnotations, referenceImageData, targetImageData) {
    if (!referenceAnnotations || !targetAnnotations || !referenceImageData || !targetImageData) {
      throw new Error('缺少必要的参数：需要基准标注、目标标注和图像数据');
    }

    console.log('[SIFT] 开始标注点校准', {
      referenceCount: referenceAnnotations.length,
      targetCount: targetAnnotations.length
    });

    // 按order排序
    const refAnnotations = [...referenceAnnotations].sort((a, b) => (a.order || 0) - (b.order || 0));
    const targetAnnotationsSorted = [...targetAnnotations].sort((a, b) => (a.order || 0) - (b.order || 0));

    const calibratedAnnotations = [];
    
    // 🔧 FIX: 按order创建映射，保留目标图像中上一帧没有的新标注点
    const refAnnotationMap = new Map(refAnnotations.map(ann => [ann.order, ann]));
    
    for (const targetAnn of targetAnnotationsSorted) {
      const refAnn = refAnnotationMap.get(targetAnn.order);
      
      if (!refAnn) {
        // 🔧 FIX: 上一帧没有的标注点，直接保留原位置
        console.log(`[SIFT] 保留新标注点 #${targetAnn.order}（上一帧不存在）`);
        calibratedAnnotations.push({
          ...targetAnn,
          calibrationData: {
            originalX: targetAnn.x,
            originalY: targetAnn.y,
            confidence: 1.0,
            method: 'preserve',
            offset: 0,
            note: 'New annotation not in previous frame'
          }
        });
        continue;
      }

      try {
        // 🔧 FIX: 使用参考点位置作为搜索中心（而非当前目标点位置）
        // 这是正确的SIFT匹配算法：在目标图像中围绕参考点位置搜索
        const matchResult = await this.adaptiveMatching(
          referenceImageData,
          refAnn.x,
          refAnn.y,
          targetImageData,
          refAnn.x,  // 🔧 FIX: 使用参考点位置作为搜索中心
          refAnn.y   // 🔧 FIX: 而非目标点当前位置
        );

        // 复制目标标注的所有属性
        const calibratedAnn = {
          ...targetAnn,
          x: matchResult.x,
          y: matchResult.y,
          calibrationData: {
            originalX: targetAnn.x,
            originalY: targetAnn.y,
            confidence: matchResult.confidence,
            method: matchResult.method,
            offset: Math.sqrt(Math.pow(matchResult.x - targetAnn.x, 2) + Math.pow(matchResult.y - targetAnn.y, 2))
          }
        };

        calibratedAnnotations.push(calibratedAnn);

        console.log(`[SIFT] 校准点 ${targetAnn.order || 'unknown'}:`, {
          original: `(${targetAnn.x.toFixed(1)}, ${targetAnn.y.toFixed(1)})`,
          calibrated: `(${matchResult.x.toFixed(1)}, ${matchResult.y.toFixed(1)})`,
          offset: `${calibratedAnn.calibrationData.offset.toFixed(2)}px`,
          confidence: `${(matchResult.confidence * 100).toFixed(1)}%`,
          method: matchResult.method
        });

      } catch (error) {
        console.warn(`[SIFT] 校准点 ${targetAnn.order || 'unknown'} 失败:`, error.message);
        // 保持原始位置
        calibratedAnnotations.push({
          ...targetAnn,
          calibrationData: {
            originalX: targetAnn.x,
            originalY: targetAnn.y,
            confidence: 0,
            method: 'none',
            offset: 0,
            error: error.message
          }
        });
      }
    }

    return calibratedAnnotations;
  }

  /**
   * 自适应匹配算法
   * @param {ImageData} refImageData - 基准图像数据
   * @param {number} refX - 基准X坐标
   * @param {number} refY - 基准Y坐标
   * @param {ImageData} targetImageData - 目标图像数据
   * @param {number} searchCenterX - 搜索中心X坐标（通常是参考点位置）
   * @param {number} searchCenterY - 搜索中心Y坐标（通常是参考点位置）
   * @returns {Object} 匹配结果
   */
  async adaptiveMatching(refImageData, refX, refY, targetImageData, searchCenterX, searchCenterY) {
    let bestResult = { x: searchCenterX, y: searchCenterY, confidence: 0.0, method: 'none' };
    let bestQuality = 0.0;

    for (const config of this.searchConfigs) {
      try {
        const result = await this.findBestMatch(
          refImageData, refX, refY,
          targetImageData, searchCenterX, searchCenterY,
          config.boxSize, config.searchRadius
        );

        if (result.confidence > bestQuality) {
          bestQuality = result.confidence;
          bestResult = result;
        }

        // 如果质量足够好，停止搜索
        if (result.confidence > this.qualityThreshold) {
          break;
        }
      } catch (error) {
        console.warn(`[SIFT] 配置 ${JSON.stringify(config)} 匹配失败:`, error.message);
        continue;
      }
    }

    return bestResult;
  }

  /**
   * 寻找最佳匹配
   * @param {ImageData} refImageData - 基准图像数据
   * @param {number} refX - 基准X坐标
   * @param {number} refY - 基准Y坐标
   * @param {ImageData} targetImageData - 目标图像数据
   * @param {number} searchCenterX - 搜索中心X坐标
   * @param {number} searchCenterY - 搜索中心Y坐标
   * @param {number} boxSize - 匹配框大小
   * @param {number} searchRadius - 搜索半径
   * @returns {Object} 匹配结果
   */
  async findBestMatch(refImageData, refX, refY, targetImageData, searchCenterX, searchCenterY, boxSize, searchRadius) {
    const refBox = this.extractRegion(refImageData, refX, refY, boxSize);
    const searchRegion = this.extractRegion(targetImageData, searchCenterX, searchCenterY, searchRadius * 2);

    if (!refBox || !searchRegion) {
      return { x: searchCenterX, y: searchCenterY, confidence: 0.0, method: 'none' };
    }

    // 尝试多种匹配方法
    const results = [];

    // 1. 模板匹配
    try {
      const templateResult = await this.templateMatching(
        refBox, searchRegion,
        searchCenterX - searchRadius, searchCenterY - searchRadius
      );
      results.push(templateResult);
    } catch (error) {
      console.warn('[SIFT] 模板匹配失败:', error.message);
    }

    // 2. 简化的SIFT匹配（使用Harris角点检测）
    try {
      const siftResult = await this.simplifiedSiftMatching(
        refBox, searchRegion,
        searchCenterX - searchRadius, searchCenterY - searchRadius
      );
      results.push(siftResult);
    } catch (error) {
      console.warn('[SIFT] 简化SIFT匹配失败:', error.message);
    }

    // 选择最佳结果
    if (results.length === 0) {
      return { x: searchCenterX, y: searchCenterY, confidence: 0.0, method: 'none' };
    }

    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return bestResult;
  }

  /**
   * 提取图像区域
   * @param {ImageData} imageData - 图像数据
   * @param {number} centerX - 中心X坐标
   * @param {number} centerY - 中心Y坐标
   * @param {number} size - 区域大小
   * @returns {Object} 提取的区域数据
   */
  extractRegion(imageData, centerX, centerY, size) {
    const { width, height, data } = imageData;
    const halfSize = Math.floor(size / 2);
    
    const x1 = Math.max(0, Math.floor(centerX - halfSize));
    const y1 = Math.max(0, Math.floor(centerY - halfSize));
    const x2 = Math.min(width, Math.floor(centerX + halfSize));
    const y2 = Math.min(height, Math.floor(centerY + halfSize));
    
    const regionWidth = x2 - x1;
    const regionHeight = y2 - y1;
    
    if (regionWidth < 5 || regionHeight < 5) {
      return null;
    }

    const regionData = new Uint8ClampedArray(regionWidth * regionHeight * 4);
    
    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        const srcIndex = ((y1 + y) * width + (x1 + x)) * 4;
        const dstIndex = (y * regionWidth + x) * 4;
        
        regionData[dstIndex] = data[srcIndex];     // R
        regionData[dstIndex + 1] = data[srcIndex + 1]; // G
        regionData[dstIndex + 2] = data[srcIndex + 2]; // B
        regionData[dstIndex + 3] = data[srcIndex + 3]; // A
      }
    }

    return {
      x: x1,
      y: y1,
      width: regionWidth,
      height: regionHeight,
      data: regionData
    };
  }

  /**
   * 模板匹配
   * @param {Object} refBox - 基准框
   * @param {Object} searchRegion - 搜索区域
   * @param {number} searchX - 搜索区域X偏移
   * @param {number} searchY - 搜索区域Y偏移
   * @returns {Object} 匹配结果
   */
  async templateMatching(refBox, searchRegion, searchX, searchY) {
    const refGray = this.toGrayscale(refBox);
    const searchGray = this.toGrayscale(searchRegion);
    
    // 使用归一化相关匹配
    const result = this.normalizedCorrelation(refGray, searchGray);
    
    if (!result) {
      return { 
        x: searchX + searchRegion.width / 2, 
        y: searchY + searchRegion.height / 2, 
        confidence: 0.0, 
        method: 'template' 
      };
    }

    const centerX = result.x + refBox.width / 2 + searchX;
    const centerY = result.y + refBox.height / 2 + searchY;

    return {
      x: centerX,
      y: centerY,
      confidence: result.confidence,
      method: 'template'
    };
  }

  /**
   * 简化的SIFT匹配（使用Harris角点检测）
   * @param {Object} refBox - 基准框
   * @param {Object} searchRegion - 搜索区域
   * @param {number} searchX - 搜索区域X偏移
   * @param {number} searchY - 搜索区域Y偏移
   * @returns {Object} 匹配结果
   */
  async simplifiedSiftMatching(refBox, searchRegion, searchX, searchY) {
    const refGray = this.toGrayscale(refBox);
    const searchGray = this.toGrayscale(searchRegion);
    
    // 检测Harris角点
    const refCorners = this.detectHarrisCorners(refGray);
    const searchCorners = this.detectHarrisCorners(searchGray);
    
    if (refCorners.length < 3 || searchCorners.length < 3) {
      // 回退到模板匹配
      return this.templateMatching(refBox, searchRegion, searchX, searchY);
    }

    // 简化的描述子匹配
    const matches = this.matchCorners(refCorners, searchCorners);
    
    if (matches.length < this.minMatches) {
      return this.templateMatching(refBox, searchRegion, searchX, searchY);
    }

    // 计算变换
    const transformation = this.calculateTransformation(matches);
    
    const centerX = refBox.width / 2 + transformation.dx + searchX;
    const centerY = refBox.height / 2 + transformation.dy + searchY;

    return {
      x: centerX,
      y: centerY,
      confidence: Math.min(transformation.confidence, 1.0),
      method: 'sift'
    };
  }

  /**
   * 转换为灰度图
   * @param {Object} imageRegion - 图像区域
   * @returns {Object} 灰度图像数据
   */
  toGrayscale(imageRegion) {
    const { width, height, data } = imageRegion;
    const grayData = new Uint8Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      grayData[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    return { width, height, data: grayData };
  }

  /**
   * 归一化相关匹配
   * @param {Object} template - 模板图像
   * @param {Object} image - 搜索图像
   * @returns {Object} 匹配结果
   */
  normalizedCorrelation(template, image) {
    const { width: tWidth, height: tHeight, data: tData } = template;
    const { width: iWidth, height: iHeight, data: iData } = image;
    
    if (tWidth > iWidth || tHeight > iHeight) {
      return null;
    }
    
    let bestScore = -1;
    let bestX = 0;
    let bestY = 0;
    
    for (let y = 0; y <= iHeight - tHeight; y++) {
      for (let x = 0; x <= iWidth - tWidth; x++) {
        const score = this.calculateNCC(tData, iData, tWidth, tHeight, x, y, iWidth);
        
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
    
    return {
      x: bestX,
      y: bestY,
      confidence: Math.max(0, Math.min(bestScore, 0.9)) // 🔧 FIX: 限制最大置信度，避免虚假的100%
    };
  }

  /**
   * 计算归一化相关系数
   * @param {Uint8Array} template - 模板数据
   * @param {Uint8Array} image - 图像数据
   * @param {number} tWidth - 模板宽度
   * @param {number} tHeight - 模板高度
   * @param {number} x - 图像中的X位置
   * @param {number} y - 图像中的Y位置
   * @param {number} iWidth - 图像宽度
   * @returns {number} 相关系数
   */
  calculateNCC(template, image, tWidth, tHeight, x, y, iWidth) {
    let sumT = 0, sumI = 0, sumTI = 0, sumT2 = 0, sumI2 = 0;
    const n = tWidth * tHeight;
    
    for (let dy = 0; dy < tHeight; dy++) {
      for (let dx = 0; dx < tWidth; dx++) {
        const tVal = template[dy * tWidth + dx];
        const iVal = image[(y + dy) * iWidth + (x + dx)];
        
        sumT += tVal;
        sumI += iVal;
        sumTI += tVal * iVal;
        sumT2 += tVal * tVal;
        sumI2 += iVal * iVal;
      }
    }
    
    const meanT = sumT / n;
    const meanI = sumI / n;
    
    const numerator = sumTI - n * meanT * meanI;
    const denominator = Math.sqrt((sumT2 - n * meanT * meanT) * (sumI2 - n * meanI * meanI));
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * 检测Harris角点
   * @param {Object} grayImage - 灰度图像
   * @returns {Array} 角点列表
   */
  detectHarrisCorners(grayImage) {
    const { width, height, data } = grayImage;
    const corners = [];
    const threshold = 0.01;
    
    // 简化的Harris角点检测
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const response = this.calculateHarrisResponse(data, x, y, width, height);
        
        if (response > threshold) {
          corners.push({ x, y, response });
        }
      }
    }
    
    // 返回最强的角点
    return corners.sort((a, b) => b.response - a.response).slice(0, 20);
  }

  /**
   * 计算Harris响应
   * @param {Uint8Array} data - 图像数据
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} width - 图像宽度
   * @param {number} height - 图像高度
   * @returns {number} Harris响应值
   */
  calculateHarrisResponse(data, x, y, width, height) {
    // 简化的Harris响应计算
    const k = 0.04;
    let Ixx = 0, Iyy = 0, Ixy = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = (y + dy) * width + (x + dx);
        const Ix = data[idx + 1] - data[idx - 1]; // 简化的梯度计算
        const Iy = data[idx + width] - data[idx - width];
        
        Ixx += Ix * Ix;
        Iyy += Iy * Iy;
        Ixy += Ix * Iy;
      }
    }
    
    const det = Ixx * Iyy - Ixy * Ixy;
    const trace = Ixx + Iyy;
    
    return det - k * trace * trace;
  }

  /**
   * 匹配角点
   * @param {Array} corners1 - 第一组角点
   * @param {Array} corners2 - 第二组角点
   * @returns {Array} 匹配结果
   */
  matchCorners(corners1, corners2) {
    const matches = [];
    
    for (let i = 0; i < corners1.length; i++) {
      const c1 = corners1[i];
      let bestMatch = null;
      let bestDistance = Infinity;
      
      for (let j = 0; j < corners2.length; j++) {
        const c2 = corners2[j];
        const distance = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = { corner1: c1, corner2: c2, distance };
        }
      }
      
      if (bestMatch && bestDistance < 50) { // 距离阈值
        matches.push(bestMatch);
      }
    }
    
    return matches;
  }

  /**
   * 计算变换
   * @param {Array} matches - 匹配结果
   * @returns {Object} 变换参数
   */
  calculateTransformation(matches) {
    if (matches.length === 0) {
      return { dx: 0, dy: 0, confidence: 0 };
    }
    
    // 计算平均偏移
    const dxList = matches.map(m => m.corner2.x - m.corner1.x);
    const dyList = matches.map(m => m.corner2.y - m.corner1.y);
    
    const dx = this.median(dxList);
    const dy = this.median(dyList);
    
    // 🔧 FIX: 改进置信度计算，避免虚假的高置信度
    const maxExpectedMatches = Math.min(refCorners.length, searchCorners.length);
    const confidence = maxExpectedMatches > 0 ? (matches.length / maxExpectedMatches) * 0.8 : 0; // 限制最大置信度为0.8
    
    return { dx, dy, confidence: Math.min(confidence, 0.8) }; // 确保置信度不超过0.8
  }

  /**
   * 计算中位数
   * @param {Array} values - 数值数组
   * @returns {number} 中位数
   */
  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  /**
   * 计算匹配质量
   * @param {Array} calibrationResults - 校准结果
   * @returns {Object} 质量指标
   */
  calculateMatchingQuality(calibrationResults) {
    if (!calibrationResults || calibrationResults.length === 0) {
      return {
        averageConfidence: 0,
        averageOffset: 0,
        successfulMatches: 0,
        totalAnnotations: 0,
        qualityScore: 0
      };
    }

    const successfulMatches = calibrationResults.filter(r => r.calibrationData && r.calibrationData.confidence > 0);
    const totalConfidence = successfulMatches.reduce((sum, r) => sum + r.calibrationData.confidence, 0);
    const totalOffset = successfulMatches.reduce((sum, r) => sum + r.calibrationData.offset, 0);

    const averageConfidence = successfulMatches.length > 0 ? totalConfidence / successfulMatches.length : 0;
    const averageOffset = successfulMatches.length > 0 ? totalOffset / successfulMatches.length : 0;
    const qualityScore = averageConfidence * (successfulMatches.length / calibrationResults.length);

    return {
      averageConfidence,
      averageOffset,
      successfulMatches: successfulMatches.length,
      totalAnnotations: calibrationResults.length,
      qualityScore
    };
  }
}