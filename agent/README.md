# 服务器监控代理

跨平台服务器监控代理，支持 Linux、银河麒麟、Windows (Git Bash)、macOS。

## 快速开始

### 1. 配置

编辑 `config.sh` 文件：

```bash
SERVER_URL="http://localhost:3001"
SERVER_ID="your-server-id"
HEARTBEAT_INTERVAL=30
```

### 2. 启动

```bash
chmod +x monitor.sh
./monitor.sh
```

### 3. 测试模式

```bash
./monitor.sh test
```

## 监控功能

- **安全文件监控**: `/etc/passwd`, `/etc/shadow`, `~/.ssh/authorized_keys` 等
- **外联服务监控**: TCP/UDP 连接状态
- **基础资源监控**: CPU、内存、磁盘使用率

## 自动安装 (Linux)

```bash
curl -sSL http://your-server/install.sh | bash
```
