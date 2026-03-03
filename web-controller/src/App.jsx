import React, { useState } from 'react'
import NanakoPetController from './NanakoPetController'
import GridWorldSimulator from './GridWorldSimulator'
import MapEditor from './MapEditor'

function App() {
  const [activeTab, setActiveTab] = useState('controller'); // 'controller' | 'map' | 'editor'

  const tabs = [
    { id: 'controller', label: '🎮 掌机控制器 (Controller)', activeColor: 'bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.4)]' },
    { id: 'map', label: '🗺️ 世界地图引子 (Grid Map)', activeColor: 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' },
    { id: 'editor', label: '🖌️ 地图编辑器 (Map Editor)', activeColor: 'bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)]' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      {/* 顶部导航 */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-3 flex justify-center gap-3 shadow-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-xl font-bold transition-all duration-300 text-sm ${activeTab === tab.id
                ? `${tab.activeColor} text-white scale-105`
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 主体 */}
      <main className="flex-1 w-full h-full">
        {activeTab === 'controller' && <NanakoPetController />}
        {activeTab === 'map' && <GridWorldSimulator />}
        {activeTab === 'editor' && <MapEditor />}
      </main>
    </div>
  );
}

export default App
