// ===== Marvis 工位 —— 正面平视（严格像素级对齐 marvis001.png）=====
// 关键修正：
//   1. 小马头部 = 火焰形（头顶多个尖角），不是椭圆
//   2. 眯笑眼 = 两道上挑白弧，不是两个小白圆
//   3. 长尖耳朵 + 围巾两尾端下垂
//   4. 桌子下方有抽屉柜（3 抽屉）
//   5. 显示器支架 = 白色（不是黑色）
//   6. 椅子气压杆 = 黑色细条；五星脚底盘 = 白色
(function () {
  'use strict';

  function shadeColor(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + p));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + p));
    var b = Math.max(0, Math.min(255, (n & 255) + p));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function shadowDefs() {
    return '<defs>'
      + '<radialGradient id="marvisGroundShadow" cx="50%" cy="50%" r="50%">'
      +   '<stop offset="0%" stop-color="#94a3b8" stop-opacity="0.22"/>'
      +   '<stop offset="60%" stop-color="#94a3b8" stop-opacity="0.08"/>'
      +   '<stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/>'
      + '</radialGradient>'
      + '</defs>';
  }

  // ===== 小马吉祥物（Marvis 黑马 —— 火焰头 / 眯笑眼 / 长尖耳 / 宽围巾垂尾）=====
  // 中心 cx=100；头上方火焰尖在 y=12~30；眼睛在 y=46；围巾在 y=64~76；尾端垂到 y=88
  function horse(scarfColor) {
    scarfColor = scarfColor || '#c0392b';
    var s = '';
    var cx = 100;

    // ===== 头部（火焰/尖刺轮廓）=====
    // 5 个尖角 + 4 个凹谷，包络线 + 下方椭圆脸
    var flame = ''
      // 从左上沿顺时针走
      + 'M ' + (cx-24) + ' 56 '                                          // 左下角
      + 'Q ' + (cx-26) + ' 36 ' + (cx-19) + ' 34 '                        // 左侧鼓
      // 4 个尖：左尖、尖2、左凹、尖3（最高）、中凹、尖4（右高）、右凹、尖5
      + 'L ' + (cx-17) + ' 22 '
      + 'L ' + (cx-13) + ' 30 '
      + 'L ' + (cx-9)  + ' 16 '
      + 'L ' + (cx-5)  + ' 26 '
      + 'L ' + (cx)    + ' 8 '                                            // 最高尖
      + 'L ' + (cx+5)  + ' 26 '
      + 'L ' + (cx+9)  + ' 14 '
      + 'L ' + (cx+13) + ' 30 '
      + 'L ' + (cx+17) + ' 20 '
      + 'L ' + (cx+19) + ' 34 '
      + 'Q ' + (cx+26) + ' 36 ' + (cx+24) + ' 56 '                       // 右侧鼓
      + 'Z';
    s += '<path d="' + flame + '" fill="#0c0d12"/>';
    // 脸补底（让脸看起来圆润，遮挡尖角内凹线）
    s += '<ellipse cx="' + cx + '" cy="50" rx="22" ry="12" fill="#0c0d12"/>';

    // 头顶高光（顶端 5 个尖之间加细微亮边）
    var hl = ''
      + 'M ' + (cx-12) + ' 14 L ' + (cx-9) + ' 16 L ' + (cx-8) + ' 18 Z'
      + 'M ' + (cx-2) + ' 10 L ' + cx + ' 8 L ' + (cx+2) + ' 10 Z'
      + 'M ' + (cx+8) + ' 14 L ' + (cx+9) + ' 14 L ' + (cx+10) + ' 16 Z';
    s += '<path d="' + hl + '" fill="#1a1d24"/>';

    // ===== 长尖耳朵（头顶两侧细长尖耳）=====
    s += '<polygon points="' + (cx-22) + ',34 ' + (cx-26) + ',20 ' + (cx-17) + ',30" fill="#0c0d12"/>';
    s += '<polygon points="' + (cx+22) + ',34 ' + (cx+26) + ',20 ' + (cx+17) + ',30" fill="#0c0d12"/>';
    // 耳朵内侧（极淡一点高光）
    s += '<polygon points="' + (cx-21) + ',32 ' + (cx-23) + ',24 ' + (cx-19) + ',30" fill="#1a1d24" opacity="0.7"/>';
    s += '<polygon points="' + (cx+21) + ',32 ' + (cx+23) + ',24 ' + (cx+19) + ',30" fill="#1a1d24" opacity="0.7"/>';

    // ===== 眯笑眼（两道上挑白弧）=====
    s += '<path d="M 90 49 Q 95 44 100 49" stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    s += '<path d="M 100 49 Q 105 44 110 49" stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round"/>';

    // ===== 围巾（绕身体宽条带 + 两尾端垂下）=====
    // 主带宽 50 / 厚 14 / y=64-78
    var scarfW = 50, scarfTop = 64, scarfBot = 78;
    var scarfPath = ''
      + 'M ' + (cx-scarfW/2) + ' ' + scarfTop + ' '
      + 'Q ' + (cx-scarfW/2) + ' ' + (scarfBot+2) + ' ' + (cx-scarfW/2+3) + ' ' + scarfBot + ' '
      + 'L ' + (cx-scarfW/2+8) + ' ' + scarfBot + ' '
      // 左尾端（垂下）
      + 'L ' + (cx-scarfW/2+10) + ' ' + (scarfBot+12) + ' '
      + 'L ' + (cx-scarfW/2+16) + ' ' + (scarfBot+12) + ' '
      + 'L ' + (cx-scarfW/2+14) + ' ' + scarfBot + ' '
      + 'L ' + (cx-scarfW/2+34) + ' ' + scarfBot + ' '
      // 右尾端
      + 'L ' + (cx+scarfW/2-14) + ' ' + scarfBot + ' '
      + 'L ' + (cx+scarfW/2-16) + ' ' + (scarfBot+12) + ' '
      + 'L ' + (cx+scarfW/2-10) + ' ' + (scarfBot+12) + ' '
      + 'L ' + (cx+scarfW/2-8) + ' ' + scarfBot + ' '
      + 'L ' + (cx+scarfW/2-3) + ' ' + scarfBot + ' '
      + 'Q ' + (cx+scarfW/2) + ' ' + (scarfBot+2) + ' ' + (cx+scarfW/2) + ' ' + scarfTop + ' '
      + 'Z';
    s += '<path d="' + scarfPath + '" fill="' + scarfColor + '"/>';
    // 围巾上方亮线（围巾顶部一道亮边）
    s += '<rect x="' + (cx-scarfW/2) + '" y="' + (scarfTop+1) + '" width="' + scarfW + '" height="2" fill="' + shadeColor(scarfColor, 20) + '"/>';
    // 围巾下方阴影
    s += '<rect x="' + (cx-scarfW/2) + '" y="' + (scarfBot-2) + '" width="' + scarfW + '" height="2" fill="' + shadeColor(scarfColor, -20) + '"/>';

    // ===== 身体（围巾下方露出的胸/腹部分，极短一截）=====
    s += '<ellipse cx="' + cx + '" cy="82" rx="22" ry="4" fill="#12141a"/>';

    return s;
  }

  // ===== 办公椅（白色座面 + 白色椅背 + 黑色气压杆 + 白色五星脚底盘 + 5 黑色轮子）=====
  // 椅背顶部 y=110、底部 y=170；座面 y=170-180；气压杆 y=180-190；五星底盘 y=190-200；脚轮在 y=200
  function chair() {
    var s = '';

    // 椅背（白色圆角矩形，带极淡边框）
    s += '<rect x="78" y="110" width="44" height="60" rx="3" fill="#ffffff" stroke="#e2e5e9" stroke-width="0.6"/>';
    // 椅背顶部高光（让边缘更立体）
    s += '<path d="M 81 113 Q 100 110 119 113" fill="none" stroke="#ffffff" stroke-width="2"/>';

    // 座面（白色矩形 + 灰边）
    s += '<rect x="74" y="170" width="52" height="10" rx="2" fill="#ffffff" stroke="#d8dce2" stroke-width="0.6"/>';
    // 座面底阴影线
    s += '<rect x="74" y="178" width="52" height="2" fill="#e8eef3"/>';

    // 黑色气压杆
    s += '<rect x="98" y="180" width="4" height="12" fill="#2d333d"/>';

    // 五星脚底盘（白色 + 灰边）
    s += '<ellipse cx="100" cy="194" rx="22" ry="5" fill="#ffffff" stroke="#d8dce2" stroke-width="0.5"/>';

    // 5 条五星脚辐条（白色，向外辐射）
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI/2 + (i * Math.PI*2)/5;
      var x2 = 100 + Math.cos(a)*22;
      var y2 = 194 + Math.sin(a)*4;
      s += '<line x1="100" y1="194" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>';
      // 末端脚轮（黑色小圆 + 顶面白点）
      s += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="2.4" fill="#1a1d24"/>';
      s += '<circle cx="' + (x2-0.5).toFixed(1) + '" cy="' + (y2-0.5).toFixed(1) + '" r="0.6" fill="#ffffff" opacity="0.5"/>';
    }

    return s;
  }

  // ===== 办公桌（白色横板 + 桌面下方 3 抽屉小柜）=====
  // 桌面 y=98-108；抽屉柜 y=108-155
  function desk() {
    var s = '';

    // 桌面（白色横板，带极淡下边线）
    s += '<rect x="14" y="98" width="172" height="10" fill="#ffffff"/>';
    // 桌面右侧细黑边
    s += '<rect x="14" y="98" width="172" height="10" fill="none" stroke="#e8eef3" stroke-width="0.6"/>';
    // 桌面下方 1px 阴影线
    s += '<rect x="14" y="106" width="172" height="2" fill="#dee2e8"/>';

    // 抽屉柜（白色矩形 + 3 个等宽抽屉）
    var cab_x = 38, cab_y = 108, cab_w = 124, cab_h = 47;
    s += '<rect x="' + cab_x + '" y="' + cab_y + '" width="' + cab_w + '" height="' + cab_h + '" fill="#ffffff" stroke="#e2e5e9" stroke-width="0.6"/>';
    // 抽屉分隔
    var dw = cab_w/3;
    for (var i = 1; i < 3; i++) {
      s += '<line x1="' + (cab_x+dw*i) + '" y1="' + cab_y + '" x2="' + (cab_x+dw*i) + '" y2="' + (cab_y+cab_h) + '" stroke="#e2e5e9" stroke-width="0.6"/>';
    }
    // 抽屉把手（小圆点，居于抽屉中心）
    for (var j = 0; j < 3; j++) {
      var handleX = cab_x + dw*j + dw/2;
      var handleY = cab_y + cab_h/2;
      s += '<circle cx="' + handleX + '" cy="' + handleY + '" r="1.4" fill="#9aa1ab"/>';
    }

    // 桌面极左侧斜角阴影（参考图桌脚有一块斜方块）
    s += '<polygon points="14,108 14,118 8,118 8,108" fill="#e8eef3"/>';

    return s;
  }

  // ===== 显示器（黑框 + 围巾色大色块屏幕 + 白色支架与底座）=====
  function monitor(scarfColor) {
    scarfColor = scarfColor || '#1a1d24';  // Agent 显示器用黑
    var s = '';

    // 底座（白色横椭圆）
    s += '<ellipse cx="100" cy="96" rx="22" ry="3" fill="#ffffff" stroke="#d8dce2" stroke-width="0.5"/>';
    // 支架（白色矩形脖子）
    s += '<rect x="94" y="78" width="12" height="18" fill="#ffffff" stroke="#d8dce2" stroke-width="0.5"/>';

    // 显示器外壳（黑色边框）
    s += '<rect x="32" y="14" width="136" height="68" rx="2" fill="#1a1d24"/>';
    // 屏幕内框（距外壳 4px）
    s += '<rect x="36" y="18" width="128" height="60" rx="1" fill="#0c0d12"/>';
    // 屏幕色块（围巾色，整屏）
    s += '<rect x="36" y="18" width="128" height="60" fill="' + scarfColor + '"/>';
    // 屏幕底部反光（白色斜条）
    s += '<polygon points="40,76 156,76 152,80 44,80" fill="rgba(255,255,255,0.08)"/>';
    // 屏幕顶部反光
    s += '<rect x="36" y="18" width="128" height="3" fill="rgba(255,255,255,0.10)"/>';

    return s;
  }

  // ===== 一个完整工位（椅子 → 桌子 → 显示器 → 小马 渲染顺序） =====
  function station(st, i) {
    var scarfColor = (st && st.scarfColor) || '#c0392b';
    var label = (st && st.label) || 'station';

    // 地面柔影（左侧大椭圆，符合参考图阴影方向）
    var ground = ''
      + '<ellipse cx="90" cy="206" rx="78" ry="6" fill="url(#marvisGroundShadow)"/>'
      + '<ellipse cx="78" cy="206" rx="40" ry="3" fill="#94a3b8" opacity="0.18"/>';

    var inner = '';
    inner += chair();            // 椅子（底层）
    inner += desk();             // 桌子（在椅背前方遮挡）
    inner += monitor(scarfColor);// 显示器（在桌面上）
    inner += horse(scarfColor);  // 小马（最顶）

    return '<svg viewBox="0 0 200 220" class="iso-station" role="img" aria-label="' + label + '">'
      + shadowDefs()
      + ground
      + inner
      + '</svg>';
  }

  window.OfficeArt = {
    desk: desk,
    chair: chair,
    monitor: monitor,
    horse: horse,
    station: station,
    shadeColor: shadeColor
  };
})();
