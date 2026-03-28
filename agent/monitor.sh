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
SERVER_ID="${SERVER_ID:-$(hostname)-$(date +%s)}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30}"
LOG_FILE="${LOG_FILE:-/var/log/monitor-agent.log}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
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
        fi
    fi
    echo ""
}

get_cpu_usage() {
    if check_command top; then
        top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | tr -d ' '
    elif check_command mpstat; then
        mpstat 1 1 2>/dev/null | awk '/Average/ {print 100 - $NF}'
    else
        echo "0"
    fi
}

get_memory_usage() {
    if [ -f /proc/meminfo ]; then
        local total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        if [ -n "$total" ] && [ -n "$available" ]; then
            echo "scale=1; ($total - $available) * 100 / $total" | bc 2>/dev/null || echo "0"
        else
            local free=$(grep MemFree /proc/meminfo | awk '{print $2}')
            if [ -n "$total" ] && [ -n "$free" ]; then
                echo "scale=1; ($total - $free) * 100 / $total" | bc 2>/dev/null || echo "0"
            else
                echo "0"
            fi
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

collect_file_changes() {
    local changes=""
    for file in "${MONITOR_FILES[@]}"; do
        expanded_file=$(eval echo "$file")
        if [ -f "$expanded_file" ]; then
            new_hash=$(get_file_hash "$expanded_file")
            key="hash_$(echo "$file" | tr '/' '_')"
            old_hash="${!key}"
            if [ -n "$old_hash" ] && [ "$new_hash" != "$old_hash" ]; then
                changes="${changes}{\"path\":\"$expanded_file\",\"action\":\"modified\",\"oldHash\":\"$old_hash\",\"newHash\":\"$new_hash\"},"
            fi
            declare "$key=$new_hash"
        fi
    done
    echo "$changes"
}

collect_data() {
    local type="$1"
    local data="{"
    data="${data}\"serverId\":\"$SERVER_ID\","
    data="${data}\"timestamp\":$(date +%s000),"
    data="${data}\"type\":\"$type\","
    data="${data}\"data\":{"
    
    local parts=""
    
    if [ "$MONITOR_RESOURCES" = "true" ]; then
        local cpu=$(get_cpu_usage)
        local memory=$(get_memory_usage)
        local disk=$(get_disk_usage)
        parts="${parts}\"resources\":{\"cpu\":${cpu},\"memory\":${memory},\"disk\":${disk}}"
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
            parts="${parts}\"files\":[${changes%,}]"
        fi
    fi
    
    data="${data}${parts}}"
    data="${data}}"
    echo "$data"
}

send_sse() {
    local event="$1"
    local data="$2"
    echo -e "event: ${event}\ndata: ${data}\n\n"
}

connect_sse() {
    log "正在连接到 SSE 服务器: ${SERVER_URL}/sse/agent/${SERVER_ID}"
    
    while true; do
        response=$(curl -s -N -m 65 \
            -H "Accept: text/event-stream" \
            -H "Cache-Control: no-cache" \
            "${SERVER_URL}/sse/agent/${SERVER_ID}" 2>&1) &
        curl_pid=$!
        
        sleep 2
        
        if kill -0 $curl_pid 2>/dev/null; then
            log "SSE 连接已建立"
            
            while true; do
                if ! kill -0 $curl_pid 2>/dev/null; then
                    log "SSE 连接断开，尝试重连..."
                    break
                fi
                
                data=$(collect_data "status_report")
                echo "event: data"
                echo "data: $data"
                echo ""
                
                sleep "$HEARTBEAT_INTERVAL"
            done
        else
            log "SSE 连接失败: $response"
        fi
        
        log "等待 ${RETRY_INTERVAL} 秒后重连..."
        sleep "$RETRY_INTERVAL"
    done
}

init_hashes() {
    if [ "$MONITOR_FILES" = "true" ]; then
        for file in "${MONITOR_FILES[@]}"; do
            expanded_file=$(eval echo "$file")
            if [ -f "$expanded_file" ]; then
                hash=$(get_file_hash "$expanded_file")
                key="hash_$(echo "$file" | tr '/' '_')"
                declare "$key=$hash"
            fi
        done
    fi
}

main() {
    log "=========================================="
    log "服务器监控代理启动"
    log "服务器ID: $SERVER_ID"
    log "服务端地址: $SERVER_URL"
    log "心跳间隔: ${HEARTBEAT_INTERVAL}秒"
    log "=========================================="
    
    init_hashes
    connect_sse
}

if [ "${1:-}" = "test" ]; then
    log "测试模式 - 收集一次数据并退出"
    data=$(collect_data "test")
    log "数据: $data"
else
    main
fi
