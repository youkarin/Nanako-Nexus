// ============================================================
//  mapUtils.js — 地图工具库  (v2: 48×28 grid)
//  · 可行走图块白名单 (WALKABLE_TILES) — legacy, kept for MapEditor
//  · 格子可行走检查   (isWalkable)
//  · BFS 寻路         (bfs)
//  · 命名地点管理     (DEFAULT_POIS / loadPois / savePois / findLocation)
// ============================================================

export const POI_KEY = 'nanako_pois_v2'; // v2 = 48×28 map layout

// ── 默认地点数据 (坐标对应 48×28 地图) ──────────────────────────
export const DEFAULT_POIS = [
    {
        col: 7, row: 14,
        name: '菜菜子的家', label: '🏠 菜菜子的家', color: '#d97706',
        aliases: ['家', '回家', '我家'],
        actions: [
            { id: 'sleep', label: '睡觉', effect: '精力+50，体力完全恢复' },
            { id: 'tidy', label: '整理物品', effect: '整理背包，查看收纳' },
            { id: 'relax', label: '在家放松', effect: '压力-20，幸福感+5' },
        ],
    },
    {
        col: 24, row: 7,
        name: '浴室', label: '🚿 浴室&厨房', color: '#0284c7',
        aliases: ['厨房', '浴室', '洗澡'],
        actions: [
            { id: 'shower', label: '洗澡', effect: '清洁+50，心情+10' },
            { id: 'cook', label: '做饭', effect: '饥饿-30，花费食材' },
            { id: 'drink', label: '喝水', effect: '口渴-20' },
        ],
    },
    {
        col: 5, row: 20,
        name: '公园', label: '🌿 街心公园', color: '#16a34a',
        aliases: ['公园', '散步'],
        actions: [
            { id: 'walk', label: '散步', effect: '体力-5，心情+15，压力-10' },
            { id: 'sit', label: '坐歇休息', effect: '体力恢复+20' },
            { id: 'read', label: '看书', effect: '多巴胺+10，平静+2' },
        ],
    },
    {
        col: 15, row: 21,
        name: '商场', label: '🏬 商场', color: '#7c3aed',
        aliases: ['商场', '购物'],
        actions: [
            { id: 'shop', label: '购物', effect: '花费金钱，获得物品' },
            { id: 'browse', label: '随便逛逛', effect: '兴奋+5，多巴胺+5' },
            { id: 'eat_food', label: '买食物', effect: '饥饿-25，花费3金' },
        ],
    },
    {
        col: 24, row: 21,
        name: '市政厅', label: '🏛️ 市政厅', color: '#1d4ed8',
        aliases: ['市政厅'],
        actions: [
            { id: 'apply', label: '办理手续', effect: '完成任务' },
            { id: 'inquire', label: '咨询信息', effect: '获取情报' },
        ],
    },
    {
        col: 32, row: 21,
        name: '咖啡厅', label: '☕ 咖啡厅', color: '#c2410c',
        aliases: ['咖啡', '咖啡厅'],
        actions: [
            { id: 'buy_coffee', label: '买咖啡', effect: '精力+20，花费5金' },
            { id: 'sit_rest', label: '坐下休息', effect: '体力+15，压力-10' },
            { id: 'chat_npc', label: '和店员聊天', effect: '好感度+1' },
        ],
    },
    {
        col: 41, row: 21,
        name: '市集', label: '🍺 市集', color: '#854d0e',
        aliases: ['市集', '集市'],
        actions: [
            { id: 'buy_goods', label: '购买商品', effect: '花费金钱，获得稀有物品' },
            { id: 'sell', label: '卖东西', effect: '获得金钱' },
            { id: 'mingle', label: '与摊主聊天', effect: '兴奋+5' },
        ],
    },
];

// ── POI 持久化 ────────────────────────────────────────────────
export function loadPois() {
    try {
        const raw = localStorage.getItem(POI_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            if (Array.isArray(p) && p.length > 0) return p;
        }
    } catch { }
    return DEFAULT_POIS;
}

export function savePois(pois) {
    localStorage.setItem(POI_KEY, JSON.stringify(pois));
}

// ── 可行走图块集合 (legacy, for MapEditor tile system) ────────
export const WALKABLE_TILES = new Set([
    '8,28', '9,28', '8,29', '9,29',
    '0,28', '1,28', '2,28', '3,28', '4,28', '5,28', '10,28', '11,28',
    '6,29', '7,29', '6,28', '7,28',
    '0,29', '1,29', '2,29', '3,29', '4,29', '5,29', '10,29',
    '0,27', '1,27',
]);

export function isWalkable(mapData, col, row) {
    const rows = mapData.length, cols = mapData[0]?.length ?? 0;
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
    const tile = mapData[row]?.[col];
    if (!tile) return false;
    return WALKABLE_TILES.has(`${tile[0]},${tile[1]}`);
}

export function bfs(mapData, startCol, startRow, endCol, endRow) {
    if (startCol === endCol && startRow === endRow) return [[startCol, startRow]];
    if (!isWalkable(mapData, endCol, endRow)) return null;
    const rows = mapData.length, cols = mapData[0]?.length ?? 0;
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const prev = Array.from({ length: rows }, () => Array(cols).fill(null));
    const queue = [[startCol, startRow]]; visited[startRow][startCol] = true;
    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (queue.length > 0) {
        const [c, r] = queue.shift();
        if (c === endCol && r === endRow) {
            const path = []; let cur = [endCol, endRow];
            while (cur) { path.unshift(cur); const [cc, cr] = cur; cur = prev[cr][cc]; }
            return path;
        }
        for (const [dc, dr] of DIRS) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
            if (visited[nr][nc]) continue;
            if (!(nc === startCol && nr === startRow) && !isWalkable(mapData, nc, nr)) continue;
            visited[nr][nc] = true; prev[nr][nc] = [c, r]; queue.push([nc, nr]);
        }
    }
    return null;
}

export function findLocation(name, pois = null) {
    if (!name) return null;
    const list = pois || loadPois();
    const lc = name.toLowerCase();
    let poi = list.find(p => p.name === name || p.label === name);
    if (poi) return { col: poi.col, row: poi.row, label: poi.label };
    poi = list.find(p => p.aliases?.some(a => lc.includes(a.toLowerCase()) || a.toLowerCase().includes(lc)));
    if (poi) return { col: poi.col, row: poi.row, label: poi.label };
    return null;
}

export const POIS = DEFAULT_POIS;
