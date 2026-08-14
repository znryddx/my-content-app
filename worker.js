// ===== Claw 上传代理（Cloudflare Worker, ES Module）=====
// 旧 GitHub token 仅存于服务端密钥(env.GH_TOKEN)，绝不出现在前端。
// 前端把图片 POST 到这里 -> Worker 写进 GitHub 仓库 assets/uploads/ 并更新 manifest.json。

const ORIGIN = 'https://znryddx.github.io';

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-upload-key',
    'Access-Control-Max-Age': '86400'
  };
}

// GitHub 路径需编码但保留斜杠
function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

function ghHeaders(env) {
  return {
    'Authorization': 'Bearer ' + env.GH_TOKEN,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'claw-upload-worker',
    'Content-Type': 'application/json'
  };
}

async function ghGet(env, enc) {
  const r = await fetch('https://api.github.com/repos/' + env.GH_REPO + '/contents/' + enc, {
    headers: ghHeaders(env)
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('gh get ' + r.status);
  return r.json();
}

async function ghPut(env, enc, contentB64, sha, message) {
  const body = { message: message, content: contentB64, branch: env.GH_BRANCH || 'main' };
  if (sha) body.sha = sha;
  const r = await fetch('https://api.github.com/repos/' + env.GH_REPO + '/contents/' + enc, {
    method: 'PUT',
    headers: ghHeaders(env),
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('gh put ' + r.status + ' ' + t.slice(0, 200));
  }
  return r.json();
}

// Workers 无 Buffer，用 Web API 做 base64
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function handleUpload(request, env) {
  const KEY = env.UPLOAD_KEY || '';
  if (KEY) {
    const k = request.headers.get('x-upload-key') || new URL(request.url).searchParams.get('key');
    if (k !== KEY) return json({ error: 'unauthorized' }, 401);
  }
  let form;
  try { form = await request.formData(); } catch (e) { return json({ error: 'bad form' }, 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);

  const buf = new Uint8Array(await file.arrayBuffer());
  const b64 = bytesToBase64(buf);
  const safe = (file.name || 'image').replace(/[^\w.\-]+/g, '_').replace(/_{2,}/g, '_');
  const ts = Date.now();
  const path = 'assets/uploads/' + ts + '_' + safe;

  try {
    await ghPut(env, encPath(path), b64, null, 'upload ' + safe);
    // 更新 manifest
    const manEnc = encPath('assets/uploads/manifest.json');
    const man = await ghGet(env, manEnc);
    let list = [];
    let sha = null;
    if (man) {
      list = JSON.parse(new TextDecoder().decode(base64ToBytes(man.content)));
      sha = man.sha;
    }
    const entry = {
      name: safe,
      path: path,
      url: 'https://raw.githubusercontent.com/' + env.GH_REPO + '/' + (env.GH_BRANCH || 'main') + '/' + path,
      added: ts
    };
    list.unshift(entry);
    await ghPut(env, manEnc, bytesToBase64(new TextEncoder().encode(JSON.stringify(list, null, 2))), sha, 'update uploads manifest');
    return json(entry, 200);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const h = corsHeaders();
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(request.url);
    if (url.pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    return json({ ok: true, service: 'claw-upload' }, 200, h);
  }
};
