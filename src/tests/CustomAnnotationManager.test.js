/**
 * Test file for CustomAnnotationManager
 * 
 * 测试自定义标注管理器的功能
 */

import { CustomAnnotationManager } from '../core/CustomAnnotationManager.js';

/**
 * Test Suite for CustomAnnotationManager
 */
class CustomAnnotationManagerTestSuite {
  constructor() {
    this.testResults = [];
    this.customAnnotationManager = null;
  }

  /**
   * Set up before each test
   */
  setUp() {
    this.customAnnotationManager = new CustomAnnotationManager();
  }

  /**
   * Test assertion helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Test equality helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Assertion failed: ${message}. Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Test array length helper
   */
  assertArrayLength(array, expectedLength, message) {
    if (array.length !== expectedLength) {
      throw new Error(`Assertion failed: ${message}. Expected length ${expectedLength}, got ${array.length}`);
    }
  }

  /**
   * Test initialization
   */
  testInitialization() {
    this.setUp();
    
    this.assert(this.customAnnotationManager.customTypes instanceof Map, 'Should initialize with Map for custom types');
    this.assert(this.customAnnotationManager.customAnnotations instanceof Map, 'Should initialize with Map for custom annotations');
    this.assertEqual(this.customAnnotationManager.isEnabled, true, 'Should be enabled by default');
    this.assertEqual(this.customAnnotationManager.currentMode, 'normal', 'Should start in normal mode');
    this.assertEqual(this.customAnnotationManager.selectedCustomType, null, 'Should have no selected custom type');
    
    return 'Initialization test passed';
  }

  /**
   * Test custom type creation
   */
  testCreateCustomType() {
    this.setUp();
    
    const typeData = {
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000',
      description: '测试用的自定义点',
      metadata: { category: 'test' }
    };
    
    const createdType = this.customAnnotationManager.createCustomType(typeData);
    
    this.assertEqual(createdType.id, 'test-point', 'Created type should have correct ID');
    this.assertEqual(createdType.name, '测试点', 'Created type should have correct name');
    this.assertEqual(createdType.type, 'point', 'Created type should have correct type');
    this.assertEqual(createdType.color, '#ff0000', 'Created type should have correct color');
    this.assert(this.customAnnotationManager.customTypes.has('test-point'), 'Type should be stored in customTypes map');
    
    return 'Create custom type test passed';
  }

  /**
   * Test custom region type creation
   */
  testCreateCustomRegionType() {
    this.setUp();
    
    const typeData = {
      id: 'test-region',
      name: '测试区域',
      type: 'region',
      color: '#00ff00',
      description: '测试用的自定义区域',
      metadata: { category: 'test' }
    };
    
    const createdType = this.customAnnotationManager.createCustomType(typeData);
    
    this.assertEqual(createdType.id, 'test-region', 'Created region type should have correct ID');
    this.assertEqual(createdType.type, 'region', 'Created region type should have correct type');
    this.assertEqual(createdType.color, '#00ff00', 'Created region type should have correct color');
    
    return 'Create custom region type test passed';
  }

  /**
   * Test custom type update
   */
  testUpdateCustomType() {
    this.setUp();
    
    const typeData = {
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    };
    
    this.customAnnotationManager.createCustomType(typeData);
    
    const updatedData = {
      id: 'test-point',
      name: '更新的测试点',
      color: '#0000ff'
    };
    
    const updatedType = this.customAnnotationManager.updateCustomType('test-point', updatedData);
    
    this.assertEqual(updatedType.name, '更新的测试点', 'Updated type should have new name');
    this.assertEqual(updatedType.color, '#0000ff', 'Updated type should have new color');
    this.assertEqual(updatedType.type, 'point', 'Updated type should preserve original type');
    
    return 'Update custom type test passed';
  }

  /**
   * Test custom type deletion
   */
  testDeleteCustomType() {
    this.setUp();
    
    const typeData = {
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    };
    
    this.customAnnotationManager.createCustomType(typeData);
    this.assert(this.customAnnotationManager.customTypes.has('test-point'), 'Type should exist before deletion');
    
    const deleted = this.customAnnotationManager.deleteCustomType('test-point');
    this.assertEqual(deleted, true, 'Should return true when deleting existing type');
    this.assert(!this.customAnnotationManager.customTypes.has('test-point'), 'Type should not exist after deletion');
    
    return 'Delete custom type test passed';
  }

  /**
   * Test get all custom types
   */
  testGetAllCustomTypes() {
    this.setUp();
    
    const type1 = { id: 'type1', name: '类型1', type: 'point', color: '#ff0000' };
    const type2 = { id: 'type2', name: '类型2', type: 'region', color: '#00ff00' };
    
    this.customAnnotationManager.createCustomType(type1);
    this.customAnnotationManager.createCustomType(type2);
    
    const types = this.customAnnotationManager.getAllCustomTypes();
    this.assertArrayLength(types, 2, 'Should return all custom types');
    
    const typeIds = types.map(t => t.id);
    this.assert(typeIds.includes('type1'), 'Should include type1');
    this.assert(typeIds.includes('type2'), 'Should include type2');
    
    return 'Get all custom types test passed';
  }

  /**
   * Test custom annotation creation
   */
  testCreateCustomAnnotation() {
    this.setUp();
    
    // Create custom type first
    this.customAnnotationManager.createCustomType({
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    });
    
    const pointData = {
      typeId: 'test-point',
      x: 100,
      y: 200,
      imageId: 'test-image-1'
    };
    
    const annotation = this.customAnnotationManager.createCustomAnnotation(pointData);
    
    this.assertEqual(annotation.typeId, 'test-point', 'Annotation should have correct typeId');
    this.assertEqual(annotation.x, 100, 'Annotation should have correct x coordinate');
    this.assertEqual(annotation.y, 200, 'Annotation should have correct y coordinate');
    this.assertEqual(annotation.imageId, 'test-image-1', 'Annotation should have correct imageId');
    this.assert(annotation.id, 'Annotation should have an ID');
    this.assertEqual(annotation.order, 1, 'First annotation should have order 1');
    
    return 'Create custom annotation test passed';
  }

  /**
   * Test custom region annotation creation
   */
  testCreateCustomRegionAnnotation() {
    this.setUp();
    
    // Create custom region type first
    this.customAnnotationManager.createCustomType({
      id: 'test-region',
      name: '测试区域',
      type: 'region',
      color: '#00ff00'
    });
    
    const regionData = {
      typeId: 'test-region',
      x: 50,
      y: 75,
      width: 200,
      height: 150,
      imageId: 'test-image-1'
    };
    
    const annotation = this.customAnnotationManager.createCustomAnnotation(regionData);
    
    this.assertEqual(annotation.typeId, 'test-region', 'Region annotation should have correct typeId');
    this.assertEqual(annotation.x, 50, 'Region annotation should have correct x coordinate');
    this.assertEqual(annotation.y, 75, 'Region annotation should have correct y coordinate');
    this.assertEqual(annotation.width, 200, 'Region annotation should have correct width');
    this.assertEqual(annotation.height, 150, 'Region annotation should have correct height');
    
    return 'Create custom region annotation test passed';
  }

  /**
   * Test sequential order numbering
   */
  testSequentialOrderNumbering() {
    this.setUp();
    
    // Create custom type first
    this.customAnnotationManager.createCustomType({
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    });
    
    const point1 = this.customAnnotationManager.createCustomAnnotation({
      typeId: 'test-point',
      x: 100,
      y: 200,
      imageId: 'test-image-1'
    });
    
    const point2 = this.customAnnotationManager.createCustomAnnotation({
      typeId: 'test-point',
      x: 150,
      y: 250,
      imageId: 'test-image-1'
    });
    
    this.assertEqual(point1.order, 1, 'First annotation should have order 1');
    this.assertEqual(point2.order, 2, 'Second annotation should have order 2');
    
    return 'Sequential order numbering test passed';
  }

  /**
   * Test mode management
   */
  testModeManagement() {
    this.setUp();
    
    // Create custom type first
    this.customAnnotationManager.createCustomType({
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    });
    
    // Test switching to custom mode
    this.customAnnotationManager.setCustomAnnotationMode('test-point');
    this.assertEqual(this.customAnnotationManager.currentMode, 'custom', 'Should switch to custom mode');
    this.assertEqual(this.customAnnotationManager.selectedCustomType, 'test-point', 'Should select the custom type');
    this.assert(this.customAnnotationManager.isInCustomMode(), 'Should be in custom mode');
    
    // Test switching back to normal mode
    this.customAnnotationManager.setNormalMode();
    this.assertEqual(this.customAnnotationManager.currentMode, 'normal', 'Should switch back to normal mode');
    this.assertEqual(this.customAnnotationManager.selectedCustomType, null, 'Should clear selected custom type');
    this.assert(!this.customAnnotationManager.isInCustomMode(), 'Should not be in custom mode');
    
    return 'Mode management test passed';
  }

  /**
   * Test canvas click handling
   */
  testCanvasClickHandling() {
    this.setUp();
    
    // Create custom type first
    this.customAnnotationManager.createCustomType({
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    });
    
    this.customAnnotationManager.setCustomAnnotationMode('test-point');
    
    const result = this.customAnnotationManager.handleCanvasClick({
      x: 100,
      y: 200,
      imageId: 'test-image-1'
    });
    
    this.assertEqual(result.success, true, 'Click handling should succeed');
    this.assertEqual(result.annotation.typeId, 'test-point', 'Created annotation should have correct typeId');
    this.assertEqual(result.annotation.x, 100, 'Created annotation should have correct x coordinate');
    this.assertEqual(result.annotation.y, 200, 'Created annotation should have correct y coordinate');
    
    return 'Canvas click handling test passed';
  }

  /**
   * Test region drag handling
   */
  testRegionDragHandling() {
    this.setUp();
    
    // Create custom region type first
    this.customAnnotationManager.createCustomType({
      id: 'test-region',
      name: '测试区域',
      type: 'region',
      color: '#00ff00'
    });
    
    this.customAnnotationManager.setCustomAnnotationMode('test-region');
    
    const result = this.customAnnotationManager.handleRegionDrag({
      startX: 50,
      startY: 75,
      endX: 250,
      endY: 225,
      imageId: 'test-image-1'
    });
    
    this.assertEqual(result.success, true, 'Region drag handling should succeed');
    this.assertEqual(result.annotation.typeId, 'test-region', 'Created annotation should have correct typeId');
    this.assertEqual(result.annotation.x, 50, 'Created annotation should have correct x coordinate');
    this.assertEqual(result.annotation.y, 75, 'Created annotation should have correct y coordinate');
    this.assertEqual(result.annotation.width, 200, 'Created annotation should have correct width');
    this.assertEqual(result.annotation.height, 150, 'Created annotation should have correct height');
    
    return 'Region drag handling test passed';
  }

  /**
   * Test data export
   */
  testDataExport() {
    this.setUp();
    
    // Create custom type
    this.customAnnotationManager.createCustomType({
      id: 'test-point',
      name: '测试点',
      type: 'point',
      color: '#ff0000'
    });
    
    // Create annotation
    this.customAnnotationManager.createCustomAnnotation({
      typeId: 'test-point',
      x: 100,
      y: 200,
      imageId: 'test-image-1'
    });
    
    const exportData = this.customAnnotationManager.exportData();
    
    this.assertArrayLength(exportData.customTypes, 1, 'Should export one custom type');
    this.assertArrayLength(exportData.customAnnotations, 1, 'Should export one annotation');
    this.assert(exportData.version, 'Should include version in export');
    this.assert(exportData.exportTime, 'Should include export time');
    
    return 'Data export test passed';
  }

  /**
   * Test data import
   */
  testDataImport() {
    this.setUp();
    
    const importData = {
      version: '1.0',
      customTypes: [{
        id: 'imported-point',
        name: '导入的点',
        type: 'point',
        color: '#0000ff'
      }],
      customAnnotations: [{
        id: 'ann-1',
        typeId: 'imported-point',
        x: 150,
        y: 300,
        imageId: 'imported-image-1',
        order: 1
      }]
    };
    
    const result = this.customAnnotationManager.importData(importData);
    
    this.assertEqual(result.success, true, 'Import should succeed');
    this.assert(this.customAnnotationManager.customTypes.has('imported-point'), 'Should import custom type');
    
    const importedAnnotations = this.customAnnotationManager.getAnnotationsByImageId('imported-image-1');
    this.assertArrayLength(importedAnnotations, 1, 'Should import annotation');
    
    return 'Data import test passed';
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    const tests = [
      'testInitialization',
      'testCreateCustomType',
      'testCreateCustomRegionType',
      'testUpdateCustomType',
      'testDeleteCustomType',
      'testGetAllCustomTypes',
      'testCreateCustomAnnotation',
      'testCreateCustomRegionAnnotation',
      'testSequentialOrderNumbering',
      'testModeManagement',
      'testCanvasClickHandling',
      'testRegionDragHandling',
      'testDataExport',
      'testDataImport'
    ];

    console.log('🚀 Starting CustomAnnotationManager Tests...\n');

    for (const testName of tests) {
      try {
        const result = this[testName]();
        console.log(`✅ ${testName}: ${result}`);
        this.testResults.push({ name: testName, status: 'PASSED', result });
      } catch (error) {
        console.log(`❌ ${testName}: ${error.message}`);
        this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
      }
    }

    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const total = this.testResults.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('❌ Some tests failed. Check the output above.');
    }

    return this.testResults;
  }
}

// Export for use in browser or Node.js
export { CustomAnnotationManagerTestSuite };

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
  window.CustomAnnotationManagerTestSuite = CustomAnnotationManagerTestSuite;
}

// Run tests immediately if in browser
if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('test')) {
  const testSuite = new CustomAnnotationManagerTestSuite();
  testSuite.runAllTests();
}