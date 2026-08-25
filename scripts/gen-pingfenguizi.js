#!/usr/bin/env node
// 屏风柜子文案 · 每日生成器
// 用法:
//   node scripts/gen-pingfenguizi.js                 # 生成今天
//   node scripts/gen-pingfenguizi.js 2026-08-26     # 生成指定日期
//
// 数据源(优先级):
//   1) GITHUB_TOKEN  +  GitHub Models(免费额度)  -> 真实 AI 生成
//   2) OPENAI_API_KEY + OpenAI                    -> 真实 AI 生成
//   3) 无 token 或调用失败                        -> 回退内置高质量文案(保证每天有内容)
//
// 输出:
//   data/pingfenguizi/<date>.json   ( { date, cats:[{id,label,items:[...]}] } )
//   data/pingfenguizi/dates.json     ( 日期数组, 升序去重 )

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'pingfenguizi');

const CATS = [
  { id: 'pf_bbq', label: '屏风文案（百宝嵌）' },
  { id: 'gz_bbq', label: '柜子文案（百宝嵌）' },
  { id: 'pf_ld',  label: '屏风文案（螺钿）' },
  { id: 'gz_ld',  label: '柜子文案（螺钿）' },
];

function todayStr() {
  const d = new Date();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + day;
}

function buildPrompt() {
  return [
    '你是东方器物文创品牌的内容运营。请为「屏风 / 柜子」品类撰写【朋友圈发布商品的文案】。',
    '必须严格输出 JSON，不要任何解释、不要 markdown 代码块包裹。结构：',
    '{"cats":[',
    '  {"id":"pf_bbq","label":"屏风文案（百宝嵌）","items":["文案1","文案2",...,"文案22"]},',
    '  {"id":"gz_bbq","label":"柜子文案（百宝嵌）","items":[...22条]},',
    '  {"id":"pf_ld","label":"屏风文案（螺钿）","items":[...22条]},',
    '  {"id":"gz_ld","label":"柜子文案（螺钿）","items":[...22条]}',
    ']}',
    '要求：',
    '1. 每个 items 必须正好 22 条，每条是一条可直接发朋友圈的商品文案（1~4 句，含蓄有东方美学，适合卖货但不硬凹）。',
    '2. 文案风格要多样：美学金句、场景种草(玄关/客厅/书房/茶室/卧室)、工艺科普(什么是百宝嵌/螺钿)、送礼推荐、文人意境、空间美学、收藏价值、日常陪伴都要覆盖。',
    '3. 百宝嵌=多材质镶嵌(玉石/螺钿/珐琅/珊瑚/青金等)成画的工艺；螺钿=贝壳磨成薄片镶嵌出七彩流光的工艺。屏风管「隔断/立屏/山水/聚气」，柜子管「收纳/藏露/镇宅/传家」。',
    '4. 不夸大、不涉医疗功效、不用绝对化迷信用语；螺钿文案要突出"随光流彩/贝光/海的光"的意象。',
    '5. 四条分类口径不要混：屏风≠柜子，百宝嵌≠螺钿。',
  ].join('\n');
}

// ---------- 内置回退文案(无需联网也可每天有内容) ----------
const FALLBACK = {
  pf_bbq: [
    '一扇屏风，半掩半露，把喧嚣挡在门外，把山水请进屋里。',
    '百宝嵌的妙处，在于把玉石、螺钿、珐琅都嵌成一幅画，方寸之间见天地。',
    '玄关立一扇百宝嵌屏风，进门第一眼，就是东方人的体面。',
    '不是所有的屏风都叫百宝嵌——那是把多种珍材，一针一线嵌进木骨的功夫。',
    '客厅留白处，一扇屏风足够撑起整面墙的意境。',
    '百宝嵌屏风，远看是画，近看是工，伸手摸得到时间的厚度。',
    '周末宅家，泡壶茶，对着屏风上的花鸟发会儿呆，比刷手机治愈。',
    '屏风不只是隔断，是中国人“犹抱琵琶半遮面”的含蓄美学。',
    '一扇好的百宝嵌，嵌的是材料，藏的是匠心，立的是气场。',
    '把山水屏风立在书房，伏案久了抬头，便是一场 micro 旅行。',
    '新房软装不知道摆什么？一扇百宝嵌屏风，镇得住场也暖得了屋。',
    '百宝嵌的配色从不喧哗，象牙白、松石绿、珊瑚红，都是老祖宗的审美。',
    '送礼送屏风，送的是“挡煞纳福”的好意头，也送得出手面。',
    '螺钿、玉石、青金，百宝嵌把大地的颜色都收进了一扇屏风。',
    '比起挂画，我更爱立屏——它是立体的，是有呼吸的墙。',
    '一扇屏风隔出茶席，朋友来了，围坐之间自有分寸与温度。',
    '百宝嵌是“慢”的工艺，今天愿意慢下来的，才配得上它。',
    '玄关、客厅、卧室，一扇屏风能盘活三个空间的动线。',
    '把日子过成画，先从立一扇百宝嵌屏风开始。',
    '老话说“屏风聚气”，立一扇在厅中，家的气场就稳了。',
    '看百宝嵌要凑近：每一片镶嵌都严丝合缝，是机器给不了的体温。',
    '东方人的高级感，往往藏在这一扇“挡而不封”的屏风里。',
  ],
  gz_bbq: [
    '一只百宝嵌柜子，把柴米油盐收进去，把风雅气韵露出来。',
    '柜门一关，是烟火日常；柜门一开，是百宝嵌的流光。',
    '客厅角落立一只百宝嵌柜，既不占地，又镇得住房子的魂。',
    '百宝嵌柜子最懂中国人——藏与露，都在一扇门之间。',
    '玄关放一只小百宝嵌柜，钥匙、香、信件都有了体面的去处。',
    '柜面嵌的是螺钿与玉石，开合之间，像在翻一本立体工笔画。',
    '老柜子的好，在于它能装下三代人的小物件，也装得下审美。',
    '茶室配一只百宝嵌柜，茶叶、茶器、香具各归其位，井井有条。',
    '送礼送柜子，实用又体面，长辈一眼就懂你的用心。',
    '百宝嵌柜不是摆设，它是会发光的收纳——美和好用本来就该在一起。',
    '卧室一隅的百宝嵌柜，收的是首饰，亮的是心情。',
    '一只柜子的讲究，在漆面、在铜活、在嵌工，差一点都不行。',
    '把百宝嵌柜立在过道，原本尴尬的转角，成了家里的视觉锚点。',
    '柜门上的百宝嵌花鸟，是会随光变幻的小世界。',
    '比起成品衣柜，我更想有一只自己的百宝嵌老柜，装故事。',
    '百宝嵌柜子，是“有用”与“有品”之间最短的那条路。',
    '朋友来家总被这只柜子勾住目光——好的器物自己会说话。',
    '新中式装修的题眼，往往就是一只恰到好处的百宝嵌柜。',
    '柜子里收的是生活，柜面上嵌的是山河，一举两得。',
    '挑柜子看三处：木性稳不稳、嵌工密不密、铜活亮不亮。',
    '一只百宝嵌柜陪在身边，日子都显得更妥帖了些。',
    '收藏一只好柜子，是给自己未来的家留一件传得下去的物。',
  ],
  pf_ld: [
    '螺钿屏风的浪漫，在于光一转，整幅画就泛起彩虹的鳞片。',
    '贝母嵌进木里，把海的细碎星光，搬进了书房。',
    '一扇螺钿屏风，是留给人间的“流光”——不动也在闪。',
    '螺钿不喧哗，它只在光的角度对了的时候，悄悄亮给你看。',
    '客厅立一扇螺钿屏风，白天是素雅，夜里灯下是流彩。',
    '古人把夜空的星河磨成贝片，嵌成屏风，这浪漫藏了千年。',
    '螺钿屏风最配茶席，煮水时水汽氤氲，贝光也跟着呼吸。',
    '比起满墙装饰画，一扇会反光的螺钿屏风更有记忆点。',
    '螺钿是“捡”来的美——贝壳本是无用，嵌进器物便成了珍宝。',
    '玄关一扇螺钿屏风，迎客第一眼，是低调的高级。',
    '螺钿的彩，是彩虹被压扁后藏进木纹里的那种温柔。',
    '把螺钿屏风立在窗边，日光斜进来，满室都是碎光。',
    '送礼挑螺钿屏风，送的是“流光溢彩”的好彩头。',
    '螺钿屏风的细节，要斜着光看：每一片贝都朝向不同的方向。',
    '一扇螺钿，半室生辉，中国人早把光玩明白了。',
    '比起石材的冷，螺钿是温的，是带着海体温度的光。',
    '书房立螺钿，伏案抬头，眼底便落了一层粼粼波光。',
    '螺钿屏风，是“不动声色地耀眼”这件事的东方解法。',
    '新房软装缺一个亮点？一扇螺钿屏风立起来，全屋都活了。',
    '螺钿之美，在于它不抢戏，却让整面墙都显得贵了。',
    '把海的细碎收进一扇屏风，是古人写给生活的情书。',
    '一盏灯、一扇螺钿、一杯茶，夜里的仪式感就这么成了。',
  ],
  gz_ld: [
    '一只螺钿柜子，柜门一开一合，像把海的波光也关进了屋里。',
    '螺钿柜面嵌的是贝母，收的是杂物，亮的是日子的光。',
    '客厅角落的螺钿柜，白天安静，夜里灯下自己会发光。',
    '螺钿柜子最懂“藏拙露巧”——外表沉稳，开门见彩。',
    '玄关一只螺钿小柜，钥匙香具有了去处，进门也有了好心情。',
    '柜门上的螺钿花鸟，随着你走动的角度，闪出不同的彩。',
    '老柜子配螺钿，是旧木与新光的相遇，越看越耐看。',
    '茶室一只螺钿柜，茶叶茶器收得整齐，开合间还有惊喜的光。',
    '送礼送螺钿柜，实用体面，还带“流光溢彩”的好意头。',
    '螺钿柜不是冷冰冰的家具，它是会随光变脸的收纳。',
    '卧室一隅的螺钿柜，收首饰也收心情，开柜门像开盲盒的光。',
    '一只柜子的气质，看螺钿嵌得密不密、贝片选得纯不纯。',
    '螺钿柜立在过道转角，原本平庸的角落，成了拍照的 C 位。',
    '螺钿柜门上的光，是贝壳替你留的一小片海。',
    '比起工业感成品柜，我更想要一只会发光的螺钿老柜。',
    '螺钿柜子，把“收纳”这件事，做得又体面又浪漫。',
    '朋友进家总被这只螺钿柜吸住——器物自己会发光，自然吸睛。',
    '新中式空间的灵魂件，常常就是一只螺钿柜。',
    '柜里收的是琐碎，柜面嵌的是星河，烟火与诗意一并拿下。',
    '挑螺钿柜看三点：木胎稳、嵌工密、贝光润。',
    '一只螺钿柜陪在身旁，连收纳都成了每天都想做的小确幸。',
    '收一只好螺钿柜，是给未来的家，先藏进一束会生长的光。',
  ],
};

function fallbackData(date) {
  return {
    date,
    cats: CATS.map((c) => ({ id: c.id, label: c.label, items: FALLBACK[c.id].slice() })),
  };
}

function parseModel(text) {
  // 容错：去掉可能的 ```json 包裹
  let t = String(text || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  const obj = JSON.parse(t);
  if (!obj || !Array.isArray(obj.cats)) throw new Error('返回结构缺少 cats 数组');
  // 校验/补齐
  return {
    date: obj.date,
    cats: CATS.map((c) => {
      const found = (obj.cats || []).find((x) => x.id === c.id);
      const items = (found && Array.isArray(found.items) && found.items.length >= 20)
        ? found.items.slice(0, 30)
        : FALLBACK[c.id].slice();
      return { id: c.id, label: c.label, items };
    }),
  };
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
    // OpenAI 的 chat 接口用 messages 字段
  }).catch(async () => {
    // 兼容部分只支持 prompt 的镜像(极少见)，忽略
    return null;
  });
  if (!res || !res.ok) throw new Error('OpenAI HTTP ' + (res && res.status));
  const j = await res.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

function writeData(date, data) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, date + '.json'), JSON.stringify(data, null, 2), 'utf8');
  // dates.json
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

  // 3) Fallback
  if (!data) data = fallbackData(date);

  data.date = date;
  writeData(date, data);
  const total = data.cats.reduce((s, c) => s + c.items.length, 0);
  console.log('[完成] 来源 =', source, '| 分类 =', data.cats.length, '| 文案合计 =', total);
  console.log('[输出]', path.join(OUT_DIR, date + '.json'));
})();
