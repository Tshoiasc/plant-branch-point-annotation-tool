#!/usr/bin/env node

/**
 * 植物图像关键点标注工具 - 跨平台启动脚本
 * 自动检测环境并启动前后端服务
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查Node.js和npm
function checkEnvironment() {
  colorLog('🌱 植物图像关键点标注工具', 'green');
  colorLog('================================', 'cyan');
  console.log('');
  
  try {
    const nodeVersion = process.version;
    colorLog(`✅ Node.js版本: ${nodeVersion}`, 'green');
    
    // 检查npm是否可用
    const npmCheck = spawn('npm', ['--version'], { stdio: 'pipe' });
    npmCheck.on('close', (code) => {
      if (code === 0) {
        colorLog('✅ npm已安装', 'green');
      } else {
        colorLog('❌ npm未找到', 'red');
        process.exit(1);
      }
    });
    
  } catch (error) {
    colorLog('❌ 环境检查失败', 'red');
    console.error(error.message);
    process.exit(1);
  }
}

// 检查依赖
function checkDependencies() {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    colorLog('📦 未找到node_modules，正在安装依赖...', 'yellow');
    
    const npmInstall = spawn('npm', ['install'], { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    npmInstall.on('close', (code) => {
      if (code === 0) {
        colorLog('✅ 依赖安装完成', 'green');
        startServices();
      } else {
        colorLog('❌ 依赖安装失败', 'red');
        process.exit(1);
      }
    });
  } else {
    colorLog('✅ 依赖已安装', 'green');
    startServices();
  }
}

// 启动服务
function startServices() {
  console.log('');
  colorLog('🚀 正在启动服务...', 'blue');
  colorLog('   - 后端API服务: http://localhost:3002', 'cyan');
  colorLog('   - 前端应用: http://localhost:5173', 'cyan');
  console.log('');
  colorLog('💡 提示:', 'yellow');
  colorLog('   - 按 Ctrl+C 停止所有服务', 'yellow');
  colorLog('   - 确保浏览器支持File System Access API (Chrome/Edge)', 'yellow');
  console.log('');
  
  // 启动npm start命令
  const npmStart = spawn('npm', ['start'], { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  // 处理进程退出
  npmStart.on('close', (code) => {
    if (code !== 0) {
      colorLog(`❌ 服务启动失败，退出码: ${code}`, 'red');
    } else {
      colorLog('👋 服务已停止', 'yellow');
    }
  });
  
  // 处理Ctrl+C
  process.on('SIGINT', () => {
    colorLog('\n🛑 正在停止服务...', 'yellow');
    npmStart.kill('SIGINT');
    process.exit(0);
  });
}

// 显示帮助信息
function showHelp() {
  console.log(`
用法: node start.js [选项]

选项:
  --help, -h     显示帮助信息
  --version, -v  显示版本信息
  --dev          开发模式（等同于npm run dev）
  --backend      仅启动后端服务
  --frontend     仅启动前端服务

示例:
  node start.js           # 启动完整应用（前端+后端）
  node start.js --backend # 仅启动后端API服务
  node start.js --dev     # 开发模式启动
`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    console.log(packageJson.version);
    return;
  }
  
  checkEnvironment();
  
  setTimeout(() => {
    if (args.includes('--backend')) {
      colorLog('🚀 仅启动后端服务...', 'blue');
      const backend = spawn('npm', ['run', 'dev:backend'], { stdio: 'inherit' });
    } else if (args.includes('--frontend')) {
      colorLog('🚀 仅启动前端服务...', 'blue');
      const frontend = spawn('npm', ['run', 'dev:frontend'], { stdio: 'inherit' });
    } else if (args.includes('--dev')) {
      colorLog('🚀 启动开发模式...', 'blue');
      const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
    } else {
      checkDependencies();
    }
  }, 1000);
}

// 运行主函数
main(); 