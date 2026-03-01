import React, { useState } from 'react';

// === 世界配置 ===
const GRID_SIZE = 24; // 定义一个 24x24 的更密集网格世界

// === 数据层：实体定义 ===
// x,y 表示起始坐标(1开始)，w,h 表示占地宽高(所占格子数)
const mapEntities = [
    // --- 🏠 家的房间边界 (只做背景衬托) ---
    { id: 'bedroom', name: '卧室', type: 'room', icon: '', x: 2, y: 2, w: 8, h: 8, style: 'bg-indigo-900/40 border-indigo-500/30 text-indigo-300' },
    { id: 'living', name: '客厅', type: 'room', icon: '', x: 10, y: 2, w: 12, h: 8, style: 'bg-sky-900/40 border-sky-500/30 text-sky-300' },
    { id: 'kitchen', name: '厨房', type: 'room', icon: '', x: 2, y: 10, w: 8, h: 6, style: 'bg-orange-900/40 border-orange-500/30 text-orange-300' },
    { id: 'dining', name: '餐厅', type: 'room', icon: '', x: 10, y: 10, w: 12, h: 6, style: 'bg-rose-900/40 border-rose-500/30 text-rose-300' },

    // --- 🛋️ 室内家具 (Placed inside the rooms) ---
    // 卧室内部
    { id: 'bed', name: '大床', type: 'furniture', icon: '🛏️', x: 3, y: 3, w: 3, h: 4, style: 'bg-indigo-400/80 border-indigo-300 text-white shadow-lg' },
    { id: 'wardrobe', name: '衣柜', type: 'furniture', icon: '🚪', x: 7, y: 3, w: 2, h: 2, style: 'bg-indigo-600/80 border-indigo-400 text-white shadow-lg' },

    // 客厅内部
    { id: 'tv', name: '电视机', type: 'furniture', icon: '📺', x: 15, y: 3, w: 3, h: 1, style: 'bg-sky-700/80 border-sky-400 text-white shadow-lg' },
    { id: 'sofa', name: '大沙发', type: 'furniture', icon: '🛋️', x: 14, y: 6, w: 5, h: 2, style: 'bg-sky-500/80 border-sky-300 text-white shadow-lg' },
    { id: 'plant', name: '绿植', type: 'furniture', icon: '🪴', x: 11, y: 3, w: 2, h: 2, style: 'bg-emerald-600/80 border-emerald-400 text-white shadow-lg' },

    // 厨房与餐厅内部
    { id: 'stove', name: '炉灶', type: 'furniture', icon: '🍳', x: 3, y: 11, w: 3, h: 2, style: 'bg-orange-600/80 border-orange-400 text-white shadow-lg' },
    { id: 'fridge', name: '冰箱', type: 'furniture', icon: '🧊', x: 7, y: 11, w: 2, h: 2, style: 'bg-slate-400/80 border-slate-300 text-white shadow-lg' },
    { id: 'dtable', name: '餐桌', type: 'furniture', icon: '🍽️', x: 13, y: 12, w: 4, h: 3, style: 'bg-rose-500/80 border-rose-300 text-white shadow-lg' },

    // --- 🏙️ 街道与公共设施 (City Zone) 扩大坐标适应 24x24 ---
    { id: 'mall', name: '商场', type: 'city', icon: '🛍️', x: 14, y: 18, w: 8, h: 5, style: 'bg-purple-500/20 border-purple-400/50 text-purple-300 shadow-purple-500/20' },
    { id: 'park', name: '公园', type: 'city', icon: '🌳', x: 2, y: 18, w: 6, h: 5, style: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-emerald-500/20' },
    { id: 'gym', name: '健身房', type: 'city', icon: '💪', x: 9, y: 18, w: 4, h: 5, style: 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-amber-500/20' },
];

export default function GridWorldSimulator() {
    const [hoveredEntity, setHoveredEntity] = useState(null);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 pt-24 font-sans">
            {/* ===== 面板主容器 ===== */}
            <div className="w-full max-w-5xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col">

                {/* 顶部状态栏 */}
                <div className="bg-slate-800/50 p-6 flex items-center justify-between border-b border-slate-800 backdrop-blur-md">
                    <div>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wider">
                            NANAKO WORLD ENGINE
                        </h1>
                        <p className="text-slate-400 text-sm mt-1 font-medium">网格坐标系渲染测试・引子</p>
                    </div>
                    <div className="text-right">
                        <div className="text-emerald-400 font-mono bg-slate-950/80 px-5 py-2.5 rounded-xl border border-emerald-500/30 flex items-center gap-3 shadow-inner">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            {hoveredEntity
                                ? `[坐标] x:${hoveredEntity.x}, y:${hoveredEntity.y} | 聚焦区域: ${hoveredEntity.name}`
                                : '雷达扫描中: 未指向区域...'}
                        </div>
                    </div>
                </div>

                {/* ===== 核心网格视图 ===== */}
                <div className="p-6 md:p-10 flex justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
                    <div
                        className="relative w-full aspect-square max-w-4xl bg-slate-950/50 border border-slate-700/50 shadow-2xl rounded-sm overflow-hidden"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
                        }}
                    >
                        {/* 1. 底层：绘制空网格线与坐标号 */}
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                            const x = (i % GRID_SIZE) + 1;
                            const y = Math.floor(i / GRID_SIZE) + 1;
                            return (
                                <div
                                    key={`cell-${i}`}
                                    className="border-[0.5px] border-slate-800/40 flex items-center justify-center transition-colors duration-300 hover:bg-slate-800/80"
                                    style={{ gridColumn: x, gridRow: y }}
                                >
                                    <span className="text-[9px] text-slate-700/50 font-mono select-none">
                                        {x},{y}
                                    </span>
                                </div>
                            );
                        })}

                        {/* 2. 表层：绘制建筑物实体叠加 */}
                        {mapEntities.map((entity) => (
                            <div
                                key={entity.id}
                                onMouseEnter={() => setHoveredEntity(entity)}
                                onMouseLeave={() => setHoveredEntity(null)}
                                className={`
                  relative flex flex-col items-center justify-center
                  border backdrop-blur-xl rounded-xl cursor-default
                  transition-all duration-500 ease-out z-10 hover:z-20
                  hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl hover:brightness-125
                  ${entity.style}
                `}
                                style={{
                                    gridColumn: `${entity.x} / span ${entity.w}`,
                                    gridRow: `${entity.y} / span ${entity.h}`,
                                    margin: entity.type === 'room' ? '1px' : '4px' // 房间的内距小一点，家具内距大一点有缝隙
                                }}
                            >
                                <span className={`${entity.type === 'furniture' ? 'text-xl' : 'text-2xl'} mb-1 drop-shadow-lg`}>{entity.icon}</span>
                                <span className={`font-bold tracking-widest ${entity.type === 'furniture' ? 'text-[9px]' : 'text-sm'}`}>{entity.name}</span>

                                {/* 装饰性占地面积提示 */}
                                {entity.type !== 'room' && (
                                    <div className="absolute top-1 left-1 text-[8px] font-mono opacity-40">
                                        {entity.w}x{entity.h}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
