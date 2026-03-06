import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 核心配置与工具包
// ==========================================
const DEFAULT_WS_URL = 'ws://127.0.0.1:8080/ws';
const PIXEL_SHADOW = "4px 4px 0px 0px rgba(244, 114, 182, 0.4)";
const PRESS_DOWN_CLASS = "active:translate-y-1 active:translate-x-1 active:shadow-none transition-all";
const LOCAL_STORAGE_KEY = 'nanako_ws_config';

export default function NanakoPetController() {
  // === 状态管理 ===
  const [view, setView] = useState('config'); // 'config' | 'dashboard'
  const [tab, setTab] = useState('status');   // 'status' | 'shop' | 'bag'
  const [wsConfig, setWsConfig] = useState({ url: '', token: '' });
  const [status, setStatus] = useState({ isConnected: false, error: null });

  // 宠物属性状态 — 字段名与服务端 status_sync 完全一致
  const [stats, setStats] = useState({
    // 核心生理
    hunger: 0, thirst: 0, energy: 0, stamina: 0,
    // 进阶指标
    blood_sugar: 0, dopamine: 0, stress: 0,
    // 八维情绪 (0-10)
    happiness: 0, calm: 0, excited: 0, low: 0,
    nervous: 0, irritated: 0, sour: 0, angry: 0,
    // 长期养成 & 经济
    intimacy: 0, money: 0,
    // 决策
    attitude: '未知',
    last_updated: null,
  });

  // 商城货架 (shop_sync)
  const [shopItems, setShopItems] = useState([]);
  // 背包库存 (key: itemId -> quantity)
  const [bagItems, setBagItems] = useState({});

  // 聊天对话记录 (至多10条)
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // 终端日志
  const [logs, setLogs] = useState(["[SYS] 等待连接中..."]);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  // ── 云端模式：监听地图事件 ──────────────────────────────
  useEffect(() => {
    // GridWorldSimulator 点击地图时发出 nanako:request_move → 转发给云端
    const onRequestMove = e => {
      const d = e.detail;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (d.location) {
          wsRef.current.send(JSON.stringify({ type: 'move_to', location: d.location }));
          addLog(`[MAP] 请求移动 → ${d.location}`);
        } else if (d.target) {
          wsRef.current.send(JSON.stringify({ type: 'move_to', target: d.target }));
          addLog(`[MAP] 请求移动 → [${d.target}]`);
        }
      } else {
        addLog('[MAP] ⚠️ 未连接，无法移动');
      }
    };
    // 兼容旧接口：position 回传给 AI
    const onPosition = e => {
      const d = e.detail;
      addLog(`[MAP] 📍 坐标 [${d.col},${d.row}] 最近地点: ${d.location_label || '未知'}`);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'position',
          col: d.col, row: d.row,
          location: d.location,
          location_label: d.location_label,
          distance_to_location: d.distance_to_location,
        }));
      }
    };
    // MapEditor 保存数据 → 转发给云端
    const onSavePois = e => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'save_pois', pois: e.detail }));
        addLog('[MAP] ☁️ POI 数据已上传云端');
      }
    };
    const onSaveFurn = e => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'save_furn', furn: e.detail }));
        addLog('[MAP] ☁️ 家具数据已上传云端');
      }
    };
    const onSaveFloors = e => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'save_floors', floors: e.detail }));
        addLog('[MAP] ☁️ 地板数据已上传云端');
      }
    };
    window.addEventListener('nanako:request_move', onRequestMove);
    window.addEventListener('nanako:position', onPosition);
    window.addEventListener('nanako:save_pois', onSavePois);
    window.addEventListener('nanako:save_furn', onSaveFurn);
    window.addEventListener('nanako:save_floors', onSaveFloors);
    return () => {
      window.removeEventListener('nanako:request_move', onRequestMove);
      window.removeEventListener('nanako:position', onPosition);
      window.removeEventListener('nanako:save_pois', onSavePois);
      window.removeEventListener('nanako:save_furn', onSaveFurn);
      window.removeEventListener('nanako:save_floors', onSaveFloors);
    };
  }, []);

  // 初始化时尝试从 localStorage 读取历史配置
  useEffect(() => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedConfig) {
      try { setWsConfig(JSON.parse(savedConfig)); } catch { }
    }
  }, []);

  // 自动滚到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==========================================
  // WebSocket 通讯逻辑
  // ==========================================
  const handleConnect = (e) => {
    e.preventDefault();
    if (!wsConfig.url) return;

    try {
      addLog(`[WS] 正在连接 ${wsConfig.url}...`);
      const ws = new WebSocket(`${wsConfig.url}?token=${wsConfig.token}`);

      ws.onopen = () => {
        setStatus({ isConnected: true, error: null });
        setView('dashboard');
        addLog("[WS] 连接成功✨");
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wsConfig));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status_sync' && msg.data) {
            setStats(prev => ({ ...prev, ...msg.data }));
            addLog("[SYS] 状态已同步");
          }
          else if (msg.type === 'shop_sync' && Array.isArray(msg.data)) {
            setShopItems(msg.data);
            const bagSnapshot = {};
            msg.data.forEach(item => { bagSnapshot[item.itemId] = item.quantity; });
            setBagItems(bagSnapshot);
            addLog("[SHOP] 货架数据已同步");
          }
          else if (msg.type === 'text') {
            addMessage('nanako', msg.text);
          }
          else if (msg.type === 'status') {
            addLog(`[STATUS] ${msg.message}`);
          }
          // ── 云端地图引擎消息 ─────────────────────────────
          else if (msg.type === 'char_position') {
            // 云端 MapEngine 推送的角色坐标 (每步 / 状态变化)
            window.dispatchEvent(new CustomEvent('nanako:char_position', { detail: msg }));
          }
          else if (msg.type === 'char_arrived') {
            // 云端通知角色已到达
            window.dispatchEvent(new CustomEvent('nanako:char_arrived', { detail: msg }));
            addLog(`[MAP] ✅ 到达 ${msg.label || `[${msg.col},${msg.row}]`}`);
          }
          else if (msg.type === 'map_sync') {
            // 云端推送完整地图快照 (首次连接 / 重连)
            window.dispatchEvent(new CustomEvent('nanako:map_sync', { detail: msg }));
            addLog('[MAP] ☁️ 地图数据已云端同步');
          }
          else if (msg.type === 'move_result') {
            // 云端移动请求的结果反馈
            if (msg.success) {
              addLog(`[MAP] 🚶 ${msg.message} (${msg.path_length} 步)`);
            } else {
              addLog(`[MAP] ❌ ${msg.message}`);
            }
          }
          // ── 兼容旧消息 (降级) ────────────────────────────
          else if (msg.type === 'move_to') {
            window.dispatchEvent(new CustomEvent('nanako:move_to', { detail: msg }));
            addLog(`[MAP] 导航 → ${msg.location || JSON.stringify(msg.target)}`);
          }
          else if (msg.type === 'query_pos') {
            window.dispatchEvent(new CustomEvent('nanako:query_pos'));
            addLog('[MAP] 查询坐标...');
          }
          else {
            addLog(`[RECV] ${msg.type}`);
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

      ws.onerror = () => {
        setStatus({ isConnected: false, error: "连接发生错误" });
        addLog("[WS] 发生错误!");
      };

      wsRef.current = ws;
    } catch {
      setStatus({ isConnected: false, error: "无法创建 WebSocket 实例" });
    }
  };

  const disconnect = () => { wsRef.current?.close(); };

  // 通用发送封装
  const wsSend = (type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    addLog("[ERR] 离线状态无法发送");
    return false;
  };

  // 互动指令 (interaction)
  const sendInteraction = (area) => {
    wsSend('interaction', { area });
    addLog(`[ACTION] interaction:${area}`);
  };

  // 强制刷新数据 (request_sync)
  const sendRequestSync = () => {
    if (wsSend('request_sync')) addLog("[SYS] 已请求数据刷新");
  };

  // 购买商品 (buy_item)
  const buyItem = (itemId, itemName) => {
    if (wsSend('buy_item', { itemId })) addLog(`[SHOP] 购买 ${itemName}`);
  };

  // 使用物品 (use_item)
  const useItem = (itemId, itemName) => {
    if (wsSend('use_item', { itemId })) addLog(`[BAG] 使用 ${itemName}`);
  };

  // 赚钱 (increment_clicks)
  const sendClicks = (clicks) => {
    if (wsSend('increment_clicks', { clicks })) addLog(`[EARN] +${clicks} clicks`);
  };

  // 发送聊天 (chat)
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (wsSend('chat', { text: chatInput })) {
      addMessage('user', chatInput);
      setChatInput('');
    }
  };

  const addMessage = (sender, text) => {
    setMessages(prev => [...prev, { id: Date.now(), sender, text }].slice(-10));
  };

  const addLog = (msg) => {
    setLogs(prev => [...prev.slice(-2), msg]);
  };

  // ==========================================
  // UI 配置映射
  // ==========================================
  const PHYSIOLOGY_KEYS = ['hunger', 'thirst', 'energy', 'stamina', 'blood_sugar', 'dopamine', 'stress'];
  const EMOTION_KEYS = ['happiness', 'calm', 'excited', 'low', 'nervous', 'irritated', 'sour', 'angry'];

  const STATS_UI_MAP = {
    hunger: { label: '饥饿值', icon: '🍙', colorClass: 'bg-amber-400', max: 100 },
    thirst: { label: '口渴值', icon: '💧', colorClass: 'bg-blue-400', max: 100 },
    energy: { label: '精力', icon: '⚡', colorClass: 'bg-yellow-400', max: 100 },
    stamina: { label: '体力', icon: '💪', colorClass: 'bg-orange-500', max: 100 },
    blood_sugar: { label: '血糖', icon: '🍬', colorClass: 'bg-pink-300', max: 100 },
    dopamine: { label: '多巴胺', icon: '🎵', colorClass: 'bg-rose-400', max: 100 },
    stress: { label: '压力', icon: '💢', colorClass: 'bg-purple-600', max: 100 },
    happiness: { label: '开心', icon: '😄', colorClass: 'bg-emerald-400', max: 10 },
    calm: { label: '平静', icon: '😌', colorClass: 'bg-slate-400', max: 10 },
    excited: { label: '兴奋', icon: '🤩', colorClass: 'bg-yellow-500', max: 10 },
    low: { label: '低落', icon: '😔', colorClass: 'bg-blue-300', max: 10 },
    nervous: { label: '紧张', icon: '😰', colorClass: 'bg-indigo-400', max: 10 },
    irritated: { label: '烦躁', icon: '😫', colorClass: 'bg-orange-600', max: 10 },
    sour: { label: '心酸', icon: '🥺', colorClass: 'bg-teal-600', max: 10 },
    angry: { label: '生气', icon: '😡', colorClass: 'bg-red-500', max: 10 },
  };

  const getStatUI = (key) => STATS_UI_MAP[key] || { label: key, icon: '📊', colorClass: 'bg-pink-400', max: 100 };

  // 进度条组件
  const PixelProgressBar = ({ label, value, colorClass, icon, max = 100 }) => (
    <div className="mb-1">
      <div className="flex justify-between text-[9px] font-bold text-slate-800 mb-[1px]">
        <span>{icon} {label}</span>
        <span>{typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}</span>
      </div>
      <div className="h-2 w-full bg-white border border-slate-300 p-[1px] rounded-sm">
        <div
          className={`h-full ${colorClass} transition-all duration-500 ease-out`}
          style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
    </div>
  );

  // 态度图标
  const attitudeIcon = () => {
    const a = stats.attitude;
    if (a === '生气') return '💢';
    if (a === '烦躁') return '😤';
    if (a === '亲近' || a === '撒娇') return '💕';
    if (a === '小心') return '👀';
    if (a === '疏远') return '❄️';
    if (a === '酸') return '😒';
    return '💭';
  };

  // 背包物品（库存 > 0 才显示）
  const bagHasItems = shopItems.some(item => (bagItems[item.itemId] || 0) > 0);

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-2 font-mono select-none">
      <div
        className="w-full max-w-[400px] h-[92vh] max-h-[900px] min-h-[660px] bg-pink-50 rounded-[40px] border-8 border-pink-300 relative flex flex-col overflow-hidden shadow-2xl"
        style={{ boxShadow: "10px 10px 0px 0px rgba(244,114,182,0.5), inset 0 0 20px rgba(255,192,203,0.5)" }}
      >
        {/* 顶部装饰条 */}
        <div className="h-6 bg-pink-300 w-full flex items-center justify-center gap-2 shrink-0">
          <div className={`w-2 h-2 rounded-full ${status.isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[10px] text-pink-50 font-bold tracking-widest">NANAKO SYSTEM VER_2.1</span>
        </div>

        <div className="flex-1 p-4 flex flex-col min-h-0">

          {view === 'config' ? (
            /* ============================================================
               🔌 页面1: WebSocket 配置页
            ============================================================ */
            <div className="flex-1 flex flex-col justify-center animate-fade-in">
              <div className="text-center mb-8">
                <div className="text-5xl mb-2">📡</div>
                <h1 className="text-2xl font-black text-pink-500 tracking-tighter" style={{ textShadow: "2px 2px 0px #fbcfe8" }}>
                  LINK START
                </h1>
                <p className="text-xs text-pink-400 mt-2">✨ 连接到次元服务器 ✨</p>
              </div>

              <form onSubmit={handleConnect} className="flex flex-col gap-4">
                <div className="bg-white border-4 border-pink-300 p-3 rounded-xl">
                  <label className="text-[10px] text-pink-400 font-bold block mb-1">SERVER ADDRESS</label>
                  <input
                    type="text"
                    value={wsConfig.url}
                    onChange={e => setWsConfig({ ...wsConfig, url: e.target.value })}
                    className="w-full outline-none text-sm text-pink-900 font-bold bg-transparent"
                    placeholder="ws://..."
                  />
                </div>

                <div className="bg-white border-4 border-pink-300 p-3 rounded-xl">
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
            /* ============================================================
               💖 页面2: 主控面板
            ============================================================ */
            <div className="flex-1 flex flex-col min-h-0 animate-fade-in">

              {/* 对话屏幕 */}
              <div className="bg-[#b4cca1] border-4 border-slate-700 rounded-lg p-2 mb-2 h-20 shrink-0 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 relative" style={{ scrollbarWidth: 'none' }}>
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center opacity-50 text-[10px] font-bold text-slate-800">
                      (≧▽≦) 等待通讯...
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`text-[10px] font-bold ${m.sender === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={m.sender === 'user'
                          ? 'bg-slate-700 text-white px-2 py-0.5 rounded-l-lg rounded-tr-lg inline-block'
                          : 'bg-white px-2 py-0.5 rounded-r-lg rounded-tl-lg inline-block border-2 border-slate-700'}>
                          {m.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="text-[9px] text-slate-700 font-bold border-t border-slate-600/30 pt-0.5 h-4 overflow-hidden relative">
                  {logs[logs.length - 1]}
                </div>
              </div>

              {/* Tab 导航 */}
              <div className="flex gap-1 mb-2 shrink-0">
                {[
                  { id: 'status', label: '📊 状态' },
                  { id: 'shop', label: '🛒 商城' },
                  { id: 'bag', label: `🎒 背包${bagHasItems ? '●' : ''}` },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 text-[10px] font-black py-1 rounded-lg border-2 transition-all ${tab === t.id
                      ? 'bg-pink-400 text-white border-pink-600'
                      : 'bg-white text-pink-400 border-pink-200'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 内容区 */}
              <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'none' }}>

                {/* ===== 状态 Tab ===== */}
                {tab === 'status' && (
                  <div className="bg-white border-4 border-pink-300 p-2 rounded-2xl">
                    {/* 断开 & 刷新 */}
                    <div className="flex gap-1 mb-2">
                      <button onClick={sendRequestSync} className="flex-1 bg-sky-400 text-white text-[9px] font-black px-2 py-1 rounded border-2 border-sky-600 active:translate-y-px">
                        🔄 刷新数据
                      </button>
                      <button onClick={disconnect} className="flex-1 bg-red-400 text-white text-[9px] font-black px-2 py-1 rounded border-2 border-red-600 active:translate-y-px">
                        断开连接
                      </button>
                    </div>

                    {/* 态度 & 好感度 & 金钱 */}
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <div className="col-span-1 bg-pink-50 p-2 rounded-lg border-2 border-pink-200 flex flex-col items-center">
                        <span className="text-xl">{attitudeIcon()}</span>
                        <div className="text-[9px] text-pink-400 font-bold">当前态度</div>
                        <div className="text-[11px] text-pink-600 font-black">{stats.attitude || '未知'}</div>
                      </div>
                      <div className="bg-rose-50 p-2 rounded-lg border-2 border-rose-200 flex flex-col items-center justify-center">
                        <span className="text-lg">💖</span>
                        <div className="text-[9px] text-rose-400 font-bold">好感度</div>
                        <div className="text-[12px] text-rose-600 font-black">{stats.intimacy}</div>
                      </div>
                      <div className="bg-yellow-50 p-2 rounded-lg border-2 border-yellow-200 flex flex-col items-center justify-center">
                        <span className="text-lg">💰</span>
                        <div className="text-[9px] text-yellow-600 font-bold">金钱</div>
                        <div className="text-[12px] text-yellow-700 font-black">{typeof stats.money === 'number' ? stats.money.toFixed(3) : '0'}</div>
                      </div>
                    </div>

                    {/* 生理指标 */}
                    <div className="mb-2">
                      <div className="text-[10px] bg-pink-300 text-white inline-block px-2 py-0.5 rounded-t-lg font-bold mb-0.5">
                        ✚ 生理指标
                      </div>
                      <div className="bg-pink-50/50 p-2 border-2 border-pink-200 rounded-b-lg rounded-tr-lg grid grid-cols-2 gap-x-3">
                        {PHYSIOLOGY_KEYS.map(k => {
                          const ui = getStatUI(k);
                          return <PixelProgressBar key={k} label={ui.label} value={stats[k] ?? 0} icon={ui.icon} colorClass={ui.colorClass} max={ui.max} />;
                        })}
                      </div>
                    </div>

                    {/* 情绪维度 */}
                    <div className="mb-2">
                      <div className="text-[10px] bg-indigo-300 text-white inline-block px-2 py-0.5 rounded-t-lg font-bold mb-0.5">
                        ❤ 情绪维度 (0-10)
                      </div>
                      <div className="bg-indigo-50/50 p-2 border-2 border-indigo-200 rounded-b-lg rounded-tr-lg grid grid-cols-2 gap-x-3">
                        {EMOTION_KEYS.map(k => {
                          const ui = getStatUI(k);
                          return <PixelProgressBar key={k} label={ui.label} value={stats[k] ?? 0} icon={ui.icon} colorClass={ui.colorClass} max={ui.max} />;
                        })}
                      </div>
                    </div>

                    {/* 赚钱快捷键 */}
                    <div>
                      <div className="text-[10px] bg-yellow-300 text-white inline-block px-2 py-0.5 rounded-t-lg font-bold mb-0.5">
                        💸 快速赚钱
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-yellow-50/50 p-2 border-2 border-yellow-200 rounded-b-lg rounded-tr-lg">
                        {[10, 50, 100].map(n => (
                          <button
                            key={n}
                            onClick={() => sendClicks(n)}
                            className={`bg-yellow-300 border-2 border-yellow-500 text-yellow-800 font-black text-[10px] py-1 rounded ${PRESS_DOWN_CLASS}`}
                          >
                            +{n} clicks
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== 商城 Tab ===== */}
                {tab === 'shop' && (
                  <div className="bg-white border-4 border-amber-300 p-2 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[11px] font-black text-amber-600">🛒 菜菜子商城</div>
                      <div className="text-[10px] text-yellow-700 font-bold bg-yellow-100 px-2 py-0.5 rounded border border-yellow-300">
                        💰 {typeof stats.money === 'number' ? stats.money.toFixed(3) : '0'}
                      </div>
                    </div>

                    {shopItems.length === 0 ? (
                      <div className="text-center text-[10px] text-slate-400 py-8">
                        暂无商品，等待服务器同步...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {shopItems.map(item => (
                          <div
                            key={item.itemId}
                            className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-xl p-2"
                          >
                            <span className="text-2xl shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-black text-slate-800 truncate">{item.name}</div>
                              <div className="text-[9px] text-slate-500">{item.effect}</div>
                              <div className="text-[9px] text-amber-600 font-bold">库存: {item.quantity}</div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <div className="text-[10px] font-black text-yellow-700 text-center">💰{item.price}</div>
                              <button
                                onClick={() => buyItem(item.itemId, item.name)}
                                className={`bg-amber-400 text-white text-[9px] font-black px-3 py-1 rounded border-2 border-amber-600 ${PRESS_DOWN_CLASS} whitespace-nowrap`}
                              >
                                购买
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ===== 背包 Tab ===== */}
                {tab === 'bag' && (
                  <div className="bg-white border-4 border-green-300 p-2 rounded-2xl">
                    <div className="text-[11px] font-black text-green-600 mb-2">🎒 物品背包</div>

                    {!bagHasItems ? (
                      <div className="text-center text-[10px] text-slate-400 py-8">
                        背包空空的，去商城购买物品吧～
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {shopItems.filter(item => (bagItems[item.itemId] || 0) > 0).map(item => (
                          <div
                            key={item.itemId}
                            className="flex items-center gap-2 bg-green-50 border-2 border-green-200 rounded-xl p-2"
                          >
                            <span className="text-2xl shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-black text-slate-800 truncate">{item.name}</div>
                              <div className="text-[9px] text-slate-500">{item.effect}</div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0 items-center">
                              <div className="text-[11px] font-black text-green-700">x{bagItems[item.itemId]}</div>
                              <button
                                onClick={() => useItem(item.itemId, item.name)}
                                className={`bg-green-400 text-white text-[9px] font-black px-3 py-1 rounded border-2 border-green-600 ${PRESS_DOWN_CLASS} whitespace-nowrap`}
                              >
                                使用
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 互动按钮 */}
              <div className="grid grid-cols-3 gap-2 mt-2 shrink-0">
                <button onClick={() => sendInteraction('Head')} className={`bg-cyan-50 border-4 border-cyan-300 text-cyan-700 py-2 rounded-xl font-bold flex flex-col items-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">🙇‍♀️</span>
                  <span className="text-[10px]">摸头</span>
                </button>
                <button onClick={() => sendInteraction('Body')} className={`bg-purple-50 border-4 border-purple-300 text-purple-700 py-2 rounded-xl font-bold flex flex-col items-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">🤗</span>
                  <span className="text-[10px]">拥抱</span>
                </button>
                <button onClick={() => sendInteraction('Hand')} className={`bg-amber-50 border-4 border-amber-300 text-amber-700 py-2 rounded-xl font-bold flex flex-col items-center gap-1 ${PRESS_DOWN_CLASS}`}>
                  <span className="text-xl">👋</span>
                  <span className="text-[10px]">招手</span>
                </button>
              </div>

              {/* 聊天输入框 */}
              <form onSubmit={sendChat} className="mt-2 flex gap-2 shrink-0">
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
