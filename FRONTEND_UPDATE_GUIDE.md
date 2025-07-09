# 前端更新完成 - 测试指南

## 🎉 更新完成

前端代码已成功更新以使用HTTP后端，主要变更包括：

### ✅ 完成的更新：

1. **PlantDataManager** - 已切换到 `HttpFileSystemManager`
2. **主应用逻辑** - 移除File System Access API依赖
3. **数据集选择** - 改为后端连接模式
4. **浏览器兼容性检查** - 改为后端连接检查
5. **用户界面** - 按钮文本更新为"Connect to Dataset"

### 🔧 核心变更：

#### 1. 文件系统管理器
- 原来: `FileSystemManager` (浏览器File System Access API)
- 现在: `HttpFileSystemManager` (HTTP后端通信)

#### 2. 数据集选择流程
- 原来: 用户手动选择文件夹
- 现在: 自动连接到预设数据集路径

#### 3. 兼容性检查
- 原来: 检查File System Access API支持
- 现在: 检查后端服务连接

## 🧪 测试方法

### 方法1: 使用测试页面
1. 确保后端服务运行中: `./start-backend.sh`
2. 在浏览器中打开: `test-backend.html`
3. 点击各个测试按钮验证功能

### 方法2: 使用主应用
1. 确保后端服务运行中: `./start-backend.sh`
2. 在浏览器中打开: `index.html`
3. 点击"Connect to Dataset"按钮
4. 应该能看到植物列表加载

## 🚀 启动步骤

### 1. 启动后端服务
```bash
cd "/Users/tshoiasc/画图模板"
./start-backend.sh
```

### 2. 验证后端运行
```bash
curl http://localhost:3003/api/health
```

### 3. 打开前端应用
在浏览器中打开 `index.html` 或 `test-backend.html`

## 🔍 故障排除

### 问题1: "无法连接到后端服务"
- **原因**: 后端服务未启动
- **解决**: 运行 `./start-backend.sh`

### 问题2: "端口被占用"
- **原因**: 端口3003已被使用
- **解决**: 启动脚本会自动处理，或手动杀死进程

### 问题3: "数据集路径不存在"
- **原因**: 数据集目录不存在
- **解决**: 确保 `/Users/tshoiasc/Brassica napus dataset/dataset` 存在

### 问题4: CORS错误
- **原因**: 浏览器安全策略
- **解决**: 使用本地服务器 (如 `python -m http.server`) 而不是直接打开HTML文件

## 📁 数据集要求

确保数据集目录结构如下：
```
/Users/tshoiasc/Brassica napus dataset/dataset/
├── BR001-000001/
│   ├── sv-000/
│   │   ├── *.png
│   ├── sv-045/
│   │   ├── *.png
│   └── sv-090/
│       ├── *.png
├── BR001-000002/
│   └── ...
└── annotations/ (自动创建)
    ├── image1.json
    └── image2.json
```

## 🎯 预期结果

成功连接后应该看到：
- ✅ 后端服务连接成功
- ✅ 数据集结构验证通过，发现 XXX 个植物文件夹
- ✅ 成功加载数据集: XXX 个植物
- 植物列表显示在左侧面板
- 点击植物可以查看其图像

## 📞 支持

如果遇到问题，请检查：
1. 后端服务日志
2. 浏览器开发者工具控制台
3. 数据集目录权限和结构