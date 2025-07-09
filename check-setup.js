#!/usr/bin/env node

/**
 * 植物标注系统设置检查脚本
 * 检查系统依赖和配置是否正确
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class SetupChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.success = [];
  }

  log(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${type}: ${message}`);
  }

  async checkNodeVersion() {
    try {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      
      if (majorVersion >= 16) {
        this.success.push(`Node.js版本检查通过: ${version}`);
        this.log('✅', `Node.js ${version}`);
      } else {
        this.issues.push(`Node.js版本过低: ${version}，建议升级到v16+`);
        this.log('❌', `Node.js版本过低: ${version}`);
      }
    } catch (error) {
      this.issues.push(`无法检查Node.js版本: ${error.message}`);
    }
  }

  async checkDependencies() {
    const requiredPackages = ['express', 'cors'];
    const packageJsonPath = path.join(__dirname, 'package.json');
    
    try {
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = {...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})};
        
        for (const pkg of requiredPackages) {
          if (dependencies[pkg]) {
            this.success.push(`依赖包 ${pkg} 已安装`);
            this.log('✅', `依赖包 ${pkg}`);
          } else {
            this.issues.push(`缺少依赖包: ${pkg}`);
            this.log('❌', `缺少依赖包: ${pkg}`);
          }
        }
      } else {
        this.warnings.push('未找到package.json文件');
        this.log('⚠️', '未找到package.json文件');
      }
    } catch (error) {
      this.issues.push(`检查依赖时出错: ${error.message}`);
    }
  }

  async checkBackendServer() {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3003/api/health', {timeout: 3000}, (res) => {
        if (res.statusCode === 200) {
          this.success.push('后端服务运行正常');
          this.log('✅', '后端服务 (localhost:3003)');
        } else {
          this.issues.push(`后端服务响应异常: HTTP ${res.statusCode}`);
          this.log('❌', `后端服务响应异常: HTTP ${res.statusCode}`);
        }
        resolve();
      });

      req.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          this.issues.push('后端服务未启动，请运行 ./start-backend.sh');
          this.log('❌', '后端服务未启动');
        } else {
          this.issues.push(`后端服务连接失败: ${error.message}`);
          this.log('❌', `后端服务连接失败: ${error.message}`);
        }
        resolve();
      });

      req.on('timeout', () => {
        this.issues.push('后端服务连接超时');
        this.log('❌', '后端服务连接超时');
        req.destroy();
        resolve();
      });
    });
  }

  async checkDatasetPath() {
    const datasetPath = '/Users/tshoiasc/Brassica napus dataset/dataset';
    
    try {
      if (fs.existsSync(datasetPath)) {
        const stats = fs.statSync(datasetPath);
        if (stats.isDirectory()) {
          this.success.push(`数据集目录存在: ${datasetPath}`);
          this.log('✅', '数据集目录');
        } else {
          this.issues.push(`数据集路径不是目录: ${datasetPath}`);
          this.log('❌', '数据集路径不是目录');
        }
      } else {
        this.issues.push(`数据集目录不存在: ${datasetPath}`);
        this.log('❌', '数据集目录不存在');
      }
    } catch (error) {
      this.issues.push(`检查数据集目录时出错: ${error.message}`);
    }
  }

  async checkScripts() {
    const scripts = ['start-backend.sh', 'start.sh'];
    
    for (const script of scripts) {
      const scriptPath = path.join(__dirname, script);
      try {
        if (fs.existsSync(scriptPath)) {
          const stats = fs.statSync(scriptPath);
          if (stats.mode & 0o111) {
            this.success.push(`启动脚本可执行: ${script}`);
            this.log('✅', `启动脚本 ${script}`);
          } else {
            this.warnings.push(`启动脚本不可执行: ${script}，运行 chmod +x ${script}`);
            this.log('⚠️', `启动脚本不可执行: ${script}`);
          }
        } else {
          this.warnings.push(`启动脚本不存在: ${script}`);
          this.log('⚠️', `启动脚本不存在: ${script}`);
        }
      } catch (error) {
        this.issues.push(`检查启动脚本时出错: ${error.message}`);
      }
    }
  }

  async runAllChecks() {
    console.log('🔍 开始系统设置检查...\n');
    
    await this.checkNodeVersion();
    await this.checkDependencies();
    await this.checkBackendServer();
    await this.checkDatasetPath();
    await this.checkScripts();
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 检查结果汇总:');
    console.log('='.repeat(50));
    
    if (this.success.length > 0) {
      console.log('\n✅ 正常项目:');
      this.success.forEach(item => console.log(`  • ${item}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告项目:');
      this.warnings.forEach(item => console.log(`  • ${item}`));
    }
    
    if (this.issues.length > 0) {
      console.log('\n❌ 问题项目:');
      this.issues.forEach(item => console.log(`  • ${item}`));
      
      console.log('\n🔧 建议解决方案:');
      if (this.issues.some(issue => issue.includes('后端服务'))) {
        console.log('  1. 启动后端服务: ./start-backend.sh');
      }
      if (this.issues.some(issue => issue.includes('依赖包'))) {
        console.log('  2. 安装依赖: npm install express cors');
      }
      if (this.issues.some(issue => issue.includes('数据集'))) {
        console.log('  3. 检查数据集路径设置');
      }
    }
    
    const totalIssues = this.issues.length + this.warnings.length;
    if (totalIssues === 0) {
      console.log('\n🎉 所有检查通过！系统配置正常。');
    } else {
      console.log(`\n📝 发现 ${this.issues.length} 个问题，${this.warnings.length} 个警告。`);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const checker = new SetupChecker();
  checker.runAllChecks().catch(console.error);
}

module.exports = SetupChecker;