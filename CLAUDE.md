# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Plant Branch Point Annotation Tool** - a professional web application for processing Brassica napus (rapeseed) datasets. It features intelligent keypoint annotation, custom annotation types, real-time synchronization, and comprehensive data export capabilities.

## Architecture

### Frontend-Backend Architecture
- **Frontend**: ES6+ JavaScript modules with Vite build system
- **Backend**: Node.js Express server for dataset management
- **Communication**: RESTful API over HTTP
- **Storage**: JSON files + IndexedDB for caching

### Key Technology Stack
- **Build Tool**: Vite 5.0 with legacy browser support
- **Runtime**: Node.js >=16.0.0
- **APIs**: Canvas API, IndexedDB, HTTP File System API
- **Styling**: CSS3 with CSS variables, Grid, Flexbox

## Development Commands

### Essential Commands
```bash
# Start both backend and frontend
npm start

# Frontend only (development with hot reload)
npm run dev

# Backend only (data services)
npm run storage

# Build for production
npm run build

# Run tests
npm test

# Lint and fix code
npm run lint
npm run lint:fix

# Health check
npm run health

# Setup project dependencies
npm run setup
```

### Backend Service Commands
```bash
# Start backend service manually
./start-backend.sh

# Check backend connection
curl http://localhost:3003/api/health

# Stop backend if needed
pkill -f "node.*server.js"
```

## Core Architecture Components

### Data Management Layer
- **`PlantDataManager`**: Central data coordination, plant status management
- **`HttpFileSystemManager`**: Backend communication and dataset access
- **`AnnotationStorageManager`**: Annotation persistence and caching
- **`RealTimeSyncManager`**: Live annotation synchronization across time series

### UI Layer  
- **`AnnotationTool`**: Canvas-based annotation interface with zoom/pan
- **`CustomAnnotationManager`**: Flexible annotation types and rendering
- **`NoteManager/NoteUI`**: Plant and image-level notes with bulk operations
- **`BranchPointPreviewManager`**: Visual annotation guidance

### Core Features
- **Time Series Annotation**: Automatic propagation with fine-tuning support
- **Custom Annotation Types**: User-defined point and region annotations
- **Real-time Sync**: Live updates across future frames  
- **Performance Optimization**: Bulk loading and caching strategies
- **Multi-view Support**: sv-000, sv-045, sv-090 viewing angles

## API Endpoints

### Dataset Management
- `GET /api/dataset` - Get dataset information
- `POST /api/dataset/load` - Load dataset from path
- `GET /api/plants` - List all plants
- `GET /api/plants/:plantId/images` - Get plant images by view angle

### Annotation Operations
- `GET /api/annotations/:imageId` - Get image annotations
- `POST /api/annotations/:imageId` - Save image annotations
- `DELETE /api/annotations/:imageId` - Delete image annotations  
- `GET /api/annotations/bulk` - Bulk annotation retrieval
- `DELETE /api/annotations/plant/:plantId` - Delete all plant annotations

### Note System
- `GET /api/notes/plant/:plantId` - Get plant notes
- `POST /api/notes/plant/:plantId` - Create plant note
- `GET /api/notes/image/:plantId/:imageId` - Get/create image notes
- `GET /api/notes/bulk` - Bulk note retrieval

## Data Format Standards

### Annotation Data Structure
```json
{
  "id": "unique_identifier",
  "x": 320.5,
  "y": 240.3,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "order": 1,
  "annotationType": "regular|custom",
  "customType": "optional_custom_type_name"
}
```

### Export Formats
- **Pure Format**: Clean annotation data for ML/analysis
- **Complete Format**: Full tool state for re-import

## Development Patterns

### File Organization
```
src/
├── core/               # Core business logic managers
├── debug/              # Debugging and verification scripts  
├── demo/               # Demo and test pages
├── services/           # External service integrations
├── styles/             # CSS styling
├── tests/              # Test suites and validation
├── utils/              # Utility functions and helpers
└── main.js            # Application entry point
```

### Error Handling Patterns
- Use try-catch blocks for async operations
- Provide user-friendly error messages via `showError()`
- Log detailed errors to console for debugging
- Implement graceful fallbacks for failed operations

### State Management
- Central app state in `main.js`
- Individual component state in respective managers
- Use events for cross-component communication
- Maintain data consistency across UI updates

## Testing & Debugging

### Available Test Commands
```bash
# Run all tests
npm test

# Test specific components
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Debug Tools (Development Mode)
```javascript
// Available in browser console
DEBUG_APP_STATE              // Current application state
DEBUG_PLANT_MANAGER()        // Plant data manager instance
DEBUG_ANNOTATION_TOOL()      // Annotation tool instance
DEBUG_EXPORT_PURE()          // Test pure export functionality
fixLegacyDataOrder()         // Fix annotation ordering issues
MIGRATE_PLANT_STATUS()       // Migrate plant completion status
```

### Performance Monitoring
- Built-in performance tracking with `BulkLoadingPerformanceMonitor`
- Network request optimization via bulk APIs
- Memory-efficient canvas and image handling
- Lazy loading for large datasets

## Common Development Tasks

### Adding New Annotation Types
1. Extend `CustomAnnotationManager` with new type definition
2. Update `CustomAnnotationRenderer` for visual representation  
3. Add UI controls in `CustomAnnotationToolbarController`
4. Test with real-time sync and export functionality

### Modifying API Endpoints
1. Update backend routes in `server.js`
2. Modify corresponding frontend calls in managers
3. Update bulk loading operations if applicable
4. Test with error handling and connection failures

### Extending Export Functionality
1. Add new format to `generateExportPreview()` in `main.js`
2. Update export statistics calculation
3. Ensure backward compatibility with existing formats
4. Test with large datasets

## Security & Best Practices

### Data Privacy
- All processing occurs locally
- No external data transmission
- Local file system access with user consent
- Input validation and sanitization

### Code Standards
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public functions
- Write tests for new functionality
- Maintain consistent error handling patterns

## Browser Compatibility

### Supported Browsers
- Chrome/Chromium 90+ (recommended)
- Edge 90+
- Firefox 88+ (with limitations)
- Safari 14+ (basic support)

### Required Browser Features
- Canvas API
- IndexedDB
- Web Workers
- Intersection Observer
- ES6+ module support

## Troubleshooting

### Common Issues
1. **Backend connection failed**: Ensure `./start-backend.sh` is running
2. **Port conflicts**: Backend script handles port cleanup automatically
3. **Dataset not found**: Verify dataset path in backend configuration
4. **CORS errors**: Use local server instead of file:// protocol
5. **Memory issues**: Enable lazy loading for large datasets

### Log Analysis
- **Frontend logs**: Browser Developer Tools Console
- **Backend logs**: Terminal output where server is running
- **Performance metrics**: Built-in timing and statistics
- **Error tracking**: Comprehensive error boundaries and reporting