#!/bin/bash

# Backend 启动脚本

echo "启动植物标注系统后端服务..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules/express" ] || [ ! -d "node_modules/cors" ]; then
    echo "首次运行，安装依赖..."
    npm install express cors
    if [ $? -ne 0 ]; then
        echo "依赖安装失败"
        exit 1
    fi
fi

# 检查端口是否被占用
if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null ; then
    echo "端口 3003 已被占用，正在停止现有服务..."
    lsof -ti:3003 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 启动后端服务
echo "启动后端服务 (端口: 3003)..."
echo "数据集路径: /Users/tshoiasc/Brassica napus dataset/dataset"
echo "健康检查: http://localhost:3003/api/health"
echo ""

node backend-server.js