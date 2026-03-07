// ============================================================
//  nanako-map-engine.js — 云端地图引擎 (Node.js ESM)
//  
//  功能：
//    · 角色坐标管理（内存 + 定时 JSON 持久化）
//    · BFS 寻路
//    · 可行走网格 (WALK_GRID)
//    · POI 地点管理
//    · 步进行走模拟（定时器驱动）
//    · 事件推送接口
//
//  使用方式：
//    import MapEngine from './nanako-map-engine.js';
//    const map = new MapEngine({ dataDir: './map-data' });
//    map.on('arrived', data => console.log('到达', data));
//    map.moveTo({ location: '公园' });
//    map.getPosition();
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
//  常量
// ═══════════════════════════════════════════════════════════════
export const COLS = 48;
export const ROWS = 28;
const STEP_MS = 150;  // 每步行走间隔（毫秒）

// 默认持久化文件路径
const DEFAULT_DATA_DIR = path.join(__dirname, 'map-data');

// ═══════════════════════════════════════════════════════════════
//  默认 POI 数据（与前端 mapUtils.js 完全一致）
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  可行走网格构建（与前端 GridWorldRenderer.js 完全一致）
// ═══════════════════════════════════════════════════════════════
function buildWalkGrid() {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const wall = (x, y, w, h, doors = []) => {
        for (let r = y; r < y + h; r++)
            for (let c = x; c < x + w; c++) {
                const edge = r === y || r === y + h - 1 || c === x || c === x + w - 1;
                if (edge && !doors.some(([dc, dr]) => dc === c && dr === r)) g[r][c] = false;
            }
    };
    wall(2, 3, 14, 11, [[7, 13]]);    // Home
    wall(17, 3, 18, 11, [[24, 13]]);   // Bath/Kitchen
    wall(13, 17, 7, 8, [[15, 17]]);    // Mall
    wall(21, 17, 8, 8, [[24, 17]]);    // City Hall
    wall(30, 17, 7, 8, [[32, 17]]);    // Coffee
    wall(38, 17, 9, 8, [[40, 17]]);    // Market
    return g;
}

export const WALK_GRID = buildWalkGrid();

// ═══════════════════════════════════════════════════════════════
//  BFS 寻路（与前端 findPath 完全一致）
// ═══════════════════════════════════════════════════════════════
export function findPath(sc, sr, ec, er) {
    if (sc === ec && sr === er) return [[sc, sr]];
    if (!WALK_GRID[er]?.[ec]) return null;
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const D = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const q = [[sc, sr]];
    visited[sr][sc] = true;
    while (q.length) {
        const [c, r] = q.shift();
        if (c === ec && r === er) {
            const p = [];
            let u = [ec, er];
            while (u) { p.unshift(u); u = prev[u[1]][u[0]]; }
            return p;
        }
        for (const [dc, dr] of D) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || visited[nr][nc] || !WALK_GRID[nr][nc]) continue;
            visited[nr][nc] = true;
            prev[nr][nc] = [c, r];
            q.push([nc, nr]);
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
//  地点查找（模糊匹配，与前端 findLocation 一致）
// ═══════════════════════════════════════════════════════════════
export function findLocation(name, pois) {
    if (!name) return null;
    const list = pois || DEFAULT_POIS;
    const lc = name.toLowerCase();
    let poi = list.find(p => p.name === name || p.label === name);
    if (poi) return { col: poi.col, row: poi.row, label: poi.label, name: poi.name };
    poi = list.find(p => p.aliases?.some(a =>
        lc.includes(a.toLowerCase()) || a.toLowerCase().includes(lc)
    ));
    if (poi) return { col: poi.col, row: poi.row, label: poi.label, name: poi.name };
    return null;
}

// ═══════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════
function calcDirection(oc, or, nc, nr) {
    const dc = nc - oc, dr = nr - or;
    if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 'right' : 'left';
    if (dr !== 0) return dr > 0 ? 'down' : 'up';
    return 'down';
}

function nearestPoi(col, row, pois) {
    let nearest = null, minDist = Infinity;
    (pois || DEFAULT_POIS).forEach(p => {
        const d = Math.abs(p.col - col) + Math.abs(p.row - row);
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return { nearest, distance: minDist };
}

// ═══════════════════════════════════════════════════════════════
//  内置家具数据（与前端 FURN + TREES 一致）
// ═══════════════════════════════════════════════════════════════
function getBuiltInFurniture() {
    const FURN = [
        // HOME BEDROOM
        { t: 'bed2', c: 3, r: 4 }, { t: 'bed2', c: 4, r: 4 },
        { t: 'lamp', c: 2, r: 4 }, { t: 'lamp', c: 5, r: 4 },
        { t: 'wardrobe', c: 8, r: 4 }, { t: 'wardrobe', c: 9, r: 4 },
        { t: 'shelf', c: 3, r: 8 }, { t: 'shelf', c: 4, r: 8 },
        { t: 'desk', c: 7, r: 6 }, { t: 'chair', c: 7, r: 7 },
        { t: 'plant', c: 9, r: 8 },
        { t: 'rug2', c: 5, r: 6 }, { t: 'rug2', c: 6, r: 6 },
        { t: 'rug2', c: 5, r: 7 }, { t: 'rug2', c: 6, r: 7 },
        { t: 'mat', c: 7, r: 12 },
        // HOME LIVING ROOM
        { t: 'sofa', c: 10, r: 5 }, { t: 'sofa', c: 11, r: 5 },
        { t: 'sofa', c: 12, r: 5 }, { t: 'sofa_corner', c: 13, r: 5 },
        { t: 'sofa', c: 13, r: 6 },
        { t: 'table_round', c: 11, r: 7 }, { t: 'table_round', c: 12, r: 7 },
        { t: 'tv', c: 10, r: 4 }, { t: 'tv', c: 11, r: 4 },
        { t: 'shelf', c: 13, r: 8 }, { t: 'shelf', c: 13, r: 9 },
        { t: 'plant2', c: 13, r: 11 }, { t: 'plant', c: 10, r: 11 },
        { t: 'rug', c: 11, r: 6 }, { t: 'rug', c: 12, r: 6 },
        { t: 'lamp', c: 10, r: 10 },
        // HOME KITCHEN
        { t: 'counter', c: 3, r: 12 }, { t: 'counter', c: 4, r: 12 },
        { t: 'counter', c: 5, r: 12 }, { t: 'stove', c: 6, r: 12 },
        { t: 'counter_sink', c: 7, r: 12 },
        { t: 'table', c: 3, r: 10 }, { t: 'table', c: 4, r: 10 },
        { t: 'chair', c: 3, r: 9 }, { t: 'chair', c: 4, r: 9 },
        { t: 'chair', c: 5, r: 9 }, { t: 'chair', c: 3, r: 11 },
        { t: 'chair', c: 5, r: 11 }, { t: 'plant2', c: 8, r: 10 },
        // BATH
        { t: 'bath', c: 18, r: 5 }, { t: 'bath', c: 19, r: 5 },
        { t: 'sink', c: 21, r: 4 }, { t: 'sink', c: 23, r: 4 },
        { t: 'counter_sink', c: 25, r: 4 },
        { t: 'mat', c: 18, r: 7 }, { t: 'mat', c: 19, r: 7 },
        { t: 'plant', c: 25, r: 8 }, { t: 'plant2', c: 25, r: 7 },
        // KITCHEN
        { t: 'counter', c: 27, r: 4 }, { t: 'stove', c: 28, r: 4 },
        { t: 'counter', c: 29, r: 4 }, { t: 'counter', c: 30, r: 4 },
        { t: 'counter', c: 31, r: 4 }, { t: 'counter', c: 32, r: 4 },
        { t: 'counter_sink', c: 33, r: 4 },
        { t: 'table', c: 28, r: 7 }, { t: 'table', c: 29, r: 7 },
        { t: 'table', c: 30, r: 7 },
        { t: 'chair', c: 28, r: 6 }, { t: 'chair', c: 29, r: 6 },
        { t: 'chair', c: 30, r: 6 }, { t: 'chair', c: 31, r: 6 },
        { t: 'chair', c: 28, r: 8 }, { t: 'chair', c: 30, r: 8 },
        { t: 'shelf', c: 33, r: 7 }, { t: 'shelf', c: 33, r: 8 },
        { t: 'barrel', c: 33, r: 11 }, { t: 'barrel', c: 32, r: 11 },
        { t: 'rug', c: 29, r: 9 }, { t: 'rug', c: 30, r: 9 },
        { t: 'plant', c: 33, r: 11 }, { t: 'plant2', c: 27, r: 11 },
        { t: 'mat', c: 24, r: 12 },
        // PARK
        { t: 'tree', c: 1, r: 17 }, { t: 'tree', c: 4, r: 17 },
        { t: 'tree', c: 7, r: 17 }, { t: 'tree', c: 10, r: 17 },
        { t: 'tree', c: 1, r: 23 }, { t: 'tree', c: 4, r: 24 },
        { t: 'tree', c: 8, r: 24 }, { t: 'tree', c: 11, r: 23 },
        { t: 'tree', c: 0, r: 20 }, { t: 'tree', c: 12, r: 21 },
        { t: 'fountain', c: 5, r: 20 }, { t: 'fountain', c: 6, r: 20 },
        { t: 'bench', c: 3, r: 19 }, { t: 'bench', c: 8, r: 19 },
        { t: 'bench', c: 3, r: 22 }, { t: 'bench', c: 8, r: 22 },
        { t: 'flower', c: 1, r: 19 }, { t: 'flower', c: 10, r: 19 },
        { t: 'flower', c: 2, r: 22 }, { t: 'flower', c: 9, r: 22 },
        { t: 'flower', c: 4, r: 23 }, { t: 'flower', c: 7, r: 23 },
        { t: 'flower', c: 1, r: 21 }, { t: 'flower', c: 11, r: 21 },
        // MALL
        { t: 'shelf', c: 14, r: 18 }, { t: 'shelf', c: 15, r: 18 },
        { t: 'shelf', c: 16, r: 18 }, { t: 'shelf', c: 14, r: 20 },
        { t: 'shelf', c: 15, r: 20 },
        { t: 'vending', c: 17, r: 18 }, { t: 'vending', c: 18, r: 18 },
        { t: 'barrel', c: 17, r: 20 }, { t: 'barrel', c: 18, r: 20 },
        { t: 'counter', c: 14, r: 22 }, { t: 'counter', c: 15, r: 22 },
        { t: 'counter', c: 16, r: 22 },
        { t: 'plant', c: 18, r: 22 }, { t: 'sign', c: 14, r: 17 },
        // CITY HALL
        { t: 'desk', c: 22, r: 18 }, { t: 'desk', c: 24, r: 18 },
        { t: 'desk', c: 26, r: 18 },
        { t: 'chair', c: 22, r: 19 }, { t: 'chair', c: 24, r: 19 },
        { t: 'chair', c: 26, r: 19 },
        { t: 'bench', c: 22, r: 21 }, { t: 'bench', c: 22, r: 22 },
        { t: 'bench', c: 25, r: 21 }, { t: 'bench', c: 25, r: 22 },
        { t: 'plant', c: 27, r: 18 }, { t: 'plant2', c: 22, r: 23 },
        { t: 'table', c: 24, r: 22 }, { t: 'chair', c: 23, r: 22 },
        { t: 'chair', c: 25, r: 22 }, { t: 'sign', c: 24, r: 17 },
        // COFFEE SHOP
        { t: 'counter', c: 31, r: 23 }, { t: 'counter', c: 32, r: 23 },
        { t: 'counter', c: 33, r: 23 }, { t: 'counter', c: 34, r: 23 },
        { t: 'table_round', c: 31, r: 19 }, { t: 'chair', c: 30, r: 19 },
        { t: 'chair', c: 32, r: 19 }, { t: 'chair', c: 31, r: 20 },
        { t: 'table_round', c: 33, r: 19 }, { t: 'chair', c: 34, r: 19 },
        { t: 'chair', c: 33, r: 20 },
        { t: 'table_round', c: 32, r: 21 }, { t: 'chair', c: 31, r: 21 },
        { t: 'chair', c: 33, r: 21 }, { t: 'chair', c: 32, r: 22 },
        { t: 'plant2', c: 35, r: 18 }, { t: 'plant', c: 35, r: 22 },
        { t: 'rug', c: 32, r: 20 }, { t: 'rug', c: 33, r: 20 },
        { t: 'sign', c: 32, r: 17 },
        // MARKET
        { t: 'barrel', c: 39, r: 18 }, { t: 'barrel', c: 41, r: 18 },
        { t: 'barrel', c: 43, r: 18 }, { t: 'barrel', c: 45, r: 18 },
        { t: 'barrel', c: 40, r: 21 }, { t: 'barrel', c: 42, r: 21 },
        { t: 'barrel', c: 44, r: 21 },
        { t: 'shelf', c: 39, r: 20 }, { t: 'shelf', c: 41, r: 20 },
        { t: 'shelf', c: 43, r: 20 },
        { t: 'counter', c: 39, r: 22 }, { t: 'counter', c: 40, r: 22 },
        { t: 'counter', c: 41, r: 22 }, { t: 'counter', c: 43, r: 22 },
        { t: 'counter', c: 44, r: 22 }, { t: 'counter', c: 45, r: 22 },
        { t: 'flower', c: 45, r: 20 }, { t: 'flower', c: 39, r: 23 },
        { t: 'flower', c: 45, r: 23 },
        { t: 'plant', c: 45, r: 19 }, { t: 'sign', c: 40, r: 17 },
    ];

    const TREES = [
        [0, 0], [3, 0], [7, 0], [12, 0], [17, 0], [22, 0], [27, 0],
        [32, 0], [37, 0], [42, 0], [47, 0],
        [0, 27], [4, 27], [9, 27], [14, 27], [19, 27], [24, 27],
        [29, 27], [34, 27], [39, 27], [44, 27], [47, 27],
        [0, 3], [0, 7], [0, 11], [47, 4], [47, 8], [47, 12],
        [35, 4], [36, 8], [35, 11], [36, 4], [35, 8],
    ];

    const items = FURN.map(f => ({ t: f.t, c: f.c, r: f.r }));
    TREES.forEach(([c, r]) => items.push({ t: 'tree', c, r }));
    return items;
}

// ═══════════════════════════════════════════════════════════════
//  MapEngine 主类
// ═══════════════════════════════════════════════════════════════
export default class MapEngine extends EventEmitter {
    /**
     * @param {Object} options
     * @param {string} [options.dataDir]       - 数据持久化目录，默认 ./map-data
     * @param {number} [options.stepMs]         - 每步间隔毫秒，默认 150
     * @param {number} [options.saveIntervalMs] - 持久化间隔毫秒，默认 5000
     */
    constructor(options = {}) {
        super();
        this.dataDir = options.dataDir || DEFAULT_DATA_DIR;
        this.stepMs = options.stepMs || STEP_MS;
        this.saveIntervalMs = options.saveIntervalMs || 5000;

        // — 确保数据目录存在 —
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // — 加载持久化数据 —
        this.charPos = this._loadJson('char_pos.json', { col: 7, row: 14 });
        this.charDir = 'down';
        this.charStatus = 'idle';       // 'idle' | 'moving' | 'blocked'
        this.charPath = [];             // 当前行走路径 [[col,row], ...]
        this.charLabel = null;          // 当前目标标签

        this.pois = this._loadJson('pois.json', DEFAULT_POIS);
        this.customFurn = this._loadJson('custom_furn.json', null);
        this.customFloors = this._loadJson('custom_floors.json', []);

        // 如果 customFurn 从未初始化，用内置家具数据
        if (this.customFurn === null) {
            this.customFurn = getBuiltInFurniture();
            this._saveJson('custom_furn.json', this.customFurn);
        }

        this._stepTimer = null;
        this._dirty = false;

        // — 定时持久化 —
        this._saveTimer = setInterval(() => {
            if (this._dirty) {
                this._persistAll();
                this._dirty = false;
            }
        }, this.saveIntervalMs);

        console.log(`[MapEngine] 初始化完成 — 角色坐标 [${this.charPos.col}, ${this.charPos.row}]`);
    }

    // ──────────────────────────────────────────────────────────
    //  公开 API
    // ──────────────────────────────────────────────────────────

    /**
     * 获取当前位置（立即返回，无需 WebSocket 往返）
     */
    getPosition() {
        const { nearest, distance } = nearestPoi(this.charPos.col, this.charPos.row, this.pois);
        return {
            col: this.charPos.col,
            row: this.charPos.row,
            dir: this.charDir,
            status: this.charStatus,
            location: nearest?.name || null,
            location_label: nearest?.label || null,
            distance_to_location: distance,
        };
    }

    /**
     * 移动到指定位置
     * @param {{ location?: string, target?: [number, number] }} options
     */
    moveTo({ location, target }) {
        let ec, er, label;

        if (location) {
            const poi = findLocation(location, this.pois);
            if (!poi) {
                this.emit('blocked', {
                    reason: 'unknown_location',
                    location,
                    message: `未知地点: ${location}`,
                });
                return { success: false, message: `未知地点: ${location}` };
            }
            ec = poi.col;
            er = poi.row;
            label = poi.label;
        } else if (Array.isArray(target) && target.length >= 2) {
            [ec, er] = target;
            label = `(${ec},${er})`;
            if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) {
                this.emit('blocked', { reason: 'out_of_bounds', target });
                return { success: false, message: '坐标超出地图范围' };
            }
        } else {
            return { success: false, message: '缺少 location 或 target 参数' };
        }

        const { col: sc, row: sr } = this.charPos;
        const pathResult = findPath(sc, sr, ec, er);

        if (!pathResult) {
            this.charStatus = 'blocked';
            this.emit('blocked', { reason: 'no_path', target: [ec, er] });
            this.emit('update', this._buildStateSnapshot());
            setTimeout(() => {
                if (this.charStatus === 'blocked') {
                    this.charStatus = 'idle';
                    this.emit('update', this._buildStateSnapshot());
                }
            }, 1500);
            return { success: false, message: '无法找到可行路径' };
        }

        const steps = pathResult.slice(1);
        if (!steps.length) {
            return { success: true, message: '已经在目标位置', path_length: 0 };
        }

        this.charPath = steps;
        this.charLabel = label;
        this.charStatus = 'moving';

        this.emit('moving', {
            target: [ec, er],
            label,
            path_length: steps.length,
        });
        this.emit('update', this._buildStateSnapshot());

        this._startStepping();

        return { success: true, message: `开始前往 ${label}`, path_length: steps.length };
    }

    /** 立即停止行走 */
    stop() {
        this._stopStepping();
        this.charStatus = 'idle';
        this.charPath = [];
        this.charLabel = null;
        this.emit('update', this._buildStateSnapshot());
    }

    /** 传送到指定位置（不走路径，立即到达） */
    teleport(col, row) {
        this._stopStepping();
        this.charPos = { col, row };
        this.charStatus = 'idle';
        this.charPath = [];
        this.charLabel = null;
        this._dirty = true;
        this.emit('update', this._buildStateSnapshot());
    }

    /** 获取完整地图状态快照（给前端同步用） */
    getMapSnapshot() {
        return {
            charPos: { ...this.charPos },
            charDir: this.charDir,
            charStatus: this.charStatus,
            charLabel: this.charLabel,
            pois: this.pois,
            customFurn: this.customFurn,
            customFloors: this.customFloors,
            mapSize: { cols: COLS, rows: ROWS },
        };
    }

    getPois() { return this.pois; }

    setPois(pois) {
        this.pois = pois;
        this._dirty = true;
        this.emit('pois_updated', this.pois);
    }

    setCustomFurn(furn) {
        this.customFurn = furn;
        this._dirty = true;
        this.emit('furn_updated', this.customFurn);
    }

    setCustomFloors(floors) {
        this.customFloors = floors;
        this._dirty = true;
        this.emit('floors_updated', this.customFloors);
    }

    isWalkable(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
        return WALK_GRID[row][col];
    }

    findLocation(name) {
        return findLocation(name, this.pois);
    }

    calculatePath(sc, sr, ec, er) {
        return findPath(sc, sr, ec, er);
    }

    /** 销毁引擎，清理定时器 */
    destroy() {
        this._stopStepping();
        clearInterval(this._saveTimer);
        this._persistAll();
        console.log('[MapEngine] 已销毁');
    }

    // ──────────────────────────────────────────────────────────
    //  私有方法
    // ──────────────────────────────────────────────────────────

    _startStepping() {
        this._stopStepping();
        this._stepTimer = setInterval(() => {
            if (!this.charPath.length) {
                this._stopStepping();
                this.charStatus = 'idle';
                this.charLabel = null;
                this.emit('update', this._buildStateSnapshot());
                return;
            }

            const [nc, nr] = this.charPath.shift();
            const { col: oc, row: or } = this.charPos;

            this.charDir = calcDirection(oc, or, nc, nr);
            this.charPos = { col: nc, row: nr };
            this._dirty = true;

            this.emit('step', {
                col: nc, row: nr,
                dir: this.charDir,
                status: 'moving',
                remaining: this.charPath.length,
            });

            if (!this.charPath.length) {
                this._stopStepping();
                this.charStatus = 'idle';
                const arrivedLabel = this.charLabel;
                this.charLabel = null;
                this._dirty = true;

                this.emit('arrived', { col: nc, row: nr, label: arrivedLabel });
                this.emit('update', this._buildStateSnapshot());
            }
        }, this.stepMs);
    }

    _stopStepping() {
        if (this._stepTimer) {
            clearInterval(this._stepTimer);
            this._stepTimer = null;
        }
    }

    _buildStateSnapshot() {
        return {
            col: this.charPos.col,
            row: this.charPos.row,
            dir: this.charDir,
            status: this.charStatus,
            label: this.charLabel,
            remaining: this.charPath.length,
        };
    }

    // ── 持久化 ─────────────────────────────────────────────

    _loadJson(filename, defaultValue) {
        const filepath = path.join(this.dataDir, filename);
        try {
            if (fs.existsSync(filepath)) {
                const raw = fs.readFileSync(filepath, 'utf8');
                return JSON.parse(raw);
            }
        } catch (err) {
            console.error(`[MapEngine] 加载 ${filename} 失败:`, err.message);
        }
        return defaultValue;
    }

    _saveJson(filename, data) {
        const filepath = path.join(this.dataDir, filename);
        try {
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error(`[MapEngine] 保存 ${filename} 失败:`, err.message);
        }
    }

    _persistAll() {
        this._saveJson('char_pos.json', this.charPos);
        this._saveJson('pois.json', this.pois);
        this._saveJson('custom_furn.json', this.customFurn);
        this._saveJson('custom_floors.json', this.customFloors);
    }
}
