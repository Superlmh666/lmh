@echo off
chcp 65001 >nul
title 像素机甲对战 - 防火墙配置

echo ========================================
echo    像素机甲对战 - 防火墙配置
echo ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 需要管理员权限
    echo 请右键此文件 - 以管理员身份运行
    pause
    exit /b 1
)

echo 正在添加防火墙规则...
netsh advfirewall firewall add rule name="PixelMechBattle" dir=in action=allow protocol=TCP localport=8765

if %errorlevel% equ 0 (
    echo.
    echo 防火墙规则添加成功！
    echo 端口 8765 已开放
) else (
    echo.
    echo 添加失败，请手动配置防火墙
)

echo.
pause