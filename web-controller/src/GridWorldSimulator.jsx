import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, POI_KEY, findLocation, loadCustomFurn, CUSTOM_FURN_KEY, loadCustomFloors, CUSTOM_FLOOR_KEY, migrateFurniture } from './mapUtils';
import { COLS, ROWS, CELL, drawScene, findPath, WALK_GRID, getBuiltInFurniture } from './GridWorldRenderer';

// ═════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════
const CHAR_INIT = { col: 7, row: 14 };
const STEP_MS = 150;

export default function GridWorldSimulator() {
    const canvasRef = useRef(null), animRef = useRef(null);
    const isDragging = useRef(false), lastMouse = useRef({ x: 0, y: 0 });
    const charPosRef = useRef(CHAR_INIT), stepTimerRef = useRef(null);
    const charDirRef = useRef('down');

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [customFurn, setCustomFurn] = useState(() => migrateFurniture(getBuiltInFurniture()));
    const [customFloors, setCustomFloors] = useState(loadCustomFloors);
    const [charPos, setCharPos] = useState(CHAR_INIT);
    const [charPath, setCharPath] = useState([]);
    const [charStatus, setCharStatus] = useState('idle');
    const [charLabel, setCharLabel] = useState(null);

    useEffect(() => { charPosRef.current = charPos; }, [charPos]);

    useEffect(() => {
        const onStorage = e => {
            if (e.key === POI_KEY || !e.key) setPois(loadPois());
            if (e.key === CUSTOM_FURN_KEY || !e.key) setCustomFurn(loadCustomFurn());
            if (e.key === CUSTOM_FLOOR_KEY || !e.key) setCustomFloors(loadCustomFloors());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Step engine
    useEffect(() => {
        if (!charPath.length) return;
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        stepTimerRef.current = setInterval(() => {
            setCharPath(prev => {
                if (!prev.length) { clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null); return prev; }
                const [nc, nr] = prev[0];
                const { col: oc, row: or } = charPosRef.current;
                const dc = nc - oc, dr = nr - or;
                if (Math.abs(dc) > Math.abs(dr)) charDirRef.current = dc > 0 ? 'right' : 'left';
                else if (dr !== 0) charDirRef.current = dr > 0 ? 'down' : 'up';
                setCharPos({ col: nc, row: nr }); charPosRef.current = { col: nc, row: nr };
                const rest = prev.slice(1);
                if (!rest.length) {
                    clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null);
                    window.dispatchEvent(new CustomEvent('nanako:arrived', { detail: { pos: [nc, nr] } }));
                }
                return rest;
            });
        }, STEP_MS);
        return () => clearInterval(stepTimerRef.current);
    }, [charPath]);

    const handleMoveTo = useCallback((detail) => {
        let ec, er, label;
        if (detail.location) {
            const poi = findLocation(detail.location, pois);
            if (!poi) { window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'unknown_location' } })); return; }
            ec = poi.col; er = poi.row; label = poi.label;
        } else if (Array.isArray(detail.target)) {
            [ec, er] = detail.target; label = `(${ec},${er})`;
        } else return;
        const { col: sc, row: sr } = charPosRef.current;
        const path = findPath(sc, sr, ec, er);
        if (!path) {
            setCharStatus('blocked');
            window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'no_path' } }));
            setTimeout(() => setCharStatus('idle'), 1500); return;
        }
        const steps = path.slice(1); if (!steps.length) return;
        setCharLabel(label); setCharStatus('moving'); setCharPath(steps);
        window.dispatchEvent(new CustomEvent('nanako:moving', { detail: { target: [ec, er], label, path_length: steps.length } }));
    }, [pois]);

    useEffect(() => {
        const h = e => handleMoveTo(e.detail);
        window.addEventListener('nanako:move_to', h);
        return () => window.removeEventListener('nanako:move_to', h);
    }, [handleMoveTo]);

    useEffect(() => {
        const respond = () => {
            const { col, row } = charPosRef.current;
            const currentPois = loadPois();
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
    }, []);

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
    const onClick = e => { if (!isDragging.current) { const rc = getRC(e); if (rc) handleMoveTo({ target: [rc.col, rc.row] }); } };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">🗺️ NANAKO WORLD MAP</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{COLS}×{ROWS} · 精装修版 · 点击移动</p>
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
                    菜菜子 [{charPos.col},{charPos.row}]{charPath.length > 0 && <span className="text-emerald-500 ml-1">→{charPath.length}格</span>}
                </span>
            </div>
            <div className="w-full max-w-6xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ height: 620 }}>
                <canvas ref={canvasRef} className="w-full h-full block"
                    style={{ cursor: isDragging.current ? 'grabbing' : 'pointer' }}
                    onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onClick={onClick} />
            </div>
            <p className="text-slate-700 text-[10px] mt-3">Pure canvas renderer · 精装修版 · 48×28</p>
        </div>
    );
}
