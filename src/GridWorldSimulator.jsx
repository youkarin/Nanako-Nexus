import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, POI_KEY, loadCustomFurn, CUSTOM_FURN_KEY, loadCustomFloors, CUSTOM_FLOOR_KEY, migrateFurniture } from './mapUtils';
import { COLS, ROWS, CELL, drawScene, getBuiltInFurniture } from './GridWorldRenderer';

// ═════════════════════════════════════════════════════════════
//  COMPONENT — 云端模式 (纯渲染器)
//  · 不再做本地寻路/步进
//  · 角色坐标由云端 MapEngine 推送
//  · 点击地图 → 发给云端处理
//  · POI/家具/地板数据也由云端同步
// ═════════════════════════════════════════════════════════════
const CHAR_INIT = { col: 7, row: 14 };

export default function GridWorldSimulator() {
    const canvasRef = useRef(null), animRef = useRef(null);
    const isDragging = useRef(false), lastMouse = useRef({ x: 0, y: 0 });
    const charPosRef = useRef(CHAR_INIT);
    const charDirRef = useRef('down');

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [customFurn, setCustomFurn] = useState(() => migrateFurniture(getBuiltInFurniture()));
    const [customFloors, setCustomFloors] = useState(loadCustomFloors);
    const [charPos, setCharPos] = useState(CHAR_INIT);
    const [charStatus, setCharStatus] = useState('idle');
    const [charLabel, setCharLabel] = useState(null);

    // ── 同步 ref ──────────────────────────────────────────────
    useEffect(() => { charPosRef.current = charPos; }, [charPos]);

    // ── 监听 localStorage 变更 (兼容 MapEditor 本地编辑) ─────
    useEffect(() => {
        const onStorage = e => {
            if (e.key === POI_KEY || !e.key) setPois(loadPois());
            if (e.key === CUSTOM_FURN_KEY || !e.key) setCustomFurn(loadCustomFurn());
            if (e.key === CUSTOM_FLOOR_KEY || !e.key) setCustomFloors(loadCustomFloors());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // ═════════════════════════════════════════════════════════
    //  云端事件监听
    //  NanakoPetController 收到 WS 消息后，通过 window 事件转发
    // ═════════════════════════════════════════════════════════

    // 云端推送角色位置 (每步/状态变化时)
    useEffect(() => {
        const onCharPosition = (e) => {
            const d = e.detail;
            if (typeof d.col === 'number' && typeof d.row === 'number') {
                setCharPos({ col: d.col, row: d.row });
                charPosRef.current = { col: d.col, row: d.row };
            }
            if (d.dir) charDirRef.current = d.dir;
            if (d.status) setCharStatus(d.status);
            if (d.label !== undefined) setCharLabel(d.label);
        };
        window.addEventListener('nanako:char_position', onCharPosition);
        return () => window.removeEventListener('nanako:char_position', onCharPosition);
    }, []);

    // 云端推送完整地图快照 (连接/重连时)
    useEffect(() => {
        const onMapSync = (e) => {
            const d = e.detail;
            if (d.charPos) {
                setCharPos(d.charPos);
                charPosRef.current = d.charPos;
            }
            if (d.charDir) charDirRef.current = d.charDir;
            if (d.charStatus) setCharStatus(d.charStatus);
            if (d.charLabel !== undefined) setCharLabel(d.charLabel);
            if (d.pois) setPois(d.pois);
            if (d.customFurn) setCustomFurn(d.customFurn);
            if (d.customFloors) setCustomFloors(d.customFloors);
        };
        window.addEventListener('nanako:map_sync', onMapSync);
        return () => window.removeEventListener('nanako:map_sync', onMapSync);
    }, []);

    // 云端推送角色到达目的地
    useEffect(() => {
        const onArrived = (e) => {
            const d = e.detail;
            if (typeof d.col === 'number' && typeof d.row === 'number') {
                setCharPos({ col: d.col, row: d.row });
                charPosRef.current = { col: d.col, row: d.row };
            }
            setCharStatus('idle');
            setCharLabel(null);
        };
        window.addEventListener('nanako:char_arrived', onArrived);
        return () => window.removeEventListener('nanako:char_arrived', onArrived);
    }, []);

    // 兼容旧的 move_to 事件 (本地降级 / MapEditor 测试用)
    // 现在不做本地寻路，只转发给云端
    useEffect(() => {
        const onMoveTo = (e) => {
            // 转发给 NanakoPetController → 通过 WS 发给云端
            window.dispatchEvent(new CustomEvent('nanako:request_move', { detail: e.detail }));
        };
        window.addEventListener('nanako:move_to', onMoveTo);
        return () => window.removeEventListener('nanako:move_to', onMoveTo);
    }, []);

    // 查询位置 — 直接返回当前渲染的位置 (兼容旧接口)
    useEffect(() => {
        const respond = () => {
            const { col, row } = charPosRef.current;
            const currentPois = pois;
            let nearest = null, minDist = Infinity;
            currentPois.forEach(p => {
                const d = Math.abs(p.col - col) + Math.abs(p.row - row);
                if (d < minDist) { minDist = d; nearest = p; }
            });
            const detail = {
                col, row,
                location: nearest?.name || null,
                location_label: nearest?.label || null,
                distance_to_location: minDist,
            };
            window.dispatchEvent(new CustomEvent('nanako:position', { detail }));
        };
        window.addEventListener('nanako:query_pos', respond);
        window.nanakoGetPos = () => { respond(); return charPosRef.current; };
        return () => {
            window.removeEventListener('nanako:query_pos', respond);
            delete window.nanakoGetPos;
        };
    }, [pois]);

    // ── 渲染 ────────────────────────────────────────────────
    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        drawScene(cv.getContext('2d'), cv.width, cv.height, zoom, offset, pois,
            charPosRef.current.col, charPosRef.current.row, charStatus, charLabel, hovered, charDirRef.current, customFurn, customFloors);
    }, [zoom, offset, pois, charStatus, charLabel, hovered, customFurn, customFloors]);

    useEffect(() => {
        const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize(); const ro = new ResizeObserver(resize); ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    // ── 鼠标交互 ────────────────────────────────────────────
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
    };
    const onMouseDown = e => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseLeave = () => { isDragging.current = false; setHovered(null); };
    const onWheel = e => { e.preventDefault(); setZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? .1 : -.1))).toFixed(2))); };

    // 点击地图 → 发给云端移动 (不再本地寻路)
    const onClick = e => {
        if (!isDragging.current) {
            const rc = getRC(e);
            if (rc) {
                window.dispatchEvent(new CustomEvent('nanako:request_move', {
                    detail: { target: [rc.col, rc.row] }
                }));
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">🗺️ NANAKO WORLD MAP</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{COLS}×{ROWS} · 云端同步模式 · 点击移动</p>
                </div>
                <div className="flex items-center gap-2">
                    {[['＋', .2], ['－', -.2]].map(([l, d]) => (
                        <button key={l} onClick={() => setZoom(z => +(Math.max(0.3, Math.min(4, z + d)).toFixed(2)))}
                            className="w-9 h-9 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl font-bold text-lg hover:bg-slate-700 transition-colors">{l}</button>
                    ))}
                    <span className="text-slate-400 font-mono text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => { setZoom(0.65); setOffset({ x: 0, y: 0 }); }}
                        className="px-3 h-9 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">重置</button>
                </div>
            </div>
            <div className="w-full max-w-6xl mb-3 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-mono text-sm text-emerald-400">
                    {charStatus === 'moving' ? `🚶 前往 ${charLabel || '...'}`
                        : charStatus === 'blocked' ? '❌ 无法到达目标'
                            : hovered ? `[${hovered.col},${hovered.row}] · 点击移动 · 拖拽平移 · 滚轮缩放`
                                : '点击地图移动菜菜子 · 拖拽平移 · 滚轮缩放'}
                </span>
                <span className="ml-auto text-xs font-mono text-slate-500">
                    菜菜子 [{charPos.col},{charPos.row}]
                    {charStatus === 'moving' && <span className="text-emerald-500 ml-1">移动中...</span>}
                </span>
            </div>
            <div className="w-full max-w-6xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ height: 620 }}>
                <canvas ref={canvasRef} className="w-full h-full block"
                    style={{ cursor: isDragging.current ? 'grabbing' : 'pointer' }}
                    onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onClick={onClick} />
            </div>
            <p className="text-slate-700 text-[10px] mt-3">Pure canvas renderer · ☁️ 云端同步模式 · 48×28</p>
        </div>
    );
}
