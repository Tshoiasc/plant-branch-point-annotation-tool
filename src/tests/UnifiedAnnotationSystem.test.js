/**
 * 统一标注系统测试
 * 
 * 测试自定义标注与常规标注的统一管理
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('UnifiedAnnotationSystem', () => {
  let annotationTool;
  let customAnnotationManager;

  beforeEach(() => {
    // Mock DOM
    global.document = {
      getElementById: jest.fn().mockReturnValue({
        getContext: jest.fn().mockReturnValue({}),
        addEventListener: jest.fn(),
        style: {},
        parentElement: {
          getBoundingClientRect: jest.fn().mockReturnValue({
            width: 800,
            height: 600,
            left: 0,
            top: 0
          })
        }
      }),
      createElement: jest.fn(),
      head: { appendChild: jest.fn() }
    };

    global.window = {
      PlantAnnotationTool: {
        appState: {
          currentImage: { id: 'test-image-1' },
          currentPlant: { id: 'test-plant-1' }
        }
      }
    };

    // Import and initialize after mocking
    const { AnnotationTool } = require('../core/AnnotationTool.js');
    const { CustomAnnotationManager } = require('../core/CustomAnnotationManager.js');
    
    customAnnotationManager = new CustomAnnotationManager();
    annotationTool = new AnnotationTool('test-canvas');
    annotationTool.customAnnotationManager = customAnnotationManager;
  });

  describe('统一标注创建', () => {
    it('应该能创建常规标注点', () => {
      const keypoint = annotationTool.addKeypointWithDirection(100, 200, 0);
      
      expect(keypoint).toBeDefined();
      expect(keypoint.annotationType).toBe('regular');
      expect(keypoint.x).toBe(100);
      expect(keypoint.y).toBe(200);
      expect(keypoint.direction).toBe(0);
      expect(annotationTool.keypoints).toHaveLength(1);
    });

    it('应该能创建自定义点标注', () => {
      // 创建自定义类型
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });

      const keypoint = annotationTool.addCustomPointAnnotation(150, 250, customType.id);
      
      expect(keypoint).toBeDefined();
      expect(keypoint.annotationType).toBe('custom');
      expect(keypoint.customTypeId).toBe(customType.id);
      expect(keypoint.x).toBe(150);
      expect(keypoint.y).toBe(250);
      expect(keypoint.direction).toBe(null);
      expect(annotationTool.keypoints).toHaveLength(1);
    });

    it('应该能创建自定义区域标注', () => {
      // 创建自定义类型
      const customType = customAnnotationManager.createCustomType({
        id: 'test-region-type',
        name: 'Test Region',
        type: 'region',
        color: '#00ff00'
      });

      const keypoint = annotationTool.addCustomRegionAnnotation(100, 100, 50, 75, customType.id);
      
      expect(keypoint).toBeDefined();
      expect(keypoint.annotationType).toBe('custom');
      expect(keypoint.customTypeId).toBe(customType.id);
      expect(keypoint.x).toBe(100);
      expect(keypoint.y).toBe(100);
      expect(keypoint.width).toBe(50);
      expect(keypoint.height).toBe(75);
      expect(annotationTool.keypoints).toHaveLength(1);
    });
  });

  describe('统一标注删除', () => {
    it('应该能删除常规标注', () => {
      const keypoint = annotationTool.addKeypointWithDirection(100, 200, 0);
      expect(annotationTool.keypoints).toHaveLength(1);

      annotationTool.removeKeypoint(keypoint);
      expect(annotationTool.keypoints).toHaveLength(0);
    });

    it('应该能删除自定义标注', () => {
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });

      const keypoint = annotationTool.addCustomPointAnnotation(150, 250, customType.id);
      expect(annotationTool.keypoints).toHaveLength(1);

      annotationTool.removeCustomAnnotation(keypoint);
      expect(annotationTool.keypoints).toHaveLength(0);
    });
  });

  describe('统一标注数据管理', () => {
    it('应该在getAnnotationData中包含所有标注', () => {
      // 创建常规标注
      const regularKeypoint = annotationTool.addKeypointWithDirection(100, 200, 0);
      
      // 创建自定义标注
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });
      const customKeypoint = annotationTool.addCustomPointAnnotation(150, 250, customType.id);

      const data = annotationTool.getAnnotationData();
      
      expect(data.keypoints).toHaveLength(2);
      expect(data.keypoints[0].annotationType).toBe('regular');
      expect(data.keypoints[1].annotationType).toBe('custom');
    });

    it('应该能加载包含自定义标注的数据', () => {
      const testData = {
        keypoints: [
          {
            id: 1,
            x: 100,
            y: 200,
            direction: 0,
            annotationType: 'regular',
            order: 1
          },
          {
            id: 2,
            x: 150,
            y: 250,
            direction: null,
            annotationType: 'custom',
            customTypeId: 'test-type',
            order: 2
          }
        ]
      };

      annotationTool.loadAnnotationData(testData);
      
      expect(annotationTool.keypoints).toHaveLength(2);
      expect(annotationTool.keypoints[0].annotationType).toBe('regular');
      expect(annotationTool.keypoints[1].annotationType).toBe('custom');
    });
  });

  describe('统一标注检测', () => {
    it('应该能检测自定义标注', () => {
      // Mock imageToScreen
      annotationTool.imageToScreen = jest.fn().mockReturnValue({ x: 150, y: 250 });
      
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });
      const customKeypoint = annotationTool.addCustomPointAnnotation(150, 250, customType.id);

      const foundAnnotation = annotationTool.getCustomAnnotationAt({ x: 150, y: 250 });
      
      expect(foundAnnotation).toBeDefined();
      expect(foundAnnotation.annotationType).toBe('custom');
      expect(foundAnnotation.customTypeId).toBe(customType.id);
    });
  });

  describe('统一标注清理', () => {
    it('应该能清理所有标注', () => {
      // 创建常规标注
      annotationTool.addKeypointWithDirection(100, 200, 0);
      
      // 创建自定义标注
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });
      annotationTool.addCustomPointAnnotation(150, 250, customType.id);

      expect(annotationTool.keypoints).toHaveLength(2);

      annotationTool.clearKeypoints();
      expect(annotationTool.keypoints).toHaveLength(0);
    });
  });

  describe('序号系统', () => {
    it('应该为所有标注分配唯一序号', () => {
      // 创建常规标注
      const keypoint1 = annotationTool.addKeypointWithDirection(100, 200, 0);
      
      // 创建自定义标注
      const customType = customAnnotationManager.createCustomType({
        id: 'test-point-type',
        name: 'Test Point',
        type: 'point',
        color: '#ff0000'
      });
      const keypoint2 = annotationTool.addCustomPointAnnotation(150, 250, customType.id);

      expect(keypoint1.order).toBe(1);
      expect(keypoint2.order).toBe(2);
    });

    it('应该正确处理序号缺失', () => {
      // 创建三个标注
      const keypoint1 = annotationTool.addKeypointWithDirection(100, 200, 0);
      const keypoint2 = annotationTool.addKeypointWithDirection(150, 250, 0);
      const keypoint3 = annotationTool.addKeypointWithDirection(200, 300, 0);

      // 删除中间的标注
      annotationTool.removeKeypoint(keypoint2);

      // 创建新标注应该填补空缺
      const keypoint4 = annotationTool.addKeypointWithDirection(175, 275, 0);
      expect(keypoint4.order).toBe(2); // 应该填补空缺的序号
    });
  });
});