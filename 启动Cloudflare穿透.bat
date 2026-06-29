@echo off
chcp 65001 >nul
title 像素机甲对战 - Cloudflare Tunnel 启动器

echo ========================================
echo    像素机甲对战 - 一键启动
echo ========================================
echo.
echo [1/2] 启动游戏服务器...
start "游戏服务器" python "%~dp0server.py"

timeout /t 3 /nobreak >nul

echo [2/2] 启动 Cloudflare Tunnel...
echo.
echo 正在启动，请稍候...
echo 启动成功后会显示一个 trycloudflare.com 地址
echo.

if exist "%~dp0cloudflared\cloudflared.exe" (
    cd /d "%~dp0cloudflared"
    cloudflared.exe tunnel --url http://localhost:8765
) else (
    echo.
    echo 未找到 cloudflared.exe
    echo 请先下载并放到 cloudflared 目录下
    echo 下载地址: https://github.com/cloudflare/cloudflared/releases
    echo.
    pause
)
