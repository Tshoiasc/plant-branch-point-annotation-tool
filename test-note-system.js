/**
 * TDD测试 - 植物笔记系统
 * 
 * 测试驱动开发：先写测试，再实现功能
 */

// 简单的测试框架
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 开始运行笔记系统 TDD 测试...\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.error(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 测试结果: ${this.passed} 通过, ${this.failed} 失败`);
    return this.failed === 0;
  }
}

// 断言函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value should not be null or undefined');
  }
}

function assertArrayContains(array, item, message) {
  if (!array.includes(item)) {
    throw new Error(message || `Array should contain ${item}`);
  }
}

// 模拟 UUID 生成
function generateUUID() {
  return 'test-uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 模拟存储管理器
class MockStorageManager {
  constructor() {
    this.data = new Map();
  }

  async saveAnnotationFile(filename, data) {
    this.data.set(filename, JSON.stringify(data));
  }

  async loadAnnotationFile(filename) {
    const data = this.data.get(filename);
    return data ? JSON.parse(data) : null;
  }

  async deleteAnnotationFile(filename) {
    return this.data.delete(filename);
  }

  async getAllAnnotationFiles() {
    return Array.from(this.data.keys());
  }
}

// 测试套件
const testRunner = new TestRunner();

// ===========================================
// 测试1: 笔记数据结构验证
// ===========================================
testRunner.test('笔记数据结构应该包含必要字段', async () => {
  const noteData = {
    noteId: generateUUID(),
    plantId: 'BR017-028122',
    imageId: null,
    noteType: 'general',
    title: '测试笔记',
    content: '这是一个测试笔记',
    tags: ['测试', '笔记'],
    author: 'test-user',
    timestamp: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    version: '1.0'
  };

  // 验证必要字段存在
  assertNotNull(noteData.noteId, '笔记ID不能为空');
  assertNotNull(noteData.plantId, '植物ID不能为空');
  assertNotNull(noteData.title, '笔记标题不能为空');
  assertNotNull(noteData.content, '笔记内容不能为空');
  assert(Array.isArray(noteData.tags), '标签应该是数组');
  assert(['general', 'observation', 'annotation'].includes(noteData.noteType), '笔记类型应该是有效值');
});

// ===========================================
// 测试2: 笔记管理器基本功能
// ===========================================
testRunner.test('笔记管理器应该能够创建和获取植物笔记', async () => {
  const mockStorage = new MockStorageManager();
  
  // 这里我们定义笔记管理器应该有的接口
  // 实际实现会在测试通过后进行
  class NoteManager {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.notes = new Map();
    }

    async addPlantNote(plantId, noteData) {
      const noteId = generateUUID();
      const fullNoteData = {
        noteId,
        plantId,
        imageId: null,
        noteType: noteData.noteType || 'general',
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        author: noteData.author || 'unknown',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      this.notes.set(noteId, fullNoteData);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, fullNoteData);
      return noteId;
    }

    async getPlantNotes(plantId) {
      return Array.from(this.notes.values()).filter(note => 
        note.plantId === plantId && note.imageId === null
      );
    }
  }

  const noteManager = new NoteManager(mockStorage);
  
  // 测试添加植物笔记
  const noteId = await noteManager.addPlantNote('BR017-028122', {
    title: '植物观察笔记',
    content: '这个植物生长良好',
    tags: ['观察', '生长']
  });

  assertNotNull(noteId, '应该返回笔记ID');
  
  // 测试获取植物笔记
  const notes = await noteManager.getPlantNotes('BR017-028122');
  assertEquals(notes.length, 1, '应该有一个笔记');
  assertEquals(notes[0].title, '植物观察笔记', '笔记标题应该正确');
});

// ===========================================
// 测试3: 图像级笔记功能
// ===========================================
testRunner.test('笔记管理器应该能够创建和获取图像笔记', async () => {
  const mockStorage = new MockStorageManager();
  
  class NoteManager {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.notes = new Map();
    }

    async addImageNote(plantId, imageId, noteData) {
      const noteId = generateUUID();
      const fullNoteData = {
        noteId,
        plantId,
        imageId,
        noteType: noteData.noteType || 'general',
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        author: noteData.author || 'unknown',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      this.notes.set(noteId, fullNoteData);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, fullNoteData);
      return noteId;
    }

    async getImageNotes(plantId, imageId) {
      return Array.from(this.notes.values()).filter(note => 
        note.plantId === plantId && note.imageId === imageId
      );
    }
  }

  const noteManager = new NoteManager(mockStorage);
  
  // 测试添加图像笔记
  const imageId = 'BR017-028122_sv-000_image.png';
  const noteId = await noteManager.addImageNote('BR017-028122', imageId, {
    title: '图像标注笔记',
    content: '这张图像显示了植物的侧面',
    tags: ['标注', '侧面']
  });

  assertNotNull(noteId, '应该返回笔记ID');
  
  // 测试获取图像笔记
  const notes = await noteManager.getImageNotes('BR017-028122', imageId);
  assertEquals(notes.length, 1, '应该有一个图像笔记');
  assertEquals(notes[0].imageId, imageId, '图像ID应该正确');
});

// ===========================================
// 测试4: 笔记更新和删除
// ===========================================
testRunner.test('笔记管理器应该能够更新和删除笔记', async () => {
  const mockStorage = new MockStorageManager();
  
  class NoteManager {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.notes = new Map();
    }

    async addPlantNote(plantId, noteData) {
      const noteId = generateUUID();
      const fullNoteData = {
        noteId,
        plantId,
        imageId: null,
        noteType: noteData.noteType || 'general',
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        author: noteData.author || 'unknown',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      this.notes.set(noteId, fullNoteData);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, fullNoteData);
      return noteId;
    }

    async updateNote(noteId, updates) {
      const note = this.notes.get(noteId);
      if (!note) {
        throw new Error('笔记不存在');
      }

      const updatedNote = {
        ...note,
        ...updates,
        lastModified: new Date().toISOString()
      };

      this.notes.set(noteId, updatedNote);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, updatedNote);
    }

    async deleteNote(noteId) {
      if (!this.notes.has(noteId)) {
        throw new Error('笔记不存在');
      }

      this.notes.delete(noteId);
      await this.storageManager.deleteAnnotationFile(`note_${noteId}.json`);
    }

    async getNote(noteId) {
      return this.notes.get(noteId);
    }
  }

  const noteManager = new NoteManager(mockStorage);
  
  // 添加笔记
  const noteId = await noteManager.addPlantNote('BR017-028122', {
    title: '原始标题',
    content: '原始内容'
  });

  // 测试更新笔记
  await noteManager.updateNote(noteId, {
    title: '更新后的标题',
    content: '更新后的内容'
  });

  const updatedNote = await noteManager.getNote(noteId);
  assertEquals(updatedNote.title, '更新后的标题', '标题应该被更新');
  assertEquals(updatedNote.content, '更新后的内容', '内容应该被更新');

  // 测试删除笔记
  await noteManager.deleteNote(noteId);
  const deletedNote = await noteManager.getNote(noteId);
  assertEquals(deletedNote, undefined, '笔记应该被删除');
});

// ===========================================
// 测试5: 笔记搜索功能
// ===========================================
testRunner.test('笔记管理器应该能够搜索笔记', async () => {
  const mockStorage = new MockStorageManager();
  
  class NoteManager {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.notes = new Map();
    }

    async addPlantNote(plantId, noteData) {
      const noteId = generateUUID();
      const fullNoteData = {
        noteId,
        plantId,
        imageId: null,
        noteType: noteData.noteType || 'general',
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        author: noteData.author || 'unknown',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      this.notes.set(noteId, fullNoteData);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, fullNoteData);
      return noteId;
    }

    async searchNotes(query, filters = {}) {
      const notes = Array.from(this.notes.values());
      
      return notes.filter(note => {
        // 文本搜索
        const textMatch = !query || 
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.content.toLowerCase().includes(query.toLowerCase()) ||
          note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
        
        // 植物ID过滤
        const plantMatch = !filters.plantId || note.plantId === filters.plantId;
        
        // 笔记类型过滤
        const typeMatch = !filters.noteType || note.noteType === filters.noteType;
        
        return textMatch && plantMatch && typeMatch;
      });
    }
  }

  const noteManager = new NoteManager(mockStorage);
  
  // 添加测试笔记
  await noteManager.addPlantNote('BR017-028122', {
    title: '植物观察',
    content: '这个植物生长良好',
    tags: ['观察', '生长']
  });
  
  await noteManager.addPlantNote('BR017-028122', {
    title: '病虫害记录',
    content: '发现叶片有黄斑',
    tags: ['病害', '叶片']
  });

  // 测试文本搜索
  const searchResults = await noteManager.searchNotes('植物');
  assertEquals(searchResults.length, 1, '应该找到一个包含"植物"的笔记');
  
  // 测试标签搜索
  const tagResults = await noteManager.searchNotes('生长');
  assertEquals(tagResults.length, 1, '应该找到一个包含"生长"标签的笔记');
  
  // 测试植物ID过滤
  const plantResults = await noteManager.searchNotes('', { plantId: 'BR017-028122' });
  assertEquals(plantResults.length, 2, '应该找到该植物的所有笔记');
});

// ===========================================
// 测试6: 笔记独立性验证
// ===========================================
testRunner.test('笔记系统应该独立于跳过功能', async () => {
  const mockStorage = new MockStorageManager();
  
  // 模拟跳过功能的存储
  await mockStorage.saveAnnotationFile('BR017-028122_skip_info.json', {
    status: 'skipped',
    skipReason: '植物已死亡',
    skipDate: new Date().toISOString()
  });
  
  class NoteManager {
    constructor(storageManager) {
      this.storageManager = storageManager;
      this.notes = new Map();
    }

    async addPlantNote(plantId, noteData) {
      const noteId = generateUUID();
      const fullNoteData = {
        noteId,
        plantId,
        imageId: null,
        noteType: noteData.noteType || 'general',
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        author: noteData.author || 'unknown',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      this.notes.set(noteId, fullNoteData);
      await this.storageManager.saveAnnotationFile(`note_${noteId}.json`, fullNoteData);
      return noteId;
    }

    async getPlantNotes(plantId) {
      return Array.from(this.notes.values()).filter(note => 
        note.plantId === plantId && note.imageId === null
      );
    }
  }

  const noteManager = new NoteManager(mockStorage);
  
  // 为已跳过的植物添加笔记
  const noteId = await noteManager.addPlantNote('BR017-028122', {
    title: '跳过原因详细记录',
    content: '植物在第三周开始出现枯萎迹象',
    tags: ['记录', '观察']
  });

  assertNotNull(noteId, '应该能够为已跳过的植物添加笔记');
  
  // 验证笔记和跳过信息是分开存储的
  const notes = await noteManager.getPlantNotes('BR017-028122');
  assertEquals(notes.length, 1, '应该有一个笔记');
  
  // 检查存储中的文件
  const allFiles = await mockStorage.getAllAnnotationFiles();
  assertArrayContains(allFiles, 'BR017-028122_skip_info.json', '跳过信息应该存在');
  assertArrayContains(allFiles, `note_${noteId}.json`, '笔记应该存在');
  
  // 验证文件内容不同
  const skipInfo = await mockStorage.loadAnnotationFile('BR017-028122_skip_info.json');
  const noteInfo = await mockStorage.loadAnnotationFile(`note_${noteId}.json`);
  
  assert(skipInfo.status === 'skipped', '跳过信息应该包含status字段');
  assert(noteInfo.noteId === noteId, '笔记信息应该包含noteId字段');
  assert(skipInfo.status !== noteInfo.noteId, '跳过信息和笔记信息应该不同');
});

// 导出测试运行器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testRunner, TestRunner, assert, assertEquals, assertNotNull };
}

// 如果在浏览器中运行，添加到全局对象
if (typeof window !== 'undefined') {
  window.NoteSystemTests = { testRunner, TestRunner, assert, assertEquals, assertNotNull };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  testRunner.run().then(success => {
    console.log(success ? '\n🎉 所有测试通过！' : '\n💥 有测试失败！');
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('测试运行出错:', error);
    process.exit(1);
  });
}

// 立即运行测试
console.log('开始执行笔记系统TDD测试...');
testRunner.run().then(success => {
  console.log(success ? '\n🎉 所有测试通过！' : '\n💥 有测试失败！');
}).catch(error => {
  console.error('测试运行出错:', error);
});