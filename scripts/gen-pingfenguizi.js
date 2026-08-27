#!/usr/bin/env node
// 屏风柜子文案 · 每日生成器（OpenRouter 免费通道版）
// 用法:
//   node scripts/gen-pingfenguizi.js                 # 生成今天
//   node scripts/gen-pingfenguizi.js 2026-08-27     # 生成指定日期
//
// 数据源(优先级): 复用仓库已有的 OpenRouter 免费通道(与主站「这男人有点东西」同款)
//   1) LLM_API_KEY + OpenRouter  -> 真实 AI 生成(每日新鲜, 不轮播)
//   2) 调用失败/无 key           -> 回退到仓库内已有同结构模板(保证每天有内容)
//
// 输出: data/pingfenguizi/<date>.json + data/pingfenguizi/dates.json
// 类型 type ∈ short(短句) / long(长文案) / vip(高净值客群) / culture(文化营销)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'pingfenguizi');
const CATS = [
  { id: 'screen_baibao',  label: '屏风文案（百宝嵌）' },
  { id: 'cabinet_baibao', label: '柜子文案（百宝嵌）' },
  { id: 'screen_luodian', label: '屏风文案（螺钿）' },
  { id: 'cabinet_luodian',label: '柜子文案（螺钿）' },
];
const TYPES = ['short', 'long', 'vip', 'culture'];

function todayStr() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function buildPrompt() {
  return [
    '你是东方器物文创品牌的内容运营。请为「屏风 / 柜子」品类撰写【朋友圈发布商品的文案】。',
    '必须严格输出 JSON，不要任何解释、不要 markdown 代码块包裹。结构：',
    '{"cats":[',
    '  {"id":"screen_baibao","label":"屏风文案（百宝嵌）","items":[{"type":"short","text":"文案"},...]},',
    '  {"id":"cabinet_baibao","label":"柜子文案（百宝嵌）","items":[...]},',
    '  {"id":"screen_luodian","label":"屏风文案（螺钿）","items":[...]},',
    '  {"id":"cabinet_luodian","label":"柜子文案（螺钿）","items":[...]}',
    ']}',
    '要求：',
    '1. 每个分类的 items 必须正好 24 条，其中 type 取值 short/long/vip/culture 各 6 条。',
    '2. 类型口径：short=美学金句(1~3句); long=材质/工艺/场景叙事(150~300字); vip=高净值客群(稀缺/圈层/身份/收藏/传家/送礼); culture=文化营销(文化叙事+成交引导:私洽/限量/定制/到店/分期)。',
    '3. 风格多样：美学金句、场景种草(玄关/客厅/书房/茶室/卧室)、工艺科普、送礼推荐、文人意境、空间美学、收藏价值、日常陪伴都要覆盖。',
    '4. 百宝嵌=多材质镶嵌成画的宫廷工艺，显"富"; 螺钿=贝壳磨薄片镶嵌出七彩流光，显"雅"。屏风管「隔断/立屏/山水/聚气」，柜子管「收纳/藏露/镇宅/传家」。',
    '5. 不夸大、不涉医疗、不用绝对化迷信用语；螺钿突出"随光流彩/贝光/海的光"。四条分类口径不要混。',
    '6. 务必与常见文案不同，避免陈词滥调，写出有东方美学质感、能直接发朋友圈的句子。',
  ].join('\n');
}

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

function readTemplate() {
  if (!fs.existsSync(OUT_DIR)) return null;
  let files = [];
  try { files = fs.readdirSync(OUT_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)); } catch (e) { return null; }
  if (!files.length) return null;
  files.sort();
  try {
    const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, files[files.length - 1]), 'utf8'));
    if (d && Array.isArray(d.cats) && d.cats.length === 4) return d;
  } catch (e) {}
  return null;
}

function normalize(cats) {
  return CATS.map((c) => {
    const found = (cats || []).find((x) => x && x.id === c.id);
    let items = found && Array.isArray(found.items) ? found.items : [];
    items = items.filter((it) => it && typeof it === 'object' && TYPES.includes(it.type) && typeof it.text === 'string' && it.text.trim());
    return { id: c.id, label: c.label, items: items.length >= 20 ? items.slice(0, 30) : null };
  });
}

function fallbackData(date) {
  const tpl = readTemplate();
  if (tpl) {
    const cats = normalize(tpl.cats);
    if (cats.every((c) => c.items)) return { date, cats: cats.map((c) => ({ id: c.id, label: c.label, items: c.items })) };
  }
  return { date, cats: CATS.map((c) => ({ id: c.id, label: c.label, items: (MIN_FALLBACK[c.id] || []).slice() })) };
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

// OpenRouter 免费通道(复用主站同款 LLM_API_KEY)
async function callLLM(prompt, model) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const m = model || process.env.LLM_MODEL || 'google/gemma-4-31b-it:free';
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: m,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error('LLM HTTP ' + res.status);
  const j = await res.json();
  const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!c) throw new Error('LLM 返回空内容');
  return c;
}

function writeData(date, data) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, date + '.json'), JSON.stringify(data, null, 2), 'utf8');
  let dates = [];
  const dp = path.join(OUT_DIR, 'dates.json');
  if (fs.existsSync(dp)) { try { dates = JSON.parse(fs.readFileSync(dp, 'utf8')); } catch (e) { dates = []; } }
  if (!dates.includes(date)) dates.push(date);
  dates = Array.from(new Set(dates)).sort();
  fs.writeFileSync(dp, JSON.stringify(dates, null, 2), 'utf8');
}

function fileExistsGood(date) {
  const fp = path.join(OUT_DIR, date + '.json');
  if (!fs.existsSync(fp)) return false;
  try {
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return Array.isArray(d.cats) && d.cats.length === 4 && d.cats.every((c) => Array.isArray(c.items) && c.items.length >= 20);
  } catch (e) { return false; }
}

(async () => {
  const date = process.argv[2] || todayStr();
  // 当天已有真实内容(>=20条/类)则跳过, 不覆盖手工精修
  if (fileExistsGood(date)) {
    console.log('[跳过] ' + date + ' 已有完整内容, 不覆盖');
    return;
  }
  console.log('[生成] 日期 =', date);
  const prompt = buildPrompt();
  let data = null;
  let source = 'fallback';
  try {
    const txt = await callLLM(prompt, process.env.SC_MODEL || process.env.LLM_MODEL);
    if (txt) { data = parseModel(txt); source = 'openrouter'; }
  } catch (e) { console.warn('[warn] OpenRouter 失败:', e.message); }
  if (!data) data = fallbackData(date);
  data.date = date;
  writeData(date, data);
  const total = data.cats.reduce((s, c) => s + c.items.length, 0);
  console.log('[完成] 来源 =', source, '| 分类 =', data.cats.length, '| 文案合计 =', total);
  console.log('[输出]', path.join(OUT_DIR, date + '.json'));
})();
