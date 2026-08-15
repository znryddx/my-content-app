// Cloudflare Worker —— 接收前端图片，写入 GitHub 仓库 assets/uploads/ + 更新 manifest.json
// 经典 Service Worker 格式（无 ESM export）；GH_TOKEN 为绑定的服务端密钥（全局变量，不进前端）
const REPO = 'znryddx/my-content-app';
const GH_API = 'https://api.github.com/repos/' + REPO + '/contents/';
const PAGES_BASE = 'https://znryddx.github.io/my-content-app'; // 图片对外访问基址（含项目路径）

// CORS：反射请求来源，任何打开方式都能过预检
function cors(request) {
  var o = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': o || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(request))
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
  const put = await fetch(GH_API + encodeURIComponent(mp), {
    method: 'PUT',
    headers: ghHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: 'update manifest ' + name, content: b64(JSON.stringify(list, null, 2)), sha: sha })
  });
  if (!put.ok) {
    const txt = await put.text();
    throw new Error('manifest put failed ' + put.status + ' ' + txt.slice(0, 200));
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  // 预检
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  // 自检接口（无需文件，便于排查令牌是否生效）
  if (request.method === 'GET' && url.pathname === '/health') {
    const tokenOk = (typeof GH_TOKEN !== 'undefined') && !!GH_TOKEN && GH_TOKEN.length > 10;
    return json({ ok: true, token_present: tokenOk, repo: REPO, pages_base: PAGES_BASE }, 200, request);
  }
  if (request.method === 'POST' && url.pathname === '/upload') {
    try {
      if (typeof GH_TOKEN === 'undefined' || !GH_TOKEN) {
        return json({ error: 'server missing GH_TOKEN binding' }, 500, request);
      }
      const form = await request.formData();
      const file = form.get('file');
      if (!file) return json({ error: 'no file' }, 400, request);
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
      if (!put.ok) {
        const txt = await put.text();
        return json({ error: 'github put failed ' + put.status + ' ' + txt.slice(0, 220) }, 500, request);
      }
      const url_ = PAGES_BASE + '/assets/uploads/' + encodeURIComponent(safe);
      await updateManifest(safe, url_);
      return json({ ok: true, url: url_ }, 200, request);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500, request);
    }
  }
  return json({ error: 'method not allowed' }, 405, request);
}

addEventListener('fetch', function (event) {
  event.respondWith(handleRequest(event.request));
});
