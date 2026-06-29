import asyncio
import random
import json
from aiohttp import web
import aiohttp

# 存储游戏房间
rooms = {}
# 存储等待中的连接
waiting_players = []

# 生成房间码
def generate_room_code():
    return ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=4))

# 广播消息给房间内的所有玩家
async def broadcast_to_room(room_code, message, exclude_ws=None):
    room = rooms.get(room_code)
    if room:
        for ws in room['players']:
            if ws != exclude_ws and not ws.closed:
                try:
                    await ws.send_str(json.dumps(message))
                except:
                    pass

# WebSocket 处理器
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    player_room = None
    player_side = None
    
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                action = data.get('action')
                
                # 创建房间
                if action == 'create_room':
                    room_code = generate_room_code()
                    while room_code in rooms:
                        room_code = generate_room_code()
                    
                    rooms[room_code] = {
                        'players': [ws],
                        'state': 'waiting',
                        'p1_ready': False,
                        'p2_ready': False,
                        'game_state': None
                    }
                    player_room = room_code
                    player_side = 'p1'
                    
                    await ws.send_str(json.dumps({
                        'action': 'room_created',
                        'room_code': room_code,
                        'side': 'p1'
                    }))
                    print(f"房间 {room_code} 创建成功")
                
                # 加入房间
                elif action == 'join_room':
                    room_code = data.get('room_code', '').upper()
                    room = rooms.get(room_code)
                    
                    if not room:
                        await ws.send_str(json.dumps({
                            'action': 'error',
                            'message': '房间不存在'
                        }))
                    elif len(room['players']) >= 2:
                        await ws.send_str(json.dumps({
                            'action': 'error',
                            'message': '房间已满'
                        }))
                    else:
                        room['players'].append(ws)
                        room['state'] = 'full'
                        player_room = room_code
                        player_side = 'p2'
                        
                        await ws.send_str(json.dumps({
                            'action': 'joined_room',
                            'room_code': room_code,
                            'side': 'p2'
                        }))
                        
                        # 通知房间创建者有玩家加入
                        await broadcast_to_room(room_code, {
                            'action': 'player_joined',
                            'room_code': room_code
                        }, exclude_ws=ws)
                        print(f"玩家加入房间 {room_code}")
                
                # 快速匹配
                elif action == 'quick_match':
                    if waiting_players:
                        # 匹配等待中的玩家
                        host_ws = waiting_players.pop(0)
                        host_room = None
                        
                        # 找到主机所在的房间
                        for code, room in rooms.items():
                            if host_ws in room['players']:
                                host_room = code
                                break
                        
                        if host_room and host_ws in rooms[host_room]['players']:
                            rooms[host_room]['players'].append(ws)
                            rooms[host_room]['state'] = 'full'
                            player_room = host_room
                            player_side = 'p2'
                            
                            await ws.send_str(json.dumps({
                                'action': 'matched',
                                'room_code': host_room,
                                'side': 'p2'
                            }))
                            
                            await host_ws.send_str(json.dumps({
                                'action': 'player_joined',
                                'room_code': host_room
                            }))
                            print(f"快速匹配成功，房间 {host_room}")
                        else:
                            # 主机已离开，重新创建
                            waiting_players.clear()
                            await handle_create_room(ws)
                    else:
                        # 创建房间并等待
                        room_code = generate_room_code()
                        while room_code in rooms:
                            room_code = generate_room_code()
                        
                        rooms[room_code] = {
                            'players': [ws],
                            'state': 'waiting',
                            'p1_ready': False,
                            'p2_ready': False,
                            'game_state': None
                        }
                        waiting_players.append(ws)
                        player_room = room_code
                        player_side = 'p1'
                        
                        await ws.send_str(json.dumps({
                            'action': 'waiting_for_match',
                            'room_code': room_code,
                            'side': 'p1'
                        }))
                        print(f"玩家等待匹配，房间 {room_code}")
                
                # 玩家就绪
                elif action == 'ready':
                    if player_room and player_room in rooms:
                        room = rooms[player_room]
                        if player_side == 'p1':
                            room['p1_ready'] = True
                        else:
                            room['p2_ready'] = True
                        
                        await broadcast_to_room(player_room, {
                            'action': 'player_ready',
                            'side': player_side
                        })
                        
                        # 双方都就绪，开始游戏
                        if room['p1_ready'] and room['p2_ready']:
                            room['state'] = 'playing'
                            # 随机决定谁是P1（主机侧）
                            await broadcast_to_room(player_room, {
                                'action': 'game_start',
                                'room_code': player_room
                            })
                            print(f"房间 {player_room} 游戏开始")
                
                # 游戏状态同步
                elif action == 'sync_state':
                    if player_room and player_room in rooms:
                        room = rooms[player_room]
                        game_state = data.get('state')
                        
                        # 广播给对手
                        await broadcast_to_room(player_room, {
                            'action': 'sync_state',
                            'side': player_side,
                            'state': game_state
                        }, exclude_ws=ws)
                
                # 游戏结束
                elif action == 'game_over':
                    if player_room and player_room in rooms:
                        winner = data.get('winner')
                        await broadcast_to_room(player_room, {
                            'action': 'game_over',
                            'winner': winner
                        }, exclude_ws=ws)
                        rooms[player_room]['state'] = 'finished'
                
                # 重新开始游戏
                elif action == 'restart':
                    if player_room and player_room in rooms:
                        room = rooms[player_room]
                        room['p1_ready'] = False
                        room['p2_ready'] = False
                        room['state'] = 'full'
                        
                        await broadcast_to_room(player_room, {
                            'action': 'restart_request',
                            'side': player_side
                        })
                
                # 确认重新开始
                elif action == 'confirm_restart':
                    if player_room and player_room in rooms:
                        room = rooms[player_room]
                        if player_side == 'p1':
                            room['p1_ready'] = True
                        else:
                            room['p2_ready'] = True
                        
                        if room['p1_ready'] and room['p2_ready']:
                            room['state'] = 'playing'
                            await broadcast_to_room(player_room, {
                                'action': 'game_start',
                                'room_code': player_room
                            })
                
                # 离开房间
                elif action == 'leave_room':
                    if player_room and player_room in rooms:
                        await handle_leave_room(ws, player_room, player_side)
                        player_room = None
                        player_side = None
                
    except Exception as e:
        print(f"WebSocket 错误: {e}")
    
    finally:
        # 清理连接
        if player_room and player_room in rooms:
            await handle_leave_room(ws, player_room, player_side)
        
        # 从等待列表中移除
        if ws in waiting_players:
            waiting_players.remove(ws)
        
        await ws.close()
    
    return ws

async def handle_leave_room(ws, room_code, side):
    room = rooms.get(room_code)
    if room:
        if ws in room['players']:
            room['players'].remove(ws)
        
        # 通知对方玩家离开
        await broadcast_to_room(room_code, {
            'action': 'player_left',
            'side': side
        })
        
        # 如果房间空了，删除房间
        if len(room['players']) == 0:
            del rooms[room_code]
            print(f"房间 {room_code} 已删除")
        else:
            room['state'] = 'waiting'
            room['p1_ready'] = False
            room['p2_ready'] = False

# HTTP 处理器 - 提供静态文件
async def index_handler(request):
    return web.FileResponse('index.html')

async def static_handler(request):
    path = request.match_info.get('path', '')
    return web.FileResponse(path)

# 主函数
async def main():
    app = web.Application()
    
    # 路由
    app.router.add_get('/', index_handler)
    app.router.add_get('/{path}', static_handler)
    app.router.add_get('/ws', websocket_handler)
    
    # CORS 支持
    async def cors_middleware(app, handler):
        async def middleware_handler(request):
            if request.method == 'OPTIONS':
                response = web.Response()
            else:
                response = await handler(request)
            
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
        return middleware_handler
    
    app.middlewares.append(cors_middleware)
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, '0.0.0.0', 8765)
    print("服务器启动在 http://0.0.0.0:8765")
    print("WebSocket 端点: ws://0.0.0.0:8765/ws")
    
    await site.start()
    
    # 保持运行
    while True:
        await asyncio.sleep(3600)

if __name__ == '__main__':
    asyncio.run(main())