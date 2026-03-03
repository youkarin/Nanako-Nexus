import React, { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================
//  Kenney Roguelike/RPG Pack  (CC0 · kenney.nl · 1700 sprites)
//  968×526px spritesheet · 16×16 per tile · 1px margin · stride=17
//  Display: 3× = 48px per tile
//
//  TILE COORDINATES INSPECTOR-VERIFIED:
//    Grass:   T(8-9, 28-29)
//    Path:    T(6-7, 29)
//    Road:    T(6-7, 28)
//    Floors:  T(0-5, 29)
//    Trees:   T(23-28, 11)
//    Furniture: T(28-31, 0-4)
//    Walls:   T(36-39, 0-3)
// ============================================================
const SRC = 16, STR = 17, DSP = 48;
const T = (c, r) => [c, r];

// ── Ground / outdoor (inspector-verified) ────────────────
const GR_GRN = T(8, 28);  // ✅ green grass
const GR_GRN2 = T(9, 28);  // ✅ green v2
const GR_GRN3 = T(8, 29);  // ✅ green v3
const GR_GRN4 = T(9, 29);  // ✅ green v4
const GR_BRN = T(0, 28);  // brown ground
const GR_BRN2 = T(1, 28);  // brown v2
const GR_GRY = T(2, 28);  // gray stone
const GR_GRY2 = T(3, 28);  // gray v2
const GR_CRM = T(4, 28);  // cream ground
const GR_CRM2 = T(5, 28);  // cream v2
const GR_ORG = T(10, 28);  // orange ground
const GR_ORG2 = T(11, 28);  // orange v2

// ── Indoor floor tiles (warm, inviting) ──────────────────
const FL_BRN = T(0, 29);  // ✅ warm brown wood floor
const FL_BRN2 = T(1, 29);  // ✅ wood floor v2
const FL_GRY = T(2, 29);  // gray stone floor
const FL_GRY2 = T(3, 29);  // gray floor v2
const FL_CRM = T(4, 29);  // cream tile floor
const FL_CRM2 = T(5, 29);  // cream floor v2
const FL_ORG = T(10, 29);  // orange floor accent

// ── Path / road ──────────────────────────────────────────
const ROAD = T(6, 28);  // gray road tile
const ROAD2 = T(7, 28);  // road v2
const PATH = T(6, 29);  // stone path/sidewalk
const PATH2 = T(7, 29);  // path v2

// ── Walls (building exterior) ────────────────────────────
const WALL_GR = T(36, 0);  // grey stone wall
const WALL_GR2 = T(37, 0);  // grey v2
const WALL_GR3 = T(38, 0);  // grey corner/top
const WALL_WD = T(36, 1);  // wood-paneled wall
const WALL_WD2 = T(37, 1);  // wood wall v2
const WALL_DK = T(36, 2);  // dark interior wall
const WALL_DK2 = T(37, 2);  // dark wall v2
const WALL_WT = T(36, 3);  // light/white wall
const WALL_WT2 = T(37, 3);  // light wall v2
const WINDOW = T(39, 0);  // window with sill
const WINDOW2 = T(39, 1);  // window v2
const DOOR = T(38, 1);  // wooden door
const DOOR2 = T(38, 2);  // arched door

// ── Furniture (inspector: col 28-31, rows 0-4) ───────────
const BED_TL = T(28, 0);  // bed top-left
const BED_TR = T(29, 0);  // bed top-right
const BED_BL = T(28, 1);  // bed bottom-left
const BED_BR = T(29, 1);  // bed bottom-right
const SHELF = T(28, 2);  // bookshelf
const SHELF2 = T(29, 2);  // bookshelf v2
const CUPBRD = T(28, 3);  // cupboard
const CHEST = T(29, 3);  // chest/crate
const BARREL = T(30, 1);  // barrel
const TABLE = T(30, 0);  // table
const CHAIR = T(31, 0);  // chair
const LAMP = T(30, 2);  // lamp/torch
const STALL = T(31, 2);  // market stall awning
const STALL2 = T(31, 3);  // stall v2
const SIGN = T(30, 3);  // sign post
const WELL = T(31, 1);  // well
const FIRE = T(30, 4);  // campfire

// ── Trees  [inspector: col 24, row 11] ───────────────────
const TREE_GN = T(24, 11);  // ✅ round green tree
const TREE_GN2 = T(25, 11);  // ✅ green v2
const TREE_GN3 = T(23, 11);  // ✅ tree v3 (apple?)
const TREE_OR = T(26, 11);  // orange/autumn tree
const TREE_OR2 = T(27, 11);  // orange v2
const TREE_DK = T(28, 11);  // dark/pine tree
const BUSH = T(22, 11);  // bush cluster
const FLOWER = T(22, 12);  // flower cluster
const SHROOM = T(23, 12);  // mushroom

// ── Water (top-left, rows 0-4, pool tiles) ───────────────
const WATER = T(1, 1);  // water center blue
const WATER2 = T(2, 1);  // water v2
const WATER3 = T(1, 2);  // water v3
const WATER4 = T(2, 2);  // water v4

// ════════════════════════════════════════════════════════════
//  MAP  (32 cols × 20 rows)
// ════════════════════════════════════════════════════════════
const MAP = [
    // Row 0: grass top border + scattered trees
    [GR_GRN2, GR_GRN, GR_GRN3, TREE_GN2, GR_GRN4, GR_GRN, GR_GRN2, GR_GRN3, GR_GRN4, GR_GRN, GR_GRN2, GR_GRN3, TREE_GN, GR_GRN4, GR_GRN, GR_GRN2, GR_GRN3, GR_GRN4, TREE_GN2, GR_GRN, GR_GRN2, GR_GRN4, GR_GRN3, GR_GRN, TREE_GN3, GR_GRN2, GR_GRN3, GR_GRN4, TREE_GN, GR_GRN2, GR_GRN4, GR_GRN3],
    // Row 1: sidewalk/path top
    [GR_GRN3, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN],
    // Row 2: home 1 top wall  |  garden  |  home 2 top wall
    [GR_GRN, PATH, WALL_GR, WALL_GR2, WALL_GR3, WINDOW, WALL_GR2, WALL_GR3, WINDOW, WALL_GR, GR_GRN3, GR_GRN4, GR_GRN, GR_GRN2, GR_GRN4, GR_GRN3, GR_GRN, GR_GRN2, WALL_WD, WALL_WD2, WALL_WD, WINDOW2, WALL_WD2, WALL_WD, WINDOW2, WALL_WD2, WALL_WD, WALL_WD2, PATH, GR_GRN2, TREE_OR, GR_GRN3],
    // Row 3: rooms row 1 (beds, warm floor)
    [GR_GRN4, PATH, WALL_GR, BED_TL, BED_TR, FL_BRN, FL_BRN2, FL_BRN, FL_BRN2, WALL_GR, GR_GRN, FLOWER, FLOWER, FLOWER, FLOWER, FLOWER, FLOWER, GR_GRN3, WALL_WD, FL_CRM, FL_CRM2, FL_CRM, FL_CRM2, FL_CRM, FL_CRM2, FL_CRM, TABLE, WALL_WD, PATH, GR_GRN4, GR_GRN2, GR_GRN3],
    // Row 4: rooms row 2 (furniture)
    [GR_GRN2, PATH, WALL_GR, BED_BL, BED_BR, FL_BRN2, FL_BRN, BARREL, FL_BRN2, WALL_GR, TREE_GN3, GR_GRN, GR_GRN3, GR_GRN4, GR_GRN, GR_GRN3, TREE_GN2, GR_GRN, WALL_WD, FL_CRM2, CHAIR, FL_CRM, CHAIR, FL_CRM2, BARREL, FL_CRM, LAMP, WALL_WD, PATH, GR_GRN3, GR_GRN4, GR_GRN2],
    // Row 5: rooms row 3 (bookshelf, chest)
    [GR_GRN3, PATH, WALL_GR, SHELF, CUPBRD, FL_BRN, FL_BRN2, FL_BRN, CHEST, WALL_GR, SHROOM, GR_GRN4, SHROOM, GR_GRN2, SHROOM, GR_GRN4, SHROOM, GR_GRN2, WALL_WD, FL_CRM, FL_CRM2, FL_CRM, FL_CRM2, CHEST, FL_CRM, FL_CRM2, FL_CRM, WALL_WD, PATH, GR_GRN4, GR_GRN3, GR_GRN2],
    // Row 6: rooms row 4 (lamp, table, chair)
    [GR_GRN4, PATH, WALL_GR, LAMP, FL_BRN2, TABLE, CHAIR, FL_BRN, FL_BRN2, WALL_GR, FLOWER, GR_GRN3, FLOWER, GR_GRN, FLOWER, GR_GRN3, FLOWER, GR_GRN, WALL_WD, FL_CRM2, FL_CRM, FL_CRM2, TABLE, CHAIR, FL_CRM, FL_CRM2, BARREL, WALL_WD, PATH, GR_GRN2, TREE_OR2, GR_GRN3],
    // Row 7: home bottom walls + doors
    [GR_GRN2, PATH, WALL_GR, WALL_GR2, DOOR, WALL_GR3, WALL_GR2, WALL_GR3, WALL_GR2, WALL_GR, GR_GRN4, GR_GRN, GR_GRN3, GR_GRN4, GR_GRN, GR_GRN3, GR_GRN4, GR_GRN, WALL_WD, WALL_WD2, DOOR2, WALL_WD, WALL_WD2, WALL_WD, WALL_WD2, WALL_WD, WALL_WD2, WALL_WD, PATH, GR_GRN3, GR_GRN4, GR_GRN2],
    // Row 8: sidewalk + road junction
    [GR_GRN3, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN4],
    // Row 9: MAIN ROAD
    [GR_GRN, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, GR_GRN3],
    // Row 10: sidewalk below road
    [GR_GRN4, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN2],
    // Row 11: park (left) + city intro + zone separators
    [GR_GRN2, PATH, GR_GRN, GR_GRN3, TREE_GN2, GR_GRN4, TREE_GN, GR_GRN2, GR_GRN4, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN3],
    // Row 12: park + city buildings row 1
    [GR_GRN3, PATH, GR_GRN4, TREE_DK, GR_GRN2, SHROOM, GR_GRN3, TREE_OR, PATH2, PATH, WALL_GR, WALL_GR2, WALL_GR3, PATH2, WALL_DK, WALL_DK2, WINDOW, WALL_DK, PATH2, WALL_WD, WALL_WD2, WALL_WD, PATH2, GR_BRN, GR_BRN2, STALL, STALL2, GR_BRN, GR_GRN2, GR_GRN4, PATH, GR_GRN2],
    // Row 13: park + city buildings row 2
    [GR_GRN2, PATH, FLOWER, GR_GRN, WATER, WATER2, GR_GRN3, FLOWER, PATH2, PATH, WALL_GR, SIGN, WALL_GR2, PATH2, WALL_DK, WINDOW2, WALL_DK2, WALL_DK, PATH2, WALL_WD, DOOR2, WALL_WD2, PATH2, GR_BRN, STALL, SIGN, STALL2, GR_BRN2, GR_GRN4, GR_GRN3, PATH, GR_GRN4],
    // Row 14: park + city buildings row 3
    [GR_GRN4, PATH, GR_GRN3, FLOWER, WATER3, WATER4, FLOWER, GR_GRN4, PATH2, PATH, WALL_GR, WALL_GR2, WALL_GR3, PATH2, WALL_DK, WALL_DK2, WALL_DK, WALL_DK, PATH2, WALL_WD, WALL_WD2, WALL_WD, PATH2, WELL, GR_GRN, FIRE, GR_GRN2, GR_GRN3, GR_GRN4, GR_GRN2, PATH, GR_GRN3],
    // Row 15: lower area
    [GR_GRN2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, GR_GRN3, GR_GRN, GR_GRN4, GR_GRN2, GR_GRN3, GR_GRN, GR_GRN4, GR_GRN2, PATH2, PATH, PATH2, GR_GRN4],
    // Row 16: sidewalk
    [GR_GRN3, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN2],
    // Row 17: bottom road
    [GR_GRN2, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, ROAD2, ROAD, GR_GRN3],
    // Row 18: bottom sidewalk
    [GR_GRN4, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, PATH, PATH2, GR_GRN2],
    // Row 19: bottom grass with trees
    [GR_GRN3, GR_GRN2, TREE_OR2, GR_GRN4, GR_GRN3, GR_GRN, TREE_GN, GR_GRN4, BUSH, GR_GRN2, GR_GRN3, GR_GRN4, TREE_GN3, GR_GRN2, GR_GRN3, GR_GRN4, TREE_DK, GR_GRN2, GR_GRN4, TREE_GN2, GR_GRN3, GR_GRN2, GR_GRN4, TREE_OR, GR_GRN3, GR_GRN2, TREE_GN, GR_GRN4, GR_GRN2, TREE_GN3, GR_GRN3, GR_GRN2],
];

const MAP_ROWS = MAP.length;
const MAP_COLS = MAP[0].length;

// ── POI Labels ───────────────────────────────────────────
const POIS = [
    { col: 2, row: 2, label: '🏠 菜菜子的家', color: '#d97706' },
    { col: 18, row: 2, label: '🚿 浴室&厨房', color: '#0284c7' },
    { col: 2, row: 11, label: '🌿 街心公园', color: '#16a34a' },
    { col: 10, row: 12, label: '🏬 商场', color: '#7c3aed' },
    { col: 14, row: 12, label: '🏛️ 市政厅', color: '#1d4ed8' },
    { col: 19, row: 12, label: '☕ 咖啡厅', color: '#c2410c' },
    { col: 23, row: 12, label: '🍺 市集', color: '#854d0e' },
];

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
const STORAGE_KEY = 'nanako_mapdata_v1';

function loadMapFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch { }
    return MAP; // fallback to default hardcoded map
}

export default function GridWorldSimulator() {
    const canvasRef = useRef(null);
    const sheetRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [hovered, setHovered] = useState(null);
    const [zoom, setZoom] = useState(0.85);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [activeMap, setActiveMap] = useState(loadMapFromStorage);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const animRef = useRef(null);

    // Sync map when user saves from the editor (storage event = cross-tab)
    useEffect(() => {
        const onStorage = e => {
            if (e.key === STORAGE_KEY || !e.key) setActiveMap(loadMapFromStorage());
        };
        // Also refresh anytime this component becomes visible
        setActiveMap(loadMapFromStorage());
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        const img = new Image();
        img.src = '/tiles/roguelike.png';
        img.onload = () => { sheetRef.current = img; setLoaded(true); };
        img.onerror = e => console.error('Sheet load failed', e);
    }, []);

    const draw = useCallback(() => {
        const cv = canvasRef.current;
        const sh = sheetRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0, 0, cv.width, cv.height);

        if (!sh) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⏳ 加载中...', cv.width / 2, cv.height / 2);
            return;
        }
        ctx.imageSmoothingEnabled = false;
        const ts = DSP * zoom;

        activeMap.forEach((row, ri) => {
            row.forEach((tile, ci) => {
                if (!tile) return;
                const dx = Math.round(offset.x + ci * ts);
                const dy = Math.round(offset.y + ri * ts);
                if (dx + ts < 0 || dy + ts < 0 || dx > cv.width || dy > cv.height) return;
                ctx.drawImage(sh, tile[0] * STR, tile[1] * STR, SRC, SRC, dx, dy, ts, ts);
            });
        });

        if (hovered) {
            const dx = Math.round(offset.x + hovered.col * ts);
            const dy = Math.round(offset.y + hovered.row * ts);
            ctx.strokeStyle = 'rgba(255,220,80,0.95)'; ctx.lineWidth = 2;
            ctx.strokeRect(dx + 1, dy + 1, ts - 2, ts - 2);
            ctx.fillStyle = 'rgba(255,220,80,0.1)';
            ctx.fillRect(dx + 1, dy + 1, ts - 2, ts - 2);
        }

        ctx.textBaseline = 'top';
        POIS.forEach(p => {
            const dx = Math.round(offset.x + p.col * ts);
            const dy = Math.round(offset.y + p.row * ts);
            if (dx > cv.width + 200 || dy > cv.height + 40 || dx + 300 < 0 || dy + 40 < 0) return;
            const fs = Math.max(9, Math.min(13, zoom * 13));
            ctx.font = `bold ${fs}px sans-serif`;
            const tw = ctx.measureText(p.label).width + 10;
            const bh = fs + 10;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(dx + 2, dy + 2, tw, bh, 5); ctx.fill();
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.roundRect(dx, dy, tw, bh, 5); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.fillText(p.label, dx + 5, dy + 5);
        });
    }, [loaded, zoom, offset, hovered, activeMap]);

    useEffect(() => {
        const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    const getRC = e => {
        const cv = canvasRef.current;
        if (!cv) return null;
        const r = cv.getBoundingClientRect(), ts = DSP * zoom;
        return { col: Math.floor((e.clientX - r.left - offset.x) / ts), row: Math.floor((e.clientY - r.top - offset.y) / ts) };
    };
    const onMouseMove = e => {
        const rc = getRC(e);
        if (rc && rc.col >= 0 && rc.col < MAP_COLS && rc.row >= 0 && rc.row < MAP_ROWS && MAP[rc.row]?.[rc.col]) setHovered(rc);
        else setHovered(null);
        if (isDragging.current) {
            setOffset(o => ({ x: o.x + e.clientX - lastMouse.current.x, y: o.y + e.clientY - lastMouse.current.y }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const onMouseDown = e => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseLeave = () => { isDragging.current = false; setHovered(null); };
    const onWheel = e => { e.preventDefault(); setZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1))).toFixed(2))); };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">
                        🗺️ NANAKO WORLD MAP
                    </h1>
                    <p className="text-slate-500 text-xs mt-0.5">{MAP_COLS}×{MAP_ROWS} · Kenney Roguelike/RPG Pack CC0 · 1700+ sprites</p>
                </div>
                <div className="flex items-center gap-2">
                    {[['＋', 0.2], ['－', -0.2]].map(([l, d]) => (
                        <button key={l} onClick={() => setZoom(z => +(Math.max(0.3, Math.min(4, z + d)).toFixed(2)))}
                            className="w-9 h-9 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl font-bold text-lg hover:bg-slate-700 transition-colors">{l}</button>
                    ))}
                    <span className="text-slate-400 font-mono text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => { setZoom(0.85); setOffset({ x: 0, y: 0 }); }}
                        className="px-3 h-9 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">重置</button>
                </div>
            </div>
            <div className="w-full max-w-6xl mb-3 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${loaded ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${loaded ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </span>
                <span className={`font-mono text-sm ${loaded ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {!loaded ? '📦 Loading Kenney RPG Pack (1700 sprites)...' : hovered ? `[${hovered.col},${hovered.row}] · 拖拽移动 · 滚轮缩放` : '悬停查看坐标 · 拖拽移动 · 滚轮缩放'}
                </span>
            </div>
            <div className="w-full max-w-6xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/50" style={{ height: 620 }}>
                <canvas ref={canvasRef} className="w-full h-full block"
                    style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
                    onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} />
            </div>
            <p className="text-slate-700 text-[10px] mt-3">Tiles: Kenney Roguelike/RPG Pack · CC0 · kenney.nl</p>
        </div>
    );
}
