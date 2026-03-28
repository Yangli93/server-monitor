#!/bin/bash
# 启动前后端服务

cd "$(dirname "$0")"

echo "启动后端服务..."
cd backend
npm run dev &
BACKEND_PID=$!

echo "启动前端服务..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "服务已启动:"
echo "  后端: http://localhost:3001"
echo "  前端: http://localhost:5173"
echo "=========================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
