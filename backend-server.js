import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3003;

// 数据集根目录
const DATASET_ROOT = '/Users/tshoiasc/Brassica napus dataset/dataset';

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 工具函数：检查文件是否为图像
function isImageFile(filename) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

// 工具函数：解析图像时间信息
function parseImageDateTime(filename) {
  const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
  const match = filename.match(regex);
  
  if (match) {
    const dateStr = match[1];
    const hourStr = match[2];
    return new Date(`${dateStr}T${hourStr}:00:00`);
  }
  
  return new Date(0);
}

// 工具函数：格式化时间显示
function formatImageTime(filename) {
  const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
  const match = filename.match(regex);
  
  if (match) {
    const dateStr = match[1];
    const hourStr = match[2];
    const date = new Date(`${dateStr}T${hourStr}:00:00`);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  
  return filename;
}

// 确保annotations目录存在
async function ensureAnnotationsDirectory() {
  const annotationsDir = path.join(DATASET_ROOT, 'annotations');
  try {
    await fs.access(annotationsDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(annotationsDir, { recursive: true });
      console.log('Created annotations directory');
    } else {
      throw error;
    }
  }
  return annotationsDir;
}

// API 端点

// 获取数据集根目录信息
app.get('/api/dataset-info', async (req, res) => {
  try {
    const stats = await fs.stat(DATASET_ROOT);
    const annotationsDir = await ensureAnnotationsDirectory();
    
    res.json({
      success: true,
      data: {
        datasetPath: DATASET_ROOT,
        annotationsPath: annotationsDir,
        isDirectory: stats.isDirectory(),
        lastModified: stats.mtime
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 遍历植物文件夹
app.get('/api/plant-directories', async (req, res) => {
  try {
    const entries = await fs.readdir(DATASET_ROOT, { withFileTypes: true });
    const plantFolders = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('BR')) {
        const plantPath = path.join(DATASET_ROOT, entry.name);
        
        // 检查是否有sv-000子目录
        const hasSV000 = await checkSV000Directory(plantPath);
        
        if (hasSV000) {
          plantFolders.push({
            id: entry.name,
            name: entry.name,
            path: plantPath,
            hasImages: false,
            imageCount: 0
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: plantFolders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 检查sv-000目录是否存在
async function checkSV000Directory(plantPath) {
  try {
    const entries = await fs.readdir(plantPath, { withFileTypes: true });
    return entries.some(entry => 
      entry.isDirectory() && entry.name.toLowerCase() === 'sv-000'
    );
  } catch (error) {
    return false;
  }
}

// 读取植物图像
app.get('/api/plant-images/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const plantPath = path.join(DATASET_ROOT, plantId);
    
    const viewAngles = ['sv-000', 'sv-045', 'sv-090'];
    const imagesByView = {};
    
    for (const viewAngle of viewAngles) {
      imagesByView[viewAngle] = [];
      
      const viewPath = path.join(plantPath, viewAngle);
      
      try {
        const viewStats = await fs.stat(viewPath);
        if (viewStats.isDirectory()) {
          const entries = await fs.readdir(viewPath, { withFileTypes: true });
          const images = [];
          
          for (const entry of entries) {
            if (entry.isFile() && isImageFile(entry.name)) {
              const imagePath = path.join(viewPath, entry.name);
              const imageStats = await fs.stat(imagePath);
              
              const imageData = {
                id: `${plantId}_${viewAngle}_${entry.name}`,
                name: entry.name,
                viewAngle: viewAngle,
                path: imagePath,
                size: imageStats.size,
                lastModified: imageStats.mtime.getTime(),
                dateTime: parseImageDateTime(entry.name),
                timeString: formatImageTime(entry.name)
              };
              
              images.push(imageData);
            }
          }
          
          // 按时间排序
          images.sort((a, b) => a.dateTime - b.dateTime);
          imagesByView[viewAngle] = images;
        }
      } catch (error) {
        console.warn(`读取 ${viewAngle} 视角失败:`, error);
        imagesByView[viewAngle] = [];
      }
    }
    
    res.json({
      success: true,
      data: imagesByView
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取图像文件内容
app.get('/api/image/:plantId/:viewAngle/:imageName', async (req, res) => {
  try {
    const { plantId, viewAngle, imageName } = req.params;
    const imagePath = path.join(DATASET_ROOT, plantId, viewAngle, imageName);
    
    const imageBuffer = await fs.readFile(imagePath);
    const ext = path.extname(imageName).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.bmp') contentType = 'image/bmp';
    else if (ext === '.tiff') contentType = 'image/tiff';
    else if (ext === '.webp') contentType = 'image/webp';
    
    res.set('Content-Type', contentType);
    res.send(imageBuffer);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: `Image not found: ${error.message}`
    });
  }
});

// 保存标注文件
app.post('/api/annotation/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { annotationData } = req.body;
    
    const annotationsDir = await ensureAnnotationsDirectory();
    const fileName = `${imageId}.json`;
    const filePath = path.join(annotationsDir, fileName);
    
    await fs.writeFile(filePath, JSON.stringify(annotationData, null, 2));
    
    res.json({
      success: true,
      message: `保存标注文件: ${fileName}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 读取标注文件
app.get('/api/annotation/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const annotationsDir = await ensureAnnotationsDirectory();
    
    // 尝试多种文件名格式
    const possibleFileNames = [
      `${imageId}.json`,
      `${imageId}.png.json`,
      `${imageId}.jpg.json`
    ];
    
    for (const fileName of possibleFileNames) {
      const filePath = path.join(annotationsDir, fileName);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        res.json({
          success: true,
          data: data
        });
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
    
    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有标注文件列表
app.get('/api/annotations', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const entries = await fs.readdir(annotationsDir, { withFileTypes: true });
    
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        let imageId;
        if (entry.name.endsWith('.png.json')) {
          imageId = entry.name.replace('.png.json', '.png');
        } else if (entry.name.endsWith('.jpg.json')) {
          imageId = entry.name.replace('.jpg.json', '.jpg');
        } else {
          imageId = entry.name.replace('.json', '');
        }
        files.push(imageId);
      }
    }
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除标注文件
app.delete('/api/annotation/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const annotationsDir = await ensureAnnotationsDirectory();
    const fileName = `${imageId}.json`;
    const filePath = path.join(annotationsDir, fileName);
    
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: `删除标注文件: ${fileName}`
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({
        success: true,
        message: '文件不存在'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// 获取目录统计信息
app.get('/api/directory-stats', async (req, res) => {
  try {
    const { dirPath } = req.query;
    const targetPath = dirPath || DATASET_ROOT;
    
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    let folderCount = 0;
    let fileCount = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        folderCount++;
      } else {
        fileCount++;
      }
    }
    
    res.json({
      success: true,
      data: { folderCount, fileCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有跳过信息文件
app.get('/api/skip-info', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const entries = await fs.readdir(annotationsDir, { withFileTypes: true });
    
    const skipInfoFiles = {};
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('_skip_info.json')) {
        const filePath = path.join(annotationsDir, entry.name);
        const content = await fs.readFile(filePath, 'utf8');
        const skipData = JSON.parse(content);
        skipInfoFiles[skipData.plantId] = skipData;
      }
    }
    
    res.json({
      success: true,
      data: skipInfoFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取特定植物的跳过信息
app.get('/api/skip-info/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const annotationsDir = await ensureAnnotationsDirectory();
    const fileName = `${plantId}_skip_info.json`;
    const filePath = path.join(annotationsDir, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const skipData = JSON.parse(content);
      
      res.json({
        success: true,
        data: skipData
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          data: null
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 保存植物跳过信息
app.post('/api/skip-info/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const { skipData } = req.body;
    
    const annotationsDir = await ensureAnnotationsDirectory();
    const fileName = `${plantId}_skip_info.json`;
    const filePath = path.join(annotationsDir, fileName);
    
    await fs.writeFile(filePath, JSON.stringify(skipData, null, 2));
    
    res.json({
      success: true,
      message: `保存跳过信息: ${fileName}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除植物跳过信息
app.delete('/api/skip-info/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const annotationsDir = await ensureAnnotationsDirectory();
    const fileName = `${plantId}_skip_info.json`;
    const filePath = path.join(annotationsDir, fileName);
    
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: `删除跳过信息: ${fileName}`
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({
        success: true,
        message: '文件不存在'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    datasetPath: DATASET_ROOT
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Dataset path: ${DATASET_ROOT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;