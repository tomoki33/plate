// Web でプレビューするための開発用スクリプト（本番の対象は iOS。Web は確認用）。
//
// Web 版の expo-sqlite は SharedArrayBuffer が必要で、ページ自体に COOP/COEP ヘッダーが要る。
// Expo の開発サーバーは HTML にそれを付けられないので、ヘッダーを足して中継する。
//   npm run web  →  http://localhost:8080 を開く
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const UPSTREAM = Number(process.env.UPSTREAM ?? 8090);
const PORT = Number(process.env.PORT ?? 8080);

const expo = spawn('npx', ['expo', 'start', '--web', '--port', String(UPSTREAM)], { stdio: 'inherit', env: { ...process.env, BROWSER: 'none' } });
const stop = () => expo.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', (c) => process.exit(c ?? 0));

const server = http.createServer((req, res) => {
  const up = http.request({ host: '127.0.0.1', port: UPSTREAM, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, { ...r.headers, 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin' });
    r.pipe(res);
  });
  up.on('error', () => {
    res.writeHead(502);
    res.end('Expo の開発サーバーを待っています。少し待って再読み込みしてください。');
  });
  req.pipe(up);
});

// HMR などの WebSocket もそのまま通す
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(UPSTREAM, '127.0.0.1', () => {
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (head?.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, () => console.log(`\nWeb プレビュー: http://localhost:${PORT}\n`));
