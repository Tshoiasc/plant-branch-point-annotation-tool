# 植物图像关键点标注工具

用于处理油菜数据集的专业标注工具，支持关键点标注、时间序列分析和数据导出。

## 🚀 快速启动

### 方式一：使用启动脚本（推荐）

**Windows用户：**
```bash
# 双击运行或在命令行中执行
start.bat
```

**macOS/Linux用户：**
```bash
# 添加执行权限并运行
chmod +x start.sh
./start.sh
```

**跨平台Node.js脚本：**
```bash
node start.js
```

### 方式二：使用npm命令

```bash
# 安装依赖
npm install

# 启动完整应用（前端+后端）
npm start

# 或者使用以下命令
npm run dev:full

# 单独启动前端
npm run dev:frontend

# 单独启动后端
npm run dev:backend
```

## 📋 系统要求

- **Node.js**: >= 16.0.0
- **浏览器**: Chrome 或 Edge（需要支持File System Access API）
- **操作系统**: Windows 10+, macOS 10.15+, 或现代Linux发行版

## 🌟 功能特点

- ✅ **本地文件系统访问**：直接读取本地数据集，无需上传
- ✅ **智能图像解析**：自动提取时间信息并按序排列
- ✅ **触摸板缩放**：0.1x-10x缩放范围，支持精确定位
- ✅ **关键点标注**：左键添加、右键删除、拖拽调整
- ✅ **时间序列传播**：首次标注自动传播到所有时间点
- ✅ **微调模式**：支持中间时间点的精确调整
- ✅ **自动化工作流**：标注完成后自动跳转
- ✅ **数据持久化**：本地存储和服务器备份
- ✅ **多视角支持**：sv-000、sv-045、sv-090等视角
- ✅ **进度统计**：实时显示标注进度和完成率

## 🎯 使用说明

### 1. 启动应用

使用上述任一启动方式，应用将在以下地址运行：
- **前端界面**: http://localhost:5173
- **后端API**: http://localhost:3002

### 2. 选择数据集

1. 点击"选择数据集"按钮
2. 选择包含植物文件夹的根目录
3. 等待数据集加载完成

### 3. 开始标注

1. 从左侧列表选择植物
2. 选择视角（sv-000、sv-045等）
3. 选择要标注的图像
4. 使用鼠标进行标注：
   - **左键点击**：添加关键点
   - **右键点击关键点**：删除关键点
   - **拖拽关键点**：移动位置
   - **滚轮**：缩放图像
   - **Shift + 拖拽**：平移图像

### 4. 保存和导出

- **保存标注**：保存当前图像的标注点
- **保存为微调**：在时间序列中进行精确调整
- **完成植物**：标记植物为已完成并跳转到下一个
- **导出数据**：导出所有标注数据为JSON格式

## 🛠 开发指南

### 项目结构

```
植物标注工具/
├── src/                    # 前端源码
│   ├── core/              # 核心模块
│   │   ├── AnnotationTool.js          # 标注工具
│   │   ├── FileSystemManager.js       # 文件系统管理
│   │   ├── PlantDataManager.js        # 植物数据管理
│   │   ├── AnnotationStorageManager.js # 标注存储管理
│   │   └── TimeSeriesAnnotationManager.js # 时间序列管理
│   ├── styles/            # 样式文件
│   └── main.js           # 应用入口
├── server.js             # 后端服务器
├── annotations/          # 标注数据存储目录
├── start.sh             # Unix/Linux启动脚本
├── start.bat            # Windows启动脚本
├── start.js             # 跨平台Node.js启动脚本
└── package.json         # 项目配置
```

### 技术架构

**前端技术栈：**
- **构建工具**: Vite 5.0
- **语言**: ES6+ JavaScript (模块化)
- **样式**: CSS3 (CSS变量 + Grid + Flexbox)
- **API**: File System Access API, Canvas API, IndexedDB

**后端技术栈：**
- **运行时**: Node.js
- **框架**: Express.js
- **存储**: JSON文件 + IndexedDB
- **端口**: 3002

### 开发命令

```bash
# 开发模式（仅前端）
npm run dev

# 开发模式（前端+后端）
npm start

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 代码检查
npm run lint

# 修复代码风格
npm run lint:fix

# 运行测试
npm test

# 健康检查
npm run health
```

## 📊 数据格式

### 纯净图像标注数据格式（推荐）

这是新的导出格式，直接输出每张图像对应的标注点，包含**所有有标注的图像**（原始标注、时间序列继承的标注、手动微调的标注），不包含内部管理信息：

```json
{
  "exportTime": "2024-01-01T00:00:00.000Z",
  "version": "2.0",
  "format": "pure_image_annotations",
  "description": "每张图像对应的标注点数据，包含所有有标注的图像，不包含内部管理信息",
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

**说明：**
- 包含所有植株所有视角的所有有标注的图像
- 不区分标注来源（原始标注、继承标注、微调标注）
- 每张图像都包含其实际的标注点坐标
- 结构简单，直接可用于数据分析和机器学习

### 完整标注数据格式（工具内部使用）

包含时间序列管理信息的完整格式：

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
      "timeSeriesData": { /* 时间序列管理数据 */ }
    }
  }
}
```

### 使用建议

- **数据分析和处理**: 使用纯净格式，结构简单，直接可用
- **工具内部导入**: 使用完整格式，保留所有管理信息
- **第三方工具集成**: 推荐使用纯净格式，兼容性更好

## 🔧 故障排除

### 常见问题

1. **浏览器不支持File System Access API**
   - 解决方案：使用Chrome或Edge浏览器

2. **无法选择目录**
   - 确保浏览器版本支持File System Access API
   - 检查浏览器权限设置

3. **服务启动失败**
   - 检查端口3002和5173是否被占用
   - 确保Node.js版本>=16.0.0

4. **图像加载失败**
   - 检查数据集目录结构是否正确
   - 确保图像文件为PNG格式

### 日志查看

- **前端日志**：浏览器开发者工具Console
- **后端日志**：终端输出

## 📄 许可证

MIT License - 详见LICENSE文件

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个工具！

---

**技术支持**: 如有问题，请查看日志信息或提交Issue 