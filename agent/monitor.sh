#!/bin/bash
# ===========================================
# 服务器监控代理
# 适用于: Linux / 银河麒麟 / Windows (Git Bash) / macOS
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.sh"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

SERVER_URL="${SERVER_URL:-http://localhost:3001}"
SERVER_ID="${SERVER_ID:-$(hostname)-$(date +%s%3N)}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"
LOG_FILE="${LOG_FILE:-/var/log/monitor-agent.log}"

MONITOR_FILES="${MONITOR_FILES:-true}"
MONITOR_CONNECTIONS="${MONITOR_CONNECTIONS:-true}"
MONITOR_RESOURCES="${MONITOR_RESOURCES:-true}"

MONITOR_FILES_LIST=(
    "/etc/passwd"
    "/etc/shadow"
    "/etc/group"
    "/etc/hosts"
    "/root/.ssh/authorized_keys"
    "/home/*/.ssh/authorized_keys"
)

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || echo "$msg"
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

get_file_hash() {
    local file="$1"
    if [ -f "$file" ]; then
        if check_command md5sum; then
            md5sum "$file" 2>/dev/null | awk '{print $1}'
        elif check_command md5; then
            md5 -r "$file" 2>/dev/null | awk '{print $1}'
        elif check_command sha256sum; then
            sha256sum "$file" 2>/dev/null | awk '{print $1}'
        else
            echo ""
        fi
    else
        echo ""
    fi
}

get_cpu_usage() {
    if [ -f /proc/stat ]; then
        local cpu1=$(cat /proc/stat | grep '^cpu ' | awk '{print $2+$3+$4+$5+$6+$7+$8}')
        local idle1=$(cat /proc/stat | grep '^cpu ' | awk '{print $5}')
        sleep 1
        local cpu2=$(cat /proc/stat | grep '^cpu ' | awk '{print $2+$3+$4+$5+$6+$7+$8}')
        local idle2=$(cat /proc/stat | grep '^cpu ' | awk '{print $5}')
        
        local total_delta=$((cpu2 - cpu1))
        local idle_delta=$((idle2 - idle1))
        
        if [ "$total_delta" -gt 0 ]; then
            echo "scale=1; ($total_delta - $idle_delta) * 100 / $total_delta" | bc 2>/dev/null || echo "0"
        else
            echo "0"
        fi
    elif check_command top; then
        top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | tr -d ' ' || echo "0"
    else
        echo "0"
    fi
}

get_memory_usage() {
    if [ -f /proc/meminfo ]; then
        local total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        
        if [ -z "$available" ]; then
            available=$(grep MemFree /proc/meminfo | awk '{print $2}')
        fi
        
        if [ -n "$total" ] && [ -n "$available" ]; then
            echo "scale=1; ($total - $available) * 100 / $total" | bc 2>/dev/null || echo "0"
        else
            echo "0"
        fi
    elif check_command vm_stat; then
        vm_stat 2>/dev/null | grep "Pages active" | awk '{print $3}' | tr -d '.' || echo "0"
    else
        echo "0"
    fi
}

get_disk_usage() {
    if check_command df; then
        df -h / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0"
    else
        echo "0"
    fi
}

get_connections() {
    local connections=""
    if check_command ss; then
        connections=$(ss -tn 2>/dev/null | grep ESTABLISHED | awk '{print $4" "$5}' | tr '\n' ',' | sed 's/,$//')
    elif check_command netstat; then
        connections=$(netstat -tn 2>/dev/null | grep ESTABLISHED | awk '{print $4" "$5}' | tr '\n' ',' | sed 's/,$//')
    fi
    echo "$connections"
}

check_port_listening() {
    local port="$1"
    if check_command ss; then
        ss -ln 2>/dev/null | grep -q ":${port} " && return 0
    elif check_command netstat; then
        netstat -ln 2>/dev/null | grep -q ":${port} " && return 0
    fi
    return 1
}

init_hashes() {
    declare -A FILE_HASHES
    if [ "$MONITOR_FILES" = "true" ]; then
        for file in "${MONITOR_FILES_LIST[@]}"; do
            expanded_file=$(eval echo "$file" 2>/dev/null)
            if [ -f "$expanded_file" ]; then
                hash=$(get_file_hash "$expanded_file")
                if [ -n "$hash" ]; then
                    FILE_HASHES["$expanded_file"]="$hash"
                fi
            fi
        done
    fi
}

collect_file_changes() {
    local changes=""
    local has_changes=false
    
    for file in "${!FILE_HASHES[@]}"; do
        expanded_file=$(eval echo "$file" 2>/dev/null)
        if [ -f "$expanded_file" ]; then
            new_hash=$(get_file_hash "$expanded_file")
            old_hash="${FILE_HASHES[$file]}"
            
            if [ -n "$new_hash" ] && [ "$new_hash" != "$old_hash" ]; then
                has_changes=true
                changes="${changes}{\"path\":\"$expanded_file\",\"action\":\"modified\",\"oldHash\":\"$old_hash\",\"newHash\":\"$new_hash\"},"
            fi
            FILE_HASHES["$expanded_file"]="$new_hash"
        fi
    done
    
    if [ "$has_changes" = true ]; then
        echo "${changes%,}"
    fi
}

collect_data() {
    local type="$1"
    local data="{\"serverId\":\"$SERVER_ID\",\"timestamp\":$(date +%s000),\"type\":\"$type\",\"data\":{"
    local parts=""
    
    if [ "$MONITOR_RESOURCES" = "true" ]; then
        local cpu=$(get_cpu_usage)
        local memory=$(get_memory_usage)
        local disk=$(get_disk_usage)
        parts="${parts}\"resources\":{\"cpu\":${cpu:-0},\"memory\":${memory:-0},\"disk\":${disk:-0}}"
    fi
    
    if [ "$MONITOR_CONNECTIONS" = "true" ]; then
        local connections=$(get_connections)
        if [ -n "$parts" ]; then
            parts="${parts},"
        fi
        parts="${parts}\"connections\":[\"$connections\"]"
    fi
    
    if [ "$MONITOR_FILES" = "true" ]; then
        local changes=$(collect_file_changes)
        if [ -n "$changes" ]; then
            if [ -n "$parts" ]; then
                parts="${parts},"
            fi
            parts="${parts}\"files\":[$changes]"
        fi
    fi
    
    data="${data}${parts}}}"
    echo "$data"
}

send_heartbeat() {
    local heartbeat="{\"serverId\":\"$SERVER_ID\",\"timestamp\":$(date +%s000),\"type\":\"heartbeat\"}"
    printf "event: heartbeat\ndata: %s\n\n" "$heartbeat"
}

send_data() {
    local data=$(collect_data "status_report")
    printf "event: data\ndata: %s\n\n" "$data"
}

send_event() {
    local event="$1"
    local data="$2"
    printf "event: %s\ndata: %s\n\n" "$event" "$data"
}

connect_sse() {
    log "连接到 SSE 服务器: ${SERVER_URL}/sse/agent/${SERVER_ID}"
    
    while true; do
        curl -s -N \
            -H "Accept: text/event-stream" \
            -H "Cache-Control: no-cache" \
            --connect-timeout 10 \
            --max-time 60 \
            "${SERVER_URL}/sse/agent/${SERVER_ID}" 2>&1 | while IFS= read -r line; do
            echo "$line"
        done &
        CURL_PID=$!
        
        LAST_SEND=0
        
        while kill -0 $CURL_PID 2>/dev/null; do
            CURRENT_TIME=$(date +%s)
            
            if [ $((CURRENT_TIME - LAST_SEND)) -ge "$HEARTBEAT_INTERVAL" ]; then
                send_heartbeat
                send_data
                LAST_SEND=$CURRENT_TIME
            fi
            
            sleep 1
        done
        
        wait $CURL_PID 2>/dev/null
        CURL_EXIT=$?
        
        if [ $CURL_EXIT -ne 0 ]; then
            log "SSE 连接断开 (exit: $CURL_EXIT)，${RETRY_INTERVAL}秒后重连..."
        fi
        
        sleep "$RETRY_INTERVAL"
    done
}

daemonize() {
    log "以守护进程模式启动"
    exec "$0" >> "$LOG_FILE" 2>&1 &
}

status_check() {
    log "========== 监控代理状态 =========="
    log "服务器ID: $SERVER_ID"
    log "服务端地址: $SERVER_URL"
    log "心跳间隔: ${HEARTBEAT_INTERVAL}秒"
    log "监控文件: $MONITOR_FILES"
    log "监控连接: $MONITOR_CONNECTIONS"
    log "监控资源: $MONITOR_RESOURCES"
    log "==================================="
    
    log "测试数据收集..."
    local test_data=$(collect_data "test")
    log "测试数据: $test_data"
}

case "${1:-}" in
    start)
        main
        ;;
    daemon)
        daemonize
        ;;
    test)
        status_check
        ;;
    status)
        status_check
        ;;
    *)
        echo "用法: $0 {start|daemon|test|status}"
        echo "  start   - 前台启动"
        echo "  daemon  - 后台守护进程启动"
        echo "  test    - 测试模式"
        echo "  status  - 查看状态"
        exit 1
        ;;
esac
