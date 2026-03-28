import type { ScriptConfig } from '../types';

export function generateScript(config: ScriptConfig): string {
  const { platform, serverId, serverUrl, monitorFiles, monitorConnections, monitorResources, heartbeatInterval } = config;

  const filesToMonitor = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/group',
    '~/.ssh/authorized_keys',
    '~/.ssh/authorized_keys2'
  ];

  return `#!/bin/bash
# ===========================================
# 自动生成的监控脚本
# 服务器ID: ${serverId}
# 监控平台: ${platform}
# 生成时间: ${new Date().toISOString()}
# ===========================================

SERVER_URL="${serverUrl}"
SERVER_ID="${serverId}"
HEARTBEAT_INTERVAL=${heartbeatInterval}
RETRY_INTERVAL=5

MONITOR_FILES=${monitorFiles}
MONITOR_CONNECTIONS=${monitorConnections}
MONITOR_RESOURCES=${monitorResources}

FILE_HASHES=""
${monitorFiles ? `
FILES=(
${filesToMonitor.map(f => `  "${f}"`).join('\n')}
)
` : ''}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_sse() {
    local event="$1"
    local data="$2"
    echo -e "event: \${event}\\ndata: \${data}\\n\\n"
}

get_file_hash() {
    local file="$1"
    if [ -f "$file" ]; then
        md5sum "$file" 2>/dev/null | awk '{print $1}'
    else
        echo ""
    fi
}

get_cpu_usage() {
    top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "0"
}

get_memory_usage() {
    free | grep Mem | awk '{printf "%.1f", $3/$2 * 100}' || echo "0"
}

get_disk_usage() {
    df -h / | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0"
}

get_connections() {
    netstat -tn 2>/dev/null | grep ESTABLISHED | awk '{print $4" "$5}' || ss -tn 2>/dev/null | grep ESTABLISHED | awk '{print $4" "$5}'
}

check_file_changes() {
    local changes=()
    for file in "\${FILES[@]}"; do
        expanded_file=$(eval echo "$file")
        if [ -f "$expanded_file" ]; then
            new_hash=$(get_file_hash "$expanded_file")
            if [ -n "$FILE_HASHES" ]; then
                old_hash=$(echo "$FILE_HASHES" | grep "$expanded_file:" | cut -d: -f2)
                if [ "$new_hash" != "$old_hash" ] && [ -n "$old_hash" ]; then
                    changes+=("{\"path\":\"$expanded_file\",\"action\":\"modified\",\"oldHash\":\"$old_hash\",\"newHash\":\"$new_hash\"}")
                fi
            fi
        fi
    done
    echo "\${changes[@]}"
}

collect_data() {
    local data="{"
    data="$data\\"serverId\\":\\"$SERVER_ID\\","
    data="$data\\"timestamp\\":$(date +%s000),"
    data="$data\\"type\\":\\"status_report\\","
    data="$data\\"data\\":{"
    
    ${monitorResources ? `
    cpu=$(get_cpu_usage)
    memory=$(get_memory_usage)
    disk=$(get_disk_usage)
    data="$data\\"resources\\":{\\"cpu\\":$cpu,\\"memory\\":$memory,\\"disk\\":$disk}"` : ''}
    
    ${monitorConnections ? `
    connections=$(get_connections)
    data="$data,\\"connections\\":[\"$connections\"]"` : ''}
    
    ${monitorFiles ? `
    changes=$(check_file_changes)
    if [ -n "$changes" ]; then
        data="$data,\\"files\\":[$changes]"
    fi` : ''}
    
    data="$data}}"
    echo "$data"
}

init_hashes() {
    ${monitorFiles ? `
    for file in "\${FILES[@]}"; do
        expanded_file=$(eval echo "$file")
        if [ -f "$expanded_file" ]; then
            hash=$(get_file_hash "$expanded_file")
            FILE_HASHES="$FILE_HASHES$expanded_file:$hash "
        fi
    done
    ` : ''}
}

log "监控脚本启动，服务器ID: $SERVER_ID"
init_hashes

while true; do
    data=$(collect_data)
    log "发送数据: $data"
    send_sse "data" "$data"
    
    ${monitorFiles ? `
    FILE_HASHES=""
    init_hashes
    ` : ''}
    
    sleep "$HEARTBEAT_INTERVAL"
done
`;
}

export function downloadScript(script: string, filename: string) {
  const blob = new Blob([script], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}
