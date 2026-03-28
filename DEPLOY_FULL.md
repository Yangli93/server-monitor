# 项目完整部署步骤

## 目录

1. [环境检查](#1-环境检查)
2. [后端部署](#2-后端部署)
3. [前端部署](#3-前端部署)
4. [InfluxDB 部署](#4-influxdb-部署)
5. [Agent 部署](#5-agent-部署)
6. [Nginx 反向代理配置](#6-nginx-反向代理配置)
7. [验证部署](#7-验证部署)

---

## 1. 环境检查

### 1.1 检查 Node.js 版本

```bash
node --version
# 要求 >= 18.x

npm --version
# 要求 >= 9.x
```

### 1.2 检查 Docker (可选)

```bash
docker --version
docker-compose --version
```

### 1.3 服务器配置

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核+ |
| 内存 | 1 GB | 2 GB+ |
| 磁盘 | 10 GB | 20 GB+ |
| 系统 | CentOS 7+ / Ubuntu 20+ / 银河麒麟 | 同 |

---

## 2. 后端部署

### 2.1 下载代码

```bash
cd /opt
git clone https://github.com/Yangli93/server-monitor.git
cd server-monitor/backend
```

### 2.2 安装依赖

```bash
npm install
```

### 2.3 配置环境变量

```bash
cat > .env << 'EOF'
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=your-influx-token
INFLUX_ORG=my-org
INFLUX_BUCKET=monitor
PORT=3001
EOF
```

### 2.4 启动后端服务

**开发模式**：
```bash
npm run dev
```

**生产模式**：
```bash
npm run build
npm start
```

### 2.5 使用 systemd 管理后端

```bash
sudo tee /etc/systemd/system/monitor-backend.service << 'EOF'
[Unit]
Description=Server Monitor Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/server-monitor/backend
ExecStart=/opt/server-monitor/backend/node_modules/.bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable monitor-backend
sudo systemctl start monitor-backend
sudo systemctl status monitor-backend
```

---

## 3. 前端部署

### 3.1 下载代码

```bash
cd /opt/server-monitor/frontend
```

### 3.2 安装依赖

```bash
npm install
```

### 3.3 配置 API 地址

编辑 `src/utils/api.ts`，将 `API_BASE` 改为实际后端地址：

```typescript
const API_BASE = 'http://your-domain.com';  // 或 http://localhost:3001 (开发)
```

### 3.4 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 3.5 部署到 Nginx

```bash
# 创建部署目录
sudo mkdir -p /var/www/monitor

# 复制构建产物
sudo cp -r dist/* /var/www/monitor/

# 设置权限
sudo chown -R www-data:www-data /var/www/monitor
```

---

## 4. InfluxDB 部署

### 4.1 Docker 部署 (推荐)

```bash
docker run -d \
  --name influxdb \
  -p 8086:8086 \
  -p 8083:8083 \
  -v influxdb-data:/var/lib/influxdb \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=adminpassword \
  -e DOCKER_INFLUXDB_INIT_ORG=my-org \
  -e DOCKER_INFLUXDB_INIT_BUCKET=monitor \
  -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=my-super-secret-token \
  influxdb:latest
```

### 4.2 验证 InfluxDB

```bash
curl - http://localhost:8086/health
```

### 4.3 配置后端环境变量

```bash
cat > /opt/server-monitor/backend/.env << 'EOF'
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=my-super-secret-token
INFLUX_ORG=my-org
INFLUX_BUCKET=monitor
PORT=3001
EOF
```

### 4.4 重启后端服务

```bash
sudo systemctl restart monitor-backend
```

---

## 5. Agent 部署

### 5.1 在每台被监控服务器上下载 Agent

```bash
cd /opt
sudo mkdir -p monitor-agent
cd monitor-agent

sudo curl -sSL https://your-server/agent/monitor.sh -o monitor.sh
sudo curl -sSL https://your-server/agent/config.sh -o config.sh

sudo chmod +x monitor.sh
```

### 5.2 配置 Agent

```bash
sudo vi config.sh
```

修改以下配置：

```bash
SERVER_URL="http://your-backend-server:3001"
SERVER_ID="server-001"  # 每个服务器唯一 ID
HEARTBEAT_INTERVAL=30
```

### 5.3 启动 Agent

**前台运行**：
```bash
sudo ./monitor.sh start
```

**后台守护进程**：
```bash
sudo ./monitor.sh daemon
```

### 5.4 开机自启

```bash
sudo tee /etc/systemd/system/monitor-agent.service << 'EOF'
[Unit]
Description=Server Monitor Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/monitor-agent/monitor.sh daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable monitor-agent
sudo systemctl start monitor-agent
```

### 5.5 银河麒麟/国产系统

同上 systemd 配置步骤。

### 5.6 Windows (Git Bash)

```bash
# 以管理员身份运行 Git Bash
cd /c/monitor-agent
./monitor.sh daemon
```

---

## 6. Nginx 反向代理配置

### 6.1 安装 Nginx

```bash
# CentOS
sudo yum install nginx -y

# Ubuntu/Debian
sudo apt update && sudo apt install nginx -y
```

### 6.2 配置 Nginx

```bash
sudo vi /etc/nginx/conf.d/monitor.conf
```

写入以下配置：

```nginx
# 后端 API 服务器
upstream backend {
    server 127.0.0.1:3001;
}

# 前端静态文件服务器
upstream frontend {
    server 127.0.0.1:5173;  # 开发环境
    # server 127.0.0.1:80;   # 生产环境静态文件
}

server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 前端静态文件
    root /var/www/monitor;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE Agent 连接
    location /sse/agent {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Accept 'text/event-stream';
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header Connection '';
        proxy_read_timeout 86400;
    }

    # SSE 前端订阅
    location /sse/frontend {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Accept 'text/event-stream';
        proxy_set_header Cache-Control 'no-cache';
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.3 测试并重启 Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6.4 配置 HTTPS (可选)

```bash
# 安装 Certbot
sudo yum install certbot python3-certbot-nginx -y  # CentOS
# 或
sudo apt install certbot python3-certbot-nginx -y  # Ubuntu

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

---

## 7. 验证部署

### 7.1 检查服务状态

```bash
# 检查后端
curl http://localhost:3001/api/servers
curl http://localhost:3001/api/alerts

# 检查 InfluxDB
curl http://localhost:8086/health

# 检查 Nginx
sudo systemctl status nginx

# 检查 Agent
sudo systemctl status monitor-agent
```

### 7.2 访问前端

打开浏览器访问：`http://your-domain.com` 或 `http://server-ip`

### 7.3 测试 Agent 数据上报

在 Agent 服务器上运行：

```bash
./monitor.sh test
```

查看日志：

```bash
tail -f /var/log/monitor-agent.log
```

### 7.4 检查 InfluxDB 数据

```bash
# 进入 InfluxDB 容器
docker exec -it influxdb influx

# 查询数据
use monitor
SELECT * FROM server_metrics LIMIT 10
SELECT * FROM alerts LIMIT 10
```

---

## 8. 防火墙配置

### 8.1 CentOS/RHEL

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=8086/tcp
sudo firewall-cmd --reload
```

### 8.2 Ubuntu/Debian

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 8086/tcp
```

---

## 9. 常见问题

### Q1: 后端无法连接 InfluxDB

```bash
# 检查 InfluxDB 是否运行
docker ps | grep influxdb

# 检查端口
curl http://localhost:8086/health

# 检查 Token
docker logs influxdb | grep token
```

### Q2: SSE 连接失败

```bash
# 检查 Nginx SSE 配置
# 确保 proxy_read_timeout 设置足够大 (86400)

# 检查防火墙
sudo firewall-cmd --list-ports
```

### Q3: Agent 无法连接后端

```bash
# 检查后端服务
curl http://localhost:3001/api/servers

# 检查 Agent 配置
cat /opt/monitor-agent/config.sh

# 检查网络连通性
curl http://your-backend-server:3001/api/servers
```

### Q4: 前端无法加载数据

```bash
# 检查浏览器控制台错误

# 检查 API 请求
curl -v http://your-domain.com/api/servers
```

---

## 10. 快速部署脚本

一键部署脚本（CentOS/Ubuntu）：

```bash
#!/bin/bash
set -e

echo "=== 服务器监控服务一键部署 ==="

# 安装依赖
echo "安装依赖..."
if command -v yum &> /dev/null; then
    yum install -y git nginx docker.io
    systemctl enable nginx docker
    systemctl start docker
elif command -v apt &> /dev/null; then
    apt update && apt install -y git nginx docker.io docker-compose
    systemctl enable nginx docker
    systemctl start docker
fi

# 克隆代码
echo "克隆代码..."
cd /opt
git clone https://github.com/Yangli93/server-monitor.git

# 启动 InfluxDB
echo "启动 InfluxDB..."
cd /opt/server-monitor
docker-compose up -d influxdb

# 部署后端
echo "部署后端..."
cd /opt/server-monitor/backend
npm install
npm run build
npm start &

# 部署前端
echo "部署前端..."
cd /opt/server-monitor/frontend
npm install
npm run build
sudo cp -r dist/* /var/www/monitor/

# 配置 Nginx
echo "配置 Nginx..."
sudo cp /opt/server-monitor/nginx.conf /etc/nginx/conf.d/monitor.conf
sudo nginx -t && sudo systemctl restart nginx

echo "=== 部署完成 ==="
echo "请访问 http://$(hostname -I | awk '{print $1}') 查看前端"
```
