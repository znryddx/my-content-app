#!/usr/bin/env node
// 屏风柜子文案 · 每日生成器（OpenRouter 免费通道版，已对齐主站 generate.py）
// 用法:
//   node scripts/gen-pingfenguizi.js                 # 生成今天
//   node scripts/gen-pingfenguizi.js 2026-08-28     # 生成指定日期
//
// 数据源(优先级): 复用仓库已有的 OpenRouter 免费通道(与主站「这男人有点东西」同款)
//   1) LLM_API_KEY + OpenRouter  -> 真实 AI 生成(每日新鲜, 不轮播)
//   2) 调用失败/无 key           -> 仅用内置固定模板兜底(绝不复制已有日期内容)
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
    '7. 直接以 { 开头输出 JSON，结尾以 } 结束，中间不要任何说明文字。',
  ].join('\n');
}

// 内置兜底模板：仅在 AI 调用全部失败时启用，绝不复制已有日期的数据（避免轮播）
const FALLBACK_FULL = {
  screen_baibao: [
    { type: 'short', text: '一扇屏风，半掩半露，把喧嚣挡在门外，把山水请进屋里。' },
    { type: 'short', text: '百宝嵌的妙处，在于把玉石、螺钿、珐琅都嵌成一幅画，方寸之间见天地。' },
    { type: 'long', text: '百宝嵌是宫廷里最舍得下料的工艺：把白玉、青金、珊瑚、螺钿、珐琅各色珍材，按画稿一点点嵌进木胎，远观是一幅山水人物，近看每一寸都是不同材质的接缝。这扇屏风用的是传统的大漆打底、随形开槽、逐片镶嵌，光从侧面打来，玉的润、螺的亮、珐琅的厚各归其位。' },
    { type: 'long', text: '屏风的本职是"隔"，但百宝嵌屏风隔的是分寸。客厅与餐厅之间立一扇，既不全封死也不全敞开，留一道可望不可即的景。题材选缠枝花卉，寓连绵不绝；木胎用老榆木，稳定不开裂。' },
    { type: 'vip', text: '这一扇百宝嵌，不是谁家都摆得起——青金、白玉、珊瑚同框，光材料就是一道门槛，更别说逐片镶嵌的手工。' },
    { type: 'culture', text: '百宝嵌起于明、盛于清，是宫廷把"天下珍材"收进一方屏风的本事。我们复刻仍按古法大漆打底、随形镶嵌，每月只接少量定制，需排期。' },
  ],
  cabinet_baibao: [
    { type: 'short', text: '一只百宝嵌柜子，把柴米油盐收进去，把风雅气韵露出来。' },
    { type: 'short', text: '柜门一关，是烟火日常；柜门一开，是百宝嵌的流光。' },
    { type: 'long', text: '百宝嵌柜子，是"藏"与"露"的教科书。柜门用百宝嵌做成一幅画，关上是排场，开后是日用——里头格子按你的杂物尺寸分好，茶器、香具、账册各归其位。木胎先大漆再嵌珍材，耐磨耐潮，南方梅雨季也不怕。' },
    { type: 'long', text: '传家的物件，往往不是金条，是天天用却不糟蹋的那件。百宝嵌柜子就是：玉钮、螺钿面、实木骨，每天开合几十次，十年后包浆比新买时更润。榫卯结构不用一根钉，搬家拆装都不散。' },
    { type: 'vip', text: '百宝嵌柜在家具体系里是"重器"，摆一只，整个空间的身份就定了。它不说话，但来客都知道这家主人不将就。' },
    { type: 'culture', text: '百宝嵌柜子的讲究，苏州老话叫"满堂嵌"。我们复刻这路数，木胎大漆、逐片镶嵌。到店可看不同珍材光感，定制内部格局，工期约两月。' },
  ],
  screen_luodian: [
    { type: 'short', text: '螺钿屏风的浪漫，在于光一转，整幅画就泛起彩虹的鳞片。' },
    { type: 'short', text: '贝母嵌进木里，把海的细碎星光，搬进了书房。' },
    { type: 'long', text: '螺钿的浪漫在于"借光"。白天平平无奇的深色屏风，夜里灯一暖，贝母里嵌的海光就浮出来——蓝的、紫的、银的，随你走动角度变。题材"夜宴图"，烛光下人物衣袂泛光，像把一场宋人夜宴搬进了客厅。' },
    { type: 'long', text: '说螺钿就得说"随光流彩"。贝母切细条拼成水波纹，光一斜整片水面就像在动。题材"柳塘乳鸭"，春意很足，挂餐厅或茶室都提神。工艺难点在拼接：每片贝厚薄必须一致，否则光打上去会斑驳。' },
    { type: 'vip', text: '螺钿屏风是给"懂雅"的人留的——它不亮时素净，亮时惊艳，像那种不张扬却一眼被记住的人。' },
    { type: 'culture', text: '螺钿古称"钿螺"，宋元已有，明清臻于极。我们沿用磨贝随光嵌片的古法，不刷漆仿光。每扇光感各异，限量出品，私洽留位。' },
  ],
  cabinet_luodian: [
    { type: 'short', text: '一只螺钿柜子，柜门一开一合，像把海的波光也关进了屋里。' },
    { type: 'short', text: '螺钿柜面嵌的是贝母，收的是杂物，亮的是日子的光。' },
    { type: 'long', text: '螺钿柜，是把"雅"做进了日用。柜面嵌贝母，收的是茶、香、零碎，亮的是过日子的讲究。上柜下几，柜门贝光拼成缠枝，开合间像把一片海光关进关出。内部活动层板，茶器、手账、首饰都能装。' },
    { type: 'long', text: '柜面泛七彩的不是漆，是螺钿。鲍鱼贝做主光，蓝绿紫随角度流转，题材"荷塘"，夏日最清凉。贝片薄到透光又不能裂，嵌完整体打磨，摸上去平、看进去亮。放卧室夜里台灯一照，浮一层幽光。' },
    { type: 'vip', text: '螺钿柜是"雅"的硬通货——不喧嚣，却让每个进屋的人，默默把你归进"懂生活"那一档。' },
    { type: 'culture', text: '螺钿柜的工艺，江南老作坊叫"嵌螺甸"。我们复刻这手艺，不做满嵌、留木底呼吸。开放定制，按你办公室或卧室尺寸排期，到店详谈。' },
  ],
};

function normalize(cats) {
  return CATS.map((c) => {
    const found = (cats || []).find((x) => x && x.id === c.id);
    let items = found && Array.isArray(found.items) ? found.items : [];
    items = items.filter((it) => it && typeof it === 'object' && TYPES.includes(it.type) && typeof it.text === 'string' && it.text.trim());
    return { id: c.id, label: c.label, items: items.length >= 20 ? items.slice(0, 30) : null };
  });
}

function fallbackData(date) {
  // 关键：只使用内置固定模板，绝不读取/复制仓库里已有日期的数据（杜绝轮播）
  return { date, cats: CATS.map((c) => ({ id: c.id, label: c.label, items: (FALLBACK_FULL[c.id] || []).slice() })) };
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

// OpenRouter 免费通道（对齐主站 generate.py：无 json_object、90s 超时、模型池重试）
const FALLBACK_MODELS = [
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
];
async function callLLM(prompt) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const primary = process.env.LLM_MODEL || process.env.SC_MODEL;
  const models = [];
  if (primary && !models.includes(primary)) models.push(primary);
  FALLBACK_MODELS.forEach((m) => { if (!models.includes(m)) models.push(m); });
  let lastErr = null;
  for (const m of models) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], temperature: 0.9 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
      const j = await res.json();
      const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!c) { lastErr = '空内容'; continue; }
      return c;
    } catch (e) { lastErr = e.message; }
  }
  throw new Error('所有模型失败: ' + lastErr);
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
    const txt = await callLLM(prompt);
    if (txt) { data = parseModel(txt); source = 'openrouter'; }
  } catch (e) { console.warn('[warn] OpenRouter 失败:', e.message); }
  if (!data) {
    data = fallbackData(date);
    source = 'fixed-template';
  }
  data.date = date;
  writeData(date, data);
  const total = data.cats.reduce((s, c) => s + c.items.length, 0);
  console.log('[完成] 来源 =', source, '| 分类 =', data.cats.length, '| 文案合计 =', total);
  console.log('[输出]', path.join(OUT_DIR, date + '.json'));
})();
