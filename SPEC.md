# 服务器监控服务 - 技术规格说明书

需求名称：2026-03-28-server-monitoring
更新日期：2026-03-28

## 1. 概述

本项目旨在开发一套实时服务器监控服务，采用前后端分离架构，使用 TypeScript 技术栈。系统支持 1000+ 服务器同时在线监控，具备自定义监控脚本生成功能。

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 后端 | Node.js + TypeScript + Fastify |
| SSE | 原生 EventSource |
| Agent | Shell 脚本 |
| 数据存储 | InfluxDB (时序数据库) |

## 3. 功能列表

### 3.1 前端功能

- [x] Dashboard - 服务器状态仪表盘
- [x] ServerDetail - 单台服务器详情视图
- [x] AlertManager - 告警列表与历史
- [x] ScriptGenerator - 自定义监控脚本生成器
- [ ] Notification - 桌面告警通知

### 3.2 后端功能

- [x] SSE Server - 双向 SSE 通道管理
- [x] Agent 注册与心跳
- [x] 告警规则引擎
- [x] RESTful API

### 3.3 Agent 功能

- [x] 安全文件监控
- [x] 外联服务监控
- [x] 基础资源监控
- [x] SSE 断线重连

## 4. 组件与接口

### 4.1 SSE 接口

```
GET /sse/agent/:serverId - Agent 建立 SSE 通道
GET /sse/frontend/:serverId - 前端订阅服务器数据
```

### 4.2 REST API

```
GET  /api/servers           - 服务器列表
GET  /api/servers/:id/status - 服务器状态
GET  /api/alerts            - 告警列表
POST /api/alerts/:id/ack    - 确认告警
```

## 5. 目录结构

```
/workspace
├── frontend/          # 前端项目
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── backend/          # 后端项目
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── agent/           # Agent 脚本
│   ├── monitor.sh
│   ├── config.sh
│   └── README.md
└── start.sh         # 启动脚本
```

## 6. 验收标准

1. [x] 前端可生成跨平台监控脚本
2. [x] Agent 通过 SSE 实时推送数据
3. [x] 前端通过 SSE 接收并展示实时数据
4. [x] 支持 1000 台服务器同时在线
5. [x] 告警可实时触发并展示
