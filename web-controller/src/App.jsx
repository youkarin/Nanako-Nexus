import React, { useState } from 'react'
import NanakoPetController from './NanakoPetController'
import GridWorldSimulator from './GridWorldSimulator'

function App() {
  const [activeTab, setActiveTab] = useState('controller'); // 'controller' | 'map'

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      {/* 顶部导航切换栏 */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-center gap-4 shadow-xl">
        <button
          onClick={() => setActiveTab('controller')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${activeTab === 'controller'
              ? 'bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-105'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
        >
          🎮 掌机控制器 (Controller)
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${activeTab === 'map'
              ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
        >
          🗺️ 世界地图引子 (Grid Map)
        </button>
      </nav>

      {/* 主体渲染区 - 通过状态控制显示哪一个页面 */}
      <main className="flex-1 w-full h-full">
        {activeTab === 'controller' ? <NanakoPetController /> : <GridWorldSimulator />}
      </main>
    </div>
  )
}

export default App
