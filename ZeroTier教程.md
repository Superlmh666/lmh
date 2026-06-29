# ZeroTier 虚拟局域网配置教程

## 什么是 ZeroTier？

ZeroTier 创建一个虚拟局域网，让你们的电脑像在同一个WiFi下一样。

**优点：**
- 完全免费
- 不限流量
- 支持WebSocket（我们游戏需要的）
- 稳定可靠

**缺点：**
- 双方都要安装软件
- 需要注册账号

---

## 第一步：注册 ZeroTier 账号

1. 访问 https://www.zerotier.com/
2. 点击 "Sign Up" 注册账号
3. 邮箱验证

---

## 第二步：创建网络

1. 登录后，点击 "Networks"
2. 点击 "Create A Network"
3. 系统会生成一个 **Network ID**（23位字母数字）
4. 复制这个ID，格式类似：`a1b2c3d4e5f67890`

---

## 第三步：双方安装客户端

### 你的电脑（主机）：
1. 下载 Windows 客户端：https://www.zerotier.com/download/
2. 安装后，托盘区找到ZeroTier图标
3. 右键 → "Join Network"
4. 输入 Network ID，点击 "Join"
5. 在网页控制台批准你的设备

### 朋友的电脑（连接者）：
1. 同样下载安装ZeroTier客户端
2. 加入同一个 Network ID
3. 在控制台批准朋友的设备

---

## 第四步：在控制台批准设备

1. 回到 https://www.zerotier.com/
2. 点击你的网络
3. 找到 "Members" 部分
4. 找到新加入的设备（显示 MAC 地址）
5. 勾选 "Authorized" 列
6. 记住分配的 IP 地址（例如：`10.147.17.100`）

---

## 第五步：开始游戏

### 主机（你）：
1. 双击 `启动服务器.bat`
2. 记住ZeroTier分配的IP（假设是 `10.147.17.100`）

### 朋友：
1. 浏览器访问：`http://10.147.17.100:8765/online.html`
2. 点击连接
3. 创建/加入房间

---

## 常见问题

### Q: 设备已加入但显示未授权？
A: 需要在ZeroTier网页控制台手动点击 "Authorized" 批准

### Q: 连接后游戏很卡？
A: 检查双方网络质量，ZeroTier服务器在国外可能有延迟

### Q: 找不到分配的IP？
A: 在控制台Members列表中查看，Status列会显示IP

---

## 快速检查清单

- [ ] 双方都注册了ZeroTier账号
- [ ] 双方都安装了ZeroTier客户端
- [ ] 双方都加入了同一个Network ID
- [ ] 双方都在控制台被批准（Authorized）
- [ ] 主机运行了启动服务器.bat
- [ ] 朋友访问的是ZeroTier分配的IP

---

完成后就像在同一个局域网一样，可以直接用内网IP连接，WebSocket完美支持！
