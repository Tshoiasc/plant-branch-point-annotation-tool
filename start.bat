@echo off
chcp 65001 >nul

echo 🌱 植物图像关键点标注工具
echo ================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js (https://nodejs.org/)
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到npm，请确保Node.js正确安装
    pause
    exit /b 1
)

echo ✅ Node.js版本:
node --version
echo ✅ npm版本:
npm --version
echo.

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 未找到node_modules，正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

echo 🚀 正在启动服务...
echo    - 后端API服务: http://localhost:3002
echo    - 前端应用: http://localhost:5173
echo.
echo 💡 提示:
echo    - 按 Ctrl+C 停止所有服务
echo    - 确保浏览器支持File System Access API (Chrome/Edge)
echo.

REM 启动服务
npm start

pause 