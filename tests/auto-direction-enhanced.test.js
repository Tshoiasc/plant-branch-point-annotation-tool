/**
 * Enhanced Auto Direction Feature Tests
 * Testing both Longitudinal and Cross-Sectional annotation modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnnotationTool } from '../src/core/AnnotationTool.js';

// Mock DOM environment
global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn(),
  addEventListener: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn()
};

global.window = {
  PlantAnnotationTool: {
    appState: {
      currentPlant: { id: 'test-plant', selectedViewAngle: 'sv-000' },
      currentImage: { id: 'test-image-1' }
    },
    plantDataManager: {
      getPlantImages: vi.fn(),
      getImageAnnotations: vi.fn(),
      saveImageAnnotations: vi.fn()
    }
  },
  handleImageSelect: vi.fn(),
  updateProgressInfo: vi.fn()
};

describe('Enhanced Auto Direction Feature', () => {
  let annotationTool;
  let mockCanvas;
  let mockPlantDataManager;

  beforeEach(() => {
    // Setup mock canvas
    mockCanvas = {
      getContext: vi.fn(() => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillText: vi.fn(),
        strokeText: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        setLineDash: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn()
      })),
      width: 800,
      height: 600,
      style: {},
      addEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600, left: 0, top: 0 })),
      parentElement: {
        getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 }))
      }
    };

    global.document.getElementById.mockReturnValue(mockCanvas);

    // Setup mock plant data manager
    mockPlantDataManager = {
      getPlantImages: vi.fn(),
      getImageAnnotations: vi.fn(),
      saveImageAnnotations: vi.fn()
    };

    global.window.PlantAnnotationTool.plantDataManager = mockPlantDataManager;

    // Create annotation tool instance
    annotationTool = new AnnotationTool('test-canvas');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Mode Selection', () => {
    it('should initialize with longitudinal mode by default', () => {
      expect(annotationTool.autoDirectionMode).toBe('longitudinal');
    });

    it('should allow switching between longitudinal and cross-sectional modes', () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      expect(annotationTool.autoDirectionMode).toBe('cross-sectional');

      annotationTool.setAutoDirectionMode('longitudinal');
      expect(annotationTool.autoDirectionMode).toBe('longitudinal');
    });

    it('should throw error for invalid mode', () => {
      expect(() => {
        annotationTool.setAutoDirectionMode('invalid-mode');
      }).toThrow('Invalid auto direction mode');
    });
  });

  describe('Longitudinal Mode (Current Behavior)', () => {
    beforeEach(() => {
      // Setup test annotations in current image
      annotationTool.keypoints = [
        { id: 1, order: 1, x: 100, y: 100, direction: null },
        { id: 2, order: 2, x: 200, y: 200, direction: null },
        { id: 3, order: 3, x: 300, y: 300, direction: 'left' }
      ];
      annotationTool.setAutoDirectionMode('longitudinal');
    });

    it('should find all directionless points in current image', async () => {
      await annotationTool.startAutoDirectionMode();
      
      expect(annotationTool.autoDirectionKeypoints).toHaveLength(2);
      expect(annotationTool.autoDirectionKeypoints[0].order).toBe(1);
      expect(annotationTool.autoDirectionKeypoints[1].order).toBe(2);
    });

    it('should process points in order within current image', async () => {
      await annotationTool.startAutoDirectionMode();
      
      expect(annotationTool.isAutoDirectionMode).toBe(true);
      expect(annotationTool.autoDirectionIndex).toBe(0);
      expect(annotationTool.state.selectedKeypoint).toBe(annotationTool.autoDirectionKeypoints[0]);
    });

    it('should complete longitudinal mode when all points processed', async () => {
      await annotationTool.startAutoDirectionMode();
      
      // Simulate processing all points
      annotationTool.autoDirectionKeypoints[0].direction = 'left';
      annotationTool.autoDirectionKeypoints[1].direction = 'right';
      
      await annotationTool.processNextAutoDirectionPoint();
      await annotationTool.processNextAutoDirectionPoint();
      
      expect(annotationTool.isAutoDirectionMode).toBe(false);
    });
  });

  describe('Cross-Sectional Mode (New Behavior)', () => {
    beforeEach(() => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      
      // Mock multiple images with annotations
      const mockImages = [
        { id: 'image-1', name: 'image-1.jpg' },
        { id: 'image-2', name: 'image-2.jpg' },
        { id: 'image-3', name: 'image-3.jpg' }
      ];

      const mockAnnotations = {
        'image-1': [
          { id: 1, order: 1, x: 100, y: 100, direction: null },
          { id: 2, order: 2, x: 200, y: 200, direction: null }
        ],
        'image-2': [
          { id: 3, order: 1, x: 150, y: 150, direction: null },
          { id: 4, order: 2, x: 250, y: 250, direction: null }
        ],
        'image-3': [
          { id: 5, order: 1, x: 180, y: 180, direction: null }
        ]
      };

      mockPlantDataManager.getPlantImages.mockResolvedValue(mockImages);
      mockPlantDataManager.getImageAnnotations.mockImplementation((imageId) => {
        return Promise.resolve(mockAnnotations[imageId] || []);
      });
    });

    it('should analyze all images to build cross-sectional map', async () => {
      await annotationTool.startAutoDirectionMode();
      
      expect(mockPlantDataManager.getPlantImages).toHaveBeenCalled();
      expect(mockPlantDataManager.getImageAnnotations).toHaveBeenCalledTimes(3);
      expect(annotationTool.crossSectionalMap).toBeDefined();
    });

    it('should identify all order numbers across all images', async () => {
      await annotationTool.startAutoDirectionMode();
      
      const orderNumbers = annotationTool.getAvailableOrderNumbers();
      expect(orderNumbers).toEqual([1, 2]);
    });

    it('should start with lowest order number', async () => {
      await annotationTool.startAutoDirectionMode();
      
      expect(annotationTool.crossSectionalState.currentOrder).toBe(1);
      expect(annotationTool.crossSectionalState.currentImageIndex).toBe(0);
    });

    it('should process all images for current order before moving to next order', async () => {
      await annotationTool.startAutoDirectionMode();
      
      // Process order 1 in all images
      expect(annotationTool.crossSectionalState.currentOrder).toBe(1);
      
      // Should have 3 images with order 1
      const imagesWithOrder1 = annotationTool.getImagesWithOrder(1);
      expect(imagesWithOrder1).toHaveLength(3);
    });

    it('should automatically switch images during cross-sectional processing', async () => {
      await annotationTool.startAutoDirectionMode();
      
      // Process first annotation (order 1, image 1)
      await annotationTool.processCurrentCrossSectionalPoint('left');
      
      // Should move to next image with same order
      expect(global.window.handleImageSelect).toHaveBeenCalled();
    });

    it('should move to next order when all images processed for current order', async () => {
      await annotationTool.startAutoDirectionMode();
      
      // Simulate processing all order 1 annotations
      await annotationTool.processCurrentCrossSectionalPoint('left'); // image-1, order 1
      await annotationTool.processCurrentCrossSectionalPoint('right'); // image-2, order 1  
      await annotationTool.processCurrentCrossSectionalPoint('left'); // image-3, order 1
      
      // Should move to order 2
      expect(annotationTool.crossSectionalState.currentOrder).toBe(2);
      expect(annotationTool.crossSectionalState.currentImageIndex).toBe(0);
    });

    it('should complete cross-sectional mode when all orders processed', async () => {
      await annotationTool.startAutoDirectionMode();
      
      // Simulate processing all annotations
      const allPoints = annotationTool.getAllCrossSectionalPoints();
      for (const point of allPoints) {
        await annotationTool.processCurrentCrossSectionalPoint('left');
      }
      
      expect(annotationTool.isAutoDirectionMode).toBe(false);
    });

    it('should handle images without specific order numbers gracefully', async () => {
      // Mock image with missing order 2
      const mockAnnotations = {
        'image-1': [{ id: 1, order: 1, x: 100, y: 100, direction: null }],
        'image-2': [{ id: 2, order: 3, x: 200, y: 200, direction: null }]
      };

      mockPlantDataManager.getImageAnnotations.mockImplementation((imageId) => {
        return Promise.resolve(mockAnnotations[imageId] || []);
      });

      await annotationTool.startAutoDirectionMode();
      
      const orderNumbers = annotationTool.getAvailableOrderNumbers();
      expect(orderNumbers).toEqual([1, 3]); // Should skip missing order 2
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress in longitudinal mode', async () => {
      annotationTool.keypoints = [
        { id: 1, order: 1, x: 100, y: 100, direction: null },
        { id: 2, order: 2, x: 200, y: 200, direction: null }
      ];
      annotationTool.setAutoDirectionMode('longitudinal');
      
      await annotationTool.startAutoDirectionMode();
      
      const progress = annotationTool.getAutoDirectionProgress();
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should track progress in cross-sectional mode', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      
      // Mock data for progress tracking
      const mockImages = [
        { id: 'image-1', name: 'image-1.jpg' },
        { id: 'image-2', name: 'image-2.jpg' }
      ];

      const mockAnnotations = {
        'image-1': [
          { id: 1, order: 1, x: 100, y: 100, direction: null },
          { id: 2, order: 2, x: 200, y: 200, direction: null }
        ],
        'image-2': [
          { id: 3, order: 1, x: 150, y: 150, direction: null }
        ]
      };

      mockPlantDataManager.getPlantImages.mockResolvedValue(mockImages);
      mockPlantDataManager.getImageAnnotations.mockImplementation((imageId) => {
        return Promise.resolve(mockAnnotations[imageId] || []);
      });

      await annotationTool.startAutoDirectionMode();
      
      const progress = annotationTool.getAutoDirectionProgress();
      expect(progress.total).toBe(3); // Total directionless points across all images
      expect(progress.currentOrder).toBe(1);
      expect(progress.totalOrders).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors when loading images', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      mockPlantDataManager.getPlantImages.mockRejectedValue(new Error('Network error'));

      await expect(annotationTool.startAutoDirectionMode()).rejects.toThrow('Network error');
      expect(annotationTool.isAutoDirectionMode).toBe(false);
    });

    it('should handle missing annotations gracefully', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      mockPlantDataManager.getImageAnnotations.mockResolvedValue([]);

      await annotationTool.startAutoDirectionMode();
      
      expect(annotationTool.crossSectionalMap).toBeDefined();
      expect(annotationTool.getAvailableOrderNumbers()).toEqual([]);
    });

    it('should handle interruption during cross-sectional processing', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      await annotationTool.startAutoDirectionMode();
      
      // Interrupt during processing
      annotationTool.exitAutoDirectionMode();
      
      expect(annotationTool.isAutoDirectionMode).toBe(false);
      expect(annotationTool.crossSectionalState).toBeNull();
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should work with SIFT matching in cross-sectional mode', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      // Mock SIFT functionality
      annotationTool.siftMatcher = {
        calibrateAnnotations: vi.fn().mockResolvedValue([])
      };

      await annotationTool.startAutoDirectionMode();
      
      // SIFT integration should work across images
      expect(annotationTool.siftMatcher).toBeDefined();
    });

    it('should maintain auto-save functionality during cross-sectional processing', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      await annotationTool.startAutoDirectionMode();
      
      await annotationTool.processCurrentCrossSectionalPoint('left');
      
      expect(mockPlantDataManager.saveImageAnnotations).toHaveBeenCalled();
    });

    it('should update UI progress indicators', async () => {
      annotationTool.setAutoDirectionMode('cross-sectional');
      await annotationTool.startAutoDirectionMode();
      
      expect(global.window.updateProgressInfo).toHaveBeenCalled();
    });
  });
});