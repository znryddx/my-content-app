// Cloudflare Worker —— 接收前端图片，写入 GitHub 仓库 assets/uploads/ + 更新 manifest.json
// 经典 Service Worker 格式（无 ESM export）；GH_TOKEN 为绑定的服务端密钥（全局变量，不进前端）
const REPO = 'znryddx/my-content-app';
const GH_API = 'https://api.github.com/repos/' + REPO + '/contents/';
const ORIGIN = 'https://znryddx.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
  });
}
function ghHeaders(extra) {
  return Object.assign({ Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'cf-worker' }, extra || {});
}
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
function unb64(b64str) { return decodeURIComponent(escape(atob(b64str))); }

async function updateManifest(name, url_) {
  const mp = 'assets/uploads/manifest.json';
  const mh = await fetch(GH_API + encodeURIComponent(mp), { headers: ghHeaders() });
  let list = [], sha;
  if (mh.status === 200) {
    const j = await mh.json();
    sha = j.sha;
    try { list = JSON.parse(unb64(j.content)); } catch (e) { list = []; }
  }
  if (!Array.isArray(list)) list = [];
  if (!list.some(function (x) { return x.name === name; })) {
    list.unshift({ name: name, url: url_, ts: Date.now() });
  }
  await fetch(GH_API + encodeURIComponent(mp), {
    method: 'PUT',
    headers: ghHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: 'update manifest ' + name, content: b64(JSON.stringify(list, null, 2)), sha: sha })
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'POST' && url.pathname === '/upload') {
    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!file) return json({ error: 'no file' }, 400);
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const content = btoa(bin);
      const raw = file.name || 'image.jpg';
      const safe = raw.replace(/[^\w.\-]/g, '_');
      const path = 'assets/uploads/' + safe;
      const encPath = encodeURIComponent(path);
      let sha;
      const head = await fetch(GH_API + encPath, { headers: ghHeaders() });
      if (head.status === 200) sha = (await head.json()).sha;
      const put = await fetch(GH_API + encPath, {
        method: 'PUT',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: 'upload ' + safe, content: content, sha: sha })
      });
      if (!put.ok) return json({ error: 'github put failed ' + put.status }, 500);
      const url_ = ORIGIN + '/' + REPO + '/assets/uploads/' + encodeURIComponent(safe);
      await updateManifest(safe, url_);
      return json({ ok: true, url: url_ });
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  }
  return json({ error: 'method not allowed' }, 405);
}

addEventListener('fetch', function (event) {
  event.respondWith(handleRequest(event.request));
});
