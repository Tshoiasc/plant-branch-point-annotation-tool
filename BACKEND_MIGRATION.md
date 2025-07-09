# 植物标注系统 - 后端迁移完成

## 概述

原有的植物标注系统直接使用浏览器的 File System Access API 访问文件系统，现已成功迁移到使用后端服务的架构。

## 架构变更

### 之前：
- 前端直接访问文件系统
- 依赖 File System Access API
- 需要用户手动选择目录

### 现在：
- 前端通过 HTTP 请求与后端通信
- 后端处理所有文件系统操作
- 数据集路径固定为：`/Users/tshoiasc/Brassica napus dataset/dataset`

## 启动方法

### 方法1：使用启动脚本（推荐）
```bash
./start-backend.sh
```

### 方法2：手动启动
```bash
# 安装依赖（仅第一次需要）
npm install express cors

# 启动后端服务
node backend-server.js
```

## API 端点

后端服务运行在端口 `3003`，提供以下 API：

- `GET /api/health` - 健康检查
- `GET /api/dataset-info` - 获取数据集信息
- `GET /api/plant-directories` - 获取所有植物文件夹
- `GET /api/plant-images/:plantId` - 获取指定植物的图像
- `GET /api/image/:plantId/:viewAngle/:imageName` - 获取具体图像文件
- `POST /api/annotation/:imageId` - 保存标注文件
- `GET /api/annotation/:imageId` - 读取标注文件
- `GET /api/annotations` - 获取所有标注文件列表
- `DELETE /api/annotation/:imageId` - 删除标注文件

## 测试

启动后端服务后，可以通过以下命令测试：

```bash
# 健康检查
curl http://localhost:3003/api/health

# 查看数据集信息
curl http://localhost:3003/api/dataset-info

# 查看植物数量
curl http://localhost:3003/api/plant-directories | jq '.data | length'
```

## 文件结构

- `backend-server.js` - 后端服务器主文件
- `src/core/HttpFileSystemManager.js` - HTTP文件系统管理器
- `src/core/PlantDataManager.js` - 已更新使用HTTP管理器
- `start-backend.sh` - 后端启动脚本

## 优势

1. **安全性提升**：移除了浏览器直接访问文件系统的需求
2. **跨平台兼容**：不再依赖特定浏览器的File System Access API
3. **集中管理**：所有文件操作统一在后端处理
4. **便于扩展**：后端可以添加权限控制、日志记录等功能

## 注意事项

- 确保数据集目录 `/Users/tshoiasc/Brassica napus dataset/dataset` 存在
- 如果端口3003被占用，启动脚本会自动停止占用进程
- 标注文件将保存在 `{数据集目录}/annotations/` 文件夹中