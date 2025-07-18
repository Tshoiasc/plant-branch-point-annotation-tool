// Jest setup file for global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep error logging for debugging
};

// Mock window.PlantAnnotationTool if needed
global.window = global.window || {};
window.PlantAnnotationTool = window.PlantAnnotationTool || {};