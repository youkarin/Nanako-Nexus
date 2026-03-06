# 🤖 Nanako Nexus — AI 接口文档

> **目标读者：AI 角色 (Nanako) 的服务端引擎**
> 通过 WebSocket 与本前端通信，即可控制地图上的角色移动、查询状态、执行地点交互。

---

## 连接信息

```
WebSocket URL: ws://127.0.0.1:8080/ws  (默认值，可在控制器 UI 设置)
协议: JSON over WebSocket
```

---

## 📡 消息格式

所有消息均为 JSON，必须包含 `type` 字段。

---

## 🗺️ 地图相关接口

### 1. 移动到命名地点

**服务端 → 前端**
```json
{ "type": "move_to", "location": "咖啡厅" }
```

**可用地点名称（默认，可在地图编辑器中增改）：**

| 名称 | 别名 | 描述 |
|------|------|------|
| `菜菜子的家` | 家 / 回家 / 我家 | 角色住所，可睡觉/整理/放松 |
| `浴室` | 厨房 / 洗澡 | 浴室和厨房，可洗澡/做饭/喝水 |
| `公园` | 散步 | 街心公园，可散步/休息/看书 |
| `商场` | 购物 | 百货商场，可购物/买食物 |
| `市政厅` | — | 办理手续/咨询 |
| `咖啡厅` | 咖啡 | 购买咖啡/休息/聊天 |
| `市集` | 集市 | 购买稀有商品/售卖 |

### 2. 移动到坐标

**服务端 → 前端**
```json
{ "type": "move_to", "target": [32, 21] }
```

地图尺寸：**48 列 × 28 行**，坐标原点 `[0, 0]` 在左上角。

### 3. 查询当前位置

**服务端 → 前端（发起查询）**
```json
{ "type": "query_pos" }
```

**前端 → 服务端（响应，自动推送）**
```json
{
  "type": "position",
  "col": 32,
  "row": 21,
  "location": "咖啡厅",
  "location_label": "☕ 咖啡厅",
  "distance_to_location": 0
}
```

> `distance_to_location` 为当前格到最近地点的曼哈顿距离，0 表示恰好在该地点。

---

## 📣 前端主动推送（无需请求）

### 到达目的地
```json
{ "type": "arrived", "pos": [32, 21] }
```
> ⚠️ 目前此消息通过 `nanako:arrived` 事件广播，尚未走 WebSocket 回传。如需请联系开发者加上。

### 移动开始
```json
{
  "type": "moving",
  "target": [32, 21],
  "label": "☕ 咖啡厅",
  "path_length": 12
}
```

---

## 💬 聊天 / 状态接口

### 发送文字回复（AI → 用户聊天框）

```json
{ "type": "text", "text": "我现在在咖啡厅，喝着拿铁~☕" }
```

### 同步状态数据

```json
{
  "type": "status_sync",
  "data": {
    "energy": 75,
    "health": 90,
    "mood": 80,
    "hunger": 45,
    "thirst": 30,
    "fatigue": 20,
    "intimacy": 65
  }
}
```

### 同步货架

```json
{
  "type": "shop_sync",
  "data": [
    { "itemId": "coffee", "name": "拿铁", "price": 5, "quantity": 10 }
  ]
}
```

### 状态日志（显示在终端面板）

```json
{ "type": "status", "message": "已完成任务：买咖啡" }
```

---

## 🔄 前端 → 服务端（用户操作）

| type | 触发条件 | 关键字段 |
|------|----------|----------|
| `chat` | 用户输入聊天 | `text: "你在哪"` |
| `request_sync` | 用户点"刷新"按钮 | — |
| `interaction` | 用户点互动按钮 | `area: "咖啡厅"` |
| `buy_item` | 用户购买商品 | `itemId`, `itemName` |
| `use_item` | 用户使用物品 | `itemId`, `itemName` |
| `increment_clicks` | 用户赚钱 | `clicks: 5` |

---

## 💡 典型对话场景示例

### 场景：用户问"你在哪里"

```
用户 → AI:  "你在哪里？"

AI 服务端:
  1. 收到 chat 消息 text="你在哪里？"
  2. 发送: { "type": "query_pos" }
  3. 收到: { "type": "position", "location": "咖啡厅", "col": 32, "row": 21 }
  4. 发送: { "type": "text", "text": "我在☕ 咖啡厅，正坐着喝咖啡~" }
```

### 场景：AI 决定去公园

```
AI 服务端:
  1. 发送: { "type": "move_to", "location": "公园" }
  2. 角色开始走路（路径约 15 步）
  3. 等待: { "type": "position", ... }  (或监听 arrived 事件)
  4. 到达后可执行互动
```

### 场景：AI 告知去哪里

```
AI: { "type": "text", "text": "我要去公园散步了🌿" }
AI: { "type": "move_to", "location": "公园" }
```

---

## 🌐 地图坐标参考

```
地图: 48列 × 28行

关键行:
  Row 2       顶部人行道
  Row 3-13    住宅区 (菜菜子的家 | 浴室&厨房)
  Row 14      中部人行道（角色初始位置在此）
  Row 15      主干道
  Row 16      南侧人行道
  Row 17-24   商业区 + 公园
  Row 26      底部道路

重要门口坐标（walkable 入口）:
  家门口:     [7,  14]  ← 角色初始位置
  浴室入口:   [24, 13]
  商场入口:   [15, 17]
  市政厅入口: [24, 17]
  咖啡厅入口: [32, 17]
  市集入口:   [40, 17]
```

---

## 🧪 浏览器控制台快速测试

```js
// 查询当前位置
window.nanakoGetPos()

// 移动到咖啡厅
window.dispatchEvent(new CustomEvent('nanako:move_to', {
  detail: { location: '咖啡厅' }
}))

// 移动到坐标
window.dispatchEvent(new CustomEvent('nanako:move_to', {
  detail: { target: [5, 20] }
}))

// 监听到达事件
window.addEventListener('nanako:position', e => console.log(e.detail))
window.dispatchEvent(new CustomEvent('nanako:query_pos'))
```

---

## 📁 关键文件

| 文件 | 作用 |
|------|------|
| `src/GridWorldSimulator.jsx` | 地图渲染、角色移动、寻路引擎、事件监听 |
| `src/NanakoPetController.jsx` | WebSocket 通信、消息转发 |
| `src/mapUtils.js` | BFS 寻路算法、POI 数据、localStorage 管理 |
| `src/MapEditor.jsx` | 可视化地图 + POI 编辑器 |

---

*最后更新：2026-03-05 · Map v2 (48×28)*
