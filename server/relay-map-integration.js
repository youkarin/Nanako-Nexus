// ============================================================
//  relay-map-integration.js — Relay Server 集成示例 (ESM)
//
//  演示如何将 MapEngine 集成到你现有的 WebSocket Relay Server。
//  这不是独立运行的文件，而是展示需要添加到 relay server 的代码片段。
// ============================================================

import MapEngine from './nanako-map-engine.js';

// ─── 初始化地图引擎 ───────────────────────────────────────────
// 放在 relay server 启动时
const mapEngine = new MapEngine({
    dataDir: './map-data',     // 数据持久化目录
    stepMs: 150,               // 每步间隔 (ms)
    saveIntervalMs: 5000,      // 每5秒自动持久化一次
});

// ─── 监听地图引擎事件 → 推送给前端 ───────────────────────────
// 这些事件会在角色移动时自动触发

// 每走一步都推送（前端用于平滑动画）
mapEngine.on('step', (data) => {
    broadcastToFrontend({
        type: 'char_position',
        col: data.col,
        row: data.row,
        dir: data.dir,
        status: data.status,
        remaining: data.remaining,
    });
});

// 到达目的地
mapEngine.on('arrived', (data) => {
    broadcastToFrontend({
        type: 'char_arrived',
        col: data.col,
        row: data.row,
        label: data.label,
    });

    // 同时通知 AI 引擎
    sendToAI({
        type: 'arrived',
        col: data.col,
        row: data.row,
        label: data.label,
    });
});

// 路径被阻塞
mapEngine.on('blocked', (data) => {
    sendToAI({
        type: 'blocked',
        reason: data.reason,
        message: data.message,
    });
});

// 状态更新（idle/moving 切换时）
mapEngine.on('update', (data) => {
    broadcastToFrontend({
        type: 'char_position',
        ...data,
    });
});

// ─── 处理 AI 引擎发来的消息 ──────────────────────────────────
// 在你的 AI WebSocket onmessage 处理中添加：

export function handleAIMessage(msg) {
    switch (msg.type) {
        // ✅ AI 直接控制移动（不再需要转发给前端！）
        case 'move_to': {
            const result = mapEngine.moveTo({
                location: msg.location,
                target: msg.target,
            });
            // 回报结果给 AI
            sendToAI({
                type: 'move_result',
                success: result.success,
                message: result.message,
                path_length: result.path_length,
            });
            break;
        }

        // ✅ AI 查询位置（立即返回，不再需要 WebSocket 往返！）
        case 'query_pos': {
            const pos = mapEngine.getPosition();
            sendToAI({
                type: 'position',
                ...pos,
            });
            break;
        }

        // ✅ AI 停止移动
        case 'stop_move': {
            mapEngine.stop();
            sendToAI({ type: 'status', message: '已停止移动' });
            break;
        }

        // ✅ AI 传送
        case 'teleport': {
            mapEngine.teleport(msg.col, msg.row);
            sendToAI({ type: 'status', message: `已传送到 [${msg.col}, ${msg.row}]` });
            break;
        }

        // 其他消息类型照常处理（chat, status_sync, text 等）
        default:
            // ... 你原有的消息处理逻辑 ...
            break;
    }
}

// ─── 处理前端发来的消息 ──────────────────────────────────────
// 前端仍然可以通过 WebSocket 请求移动（比如用户在地图上点击）

export function handleFrontendMessage(msg) {
    switch (msg.type) {
        // 前端用户点击地图移动
        case 'map_click_move': {
            const result = mapEngine.moveTo({ target: msg.target });
            broadcastToFrontend({
                type: 'move_result',
                ...result,
            });
            break;
        }

        // 前端请求完整地图快照（首次连接或重连时）
        case 'request_map_sync': {
            const snapshot = mapEngine.getMapSnapshot();
            sendToClient(msg._clientId, {
                type: 'map_sync',
                ...snapshot,
            });
            break;
        }

        // 前端地图编辑器保存
        case 'save_pois': {
            mapEngine.setPois(msg.pois);
            broadcastToFrontend({ type: 'pois_updated', pois: msg.pois });
            break;
        }

        case 'save_furn': {
            mapEngine.setCustomFurn(msg.furn);
            broadcastToFrontend({ type: 'furn_updated', furn: msg.furn });
            break;
        }

        case 'save_floors': {
            mapEngine.setCustomFloors(msg.floors);
            broadcastToFrontend({ type: 'floors_updated', floors: msg.floors });
            break;
        }

        default:
            sendToAI(msg);
            break;
    }
}

// ─── 前端连接时发送初始状态 ──────────────────────────────────
export function onFrontendConnected(clientWs) {
    const snapshot = mapEngine.getMapSnapshot();
    clientWs.send(JSON.stringify({
        type: 'map_sync',
        ...snapshot,
    }));
}

// ─── HTTP API（可选，让 AI 不通过 WebSocket 也能操作）────────
// 如果你用 Express:
//
// import express from 'express';
// const app = express();
// app.use(express.json());
//
// app.get('/api/nanako/position', (req, res) => res.json(mapEngine.getPosition()));
// app.post('/api/nanako/move', (req, res) => res.json(mapEngine.moveTo(req.body)));
// app.post('/api/nanako/stop', (req, res) => { mapEngine.stop(); res.json({ success: true }); });
// app.post('/api/nanako/teleport', (req, res) => { mapEngine.teleport(req.body.col, req.body.row); res.json({ success: true }); });
// app.get('/api/nanako/map', (req, res) => res.json(mapEngine.getMapSnapshot()));
// app.get('/api/nanako/pois', (req, res) => res.json(mapEngine.getPois()));
// app.put('/api/nanako/pois', (req, res) => { mapEngine.setPois(req.body); res.json({ success: true }); });
// app.listen(8081, () => console.log('Map API listening on :8081'));

// ─── 辅助函数（占位，替换为你实际的实现）───────────────────
function broadcastToFrontend(msg) {
    // 遍历所有前端 WebSocket 连接，发送 JSON
    // frontendClients.forEach(ws => ws.send(JSON.stringify(msg)));
}

function sendToAI(msg) {
    // 发送给 AI 引擎的 WebSocket 连接
    // aiSocket.send(JSON.stringify(msg));
}

function sendToClient(clientId, msg) {
    // 发送给特定前端客户端
}

export { mapEngine };
