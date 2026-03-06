import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { loadPois, POI_KEY, loadCustomFurn, CUSTOM_FURN_KEY, loadCustomFloors, CUSTOM_FLOOR_KEY, migrateFurniture } from './mapUtils';
import { COLS, ROWS, CELL, drawScene, drawFurniture, drawFloorTile, C, FURN, TREES, WALK_GRID, FLOOR_TYPES, getBuiltInFurniture } from './GridWorldRenderer';

// ============================================================
//  MAP EDITOR  v4 — Tile palette (floors + furniture) + paint
// ============================================================

// All available furniture / decoration types for the palette
const FURNITURE_TYPES = [
    { id: 'bed', label: '单人床' },
    { id: 'bed2', label: '双人床' },
    { id: 'desk', label: '办公桌' },
    { id: 'chair', label: '椅子' },
    { id: 'table', label: '方桌' },
    { id: 'table_round', label: '圆桌' },
    { id: 'sofa', label: '沙发' },
    { id: 'sofa_corner', label: '沙发角' },
    { id: 'tv', label: '电视' },
    { id: 'wardrobe', label: '衣柜' },
    { id: 'shelf', label: '书架' },
    { id: 'counter', label: '柜台' },
    { id: 'counter_sink', label: '洗碗台' },
    { id: 'stove', label: '灶台' },
    { id: 'sink', label: '洗手台' },
    { id: 'bath', label: '浴缸' },
    { id: 'plant', label: '盆栽' },
    { id: 'plant2', label: '高盆栽' },
    { id: 'tree', label: '树木' },
    { id: 'flower', label: '花丛' },
    { id: 'fountain', label: '喷泉' },
    { id: 'bench', label: '长椅' },
    { id: 'lamp', label: '台灯' },
    { id: 'barrel', label: '木桶' },
    { id: 'rug', label: '蓝地毯' },
    { id: 'rug2', label: '红地毯' },
    { id: 'mat', label: '地垫' },
    { id: 'vending', label: '贩卖机' },
    { id: 'sign', label: '招牌' },
    { id: 'fridge', label: '冰箱' },
    { id: 'clock', label: '挂钟' },
    { id: 'piano', label: '钢琴' },
    { id: 'toilet', label: '马桶' },
    { id: 'mirror', label: '镜子' },
    { id: 'painting', label: '挂画' },
    { id: 'fishbowl', label: '鱼缸' },
    { id: 'cake', label: '蛋糕' },
    { id: 'mailbox', label: '邮箱' },
    { id: 'streetlamp', label: '路灯' },
    { id: 'trashcan', label: '垃圾桶' },
    { id: 'well', label: '水井' },
];

const POI_COLORS = ['#d97706', '#0284c7', '#16a34a', '#7c3aed', '#1d4ed8', '#c2410c', '#854d0e', '#dc2626', '#0f766e', '#be185d'];
const EMPTY_FORM = { name: '', label: '📍 ', color: '#d97706', aliases: '', actions: [], col: 0, row: 0 };

// ── 云端保存辅助：通过 window 事件 → NanakoPetController → WS → 云端 ──
const cloudSavePois = (pois) => window.dispatchEvent(new CustomEvent('nanako:save_pois', { detail: pois }));
const cloudSaveFurn = (furn) => window.dispatchEvent(new CustomEvent('nanako:save_furn', { detail: furn }));
const cloudSaveFloors = (floors) => window.dispatchEvent(new CustomEvent('nanako:save_floors', { detail: floors }));

// Generate tile preview canvases for furniture
function useFurniturePreviews() {
    return useMemo(() => {
        const previews = {};
        FURNITURE_TYPES.forEach(({ id }) => {
            const cv = document.createElement('canvas');
            cv.width = 48; cv.height = 48;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 48, 48);
            drawFurniture(ctx, id, 0, 0, 48);
            previews[id] = cv.toDataURL();
        });
        return previews;
    }, []);
}

// Generate tile preview canvases for floor tiles
function useFloorPreviews() {
    return useMemo(() => {
        const previews = {};
        FLOOR_TYPES.forEach(({ id }) => {
            const cv = document.createElement('canvas');
            cv.width = 48; cv.height = 48;
            const ctx = cv.getContext('2d');
            drawFloorTile(ctx, id, 0, 0, 48);
            // Alt tile at (1, 0) for checkerboard preview
            const cv2 = document.createElement('canvas');
            cv2.width = 48; cv2.height = 48;
            const ctx2 = cv2.getContext('2d');
            // Draw a 2x1 preview in half resolution to show both colors
            drawFloorTile(ctx, id, 0, 0, 24);
            drawFloorTile(ctx, id, 1, 0, 24);
            drawFloorTile(ctx, id, 0, 1, 24);
            drawFloorTile(ctx, id, 1, 1, 24);
            previews[id] = cv.toDataURL();
        });
        return previews;
    }, []);
}

export default function MapEditor() {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const isDragging = useRef(false);
    const isPainting = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const clickStart = useRef({ x: 0, y: 0 });

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [customFurn, setCustomFurn] = useState(() => migrateFurniture(getBuiltInFurniture()));
    const [customFloors, setCustomFloors] = useState(loadCustomFloors);
    const [tool, setTool] = useState('paint');       // 'paint' | 'erase' | 'poi' | 'info'
    const [paletteTab, setPaletteTab] = useState('floor'); // 'floor' | 'furn'
    const [selectedTile, setSelectedTile] = useState('f_grass');
    const [showGrid, setShowGrid] = useState(true);
    const [showWalk, setShowWalk] = useState(false);
    const [showCoords, setShowCoords] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(true);

    const furnPreviews = useFurniturePreviews();
    const floorPreviews = useFloorPreviews();

    const isFloorTile = selectedTile?.startsWith('f_');

    // POI Modal
    const [poiModal, setPoiModal] = useState(null);
    const [poiForm, setPoiForm] = useState(EMPTY_FORM);

    // History for undo
    const [history, setHistory] = useState([]);
    const pushHistory = () => setHistory(h => [...h.slice(-30), JSON.stringify({ furn: customFurn, floors: customFloors })]);
    const undo = () => {
        if (!history.length) return;
        const prev = JSON.parse(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
        setCustomFurn(prev.furn || []);
        setCustomFloors(prev.floors || []);
        cloudSaveFurn(prev.furn || []);
        cloudSaveFloors(prev.floors || []);
    };

    // ── Storage sync ──
    useEffect(() => {
        const onStorage = e => {
            if (e.key === POI_KEY || !e.key) setPois(loadPois());
            if (e.key === CUSTOM_FURN_KEY || !e.key) setCustomFurn(loadCustomFurn());
            if (e.key === CUSTOM_FLOOR_KEY || !e.key) setCustomFloors(loadCustomFloors());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // ── Place / erase ──
    const placeTile = useCallback((col, row) => {
        if (tool === 'paint' && selectedTile) {
            pushHistory();
            if (isFloorTile) {
                setCustomFloors(prev => {
                    const filtered = prev.filter(f => !(f.c === col && f.r === row));
                    const updated = [...filtered, { t: selectedTile, c: col, r: row }];
                    cloudSaveFloors(updated);
                    return updated;
                });
            } else {
                setCustomFurn(prev => {
                    const filtered = prev.filter(f => !(f.c === col && f.r === row));
                    const updated = [...filtered, { t: selectedTile, c: col, r: row }];
                    cloudSaveFurn(updated);
                    return updated;
                });
            }
        } else if (tool === 'erase') {
            const hasCustomFurn = customFurn.some(f => f.c === col && f.r === row);
            const hasCustomFloor = customFloors.some(f => f.c === col && f.r === row);
            if (hasCustomFurn || hasCustomFloor) {
                pushHistory();
                if (hasCustomFurn) {
                    setCustomFurn(prev => {
                        const updated = prev.filter(f => !(f.c === col && f.r === row));
                        cloudSaveFurn(updated);
                        return updated;
                    });
                }
                if (hasCustomFloor) {
                    setCustomFloors(prev => {
                        const updated = prev.filter(f => !(f.c === col && f.r === row));
                        cloudSaveFloors(updated);
                        return updated;
                    });
                }
            }
        }
    }, [tool, selectedTile, isFloorTile, customFurn, customFloors]);

    // ── Draw ──
    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        const cs = CELL * zoom, ox = offset.x, oy = offset.y;

        // Draw the same scene as GridWorldSimulator (no character) + custom items
        drawScene(ctx, W, H, zoom, offset, pois, -99, -99, 'idle', null, null, 'down', customFurn, customFloors);

        // ── Walkability overlay ──
        if (showWalk) {
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = Math.round(ox + c * cs);
                    const y = Math.round(oy + r * cs);
                    if (x + cs < 0 || y + cs < 0 || x > W || y > H) continue;
                    const walkable = WALK_GRID[r]?.[c];
                    ctx.fillStyle = walkable ? 'rgba(52,211,153,0.18)' : 'rgba(239,68,68,0.22)';
                    ctx.fillRect(x, y, cs, cs);
                    if (!walkable) {
                        ctx.strokeStyle = 'rgba(239,68,68,0.35)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + cs - 3, y + cs - 3);
                        ctx.moveTo(x + cs - 3, y + 3); ctx.lineTo(x + 3, y + cs - 3);
                        ctx.stroke();
                    }
                }
            }
        }

        // ── Grid overlay ──
        if (showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5;
            for (let r = 0; r <= ROWS; r++) {
                const y = Math.round(oy + r * cs);
                ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + COLS * cs, y); ctx.stroke();
            }
            for (let c = 0; c <= COLS; c++) {
                const x = Math.round(ox + c * cs);
                ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + ROWS * cs); ctx.stroke();
            }
        }

        // ── Coordinate labels ──
        if (showCoords && cs >= 24) {
            ctx.textBaseline = 'top';
            ctx.font = `${Math.max(7, cs * 0.18)}px monospace`;
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = Math.round(ox + c * cs);
                    const y = Math.round(oy + r * cs);
                    if (x + cs < 0 || y + cs < 0 || x > W || y > H) continue;
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText(`${c},${r}`, x + 2, y + 2);
                }
            }
        }

        // ── Custom item markers (small dots) ──
        customFurn.forEach(f => {
            const x = Math.round(ox + f.c * cs);
            const y = Math.round(oy + f.r * cs);
            if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
            ctx.fillStyle = 'rgba(251,191,36,0.85)';
            ctx.beginPath(); ctx.arc(x + cs - 5, y + 5, 3, 0, Math.PI * 2); ctx.fill();
        });
        customFloors.forEach(f => {
            const x = Math.round(ox + f.c * cs);
            const y = Math.round(oy + f.r * cs);
            if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
            ctx.fillStyle = 'rgba(56,189,248,0.7)';
            ctx.beginPath(); ctx.arc(x + 5, y + cs - 5, 3, 0, Math.PI * 2); ctx.fill();
        });

        // ── POI highlight rings ──
        pois.forEach(p => {
            const x = Math.round(ox + p.col * cs);
            const y = Math.round(oy + p.row * cs);
            if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
            const pulse = 0.7 + Math.sin(Date.now() / 400) * 0.3;
            ctx.strokeStyle = p.color || '#d97706';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = pulse;
            ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cs - 4, cs - 4, 6); ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // ── Hover highlight + ghost preview ──
        if (hovered) {
            const x = Math.round(ox + hovered.col * cs);
            const y = Math.round(oy + hovered.row * cs);
            const existingCustomF = customFurn.find(f => f.c === hovered.col && f.r === hovered.row);
            const existingCustomFl = customFloors.find(f => f.c === hovered.col && f.r === hovered.row);
            const existingPoi = pois.find(p => p.col === hovered.col && p.row === hovered.row);

            if (tool === 'paint') {
                if (isFloorTile) {
                    // Ghost preview of floor tile
                    ctx.save();
                    ctx.translate(ox, oy);
                    ctx.globalAlpha = 0.6;
                    drawFloorTile(ctx, selectedTile, hovered.col, hovered.row, cs);
                    ctx.globalAlpha = 1;
                    ctx.restore();
                } else {
                    // Ghost preview of furniture
                    ctx.globalAlpha = 0.5;
                    drawFurniture(ctx, selectedTile, hovered.col, hovered.row, cs);
                    ctx.globalAlpha = 1;
                }
                ctx.strokeStyle = isFloorTile ? 'rgba(56,189,248,0.9)' : 'rgba(251,191,36,0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
            } else if (tool === 'erase') {
                ctx.fillStyle = 'rgba(239,68,68,0.2)';
                ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
                const hasCustom = existingCustomF || existingCustomFl;
                ctx.strokeStyle = hasCustom ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.4)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
                if (hasCustom) {
                    ctx.strokeStyle = 'rgba(239,68,68,0.7)'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + cs - 6, y + cs - 6);
                    ctx.moveTo(x + cs - 6, y + 6); ctx.lineTo(x + 6, y + cs - 6);
                    ctx.stroke();
                }
            } else if (tool === 'poi') {
                ctx.strokeStyle = existingPoi ? 'rgba(20,184,166,0.95)' : 'rgba(251,191,36,0.9)';
                ctx.fillStyle = existingPoi ? 'rgba(20,184,166,0.15)' : 'rgba(251,191,36,0.1)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
                ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            } else {
                ctx.strokeStyle = 'rgba(139,92,246,0.9)'; ctx.fillStyle = 'rgba(139,92,246,0.1)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
                ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            }

            // Info tooltip
            const walkable = WALK_GRID[hovered.row]?.[hovered.col];
            let infoText = `[${hovered.col},${hovered.row}]`;
            if (existingCustomFl) infoText += ` · 🟧 ${FLOOR_TYPES.find(t => t.id === existingCustomFl.t)?.label || existingCustomFl.t}`;
            if (existingCustomF) infoText += ` · 🪑 ${FURNITURE_TYPES.find(t => t.id === existingCustomF.t)?.label || existingCustomF.t}`;
            if (existingPoi) infoText += ` · ${existingPoi.label}`;
            infoText += walkable ? ' · ✓可走' : ' · ✕墙壁';
            const fs = Math.max(10, Math.min(13, zoom * 12));
            ctx.font = `bold ${fs}px sans-serif`;
            ctx.textBaseline = 'bottom';
            const tw = ctx.measureText(infoText).width + 12;
            const bh = fs + 8;
            const bx = x + cs / 2 - tw / 2;
            const by = y - 4;
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.beginPath(); ctx.roundRect(bx, by - bh, tw, bh, 5); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(infoText, bx + 6, by - 3);
        }
    }, [zoom, offset, pois, hovered, showGrid, showWalk, showCoords, tool, selectedTile, isFloorTile, customFurn, customFloors]);

    useEffect(() => {
        const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    // ── Mouse helpers ──
    const getRC = e => {
        const cv = canvasRef.current; if (!cv) return null;
        const r = cv.getBoundingClientRect(), cs = CELL * zoom;
        const col = Math.floor((e.clientX - r.left - offset.x) / cs);
        const row = Math.floor((e.clientY - r.top - offset.y) / cs);
        return (col >= 0 && col < COLS && row >= 0 && row < ROWS) ? { col, row } : null;
    };

    const onMouseMove = e => {
        setHovered(getRC(e));
        if (isDragging.current) {
            setOffset(o => ({ x: o.x + e.clientX - lastMouse.current.x, y: o.y + e.clientY - lastMouse.current.y }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
        if (isPainting.current && (tool === 'paint' || tool === 'erase')) {
            const rc = getRC(e);
            if (rc) placeTile(rc.col, rc.row);
        }
    };

    const onMouseDown = e => {
        clickStart.current = { x: e.clientX, y: e.clientY };
        if (e.button === 1 || e.button === 2) {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (tool === 'paint' || tool === 'erase') {
            isPainting.current = true;
            const rc = getRC(e);
            if (rc) placeTile(rc.col, rc.row);
        } else {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };

    const onMouseUp = e => {
        const dx = Math.abs(e.clientX - clickStart.current.x);
        const dy = Math.abs(e.clientY - clickStart.current.y);
        isDragging.current = false;
        isPainting.current = false;
        if (dx < 5 && dy < 5 && tool === 'poi') {
            const rc = getRC(e);
            if (rc) openPoiModal(rc.col, rc.row);
        }
    };

    const onMouseLeave = () => { isDragging.current = false; isPainting.current = false; setHovered(null); };
    const onWheel = e => {
        e.preventDefault();
        setZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1))).toFixed(2)));
    };

    // ── POI Modal ──
    const openPoiModal = (col, row) => {
        const existingIndex = pois.findIndex(p => p.col === col && p.row === row);
        if (existingIndex >= 0) {
            const p = pois[existingIndex];
            setPoiForm({ name: p.name || '', label: p.label || '', color: p.color || '#d97706', aliases: (p.aliases || []).join(', '), actions: p.actions ? p.actions.map(a => ({ ...a })) : [], col: p.col, row: p.row });
            setPoiModal({ col, row, existingIndex });
        } else {
            setPoiForm({ ...EMPTY_FORM, col, row, actions: [] });
            setPoiModal({ col, row, existingIndex: null });
        }
    };

    // 也支持从 POI 列表点击编辑（用名称查找而非坐标）
    const openPoiModalByIndex = (index) => {
        const p = pois[index];
        if (!p) return;
        setPoiForm({ name: p.name || '', label: p.label || '', color: p.color || '#d97706', aliases: (p.aliases || []).join(', '), actions: p.actions ? p.actions.map(a => ({ ...a })) : [], col: p.col, row: p.row });
        setPoiModal({ col: p.col, row: p.row, existingIndex: index });
    };

    const savePoiForm = () => {
        const newPoi = { col: poiForm.col, row: poiForm.row, name: poiForm.name.trim(), label: poiForm.label.trim(), color: poiForm.color, aliases: poiForm.aliases.split(',').map(s => s.trim()).filter(Boolean), actions: poiForm.actions };
        let updated = poiModal.existingIndex !== null ? pois.map((p, i) => i === poiModal.existingIndex ? newPoi : p) : [...pois, newPoi];
        setPois(updated); cloudSavePois(updated); setPoiModal(null);
    };

    const deletePoiFromModal = () => {
        const updated = pois.filter((_, i) => i !== poiModal.existingIndex);
        setPois(updated); cloudSavePois(updated); setPoiModal(null);
    };

    const addAction = () => setPoiForm(f => ({ ...f, actions: [...f.actions, { id: '', label: '', effect: '' }] }));
    const removeAction = i => setPoiForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));
    const updateAction = (i, field, val) => setPoiForm(f => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, [field]: val } : a) }));

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify({ pois, customFurn, customFloors }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'nanako_map_data.json'; a.click();
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
                    if (data.pois && Array.isArray(data.pois)) { setPois(data.pois); cloudSavePois(data.pois); }
                    if (data.customFurn && Array.isArray(data.customFurn)) { setCustomFurn(data.customFurn); cloudSaveFurn(data.customFurn); }
                    if (data.customFloors && Array.isArray(data.customFloors)) { setCustomFloors(data.customFloors); cloudSaveFloors(data.customFloors); }
                    if (Array.isArray(data) && data[0]?.name) { setPois(data); cloudSavePois(data); }
                } catch { alert('无效的JSON文件'); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const clearAll = () => {
        if (confirm('⚠️ 确定要清空所有图块（地板+家具）吗？\n这会删掉所有内置和自定义的家具！')) {
            pushHistory();
            setCustomFurn([]); setCustomFloors([]);
            cloudSaveFurn([]); cloudSaveFloors([]);
        }
    };

    const resetToDefaults = () => {
        if (confirm('🔄 确定要恢复默认家具布局吗？\n这会把所有家具重置为初始状态（自定义地板保留）。')) {
            pushHistory();
            const defaults = getBuiltInFurniture();
            setCustomFurn(defaults);
            cloudSaveFurn(defaults);
        }
    };

    const cursorStyle = () => {
        if (isDragging.current) return 'grabbing';
        if (tool === 'paint') return 'crosshair';
        if (tool === 'erase') return 'not-allowed';
        if (tool === 'poi') return 'cell';
        return 'default';
    };

    const toolBtn = (id, icon, label, color) => (
        <button key={id} onClick={() => setTool(id)} title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tool === id ? `${color} text-white scale-105 shadow-lg` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {icon} {label}
        </button>
    );

    // Get label for current selection
    const getSelectedLabel = () => {
        if (isFloorTile) {
            const ft = FLOOR_TYPES.find(t => t.id === selectedTile);
            return ft ? ft.label : selectedTile;
        }
        const f = FURNITURE_TYPES.find(t => t.id === selectedTile);
        return f ? f.label : selectedTile;
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans pt-16 select-none text-white">
            {/* ── Top Toolbar ── */}
            <div className="fixed top-16 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700 px-4 py-2 flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    {toolBtn('paint', '🖌️', '绘制', 'bg-amber-600')}
                    {toolBtn('erase', '🧹', '擦除', 'bg-red-700')}
                    {toolBtn('poi', '📍', '地点', 'bg-teal-600')}
                    {toolBtn('info', '🔍', '查看', 'bg-violet-600')}
                </div>
                <div className="w-px h-6 bg-slate-700" />
                <button onClick={undo} disabled={!history.length} title="撤销"
                    className={`px-2 py-1.5 rounded-lg text-sm font-bold ${history.length ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
                    ↩ 撤销
                </button>
                <button onClick={clearAll} className="px-2 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-red-700 text-slate-300">
                    🗑 清空
                </button>
                <button onClick={resetToDefaults} className="px-2 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-emerald-700 text-slate-300" title="恢复所有家具到默认布局">
                    🔄 重置
                </button>
                <div className="w-px h-6 bg-slate-700" />
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-emerald-500" /> 网格
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={showWalk} onChange={e => setShowWalk(e.target.checked)} className="accent-emerald-500" /> 可行走
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={showCoords} onChange={e => setShowCoords(e.target.checked)} className="accent-emerald-500" /> 坐标
                </label>
                <div className="w-px h-6 bg-slate-700" />
                <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600">📤 导出</button>
                <button onClick={importJSON} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-600">📥 导入</button>
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-sky-400 font-mono">🟧 {customFloors.length} 地板</span>
                    <span className="text-xs text-amber-400 font-mono">🪑 {customFurn.length} 家具</span>
                    <span className="text-xs text-teal-400 font-mono">📍 {pois.length} 地点</span>
                    <span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => { setZoom(0.65); setOffset({ x: 0, y: 0 }); }} className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600">重置视图</button>
                </div>
            </div>

            {/* ── Main layout ── */}
            <div className="flex flex-1 pt-10 h-[calc(100vh-7rem)]">
                {/* LEFT: Tile Palette + POI List */}
                <div className="w-72 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
                    {/* Palette header with tabs */}
                    <div className="border-b border-slate-700">
                        <div className="flex">
                            <button onClick={() => { setPaletteTab('floor'); setPaletteOpen(true); }}
                                className={`flex-1 px-3 py-2 text-sm font-black flex items-center justify-center gap-1.5 transition-colors ${paletteTab === 'floor' ? 'bg-sky-800 text-sky-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                🟧 地板/墙壁
                            </button>
                            <button onClick={() => { setPaletteTab('furn'); setPaletteOpen(true); }}
                                className={`flex-1 px-3 py-2 text-sm font-black flex items-center justify-center gap-1.5 transition-colors ${paletteTab === 'furn' ? 'bg-amber-800 text-amber-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                🪑 家具/装饰
                            </button>
                            <button onClick={() => setPaletteOpen(!paletteOpen)}
                                className="px-2 py-2 bg-slate-800 text-slate-500 hover:bg-slate-700 text-xs">
                                {paletteOpen ? '▲' : '▼'}
                            </button>
                        </div>

                        {paletteOpen && paletteTab === 'floor' && (
                            <div className="p-2 grid grid-cols-4 gap-1.5 max-h-[40vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {FLOOR_TYPES.map(({ id, label }) => (
                                    <button key={id} onClick={() => { setSelectedTile(id); setTool('paint'); }}
                                        title={label}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${selectedTile === id && tool === 'paint' ? 'border-sky-400 ring-2 ring-sky-400/40 scale-105' : 'border-slate-600 hover:border-slate-500'}`}>
                                        <img src={floorPreviews[id]} alt={label} className="w-full aspect-square block" style={{ imageRendering: 'pixelated' }} />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-slate-300 text-center py-0.5 leading-tight truncate px-0.5">
                                            {label}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {paletteOpen && paletteTab === 'furn' && (
                            <div className="p-2 grid grid-cols-4 gap-1.5 max-h-[40vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {FURNITURE_TYPES.map(({ id, label }) => (
                                    <button key={id} onClick={() => { setSelectedTile(id); setTool('paint'); }}
                                        title={label}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${selectedTile === id && tool === 'paint' ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105' : 'border-slate-600 hover:border-slate-500'}`}>
                                        <img src={furnPreviews[id]} alt={label} className="w-full aspect-square block" style={{ imageRendering: 'pixelated' }} />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-slate-300 text-center py-0.5 leading-tight truncate px-0.5">
                                            {label}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* POI List */}
                    <div className="px-3 py-2 border-b border-slate-700 bg-slate-800">
                        <p className="text-sm font-black text-white flex items-center gap-2">📍 地点管理</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">选📍工具后点击地图编辑</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                        {pois.length === 0 && <p className="text-xs text-slate-500 px-2 py-4 text-center">暂无地点</p>}
                        {pois.map((p, i) => (
                            <div key={i}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 cursor-pointer transition-colors border border-slate-700/50"
                                style={{ borderLeft: `3px solid ${p.color}` }}
                                onClick={() => openPoiModalByIndex(i)}>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-200 truncate">{p.label}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">[{p.col},{p.row}]</div>
                                </div>
                                <span className="text-slate-500 hover:text-teal-400 text-xs shrink-0">✏️</span>
                            </div>
                        ))}
                    </div>

                    <div className="px-3 py-2 border-t border-slate-700 bg-slate-800/50 space-y-1">
                        <button onClick={exportJSON} className="w-full px-3 py-1 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300">📤 导出全部</button>
                        <button onClick={importJSON} className="w-full px-3 py-1 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300">📥 导入</button>
                    </div>
                </div>

                {/* RIGHT: Map canvas */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#050a14]">
                    <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center gap-4 text-xs text-slate-400">
                        <span>🗺️ {COLS}×{ROWS}</span>
                        {tool === 'paint'
                            ? <span className={`${isFloorTile ? 'text-sky-400' : 'text-amber-400'} font-bold`}>🖌️ 绘制 · {isFloorTile ? '地板' : '家具'} · 当前: {getSelectedLabel()}</span>
                            : tool === 'erase'
                                ? <span className="text-red-400 font-bold">🧹 擦除 · 点击/拖拽擦除自定义图块</span>
                                : tool === 'poi'
                                    ? <span className="text-teal-400 font-bold">📍 点击格子编辑地点</span>
                                    : <span className="text-violet-400 font-bold">🔍 悬停查看详情</span>
                        }
                        {hovered && <span className="text-amber-400 font-mono">[{hovered.col},{hovered.row}]</span>}
                        <span className="ml-auto text-slate-500 text-[10px]">右键/中键拖拽 · 滚轮缩放 · 自动同步</span>
                    </div>
                    <canvas ref={canvasRef}
                        className="flex-1 block w-full h-full"
                        style={{ cursor: cursorStyle() }}
                        onWheel={onWheel}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseLeave}
                        onContextMenu={e => { e.preventDefault(); isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; }}
                    />
                </div>
            </div>

            {/* ── Legend strip ── */}
            <div className="bg-slate-900 border-t border-slate-700 px-4 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                <span>🖌️ 绘制: 选图块后点击/拖拽放置</span>
                <span>🧹 擦除: 删除自定义地板和家具</span>
                <span>📍 地点: POI管理</span>
                <span>↩ 支持撤销</span>
                <span>💾 自动保存并同步世界地图</span>
            </div>

            {/* ══════════ POI Edit Modal ══════════ */}
            {poiModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setPoiModal(null)}>
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-white">
                                {poiModal.existingIndex !== null ? '✏️ 编辑地点' : '📍 新建地点'}
                            </h2>
                            <button onClick={() => setPoiModal(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>
                        {/* 坐标编辑 */}
                        <div className="mb-4 flex gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 font-bold block mb-1">列 (Col)</label>
                                <input type="number" min={0} max={COLS - 1} value={poiForm.col} onChange={e => setPoiForm(f => ({ ...f, col: Math.max(0, Math.min(COLS - 1, parseInt(e.target.value) || 0)) }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 font-mono" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 font-bold block mb-1">行 (Row)</label>
                                <input type="number" min={0} max={ROWS - 1} value={poiForm.row} onChange={e => setPoiForm(f => ({ ...f, row: Math.max(0, Math.min(ROWS - 1, parseInt(e.target.value) || 0)) }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 font-mono" />
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">地点名称</label>
                            <input value={poiForm.name} onChange={e => setPoiForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="咖啡厅" />
                        </div>
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">显示标签</label>
                            <input value={poiForm.label} onChange={e => setPoiForm(f => ({ ...f, label: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="☕ 咖啡厅" />
                        </div>
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 font-bold block mb-1">别名 (逗号分割)</label>
                            <input value={poiForm.aliases} onChange={e => setPoiForm(f => ({ ...f, aliases: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="咖啡, cafe" />
                        </div>
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
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-400 font-bold">可交互动作</label>
                                <button onClick={addAction} className="text-xs bg-teal-700 hover:bg-teal-600 text-white px-2 py-1 rounded-lg font-bold">+ 添加</button>
                            </div>
                            {poiForm.actions.length === 0 && <p className="text-[11px] text-slate-500 italic">暂无动作</p>}
                            <div className="space-y-2">
                                {poiForm.actions.map((a, i) => (
                                    <div key={i} className="bg-slate-700/60 rounded-xl p-3 border border-slate-600/50">
                                        <div className="flex gap-2 mb-2">
                                            <input value={a.id} onChange={e => updateAction(i, 'id', e.target.value)} placeholder="动作ID" className="flex-1 bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500" />
                                            <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
                                        </div>
                                        <input value={a.label} onChange={e => updateAction(i, 'label', e.target.value)} placeholder="动作名称" className="w-full bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500 mb-2" />
                                        <input value={a.effect} onChange={e => updateAction(i, 'effect', e.target.value)} placeholder="效果描述" className="w-full bg-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none border border-slate-500 focus:border-teal-500" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={savePoiForm} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-2 rounded-xl text-sm transition-colors">💾 保存</button>
                            {poiModal.existingIndex !== null && (
                                <button onClick={deletePoiFromModal} className="bg-red-700 hover:bg-red-600 text-white font-black py-2 px-4 rounded-xl text-sm transition-colors">🗑 删除</button>
                            )}
                            <button onClick={() => setPoiModal(null)} className="bg-slate-600 hover:bg-slate-500 text-slate-300 font-bold py-2 px-4 rounded-xl text-sm transition-colors">取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
