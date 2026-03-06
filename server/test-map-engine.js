// ============================================================
//  test-map-engine.js — 快速测试地图引擎
//  运行: node server/test-map-engine.js
// ============================================================

import MapEngine from './nanako-map-engine.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

// 使用临时目录避免污染正式数据
const testDataDir = path.join(os.tmpdir(), 'nanako-map-test-' + Date.now());
console.log(`📁 测试数据目录: ${testDataDir}\n`);

const map = new MapEngine({
    dataDir: testDataDir,
    stepMs: 50,  // 加快步进速度以便测试
    saveIntervalMs: 60000,
});

// 监听事件
map.on('step', d => {
    process.stdout.write(`  🚶 [${d.col},${d.row}] ${d.dir} (剩余 ${d.remaining} 步)\r`);
});

map.on('arrived', d => {
    console.log(`\n  ✅ 到达! [${d.col},${d.row}] ${d.label || ''}`);
});

map.on('blocked', d => {
    console.log(`  ❌ 阻塞: ${d.message || d.reason}`);
});

// ─── 测试用例 ──────────────────────────────────────────────

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('═══════════════════════════════════════');
    console.log(' 🧪 MapEngine 云端地图引擎测试');
    console.log('═══════════════════════════════════════\n');

    // 1. 查询初始位置
    console.log('📍 测试1: 查询位置');
    const pos = map.getPosition();
    console.log(`  位置: [${pos.col},${pos.row}] 最近地点: ${pos.location_label}`);
    console.log(`  距离: ${pos.distance_to_location} 格`);
    console.log();

    // 2. 查找地点
    console.log('🔍 测试2: 地点模糊查找');
    ['咖啡厅', '公园', '回家', '不存在的地方'].forEach(name => {
        const result = map.findLocation(name);
        console.log(`  "${name}" → ${result ? `[${result.col},${result.row}] ${result.label}` : '❌ 未找到'}`);
    });
    console.log();

    // 3. 移动到命名地点
    console.log('🚶 测试3: 移动到"公园"');
    const moveResult = map.moveTo({ location: '公园' });
    console.log(`  结果: ${moveResult.message} (${moveResult.path_length} 步)`);

    // 等待到达
    await new Promise(resolve => {
        map.once('arrived', () => resolve());
    });

    // 验证位置
    const pos2 = map.getPosition();
    console.log(`  当前位置: [${pos2.col},${pos2.row}] 最近: ${pos2.location_label}\n`);

    // 4. 移动到坐标
    console.log('🚶 测试4: 移动到坐标 [32, 21]');
    const moveResult2 = map.moveTo({ target: [32, 21] });
    console.log(`  结果: ${moveResult2.message} (${moveResult2.path_length} 步)`);

    await new Promise(resolve => {
        map.once('arrived', () => resolve());
    });

    const pos3 = map.getPosition();
    console.log(`  当前位置: [${pos3.col},${pos3.row}] 最近: ${pos3.location_label}\n`);

    // 5. 不可行走目标
    console.log('❌ 测试5: 移动到墙壁内 [3, 3]');
    const moveResult3 = map.moveTo({ target: [3, 3] });
    console.log(`  结果: ${moveResult3.message}\n`);

    // 6. 未知地点
    console.log('❌ 测试6: 移动到未知地点');
    const moveResult4 = map.moveTo({ location: '火星基地' });
    console.log(`  结果: ${moveResult4.message}\n`);

    // 7. 可行走性检查
    console.log('🧱 测试7: 可行走性检查');
    [[7, 14], [3, 3], [15, 17], [0, 0]].forEach(([c, r]) => {
        console.log(`  [${c},${r}] → ${map.isWalkable(c, r) ? '✅ 可行走' : '🧱 不可通过'}`);
    });
    console.log();

    // 8. 地图快照
    console.log('📸 测试8: 地图快照');
    const snapshot = map.getMapSnapshot();
    console.log(`  角色位置: [${snapshot.charPos.col},${snapshot.charPos.row}]`);
    console.log(`  POI 数量: ${snapshot.pois.length}`);
    console.log(`  家具数量: ${snapshot.customFurn.length}`);
    console.log(`  地板数量: ${snapshot.customFloors.length}`);
    console.log(`  地图尺寸: ${snapshot.mapSize.cols}×${snapshot.mapSize.rows}`);
    console.log();

    // 清理
    map.destroy();

    console.log('═══════════════════════════════════════');
    console.log(' ✨ 所有测试完成!');
    console.log('═══════════════════════════════════════');

    // 清理临时文件
    try {
        fs.rmSync(testDataDir, { recursive: true });
        console.log(`\n🧹 已清理临时数据`);
    } catch { }

    process.exit(0);
}

runTests().catch(err => {
    console.error('测试失败:', err);
    map.destroy();
    process.exit(1);
});
