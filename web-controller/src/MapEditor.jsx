import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, savePois, POI_KEY } from './mapUtils';

// ============================================================
//  MAP EDITOR  –  visual tilemap painter (no-code)
//  Spritesheet: Kenney Roguelike/RPG Pack CC0
//  Edit the tilemap by clicking tiles on the palette, then
//  clicking/dragging on the map canvas to paint.
//  NEW: 📍 Mark tool to place/edit named POI locations.
// ============================================================
const SHEET_W = 968, SHEET_H = 526;
const SRC = 16, STR = 17;
const PALETTE_SCALE = 2;
const PAINT_TILE = 40;
const STORAGE_KEY = 'nanako_mapdata_v1';

const DEFAULT_COLS = 32;
const DEFAULT_ROWS = 20;

const T = (c, r) => [c, r];
const GRASS = T(8, 28); const GRASS2 = T(9, 28);
const GRASS3 = T(8, 29); const GRASS4 = T(9, 29);
const PATH = T(6, 29); const PATH2 = T(7, 29);
const ROAD = T(6, 28); const ROAD2 = T(7, 28);
const W_GR = T(36, 0); const W_GR2 = T(37, 0);
const WIND = T(39, 0); const DOOR = T(38, 1);
const FL_BRN = T(0, 29); const FL_CRM = T(4, 29);
const TREE = T(24, 11); const TREE2 = T(25, 11);

function makeDefaultMap() {
    const m = [];
    for (let r = 0; r < DEFAULT_ROWS; r++) {
        const row = [];
        for (let c = 0; c < DEFAULT_COLS; c++) {
            if (r === 0 || r === DEFAULT_ROWS - 1) {
                row.push((c + r) % 3 === 0 ? TREE : ((c + r) % 2 === 0 ? GRASS2 : GRASS3));
            } else if (r === 1 || r === DEFAULT_ROWS - 2) {
                row.push((c + r) % 2 === 0 ? PATH : PATH2);
            } else if (r === 9 || r === 10) {
                row.push(c % 2 === 0 ? ROAD : ROAD2);
            } else {
                row.push(c % 2 === 0 ? GRASS : GRASS2);
            }
        }
        m.push(row);
    }
    return m;
}

function loadMap() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
    } catch { }
    return makeDefaultMap();
}

function saveMap(mapData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(mapData)); }

// ── POI preset colors ─────────────────────────────────────────
const POI_COLORS = ['#d97706', '#0284c7', '#16a34a', '#7c3aed', '#1d4ed8', '#c2410c', '#854d0e', '#dc2626', '#0f766e', '#be185d'];

const EMPTY_FORM = { name: '', label: '📍 ', color: '#d97706', aliases: '', actions: [] };

// ============================================================
//  COMPONENT
// ============================================================
export default function MapEditor() {
    const paletteRef = useRef(null);
    const mapCanvasRef = useRef(null);
    const sheetRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [selectedTile, setSelected] = useState(GRASS);
    const [map, setMap] = useState(loadMap);
    const [tool, setTool] = useState('paint'); // 'paint' | 'erase' | 'fill' | 'mark'
    const [history, setHistory] = useState([]);
    const [mapZoom, setMapZoom] = useState(1);
    const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
    const [hoverCell, setHoverCell] = useState(null);
    const [saved, setSaved] = useState(false);
    const [showCoords, setShowCoords] = useState(false);

    // POI state
    const [pois, setPois] = useState(loadPois);
    const [poiModal, setPoiModal] = useState(null); // { col, row, existingIndex: number|null }
    const [poiForm, setPoiForm] = useState(EMPTY_FORM);

    const isPainting = useRef(false);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const animPal = useRef(null);
    const animMap = useRef(null);

    // Load spritesheet
    useEffect(() => {
        const img = new Image();
        img.src = '/tiles/roguelike.png';
        img.onload = () => { sheetRef.current = img; setLoaded(true); };
    }, []);

    // ── Draw Palette ──────────────────────────────────────────
    const drawPalette = useCallback(() => {
        const cv = paletteRef.current; const sh = sheetRef.current;
        if (!cv || !sh) return;
        const ctx = cv.getContext('2d');
        const ps = PALETTE_SCALE;
        cv.width = Math.floor(SHEET_W * ps / STR) * (STR * ps);
        cv.height = Math.floor(SHEET_H * ps / STR) * (STR * ps);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sh, 0, 0, cv.width / ps, cv.height / ps, 0, 0, cv.width, cv.height);
        if (selectedTile) {
            const [tc, tr] = selectedTile;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
            ctx.strokeRect(tc * STR * ps + 1, tr * STR * ps + 1, SRC * ps - 2, SRC * ps - 2);
            ctx.fillStyle = 'rgba(251,191,36,0.2)';
            ctx.fillRect(tc * STR * ps + 1, tr * STR * ps + 1, SRC * ps - 2, SRC * ps - 2);
        }
    }, [loaded, selectedTile]);

    useEffect(() => {
        const loop = () => { drawPalette(); animPal.current = requestAnimationFrame(loop); };
        animPal.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animPal.current);
    }, [drawPalette]);

    // ── Draw Map Canvas ───────────────────────────────────────
    const drawMapCanvas = useCallback(() => {
        const cv = mapCanvasRef.current; const sh = sheetRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, 0, cv.width, cv.height);
        if (!sh) return;
        ctx.imageSmoothingEnabled = false;
        const ts = PAINT_TILE * mapZoom;

        map.forEach((row, ri) => {
            row.forEach((tile, ci) => {
                const dx = Math.round(mapOffset.x + ci * ts);
                const dy = Math.round(mapOffset.y + ri * ts);
                if (dx + ts < 0 || dy + ts < 0 || dx > cv.width || dy > cv.height) return;
                if (tile) ctx.drawImage(sh, tile[0] * STR, tile[1] * STR, SRC, SRC, dx, dy, ts, ts);
                ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
                ctx.strokeRect(dx, dy, ts, ts);
            });
        });

        // Hover highlight
        if (hoverCell) {
            const { col, row } = hoverCell;
            const dx = Math.round(mapOffset.x + col * ts);
            const dy = Math.round(mapOffset.y + row * ts);
            if (tool === 'erase') {
                ctx.strokeStyle = 'rgba(239,68,68,0.9)'; ctx.fillStyle = 'rgba(239,68,68,0.2)';
            } else if (tool === 'fill') {
                ctx.strokeStyle = 'rgba(168,85,247,0.9)'; ctx.fillStyle = 'rgba(168,85,247,0.15)';
            } else if (tool === 'mark') {
                const existing = pois.find(p => p.col === col && p.row === row);
                ctx.strokeStyle = existing ? 'rgba(20,184,166,0.9)' : 'rgba(20,184,166,0.7)';
                ctx.fillStyle = existing ? 'rgba(20,184,166,0.2)' : 'rgba(20,184,166,0.1)';
            } else {
                ctx.strokeStyle = 'rgba(251,191,36,0.9)'; ctx.fillStyle = 'rgba(251,191,36,0.12)';
                if (selectedTile && sh) {
                    ctx.globalAlpha = 0.6;
                    ctx.drawImage(sh, selectedTile[0] * STR, selectedTile[1] * STR, SRC, SRC, dx, dy, ts, ts);
                    ctx.globalAlpha = 1;
                }
            }
            ctx.lineWidth = 2;
            ctx.strokeRect(dx + 1, dy + 1, ts - 2, ts - 2);
            ctx.fillRect(dx + 1, dy + 1, ts - 2, ts - 2);
        }

        // POI markers
        pois.forEach(p => {
            const dx = Math.round(mapOffset.x + p.col * ts);
            const dy = Math.round(mapOffset.y + p.row * ts);
            if (dx + ts < 0 || dy + ts < 0 || dx > cv.width || dy > cv.height) return;

            // Colored dot at top-right of the tile
            const dotR = Math.max(4, ts * 0.15);
            const dotX = dx + ts - dotR - 2;
            const dotY = dy + dotR + 2;
            ctx.fillStyle = p.color || '#d97706';
            ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label chip (shown when zoom big enough)
            if (ts >= 28) {
                const fs = Math.max(8, Math.min(11, mapZoom * 10));
                ctx.font = `bold ${fs}px sans-serif`;
                ctx.textBaseline = 'bottom';
                const tw = ctx.measureText(p.label).width + 8;
                const bh = fs + 6;
                const bx = dx;
                const by = dy;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.beginPath(); ctx.roundRect(bx + 1, by - bh - 1, tw + 2, bh + 2, 4); ctx.fill();
                ctx.fillStyle = p.color || '#d97706';
                ctx.beginPath(); ctx.roundRect(bx, by - bh, tw, bh, 4); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText(p.label, bx + 4, by - 2);
                ctx.textBaseline = 'top';
            }
        });

        // Coord labels
        if (showCoords && ts >= 24) {
            ctx.textBaseline = 'top';
            ctx.font = `${Math.max(8, ts * 0.2)}px monospace`;
            map.forEach((row, ri) => {
                row.forEach((_, ci) => {
                    const dx = Math.round(mapOffset.x + ci * ts);
                    const dy = Math.round(mapOffset.y + ri * ts);
                    if (dx + ts < 0 || dy + ts < 0 || dx > cv.width || dy > cv.height) return;
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillText(`${ci},${ri}`, dx + 2, dy + 2);
                });
            });
        }
    }, [map, mapZoom, mapOffset, hoverCell, tool, selectedTile, loaded, showCoords, pois]);

    useEffect(() => {
        const loop = () => { drawMapCanvas(); animMap.current = requestAnimationFrame(loop); };
        animMap.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animMap.current);
    }, [drawMapCanvas]);

    useEffect(() => {
        const cv = mapCanvasRef.current; if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    // ── Palette click ─────────────────────────────────────────
    const onPaletteClick = e => {
        const cv = paletteRef.current;
        const rect = cv.getBoundingClientRect();
        const ps = PALETTE_SCALE;
        const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX, py = (e.clientY - rect.top) * scaleY;
        const col = Math.floor(px / (STR * ps)), row = Math.floor(py / (STR * ps));
        if (col < Math.floor(SHEET_W * ps / (STR * ps)) && row < Math.floor(SHEET_H * ps / (STR * ps))) {
            setSelected([col, row]); setTool('paint');
        }
    };

    const getCellFromEvent = e => {
        const cv = mapCanvasRef.current; if (!cv) return null;
        const rect = cv.getBoundingClientRect();
        const ts = PAINT_TILE * mapZoom;
        const col = Math.floor((e.clientX - rect.left - mapOffset.x) / ts);
        const row = Math.floor((e.clientY - rect.top - mapOffset.y) / ts);
        if (col >= 0 && col < DEFAULT_COLS && row >= 0 && row < DEFAULT_ROWS) return { col, row };
        return null;
    };

    // ── Flood fill ────────────────────────────────────────────
    const floodFill = (mapData, col, row, newTile) => {
        const target = mapData[row][col];
        const targetStr = JSON.stringify(target);
        const newStr = JSON.stringify(newTile);
        if (targetStr === newStr) return mapData;
        const filled = mapData.map(r => r.map(c => c ? [...c] : null));
        const stack = [[col, row]];
        while (stack.length) {
            const [c, r] = stack.pop();
            if (c < 0 || c >= DEFAULT_COLS || r < 0 || r >= DEFAULT_ROWS) continue;
            if (JSON.stringify(filled[r][c]) !== targetStr) continue;
            filled[r][c] = newTile ? [...newTile] : null;
            stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
        }
        return filled;
    };

    const paintCell = useCallback((col, row) => {
        setHistory(h => [...h.slice(-30), map.map(r => r.map(c => c ? [...c] : null))]);
        setMap(prev => {
            const next = prev.map(r => [...r]);
            if (tool === 'erase') { next[row] = [...next[row]]; next[row][col] = null; }
            else if (tool === 'fill') { return floodFill(prev, col, row, selectedTile); }
            else { next[row] = [...next[row]]; next[row][col] = selectedTile ? [...selectedTile] : null; }
            return next;
        });
    }, [tool, selectedTile, map]);

    // ── POI Modal helpers ─────────────────────────────────────
    const openPoiModal = (col, row) => {
        const existingIndex = pois.findIndex(p => p.col === col && p.row === row);
        if (existingIndex >= 0) {
            const p = pois[existingIndex];
            setPoiForm({
                name: p.name || '',
                label: p.label || '',
                color: p.color || '#d97706',
                aliases: (p.aliases || []).join(', '),
                actions: p.actions ? p.actions.map(a => ({ ...a })) : [],
            });
            setPoiModal({ col, row, existingIndex });
        } else {
            setPoiForm({ ...EMPTY_FORM, actions: [] });
            setPoiModal({ col, row, existingIndex: null });
        }
    };

    const savePoiForm = () => {
        const newPoi = {
            col: poiModal.col, row: poiModal.row,
            name: poiForm.name.trim(),
            label: poiForm.label.trim(),
            color: poiForm.color,
            aliases: poiForm.aliases.split(',').map(s => s.trim()).filter(Boolean),
            actions: poiForm.actions,
        };
        let updated;
        if (poiModal.existingIndex !== null) {
            updated = pois.map((p, i) => i === poiModal.existingIndex ? newPoi : p);
        } else {
            updated = [...pois, newPoi];
        }
        setPois(updated);
        savePois(updated);
        setPoiModal(null);
    };

    const deletePoiFromModal = () => {
        const updated = pois.filter((_, i) => i !== poiModal.existingIndex);
        setPois(updated);
        savePois(updated);
        setPoiModal(null);
    };

    const addAction = () => setPoiForm(f => ({ ...f, actions: [...f.actions, { id: '', label: '', effect: '' }] }));
    const removeAction = i => setPoiForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));
    const updateAction = (i, field, val) => setPoiForm(f => ({
        ...f, actions: f.actions.map((a, j) => j === i ? { ...a, [field]: val } : a)
    }));

    // ── Map mouse events ──────────────────────────────────────
    const onMapMouseDown = e => {
        if (e.button === 1 || e.button === 2) {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (tool === 'mark') {
            const cell = getCellFromEvent(e);
            if (cell) openPoiModal(cell.col, cell.row);
            return;
        }
        isPainting.current = true;
        const cell = getCellFromEvent(e);
        if (cell) paintCell(cell.col, cell.row);
    };

    const onMapMouseMove = e => {
        const cell = getCellFromEvent(e);
        setHoverCell(cell);
        if (isDragging.current) {
            setMapOffset(o => ({ x: o.x + e.clientX - lastMouse.current.x, y: o.y + e.clientY - lastMouse.current.y }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        } else if (isPainting.current && cell && tool !== 'fill') {
            paintCell(cell.col, cell.row);
        }
    };

    const onMapMouseUp = () => { isPainting.current = false; isDragging.current = false; };
    const onMapMouseLeave = () => { isPainting.current = false; isDragging.current = false; setHoverCell(null); };
    const onMapWheel = e => {
        e.preventDefault();
        setMapZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1))).toFixed(2)));
    };

    const undo = () => {
        if (!history.length) return;
        setMap(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
    };

    const handleSave = () => {
        saveMap(map);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify({ map, pois }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'nanako_world.json'; a.click();
        URL.revokeObjectURL(url);
    };

    const importJSON = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    // Support both old format (array) and new format ({ map, pois })
                    if (Array.isArray(data)) {
                        setMap(data); saveMap(data);
                    } else if (data.map && Array.isArray(data.map)) {
                        setMap(data.map); saveMap(data.map);
                        if (Array.isArray(data.pois)) { setPois(data.pois); savePois(data.pois); }
                    }
                } catch { alert('无效的地图文件'); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const clearMap = () => {
        if (!confirm('确定清空整个地图吗？')) return;
        setMap(Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(null)));
    };

    const fillAll = () => {
        if (!selectedTile) return;
        setMap(Array.from({ length: DEFAULT_ROWS }, () => Array.from({ length: DEFAULT_COLS }, () => [...selectedTile])));
    };

    const toolBtn = (id, icon, label, color) => (
        <button key={id} onClick={() => setTool(id)} title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tool === id ? `${color} text-white scale-105 shadow-lg` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {icon} {label}
        </button>
    );

    const palTotal = loaded ? `${Math.floor(SHEET_W / STR)}×${Math.floor(SHEET_H / STR)}` : '...';

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans pt-16 select-none text-white">
            {/* ── Toolbar ── */}
            <div className="fixed top-16 inset-x-0 z-40 bg-slate-900 border-b border-slate-700 px-4 py-2 flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    {toolBtn('paint', '🖌️', '画笔', 'bg-amber-600')}
                    {toolBtn('erase', '🧹', '擦除', 'bg-red-700')}
                    {toolBtn('fill', '🪣', '填充', 'bg-purple-600')}
                    {toolBtn('mark', '📍', '标记', 'bg-teal-600')}
                </div>
                <div className="w-px h-6 bg-slate-700" />
                <button onClick={undo} disabled={!history.length} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed">↩ 撤销</button>
                <button onClick={fillAll} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600">⬛ 铺满</button>
                <button onClick={clearMap} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-red-900/70 hover:bg-red-800 text-red-200">🗑 清空</button>
                <div className="w-px h-6 bg-slate-700" />
                <button onClick={handleSave} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-emerald-700 hover:bg-emerald-600'}`}>
                    {saved ? '✅ 已保存!' : '💾 保存地图'}
                </button>
                <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600">📤 导出 JSON</button>
                <button onClick={importJSON} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600">📥 导入 JSON</button>
                <div className="w-px h-6 bg-slate-700" />
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={showCoords} onChange={e => setShowCoords(e.target.checked)} className="accent-emerald-500" />
                    坐标
                </label>
                {/* POI count badge */}
                <span className="text-xs text-teal-400 font-mono">📍 {pois.length} 个地点</span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-slate-500">{Math.round(mapZoom * 100)}%</span>
                    <button onClick={() => { setMapZoom(1); setMapOffset({ x: 0, y: 0 }); }} className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600">重置视图</button>
                </div>
            </div>

            {/* ── Main layout ── */}
            <div className="flex flex-1 pt-10 h-[calc(100vh-7rem)]">
                {/* LEFT: Tile palette */}
                <div className="w-64 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-700 bg-slate-800">
                        <p className="text-xs font-bold text-slate-300">🎨 图块选择器</p>
                        <p className="text-[10px] text-slate-500">点击选择图块 · {palTotal} 种</p>
                        {selectedTile && <p className="text-[10px] text-amber-400 mt-0.5">已选: T({selectedTile[0]}, {selectedTile[1]})</p>}
                    </div>

                    {/* POI list (shown when mark tool active) */}
                    {tool === 'mark' && (
                        <div className="border-b border-slate-700 bg-slate-800/60">
                            <p className="text-[10px] font-bold text-teal-400 px-3 pt-2 pb-1">📍 已标记地点 — 点击格子编辑</p>
                            <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-1">
                                {pois.length === 0 && <p className="text-[10px] text-slate-500 px-1">暂无地点，点击地图格子添加</p>}
                                {pois.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-700/60 text-[10px]"
                                        style={{ borderLeft: `3px solid ${p.color}` }}>
                                        <span className="flex-1 text-slate-200 truncate">{p.label}</span>
                                        <span className="text-slate-500 font-mono">[{p.col},{p.row}]</span>
                                        <button onClick={() => openPoiModal(p.col, p.row)}
                                            className="text-teal-400 hover:text-teal-300">✏️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
                        {loaded
                            ? <canvas ref={paletteRef} onClick={onPaletteClick}
                                className="cursor-crosshair" style={{ imageRendering: 'pixelated', display: 'block', width: '100%' }} />
                            : <div className="p-4 text-slate-500 text-sm">⏳ 加载图块集中...</div>
                        }
                    </div>
                </div>

                {/* RIGHT: Map canvas */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#050a14]">
                    <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center gap-4 text-xs text-slate-400">
                        <span>🗺️ 地图画布 {DEFAULT_COLS}×{DEFAULT_ROWS}</span>
                        {tool === 'mark'
                            ? <span className="text-teal-400 font-bold">📍 标记模式: 点击格子放置/编辑地点</span>
                            : <span>· 中键拖拽/右键可平移 · 滚轮缩放</span>
                        }
                        {hoverCell && <span className="text-amber-400">格[{hoverCell.col},{hoverCell.row}]</span>}
                        <span className="ml-auto text-emerald-400">保存后在"世界地图"标签预览</span>
                    </div>
                    <canvas ref={mapCanvasRef}
                        className="flex-1 block w-full h-full"
                        style={{ cursor: isDragging.current ? 'grabbing' : tool === 'erase' ? 'cell' : tool === 'fill' ? 'crosshair' : tool === 'mark' ? 'cell' : 'default' }}
                        onWheel={onMapWheel}
                        onMouseDown={onMapMouseDown}
                        onMouseMove={onMapMouseMove}
                        onMouseUp={onMapMouseUp}
                        onMouseLeave={onMapMouseLeave}
                        onContextMenu={e => { e.preventDefault(); isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; }}
                    />
                </div>
            </div>

            {/* ── Legend strip ── */}
            <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                <span>🖌️ 画笔: 点击/拖拽放置图块</span>
                <span>🧹 擦除: 清除格子</span>
                <span>🪣 填充: 一键填满同色区域</span>
                <span>📍 标记: 点击格子设置/编辑命名地点</span>
                <span>💾 保存: 写入本地存储 (地图标签自动同步)</span>
            </div>

            {/* ══════════════════════════════════════════════════════
                POI Edit Modal
            ══════════════════════════════════════════════════════ */}
            {poiModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
                    onClick={() => setPoiModal(null)}>
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-white">
                                {poiModal.existingIndex !== null ? '✏️ 编辑地点' : '📍 新建地点'}
                                <span className="text-sm text-slate-400 font-normal ml-2">[{poiModal.col},{poiModal.row}]</span>
                            </h2>
                            <button onClick={() => setPoiModal(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>

                        {/* Name */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">地点名称 (用于AI识别)</label>
                            <input value={poiForm.name} onChange={e => setPoiForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                                placeholder="例如：咖啡厅" />
                        </div>

                        {/* Display Label */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">显示标签 (含Emoji)</label>
                            <input value={poiForm.label} onChange={e => setPoiForm(f => ({ ...f, label: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                                placeholder="例如：☕ 咖啡厅" />
                        </div>

                        {/* Aliases */}
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">别名 (逗号分割，AI可用这些词找到该地点)</label>
                            <input value={poiForm.aliases} onChange={e => setPoiForm(f => ({ ...f, aliases: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                                placeholder="例如：咖啡, 喝咖啡, cafe" />
                        </div>

                        {/* Color */}
                        <div className="mb-5">
                            <label className="text-xs text-slate-400 font-bold block mb-2">标签颜色</label>
                            <div className="flex gap-2 flex-wrap">
                                {POI_COLORS.map(c => (
                                    <button key={c} onClick={() => setPoiForm(f => ({ ...f, color: c }))}
                                        className={`w-7 h-7 rounded-full border-2 transition-transform ${poiForm.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                                        style={{ background: c }} />
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-400 font-bold">可交互动作 (AI 到达后可执行)</label>
                                <button onClick={addAction}
                                    className="text-xs bg-teal-700 hover:bg-teal-600 text-white px-2 py-1 rounded-lg font-bold">+ 添加</button>
                            </div>
                            {poiForm.actions.length === 0 && (
                                <p className="text-[11px] text-slate-500 italic">暂无动作，点击"添加"创建</p>
                            )}
                            <div className="space-y-2">
                                {poiForm.actions.map((a, i) => (
                                    <div key={i} className="bg-slate-700/60 rounded-xl p-3 border border-slate-600/50">
                                        <div className="flex gap-2 mb-2">
                                            <input value={a.id} onChange={e => updateAction(i, 'id', e.target.value)}
                                                placeholder="动作ID (英文)" className="flex-1 bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500" />
                                            <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
                                        </div>
                                        <input value={a.label} onChange={e => updateAction(i, 'label', e.target.value)}
                                            placeholder="动作名称 (例如：买咖啡)" className="w-full bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500 mb-2" />
                                        <input value={a.effect} onChange={e => updateAction(i, 'effect', e.target.value)}
                                            placeholder="效果描述 (例如：精力+20，花费5金)" className="w-full bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button onClick={savePoiForm}
                                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-2 rounded-xl text-sm transition-colors">
                                💾 保存地点
                            </button>
                            {poiModal.existingIndex !== null && (
                                <button onClick={deletePoiFromModal}
                                    className="bg-red-700 hover:bg-red-600 text-white font-black py-2 px-4 rounded-xl text-sm transition-colors">
                                    🗑 删除
                                </button>
                            )}
                            <button onClick={() => setPoiModal(null)}
                                className="bg-slate-600 hover:bg-slate-500 text-slate-300 font-bold py-2 px-4 rounded-xl text-sm transition-colors">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
