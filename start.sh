#!/bin/bash

# 植物图像关键点标注工具 - 启动脚本
# 同时启动前端和后端服务

echo "🌱 植物图像关键点标注工具"
echo "================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js (https://nodejs.org/)"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到npm，请确保Node.js正确安装"
    exit 1
fi

echo "✅ Node.js版本: $(node --version)"
echo "✅ npm版本: $(npm --version)"
echo ""

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 未找到node_modules，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo ""
fi

echo "🚀 正在启动服务..."
echo "   - 后端API服务: http://localhost:3002"
echo "   - 前端应用: http://localhost:5173"
echo ""
echo "💡 提示:"
echo "   - 按 Ctrl+C 停止所有服务"
echo "   - 确保浏览器支持File System Access API (Chrome/Edge)"
echo ""

# 启动服务
npm start 