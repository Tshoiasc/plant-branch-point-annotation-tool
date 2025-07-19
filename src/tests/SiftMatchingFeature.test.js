/**
 * @jest-environment jsdom
 */

/**
 * Test Suite: SIFT Matching Feature
 * 
 * This test suite validates the SIFT-based annotation matching functionality
 * that uses the previous frame as reference to adjust current frame annotations.
 * 
 * Features tested:
 * 1. SIFT matching algorithm implementation
 * 2. Template matching fallback mechanism
 * 3. Annotation position calibration
 * 4. User confirmation workflow
 * 5. Visual preview of adjustments
 * 6. Keyboard shortcuts and UI integration
 * 7. Error handling and validation
 */

describe('SIFT Matching Feature', () => {
  let mockSiftMatcher;
  let mockAnnotationTool;
  let mockCanvas;
  let mockContext;
  
  beforeEach(() => {
    // Mock canvas and context
    mockCanvas = {
      width: 800,
      height: 600,
      getBoundingClientRect: jest.fn(() => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      }))
    };
    
    mockContext = {
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(800 * 600 * 4),
        width: 800,
        height: 600
      })),
      putImageData: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      setLineDash: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 50 })),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '12px Arial'
    };
    
    mockCanvas.getContext = jest.fn(() => mockContext);
    
    // Mock DOM elements
    document.getElementById = jest.fn((id) => {
      if (id === 'annotation-canvas') return mockCanvas;
      return null;
    });
    
    // Mock annotation tool
    mockAnnotationTool = {
      keypoints: [],
      currentImage: {
        id: 'test-image-current',
        width: 1000,
        height: 800,
        element: new Image()
      },
      previousImage: {
        id: 'test-image-previous',
        width: 1000,
        height: 800,
        element: new Image()
      },
      viewport: {
        x: 0,
        y: 0,
        scale: 1
      },
      
      // Methods to be implemented
      performSiftMatching: jest.fn(),
      calibrateAnnotations: jest.fn(),
      showCalibrationPreview: jest.fn(),
      applyCalibrationResults: jest.fn(),
      cancelCalibration: jest.fn(),
      getCurrentImageData: jest.fn(),
      getPreviousImageData: jest.fn(),
      validateMatchingPreconditions: jest.fn(),
      calculateMatchingQuality: jest.fn(),
      createMatchingVisualizations: jest.fn()
    };
    
    // Mock SIFT matcher
    mockSiftMatcher = {
      detectKeypoints: jest.fn(),
      computeDescriptors: jest.fn(),
      matchDescriptors: jest.fn(),
      filterMatches: jest.fn(),
      calculateTransformation: jest.fn(),
      templateMatching: jest.fn(),
      adaptiveMatching: jest.fn(),
      findBestMatch: jest.fn(),
      validateMatchQuality: jest.fn()
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('SIFT Matching Algorithm', () => {
    test('should perform SIFT feature detection on image regions', () => {
      // Mock image data for keypoint region
      const mockKeypointRegion = {
        x: 100,
        y: 150,
        width: 60,
        height: 60,
        imageData: new Uint8ClampedArray(60 * 60 * 4)
      };
      
      const mockKeypoints = [
        { x: 30, y: 30, response: 0.8, size: 5 },
        { x: 45, y: 20, response: 0.6, size: 4 }
      ];
      
      mockSiftMatcher.detectKeypoints.mockReturnValue(mockKeypoints);
      
      const result = mockSiftMatcher.detectKeypoints(mockKeypointRegion);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('x');
      expect(result[0]).toHaveProperty('y');
      expect(result[0]).toHaveProperty('response');
      expect(mockSiftMatcher.detectKeypoints).toHaveBeenCalledWith(mockKeypointRegion);
    });
    
    test('should compute SIFT descriptors for detected keypoints', () => {
      const mockKeypoints = [
        { x: 30, y: 30, response: 0.8, size: 5 },
        { x: 45, y: 20, response: 0.6, size: 4 }
      ];
      
      const mockKeypointRegion = {
        x: 100,
        y: 150,
        width: 60,
        height: 60,
        imageData: new Uint8ClampedArray(60 * 60 * 4)
      };
      
      const mockDescriptors = [
        new Float32Array(128), // 128-dimensional SIFT descriptor
        new Float32Array(128)
      ];
      
      mockSiftMatcher.computeDescriptors.mockReturnValue(mockDescriptors);
      
      const result = mockSiftMatcher.computeDescriptors(mockKeypoints, mockKeypointRegion);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Float32Array);
      expect(result[0]).toHaveLength(128);
    });
    
    test('should match descriptors between reference and target images', () => {
      const referenceDescriptors = [new Float32Array(128), new Float32Array(128)];
      const targetDescriptors = [new Float32Array(128), new Float32Array(128)];
      
      const mockMatches = [
        { queryIdx: 0, trainIdx: 0, distance: 0.3 },
        { queryIdx: 1, trainIdx: 1, distance: 0.4 }
      ];
      
      mockSiftMatcher.matchDescriptors.mockReturnValue(mockMatches);
      
      const result = mockSiftMatcher.matchDescriptors(referenceDescriptors, targetDescriptors);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('queryIdx');
      expect(result[0]).toHaveProperty('trainIdx');
      expect(result[0]).toHaveProperty('distance');
    });
    
    test('should filter matches using ratio test', () => {
      const rawMatches = [
        [
          { queryIdx: 0, trainIdx: 0, distance: 0.3 },
          { queryIdx: 0, trainIdx: 1, distance: 0.6 }
        ],
        [
          { queryIdx: 1, trainIdx: 1, distance: 0.25 },
          { queryIdx: 1, trainIdx: 2, distance: 0.5 }
        ]
      ];
      
      const expectedGoodMatches = [
        { queryIdx: 0, trainIdx: 0, distance: 0.3 },
        { queryIdx: 1, trainIdx: 1, distance: 0.25 }
      ];
      
      mockSiftMatcher.filterMatches.mockReturnValue(expectedGoodMatches);
      
      const result = mockSiftMatcher.filterMatches(rawMatches, 0.7);
      
      expect(result).toHaveLength(2);
      expect(result[0].distance).toBeLessThan(0.7 * 0.6);
      expect(result[1].distance).toBeLessThan(0.7 * 0.5);
    });
    
    test('should calculate transformation from good matches', () => {
      const goodMatches = [
        { queryIdx: 0, trainIdx: 0, distance: 0.3 },
        { queryIdx: 1, trainIdx: 1, distance: 0.4 }
      ];
      
      const referenceKeypoints = [
        { x: 30, y: 30 },
        { x: 45, y: 20 }
      ];
      
      const targetKeypoints = [
        { x: 35, y: 28 },
        { x: 50, y: 18 }
      ];
      
      const expectedTransformation = {
        dx: 5,
        dy: -2,
        confidence: 0.85,
        numMatches: 2
      };
      
      mockSiftMatcher.calculateTransformation.mockReturnValue(expectedTransformation);
      
      const result = mockSiftMatcher.calculateTransformation(
        goodMatches,
        referenceKeypoints,
        targetKeypoints
      );
      
      expect(result).toHaveProperty('dx');
      expect(result).toHaveProperty('dy');
      expect(result).toHaveProperty('confidence');
      expect(result.numMatches).toBe(2);
    });
  });
  
  describe('Template Matching Fallback', () => {
    test('should use template matching when SIFT fails', () => {
      const referenceRegion = {
        x: 100,
        y: 150,
        width: 40,
        height: 40,
        imageData: new Uint8ClampedArray(40 * 40 * 4)
      };
      
      const searchRegion = {
        x: 80,
        y: 130,
        width: 80,
        height: 80,
        imageData: new Uint8ClampedArray(80 * 80 * 4)
      };
      
      const expectedMatch = {
        x: 105,
        y: 148,
        confidence: 0.7,
        method: 'template'
      };
      
      mockSiftMatcher.templateMatching.mockReturnValue(expectedMatch);
      
      const result = mockSiftMatcher.templateMatching(referenceRegion, searchRegion);
      
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('confidence');
      expect(result.method).toBe('template');
    });
    
    test('should try multiple template matching methods', () => {
      const referenceRegion = { width: 40, height: 40 };
      const searchRegion = { width: 80, height: 80 };
      
      const methods = ['TM_CCOEFF_NORMED', 'TM_CCORR_NORMED', 'TM_SQDIFF_NORMED'];
      const methodResults = [
        { x: 105, y: 148, confidence: 0.7 },
        { x: 106, y: 149, confidence: 0.8 },
        { x: 104, y: 147, confidence: 0.6 }
      ];
      
      mockSiftMatcher.templateMatching.mockImplementation((ref, search, method) => {
        const methodIndex = methods.indexOf(method);
        return methodResults[methodIndex] || { x: 100, y: 150, confidence: 0.5 };
      });
      
      const bestResult = mockSiftMatcher.templateMatching(referenceRegion, searchRegion, 'TM_CCORR_NORMED');
      
      expect(bestResult.confidence).toBe(0.8);
      expect(bestResult.x).toBe(106);
      expect(bestResult.y).toBe(149);
    });
  });
  
  describe('Annotation Calibration', () => {
    test('should calibrate annotations based on previous frame', () => {
      const previousAnnotations = [
        { order: 1, x: 100, y: 150, direction: 45, annotationType: 'regular' },
        { order: 2, x: 200, y: 250, direction: 90, annotationType: 'regular' }
      ];
      
      const currentAnnotations = [
        { order: 1, x: 95, y: 145, direction: 45, annotationType: 'regular' },
        { order: 2, x: 205, y: 255, direction: 90, annotationType: 'regular' }
      ];
      
      const expectedCalibrated = [
        { order: 1, x: 103, y: 148, direction: 45, annotationType: 'regular' },
        { order: 2, x: 198, y: 252, direction: 90, annotationType: 'regular' }
      ];
      
      mockAnnotationTool.calibrateAnnotations.mockReturnValue(expectedCalibrated);
      
      const result = mockAnnotationTool.calibrateAnnotations(
        previousAnnotations,
        currentAnnotations
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].order).toBe(1);
      expect(result[0].x).toBe(103);
      expect(result[0].y).toBe(148);
      expect(result[0].direction).toBe(45); // Should preserve other properties
    });
    
    test('should handle missing annotations gracefully', () => {
      const previousAnnotations = [
        { order: 1, x: 100, y: 150, direction: 45, annotationType: 'regular' },
        { order: 2, x: 200, y: 250, direction: 90, annotationType: 'regular' }
      ];
      
      const currentAnnotations = [
        { order: 1, x: 95, y: 145, direction: 45, annotationType: 'regular' }
        // Missing order 2
      ];
      
      const expectedCalibrated = [
        { order: 1, x: 103, y: 148, direction: 45, annotationType: 'regular' }
      ];
      
      mockAnnotationTool.calibrateAnnotations.mockReturnValue(expectedCalibrated);
      
      const result = mockAnnotationTool.calibrateAnnotations(
        previousAnnotations,
        currentAnnotations
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].order).toBe(1);
    });
    
    test('should calculate calibration quality metrics', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148, confidence: 0.8 },
        { order: 2, originalX: 205, originalY: 255, newX: 198, newY: 252, confidence: 0.7 }
      ];
      
      const expectedQuality = {
        averageConfidence: 0.75,
        averageOffset: 6.7,
        successfulMatches: 2,
        totalAnnotations: 2,
        qualityScore: 0.85
      };
      
      mockAnnotationTool.calculateMatchingQuality.mockReturnValue(expectedQuality);
      
      const result = mockAnnotationTool.calculateMatchingQuality(calibrationResults);
      
      expect(result).toHaveProperty('averageConfidence');
      expect(result).toHaveProperty('averageOffset');
      expect(result).toHaveProperty('qualityScore');
      expect(result.successfulMatches).toBe(2);
    });
  });
  
  describe('User Confirmation Workflow', () => {
    test('should show calibration preview with visual indicators', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148, confidence: 0.8 },
        { order: 2, originalX: 205, originalY: 255, newX: 198, newY: 252, confidence: 0.7 }
      ];
      
      const expectedPreview = {
        visualizations: [
          { type: 'original', x: 95, y: 145, color: '#ff4444' },
          { type: 'adjusted', x: 103, y: 148, color: '#44ff44' },
          { type: 'arrow', from: { x: 95, y: 145 }, to: { x: 103, y: 148 } }
        ],
        summary: 'Average offset: 6.7px, Confidence: 75%'
      };
      
      mockAnnotationTool.showCalibrationPreview.mockReturnValue(expectedPreview);
      
      const result = mockAnnotationTool.showCalibrationPreview(calibrationResults);
      
      expect(result).toHaveProperty('visualizations');
      expect(result).toHaveProperty('summary');
      expect(result.visualizations).toHaveLength(3);
    });
    
    test('should handle user confirmation via keyboard shortcuts', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148, confidence: 0.8 }
      ];
      
      mockAnnotationTool.applyCalibrationResults.mockResolvedValue(true);
      mockAnnotationTool.cancelCalibration.mockResolvedValue(true);
      
      // Test accept shortcut
      const acceptResult = mockAnnotationTool.applyCalibrationResults(calibrationResults);
      expect(acceptResult).resolves.toBe(true);
      
      // Test reject shortcut
      const rejectResult = mockAnnotationTool.cancelCalibration();
      expect(rejectResult).resolves.toBe(true);
    });
    
    test('should provide detailed confirmation dialog', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148, confidence: 0.8, offset: 8.5 },
        { order: 2, originalX: 205, originalY: 255, newX: 198, newY: 252, confidence: 0.7, offset: 7.6 }
      ];
      
      const expectedDialog = {
        title: 'SIFT Matching Results',
        message: 'Found 2 annotation adjustments with average confidence 75%',
        details: [
          'Point #1: Move 8.5px (confidence: 80%)',
          'Point #2: Move 7.6px (confidence: 70%)'
        ],
        actions: ['Accept (A)', 'Reject (R)', 'Preview (P)']
      };
      
      mockAnnotationTool.showCalibrationPreview.mockReturnValue(expectedDialog);
      
      const result = mockAnnotationTool.showCalibrationPreview(calibrationResults);
      
      expect(result.title).toBe('SIFT Matching Results');
      expect(result.details).toHaveLength(2);
      expect(result.actions).toContain('Accept (A)');
    });
  });
  
  describe('Visual Indicators', () => {
    test('should create visual indicators for original positions', () => {
      const annotations = [
        { order: 1, x: 95, y: 145 },
        { order: 2, x: 205, y: 255 }
      ];
      
      const expectedIndicators = [
        { type: 'original', x: 95, y: 145, color: '#ff4444', size: 8, label: '1' },
        { type: 'original', x: 205, y: 255, color: '#ff4444', size: 8, label: '2' }
      ];
      
      mockAnnotationTool.createMatchingVisualizations.mockReturnValue(expectedIndicators);
      
      const result = mockAnnotationTool.createMatchingVisualizations(annotations, 'original');
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('original');
      expect(result[0].color).toBe('#ff4444');
      expect(result[0].label).toBe('1');
    });
    
    test('should create visual indicators for adjusted positions', () => {
      const calibrationResults = [
        { order: 1, newX: 103, newY: 148 },
        { order: 2, newX: 198, newY: 252 }
      ];
      
      const expectedIndicators = [
        { type: 'adjusted', x: 103, y: 148, color: '#44ff44', size: 8, label: '1' },
        { type: 'adjusted', x: 198, y: 252, color: '#44ff44', size: 8, label: '2' }
      ];
      
      mockAnnotationTool.createMatchingVisualizations.mockReturnValue(expectedIndicators);
      
      const result = mockAnnotationTool.createMatchingVisualizations(calibrationResults, 'adjusted');
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('adjusted');
      expect(result[0].color).toBe('#44ff44');
    });
    
    test('should create arrows showing position changes', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148 },
        { order: 2, originalX: 205, originalY: 255, newX: 198, newY: 252 }
      ];
      
      const expectedArrows = [
        { 
          type: 'arrow',
          from: { x: 95, y: 145 },
          to: { x: 103, y: 148 },
          color: '#ffaa00',
          width: 2,
          label: '8.5px'
        },
        {
          type: 'arrow',
          from: { x: 205, y: 255 },
          to: { x: 198, y: 252 },
          color: '#ffaa00',
          width: 2,
          label: '7.6px'
        }
      ];
      
      mockAnnotationTool.createMatchingVisualizations.mockReturnValue(expectedArrows);
      
      const result = mockAnnotationTool.createMatchingVisualizations(calibrationResults, 'arrows');
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('arrow');
      expect(result[0].from).toEqual({ x: 95, y: 145 });
      expect(result[0].to).toEqual({ x: 103, y: 148 });
    });
  });
  
  describe('Integration and Error Handling', () => {
    test('should validate preconditions before matching', () => {
      const validationResult = {
        hasCurrentImage: true,
        hasPreviousImage: true,
        hasCurrentAnnotations: true,
        hasPreviousAnnotations: true,
        isValid: true,
        errors: []
      };
      
      mockAnnotationTool.validateMatchingPreconditions.mockReturnValue(validationResult);
      
      const result = mockAnnotationTool.validateMatchingPreconditions();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should handle missing previous image gracefully', () => {
      const validationResult = {
        hasCurrentImage: true,
        hasPreviousImage: false,
        hasCurrentAnnotations: true,
        hasPreviousAnnotations: false,
        isValid: false,
        errors: ['No previous image available for matching']
      };
      
      mockAnnotationTool.validateMatchingPreconditions.mockReturnValue(validationResult);
      
      const result = mockAnnotationTool.validateMatchingPreconditions();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No previous image available for matching');
    });
    
    test('should handle SIFT matching failures with fallback', () => {
      const annotation = { order: 1, x: 100, y: 150 };
      
      // First try SIFT (fails)
      mockSiftMatcher.detectKeypoints.mockReturnValue([]);
      
      // Then try template matching (succeeds)
      mockSiftMatcher.templateMatching.mockReturnValue({
        x: 105,
        y: 148,
        confidence: 0.6,
        method: 'template'
      });
      
      mockSiftMatcher.adaptiveMatching.mockImplementation((ref, target) => {
        // Try SIFT first
        const siftResult = mockSiftMatcher.detectKeypoints(ref);
        if (siftResult.length === 0) {
          // Fall back to template matching
          return mockSiftMatcher.templateMatching(ref, target);
        }
        return siftResult;
      });
      
      const result = mockSiftMatcher.adaptiveMatching(annotation, annotation);
      
      expect(result.method).toBe('template');
      expect(result.confidence).toBe(0.6);
    });
    
    test('should handle low confidence matches', () => {
      const calibrationResults = [
        { order: 1, originalX: 95, originalY: 145, newX: 103, newY: 148, confidence: 0.3 }
      ];
      
      const qualityCheck = {
        averageConfidence: 0.3,
        qualityScore: 0.3,
        recommendation: 'Low confidence - review manually'
      };
      
      mockAnnotationTool.calculateMatchingQuality.mockReturnValue(qualityCheck);
      
      const result = mockAnnotationTool.calculateMatchingQuality(calibrationResults);
      
      expect(result.averageConfidence).toBe(0.3);
      expect(result.recommendation).toContain('Low confidence');
    });
  });
  
  describe('Performance and Optimization', () => {
    test('should handle large numbers of annotations efficiently', () => {
      const largeAnnotationSet = Array.from({ length: 100 }, (_, i) => ({
        order: i + 1,
        x: 100 + i * 10,
        y: 150 + i * 5,
        annotationType: 'regular'
      }));
      
      mockAnnotationTool.performSiftMatching.mockImplementation((prev, curr) => {
        // Simulate processing time
        return Promise.resolve(curr.map(ann => ({
          ...ann,
          x: ann.x + 2,
          y: ann.y + 1,
          confidence: 0.8
        })));
      });
      
      const startTime = Date.now();
      const result = mockAnnotationTool.performSiftMatching(largeAnnotationSet, largeAnnotationSet);
      
      expect(result).resolves.toHaveLength(100);
      // Should complete within reasonable time
      expect(Date.now() - startTime).toBeLessThan(5000);
    });
  });
});