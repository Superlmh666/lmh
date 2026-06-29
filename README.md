# 像素机甲对战 - Pixel Mech Battle

一款复古像素风格的双人对战小游戏，支持本地对战和联网对战模式。

## 🎮 游戏玩法

### 本地对战
打开 `index.html` 即可开始本地双人对战。

### 联网对战
1. 启动服务器：`python server.py`
2. 打开 `online.html` 访问联网对战模式

## ⌨️ 操作方式

| 操作 | 玩家1 (蓝色) | 玩家2 (红色) |
|------|-------------|-------------|
| 左移 | A | ← |
| 右移 | D | → |
| 跳跃 | W | ↑ |
| 攻击 | J | 1 |
| 防御 | K | 2 |

## 🛠️ 技术栈

- HTML5 Canvas 2D
- JavaScript (ES6+)
- CSS3
- Python + aiohttp (WebSocket服务器)

## 📁 项目结构

```
├── index.html        # 本地对战页面
├── online.html       # 联网对战页面
├── style.css         # 通用样式
├── online.css        # 联网对战样式
├── game.js           # 本地游戏逻辑
├── online.js         # 联网游戏逻辑
├── server.py         # WebSocket服务器
└── README.md         # 项目说明
```

## 🚀 快速开始

```bash
# 启动开发服务器
python -m http.server 8000

# 启动联网对战服务器
python server.py
```

访问 http://localhost:8000/index.html 开始游戏！

## 📝 License

MIT
