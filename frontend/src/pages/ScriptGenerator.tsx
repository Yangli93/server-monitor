import { useState } from 'react';
import type { ScriptConfig } from '../types';
import { generateScript, downloadScript, copyToClipboard } from '../utils/scriptGenerator';
import { Download, Copy, Settings } from 'lucide-react';

export function ScriptGenerator() {
  const [config, setConfig] = useState<ScriptConfig>({
    platform: 'linux',
    serverId: '',
    serverUrl: 'http://localhost:3001',
    monitorFiles: true,
    monitorConnections: true,
    monitorResources: true,
    heartbeatInterval: 30
  });

  const [generated, setGenerated] = useState<string | null>(null);

  const handleGenerate = () => {
    const script = generateScript(config);
    setGenerated(script);
  };

  const handleDownload = () => {
    if (generated) {
      const filename = `monitor-${config.platform}-${config.serverId || 'agent'}.sh`;
      downloadScript(generated, filename);
    }
  };

  const handleCopy = () => {
    if (generated) {
      copyToClipboard(generated);
      alert('已复制到剪贴板');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">监控脚本生成器</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            配置选项
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">监控平台</label>
              <select
                value={config.platform}
                onChange={e => setConfig({ ...config, platform: e.target.value as ScriptConfig['platform'] })}
                className="w-full p-2 border rounded"
              >
                <option value="linux">Linux (Ubuntu/CentOS/Debian)</option>
                <option value="kylin">银河麒麟</option>
                <option value="windows">Windows (Git Bash)</option>
                <option value="macos">macOS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">服务器 ID</label>
              <input
                type="text"
                value={config.serverId}
                onChange={e => setConfig({ ...config, serverId: e.target.value })}
                placeholder="例如: server-001"
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">服务端地址</label>
              <input
                type="text"
                value={config.serverUrl}
                onChange={e => setConfig({ ...config, serverUrl: e.target.value })}
                placeholder="http://localhost:3001"
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">心跳间隔（秒）</label>
              <input
                type="number"
                value={config.heartbeatInterval}
                onChange={e => setConfig({ ...config, heartbeatInterval: parseInt(e.target.value) || 30 })}
                min={10}
                max={300}
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">监控内容</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.monitorFiles}
                    onChange={e => setConfig({ ...config, monitorFiles: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>安全文件监控（/etc/passwd, ~/.ssh/* 等）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.monitorConnections}
                    onChange={e => setConfig({ ...config, monitorConnections: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>外联服务监控（TCP/UDP 连接）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.monitorResources}
                    onChange={e => setConfig({ ...config, monitorResources: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>基础资源监控（CPU、内存、磁盘）</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              生成脚本
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">脚本预览</h2>
            {generated && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Copy className="w-4 h-4" />
                  复制
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-900 text-gray-100 p-4 rounded max-h-[500px] overflow-auto">
            {generated ? (
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {generated}
              </pre>
            ) : (
              <p className="text-gray-500 text-center py-8">
                点击"生成脚本"按钮预览结果
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
