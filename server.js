/**
 * 简单的Node.js服务器
 * 用于处理标注数据的文件保存和加载
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002; // 使用不同端口避免与Vite冲突

// 中间件
app.use(express.json({ limit: '10mb' }));

// 添加CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.static('.'));

// 确保annotations目录存在
const annotationsDir = path.join(__dirname, 'annotations');
try {
  await fs.access(annotationsDir);
} catch (error) {
  await fs.mkdir(annotationsDir, { recursive: true });
  console.log('创建了annotations目录');
}

/**
 * 保存标注数据到文件
 */
app.post('/api/save-annotations', async (req, res) => {
  try {
    const annotationData = req.body;
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    // 创建备份
    try {
      await fs.access(filePath);
      const backupPath = path.join(annotationsDir, `plant_annotations_backup_${Date.now()}.json`);
      await fs.copyFile(filePath, backupPath);
    } catch (error) {
      // 文件不存在，无需备份
    }
    
    // 保存新数据
    await fs.writeFile(filePath, JSON.stringify(annotationData, null, 2));
    
    console.log(`保存了 ${annotationData.totalPlants} 个植物的标注数据`);
    
    res.json({ 
      success: true, 
      message: '标注数据保存成功',
      timestamp: new Date().toISOString(),
      totalPlants: annotationData.totalPlants
    });
    
  } catch (error) {
    console.error('保存标注数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '保存标注数据失败',
      details: error.message 
    });
  }
});

/**
 * 加载标注数据
 */
app.get('/api/load-annotations', async (req, res) => {
  try {
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const annotationData = JSON.parse(data);
      
      res.json({
        success: true,
        data: annotationData
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在
        res.json({
          success: true,
          data: { annotations: {} },
          message: '标注文件不存在，返回空数据'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('加载标注数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '加载标注数据失败',
      details: error.message 
    });
  }
});

/**
 * 获取标注统计信息
 */
app.get('/api/annotation-stats', async (req, res) => {
  try {
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const annotationData = JSON.parse(data);
      
      const stats = {
        totalPlants: annotationData.totalPlants || 0,
        lastSaved: annotationData.saveTime,
        annotationCount: Object.keys(annotationData.annotations || {}).length,
        completedPlants: Object.values(annotationData.annotations || {})
          .filter(plant => plant.annotations && plant.annotations.length > 0).length
      };
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          stats: { totalPlants: 0, annotationCount: 0, completedPlants: 0 }
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('获取标注统计失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取标注统计失败',
      details: error.message 
    });
  }
});

/**
 * 导出标注数据
 */
app.get('/api/export-annotations', async (req, res) => {
  try {
    const filePath = path.join(annotationsDir, 'plant_annotations.json');
    const data = await fs.readFile(filePath, 'utf-8');
    const annotationData = JSON.parse(data);
    
    // 设置下载头
    const filename = `plant_annotations_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.send(JSON.stringify(annotationData, null, 2));
    
  } catch (error) {
    console.error('导出标注数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导出标注数据失败',
      details: error.message 
    });
  }
});

/**
 * 获取植物标注统计信息 (用于删除确认)
 */
app.get('/api/annotations/plant/:plantId/stats', async (req, res) => {
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
    
    // 扫描annotations目录中与该植物相关的文件
    const files = await fs.readdir(annotationsDir);
    const plantAnnotationFiles = [];
    const relatedFiles = [];
    
    for (const file of files) {
      if (file.startsWith(plantId)) {
        if (file.endsWith('.json') && !file.includes('_backup_') && !file.includes('_deleted_')) {
          if (file.includes('_status.json') || file.includes('_skip_info.json')) {
            relatedFiles.push(file);
          } else {
            plantAnnotationFiles.push(file);
          }
        }
      }
    }
    
    // 计算总标注点数
    let totalAnnotationPoints = 0;
    for (const file of plantAnnotationFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (data.annotations && Array.isArray(data.annotations)) {
          totalAnnotationPoints += data.annotations.length;
        }
      } catch (error) {
        console.warn(`读取文件失败: ${file}`, error.message);
      }
    }
    
    res.json({
      success: true,
      plantId,
      statistics: {
        annotationFiles: plantAnnotationFiles.length,
        relatedFiles: relatedFiles.length,
        totalFiles: plantAnnotationFiles.length + relatedFiles.length,
        totalAnnotationPoints,
        files: {
          annotations: plantAnnotationFiles,
          related: relatedFiles
        }
      }
    });
    
  } catch (error) {
    console.error(`获取植物 ${req.params.plantId} 统计失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取植物统计失败',
      details: error.message
    });
  }
});

/**
 * 删除植物的所有标注数据
 */
app.delete('/api/annotations/plant/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    console.log(`开始删除植物 ${plantId} 的所有标注数据`);
    
    const timestamp = Date.now();
    
    // 查找所有属于该植物的标注文件
    const files = await fs.readdir(annotationsDir);
    const plantAnnotationFiles = [];
    const relatedFiles = [];
    
    for (const file of files) {
      if (file.startsWith(plantId)) {
        if (file.endsWith('.json') && !file.includes('_backup_') && !file.includes('_deleted_')) {
          if (file.includes('_status.json') || file.includes('_skip_info.json')) {
            relatedFiles.push(file);
          } else {
            plantAnnotationFiles.push(file);
          }
        }
      }
    }
    
    console.log(`找到 ${plantAnnotationFiles.length} 个标注文件和 ${relatedFiles.length} 个相关文件`);
    
    // 创建备份目录
    const backupDir = path.join(annotationsDir, `plant_${plantId}_deleted_backup_${timestamp}`);
    await fs.mkdir(backupDir, { recursive: true });
    
    const backupStats = {
      annotationFilesBackedUp: 0,
      relatedFilesBackedUp: 0,
      backupPath: backupDir
    };
    
    // 备份标注文件
    for (const file of plantAnnotationFiles) {
      const sourcePath = path.join(annotationsDir, file);
      const backupPath = path.join(backupDir, file);
      await fs.copyFile(sourcePath, backupPath);
      backupStats.annotationFilesBackedUp++;
    }
    
    // 备份相关文件
    for (const file of relatedFiles) {
      const sourcePath = path.join(annotationsDir, file);
      const backupPath = path.join(backupDir, file);
      try {
        await fs.copyFile(sourcePath, backupPath);
        backupStats.relatedFilesBackedUp++;
      } catch (error) {
        console.warn(`备份相关文件失败: ${file}`, error.message);
      }
    }
    
    console.log(`备份完成: ${backupStats.annotationFilesBackedUp} 个标注文件, ${backupStats.relatedFilesBackedUp} 个相关文件`);
    
    // 删除文件
    const deletionStats = {
      annotationFilesDeleted: 0,
      relatedFilesDeleted: 0,
      errors: []
    };
    
    // 删除标注文件
    for (const file of plantAnnotationFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        await fs.unlink(filePath);
        deletionStats.annotationFilesDeleted++;
        console.log(`删除标注文件: ${file}`);
      } catch (error) {
        const errorMsg = `删除标注文件失败: ${file} - ${error.message}`;
        deletionStats.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    // 删除相关文件
    for (const file of relatedFiles) {
      try {
        const filePath = path.join(annotationsDir, file);
        await fs.unlink(filePath);
        deletionStats.relatedFilesDeleted++;
        console.log(`删除相关文件: ${file}`);
      } catch (error) {
        const errorMsg = `删除相关文件失败: ${file} - ${error.message}`;
        deletionStats.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    // 准备响应数据
    const totalFilesFound = plantAnnotationFiles.length + relatedFiles.length;
    const totalFilesDeleted = deletionStats.annotationFilesDeleted + deletionStats.relatedFilesDeleted;
    
    const responseData = {
      success: true,
      message: `植物 ${plantId} 的标注数据删除完成`,
      plantId,
      statistics: {
        annotationFilesFound: plantAnnotationFiles.length,
        relatedFilesFound: relatedFiles.length,
        annotationFilesDeleted: deletionStats.annotationFilesDeleted,
        relatedFilesDeleted: deletionStats.relatedFilesDeleted,
        totalFilesProcessed: totalFilesFound,
        totalFilesDeleted: totalFilesDeleted,
        backupCreated: true,
        backupPath: backupDir,
        backupStats,
        errors: deletionStats.errors,
        timestamp: new Date().toISOString()
      }
    };
    
    if (deletionStats.errors.length > 0) {
      responseData.warning = `部分文件删除失败: ${deletionStats.errors.length} 个错误`;
      console.warn(`完成，但有 ${deletionStats.errors.length} 个错误`);
    }
    
    console.log(`植物 ${plantId} 删除完成: ${totalFilesDeleted}/${totalFilesFound} 文件已删除`);
    res.json(responseData);
    
  } catch (error) {
    console.error(`删除植物 ${req.params.plantId} 标注数据失败:`, error);
    res.status(500).json({
      success: false,
      error: '删除植物标注数据失败',
      details: error.message,
      plantId: req.params.plantId
    });
  }
});

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'plant-annotation-storage',
    features: [
      'annotation-storage',
      'plant-deletion',  // 新增：植物级标注删除功能
      'export-annotations'
    ]
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`标注数据存储服务器运行在 http://localhost:${PORT}`);
  console.log(`标注数据保存目录: ${annotationsDir}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});

export default app; 