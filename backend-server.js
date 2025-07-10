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

// 获取单个笔记
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

// 搜索笔记
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


// 获取所有笔记统计
app.get('/api/notes/stats', async (req, res) => {
  try {
    const annotationsDir = await ensureAnnotationsDirectory();
    const files = await fs.readdir(annotationsDir);
    const noteFiles = files.filter(file => file.startsWith('note_') && file.endsWith('.json'));
    
    const stats = {
      totalNotes: 0,
      plantNotes: 0,
      imageNotes: 0,
      noteTypes: {},
      authors: {},
      recentNotes: []
    };
    
    const allNotes = [];
    for (const file of noteFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const note = JSON.parse(content);
        allNotes.push(note);
        
        stats.totalNotes++;
        
        if (note.imageId) {
          stats.imageNotes++;
        } else {
          stats.plantNotes++;
        }
        
        // 统计笔记类型
        stats.noteTypes[note.noteType] = (stats.noteTypes[note.noteType] || 0) + 1;
        
        // 统计作者
        stats.authors[note.author] = (stats.authors[note.author] || 0) + 1;
        
      } catch (error) {
        console.warn(`读取笔记文件 ${file} 失败:`, error.message);
      }
    }
    
    // 最近的10个笔记
    stats.recentNotes = allNotes
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(note => ({
        noteId: note.noteId,
        title: note.title,
        plantId: note.plantId,
        imageId: note.imageId,
        noteType: note.noteType,
        timestamp: note.timestamp
      }));
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试笔记路由注册
app.get('/api/notes/test', (req, res) => {
  res.json({
    success: true,
    message: 'Note routes are working',
    timestamp: new Date().toISOString()
  });
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