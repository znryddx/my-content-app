#!/usr/bin/env node
// 屏风柜子文案 · 每日生成器
// 用法:
//   node scripts/gen-pingfenguizi.js                 # 生成今天
//   node scripts/gen-pingfenguizi.js 2026-08-26     # 生成指定日期
//
// 数据源(优先级):
//   1) GITHUB_TOKEN  +  GitHub Models(免费额度)  -> 真实 AI 生成
//   2) OPENAI_API_KEY + OpenAI                    -> 真实 AI 生成
//   3) 无 token / 调用失败 / 结构异常            -> 回退到仓库内已有的同结构模板(保证每天有内容且类型齐全)
//
// 输出(与种子文件结构一致):
//   data/pingfenguizi/<date>.json   ( { date, cats:[{id,label,items:[{type,text}]}] } )
//   data/pingfenguizi/dates.json     ( 日期数组, 升序去重 )
//
// 类型 type ∈ short(短句) / long(长文案) / vip(高净值客群) / culture(文化营销)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'pingfenguizi');

// 与种子文件 data/pingfenguizi/<date>.json 的 cat.id 保持一致
const CATS = [
  { id: 'screen_baibao',  label: '屏风文案（百宝嵌）' },
  { id: 'cabinet_baibao', label: '柜子文案（百宝嵌）' },
  { id: 'screen_luodian', label: '屏风文案（螺钿）' },
  { id: 'cabinet_luodian',label: '柜子文案（螺钿）' },
];
const TYPES = ['short', 'long', 'vip', 'culture'];

function todayStr() {
  // 用北京时间(Asia/Shanghai)算"今天"，避免 GitHub Actions runner 默认 UTC 导致生成慢一天的日期
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function buildPrompt() {
  return [
    '你是东方器物文创品牌的内容运营。请为「屏风 / 柜子」品类撰写【朋友圈发布商品的文案】。',
    '必须严格输出 JSON，不要任何解释、不要 markdown 代码块包裹。结构：',
    '{"cats":[',
    '  {"id":"screen_baibao","label":"屏风文案（百宝嵌）","items":[{"type":"short","text":"文案"},{"type":"long","text":"文案"},{"type":"vip","text":"文案"},{"type":"culture","text":"文案"},...]},',
    '  {"id":"cabinet_baibao","label":"柜子文案（百宝嵌）","items":[...]},',
    '  {"id":"screen_luodian","label":"屏风文案（螺钿）","items":[...]},',
    '  {"id":"cabinet_luodian","label":"柜子文案（螺钿）","items":[...]}',
    ']}',
    '要求：',
    '1. 每个分类的 items 必须正好 24 条，其中 type 取值 short/long/vip/culture 各 6 条（顺序不限）。',
    '2. 类型口径：short=美学金句(1~3句,含蓄有东方美学,适合快刷引流); long=材质/工艺/场景叙事(150~300字,讲清楚百宝嵌或螺钿的门道); vip=高净值客群(稀缺性/圈层/身份/收藏/传家/送礼有面子); culture=文化营销(文化叙事+成交引导:私洽/限量/定制/到店/分期)。',
    '3. 风格要多样：美学金句、场景种草(玄关/客厅/书房/茶室/卧室)、工艺科普、送礼推荐、文人意境、空间美学、收藏价值、日常陪伴都要覆盖，不要千篇一律。',
    '4. 百宝嵌=把玉石/螺钿/珐琅/青金等多材质镶嵌成画的宫廷工艺，显"富"; 螺钿=把贝壳磨成薄片镶嵌出七彩流光的工艺，显"雅"。屏风管「隔断/立屏/山水/聚气」，柜子管「收纳/藏露/镇宅/传家」。',
    '5. 不夸大、不涉医疗功效、不用绝对化迷信用语；螺钿文案突出"随光流彩/贝光/海的光"意象。四条分类口径不要混：屏风≠柜子，百宝嵌≠螺钿。',
  ].join('\n');
}

// 极端兜底(仅当仓库内连一份模板都读不到时)：每类给少量短句，保证不空
const MIN_FALLBACK = {
  screen_baibao: [
    { type: 'short', text: '一扇屏风，半掩半露，把喧嚣挡在门外，把山水请进屋里。' },
    { type: 'short', text: '百宝嵌的妙处，在于把玉石、螺钿、珐琅都嵌成一幅画，方寸之间见天地。' },
  ],
  cabinet_baibao: [
    { type: 'short', text: '一只百宝嵌柜子，把柴米油盐收进去，把风雅气韵露出来。' },
    { type: 'short', text: '柜门一关，是烟火日常；柜门一开，是百宝嵌的流光。' },
  ],
  screen_luodian: [
    { type: 'short', text: '螺钿屏风的浪漫，在于光一转，整幅画就泛起彩虹的鳞片。' },
    { type: 'short', text: '贝母嵌进木里，把海的细碎星光，搬进了书房。' },
  ],
  cabinet_luodian: [
    { type: 'short', text: '一只螺钿柜子，柜门一开一合，像把海的波光也关进了屋里。' },
    { type: 'short', text: '螺钿柜面嵌的是贝母，收的是杂物，亮的是日子的光。' },
  ],
};

// 读取仓库内已有的最新一份同结构文件作为模板(fallback 用)
function readTemplate() {
  if (!fs.existsSync(OUT_DIR)) return null;
  let files = [];
  try {
    files = fs.readdirSync(OUT_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch (e) { return null; }
  if (!files.length) return null;
  files.sort();
  try {
    const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, files[files.length - 1]), 'utf8'));
    if (d && Array.isArray(d.cats) && d.cats.length === 4) return d;
  } catch (e) {}
  return null;
}

// 校验/补齐：只接受 {type,text} 结构，type 合法、text 非空；不足 20 条则判无效
function normalize(cats) {
  return CATS.map((c) => {
    const found = (cats || []).find((x) => x && x.id === c.id);
    let items = found && Array.isArray(found.items) ? found.items : [];
    items = items.filter(
      (it) => it && typeof it === 'object' && TYPES.includes(it.type) && typeof it.text === 'string' && it.text.trim()
    );
    return { id: c.id, label: c.label, items: items.length >= 20 ? items.slice(0, 30) : null };
  });
}

function fallbackData(date) {
  const tpl = readTemplate();
  if (tpl) {
    const cats = normalize(tpl.cats);
    if (cats.every((c) => c.items)) {
      return { date, cats: cats.map((c) => ({ id: c.id, label: c.label, items: c.items })) };
    }
  }
  return {
    date,
    cats: CATS.map((c) => ({ id: c.id, label: c.label, items: (MIN_FALLBACK[c.id] || []).slice() })),
  };
}

function parseModel(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  const obj = JSON.parse(t);
  if (!obj || !Array.isArray(obj.cats)) throw new Error('返回结构缺少 cats 数组');
  const cats = normalize(obj.cats);
  if (cats.some((c) => !c.items)) throw new Error('某分类 items 不足 20 条或格式异常');
  return { date: obj.date, cats };
}

async function callGitHubModels(prompt, model) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const endpoint = process.env.GITHUB_MODELS_ENDPOINT || 'https://models.inference.ai.azure.com/chat/completions';
  const m = model || 'gpt-4o-mini';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      model: m,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error('GitHub Models HTTP ' + res.status);
  const j = await res.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

async function callOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res || !res.ok) throw new Error('OpenAI HTTP ' + (res && res.status));
  const j = await res.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

function writeData(date, data) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, date + '.json'), JSON.stringify(data, null, 2), 'utf8');
  let dates = [];
  const dp = path.join(OUT_DIR, 'dates.json');
  if (fs.existsSync(dp)) {
    try { dates = JSON.parse(fs.readFileSync(dp, 'utf8')); } catch (e) { dates = []; }
  }
  if (!dates.includes(date)) dates.push(date);
  dates = Array.from(new Set(dates)).sort();
  fs.writeFileSync(dp, JSON.stringify(dates, null, 2), 'utf8');
}

(async () => {
  const date = process.argv[2] || todayStr();
  console.log('[生成] 日期 =', date);
  const prompt = buildPrompt();
  let data = null;
  let source = 'fallback';

  // 1) GitHub Models
  try {
    const txt = await callGitHubModels(prompt, process.env.SC_MODEL);
    if (txt) { data = parseModel(txt); source = 'github-models'; }
  } catch (e) { console.warn('[warn] GitHub Models 失败:', e.message); }

  // 2) OpenAI
  if (!data) {
    try {
      const txt = await callOpenAI(prompt, process.env.SC_MODEL);
      if (txt) { data = parseModel(txt); source = 'openai'; }
    } catch (e) { console.warn('[warn] OpenAI 失败:', e.message); }
  }

  // 3) Fallback(模板或内置)
  if (!data) data = fallbackData(date);

  data.date = date;
  writeData(date, data);
  const total = data.cats.reduce((s, c) => s + c.items.length, 0);
  console.log('[完成] 来源 =', source, '| 分类 =', data.cats.length, '| 文案合计 =', total);
  console.log('[输出]', path.join(OUT_DIR, date + '.json'));
})();
