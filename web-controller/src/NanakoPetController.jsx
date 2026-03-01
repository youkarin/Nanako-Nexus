import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 核心配置与工具包
// ==========================================
const DEFAULT_WS_URL = 'ws://127.0.0.1:8080/ws'; // 默认通信地址
const PIXEL_SHADOW = "4px 4px 0px 0px rgba(244, 114, 182, 0.4)"; // 粉色像素感阴影
const PRESS_DOWN_CLASS = "active:translate-y-1 active:translate-x-1 active:shadow-none transition-all";

const LOCAL_STORAGE_KEY = 'nanako_ws_config';

export default function NanakoPetController() {
  // === 状态管理 ===
  const [view, setView] = useState('config'); // 'config' | 'dashboard'
  const [wsConfig, setWsConfig] = useState({ url: '', token: '' });
  const [status, setStatus] = useState({ isConnected: false, error: null });

  // 宠物属性状态
  const [stats, setStats] = useState({
    hunger: 70,    // 饱食度
    affection: 50, // 好感度
    mood: 85,      // 心情值
  });

  // 日志流
  const [logs, setLogs] = useState(["[SYS] 等待连接中..."]);

  // WebSocket 引用
  const wsRef = useRef(null);

  // 初始化时尝试从 localStorage 读取历史配置
  useEffect(() => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedConfig) {
      try {
        setWsConfig(JSON.parse(savedConfig));
      } catch (err) {
        console.error("加载配置失败", err);
      }
    }
  }, []);

  // ==========================================
  // WebSocket 通讯逻辑
  // ==========================================
  const handleConnect = (e) => {
    e.preventDefault();
    if (!wsConfig.url) return;

    try {
      addLog(`[WS] 正在连接 ${wsConfig.url}...`);
      // 开启 WebSocket (实际使用中可在 URL 带上 token, 如 url?token=xxx)
      const ws = new WebSocket(`${wsConfig.url}?token=${wsConfig.token}`);

      ws.onopen = () => {
        setStatus({ isConnected: true, error: null });
        setView('dashboard');
        addLog("[WS] 连接成功✨");

        // 保存连接配置到本地浏览器
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wsConfig));
      };

      ws.onmessage = (event) => {
        try {
          // 接收来自服务器的 JSON 广播数据
          const data = JSON.parse(event.data);
          addLog(`[RECV] ${data.type}`);

          // 假设服务器会广播宠物属性更新事件
          if (data.type === 'SYNC_STATS' && data.payload) {
            setStats(prev => ({ ...prev, ...data.payload }));
          }
        } catch (err) {
          console.error("解析消息失败", err);
        }
      };

      ws.onclose = () => {
        setStatus({ isConnected: false, error: "连接已断开" });
        setView('config');
        addLog("[WS] 连接断开🥀");
      };

      ws.onerror = (err) => {
        setStatus({ isConnected: false, error: "连接发生错误" });
        addLog("[WS] 发生错误!");
      };

      wsRef.current = ws;
    } catch (err) {
      setStatus({ isConnected: false, error: "无法创建 WebSocket 实例" });
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
  };

  // 发送动作指令给服务器
  const sendAction = (actionType) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'TRIGGER_ACTION',
        timestamp: Date.now(),
        data: { action: actionType }
      };
      wsRef.current.send(JSON.stringify(payload));
      addLog(`[ACTION] 已发送：${actionType}`);

      // 前端表现层模拟：点击后直接给予简单的正向反馈（实际以服务端广播的 SYNC_STATS 为准）
      if (actionType === 'feed') setStats(s => ({ ...s, hunger: Math.min(100, s.hunger + 10) }));
      if (actionType === 'chat') setStats(s => ({ ...s, mood: Math.min(100, s.mood + 5) }));
    } else {
      addLog("[ERR] 离线状态无法发送");
    }
  };

  // 辅助函数：追加日志 (保留最新3条)
  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-2), msg]);
  };

  // ==========================================
  // UI 组件抽象
  // ==========================================

  // 像素风进度条组件
  const PixelProgressBar = ({ label, value, colorClass, icon }) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-bold text-pink-900 mb-1">
        <span>{icon} {label}</span>
        <span>{value}/100</span>
      </div>
      {/* 槽位背景 */}
      <div className="h-4 w-full bg-pink-100 border-2 border-pink-400 p-[2px] rounded-sm">
        {/* 实际进度条 */}
        <div
          className={`h-full ${colorClass} transition-all duration-500 ease-out`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );

  return (
    // 外层容器：深色背景，使掌机居中
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono select-none">

      {/* 🕹️ 移动端垂直比例掌机外壳 */}
      <div
        className="w-full max-w-[360px] aspect-[9/18] bg-pink-50 rounded-[40px] border-8 border-pink-300 relative flex flex-col overflow-hidden shadow-2xl"
        style={{ boxShadow: "10px 10px 0px 0px rgba(244,114,182,0.5), inset 0 0 20px rgba(255,192,203,0.5)" }}
      >

        {/* 顶部装饰条 */}
        <div className="h-6 bg-pink-300 w-full flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] text-pink-50 font-bold tracking-widest">NANAKO SYSTEM VER_2.0</span>
        </div>

        <div className="flex-1 p-5 flex flex-col justify-between">

          {view === 'config' ? (
            /* ==========================================
               🔌 页面 1: WebSocket 配置页
            ========================================== */
            <div className="flex-1 flex flex-col justify-center animate-fade-in">
              <div className="text-center mb-8">
                <div className="text-5xl mb-2">📡</div>
                <h1 className="text-2xl font-black text-pink-500 tracking-tighter" style={{ textShadow: "2px 2px 0px #fbcfe8" }}>
                  LINK START
                </h1>
                <p className="text-xs text-pink-400 mt-2">✨ 连接到次元服务器 ✨</p>
              </div>

              <form onSubmit={handleConnect} className="flex flex-col gap-4">
                <div className="bg-white border-4 border-pink-300 p-3 shadow-sm rounded-xl">
                  <label className="text-[10px] text-pink-400 font-bold block mb-1">SERVER ADDRESS</label>
                  <input
                    type="text"
                    value={wsConfig.url}
                    onChange={e => setWsConfig({ ...wsConfig, url: e.target.value })}
                    className="w-full outline-none text-sm text-pink-900 font-bold bg-transparent"
                    placeholder="ws://..."
                  />
                </div>

                <div className="bg-white border-4 border-pink-300 p-3 shadow-sm rounded-xl">
                  <label className="text-[10px] text-pink-400 font-bold block mb-1">SECRET TOKEN</label>
                  <input
                    type="password"
                    value={wsConfig.token}
                    onChange={e => setWsConfig({ ...wsConfig, token: e.target.value })}
                    className="w-full outline-none text-sm text-pink-900 font-bold bg-transparent"
                    placeholder="请输入授权码"
                  />
                </div>

                {status.error && (
                  <div className="text-xs text-red-500 bg-red-100 p-2 border-2 border-red-300 rounded text-center font-bold">
                    {status.error}
                  </div>
                )}

                <button
                  type="submit"
                  className={`mt-4 w-full bg-pink-400 text-white font-black py-4 border-b-4 border-r-4 border-pink-600 rounded-xl text-lg ${PRESS_DOWN_CLASS}`}
                >
                  CONNECT {'>'}
                </button>
              </form>
            </div>
          ) : (
            /* ==========================================
               💖 页面 2: 状态面板与交互主控区
            ========================================== */
            <div className="flex-1 flex flex-col h-full animate-fade-in relative z-10">

              {/* --- 屏幕区 (复古像素屏滤镜) --- */}
              <div className="bg-[#b4cca1] border-4 border-slate-700 rounded-lg p-3 shadow-inner relative overflow-hidden mb-6 h-40 flex flex-col justify-between">
                {/* 扫描线效果 */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />

                {/* 字符表情区 */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-slate-800 text-3xl font-black animate-bounce pb-4">
                    {stats.mood > 80 ? "(≧▽≦)" : stats.mood > 40 ? "(・∀・)" : "(T_T)"}
                  </div>
                </div>

                {/* 屏幕内的小终端输出 */}
                <div className="text-[10px] text-slate-700 font-bold border-t-2 border-slate-600/30 pt-1 h-8 overflow-hidden">
                  {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              </div>

              {/* --- 状态看板区 (Progress Bars) --- */}
              <div className="bg-white border-4 border-pink-300 p-4 rounded-2xl mb-6 relative">
                <button
                  onClick={disconnect}
                  className="absolute -top-3 -right-3 bg-red-400 text-white text-[10px] font-bold px-2 py-1 rounded border-2 border-red-600 active:translate-y-px"
                >
                  断开
                </button>

                <PixelProgressBar label="饱食度" value={stats.hunger} icon="🍙" colorClass="bg-amber-400" />
                <PixelProgressBar label="好感度" value={stats.affection} icon="💖" colorClass="bg-rose-400" />
                <PixelProgressBar label="心情值" value={stats.mood} icon="✨" colorClass="bg-sky-400" />
              </div>

              {/* --- 交互按钮九宫格 --- */}
              <div className="grid grid-cols-2 gap-4 mt-auto">
                <button onClick={() => sendAction('nod')} className={`bg-cyan-50 border-4 border-cyan-300 text-cyan-700 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-2xl">🙇‍♀️</span>
                  <span className="text-xs">点头</span>
                </button>
                <button onClick={() => sendAction('wave')} className={`bg-purple-50 border-4 border-purple-300 text-purple-700 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-2xl">👋</span>
                  <span className="text-xs">挥手</span>
                </button>
                <button onClick={() => sendAction('feed')} className={`bg-amber-50 border-4 border-amber-300 text-amber-700 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-2xl">🍰</span>
                  <span className="text-xs">喂食</span>
                </button>
                <button onClick={() => sendAction('chat')} className={`bg-rose-50 border-4 border-rose-300 text-rose-700 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-2xl">💬</span>
                  <span className="text-xs">聊天</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}
