SERVER_URL="http://localhost:3001"
SERVER_ID=""
HEARTBEAT_INTERVAL=30
RETRY_INTERVAL=5
LOG_FILE="/var/log/monitor-agent.log"

MONITOR_FILES=true
MONITOR_CONNECTIONS=true
MONITOR_RESOURCES=true

MONITOR_FILES_LIST=(
    "/etc/passwd"
    "/etc/shadow"
    "/etc/group"
    "/root/.ssh/authorized_keys"
    "/home/*/.ssh/authorized_keys"
)
