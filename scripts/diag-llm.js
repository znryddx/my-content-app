#!/usr/bin/env node
// AI 通道诊断：依次测试 OpenRouter / GitHub Models，把结果写进 data/_llm_diag.txt
// 目的：Actions 日志下载域名被封，看不到日志，只能把诊断结果落盘到仓库里读。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

log('=== AI 通道诊断 ' + new Date().toISOString() + ' ===');
log('');

async function test(name, url, key, models) {
  log('--- 通道: ' + name + ' ---');
  log('  endpoint: ' + url);
  if (!key) {
    log('  !! 无 key（环境变量未提供）');
    log('');
    return;
  }
  log('  key 前缀: ' + key.slice(0, 7) + '... 长度 ' + key.length);
  for (const m of models) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: '只回复两个字：可用' }],
          max_tokens: 20,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch (e) { body = '(读取响应失败)'; }
      log('  [' + m + '] HTTP ' + res.status + ' (' + ms + 'ms)');
      log('    响应: ' + body.replace(/\s+/g, ' '));
      if (res.ok) { log('  ==> 该通道可用'); break; }
    } catch (e) {
      log('  [' + m + '] 异常: ' + e.message + ' (' + (Date.now() - t0) + 'ms)');
    }
  }
  log('');
}

(async () => {
  const orKey = process.env.LLM_API_KEY;
  const ghKey = process.env.GH_MODELS_TOKEN || process.env.GITHUB_TOKEN;

  await test('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', orKey, [
    'google/gemma-4-31b-it:free',
    'qwen/qwen3-32b:free',
  ]);
  await test('GitHubModels', 'https://models.inference.ai.azure.com/chat/completions', ghKey, [
    'openai/gpt-4.1-mini',
    'openai/gpt-4o-mini',
  ]);

  // 环境信息
  log('--- 环境变量存在性 ---');
  ['LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'SC_MODEL', 'GH_MODELS_TOKEN', 'GITHUB_TOKEN']
    .forEach((k) => log('  ' + k + ': ' + (process.env[k] ? '有 (长度' + process.env[k].length + ')' : '无')));
  log('');

  const outDir = path.join(ROOT, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '_llm_diag.txt'), lines.join('\n'), 'utf8');
  log('已写入 data/_llm_diag.txt');
})();
