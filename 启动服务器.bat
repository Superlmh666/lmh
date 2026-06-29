@echo off
chcp 65001 >nul
title 像素机甲对战 - 服务器启动器

echo ========================================
echo    像素机甲对战 - 服务器启动器
echo ========================================
echo.

echo [1/3] 检查Python环境...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)
echo Python环境: 正常
echo.

echo [2/3] 配置防火墙...
netsh advfirewall firewall show rule name="PixelMechBattle" >nul 2>&1
if %errorlevel% neq 0 (
    echo 正在添加防火墙规则(需要管理员权限)...
    netsh advfirewall firewall add rule name="PixelMechBattle" dir=in action=allow protocol=TCP localport=8765 >nul 2>&1
    if %errorlevel% equ 0 (
        echo 防火墙规则: 添加成功
    ) else (
        echo 警告: 无法添加防火墙规则(需要管理员权限)
        echo 请右键以管理员身份运行此脚本
    )
) else (
    echo 防火墙规则: 已存在
)
echo.

echo [3/3] 启动服务器...
echo 服务器端口: 8765
echo 本地访问: http://localhost:8765/online.html
echo.
echo ========================================
echo    服务器运行中... 按 Ctrl+C 停止
echo ========================================
echo.

python "%~dp0server.py"

echo.
echo 服务器已停止
pause