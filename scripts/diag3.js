/* 深度诊断：代理 / GitHub Models / OpenRouter 免费模型实时列表 */
const fs = require('fs');
const { execSync } = require('child_process');
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

log('=== 深度诊断 ' + new Date().toISOString() + ' ===\n');

// ---- 0. 代理环境变量 ----
log('--- 代理环境变量 ---');
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy']) {
  log('  ' + k + ': ' + (process.env[k] ? '有 -> ' + process.env[k] : '无'));
}

// ---- 1. curl 直连测试（curl 遵循代理环境变量） ----
function curlTest(name, url, extra) {
  try {
    const cmd = 'curl -s -o /tmp/_c.out -w "%{http_code}" --max-time 25 ' + (extra || '') + " '" + url + "'";
    const code = execSync(cmd, { encoding: 'utf-8' }).trim();
    const body = fs.existsSync('/tmp/_c.out') ? fs.readFileSync('/tmp/_c.out', 'utf-8').slice(0, 400) : '';
    log('  [curl] ' + name + ' -> HTTP ' + code);
    if (code !== '200') log('        ' + body.replace(/\n/g, ' '));
    return code;
  } catch (e) {
    log('  [curl] ' + name + ' -> 异常 ' + e.message.slice(0, 120));
    return 'ERR';
  }
}

log('\n--- curl 连通性（curl 会走系统代理）---');
curlTest('GitHub Models 根', 'https://models.inference.ai.azure.com/');
curlTest('OpenRouter models 列表', 'https://openrouter.ai/api/v1/models');

// ---- 2. Node fetch 测试（undici 默认不走代理） ----
log('\n--- Node 原生 fetch（undici，默认不走代理）---');
async function nodeFetchTest(name, url, opts) {
  const t = Date.now();
  try {
    const r = await fetch(url, opts);
    const b = (await r.text()).slice(0, 300);
    log('  [fetch] ' + name + ' -> HTTP ' + r.status + ' (' + (Date.now() - t) + 'ms)');
    if (r.status !== 200) log('         ' + b.replace(/\n/g, ' '));
    return { ok: r.status === 200, status: r.status, body: b };
  } catch (e) {
    log('  [fetch] ' + name + ' -> 异常 ' + e.message + ' (' + (Date.now() - t) + 'ms)');
    return { ok: false, err: e.message };
  }
}

// ---- 3. OpenRouter 实时免费模型列表 ----
const OR_KEY = process.env.LLM_API_KEY || '';
log('\n--- OpenRouter 实时免费模型列表 ---');
let freeModels = [];
try {
  const r = await fetch('https://openrouter.ai/api/v1/models');
  const j = await r.json();
  const all = (j.data || []);
  freeModels = all.filter(m => (m.id || '').endsWith(':free')).map(m => m.id);
  log('  总模型数: ' + all.length + ' / 免费(:free) 数: ' + freeModels.length);
  log('  免费模型: ' + freeModels.join(', '));
} catch (e) {
  log('  拉取失败: ' + e.message);
}

// ---- 4. 逐个实测免费模型（限前 30 个，间隔 1.5s） ----
if (OR_KEY && freeModels.length) {
  log('\n--- 免费模型逐个实测 ---');
  const usable = [];
  for (const m of freeModels.slice(0, 30)) {
    const t = Date.now();
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OR_KEY },
        body: JSON.stringify({ model: m, messages: [{ role: 'user', content: '说"好"一个字' }], max_tokens: 8 })
      });
      const b = await r.text();
      if (r.status === 200) {
        log('  [可用] ' + m + ' (' + (Date.now() - t) + 'ms)');
        usable.push(m);
      } else {
        const msg = (JSON.parse(b).error || {}).message || b.slice(0, 80);
        log('  [' + r.status + '] ' + m + ' -> ' + msg.slice(0, 70));
      }
    } catch (e) {
      log('  [异常] ' + m + ' -> ' + e.message.slice(0, 60));
    }
    await new Promise(s => setTimeout(s, 1500));
  }
  log('\n  可用模型池 = ' + JSON.stringify(usable));
}

// ---- 5. GitHub Models ----
const GH = process.env.GH_MODELS_TOKEN || process.env.GITHUB_TOKEN || '';
log('\n--- GitHub Models ---');
log('  token 前缀: ' + GH.slice(0, 8) + '... 长度 ' + GH.length);
await nodeFetchTest('GitHub Models (fetch)', 'https://models.inference.ai.azure.com/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GH },
  body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: '说"好"一个字' }], max_tokens: 8 })
});
// curl 版本
if (GH) {
  try {
    const out = execSync(
      "curl -s -w '\\nHTTP=%{http_code}' --max-time 25 https://models.inference.ai.azure.com/chat/completions " +
      "-H 'Content-Type: application/json' -H 'Authorization: Bearer " + GH + "' " +
      "-d '{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":8}'",
      { encoding: 'utf-8' });
    log('  [curl] GitHub Models -> ' + out.trim().slice(-200).replace(/\n/g, ' '));
  } catch (e) { log('  [curl] GitHub Models 异常 ' + e.message.slice(0, 120)); }
}

fs.writeFileSync('data/_diag2.txt', lines.join('\n'));
log('\n=== 诊断结束，已写入 data/_diag2.txt ===');
