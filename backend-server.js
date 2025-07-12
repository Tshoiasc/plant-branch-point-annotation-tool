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

// 工具函数：格式化时间显示 - 🔧 FIXED: Only show date, no time
function formatImageTime(filename) {
  const regex = /BR\d+-\d+-(\d{4}-\d{2}-\d{2})_(\d{2})_VIS_sv_\d+/;
  const match = filename.match(regex);
  
  if (match) {
    const dateStr = match[1];
    const hourStr = match[2];
    const date = new Date(`${dateStr}T${hourStr}:00:00`);
    // 🔧 FIX: Remove time portion, only show year/month/day
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
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
          
          // 🔧 ENHANCED: Improved chronological sorting with debugging
          images.sort((a, b) => {
            const dateA = a.dateTime;
            const dateB = b.dateTime;
            
            // Handle invalid dates (should be very rare)
            if (!(dateA instanceof Date) || isNaN(dateA.getTime())) {
              console.warn(`Invalid dateTime for image ${a.name}: ${dateA}`);
              return 1; // Put invalid dates at the end
            }
            if (!(dateB instanceof Date) || isNaN(dateB.getTime())) {
              console.warn(`Invalid dateTime for image ${b.name}: ${dateB}`);
              return -1; // Put invalid dates at the end
            }
            
            // Sort chronologically (earliest first)
            const result = dateA.getTime() - dateB.getTime();
            
            // Debug logging for first few comparisons to verify sorting
            if (images.indexOf(a) < 5 || images.indexOf(b) < 5) {
              console.log(`Sort comparison: ${a.name} (${a.timeString}) vs ${b.name} (${b.timeString}) = ${result}`);
            }
            
            return result;
          });
          
          // 🔧 DEBUG: Log final sorted order for verification  
          if (images.length > 0) {
            console.log(`${viewAngle} sorted images:`, images.map(img => `${img.name} (${img.timeString})`).join(', '));
          }
          
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

// ===========================================
// 植物状态管理 API 端点
// ===========================================

// 获取植物状态
app.get('/api/plant-status/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    
    // 验证plantId参数
    if (!plantId || typeof plantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '植物ID不能为空且必须是字符串'
      });
    }
    
    // 验证plantId格式
    if (!plantId.match(/^BR\d+-\d+$/)) {
      return res.status(400).json({
        success: false,
        error: '植物ID格式无效，应该是BR开头的格式，如：BR017-113112'
      });
    }
    
    const annotationsDir = await ensureAnnotationsDirectory();
    
    // 首先尝试从专用状态文件加载
    const statusFileName = `${plantId}_status.json`;
    const statusFilePath = path.join(annotationsDir, statusFileName);
    
    try {
      const statusContent = await fs.readFile(statusFilePath, 'utf8');
      const statusData = JSON.parse(statusContent);
      
      res.json({
        success: true,
        data: {
          plantId: statusData.plantId,
          status: statusData.status,
          lastModified: statusData.lastModified,
          timestamp: statusData.timestamp
        }
      });
      return;
    } catch (statusError) {
      if (statusError.code !== 'ENOENT') {
        console.warn(`读取状态文件失败 ${statusFileName}:`, statusError);
      }
    }
    
    // 如果没有专用状态文件，检查是否有跳过信息文件
    const skipFileName = `${plantId}_skip_info.json`;
    const skipFilePath = path.join(annotationsDir, skipFileName);
    
    try {
      const skipContent = await fs.readFile(skipFilePath, 'utf8');
      const skipData = JSON.parse(skipContent);
      
      if (skipData.status) {
        res.json({
          success: true,
          data: {
            plantId: skipData.plantId,
            status: skipData.status,
            lastModified: skipData.lastModified,
            skipReason: skipData.skipReason,
            skipDate: skipData.skipDate
          }
        });
        return;
      }
    } catch (skipError) {
      if (skipError.code !== 'ENOENT') {
        console.warn(`读取跳过信息文件失败 ${skipFileName}:`, skipError);
      }
    }
    
    // 如果都没有，返回null表示没有状态信息
    res.json({
      success: true,
      data: null,
      message: '未找到植物状态信息'
    });
    
  } catch (error) {
    console.error(`获取植物 ${req.params.plantId} 状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 保存植物状态
app.post('/api/plant-status/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const { status, lastModified } = req.body;
    
    // 验证plantId参数
    if (!plantId || typeof plantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '植物ID不能为空且必须是字符串'
      });
    }
    
    // 验证plantId格式
    if (!plantId.match(/^BR\d+-\d+$/)) {
      return res.status(400).json({
        success: false,
        error: '植物ID格式无效，应该是BR开头的格式，如：BR017-113112'
      });
    }
    
    // 验证状态参数
    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        error: '状态不能为空且必须是字符串'
      });
    }
    
    const validStatuses = ['pending', 'in-progress', 'completed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `无效的状态值。允许的状态: ${validStatuses.join(', ')}`
      });
    }
    
    const annotationsDir = await ensureAnnotationsDirectory();
    
    // 创建状态数据
    const statusData = {
      plantId,
      status,
      lastModified: lastModified || new Date().toISOString(),
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // 保存到专用状态文件
    const statusFileName = `${plantId}_status.json`;
    const statusFilePath = path.join(annotationsDir, statusFileName);
    
    await fs.writeFile(statusFilePath, JSON.stringify(statusData, null, 2));
    
    console.log(`植物 ${plantId} 状态已保存: ${status}`);
    
    res.json({
      success: true,
      data: statusData,
      message: `植物状态已保存: ${status}`
    });
    
  } catch (error) {
    console.error(`保存植物 ${req.params.plantId} 状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除植物状态
app.delete('/api/plant-status/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const annotationsDir = await ensureAnnotationsDirectory();
    const statusFileName = `${plantId}_status.json`;
    const statusFilePath = path.join(annotationsDir, statusFileName);
    
    await fs.unlink(statusFilePath);
    
    res.json({
      success: true,
      message: `植物 ${plantId} 状态已删除`
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({
        success: true,
        message: '状态文件不存在'
      });
    } else {
      console.error(`删除植物 ${req.params.plantId} 状态失败:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// ===========================================
// 笔记系统 API 端点
// ===========================================

// 生成UUID函数
function generateUUID() {
  return 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 获取笔记文件路径
function getNoteFilePath(noteId) {
  return path.join(DATASET_ROOT, 'annotations', `note_${noteId}.json`);
}

// 获取植物的所有笔记
app.get('/api/notes/plant/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    
    // 验证plantId参数
    if (!plantId || typeof plantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '植物ID不能为空且必须是字符串'
      });
    }
    
    // 验证plantId格式（BR开头的格式）
    if (!plantId.match(/^BR\d+-\d+$/)) {
      return res.status(400).json({
        success: false,
        error: '植物ID格式无效，应该是BR开头的格式，如：BR017-113112'
      });
    }
    
    const annotationsDir = await ensureAnnotationsDirectory();
    
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    const notes = [];
    for (const file of noteFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        
        // 筛选属于该植物且不是图像级笔记的笔记
        if (note.plantId === plantId && !note.imageId) {
          notes.push(note);
        }
      } catch (error) {
        console.warn(`读取笔记文件 ${file} 失败:`, error.message);
      }
    }
    
    // 按时间倒序排序
    notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: notes,
      message: `找到 ${notes.length} 个植物笔记`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取图像的所有笔记
app.get('/api/notes/image/:plantId/:imageId', async (req, res) => {
  try {
    const { plantId, imageId } = req.params;
    
    // 验证plantId参数
    if (!plantId || typeof plantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '植物ID不能为空且必须是字符串'
      });
    }
    
    // 验证plantId格式
    if (!plantId.match(/^BR\d+-\d+$/)) {
      return res.status(400).json({
        success: false,
        error: '植物ID格式无效，应该是BR开头的格式，如：BR017-113112'
      });
    }
    
    // 验证imageId参数
    if (!imageId || typeof imageId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '图像ID不能为空且必须是字符串'
      });
    }
    
    // 验证imageId格式（包含植物ID和视角信息）
    if (!imageId.includes('_') || !imageId.includes(plantId)) {
      return res.status(400).json({
        success: false,
        error: '图像ID格式无效，应该包含植物ID和视角信息'
      });
    }
    
    const annotationsDir = await ensureAnnotationsDirectory();
    
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    const notes = [];
    for (const file of noteFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        
        // 筛选属于该植物和图像的笔记
        if (note.plantId === plantId && note.imageId === imageId) {
          notes.push(note);
        }
      } catch (error) {
        console.warn(`读取笔记文件 ${file} 失败:`, error.message);
      }
    }
    
    // 按时间倒序排序
    notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: notes,
      message: `找到 ${notes.length} 个图像笔记`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 创建植物笔记
app.post('/api/notes/plant/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const { title, content, noteType, tags, author } = req.body;
    
    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }
    
    const noteId = generateUUID();
    const noteData = {
      noteId,
      plantId,
      imageId: null,
      noteType: noteType || 'general',
      title,
      content,
      tags: tags || [],
      author: author || 'unknown',
      timestamp: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0'
    };
    
    const filePath = getNoteFilePath(noteId);
    await fs.writeFile(filePath, JSON.stringify(noteData, null, 2));
    
    res.json({
      success: true,
      data: { noteId },
      message: '植物笔记创建成功'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 创建图像笔记
app.post('/api/notes/image/:plantId/:imageId', async (req, res) => {
  try {
    const { plantId, imageId } = req.params;
    const { title, content, noteType, tags, author } = req.body;
    
    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }
    
    const noteId = generateUUID();
    const noteData = {
      noteId,
      plantId,
      imageId,
      noteType: noteType || 'general',
      title,
      content,
      tags: tags || [],
      author: author || 'unknown',
      timestamp: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0'
    };
    
    const filePath = getNoteFilePath(noteId);
    await fs.writeFile(filePath, JSON.stringify(noteData, null, 2));
    
    res.json({
      success: true,
      data: { noteId },
      message: '图像笔记创建成功'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新笔记
app.put('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const updates = req.body;
    
    const filePath = getNoteFilePath(noteId);
    
    // 检查笔记是否存在
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: '笔记不存在'
      });
    }
    
    // 读取现有笔记
    const content = await fs.readFile(filePath, 'utf8');
    const note = JSON.parse(content);
    
    // 更新笔记
    const updatedNote = {
      ...note,
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(updatedNote, null, 2));
    
    res.json({
      success: true,
      data: updatedNote,
      message: '笔记更新成功'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除笔记
app.delete('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const filePath = getNoteFilePath(noteId);
    
    // 检查笔记是否存在
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: '笔记不存在'
      });
    }
    
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: '笔记删除成功'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 批量获取所有笔记 - PERFORMANCE OPTIMIZATION ENDPOINT
app.get('/api/notes/bulk', async (req, res) => {
  try {
    console.log('[Bulk API] Starting bulk notes request...');
    const startTime = Date.now();
    
    const annotationsDir = await ensureAnnotationsDirectory();
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    const plantNotes = {};
    const imageNotes = {};
    let totalPlantNotes = 0;
    let totalImageNotes = 0;
    
    console.log(`[Bulk API] Found ${noteFiles.length} note files to process`);
    
    // Process all note files in parallel for maximum performance
    const notePromises = noteFiles.map(async (file) => {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        
        return note;
      } catch (error) {
        console.warn(`[Bulk API] 读取笔记文件 ${file} 失败:`, error.message);
        return null;
      }
    });
    
    const allNotes = (await Promise.all(notePromises)).filter(note => note !== null);
    console.log(`[Bulk API] Successfully loaded ${allNotes.length} notes`);
    
    // Group notes by plant and image
    for (const note of allNotes) {
      if (note.imageId) {
        // Image note
        if (!imageNotes[note.imageId]) {
          imageNotes[note.imageId] = [];
        }
        imageNotes[note.imageId].push(note);
        totalImageNotes++;
      } else {
        // Plant note
        if (!plantNotes[note.plantId]) {
          plantNotes[note.plantId] = [];
        }
        plantNotes[note.plantId].push(note);
        totalPlantNotes++;
      }
    }
    
    // Sort notes by timestamp (newest first) for each plant/image
    Object.values(plantNotes).forEach(notes => {
      notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
    
    Object.values(imageNotes).forEach(notes => {
      notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[Bulk API] Bulk processing completed in ${processingTime}ms`);
    console.log(`[Bulk API] Plant notes: ${Object.keys(plantNotes).length} plants with ${totalPlantNotes} notes`);
    console.log(`[Bulk API] Image notes: ${Object.keys(imageNotes).length} images with ${totalImageNotes} notes`);
    
    res.json({
      success: true,
      data: {
        plantNotes,
        imageNotes,
        statistics: {
          totalPlantNotes,
          totalImageNotes,
          totalNotes: totalPlantNotes + totalImageNotes,
          plantsWithNotes: Object.keys(plantNotes).length,
          imagesWithNotes: Object.keys(imageNotes).length,
          processingTimeMs: processingTime
        }
      },
      timestamp: new Date().toISOString(),
      message: `批量获取 ${totalPlantNotes + totalImageNotes} 条笔记成功 (${processingTime}ms)`
    });
    
  } catch (error) {
    console.error('[Bulk API] Bulk notes request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: {
        message: "Use individual note endpoints",
        endpoints: [
          "/api/notes/plant/{plantId}",
          "/api/notes/image/{plantId}/{imageId}"
        ]
      }
    });
  }
});

// 🔧 FIX: Move specific routes BEFORE generic :noteId route to prevent route conflicts

// 搜索笔记 - MOVED UP TO PREVENT ROUTE CONFLICT
app.get('/api/notes/search', async (req, res) => {
  try {
    const { query, plantId, noteType, author } = req.query;
    const annotationsDir = await ensureAnnotationsDirectory();
    
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    const allNotes = [];
    for (const file of noteFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        allNotes.push(note);
      } catch (error) {
        console.warn(`读取笔记文件 ${file} 失败:`, error.message);
      }
    }
    
    // 应用筛选条件
    let filteredNotes = allNotes;
    
    if (query) {
      const searchQuery = query.toLowerCase();
      filteredNotes = filteredNotes.filter(note => 
        note.title.toLowerCase().includes(searchQuery) ||
        note.content.toLowerCase().includes(searchQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchQuery))
      );
    }
    
    if (plantId) {
      filteredNotes = filteredNotes.filter(note => note.plantId === plantId);
    }
    
    if (noteType) {
      filteredNotes = filteredNotes.filter(note => note.noteType === noteType);
    }
    
    if (author) {
      filteredNotes = filteredNotes.filter(note => note.author === author);
    }
    
    // 按时间倒序排序
    filteredNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: filteredNotes,
      message: `找到 ${filteredNotes.length} 个匹配的笔记`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有笔记统计 - MOVED UP TO PREVENT ROUTE CONFLICT
app.get('/api/notes/stats', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    let totalNotes = 0;
    let plantNotes = 0;
    let imageNotes = 0;
    const notesByAuthor = {};
    const notesByTag = {};
    
    for (const file of noteFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        
        totalNotes++;
        
        if (note.noteType === 'plant') {
          plantNotes++;
        } else if (note.noteType === 'image') {
          imageNotes++;
        }
        
        notesByAuthor[note.author] = (notesByAuthor[note.author] || 0) + 1;
        
        note.tags.forEach(tag => {
          notesByTag[tag] = (notesByTag[tag] || 0) + 1;
        });
        
      } catch (error) {
        console.warn(`读取笔记文件 ${file} 失败:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        totalNotes,
        plantNotes,
        imageNotes,
        notesByAuthor,
        notesByTag
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试笔记功能 - MOVED UP TO PREVENT ROUTE CONFLICT
app.get('/api/notes/test', (req, res) => {
  res.json({
    success: true,
    message: '笔记功能正常工作',
    timestamp: new Date().toISOString()
  });
});

// 获取单个笔记 - GENERIC ROUTE MOVED TO END
app.get('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const filePath = getNoteFilePath(noteId);
    
    // 检查笔记是否存在
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: '笔记不存在'
      });
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    const note = JSON.parse(content);
    
    res.json({
      success: true,
      data: note
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ===========================================
// 批量标注 API 端点
// ===========================================

// 批量保存标注数据
app.post('/api/annotations/bulk', async (req, res) => {
  try {
    console.log('[Bulk Annotations API] Starting bulk save request...');
    const startTime = Date.now();
    
    const annotationData = req.body;
    
    // 验证请求数据
    if (!annotationData || typeof annotationData !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的标注数据格式'
      });
    }
    
    const annotationsDir = await ensureAnnotationsDirectory();
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    // 创建备份
    try {
      await fs.access(filePath);
      const backupPath = path.join(annotationsDir, `plant_annotations_backup_${Date.now()}.json`);
      await fs.copyFile(filePath, backupPath);
      console.log('[Bulk Annotations API] Created backup file');
    } catch (error) {
      console.log('[Bulk Annotations API] No existing file to backup');
    }
    
    // 添加保存时间戳
    const dataToSave = {
      ...annotationData,
      saveTime: new Date().toISOString(),
      totalPlants: annotationData.totalPlants || 0
    };
    
    // 保存新数据
    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[Bulk Annotations API] 保存了 ${dataToSave.totalPlants} 个植物的标注数据 (${processingTime}ms)`);
    
    res.json({
      success: true,
      message: '批量标注数据保存成功',
      timestamp: new Date().toISOString(),
      totalPlants: dataToSave.totalPlants,
      processingTimeMs: processingTime
    });
    
  } catch (error) {
    console.error('[Bulk Annotations API] 批量保存标注数据失败:', error);
    res.status(500).json({
      success: false,
      error: '批量保存标注数据失败',
      details: error.message
    });
  }
});

// 批量加载标注数据 - 直接从文件系统实时读取
app.get('/api/annotations/bulk', async (req, res) => {
  try {
    console.log('[Bulk API] Starting bulk annotations load from file system...');
    const startTime = Date.now();
    
    const annotationsDir = await ensureAnnotationsDirectory();
    
    // 🚀 PERFORMANCE: Read all annotation files in parallel
    const files = await fs.readdir(annotationsDir);
    const annotationFiles = files.filter(file => 
      file.endsWith('.json') && !file.endsWith('_skip_info.json') && !file.startsWith('note_')
    );
    
    console.log(`[Bulk API] Found ${annotationFiles.length} annotation files to process`);
    
    const bulkData = {
      plantAnnotations: {},
      imageAnnotations: {},
      statistics: {
        totalPlants: 0,
        totalImages: 0,
        totalAnnotations: 0,
        plantsWithAnnotations: 0,
        imagesWithAnnotations: 0
      }
    };
    
    let totalAnnotationCount = 0;
    const plantsWithAnnotations = new Set();
    
    // 🚀 Process all annotation files in parallel for maximum performance
    const filePromises = annotationFiles.map(async (file) => {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const annotation = JSON.parse(content);
        
        if (annotation.annotations && annotation.annotations.length > 0) {
          const imageId = file.replace('.json', '');
          const plantId = imageId.split('_')[0]; // Extract plant ID from image ID
          
          // Store image annotations in the format frontend expects
          bulkData.imageAnnotations[imageId] = annotation.annotations;
          totalAnnotationCount += annotation.annotations.length;
          plantsWithAnnotations.add(plantId);
          
          return { imageId, plantId, count: annotation.annotations.length };
        }
        return null;
      } catch (error) {
        console.warn(`[Bulk API] Failed to read ${file}:`, error.message);
        return null;
      }
    });
    
    const results = await Promise.all(filePromises);
    const validResults = results.filter(r => r !== null);
    
    // Update statistics to match frontend expectations
    bulkData.statistics = {
      totalPlants: plantsWithAnnotations.size,
      totalImages: validResults.length,
      totalAnnotations: totalAnnotationCount,
      plantsWithAnnotations: plantsWithAnnotations.size,
      imagesWithAnnotations: validResults.length
    };
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    console.log(`[Bulk API] ✅ Successfully loaded ${totalAnnotationCount} annotations from ${validResults.length} images in ${loadTime}ms`);
    console.log(`[Bulk API] 📊 Plants with annotations: ${plantsWithAnnotations.size}`);
    console.log(`[Bulk API] 📊 Images with annotations: ${validResults.length}`);
    
    res.json({
      success: true,
      data: bulkData,
      timestamp: new Date().toISOString(),
      performance: {
        loadTimeMs: loadTime,
        filesProcessed: validResults.length,
        annotationsLoaded: totalAnnotationCount
      },
      message: `批量加载 ${totalAnnotationCount} 个标注点从 ${validResults.length} 个图像成功 (${loadTime}ms)`
    });
    
  } catch (error) {
    console.error('[Bulk API] Failed to load bulk annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load bulk annotation data',
      fallback: {
        message: 'Use individual annotation endpoints',
        endpoints: [
          '/api/plant-annotations/{plantId}',
          '/api/image-annotations/{imageId}'
        ]
      }
    });
  }
});

// 获取批量标注统计信息
app.get('/api/annotations/bulk/stats', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const annotationData = JSON.parse(data);
      
      const stats = {
        totalPlants: annotationData.totalPlants || 0,
        lastSaved: annotationData.saveTime,
        annotationCount: Object.keys(annotationData.annotations || {}).length,
        completedPlants: Object.values(annotationData.annotations || {})
          .filter(plant => plant.annotations && plant.annotations.length > 0).length,
        dataSize: JSON.stringify(annotationData).length,
        fileExists: true
      };
      
      res.json({
        success: true,
        data: stats,
        message: `统计信息：${stats.totalPlants} 个植物，${stats.completedPlants} 个已完成标注`
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          data: { 
            totalPlants: 0, 
            annotationCount: 0, 
            completedPlants: 0,
            lastSaved: null,
            dataSize: 0,
            fileExists: false
          },
          message: '未找到批量标注文件'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('[Bulk Annotations API] 获取批量标注统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取批量标注统计失败',
      details: error.message
    });
  }
});

// 导出批量标注数据
app.get('/api/annotations/bulk/export', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const annotationData = JSON.parse(data);
      
      // 设置下载头
      const filename = `plant_annotations_${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      
      console.log(`[Bulk Annotations API] 导出标注数据：${filename}`);
      res.send(JSON.stringify(annotationData, null, 2));
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: '未找到标注数据文件',
          message: '请先保存一些标注数据'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('[Bulk Annotations API] 导出批量标注数据失败:', error);
    res.status(500).json({
      success: false,
      error: '导出批量标注数据失败',
      details: error.message
    });
  }
});

// 删除批量标注数据
app.delete('/api/annotations/bulk', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    // 创建删除前备份
    try {
      await fs.access(filePath);
      const backupPath = path.join(annotationsDir, `plant_annotations_deleted_backup_${Date.now()}.json`);
      await fs.copyFile(filePath, backupPath);
      await fs.unlink(filePath);
      
      console.log('[Bulk Annotations API] 删除批量标注数据并创建备份');
      res.json({
        success: true,
        message: '批量标注数据已删除，备份已创建'
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          message: '批量标注文件不存在'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('[Bulk Annotations API] 删除批量标注数据失败:', error);
    res.status(500).json({
      success: false,
      error: '删除批量标注数据失败',
      details: error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    datasetPath: DATASET_ROOT,
    features: [
      'plant-directories',
      'plant-images', 
      'individual-annotations',
      'bulk-annotations',
      'note-system',
      'plant-status'
    ]
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Dataset path: ${DATASET_ROOT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;