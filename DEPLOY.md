# 项目部署指南

## 项目结构

```
server-monitor/
├── frontend/      # 前端 (React + Vite)
├── backend/       # 后端 (Node.js + Fastify)
├── agent/        # Agent 监控脚本
├── start.sh      # 一键启动脚本
└── SPEC.md       # 技术规格
```

## 环境要求

### 后端环境

| 项目 | 要求 |
|------|------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| 端口 | 3001 (可配置) |
| 内存 | >= 512MB |
| 磁盘 | >= 1GB |

### 前端环境

| 项目 | 要求 |
|------|------|
| Node.js | >= 18.x (开发) |
| npm | >= 9.x |
| 浏览器 | Chrome/Firefox/Safari/Edge 最新版 |
| 端口 | 5173 (开发) / 80 (生产) |

### Agent 环境

| 平台 | Shell | 依赖 |
|------|-------|------|
| Linux | bash/sh | md5sum/sha256sum, ss 或 netstat |
| 银河麒麟 | bash | 同 Linux |
| Windows | Git Bash / WSL | md5sum, ss/netstat |
| macOS | bash/zsh | md5, ss 或 netstat |

### Agent 系统命令

Agent 需要以下系统命令（大多数系统默认已安装）：

```bash
# 必需
bash/sh       # shell 解释器
md5sum/md5    # 文件哈希
date          # 时间戳

# 网络连接监控 (二选一)
ss            # 推荐
netstat       # 备选

# 资源监控 (可选，部分系统可用)
top           # CPU 使用率
free          # 内存
df            # 磁盘
/proc/stat    # Linux CPU 信息
/proc/meminfo # Linux 内存信息
```

## 一、本地开发部署

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 配置后端

```bash
cd backend
cp .env.example .env  # 如有需要
```

### 3. 启动服务

```bash
# 方式一：使用一键启动脚本
chmod +x ../start.sh
../start.sh

# 方式二：分别启动
# 终端1: 启动后端
cd backend && npm run dev

# 终端2: 启动前端
cd frontend && npm run dev
```

### 4. 访问服务

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

---

## 二、生产环境部署

### 后端部署

```bash
cd backend

# 安装依赖
npm install --production

# 构建
npm run build

# 启动
npm start
```

### 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建产物在 `frontend/dist/`，可部署到 Nginx/Apache。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/server-monitor/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 代理
    location /sse {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Accept 'text/event-stream';
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header Connection 'keep-alive';
        proxy_read_timeout 86400;
    }
}
```

---

## 三、Agent 部署

### 1. 下载 Agent 脚本

```bash
curl -sSL https://your-server/agent/monitor.sh -o monitor.sh
curl -sSL https://your-server/agent/config.sh -o config.sh
chmod +x monitor.sh
```

### 2. 配置 Agent

编辑 `config.sh`:

```bash
SERVER_URL="https://your-server"
SERVER_ID="server-001"
HEARTBEAT_INTERVAL=30
```

### 3. 启动 Agent

```bash
# 前台运行
./monitor.sh start

# 后台守护进程
./monitor.sh daemon
```

### 4. 开机自启 (Linux systemd)

```bash
sudo tee /etc/systemd/system/monitor-agent.service << 'EOF'
[Unit]
Description=Server Monitor Agent
After=network.target

[Service]
Type=simple
ExecStart=/path/to/monitor.sh daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable monitor-agent
sudo systemctl start monitor-agent
```

### 5. 银河麒麟/国产系统

同上 systemd 配置即可。

### 6. Windows (Git Bash)

```bash
# 使用 Git Bash 运行
./monitor.sh daemon
```

---

## 四、1000+ 服务器部署

### 1. 水平扩展后端

```bash
# 启动多个后端实例
PORT=3001 npm start &
PORT=3002 npm start &
PORT=3003 npm start &

# Nginx 负载均衡
upstream backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### 2. Redis 集群 (可选)

用于 SSE 多实例间数据同步：

```bash
# 安装 Redis
# 修改 backend/src/services/sse.ts 使用 Redis Pub/Sub
```

### 3. Agent 批量部署

使用 Ansible/Salt/Puppet 批量部署：

```bash
# Ansible 示例
ansible -i inventory all -m script -a "monitor.sh install"
```

---

## 五、Docker 部署 (可选)

### Dockerfile (后端)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

启动：
```bash
docker-compose up -d
```

---

## 六、验证部署

### 1. 检查后端

```bash
curl http://localhost:3001/api/servers
curl http://localhost:3001/api/alerts
```

### 2. 检查前端

访问 http://localhost:5173 查看仪表盘

### 3. 检查 Agent

```bash
./monitor.sh test
# 查看输出日志
tail -f /var/log/monitor-agent.log
```

---

## 七、常见问题

### 1. SSE 连接失败

- 检查防火墙是否开放端口
- 确认后端服务正常运行
- 检查 Nginx SSE 代理配置

### 2. Agent 无法连接

- 确认 SERVER_URL 配置正确
- 检查网络连通性
- 查看 Agent 日志

### 3. 前端无法加载数据

- 检查 CORS 配置
- 确认 API 地址配置正确
