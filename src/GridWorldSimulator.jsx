import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, POI_KEY, loadCustomFurn, CUSTOM_FURN_KEY, loadCustomFloors, CUSTOM_FLOOR_KEY, migrateFurniture, findLocation } from './mapUtils';
import { COLS, ROWS, CELL, drawScene, drawCharacter, getBuiltInFurniture, findPath } from './GridWorldRenderer';

// ═════════════════════════════════════════════════════════════
//  COMPONENT — 混合模式地图
//  · 支持本地寻路 + 云端推送（双模式自动切换）
//  · 支持多人联机：显示其他玩家角色 + 名字
//  · 点击地图 → 先本地走，同时请求云端
// ═════════════════════════════════════════════════════════════
const CHAR_INIT = { col: 7, row: 14 };
const STEP_MS = 150;

// 其他玩家的颜色池
const PLAYER_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#a855f7'];

export default function GridWorldSimulator() {
    const canvasRef = useRef(null), animRef = useRef(null);
    const isDragging = useRef(false), lastMouse = useRef({ x: 0, y: 0 });
    const charPosRef = useRef(CHAR_INIT);
    const charDirRef = useRef('down');
    const charPathRef = useRef([]);
    const stepTimerRef = useRef(null);

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [customFurn, setCustomFurn] = useState(() => migrateFurniture(getBuiltInFurniture()));
    const [customFloors, setCustomFloors] = useState(loadCustomFloors);
    const [charPos, setCharPos] = useState(CHAR_INIT);
    const [charStatus, setCharStatus] = useState('idle');
    const [charLabel, setCharLabel] = useState(null);

    // ── 多人联机：其他玩家 ─────────────────────────────────
    // otherPlayers: Map<id, { col, row, dir, status, name, color }>
    const [otherPlayers, setOtherPlayers] = useState(new Map());
    const otherPlayersRef = useRef(new Map());
    useEffect(() => { otherPlayersRef.current = otherPlayers; }, [otherPlayers]);

    // ── 云端模式标记 ──────────────────────────────────────
    const cloudModeRef = useRef(false);

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
    //  本地行走引擎（fallback，云端无 MapEngine 时使用）
    // ═════════════════════════════════════════════════════════
    const calcDir = (oc, or, nc, nr) => {
        const dc = nc - oc, dr = nr - or;
        if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 'right' : 'left';
        if (dr !== 0) return dr > 0 ? 'down' : 'up';
        return 'down';
    };

    const startLocalWalk = useCallback((path, label) => {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        charPathRef.current = path.slice(1); // 去掉起点
        setCharStatus('moving');
        setCharLabel(label || null);

        stepTimerRef.current = setInterval(() => {
            if (!charPathRef.current.length) {
                clearInterval(stepTimerRef.current);
                stepTimerRef.current = null;
                setCharStatus('idle');
                const arrivedLabel = charLabel;
                setCharLabel(null);
                // 通知到达
                window.dispatchEvent(new CustomEvent('nanako:position', {
                    detail: { ...charPosRef.current, arrived: true, label: arrivedLabel }
                }));
                return;
            }
            const [nc, nr] = charPathRef.current.shift();
            const { col: oc, row: or } = charPosRef.current;
            charDirRef.current = calcDir(oc, or, nc, nr);
            const newPos = { col: nc, row: nr };
            charPosRef.current = newPos;
            setCharPos(newPos);
        }, STEP_MS);
    }, []);

    const handleMoveTo = useCallback((detail) => {
        let ec, er, label;
        if (detail.location) {
            const poi = findLocation(detail.location, pois);
            if (!poi) return;
            ec = poi.col; er = poi.row; label = poi.label;
        } else if (detail.target) {
            [ec, er] = detail.target;
            label = `(${ec},${er})`;
        } else return;

        const { col: sc, row: sr } = charPosRef.current;
        const path = findPath(sc, sr, ec, er);
        if (!path) {
            setCharStatus('blocked');
            setTimeout(() => setCharStatus('idle'), 1500);
            return;
        }
        startLocalWalk(path, label);
    }, [pois, startLocalWalk]);

    // ═════════════════════════════════════════════════════════
    //  云端事件监听
    // ═════════════════════════════════════════════════════════

    // 云端推送角色位置 (每步/状态变化时) → 覆盖本地
    useEffect(() => {
        const onCharPosition = (e) => {
            const d = e.detail;
            cloudModeRef.current = true; // 一旦收到云端推送，切换到云端模式
            // 停止本地步进
            if (stepTimerRef.current) { clearInterval(stepTimerRef.current); stepTimerRef.current = null; }
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
            cloudModeRef.current = true;
            if (d.charPos) { setCharPos(d.charPos); charPosRef.current = d.charPos; }
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

    // 云端推送角色到达
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

    // ═════════════════════════════════════════════════════════
    //  多人联机：其他玩家位置更新
    // ═════════════════════════════════════════════════════════
    useEffect(() => {
        // 单个玩家更新
        const onPlayerUpdate = (e) => {
            const d = e.detail;
            if (!d.id) return;
            setOtherPlayers(prev => {
                const next = new Map(prev);
                const existing = next.get(d.id) || {};
                next.set(d.id, {
                    col: d.col ?? existing.col ?? 0,
                    row: d.row ?? existing.row ?? 0,
                    dir: d.dir || existing.dir || 'down',
                    status: d.status || existing.status || 'idle',
                    name: d.name || existing.name || d.id,
                    color: existing.color || PLAYER_COLORS[next.size % PLAYER_COLORS.length],
                });
                return next;
            });
        };

        // 玩家离开
        const onPlayerLeave = (e) => {
            const id = e.detail?.id;
            if (!id) return;
            setOtherPlayers(prev => {
                const next = new Map(prev);
                next.delete(id);
                return next;
            });
        };

        // 批量玩家同步（连接时）
        const onPlayerSync = (e) => {
            const players = e.detail?.players;
            if (!Array.isArray(players)) return;
            const next = new Map();
            players.forEach((p, i) => {
                next.set(p.id, {
                    col: p.col ?? 0,
                    row: p.row ?? 0,
                    dir: p.dir || 'down',
                    status: p.status || 'idle',
                    name: p.name || p.id,
                    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                });
            });
            setOtherPlayers(next);
        };

        window.addEventListener('nanako:player_update', onPlayerUpdate);
        window.addEventListener('nanako:player_leave', onPlayerLeave);
        window.addEventListener('nanako:player_sync', onPlayerSync);
        return () => {
            window.removeEventListener('nanako:player_update', onPlayerUpdate);
            window.removeEventListener('nanako:player_leave', onPlayerLeave);
            window.removeEventListener('nanako:player_sync', onPlayerSync);
        };
    }, []);

    // ── 处理 move_to 事件（来自 AI 服务端的移动指令）──────
    useEffect(() => {
        const onMoveTo = (e) => {
            // 如果云端模式，转发给云端并让 MapEngine 处理
            if (cloudModeRef.current) {
                window.dispatchEvent(new CustomEvent('nanako:request_move', { detail: e.detail }));
            } else {
                // 本地 fallback：直接走
                handleMoveTo(e.detail);
            }
        };
        window.addEventListener('nanako:move_to', onMoveTo);
        return () => window.removeEventListener('nanako:move_to', onMoveTo);
    }, [handleMoveTo]);

    // 查询位置
    useEffect(() => {
        const respond = () => {
            const { col, row } = charPosRef.current;
            let nearest = null, minDist = Infinity;
            pois.forEach(p => {
                const d = Math.abs(p.col - col) + Math.abs(p.row - row);
                if (d < minDist) { minDist = d; nearest = p; }
            });
            window.dispatchEvent(new CustomEvent('nanako:position', {
                detail: { col, row, location: nearest?.name || null, location_label: nearest?.label || null, distance_to_location: minDist }
            }));
        };
        window.addEventListener('nanako:query_pos', respond);
        window.nanakoGetPos = () => { respond(); return charPosRef.current; };
        return () => { window.removeEventListener('nanako:query_pos', respond); delete window.nanakoGetPos; };
    }, [pois]);

    // ── 渲染（含多人）─────────────────────────────────────
    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');
        drawScene(ctx, cv.width, cv.height, zoom, offset, pois,
            charPosRef.current.col, charPosRef.current.row, charStatus, charLabel, hovered, charDirRef.current, customFurn, customFloors);

        // ── 绘制其他玩家 ──
        const cs = CELL * zoom, ox = offset.x, oy = offset.y;
        otherPlayersRef.current.forEach((player) => {
            const px = Math.round(ox + player.col * cs);
            const py = Math.round(oy + player.row * cs);
            if (px + cs < -cs || py + cs < -cs || px > cv.width + cs || py > cv.height + cs) return;

            // 画角色（半透明以区分）
            ctx.globalAlpha = 0.85;
            drawCharacter(ctx, px, py, cs, player.status, player.dir);
            ctx.globalAlpha = 1;

            // 名字标签
            const fs = Math.max(8, Math.min(11, zoom * 10));
            ctx.font = `bold ${fs}px sans-serif`;
            ctx.textBaseline = 'bottom';
            const nameText = player.name;
            const tw = ctx.measureText(nameText).width + 8;
            const bh = fs + 6;
            const bx = px + cs / 2 - tw / 2;
            const by = py - 2;
            // 背景
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath(); ctx.roundRect(bx - 1, by - bh - 1, tw + 2, bh + 2, 4); ctx.fill();
            ctx.fillStyle = player.color;
            ctx.beginPath(); ctx.roundRect(bx, by - bh, tw, bh, 4); ctx.fill();
            // 文字
            ctx.fillStyle = '#fff';
            ctx.fillText(nameText, bx + 4, by - 2);
        });
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

    // 清理步进定时器
    useEffect(() => {
        return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
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

    // 点击地图移动
    const onClick = e => {
        if (!isDragging.current) {
            const rc = getRC(e);
            if (rc) {
                const target = [rc.col, rc.row];
                // 总是先发云端请求
                window.dispatchEvent(new CustomEvent('nanako:request_move', { detail: { target } }));
                // 如果不是云端模式，同时做本地行走
                if (!cloudModeRef.current) {
                    handleMoveTo({ target });
                }
            }
        }
    };

    const playerCount = otherPlayers.size;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">🗺️ NANAKO WORLD MAP</h1>
                    <p className="text-slate-500 text-xs mt-0.5">
                        {COLS}×{ROWS} · {cloudModeRef.current ? '☁️ 云端模式' : '💻 本地模式'} · 点击移动
                        {playerCount > 0 && <span className="text-cyan-400 ml-2">👥 {playerCount} 位玩家在线</span>}
                    </p>
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
            {/* 在线玩家列表 */}
            {playerCount > 0 && (
                <div className="w-full max-w-6xl mt-3 flex flex-wrap gap-2">
                    {[...otherPlayers.entries()].map(([id, p]) => (
                        <div key={id} className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                            <span className="text-xs font-bold text-slate-300">{p.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">[{p.col},{p.row}]</span>
                            {p.status === 'moving' && <span className="text-[10px] text-emerald-400">🚶</span>}
                        </div>
                    ))}
                </div>
            )}
            <p className="text-slate-700 text-[10px] mt-3">Pure canvas renderer · 混合模式 · 48×28</p>
        </div>
    );
}
