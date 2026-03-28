# 服务器监控代理

跨平台服务器监控代理，支持 Linux、银河麒麟、Windows (Git Bash)、macOS。

## 功能特性

- **安全文件监控**: 检测 `/etc/passwd`, `/etc/shadow`, `~/.ssh/authorized_keys` 等敏感文件变更
- **外联服务监控**: 实时监控 TCP/UDP 连接状态
- **基础资源监控**: CPU、内存、磁盘使用率
- **SSE 实时推送**: 通过 Server-Sent Events 实时上报数据
- **自动重连**: 断线自动重连，保证服务连续性

## 快速开始

### 1. 配置

编辑 `config.sh` 文件：

```bash
SERVER_URL="http://localhost:3001"
SERVER_ID="server-001"
HEARTBEAT_INTERVAL=30
```

### 2. 启动

```bash
chmod +x monitor.sh
./monitor.sh start
```

### 3. 其他命令

```bash
./monitor.sh daemon   # 后台守护进程模式
./monitor.sh test     # 测试模式，收集一次数据
./monitor.sh status   # 查看配置状态
```

## 监控的文件

默认监控以下安全文件：

- `/etc/passwd` - 用户账户文件
- `/etc/shadow` - 用户密码文件
- `/etc/group` - 用户组文件
- `/etc/hosts` - 主机解析文件
- `~/.ssh/authorized_keys` - SSH 授权密钥

## 部署方式

### Linux/macOS

```bash
curl -sSL https://your-server/install.sh | bash
```

### 银河麒麟

```bash
curl -sSL https://your-server/install.sh | bash
```

### Windows (Git Bash)

```bash
curl -sSL https://your-server/install.sh | bash
```

## 日志

日志文件默认位置: `/var/log/monitor-agent.log`

查看实时日志:

```bash
tail -f /var/log/monitor-agent.log
```
