# Plant Image Keypoint Annotation Tool

A professional annotation tool designed for processing Brassica napus (rapeseed) datasets, featuring keypoint annotation, time-series analysis, real-time UI synchronization, and comprehensive data export capabilities.

## 🚀 Quick Start

### Method 1: Using Launch Scripts (Recommended)

**Windows Users:**
```bash
# Double-click to run or execute in command line
start.bat
```

**macOS/Linux Users:**
```bash
# Add execution permission and run
chmod +x start.sh
./start.sh
```

**Cross-platform Node.js Script:**
```bash
node start.js
```

### Method 2: Using npm Commands

```bash
# Install dependencies
npm install

# Start complete application (frontend + backend)
npm start

# Or use the following command
npm run dev:full

# Start frontend only
npm run dev:frontend

# Start backend only
npm run dev:backend
```

## 📋 System Requirements

- **Node.js**: >= 16.0.0
- **Browser**: Chrome or Edge (requires File System Access API support)
- **Operating System**: Windows 10+, macOS 10.15+, or modern Linux distributions

## 🌟 Key Features

### Core Annotation Features
- ✅ **Local File System Access**: Direct access to local datasets without upload
- ✅ **Intelligent Image Parsing**: Automatic time information extraction and sequential arrangement
- ✅ **Precision Touchpad Zoom**: 0.1x-10x zoom range with precise positioning
- ✅ **Interactive Keypoint Annotation**: Left-click to add, right-click to delete, drag to adjust
- ✅ **Time Series Propagation**: Automatic propagation of initial annotations to all time points
- ✅ **Fine-tuning Mode**: Precise adjustments for intermediate time points
- ✅ **Automated Workflow**: Automatic navigation after annotation completion

### Advanced Features
- ✅ **Real-time UI Synchronization**: Instant thumbnail updates after annotation saves
- ✅ **Comprehensive Note System**: Plant and image-level notes with bulk operations
- ✅ **Multi-view Support**: sv-000, sv-045, sv-090 viewing angles
- ✅ **Progress Statistics**: Real-time annotation progress and completion rate display
- ✅ **Data Persistence**: Local storage with server backup
- ✅ **Performance Optimization**: Bulk API operations for faster loading
- ✅ **Branch Point Preview**: Visual guidance for annotation consistency
- ✅ **Automatic Movement**: Smart navigation to expected annotation positions

### Recent Improvements
- 🔧 **Fixed Annotation Loss**: Resolved data loss during plant switching
- 🔧 **Real-time Thumbnail Updates**: Immediate "Annotated" status display
- 🔧 **Enhanced Note Badge Sync**: Instant note badge updates
- 🔧 **Improved Error Handling**: Better null reference protection
- 🔧 **Optimized Auto-save**: Comprehensive workspace clearing without data loss

## 🎯 Usage Instructions

### 1. Launch Application

Using any of the above startup methods, the application will run at:
- **Frontend Interface**: http://localhost:5173
- **Backend API**: http://localhost:3003

### 2. Select Dataset

1. Click the "Select Dataset" button
2. Choose the root directory containing plant folders
3. Wait for dataset loading to complete

### 3. Begin Annotation

1. Select a plant from the left panel
2. Choose viewing angle (sv-000, sv-045, etc.)
3. Select the image to annotate
4. Use mouse for annotation:
   - **Left Click**: Add keypoint
   - **Right Click on Keypoint**: Delete keypoint
   - **Drag Keypoint**: Move position
   - **Mouse Wheel**: Zoom image
   - **Shift + Drag**: Pan image

### 4. Save and Export

- **Save Annotation**: Save current image annotations
- **Save as Fine-tuning**: Precise adjustments in time series
- **Complete Plant**: Mark plant as completed and jump to next
- **Export Data**: Export all annotation data in JSON format

## 🛠 Development Guide

### Project Structure

```
Plant Annotation Tool/
├── src/                    # Frontend source code
│   ├── core/              # Core modules
│   │   ├── AnnotationTool.js          # Annotation tool engine
│   │   ├── FileSystemManager.js       # File system management
│   │   ├── PlantDataManager.js        # Plant data management
│   │   ├── AnnotationStorageManager.js # Annotation storage
│   │   ├── TimeSeriesAnnotationManager.js # Time series management
│   │   ├── BranchPointPreviewManager.js # Branch point preview
│   │   ├── NoteManager.js             # Note management system
│   │   └── NoteUI.js                  # Note user interface
│   ├── styles/            # Style files
│   ├── utils/             # Utility functions
│   └── main.js           # Application entry point
├── backend-server.js      # Backend server
├── annotations/          # Annotation data storage directory
├── start.sh             # Unix/Linux startup script
├── start.bat            # Windows startup script
├── start.js             # Cross-platform Node.js startup script
└── package.json         # Project configuration
```

### Technical Architecture

**Frontend Technology Stack:**
- **Build Tool**: Vite 5.0
- **Language**: ES6+ JavaScript (modular)
- **Styling**: CSS3 (CSS variables + Grid + Flexbox)
- **APIs**: File System Access API, Canvas API, IndexedDB

**Backend Technology Stack:**
- **Runtime**: Node.js
- **Framework**: Express.js
- **Storage**: JSON files + IndexedDB
- **Port**: 3003

### Development Commands

```bash
# Development mode (frontend only)
npm run dev

# Development mode (frontend + backend)
npm start

# Build production version
npm run build

# Preview production version
npm run preview

# Code linting
npm run lint

# Fix code style
npm run lint:fix

# Run tests
npm test

# Health check
npm run health
```

## 🏗 Architecture Details

### Core Components

#### AnnotationTool.js
- Canvas-based annotation interface
- Real-time keypoint manipulation
- Zoom and pan functionality
- Auto-save integration
- Touch and mouse event handling

#### PlantDataManager.js
- Dataset loading and parsing
- Plant and image metadata management
- Annotation persistence
- Time series data coordination

#### NoteManager.js
- Note creation and management
- Bulk note operations
- Performance optimization
- Real-time synchronization

#### BranchPointPreviewManager.js
- Visual annotation guidance
- Reference point calculation
- Cross-image consistency
- Automatic navigation assistance

### API Endpoints

#### Dataset Management
- `GET /api/dataset` - Get dataset information
- `POST /api/dataset/load` - Load dataset from path
- `GET /api/plants` - List all plants
- `GET /api/plants/:plantId/images` - Get plant images

#### Annotation Operations
- `GET /api/annotations/:imageId` - Get image annotations
- `POST /api/annotations/:imageId` - Save image annotations
- `DELETE /api/annotations/:imageId` - Delete image annotations
- `GET /api/annotations/bulk` - Bulk annotation retrieval

#### Note System
- `GET /api/notes/plant/:plantId` - Get plant notes
- `POST /api/notes/plant/:plantId` - Create plant note
- `GET /api/notes/image/:plantId/:imageId` - Get image notes
- `POST /api/notes/image/:plantId/:imageId` - Create image note
- `GET /api/notes/bulk` - Bulk note retrieval
- `GET /api/notes/stats` - Note statistics

## 📊 Data Formats

### Pure Image Annotation Format (Recommended)

This is the new export format that directly outputs annotation points for each image, including **all annotated images** (original annotations, time-series inherited annotations, manually fine-tuned annotations), without internal management information:

```json
{
  "exportTime": "2024-01-01T00:00:00.000Z",
  "version": "2.0",
  "format": "pure_image_annotations",
  "description": "Annotation point data for each image, including all annotated images without internal management information",
  "stats": {
    "totalImages": 150,
    "annotatedImages": 150,
    "totalKeypoints": 900,
    "completionRate": "100.0"
  },
  "annotations": {
    "BR001_sv-000_BR001-2018-06-06_00_VIS_sv_000-0-0-0.png": [
      {
        "id": 1234567890,
        "x": 320.5,
        "y": 240.3,
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "BR001_sv-000_BR001-2018-06-07_00_VIS_sv_000-0-0-0.png": [
      {
        "id": 1234567891,
        "x": 315.1,
        "y": 235.8,
        "timestamp": "2024-01-01T00:00:02.000Z"
      }
    ]
  }
}
```

**Features:**
- Includes all plants, all viewing angles, all annotated images
- No distinction between annotation sources (original, inherited, fine-tuned)
- Each image contains its actual annotation point coordinates
- Simple structure, ready for data analysis and machine learning

### Complete Annotation Format (Internal Tool Use)

Full format including time series management information:

```json
{
  "exportTime": "2024-01-01T00:00:00.000Z",
  "version": "1.0",
  "totalPlants": 426,
  "annotations": {
    "BR001": {
      "plantId": "BR001",
      "status": "completed",
      "selectedViewAngle": "sv-000",
      "selectedImage": { "id": "...", "name": "..." },
      "annotations": [
        {
          "id": "keypoint_1",
          "x": 320,
          "y": 240,
          "timestamp": "2024-01-01T00:00:00.000Z"
        }
      ],
      "timeSeriesData": { /* Time series management data */ }
    }
  }
}
```

### Usage Recommendations

- **Data Analysis and Processing**: Use pure format for simple structure and direct usability
- **Internal Tool Import**: Use complete format to preserve all management information
- **Third-party Tool Integration**: Recommended pure format for better compatibility

## 🔧 Troubleshooting

### Common Issues

1. **Browser doesn't support File System Access API**
   - Solution: Use Chrome or Edge browser

2. **Cannot select directory**
   - Ensure browser version supports File System Access API
   - Check browser permission settings

3. **Service startup failure**
   - Check if ports 3003 and 5173 are occupied
   - Ensure Node.js version >= 16.0.0

4. **Image loading failure**
   - Check dataset directory structure is correct
   - Ensure image files are in PNG format

5. **Thumbnails not updating after annotation**
   - Fixed in latest version with real-time UI synchronization
   - Check console for refresh logs

6. **Note badges not updating immediately**
   - Fixed in latest version with instant badge refresh
   - Automatic refresh after note creation/deletion

### Performance Optimization

The tool includes several performance optimizations:

- **Bulk API Operations**: Reduces hundreds of individual requests to single bulk requests
- **Intelligent Caching**: Reduces redundant data fetching
- **Real-time UI Updates**: Immediate visual feedback without page refresh
- **Memory Management**: Efficient canvas and image handling
- **Lazy Loading**: On-demand resource loading

### Debugging

- **Frontend Logs**: Browser Developer Tools Console
- **Backend Logs**: Terminal output
- **Performance Metrics**: Built-in timing and statistics

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Test Coverage

The tool includes comprehensive testing for:
- Annotation operations
- File system access
- Data persistence
- UI synchronization
- Note management
- API endpoints

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Configuration

Configure environment variables:
- `PORT`: Backend server port (default: 3003)
- `FRONTEND_PORT`: Frontend port (default: 5173)
- `NODE_ENV`: Environment mode (development/production)

## 📈 Performance Metrics

The tool provides built-in performance monitoring:

- **Annotation Save Time**: ~200-500ms for bulk operations
- **UI Refresh Time**: <100ms for thumbnail updates
- **Memory Usage**: Optimized canvas management
- **Network Requests**: 99%+ reduction with bulk APIs

## 🔒 Security

### Data Privacy
- All processing performed locally
- No data transmission to external servers
- Local file system access with user consent

### Input Validation
- File type verification
- Path traversal protection
- Input sanitization
- Error boundary handling

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

We welcome Issues and Pull Requests to improve this tool!

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for functions
- Write tests for new features

---

**Technical Support**: For issues, please check log information or submit an Issue

**Version**: 2.0.0 with real-time UI synchronization and performance optimizations