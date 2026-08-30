#!/usr/bin/env node
// 扫描 OpenRouter 当前真正可用的免费模型（轻量探测，20 tokens/次）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'deepseek/deepseek-r1-distill-llama-70b:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen2.5-vl-72b-instruct:free',
  'qwen/qwen3-14b:free',
  'mistralai/mistral-nemo:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'microsoft/phi-4-reasoning:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'thudm/glm-4-9b:free',
  'z-ai/glm-4.5-air:free',
  'moonshotai/kimi-vl-a3b-thinking:free',
  'tng/deepseek-r1t2-chimera:free',
];

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

(async () => {
  const key = process.env.LLM_API_KEY;
  log('=== OpenRouter 免费模型可用性扫描 ' + new Date().toISOString() + ' ===');
  if (!key) { log('无 LLM_API_KEY'); return; }
  log('key 前缀: ' + key.slice(0, 7) + '...');
  log('');

  const ok = [];
  const limited = [];
  const dead = [];

  for (const m of MODELS) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: '回复：好' }],
          max_tokens: 10,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      let brief = '';
      try {
        const j = await res.json();
        brief = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content)
          ? ('返回: ' + String(j.choices[0].message.content).slice(0, 20))
          : (j.error ? ('错误: ' + String(j.error.message).slice(0, 90)) : '(无内容)');
      } catch (e) { brief = '(解析失败)'; }

      if (res.ok) { log('[可用] ' + m + ' (' + ms + 'ms) ' + brief); ok.push(m); }
      else if (res.status === 429) { log('[限流] ' + m + ' (' + ms + 'ms) ' + brief); limited.push(m); }
      else { log('[失效] ' + m + ' HTTP' + res.status + ' ' + brief); dead.push(m); }
    } catch (e) {
      log('[异常] ' + m + ' ' + e.message);
      dead.push(m);
    }
    // 每次间隔 1.2 秒，避免自己把自己限流
    await new Promise((r) => setTimeout(r, 1200));
  }

  log('');
  log('========== 汇总 ==========');
  log('可用 (' + ok.length + '): ' + (ok.join(', ') || '无'));
  log('限流 (' + limited.length + '): ' + (limited.join(', ') || '无'));
  log('失效 (' + dead.length + '): ' + (dead.join(', ') || '无'));
  log('');
  log('建议模型池 = ' + JSON.stringify(ok.concat(limited), null, 0));

  const outDir = path.join(ROOT, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '_models_scan.txt'), lines.join('\n'), 'utf8');
  log('已写入 data/_models_scan.txt');
})();
