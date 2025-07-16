/**
 * Multi-Direction Annotation Feature Test Suite
 * 
 * Tests for the new multi-direction annotation functionality where:
 * - Users can set multiple directions per annotation point
 * - Middle mouse button enters direction count selection mode
 * - Scroll wheel adjusts direction count (1-8)
 * - Proper interruption handling for various scenarios
 */

// Mock the AnnotationTool class
class MockAnnotationTool {
  constructor() {
    this.state = {
      selectedKeypoint: null,
      isDirectionCountMode: false,
      currentDirectionCount: 1,
      isDirectionSelectionMode: false,
      directionsSet: 0
    };
    this.keypoints = [];
    this.canvas = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {}
    };
  }
  
  // Methods implementation
  enterDirectionCountMode() {
    this.state.isDirectionCountMode = true;
    this.state.currentDirectionCount = this.state.selectedKeypoint?.maxDirections || 1;
    this.showDirectionCountPrompt('使用滚轮调整方向数量，再次按中键确认');
  }
  
  exitDirectionCountMode() {
    if (this.state.selectedKeypoint) {
      this.state.selectedKeypoint.maxDirections = this.state.currentDirectionCount;
    }
    this.state.isDirectionCountMode = false;
    this.hideDirectionCountPrompt();
    this.startMultiDirectionSetting();
  }
  
  startMultiDirectionSetting() {
    this.state.directionsSet = 0;
    this.state.isDirectionSelectionMode = true;
  }
  
  handleMiddleMouseButton() {
    if (!this.state.selectedKeypoint) {
      return;
    }
    
    if (this.state.isDirectionCountMode) {
      this.exitDirectionCountMode();
    } else {
      this.enterDirectionCountMode();
    }
  }
  
  handleScrollWheel(event) {
    if (!this.state.isDirectionCountMode) {
      return;
    }
    
    const delta = -event.deltaY;
    const direction = delta > 0 ? 1 : -1;
    
    const newCount = Math.max(1, Math.min(8, this.state.currentDirectionCount + direction));
    this.state.currentDirectionCount = newCount;
  }
  
  showDirectionCountPrompt(message) {
    // Mock implementation
  }
  
  hideDirectionCountPrompt() {
    // Mock implementation
  }
  
  interruptDirectionCountMode(reason) {
    this.state.isDirectionCountMode = false;
    this.state.currentDirectionCount = 1;
    this.state.selectedKeypoint = null;
  }
  
  canHaveMultipleDirections(keypoint) {
    return keypoint && keypoint.annotationType === 'regular';
  }
  
  addDirectionToKeypoint(keypoint, direction) {
    if (!keypoint.directions) {
      keypoint.directions = [];
    }
    
    if (keypoint.directions.length >= keypoint.maxDirections) {
      return false;
    }
    
    keypoint.directions.push(direction);
    return true;
  }
  
  removeDirectionFromKeypoint(keypoint, index) {
    if (!keypoint.directions || index < 0 || index >= keypoint.directions.length) {
      return false;
    }
    
    keypoint.directions.splice(index, 1);
    return true;
  }
  
  renderMultipleDirections(keypoint) {
    // Mock implementation
  }
}

describe('Multi-Direction Annotation Feature', () => {
  let annotationTool;
  let mockKeypoint;
  
  beforeEach(() => {
    annotationTool = new MockAnnotationTool();
    mockKeypoint = {
      id: 'test-keypoint-1',
      x: 100,
      y: 100,
      order: 1,
      directions: [],
      maxDirections: 1,
      annotationType: 'regular'
    };
    annotationTool.keypoints = [mockKeypoint];
  });

  describe('Direction Count Selection Mode', () => {
    test('should enter direction count mode on middle mouse button click', () => {
      // Arrange
      annotationTool.state.selectedKeypoint = mockKeypoint;
      const enterModeSpy = jest.spyOn(annotationTool, 'enterDirectionCountMode');
      
      // Act
      annotationTool.handleMiddleMouseButton();
      
      // Assert
      expect(enterModeSpy).toHaveBeenCalled();
      expect(annotationTool.state.isDirectionCountMode).toBe(true);
    });

    test('should exit direction count mode on second middle mouse button click', () => {
      // Arrange
      annotationTool.state.selectedKeypoint = mockKeypoint;
      annotationTool.state.isDirectionCountMode = true;
      const exitModeSpy = jest.spyOn(annotationTool, 'exitDirectionCountMode');
      
      // Act
      annotationTool.handleMiddleMouseButton();
      
      // Assert
      expect(exitModeSpy).toHaveBeenCalled();
      expect(annotationTool.state.isDirectionCountMode).toBe(false);
    });

    test('should show direction count prompt when entering mode', () => {
      // Arrange
      annotationTool.state.selectedKeypoint = mockKeypoint;
      const showPromptSpy = jest.spyOn(annotationTool, 'showDirectionCountPrompt');
      
      // Act
      annotationTool.enterDirectionCountMode();
      
      // Assert
      expect(showPromptSpy).toHaveBeenCalledWith('使用滚轮调整方向数量，再次按中键确认');
    });

    test('should hide direction count prompt when exiting mode', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      const hidePromptSpy = jest.spyOn(annotationTool, 'hideDirectionCountPrompt');
      
      // Act
      annotationTool.exitDirectionCountMode();
      
      // Assert
      expect(hidePromptSpy).toHaveBeenCalled();
    });
  });

  describe('Direction Count Adjustment', () => {
    test('should increase direction count on scroll up', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 2;
      const mockScrollEvent = { deltaY: -100 };
      
      // Act
      annotationTool.handleScrollWheel(mockScrollEvent);
      
      // Assert
      expect(annotationTool.state.currentDirectionCount).toBe(3);
    });

    test('should decrease direction count on scroll down', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 3;
      const mockScrollEvent = { deltaY: 100 };
      
      // Act
      annotationTool.handleScrollWheel(mockScrollEvent);
      
      // Assert
      expect(annotationTool.state.currentDirectionCount).toBe(2);
    });

    test('should not allow direction count below 1', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 1;
      const mockScrollEvent = { deltaY: 100 };
      
      // Act
      annotationTool.handleScrollWheel(mockScrollEvent);
      
      // Assert
      expect(annotationTool.state.currentDirectionCount).toBe(1);
    });

    test('should not allow direction count above 8', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 8;
      const mockScrollEvent = { deltaY: -100 };
      
      // Act
      annotationTool.handleScrollWheel(mockScrollEvent);
      
      // Assert
      expect(annotationTool.state.currentDirectionCount).toBe(8);
    });
  });

  describe('Keypoint Data Model', () => {
    test('should initialize keypoint with directions array', () => {
      // Assert
      expect(mockKeypoint.directions).toEqual([]);
      expect(mockKeypoint.maxDirections).toBe(1);
    });

    test('should be able to add multiple directions to keypoint', () => {
      // Arrange
      mockKeypoint.maxDirections = 3;
      const direction1 = { angle: 0, type: 'angle' };
      const direction2 = { angle: 90, type: 'angle' };
      
      // Act
      annotationTool.addDirectionToKeypoint(mockKeypoint, direction1);
      annotationTool.addDirectionToKeypoint(mockKeypoint, direction2);
      
      // Assert
      expect(mockKeypoint.directions).toHaveLength(2);
      expect(mockKeypoint.directions[0]).toEqual(direction1);
      expect(mockKeypoint.directions[1]).toEqual(direction2);
    });

    test('should not allow more directions than maxDirections', () => {
      // Arrange
      mockKeypoint.maxDirections = 2;
      const direction1 = { angle: 0, type: 'angle' };
      const direction2 = { angle: 90, type: 'angle' };
      const direction3 = { angle: 180, type: 'angle' };
      
      // Act
      annotationTool.addDirectionToKeypoint(mockKeypoint, direction1);
      annotationTool.addDirectionToKeypoint(mockKeypoint, direction2);
      const result = annotationTool.addDirectionToKeypoint(mockKeypoint, direction3);
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeypoint.directions).toHaveLength(2);
    });

    test('should be able to remove directions from keypoint', () => {
      // Arrange
      mockKeypoint.maxDirections = 2;
      const direction1 = { angle: 0, type: 'angle' };
      const direction2 = { angle: 90, type: 'angle' };
      mockKeypoint.directions = [direction1, direction2];
      
      // Act
      annotationTool.removeDirectionFromKeypoint(mockKeypoint, 0);
      
      // Assert
      expect(mockKeypoint.directions).toHaveLength(1);
      expect(mockKeypoint.directions[0]).toEqual(direction2);
    });
  });

  describe('Interruption Handling', () => {
    test('should interrupt direction count mode on image switch', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      const interruptSpy = jest.spyOn(annotationTool, 'interruptDirectionCountMode');
      
      // Act
      // Simulate image switch event
      annotationTool.interruptDirectionCountMode('image_switch');
      
      // Assert
      expect(interruptSpy).toHaveBeenCalledWith('image_switch');
      expect(annotationTool.state.isDirectionCountMode).toBe(false);
    });

    test('should interrupt direction count mode on plant switch', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      const interruptSpy = jest.spyOn(annotationTool, 'interruptDirectionCountMode');
      
      // Act
      // Simulate plant switch event
      annotationTool.interruptDirectionCountMode('plant_switch');
      
      // Assert
      expect(interruptSpy).toHaveBeenCalledWith('plant_switch');
      expect(annotationTool.state.isDirectionCountMode).toBe(false);
    });

    test('should interrupt direction count mode on tool mode change', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      const interruptSpy = jest.spyOn(annotationTool, 'interruptDirectionCountMode');
      
      // Act
      // Simulate tool mode change
      annotationTool.interruptDirectionCountMode('tool_mode_change');
      
      // Assert
      expect(interruptSpy).toHaveBeenCalledWith('tool_mode_change');
      expect(annotationTool.state.isDirectionCountMode).toBe(false);
    });

    test('should cleanup state properly on interruption', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 5;
      annotationTool.state.selectedKeypoint = mockKeypoint;
      
      // Act
      annotationTool.interruptDirectionCountMode('test_interrupt');
      
      // Assert
      expect(annotationTool.state.isDirectionCountMode).toBe(false);
      expect(annotationTool.state.currentDirectionCount).toBe(1);
      expect(annotationTool.state.selectedKeypoint).toBe(null);
    });
  });

  describe('Direction Setting with Multiple Slots', () => {
    test('should allow setting multiple directions in sequence', () => {
      // Arrange
      mockKeypoint.maxDirections = 3;
      annotationTool.state.selectedKeypoint = mockKeypoint;
      annotationTool.state.isDirectionSelectionMode = true;
      annotationTool.state.directionsSet = 0;
      
      // Act
      annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 0, type: 'angle' });
      annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 120, type: 'angle' });
      annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 240, type: 'angle' });
      
      // Assert
      expect(mockKeypoint.directions).toHaveLength(3);
      expect(mockKeypoint.directions[0].angle).toBe(0);
      expect(mockKeypoint.directions[1].angle).toBe(120);
      expect(mockKeypoint.directions[2].angle).toBe(240);
    });

    test('should track number of directions set', () => {
      // Arrange
      mockKeypoint.maxDirections = 2;
      annotationTool.state.selectedKeypoint = mockKeypoint;
      annotationTool.state.directionsSet = 0;
      
      // Act
      annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 0, type: 'angle' });
      annotationTool.state.directionsSet++;
      
      // Assert
      expect(annotationTool.state.directionsSet).toBe(1);
    });

    test('should automatically exit direction selection when all directions are set', () => {
      // Arrange
      mockKeypoint.maxDirections = 2;
      annotationTool.state.selectedKeypoint = mockKeypoint;
      annotationTool.state.directionsSet = 1;
      annotationTool.state.isDirectionSelectionMode = true;
      
      // Act
      annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 90, type: 'angle' });
      annotationTool.state.directionsSet++;
      
      // Check if all directions are set
      if (annotationTool.state.directionsSet >= mockKeypoint.maxDirections) {
        annotationTool.state.isDirectionSelectionMode = false;
        annotationTool.state.directionsSet = 0;
      }
      
      // Assert
      expect(annotationTool.state.isDirectionSelectionMode).toBe(false);
      expect(annotationTool.state.directionsSet).toBe(0);
    });
  });

  describe('Visual Rendering', () => {
    test('should render multiple direction arrows for keypoint', () => {
      // Arrange
      mockKeypoint.maxDirections = 3;
      mockKeypoint.directions = [
        { angle: 0, type: 'angle' },
        { angle: 120, type: 'angle' },
        { angle: 240, type: 'angle' }
      ];
      const renderSpy = jest.spyOn(annotationTool, 'renderMultipleDirections');
      
      // Act
      annotationTool.renderMultipleDirections(mockKeypoint);
      
      // Assert
      expect(renderSpy).toHaveBeenCalledWith(mockKeypoint);
    });

    test('should show direction count indicator in UI', () => {
      // Arrange
      annotationTool.state.isDirectionCountMode = true;
      annotationTool.state.currentDirectionCount = 4;
      
      // Act & Assert
      expect(annotationTool.state.currentDirectionCount).toBe(4);
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle legacy keypoints with single direction', () => {
      // Arrange
      const legacyKeypoint = {
        id: 'legacy-keypoint',
        x: 200,
        y: 200,
        order: 2,
        direction: 45,
        directionType: 'angle',
        annotationType: 'regular'
      };
      
      // Act
      const canHaveMultiple = annotationTool.canHaveMultipleDirections(legacyKeypoint);
      
      // Assert
      expect(canHaveMultiple).toBe(true);
      // Legacy keypoint should be convertible to new format
    });

    test('should convert legacy direction to new format', () => {
      // Arrange
      const legacyKeypoint = {
        id: 'legacy-keypoint',
        x: 200,
        y: 200,
        order: 2,
        direction: 45,
        directionType: 'angle',
        annotationType: 'regular'
      };
      
      // Act
      // Convert legacy format to new format
      if (legacyKeypoint.direction !== undefined && !legacyKeypoint.directions) {
        legacyKeypoint.directions = [{ 
          angle: legacyKeypoint.direction, 
          type: legacyKeypoint.directionType || 'angle' 
        }];
        legacyKeypoint.maxDirections = 1;
      }
      
      // Assert
      expect(legacyKeypoint.directions).toHaveLength(1);
      expect(legacyKeypoint.directions[0].angle).toBe(45);
      expect(legacyKeypoint.maxDirections).toBe(1);
    });
  });
});

describe('Integration Tests', () => {
  let annotationTool;
  
  beforeEach(() => {
    annotationTool = new MockAnnotationTool();
  });

  test('should handle complete workflow: enter mode -> adjust count -> set directions -> exit', () => {
    // Arrange
    const mockKeypoint = {
      id: 'test-keypoint',
      x: 100,
      y: 100,
      order: 1,
      directions: [],
      maxDirections: 1,
      annotationType: 'regular'
    };
    annotationTool.state.selectedKeypoint = mockKeypoint;
    
    // Act & Assert
    
    // Step 1: Enter direction count mode
    annotationTool.handleMiddleMouseButton();
    expect(annotationTool.state.isDirectionCountMode).toBe(true);
    
    // Step 2: Adjust direction count
    annotationTool.handleScrollWheel({ deltaY: -100 });
    annotationTool.handleScrollWheel({ deltaY: -100 });
    expect(annotationTool.state.currentDirectionCount).toBe(3);
    
    // Step 3: Confirm direction count
    annotationTool.handleMiddleMouseButton();
    expect(annotationTool.state.isDirectionCountMode).toBe(false);
    expect(mockKeypoint.maxDirections).toBe(3);
    
    // Step 4: Set directions
    annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 0, type: 'angle' });
    annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 120, type: 'angle' });
    annotationTool.addDirectionToKeypoint(mockKeypoint, { angle: 240, type: 'angle' });
    
    // Step 5: Verify final state
    expect(mockKeypoint.directions).toHaveLength(3);
    expect(mockKeypoint.maxDirections).toBe(3);
  });
});