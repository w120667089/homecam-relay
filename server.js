/*
 * 家用监控 · 中继服务器
 * 职责：把「摄像端」推送的 MJPEG 视频帧、状态/事件，转发给所有「查看端」；
 *       把「查看端」发来的控制指令（开灯/关灯/切摄/拍照）转发给摄像端。
 * 视频不经服务器存储，仅做实时转发；两端都只和这台服务器建 WebSocket，
 * 因此不需要公网 IP、不需要 NAT 打洞、国内网络也能稳定连。
 *
 * 部署：node server.js  （监听 PORT 环境变量，默认 3000）
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    '<h2>HomeCam 中继服务器运行中</h2>' +
    '<p>这是一个家用监控中转服务，仅用于在两台手机间转发视频帧与控制指令。</p>'
  );
});

const wss = new WebSocketServer({ server });

// rooms: id -> { camera: ws|null, viewers: Set<ws> }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { camera: null, viewers: new Set() });
  return rooms.get(id);
}
function safeSend(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}
function broadcast(room, obj, exclude) {
  for (const v of room.viewers) if (v !== exclude) safeSend(v, obj);
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.split('?')[1] || '');
  const role = params.get('role');
  const id = (params.get('id') || '').trim();
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  if (!id) { safeSend(ws, { t: 'error', msg: '缺少 id' }); ws.close(); return; }
  const room = getRoom(id);

  if (role === 'camera') {
    // 一台摄像端：顶掉旧连接
    if (room.camera && room.camera !== ws) { try { room.camera.close(); } catch (e) {} }
    room.camera = ws;
    ws.role = 'camera'; ws.roomId = id;
    safeSend(ws, { t: 'ready' });
    broadcast(room, { t: 'camOnline' });
    console.log('[cam] online', id, 'viewers=', room.viewers.size);
  } else if (role === 'viewer') {
    room.viewers.add(ws);
    ws.role = 'viewer'; ws.roomId = id;
    safeSend(ws, { t: 'joined' });
    if (room.camera) safeSend(ws, { t: 'camOnline' });
    if (room.camera) safeSend(room.camera, { t: 'viewerJoined', count: room.viewers.size });
    console.log('[viewer] join', id, 'total=', room.viewers.size);
  } else {
    safeSend(ws, { t: 'error', msg: '未知角色' }); ws.close(); return;
  }

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    const r = ws.role === 'camera' ? room : room;
    if (ws.role === 'camera') {
      if (m.t === 'frame') broadcast(room, m);                 // 视频帧 -> 所有查看端
      else if (m.t === 'event') broadcast(room, m);            // 移动侦测/状态
      else if (m.t === 'snapshot') broadcast(room, m);         // 拍照结果
      else if (m.t === 'torchAck') broadcast(room, m);
    } else if (ws.role === 'viewer') {
      if (m.t === 'cmd' && room.camera) safeSend(room.camera, m); // 控制指令 -> 摄像端
    }
  });

  ws.on('close', () => {
    if (ws.role === 'camera') {
      if (room.camera === ws) {
        room.camera = null;
        broadcast(room, { t: 'camOffline' });
        console.log('[cam] offline', id);
      }
    } else if (ws.role === 'viewer') {
      room.viewers.delete(ws);
      if (room.camera) safeSend(room.camera, { t: 'viewerLeft', count: room.viewers.size });
      console.log('[viewer] left', id, 'total=', room.viewers.size);
    }
    // 房间空了就回收
    if (!room.camera && room.viewers.size === 0) rooms.delete(id);
  });
});

// 心跳：清理死连接
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log('HomeCam relay listening on :' + PORT);
});
