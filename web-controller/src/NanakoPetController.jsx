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

  // 聊天对话记录 (至多10条)
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // 终端日志(系统级)保留3条
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
          const data = JSON.parse(event.data);

          if (data.type === 'status_sync' && data.data) {
            setStats(prev => ({ ...prev, ...data.data }));
            addLog("[SYS] 状态值已同步归档");
          }
          else if (data.type === 'text') {
            // 接收回复气泡
            addMessage('nanako', data.text);
          }
          else if (data.type === 'status') {
            // 状态同步 (简单日志)
            addLog(`[STATUS] ${data.message}`);
          }
          else {
            addLog(`[RECV] ${data.type}`);
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

  // 发送动作指令 ("interaction")
  const sendAction = (actionName, index = 0, area = 'Body') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'interaction',
        payload: {
          area: area,
          action: actionName,
          index: index,
          timestamp: Date.now()
        }
      };
      wsRef.current.send(JSON.stringify(payload));
      addLog(`[ACTION] ${actionName}`);

      // 前端表现层模拟：点击后给予本地反馈
      if (actionName === 'feed') setStats(s => ({ ...s, hunger: Math.min(100, s.hunger + 10) }));
    } else {
      addLog("[ERR] 离线状态无法发送");
    }
  };

  // 发送聊天指令 ("chat")
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'chat',
        payload: {
          text: chatInput,
          timestamp: Date.now()
        }
      };
      wsRef.current.send(JSON.stringify(payload));

      addMessage('user', chatInput);
      setChatInput('');
    } else {
      addLog("[ERR] 离线状态无法发送");
    }
  };

  // 添加聊天历史记录 (保留最新10条)
  const addMessage = (sender, text) => {
    setMessages(prev => {
      const newMessages = [...prev, { id: Date.now(), sender, text }];
      return newMessages.slice(-10);
    });
  };

  // 辅助函数：追加日志 (保留最新3条)
  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-2), msg]);
  };

  // ==========================================
  // UI 组件抽象 & 映射配置
  // ==========================================

  // 属性栏 UI 映射表：支持服务端发来新的字段自动适配
  const STATS_UI_MAP = {
    hunger: { label: '饱食度', icon: '🍙', colorClass: 'bg-amber-400' },
    affection: { label: '好感度', icon: '💖', colorClass: 'bg-rose-400' },
    mood: { label: '心情值', icon: '✨', colorClass: 'bg-sky-400' },
    energy: { label: '精力值', icon: '⚡', colorClass: 'bg-yellow-400' },
    clean: { label: '清洁度', icon: '🛁', colorClass: 'bg-blue-300' },
  };

  const getStatUI = (key) => STATS_UI_MAP[key] || { label: key, icon: '📊', colorClass: 'bg-pink-400' };

  // 像素风进度条组件
  const PixelProgressBar = ({ label, value, colorClass, icon }) => (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] font-bold text-pink-900 mb-[2px]">
        <span>{icon} {label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-3 w-full bg-pink-100 border-2 border-pink-400 p-[1.5px] rounded-sm">
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
                  className={`mt-4 w-full bg-pink-400 text-white font-black py-3 border-b-4 border-r-4 border-pink-600 rounded-xl text-lg ${PRESS_DOWN_CLASS}`}
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
              <div className="bg-[#b4cca1] border-4 border-slate-700 rounded-lg p-2 shadow-inner relative overflow-hidden mb-3 h-32 flex flex-col justify-between">
                {/* 扫描线效果 */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />

                {/* 对话气泡历史区 (取代了原来的大表情) */}
                <div className="flex-1 overflow-y-auto w-full text-[10px] font-bold text-slate-800 space-y-1 pr-1" style={{ scrollbarWidth: 'none' }}>
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-50">
                      (≧▽≦) 等待通讯...
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={m.sender === 'user' ? 'text-right' : 'text-left'}>
                        <span className={m.sender === 'user' ? 'bg-slate-700 text-white px-2 py-0.5 rounded-l-lg rounded-tr-lg inline-block' : 'bg-white px-2 py-0.5 rounded-r-lg rounded-tl-lg inline-block border-2 border-slate-700'}>
                          {m.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* 屏幕内的小终端输出 */}
                <div className="text-[9px] text-slate-700 font-bold border-t-2 border-slate-600/30 pt-1 mt-1 h-6 overflow-hidden">
                  {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              </div>

              {/* --- 状态看板区 (Progress Bars) --- */}
              <div className="bg-white border-4 border-pink-300 p-3 rounded-2xl mb-3 relative h-36 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={disconnect}
                  className="absolute top-1 right-2 bg-red-400 text-white text-[10px] font-bold px-2 py-1 rounded border-2 border-red-600 active:translate-y-px z-10"
                >
                  断开
                </button>

                {Object.entries(stats).map(([k, v]) => {
                  const ui = getStatUI(k);
                  return (
                    <PixelProgressBar
                      key={k}
                      label={ui.label}
                      value={v}
                      icon={ui.icon}
                      colorClass={ui.colorClass}
                    />
                  );
                })}
              </div>

              {/* --- 交互按钮九宫格 --- */}
              <div className="grid grid-cols-3 gap-2 mt-auto">
                <button onClick={() => sendAction('nod', 0, 'Head')} className={`bg-cyan-50 border-4 border-cyan-300 text-cyan-700 py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">🙇‍♀️</span>
                  <span className="text-[10px]">点头</span>
                </button>
                <button onClick={() => sendAction('wave', 1, 'Body')} className={`bg-purple-50 border-4 border-purple-300 text-purple-700 py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">👋</span>
                  <span className="text-[10px]">挥手</span>
                </button>
                <button onClick={() => sendAction('feed', 0, 'Body')} className={`bg-amber-50 border-4 border-amber-300 text-amber-700 py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">🍰</span>
                  <span className="text-[10px]">喂食</span>
                </button>
              </div>

              {/* --- 聊天输入框 --- */}
              <form onSubmit={sendChat} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="说点什么..."
                  className="flex-1 px-3 py-2 border-4 border-pink-300 rounded-xl text-sm outline-none text-pink-900 font-bold bg-white"
                />
                <button type="submit" className={`bg-rose-400 text-white border-b-4 border-r-4 border-rose-600 px-4 rounded-xl font-black ${PRESS_DOWN_CLASS}`}>
                  发送
                </button>
              </form>

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
