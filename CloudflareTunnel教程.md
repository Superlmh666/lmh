# Cloudflare Tunnel 配置教程

## 什么是 Cloudflare Tunnel？

Cloudflare Tunnel（原 Argo Tunnel）是 Cloudflare 提供的免费内网穿透工具。

**优点：**
- ✅ 完全免费
- ✅ 自动 HTTPS
- ✅ 支持 WebSocket
- ✅ 全球 CDN 加速
- ✅ 不需要公网IP
- ✅ 不需要配置防火墙

**适用场景：**
- 网页部署在 Cloudflare Pages
- WebSocket 服务器跑在本地电脑
- 外地朋友通过 Cloudflare 域名连接

---

## 准备工作

1. 一个 Cloudflare 账号（免费注册）
2. 一个域名（可以用 Cloudflare 免费的，或者你自己的）
3. 本地已经在运行 server.py

---

## 第一步：安装 cloudflared

### Windows 用户：

1. 下载：https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
2. 重命名为 `cloudflared.exe`
3. 放到一个方便的目录（比如 `D:\游戏\cloudflared\`）

或者用 PowerShell 一键下载：
```powershell
mkdir D:\游戏\cloudflared
cd D:\游戏\cloudflared
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile cloudflared.exe
```

---

## 第二步：登录 Cloudflare

打开 PowerShell，进入 cloudflared 目录：

```powershell
cd D:\游戏\cloudflared
.\cloudflared.exe tunnel login
```

浏览器会自动打开，登录你的 Cloudflare 账号，选择一个域名授权。

---

## 第三步：创建隧道

```powershell
.\cloudflared.exe tunnel create mech-server
```

会生成一个隧道 ID，复制保存下来。

---

## 第四步：创建配置文件

在 `D:\游戏\cloudflared\` 目录下创建 `config.yml`：

```yaml
tunnel: 你的隧道ID
credentials-file: C:\Users\你的用户名\.cloudflared\你的隧道ID.json

ingress:
  - hostname: mech.你的域名.com
    service: http://localhost:8765
  - service: http_status:404
```

**替换：**
- `你的隧道ID` → 上一步生成的ID
- `mech.你的域名.com` → 你想使用的子域名
- `你的用户名` → 你的 Windows 用户名

---

## 第五步：配置 DNS 路由

```powershell
.\cloudflared.exe tunnel route dns mech-server mech.你的域名.com
```

这会在 Cloudflare DNS 添加一条 CNAME 记录。

---

## 第六步：启动隧道

```powershell
.\cloudflared.exe tunnel --config config.yml run mech-server
```

看到「Connected」就成功了！

---

## 第七步：修改游戏连接地址

朋友访问：
```
https://mech.你的域名.com/online.html
```

服务器地址填：
```
mech.你的域名.com
```

（注意：因为是HTTPS，不需要加端口号和端口）

---

## 快速验证

### 启动顺序：

1. 启动游戏服务器：`启动服务器.bat`
2. 启动 cloudflared tunnel
3. 朋友访问 `https://mech.你的域名.com/online.html`
4. 服务器地址填 `mech.你的域名.com`，点连接
5. 开始游戏！

---

## 常见问题

### Q: 浏览器说连接不上？
A: 检查 cloudflared 是否显示「Connected」

### Q: 服务器连接失败？
A: 检查本地 server.py 是否在运行，端口是不是8765

### Q: 游戏很卡？
A: Cloudflare 节点选最近的区域，通常国内访问会有点延迟

### Q: 可以不用自己的域名吗？
A: 可以用 Cloudflare 提供的 trycloudflare.com 免费域名，注册 Zero Trust 后获取

---

## 一键启动脚本

创建 `启动服务器+隧道.bat：

```bat
@echo off
start "" python "D:\游戏\server.py"
timeout /t 3
cd /d "D:\游戏\cloudflared"
start "" cloudflared.exe tunnel --config config.yml run mech-server
echo 服务器和隧道已启动！
pause
```

---

完成后你的朋友就可以通过 HTTPS 地址访问，WebSocket 也能正常连接了！
