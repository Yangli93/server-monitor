import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ScriptGenerator } from './pages/ScriptGenerator';
import { Server, Code, LayoutDashboard } from 'lucide-react';
import './index.css';

function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '仪表盘', icon: LayoutDashboard },
    { path: '/script', label: '脚本生成', icon: Code },
  ];

  return (
    <nav className="bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Server className="w-6 h-6" />
              <span className="font-bold text-lg">服务器监控</span>
            </div>
            <div className="flex gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/script" element={<ScriptGenerator />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
