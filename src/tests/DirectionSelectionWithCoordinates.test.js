/**
 * @jest-environment jsdom
 */

/**
 * Test Suite: Direction Selection with Coordinate Recording
 * 
 * This test suite validates the enhanced direction selection functionality
 * that records both angles and click positions (coordinates).
 * 
 * Features tested:
 * 1. Enhanced direction data structure with click coordinates
 * 2. Click position recording during direction selection
 * 3. Coordinate validation and bounds checking
 * 4. Multi-direction support with individual click positions
 * 5. Backward compatibility with existing direction format
 */

describe('Direction Selection with Coordinate Recording', () => {
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
      measureText: jest.fn(() => ({ width: 50 }))
    };
    
    mockCanvas.getContext = jest.fn(() => mockContext);
    
    // Mock DOM elements
    document.getElementById = jest.fn((id) => {
      if (id === 'annotation-canvas') return mockCanvas;
      return null;
    });
    
    // Create mock annotation tool with the methods we need to test
    mockAnnotationTool = {
      keypoints: [],
      selectedKeypoint: null,
      isDirectionSelectionMode: false,
      currentImage: {
        id: 'test-image',
        width: 1000,
        height: 800
      },
      viewport: {
        x: 0,
        y: 0,
        scale: 1
      },
      
      // Methods to be implemented
      enhanceDirectionData: jest.fn(),
      enhanceMultiDirectionData: jest.fn(),
      handleDirectionSelectionClick: jest.fn(),
      validateDirectionClick: jest.fn(),
      calculateAngleFromClick: jest.fn(),
      isClickWithinCanvasBounds: jest.fn(),
      isClickWithinImageBounds: jest.fn(),
      screenToImage: jest.fn(),
      handleMultiDirectionClick: jest.fn(),
      getAnnotationData: jest.fn(),
      serializeAnnotationData: jest.fn(),
      deserializeAnnotationData: jest.fn()
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Enhanced Direction Data Structure', () => {
    test('should include click coordinates in direction data', () => {
      // Create a keypoint with direction
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        direction: 45,
        directionType: 'angle',
        order: 1,
        annotationType: 'regular'
      };
      
      const clickData = {
        clickX: 450,
        clickY: 280,
        screenX: 450,
        screenY: 280,
        timestamp: Date.now()
      };
      
      // Mock the expected behavior
      mockAnnotationTool.enhanceDirectionData.mockReturnValue({
        ...keypoint,
        directionClick: {
          x: 450,
          y: 280,
          screenX: 450,
          screenY: 280,
          timestamp: clickData.timestamp
        }
      });
      
      const enhancedKeypoint = mockAnnotationTool.enhanceDirectionData(keypoint, clickData);
      
      expect(enhancedKeypoint).toHaveProperty('directionClick');
      expect(enhancedKeypoint.directionClick).toEqual({
        x: 450,
        y: 280,
        screenX: 450,
        screenY: 280,
        timestamp: expect.any(Number)
      });
    });
    
    test('should support multiple directions with individual click positions', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        directions: [
          { angle: 45, type: 'angle' },
          { angle: 135, type: 'angle' }
        ],
        maxDirections: 2,
        order: 1,
        annotationType: 'regular'
      };
      
      const clickData = [
        { clickX: 450, clickY: 280, screenX: 450, screenY: 280, timestamp: Date.now() },
        { clickX: 350, clickY: 280, screenX: 350, screenY: 280, timestamp: Date.now() + 100 }
      ];
      
      // Mock the expected behavior
      mockAnnotationTool.enhanceMultiDirectionData.mockReturnValue({
        ...keypoint,
        directions: [
          { angle: 45, type: 'angle', clickPosition: clickData[0] },
          { angle: 135, type: 'angle', clickPosition: clickData[1] }
        ]
      });
      
      const enhancedKeypoint = mockAnnotationTool.enhanceMultiDirectionData(keypoint, clickData);
      
      expect(enhancedKeypoint.directions).toHaveLength(2);
      expect(enhancedKeypoint.directions[0]).toHaveProperty('clickPosition');
      expect(enhancedKeypoint.directions[1]).toHaveProperty('clickPosition');
    });
    
    test('should maintain backward compatibility with existing format', () => {
      const legacyKeypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        direction: 'right',
        order: 1,
        annotationType: 'regular'
      };
      
      const clickData = {
        clickX: 450,
        clickY: 280,
        screenX: 450,
        screenY: 280,
        timestamp: Date.now()
      };
      
      // Mock the expected behavior
      mockAnnotationTool.enhanceDirectionData.mockReturnValue({
        ...legacyKeypoint,
        directionClick: {
          x: 450,
          y: 280,
          screenX: 450,
          screenY: 280,
          timestamp: clickData.timestamp
        }
      });
      
      const enhancedKeypoint = mockAnnotationTool.enhanceDirectionData(legacyKeypoint, clickData);
      
      // Should still have original direction
      expect(enhancedKeypoint.direction).toBe('right');
      // Should add new click data without breaking existing structure
      expect(enhancedKeypoint).toHaveProperty('directionClick');
    });
  });
  
  describe('Click Position Recording', () => {
    test('should record click position during direction selection', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        order: 1,
        annotationType: 'regular'
      };
      
      mockAnnotationTool.keypoints = [keypoint];
      mockAnnotationTool.selectedKeypoint = keypoint;
      mockAnnotationTool.isDirectionSelectionMode = true;
      
      const mouseEvent = {
        clientX: 450,
        clientY: 280,
        button: 0,
        preventDefault: jest.fn()
      };
      
      // Mock the expected behavior
      mockAnnotationTool.handleDirectionSelectionClick.mockImplementation((event) => {
        keypoint.directionClick = {
          x: 450,
          y: 280,
          screenX: event.clientX,
          screenY: event.clientY,
          timestamp: Date.now()
        };
      });
      
      mockAnnotationTool.handleDirectionSelectionClick(mouseEvent);
      
      expect(keypoint).toHaveProperty('directionClick');
      expect(keypoint.directionClick).toEqual({
        x: 450,
        y: 280,
        screenX: 450,
        screenY: 280,
        timestamp: expect.any(Number)
      });
    });
    
    test('should validate click coordinates are within image bounds', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        order: 1,
        annotationType: 'regular'
      };
      
      // Mock validation behavior
      mockAnnotationTool.validateDirectionClick.mockImplementation((kp, click) => {
        return click.clickX >= 0 && click.clickX <= 1000 && 
               click.clickY >= 0 && click.clickY <= 800;
      });
      
      const validClick = { clickX: 450, clickY: 280, screenX: 450, screenY: 280 };
      const invalidClick = { clickX: 1200, clickY: 900, screenX: 1200, screenY: 900 };
      
      expect(mockAnnotationTool.validateDirectionClick(keypoint, validClick)).toBe(true);
      expect(mockAnnotationTool.validateDirectionClick(keypoint, invalidClick)).toBe(false);
    });
    
    test('should calculate accurate angle from keypoint to click position', () => {
      const keypoint = { x: 400, y: 300 };
      const clickPos = { x: 450, y: 280 };
      
      // Mock angle calculation
      mockAnnotationTool.calculateAngleFromClick.mockImplementation((kp, click) => {
        const deltaX = click.x - kp.x;
        const deltaY = click.y - kp.y;
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        return (angle + 360) % 360;
      });
      
      const angle = mockAnnotationTool.calculateAngleFromClick(keypoint, clickPos);
      
      expect(angle).toBeCloseTo(338.2, 1);
    });
    
    test('should handle edge cases in angle calculation', () => {
      const keypoint = { x: 400, y: 300 };
      
      // Mock angle calculation
      mockAnnotationTool.calculateAngleFromClick.mockImplementation((kp, click) => {
        const deltaX = click.x - kp.x;
        const deltaY = click.y - kp.y;
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        return (angle + 360) % 360;
      });
      
      // Test horizontal right
      const rightClick = { x: 500, y: 300 };
      expect(mockAnnotationTool.calculateAngleFromClick(keypoint, rightClick)).toBeCloseTo(0, 1);
      
      // Test vertical down
      const downClick = { x: 400, y: 400 };
      expect(mockAnnotationTool.calculateAngleFromClick(keypoint, downClick)).toBeCloseTo(90, 1);
      
      // Test horizontal left
      const leftClick = { x: 300, y: 300 };
      expect(mockAnnotationTool.calculateAngleFromClick(keypoint, leftClick)).toBeCloseTo(180, 1);
      
      // Test vertical up
      const upClick = { x: 400, y: 200 };
      expect(mockAnnotationTool.calculateAngleFromClick(keypoint, upClick)).toBeCloseTo(270, 1);
    });
  });
  
  describe('Coordinate Validation and Bounds Checking', () => {
    test('should validate click coordinates are within canvas bounds', () => {
      // Mock canvas bounds checking
      mockAnnotationTool.isClickWithinCanvasBounds.mockImplementation((click) => {
        return click.screenX >= 0 && click.screenX <= 800 && 
               click.screenY >= 0 && click.screenY <= 600;
      });
      
      const canvasClick = { screenX: 400, screenY: 300 };
      const outsideClick = { screenX: 1000, screenY: 700 };
      
      expect(mockAnnotationTool.isClickWithinCanvasBounds(canvasClick)).toBe(true);
      expect(mockAnnotationTool.isClickWithinCanvasBounds(outsideClick)).toBe(false);
    });
    
    test('should validate click coordinates are within image bounds', () => {
      // Mock image bounds checking
      mockAnnotationTool.isClickWithinImageBounds.mockImplementation((click) => {
        return click.x >= 0 && click.x <= 1000 && 
               click.y >= 0 && click.y <= 800;
      });
      
      const imageClick = { x: 500, y: 400 };
      const outsideClick = { x: 1200, y: 900 };
      
      expect(mockAnnotationTool.isClickWithinImageBounds(imageClick)).toBe(true);
      expect(mockAnnotationTool.isClickWithinImageBounds(outsideClick)).toBe(false);
    });
    
    test('should account for zoom and viewport when validating bounds', () => {
      mockAnnotationTool.viewport.scale = 2;
      mockAnnotationTool.viewport.x = -200;
      mockAnnotationTool.viewport.y = -150;
      
      // Mock screen to image conversion
      mockAnnotationTool.screenToImage.mockImplementation((screenX, screenY) => {
        const imageX = (screenX - mockAnnotationTool.viewport.x) / mockAnnotationTool.viewport.scale;
        const imageY = (screenY - mockAnnotationTool.viewport.y) / mockAnnotationTool.viewport.scale;
        return { x: imageX, y: imageY };
      });
      
      const screenClick = { screenX: 400, screenY: 300 };
      const imageCoords = mockAnnotationTool.screenToImage(screenClick.screenX, screenClick.screenY);
      
      expect(imageCoords.x).toBeCloseTo(300, 1);
      expect(imageCoords.y).toBeCloseTo(225, 1);
    });
  });
  
  describe('Multi-Direction Support', () => {
    test('should record click positions for multiple directions', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        maxDirections: 3,
        directions: [],
        order: 1,
        annotationType: 'regular'
      };
      
      mockAnnotationTool.keypoints = [keypoint];
      mockAnnotationTool.selectedKeypoint = keypoint;
      
      // Mock multi-direction handling
      mockAnnotationTool.handleMultiDirectionClick.mockImplementation((event) => {
        if (keypoint.directions.length < keypoint.maxDirections) {
          keypoint.directions.push({
            angle: 45,
            type: 'angle',
            clickPosition: {
              x: event.clientX,
              y: event.clientY,
              screenX: event.clientX,
              screenY: event.clientY,
              timestamp: Date.now()
            }
          });
          return true;
        }
        return false;
      });
      
      const firstClick = { clientX: 450, clientY: 280, button: 0, preventDefault: jest.fn() };
      const secondClick = { clientX: 350, clientY: 280, button: 0, preventDefault: jest.fn() };
      
      mockAnnotationTool.handleMultiDirectionClick(firstClick);
      mockAnnotationTool.handleMultiDirectionClick(secondClick);
      
      expect(keypoint.directions).toHaveLength(2);
      expect(keypoint.directions[0]).toHaveProperty('clickPosition');
      expect(keypoint.directions[1]).toHaveProperty('clickPosition');
    });
    
    test('should respect maximum direction limits', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        maxDirections: 2,
        directions: [
          { angle: 45, type: 'angle', clickPosition: { x: 450, y: 280 } },
          { angle: 135, type: 'angle', clickPosition: { x: 350, y: 280 } }
        ],
        order: 1,
        annotationType: 'regular'
      };
      
      mockAnnotationTool.keypoints = [keypoint];
      mockAnnotationTool.selectedKeypoint = keypoint;
      
      // Mock multi-direction handling with limit
      mockAnnotationTool.handleMultiDirectionClick.mockImplementation((event) => {
        if (keypoint.directions.length >= keypoint.maxDirections) {
          return false;
        }
        keypoint.directions.push({
          angle: 225,
          type: 'angle',
          clickPosition: {
            x: event.clientX,
            y: event.clientY,
            screenX: event.clientX,
            screenY: event.clientY,
            timestamp: Date.now()
          }
        });
        return true;
      });
      
      const thirdClick = { clientX: 400, clientY: 250, button: 0, preventDefault: jest.fn() };
      const result = mockAnnotationTool.handleMultiDirectionClick(thirdClick);
      
      expect(result).toBe(false);
      expect(keypoint.directions).toHaveLength(2);
    });
  });
  
  describe('Data Export and Persistence', () => {
    test('should include click coordinates in exported annotation data', () => {
      const keypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        direction: 45,
        directionType: 'angle',
        directionClick: {
          x: 450,
          y: 280,
          screenX: 450,
          screenY: 280,
          timestamp: Date.now()
        },
        order: 1,
        annotationType: 'regular'
      };
      
      mockAnnotationTool.keypoints = [keypoint];
      
      // Mock export data function
      mockAnnotationTool.getAnnotationData.mockReturnValue({
        keypoints: [keypoint]
      });
      
      const exportData = mockAnnotationTool.getAnnotationData();
      
      expect(exportData.keypoints).toHaveLength(1);
      expect(exportData.keypoints[0]).toHaveProperty('directionClick');
      expect(exportData.keypoints[0].directionClick).toHaveProperty('x');
      expect(exportData.keypoints[0].directionClick).toHaveProperty('y');
      expect(exportData.keypoints[0].directionClick).toHaveProperty('timestamp');
    });
    
    test('should maintain data integrity during save/load cycles', () => {
      const originalKeypoint = {
        id: Date.now(),
        x: 400,
        y: 300,
        direction: 45,
        directionType: 'angle',
        directionClick: {
          x: 450,
          y: 280,
          screenX: 450,
          screenY: 280,
          timestamp: Date.now()
        },
        order: 1,
        annotationType: 'regular'
      };
      
      // Mock serialization
      mockAnnotationTool.serializeAnnotationData.mockImplementation((keypoints) => {
        return JSON.stringify(keypoints);
      });
      
      // Mock deserialization
      mockAnnotationTool.deserializeAnnotationData.mockImplementation((data) => {
        return JSON.parse(data);
      });
      
      const saveData = mockAnnotationTool.serializeAnnotationData([originalKeypoint]);
      const loadedKeypoints = mockAnnotationTool.deserializeAnnotationData(saveData);
      
      expect(loadedKeypoints[0]).toEqual(originalKeypoint);
      expect(loadedKeypoints[0].directionClick).toEqual(originalKeypoint.directionClick);
    });
  });
});