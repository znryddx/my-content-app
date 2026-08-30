#!/usr/bin/env node
// 屏风柜子文案 · 每日生成器
// 用法:
//   node scripts/gen-pingfenguizi.js                 # 生成今天
//   node scripts/gen-pingfenguizi.js 2026-08-30      # 生成指定日期
//
// 输出: data/pingfenguizi/<date>.json + dates.json
// 类型: short(短句) / long(长文案) / vip(高净值客群) / culture(文化营销)
//
// 【本次修复要点】
// 1) 按"分类"分批调用 AI：原来要求一次吐 4 类 × 24 条（含长文案），远超免费模型
//    输出上限，JSON 必然被截断 -> 解析失败 -> 只能回退 6 条模板。现改为每类单独
//    调用一次，单次输出量降到 1/4，成功率显著提升。
// 2) 双通道：OpenRouter 免费模型池 -> 失败自动切 GitHub Models（Actions 自带
//    GITHUB_TOKEN，零成本零配置），避免单一供应商限流导致日更中断。
// 3) 兜底模板扩到每类 24 条（四种类型各 6 条），AI 部分失败时按类型智能补足，
//    保证任何情况下每类都不低于 20 条。
// 4) 兜底绝不读取/复制仓库里已有日期的数据，从根上杜绝"轮播"。

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
// 展示顺序：短句 -> 金句 -> 长文案 -> 高净值客群 -> 文化营销
const TYPES = ['short', 'quote', 'long', 'vip', 'culture'];
const PER_TYPE = 6;                 // 每类型目标条数 -> 每类 30 条
const TARGET = TYPES.length * PER_TYPE;

const CAT_BRIEF = {
  screen_baibao:  '品类=屏风，工艺=百宝嵌（多材质镶嵌成画的宫廷工艺，玉石/青金/珊瑚/螺钿/珐琅，显"富"与"重"）',
  cabinet_baibao: '品类=柜子，工艺=百宝嵌（多材质镶嵌，讲究藏与露、收纳与排场、传家）',
  screen_luodian: '品类=屏风，工艺=螺钿（贝壳磨薄片镶嵌，随光流彩、贝光、海的光，显"雅"）',
  cabinet_luodian:'品类=柜子，工艺=螺钿（黑漆螺钿，平嵌、开合之间见流光，日用之雅）',
};

function todayStr() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------- 内置兜底模板（每类 24 条，AI 全部失败时启用，绝不复制历史数据） ----------
const FALLBACK_FULL = {
  "screen_baibao": [
    {
      "type": "short",
      "text": "一扇屏风，半掩半露，把喧嚣挡在门外，把山水请进屋里。"
    },
    {
      "type": "short",
      "text": "百宝嵌的妙处，在于把玉石、螺钿、珐琅都嵌成一幅画，方寸之间见天地。"
    },
    {
      "type": "long",
      "text": "百宝嵌是宫廷里最舍得下料的工艺：把白玉、青金、珊瑚、螺钿、珐琅各色珍材，按画稿一点点嵌进木胎，远观是一幅山水人物，近看每一寸都是不同材质的接缝。这扇屏风用的是传统的大漆打底、随形开槽、逐片镶嵌，光从侧面打来，玉的润、螺的亮、珐琅的厚各归其位。"
    },
    {
      "type": "long",
      "text": "屏风的本职是\"隔\"，但百宝嵌屏风隔的是分寸。客厅与餐厅之间立一扇，既不全封死也不全敞开，留一道可望不可即的景。题材选缠枝花卉，寓连绵不绝；木胎用老榆木，稳定不开裂。"
    },
    {
      "type": "vip",
      "text": "这一扇百宝嵌，不是谁家都摆得起——青金、白玉、珊瑚同框，光材料就是一道门槛，更别说逐片镶嵌的手工。"
    },
    {
      "type": "culture",
      "text": "百宝嵌起于明、盛于清，是宫廷把\"天下珍材\"收进一方屏风的本事。我们复刻仍按古法大漆打底、随形镶嵌，每月只接少量定制，需排期。"
    },
    {
      "type": "short",
      "text": "晨光斜进来，屏风上的玉石先醒，屋子里的人后醒。"
    },
    {
      "type": "short",
      "text": "一扇屏风，把四十平的客厅，隔出三段不同的心境。"
    },
    {
      "type": "short",
      "text": "珊瑚是暖的，青金是冷的，嵌在一处，刚好是人间温度。"
    },
    {
      "type": "short",
      "text": "不说话的屏风，替主人挡掉了八成的客套。"
    },
    {
      "type": "long",
      "text": "这扇屏风从白坯到成品，走了一百四十天。第一步是选木，老榆木要放在通风处阴干两年，含水率降到十二以下才敢动刀；第二步是打漆胎，大漆要髹七遍，每遍都得等它自然干透再磨平；第三步才是镶嵌，玉石、青金、珊瑚、螺钿按画稿分片开槽，一片一片坐进去，误差超过半毫米就要起出来重做。你看到的“一幅画”，背后是一百四十天的耐心。"
    },
    {
      "type": "long",
      "text": "很多客户问：百宝嵌和彩绘屏风有什么区别？区别在光。彩绘是平的，光打上去只有一种反射；百宝嵌是立体的，玉是油脂光、螺钿是虹彩光、珐琅是釉光、青金是哑光，同一束光落在同一扇屏风上，会分出四种层次。所以百宝嵌的屏风，一定要放在有自然光走动的位置——它会自己“活”过来。"
    },
    {
      "type": "long",
      "text": "玄关摆一扇百宝嵌屏风，解决的是一个很实际的问题：开门见厅，一览无余。屏风立起来之后，进门先见景，绕过屏风才见人，动线多了一个转折，心理上就多了一层安定。题材我们建议选山水或花鸟，不要选人物——人物有视线，客人进门会觉得被盯着。"
    },
    {
      "type": "long",
      "text": "这扇屏风的题材是“岁寒三友”，松针用的是染色象牙，竹节用的是青玉，梅花用的是珊瑚。三种材质三种硬度，开槽深度各不相同，师傅手里得有三把不同角度的凿子来回换。最难的是花瓣，珊瑚脆，稍一用力就崩，一片梅花要修半个钟头。整扇做完，光梅花就嵌了两百六十多片。"
    },
    {
      "type": "vip",
      "text": "这一扇用的是带皮籽料，不是山料。籽料的油润是山料仿不出来的，侧光一看就知道。我们手里同等级的料只够做六扇，做完这批要等下一轮和田收货。"
    },
    {
      "type": "vip",
      "text": "给您留了编号。每扇屏风背面都有落款、年份和编号，配一本手写证书，写明材质、工艺、师傅和工期。十年后您想出手，这本证书就是它的身份证。"
    },
    {
      "type": "vip",
      "text": "高定的意思不是贵，是“按您的空间长出来”。我们有设计师上门量尺寸、看采光、看您家现有的家具木色，再定屏风的尺寸、题材和材质配比。做到这一步，它就不是一件家具，是您家的立面。"
    },
    {
      "type": "vip",
      "text": "说实话，百宝嵌不适合所有人。它安静、厚重、有分量，摆在家里，客人第一眼看到的是它而不是您。如果您喜欢的是“低调到看不见”，我建议看看素屏；如果您希望进门三秒内让人记住这个家，那就它了。"
    },
    {
      "type": "vip",
      "text": "我们做过的最贵一扇，是给一位收藏家的会所做的六扇大屏，题材是《千里江山》的局部，用了青金、孔雀石、螺钿、玛瑙四种材料，做了八个月。他说了一句话我记到今天：“我不是买屏风，我是把一座山请进屋里。"
    },
    {
      "type": "culture",
      "text": "百宝嵌又叫“周制”，明代扬州一位姓周的匠人首创——把天下珍材收进一方木器。四百多年过去，工序没变：选料、开槽、镶嵌、打磨、上蜡。变的只是做它的人越来越少。"
    },
    {
      "type": "culture",
      "text": "古人把屏风叫“扆”，是天子座后的那道屏障。它从一开始就不是一个实用的东西，是身份的分界线。今天我们把屏风摆进寻常人家，隔的不再是等级，是喧嚣。"
    },
    {
      "type": "culture",
      "text": "《长物序》里说文震亨论屏风：“屏风之制最古，以大理石镶下座精细者为贵。”可见明人已把镶嵌之工，当作衡量屏风的第一标准。我们今天做的，正是这一路的延续。"
    },
    {
      "type": "culture",
      "text": "一件百宝嵌，是木作、漆作、玉作、錾铜四个行当凑在一起才做得出来的。它从来不是一个人的手艺，是一群匠人的合谋。所以我们坚持群工署名，谁做的漆、谁嵌的玉，证书上写得清清楚楚。"
    },
    {
      "type": "culture",
      "text": "非遗名录里有“百宝嵌”这一项，但真正难的不是把工艺传下去，是让年轻人愿意为它花钱。这是我们做内容的目的：不是卖惨，是让更多人知道，还有人愿意用一百四十天，做一件能传三代的东西。"
    }
  ],
  "cabinet_baibao": [
    {
      "type": "short",
      "text": "一只百宝嵌柜子，把柴米油盐收进去，把风雅气韵露出来。"
    },
    {
      "type": "short",
      "text": "柜门一关，是烟火日常；柜门一开，是百宝嵌的流光。"
    },
    {
      "type": "long",
      "text": "百宝嵌柜子，是\"藏\"与\"露\"的教科书。柜门用百宝嵌做成一幅画，关上是排场，开后是日用——里头格子按你的杂物尺寸分好，茶器、香具、账册各归其位。木胎先大漆再嵌珍材，耐磨耐潮，南方梅雨季也不怕。"
    },
    {
      "type": "long",
      "text": "传家的物件，往往不是金条，是天天用却不糟蹋的那件。百宝嵌柜子就是：玉钮、螺钿面、实木骨，每天开合几十次，十年后包浆比新买时更润。榫卯结构不用一根钉，搬家拆装都不散。"
    },
    {
      "type": "vip",
      "text": "百宝嵌柜在家具体系里是\"重器\"，摆一只，整个空间的身份就定了。它不说话，但来客都知道这家主人不将就。"
    },
    {
      "type": "culture",
      "text": "百宝嵌柜子的讲究，苏州老话叫\"满堂嵌\"。我们复刻这路数，木胎大漆、逐片镶嵌。到店可看不同珍材光感，定制内部格局，工期约两月。"
    },
    {
      "type": "short",
      "text": "柜子不说话，但它记得这个家所有的年头。"
    },
    {
      "type": "short",
      "text": "一柜藏三代：祖母的银簪，母亲的嫁衣，你的第一块表。"
    },
    {
      "type": "short",
      "text": "木头会呼吸，柜门开合之间，屋里就多了一道旧的香。"
    },
    {
      "type": "short",
      "text": "好的柜子，越用越像家里的一件老家具。"
    },
    {
      "type": "long",
      "text": "这是一对顶箱柜，上下两截，上面那截叫“顶箱”，下面叫“立柜”，合起来两米二高。为什么要做两截？一是老房子门框矮，拆开才好搬进去；二是老一辈讲究“顶天立地”，柜子顶到天花板，寓意家业有顶。这两截之间有子母口，扣上之后严丝合缝，看不出是两件。"
    },
    {
      "type": "long",
      "text": "柜子的门心板是百宝嵌的重点。这块板面积不大，却最费工——因为它是视线落点。我们用的是“博古”题材：鼎、瓶、炉、玉璧、书画卷，都是文人书房里的清供。嵌的时候要先把每样东西的轮廓在木头上描出来，再按材质分片，一片玉如意可能要分七八小块才能拼出弧度。"
    },
    {
      "type": "long",
      "text": "很多人担心百宝嵌的柜子难打理，其实比你想的简单。日常用干棉布擦，半年上一次蜡，不要放在暖气旁边，不要暴晒。玉石和螺钿都是无机物，不会像漆器那样怕干裂。真正怕的是搬家时的磕碰——所以我们出货都做木架加固，同城我们派人上门安装。"
    },
    {
      "type": "long",
      "text": "这只柜子做的是“一封书”式样，就是柜门像一本摊开的书。式样来自明式家具，线条极简，没有任何多余的雕饰，所有的功夫都藏在门心的镶嵌里。这种“外简内繁”，是文人审美里最讲究的一层：远看素，近看华，再近看，是一整个博古架上的清供。"
    },
    {
      "type": "vip",
      "text": "这对柜子的木料是拆房老料，从山西收来的老榆木门板，原来是一户人家的正房门。木头上有旧榫眼和老漆的痕迹，我们都保留了——那些痕迹是它七十年的履历。"
    },
    {
      "type": "vip",
      "text": "我们的柜子不用一颗钉子，全部走传统榫卯。这不是噱头：榫卯的作用是给木头留出胀缩的余地，用钉子的柜子过三个梅雨季就开始松动，榫卯的越用越紧。您可以理解为，它是在“长”成一个整体。"
    },
    {
      "type": "vip",
      "text": "定制周期四到六个月。我知道这个时间不短，但可以告诉您时间去哪了：选料一个月，木胎阴干两个月，镶嵌一个半月，打磨上蜡半个月。其中任何一个环节压不了，压了就是骗人。"
    },
    {
      "type": "vip",
      "text": "买柜子这件事，建议您带着家人一起来看。因为柜子是家里用得最久的一件家具——沙发十年换一次，柜子可能传三代。尺寸、木色、题材，最好让家里每个人都点头。我们见过太多“一个人拍板、回去吵架”的例子。"
    },
    {
      "type": "vip",
      "text": "这只柜子配一把铜锁和两把钥匙。锁是老式“鱼形锁”，取“年年有余”。钥匙我们会多配两把，一把给老人，一把给孩子——等他们长大，柜子里的东西就都是他们的了。"
    },
    {
      "type": "culture",
      "text": "在过去，柜子是嫁妆里最重的一件。姑娘出嫁，娘家要陪送一对柜子，里面装布料、首饰和压箱钱。柜子抬进婆家的那一刻，是娘家给的底气。这门手艺到今天还在，只是装的东西变了。"
    },
    {
      "type": "culture",
      "text": "《鲁班经》里记柜子尺寸，都要合“鲁班尺”上的吉祥数。“财”“义”“官”“本”四个字，量到哪个字上，就主哪一路。老匠人下料前先量尺，不是迷信，是把一份祝愿量进木头里。"
    },
    {
      "type": "culture",
      "text": "我们把每只柜子的木料来源、工序记录、匠人姓名都写进一本小册子，随柜交付。这是跟日本“器物履历”学的做法。一件东西知道来处，用的人才会有感情。"
    },
    {
      "type": "culture",
      "text": "百宝嵌在柜子上，和屏风上不一样。屏风是看，柜子是摸——每天开合，手会蹭过门心的镶嵌。所以柜子的镶嵌要做“平嵌”，嵌片和木面齐平，摸上去是一整片温润，不能有凸起硌手。这一条，是我们的硬标准。"
    },
    {
      "type": "culture",
      "text": "有个客户问我：机器做的和手工做的，肉眼能看出来吗？我说能。机器嵌的，每一片的角度完全一致，看着整齐；手工嵌的，每片都有一两度的偏差，看着活。整齐是工业的美，偏差是人味——我们选后者。"
    }
  ],
  "screen_luodian": [
    {
      "type": "short",
      "text": "螺钿屏风的浪漫，在于光一转，整幅画就泛起彩虹的鳞片。"
    },
    {
      "type": "short",
      "text": "贝母嵌进木里，把海的细碎星光，搬进了书房。"
    },
    {
      "type": "long",
      "text": "螺钿的浪漫在于\"借光\"。白天平平无奇的深色屏风，夜里灯一暖，贝母里嵌的海光就浮出来——蓝的、紫的、银的，随你走动角度变。题材\"夜宴图\"，烛光下人物衣袂泛光，像把一场宋人夜宴搬进了客厅。"
    },
    {
      "type": "long",
      "text": "说螺钿就得说\"随光流彩\"。贝母切细条拼成水波纹，光一斜整片水面就像在动。题材\"柳塘乳鸭\"，春意很足，挂餐厅或茶室都提神。工艺难点在拼接：每片贝厚薄必须一致，否则光打上去会斑驳。"
    },
    {
      "type": "vip",
      "text": "螺钿屏风是给\"懂雅\"的人留的——它不亮时素净，亮时惊艳，像那种不张扬却一眼被记住的人。"
    },
    {
      "type": "culture",
      "text": "螺钿古称\"钿螺\"，宋元已有，明清臻于极。我们沿用磨贝随光嵌片的古法，不刷漆仿光。每扇光感各异，限量出品，私洽留位。"
    },
    {
      "type": "short",
      "text": "黑漆为夜，贝母为星，一扇屏风就是一小片夜空。"
    },
    {
      "type": "short",
      "text": "螺钿的好，要等光走过去才看得见。"
    },
    {
      "type": "short",
      "text": "贝壳磨到半毫米，才肯上这扇屏风。"
    },
    {
      "type": "short",
      "text": "白天是素净的，灯一亮，满屏都是虹。"
    },
    {
      "type": "long",
      "text": "螺钿分厚薄两种。厚螺钿用的是螺壳、鲍鱼贝，磨成两毫米左右的片，嵌进漆胎，摸上去有微微的凸起，颜色偏白、偏沉稳，适合做大朵的花和大片的叶；薄螺钿取的是夜光螺的内层，磨到零点二毫米，薄到能透光，颜色会随角度变，青、紫、粉、金都在里面。这扇屏风用的是薄螺钿，所以要贴着看——换个角度，花就换一种颜色。"
    },
    {
      "type": "long",
      "text": "做螺钿屏风的漆胎，必须是黑漆。不是为了酷，是为了对比。贝母的白和虹彩，只有在最深的底色上才立得住，像夜空里的星。黑漆要髹十几遍，每遍入荫房阴干再打磨，直到漆面能照出人影。行话叫“退光”，退到最后那层哑光的黑，才是嵌贝母的底子。"
    },
    {
      "type": "long",
      "text": "这扇屏风上的缠枝莲，一共用了三千一百多片贝母。师傅的做法是：先在漆面上描稿，再用一把极细的针刀按轮廓划开，把贝母片顺着划痕压进去，靠漆的粘性固定。花瓣要顺着花心的方向排，每一片的虹彩朝向都得一致，否则一朵花会显得“花”。这活没法用机器，只能靠手指记住角度。"
    },
    {
      "type": "long",
      "text": "有人问我，螺钿屏风摆在家里会不会太隆重？我的建议是看房间。如果客厅采光好、家具偏素，一扇黑漆螺钿就是整个空间的重心，压得住场；如果家里本身已经很花，那就选小尺寸的座屏，放在玄关或书房一角，当一件陈设而不是主角。屏风这东西，最怕抢了主人的位置。"
    },
    {
      "type": "vip",
      "text": "这批贝母是夜光螺的内层，取自深海，一片螺能取的薄料不到三成，剩下的都磨废了。所以薄螺钿的价格，一大半是材料损耗。我们这批料够做四扇，做完要等下一船。"
    },
    {
      "type": "vip",
      "text": "厚螺钿和薄螺钿，价格差三倍。差别不在贵贱，在用途：厚螺钿耐看、沉稳、适合大空间和强光；薄螺钿灵动、含蓄、适合近看和暖光。您家里如果是落地窗大采光，我建议厚钿；如果是茶室、书房这类暖光环境，薄钿更对。"
    },
    {
      "type": "vip",
      "text": "这扇屏风我们可以做“暗记”——在背面不起眼的地方，嵌一片刻着您姓氏或斋号的贝母。别人看不见，您知道它在。这是老规矩，从前大户人家订家具都要留这么一处。"
    },
    {
      "type": "vip",
      "text": "老实讲，螺钿最怕的不是用，是放。贝母是碳酸钙，怕酸怕潮，南方梅雨季如果长时间不通风，边缘会发乌。所以我们随货配一支保养蜡和一张养护卡，半年擦一次，能保三十年如新。北方有暖气的家庭反而省心。"
    },
    {
      "type": "vip",
      "text": "去年有位客人订了一扇六屏，题材是自己家的老宅。我们按他给的照片画稿，把门楼、石阶、那棵枣树都嵌了进去。他说搬了三次家，只有这扇屏风每次都跟着走。这种订单我们接得少，但接了就记得住。"
    },
    {
      "type": "culture",
      "text": "螺钿不是中国土生的工艺，它从唐代随海上丝路进来，贝壳是舶来品，嵌贝的技术却在中国长成了自己的样子。宋人把它用在经箱上，明人把它用在家具上，清人把它用到了极致。一千年过去，材料还是那个材料，手上的功夫早就不是了。"
    },
    {
      "type": "culture",
      "text": "《髹饰录》是明代唯一传下来的漆工专著，里面把螺钿列在“填嵌”一门，说它“百般文图，点、抹、钩、条，总以精细密致如画为妙”。短短一句，把螺钿的标准定到了今天：要像画，不能像贴。"
    },
    {
      "type": "culture",
      "text": "古人把螺钿叫“螺甸”“陷蚌”，名字都带着“贝”。它最动人的地方在于，用的是最廉价的材料——海边捡来的贝壳，靠手艺变成了最贵重的装饰。中国工艺里一直有这一路：不靠材料贵，靠功夫贵。"
    },
    {
      "type": "culture",
      "text": "薄螺钿在明清之际一度失传，是工匠从残存的旧器上反推回来的。今天我们能做，靠的是上世纪五十年代一批老艺人——他们把家里藏的老柜子拆开，一片一片量贝母的厚度，把断掉的手艺接了回去。所以这门活，本来就是死过一次的。"
    },
    {
      "type": "culture",
      "text": "我们做内容，常被问“这是不是非遗”。是，但我不太爱提这两个字。非遗的意思是“需要保护”，可真正好的手艺不该被保护，该被使用。您把它摆在家里、每天看见它，比任何牌匾都管用。"
    }
  ],
  "cabinet_luodian": [
    {
      "type": "short",
      "text": "一只螺钿柜子，柜门一开一合，像把海的波光也关进了屋里。"
    },
    {
      "type": "short",
      "text": "螺钿柜面嵌的是贝母，收的是杂物，亮的是日子的光。"
    },
    {
      "type": "long",
      "text": "螺钿柜，是把\"雅\"做进了日用。柜面嵌贝母，收的是茶、香、零碎，亮的是过日子的讲究。上柜下几，柜门贝光拼成缠枝，开合间像把一片海光关进关出。内部活动层板，茶器、手账、首饰都能装。"
    },
    {
      "type": "long",
      "text": "柜面泛七彩的不是漆，是螺钿。鲍鱼贝做主光，蓝绿紫随角度流转，题材\"荷塘\"，夏日最清凉。贝片薄到透光又不能裂，嵌完整体打磨，摸上去平、看进去亮。放卧室夜里台灯一照，浮一层幽光。"
    },
    {
      "type": "vip",
      "text": "螺钿柜是\"雅\"的硬通货——不喧嚣，却让每个进屋的人，默默把你归进\"懂生活\"那一档。"
    },
    {
      "type": "culture",
      "text": "螺钿柜的工艺，江南老作坊叫\"嵌螺甸\"。我们复刻这手艺，不做满嵌、留木底呼吸。开放定制，按你办公室或卧室尺寸排期，到店详谈。"
    },
    {
      "type": "short",
      "text": "黑漆螺钿的柜子，是老房子里最亮的一件家具。"
    },
    {
      "type": "short",
      "text": "柜门一开，先看见一树开在黑夜里花。"
    },
    {
      "type": "short",
      "text": "贝壳不贵，贵的是把它磨薄的那双手。"
    },
    {
      "type": "short",
      "text": "这柜子白天沉静，晚上华贵，像极了一种人的活法。"
    },
    {
      "type": "long",
      "text": "这是一只黑漆螺钿立柜，柜门对开，门心各嵌一折枝花卉。做法是先做木胎，再披麻挂灰，然后髹黑漆十几遍，最后在漆面上开槽嵌贝。整个过程最耗时的是“荫”——每髹一遍漆都要放进荫房，在恒温恒湿里慢慢干，急不得。所以一只柜子从下料到出货，至少五个月，其中四个月是在等。"
    },
    {
      "type": "long",
      "text": "柜子上的螺钿和屏风上的不一样，要“平”。因为柜门每天开合，手会蹭过门心，嵌片若有一点凸起，日子久了就会被磨掉，还会勾丝。所以柜子的贝母嵌完要整体罩一遍透明漆，再打磨到和漆面完全齐平，摸上去是一整片温润，看不出接缝。这是柜子比屏风更费工的地方。"
    },
    {
      "type": "long",
      "text": "这只柜子做的是“一柜两用”：上半部分是博古架式，敞开的格子，摆您自己的器物；下半部分带门，门心嵌螺钿，里面收纳。上面展示，下面藏拙——老家具的聪明都在这儿。柜子的铜活也是老样式，面叶、合页、拉手都是白铜的，用久了会生出一层温润的包浆。"
    },
    {
      "type": "long",
      "text": "很多人第一眼觉得黑漆螺钿“太满”，这是被现代简约审美带的。其实传统家具讲究“疏可走马，密不透风”——柜门中心的花是密的，四周留白是疏的，一密一疏之间才有呼吸。您把它放在白墙前看看，那片黑不是沉，是把空间稳住了。"
    },
    {
      "type": "vip",
      "text": "这只柜子的贝母用的是鲍鱼贝，不是普通螺壳。鲍鱼贝的虹彩是分层的，青绿里带金，转动角度会一路变色，行内叫“活光”。普通螺壳只有白，没有这一层。成本差四倍，但这四倍您每天开柜门都能看见。"
    },
    {
      "type": "vip",
      "text": "我们给出的是“可传承”的做工标准：全榫卯、不上钉；漆面不喷不烤，一遍遍手髹手磨。这个标准下，柜子的结构寿命是五十年起。我见过民国留下的螺钿柜，八十年了，门还是严的，贝母还是亮的——那就是我们的样板。"
    },
    {
      "type": "vip",
      "text": "定制柜子请您先想清楚一件事：它是要给谁的。如果是自家用，尺寸按您家的实际空间走；如果是给下一代的，我建议做标准尺寸，将来好搬、好分、好出手。这不是生意话，是我见过太多“为这间房量身定做、搬家只能送人”的例子。"
    },
    {
      "type": "vip",
      "text": "这只柜子随附一张“身份卡”：木料产地、漆的遍数、贝母品类、镶嵌片数、师傅姓名、完成日期，都在上面。将来您想转手、想修复、想知道当年是谁做的，一查就知道。器物有履历，才谈得上传承。"
    },
    {
      "type": "vip",
      "text": "关于价格我说句实在的：黑漆螺钿柜，便宜的做法是贴贝母片上去，看着差不多，三年起翘；我们做的是开槽嵌，漆和贝母长在一起，三十年不掉。差价大概在两成。这两成，买的不是今天的好看，是十年后还好看。"
    },
    {
      "type": "culture",
      "text": "明清时候，黑漆螺钿柜是晋商大院里的标配。山西不产贝，但晋商走西口、下江南，把贝壳背回来，交给本地漆匠，做成了北方最华贵的一件家具。手艺的传播，从来是跟着人的脚步走的。"
    },
    {
      "type": "culture",
      "text": "螺钿柜上的题材，最常见的是“博古”和“花鸟”。博古是鼎、瓶、炉、玉件这些清供，代表书香；花鸟是牡丹、喜鹊、莲鹭，代表世俗的好日子。一只柜子上两个题材都有，意思很清楚：既要读书，也要过好日子。"
    },
    {
      "type": "culture",
      "text": "传统的黑漆不是化学漆，是从漆树上割下来的生漆，割一斤要等一棵树缓三年。生漆怕潮不怕干，越干越硬，几百年不腐。所以出土的两千年前漆器还能用——这是全世界所有涂料里，唯一能做到的。"
    },
    {
      "type": "culture",
      "text": "我们坚持用生漆，代价是工期长、成本高、师傅要戴口罩干活（生漆过敏很常见）。但化学漆做出来的柜子，三年后漆面会发乌、会失光，贝母的虹彩也被闷住了。生漆是透的，光能进去再出来，贝母才亮。这一点，差一天工期都补不回来。"
    },
    {
      "type": "culture",
      "text": "有客户问我，这种柜子将来会不会没人要？我说不会。因为它的美不依赖潮流——黑与白、深与浅、光与影，这些东西三百年前成立，三百年后还是成立。潮流会过时，对比不会。"
    }
  ]
};

// ---------- 提示词：单个分类一次调用，输出量可控 ----------
function buildCatPrompt(cat, date) {
  return [
    `你是东方器物文创品牌的内容运营。请为下面这一个分类，撰写【朋友圈发布商品的文案】。`,
    `当前分类：${cat.label}`,
    `分类口径：${CAT_BRIEF[cat.id] || ''}`,
    `参考日期：${date}（仅作时间参考，不要写进文案）`,
    ``,
    `必须严格输出 JSON，不要任何解释、不要 markdown 代码块包裹。结构：`,
    `{"items":[{"type":"short","text":"文案"},{"type":"quote","text":"金句"},...]}`,
    ``,
    `要求：`,
    `1. items 共 ${TARGET} 条：type 取值 short/quote/long/vip/culture 各 ${PER_TYPE} 条。`,
    `2. 类型口径（务必分清 short 和 quote，这是两种东西）：`,
    `   short=场景短句：一句话的画面感，描述器物本身或使用瞬间，30 字内，是「陈述」，例如"柜门一开一合，像把海的波光也关进了屋里"。`,
    `   quote=金句：有观点、有态度、带哲理或反转，能脱离本产品独立传播，可当海报文字、视频字幕、被截图转发，20~45 字，是「观点」，例如"好东西不用说话，摆在那儿就够了"、"时间从不败坏手艺，只淘汰偷懒的人"。`,
    `   long=材质/工艺/场景叙事(120~220字); vip=高净值客群(稀缺/圈层/身份/收藏/传家/送礼); culture=文化营销(文化叙事+成交引导:私洽/限量/定制/到店/排期)。`,
    `2b. quote 必须能单独成立：遮住品牌名和产品名，句子依然有味道、依然成立。不要写成卖点罗列。`,
    `3. 风格多样：美学金句、场景种草(玄关/客厅/书房/茶室/卧室/会所)、工艺科普、送礼推荐、文人意境、空间美学、收藏价值、日常陪伴都要覆盖。`,
    `4. 屏风管「隔断/立屏/山水/聚气」，柜子管「收纳/藏露/镇宅/传家」，不要串味。`,
    `5. 不夸大、不涉医疗、不用绝对化迷信用语；避免陈词滥调，写出有东方美学质感、能直接发朋友圈的句子。`,
    `6. 直接以 { 开头输出 JSON，以 } 结束，中间不要任何说明文字。`,
  ].join('\n');
}

// ---------- AI 通道 ----------
// 优选顺序：按中文文创文案质量排序（实测可用者在前）
const OR_PREFERRED = [
  'minimax/minimax-m3:free',
  'minimax/minimax-m2.7:free',
  'z-ai/glm-5.2:free',
  'inclusionai/ling-3.0-flash-fin:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'dots-studio/dots-3-note-preview:free',
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
];
// 不适合创意文案的模型（内容安全 / 纯代码）
const OR_BLOCKED = [
  'nvidia/nemotron-3.5-content-safety:free',
  'cohere/north-mini-code:free',
];
const OR_MAX_TRY = 12;   // 单次生成最多尝试模型数，避免全部试一遍太慢

// 动态拉取 OpenRouter 当前免费模型（模型会上下架，硬编码必然过期）
async function discoverFreeModels() {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const live = (j.data || []).map((m) => m.id)
      .filter((id) => id.endsWith(':free') && OR_BLOCKED.indexOf(id) < 0);
    if (!live.length) throw new Error('无免费模型');
    const ordered = OR_PREFERRED.filter((m) => live.indexOf(m) >= 0);
    const rest = live.filter((m) => ordered.indexOf(m) < 0);
    const all = ordered.concat(rest).slice(0, OR_MAX_TRY);
    T('模型发现: 实时免费 ' + live.length + ' 个，本次尝试 ' + all.length + ' 个 -> ' + all.slice(0, 4).join(', ') + ' ...');
    return all;
  } catch (e) {
    T('模型发现失败: ' + e.message + '，回退静态列表');
    return OR_PREFERRED.slice(0, OR_MAX_TRY);
  }
}

// 备用通道模型池：GitHub Models（Actions 内置 GITHUB_TOKEN，零成本）
// 注：Actions 环境实测该域名不可达（fetch failed / curl 均失败），
// 保留仅作冗余，失败极快（十几毫秒），不拖慢主链路。
const GH_MODELS = [
  'openai/gpt-4.1-mini',
  'openai/gpt-4o-mini',
  'meta/Llama-3.3-70B-Instruct',
  'mistralai/Mistral-Nemo',
];

async function buildProviders() {
  const list = [];
  const orKey = process.env.LLM_API_KEY;
  if (orKey) {
    const base = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const models = await discoverFreeModels();
    const primary = process.env.LLM_MODEL || process.env.SC_MODEL;
    // 环境变量指定的模型排最前，但不重复
    if (primary) {
      const i = models.indexOf(primary);
      if (i > 0) models.splice(i, 1);
      if (models[0] !== primary) models.unshift(primary);
    }
    list.push({ name: 'OpenRouter', url: base + '/chat/completions', key: orKey, models });
  }
  try {
    const ghKey = process.env.GH_MODELS_TOKEN || process.env.GITHUB_TOKEN;
    if (ghKey) {
      list.push({
        name: 'GitHubModels',
        url: 'https://models.inference.ai.azure.com/chat/completions',
        key: ghKey,
        models: (typeof GH_MODELS !== 'undefined' ? GH_MODELS : []).slice(),
      });
    }
  } catch (e) {
    T('GitHubModels 通道装配失败（忽略）: ' + e.message);
  }
  return list;
}

// ---------- 网络层：fetch 优先，失败回退 curl（undici 不读系统代理，curl 读） ----------
const { execFileSync } = require('child_process');

// 全程追踪：每一步都记下来，出错时落盘到 _status.json，便于远程定位
const TRACE = [];
const T = (s) => { TRACE.push('[' + new Date().toISOString().slice(11, 19) + '] ' + s); console.log('  ' + s); };

async function postJSON(url, headers, payload, timeoutMs) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 100000);
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text, via: 'fetch' };
  } catch (e) {
    try {
      const args = ['-s', '-w', '\n__HTTP__%{http_code}', '--max-time',
        String(Math.ceil((timeoutMs || 100000) / 1000)), url];
      for (const k in headers) args.push('-H', k + ': ' + headers[k]);
      args.push('-H', 'Content-Type: application/json');
      args.push('--data-binary', '@-');
      const out = execFileSync('curl', args, {
        input: JSON.stringify(payload), encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024,
      });
      const m = out.match(/\n__HTTP__(\d+)\s*$/);
      const status = m ? parseInt(m[1], 10) : 0;
      const text = m ? out.slice(0, m.index) : out;
      return { ok: status >= 200 && status < 300, status: status, text: text, via: 'curl' };
    } catch (e2) {
      return { ok: false, status: 0, text: '', via: 'fail', err: e.message + ' | curl:' + e2.message };
    }
  }
}

async function callLLM(prompt) {
  let providers = [];
  try {
    providers = await buildProviders();
  } catch (e) {
    T('buildProviders 异常: ' + e.message);
    throw e;
  }
  if (!providers.length) { T('无可用通道（缺 API Key）'); return null; }
  let lastErr = null;
  for (const p of providers) {
    for (const m of p.models) {
      // 429 = 上游临时限流，重试 2 次（间隔 3s / 6s）往往能过
      const tries = [0, 3000, 6000];
      let res = null;
      for (let ti = 0; ti < tries.length; ti++) {
        if (tries[ti] > 0) await new Promise((s2) => setTimeout(s2, tries[ti]));
        res = await postJSON(p.url, { Authorization: 'Bearer ' + p.key }, {
          model: m,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
          max_tokens: 8000,
        }, 100000);
        if (res.ok) break;
        if (res.status !== 429 && res.status !== 502 && res.status !== 503) break;
        T('  重试 ' + (ti + 1) + '/' + tries.length + ' ' + m + ' HTTP ' + res.status);
      }
      try {
        if (!res.ok) {
          lastErr = p.name + '/' + m + ' HTTP ' + res.status + ' [' + res.via + '] ' + String(res.text || '').slice(0, 150);
          T('  ' + m + ' -> HTTP ' + res.status + ' [' + res.via + '] ' + String(res.text || '').slice(0, 150));
          continue;
        }
        let j = null;
        try { j = JSON.parse(res.text); } catch (pe) {
          lastErr = p.name + '/' + m + ' 解析失败';
          T('  ' + m + ' -> HTTP 200 但 JSON 解析失败，原文前 300 字: ' + String(res.text || '').slice(0, 300));
          continue;
        }
        const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!c) {
          lastErr = p.name + '/' + m + ' 空内容';
          T('  ' + m + ' -> HTTP 200 但无 choices，原文: ' + String(res.text || '').slice(0, 200));
          continue;
        }
        T('  [命中] ' + m + ' 返回 ' + c.length + ' 字符');
        return c;
      } catch (e) {
        lastErr = p.name + '/' + m + ' ' + e.message;
      }
    }
    console.warn('    [warn] 通道 ' + p.name + ' 全部失败，尝试下一通道');
  }
  throw new Error('所有通道失败: ' + lastErr);
}

// ---------- 解析 ----------
function extractJson(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function parseCatItems(text) {
  const obj = extractJson(text);
  let items = null;
  if (obj && Array.isArray(obj.items)) items = obj.items;
  else if (obj && Array.isArray(obj.cats) && obj.cats[0] && Array.isArray(obj.cats[0].items)) items = obj.cats[0].items;
  if (!Array.isArray(items)) throw new Error('返回结构缺少 items 数组');
  return items
    .filter((it) => it && typeof it === 'object' && TYPES.includes(it.type)
      && typeof it.text === 'string' && it.text.trim().length >= 5)
    .map((it) => ({ type: it.type, text: String(it.text).trim() }));
}

// ---------- 按类型智能补足到每类 24 条 ----------
// banned = 历史已用文案集合（含当天其它分类已用），兜底内容也必须避开
function fillUp(items, fb, banned) {
  const ban = banned || new Set();
  const out = [];
  const seen = new Set();
  const countOf = (t) => out.filter((o) => o.type === t).length;

  for (const t of TYPES) {
    for (const it of items) {
      if (it.type !== t || seen.has(it.text)) continue;
      if (ban.has(it.text)) continue;          // 与历史撞车 -> 丢弃
      if (countOf(t) >= PER_TYPE) break;
      seen.add(it.text);
      out.push(it);
    }
  }
  for (const t of TYPES) {
    let need = PER_TYPE - countOf(t);
    if (need <= 0) continue;
    for (const f of fb) {
      if (need <= 0) break;
      if (f.type !== t || seen.has(f.text)) continue;
      if (ban.has(f.text)) continue;            // 兜底同样不许复用历史
      seen.add(f.text);
      out.push(f);
      need--;
    }
  }
  // 最后按类型排序，App 内展示更整齐
  const ordered = [];
  for (const t of TYPES) out.filter((o) => o.type === t).forEach((o) => ordered.push(o));
  return ordered;
}

// ---------- 历史文案黑名单 ----------
function loadHistory(date) {
  const ban = new Set();
  if (!fs.existsSync(OUT_DIR)) return ban;
  let n = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    if (f === date + '.json') continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
      for (const c of (d.cats || [])) for (const it of (c.items || [])) {
        if (it && it.text) { ban.add(String(it.text).trim()); n++; }
      }
    } catch (e) { /* 忽略坏文件 */ }
  }
  console.log('[历史] 已加载 ' + ban.size + ' 条历史文案（累计 ' + n + ' 条次），当天内容必须全部避开');
  return ban;
}

// ---------- 状态文件（AI 失败时告知前端，而不是静默吐旧内容） ----------
function writeStatus(date, state, msg, keepTrace) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const fp = path.join(OUT_DIR, '_status.json');
  let obj = {};
  try { obj = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { obj = {}; }
  const rec = { state: state, msg: msg, at: new Date().toISOString() };
  if (keepTrace) rec.trace = TRACE.slice(-120);   // 保留最后 120 行追踪
  obj[date] = rec;
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8');
}

// ---------- 输出 ----------
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
    return Array.isArray(d.cats) && d.cats.length === 4
      && d.cats.every((c) => Array.isArray(c.items) && c.items.length >= 20);
  } catch (e) { return false; }
}

(async () => {
  const date = process.argv[2] || todayStr();
  if (fileExistsGood(date)) {
    console.log('[跳过] ' + date + ' 已有完整内容（每类≥20条），不覆盖');
    return;
  }
  console.log('[生成] 日期 =', date);

  // ---- 0. 预置队列优先：人工/离线准备好的内容，质量最高，直接用 ----
  const qDir = path.join(OUT_DIR, '_queue');
  const qFile = path.join(qDir, date + '.json');
  if (fs.existsSync(qFile)) {
    try {
      const q = JSON.parse(fs.readFileSync(qFile, 'utf8'));
      if (Array.isArray(q.cats) && q.cats.length === 4
        && q.cats.every((c) => Array.isArray(c.items) && c.items.length >= 20)) {
        q.date = date;
        writeData(date, q);
        fs.unlinkSync(qFile);
        const tot = q.cats.reduce((s2, c) => s2 + c.items.length, 0);
        console.log('[队列] 命中预置内容 ' + date + '，共 ' + tot + ' 条，已发布并出队');
        return;
      }
      console.warn('[队列] ' + date + '.json 结构不完整，忽略，改用 AI');
    } catch (e) {
      console.warn('[队列] 读取失败: ' + e.message);
    }
  }

  // ---- 1. 载入历史黑名单 ----
  const banned = loadHistory(date);

  // ---- 2. AI 逐分类生成 ----
  const cats = [];
  let aiHits = 0;
  for (const c of CATS) {
    let items = [];
    let from = '未生成';
    try {
      const plen = buildCatPrompt(c, date).length;
      T('分类 ' + c.label + ' 开始请求（prompt ' + plen + ' 字符）');
      const txt = await callLLM(buildCatPrompt(c, date));
      if (txt) {
        try {
          items = parseCatItems(txt);
          T('  解析出 ' + items.length + ' 条（返回原文 ' + txt.length + ' 字符）');
          if (items.length > 0) { from = 'AI 生成 ' + items.length + ' 条'; aiHits++; }
        } catch (pe) {
          T('  解析异常: ' + pe.message + ' | 原文尾部 300 字: ' + String(txt).slice(-300));
        }
      } else {
        T('  无返回内容');
      }
    } catch (e) {
      T('  请求失败: ' + e.message.slice(0, 200));
    }
    const before = items.length;
    const merged = fillUp(items, FALLBACK_FULL[c.id] || [], banned);
    // 统计有多少条是被历史黑名单挡掉的
    const blocked = before - merged.filter((m) => items.some((i2) => i2.text === m.text)).length;
    if (blocked > 0) console.warn('    [去重] ' + c.label + ' 剔除 ' + blocked + ' 条与历史重复');
    cats.push({ id: c.id, label: c.label, items: merged });
    console.log('  · ' + c.label + ' -> ' + merged.length + ' 条（' + from + '）');
  }

  const totalNew = cats.reduce((s2, c) => s2 + c.items.filter(
    (i2) => !banned.has(i2.text)).length, 0);
  const total = cats.reduce((s2, c) => s2 + c.items.length, 0);

  // ---- 3. 质量闸门：AI 全挂 / 全部是历史复读 -> 拒绝写入 ----
  const allFromFallback = cats.every((c) => c.items.every((i2) => {
    const fb = FALLBACK_FULL[c.id] || [];
    return fb.some((f) => f.text === i2.text);
  }));
  if (aiHits === 0 || allFromFallback) {
    const msg = aiHits === 0
      ? 'AI 通道全部不可用，已跳过生成，未写入任何内容（避免与历史重复）'
      : 'AI 返回内容全部与历史重复，已拒绝写入';
    console.error('[拒绝写入] ' + date + ' — ' + msg);
    writeStatus(date, 'ai_failed', msg, true);
    console.log('[状态] 已写入 _status.json（含 ' + TRACE.length + ' 行追踪）');
    return;
  }
  if (totalNew < 40) {
    console.error('[拒绝写入] ' + date + ' — 全新内容仅 ' + totalNew + ' 条（<40），判定为复读，不写入');
    writeStatus(date, 'ai_failed', '生成内容新鲜度不足（' + totalNew + ' 条），已跳过', true);
    return;
  }

  writeData(date, { date, cats });
  writeStatus(date, 'ok', 'AI 生成成功，全新 ' + totalNew + '/' + total + ' 条', true);
  console.log('[完成] 分类 =', cats.length, '| 文案合计 =', total,
    '| 全新 =', totalNew, '| AI 命中分类 =', aiHits + '/4');
  console.log('[输出]', path.join(OUT_DIR, date + '.json'));
})();
