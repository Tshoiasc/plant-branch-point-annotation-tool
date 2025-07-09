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
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'plant-annotation-storage'
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