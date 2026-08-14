// ===== Marvis 工位风格 —— 正面 2D 渲染 =====
// 严格对齐 Marvis 视觉：正面平视（小马/椅子/桌子/显示器全部正对镜头），
// 纯白底、白色家具 + 黑色点缀 + 围巾色，柔和大范围阴影。
(function () {
  'use strict';

  // 共享 SVG 阴影定义（在每个 station 的 svg 根部复用）
  function shadowFilter() {
    // 大柔影 + 小硬影，模拟 Marvis 那种阴影偏右下方、边缘极软的感觉
    return '<defs>' +
      '<filter id="marvisShadow" x="-30%" y="-30%" width="160%" height="160%">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="6"/>' +
      '<feOffset dx="4" dy="8" result="offsetblur"/>' +
      '<feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>' +
      '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<filter id="marvisShadowSoft" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="14"/>' +
      '<feOffset dx="6" dy="14" result="offsetblur"/>' +
      '<feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer>' +
      '</filter>' +
      '</defs>';
  }

  // 将 #rrggbb 加深/变浅 p（-100..100）
  function shadeColor(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + p));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + p));
    var b = Math.max(0, Math.min(255, (n & 255) + p));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ===== 桌面（白色横板 + 4 根细桌腿）=====
  // 桌面宽 150，厚 8，竖直方向 150-180 在 y 轴
  function desk() {
    var s = '';
    // 4 根桌腿（在桌面下，露到椅子前）。桌面中心大约在 x=100，桌腿分布于 x∈[35,165], y∈[125,165]
    for (var i = 0; i < 4; i++) {
      var lx = i % 2 === 0 ? 42 : 158;
      var ly = i < 2 ? 130 : 160;
      // 桌腿用极浅白细矩形
      s += '<rect x="' + (lx - 2) + '" y="' + ly + '" width="4" height="20" fill="#ecedf0"/>';
    }
    // 桌面（白长矩形 + 极淡下边阴影线）
    s += '<rect x="20" y="105" width="160" height="10" fill="#ffffff" stroke="#e2e5e9" stroke-width="0.6"/>';
    // 桌面下方 1px 暗线
    s += '<rect x="20" y="114" width="160" height="1" fill="#d8dce2"/>';
    return s;
  }

  // ===== 椅子（白色方形椅背 + 灰色座面 + 黑色五星脚 + 气压杆）=====
  // 椅背高、宽，呈矩形，正对观众，中心位于 x=100，y 范围 60-130
  function chair() {
    var s = '';
    // 椅背填充（白）
    s += '<rect x="78" y="58" width="44" height="60" fill="#ffffff" stroke="#e2e5e9" stroke-width="0.8"/>';
    // 椅背边框细线增强立体
    s += '<rect x="78" y="58" width="44" height="60" fill="none" stroke="#d8dce2" stroke-width="0.6"/>';
    // 椅背顶部圆角（用 path）
    s += '<rect x="78" y="118" width="44" height="10" fill="#e6e9ee" stroke="#d8dce2" stroke-width="0.6"/>';
    // 座面
    s += '<rect x="70" y="128" width="60" height="6" fill="#c7ccd3" stroke="#9aa1ab" stroke-width="0.5"/>';
    // 气压杆（中央黑细条）
    s += '<rect x="98" y="134" width="4" height="22" fill="#2d333d"/>';
    // 五星脚 5 条辐射 + 5 个小脚轮
    for (var i = 0; i < 5; i++) {
      var angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      var x1 = 100, y1 = 162;
      var x2 = 100 + Math.cos(angle) * 22;
      var y2 = 162 + Math.sin(angle) * 22;
      s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#5e6670" stroke-width="2.2" stroke-linecap="round"/>';
    }
    // 5 个小脚轮
    for (var j = 0; j < 5; j++) {
      var a2 = -Math.PI / 2 + (j * Math.PI * 2) / 5;
      var wx = 100 + Math.cos(a2) * 22;
      var wy = 162 + Math.sin(a2) * 22;
      s += '<circle cx="' + wx.toFixed(1) + '" cy="' + wy.toFixed(1) + '" r="2.5" fill="#3a414c"/>';
    }
    // 中央五星盘
    s += '<ellipse cx="100" cy="162" rx="10" ry="4" fill="#2d333d"/>';
    return s;
  }

  // ===== 显示器（黑色边框 + 中央彩色大色块屏幕 + 支架 + 底座）=====
  // 屏幕宽 130 高 80，居中 x=100，y 12-92
  function monitor(scarfColor) {
    scarfColor = scarfColor || '#3a6b5e';
    var s = '';
    // 显示器底座（小梯形 / 椭圆）
    s += '<ellipse cx="100" cy="103" rx="22" ry="3" fill="#d8dce2"/>';
    s += '<rect x="78" y="98" width="44" height="5" fill="#3a414c"/>';
    // 支架细颈
    s += '<rect x="97" y="92" width="6" height="8" fill="#2d333d"/>';
    // 显示器外壳（黑色宽边框）
    s += '<rect x="32" y="14" width="136" height="80" rx="3" fill="#1a1d24"/>';
    // 屏幕内框（距外壳 4px）
    s += '<rect x="36" y="18" width="128" height="72" rx="2" fill="#0c0d12"/>';
    // 屏幕中央围巾色大色块（占屏幕约 75% 高度）
    var bx = 50, by = 28, bw = 100, bh = 52;
    s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="1" fill="' + scarfColor + '"/>';
    // 屏幕顶部反光高光（细微白色斜条 + 透明叠加）
    s += '<rect x="36" y="18" width="128" height="6" fill="rgba(255,255,255,0.07)"/>';
    // 屏幕下方一抹反光（透明白色斜条，模拟环境光）
    s += '<polygon points="40,82 160,82 156,86 44,86" fill="rgba(255,255,255,0.05)"/>';
    // 屏幕底部小指示灯（Apple 风，灰色小点）
    s += '<circle cx="148" cy="91" r="0.6" fill="#5e6670"/>';
    // 屏幕左上角小 logo（Marvis logo 区）
    s += '<rect x="40" y="22" width="6" height="2" fill="' + shadeColor(scarfColor, 30) + '"/>';
    return s;
  }

  // ===== 小马吉祥物（Marvis 黑猫 / 小马 + 围巾）=====
  // 头在上，身子大半被椅背遮挡，露出头部和围巾上沿。
  // 中心位于 x=100，头部 y≈28-55，围巾 y≈55-65
  function horse(scarfColor) {
    scarfColor = scarfColor || '#3a6b5e';
    var s = '';
    var cx = 100;
    // 头（椭圆 / 圆，黑色）
    s += '<ellipse cx="' + cx + '" cy="40" rx="22" ry="20" fill="#0c0d12"/>';
    // 头部高光（顶部微微提亮，模拟顶光）
    s += '<ellipse cx="' + cx + '" cy="32" rx="14" ry="4" fill="#1f242d" opacity="0.6"/>';
    // 两只耳朵（黑色三角，在头顶）
    s += '<polygon points="84,28 80,16 90,22" fill="#0c0d12"/>';
    s += '<polygon points="116,28 120,16 110,22" fill="#0c0d12"/>';
    // 耳朵内侧（更黑）
    s += '<polygon points="85,26 83,20 88,23" fill="#1a1d24"/>';
    s += '<polygon points="115,26 117,20 112,23" fill="#1a1d24"/>';
    // 头顶刘海尖
    s += '<polygon points="' + (cx - 3) + ',' + (24) + ' ' + cx + ',' + (18) + ' ' + (cx + 3) + ',' + (24) + '" fill="#0c0d12"/>';
    // 两只眼睛（白色圆点，参考图是笑眯眼/圆眼，简化为两个白色圆）
    s += '<ellipse cx="' + (cx - 9) + '" cy="42" rx="2.6" ry="3" fill="#ffffff"/>';
    s += '<ellipse cx="' + (cx + 9) + '" cy="42" rx="2.6" ry="3" fill="#ffffff"/>';
    // 眼瞳（极小黑点）
    s += '<circle cx="' + (cx - 9) + '" cy="42" r="0.8" fill="#0c0d12"/>';
    s += '<circle cx="' + (cx + 9) + '" cy="42" r="0.8" fill="#0c0d12"/>';
    // 小腮红（极淡粉圈，可选，参考图没我们就跳）
    // ===== 围巾 =====
    // 围巾绕身体，宽度 50、覆盖颈部和肩部，颜色围巾色
    // 在 y=55 至 65 显示围巾横条
    s += '<rect x="' + (cx - 22) + '" y="55" width="44" height="9" rx="1" fill="' + scarfColor + '"/>';
    // 围巾上方亮边
    s += '<rect x="' + (cx - 22) + '" y="55" width="44" height="2" fill="' + shadeColor(scarfColor, 15) + '"/>';
    // 围巾下方阴影
    s += '<rect x="' + (cx - 22) + '" y="62" width="44" height="2" fill="' + shadeColor(scarfColor, -20) + '"/>';
    // 围巾流苏（一侧垂下的小色块）
    s += '<rect x="' + (cx - 14) + '" y="64" width="3" height="6" fill="' + shadeColor(scarfColor, -15) + '"/>';
    s += '<rect x="' + (cx + 11) + '" y="64" width="3" height="6" fill="' + shadeColor(scarfColor, -15) + '"/>';

    // 身体露出部分（被椅背遮挡但脖颈前会有一小部分黑色身体显示在围巾下沿）
    s += '<rect x="' + (cx - 16) + '" y="65" width="32" height="14" fill="#12141a"/>';
    return s;
  }

  // ===== 一个完整工位（正面平视） =====
  // 从下到上：地面阴影 → 椅子（五星脚+气压杆+座面+椅背）→ 桌（横板+桌腿）→ 显示器（在桌面上方）→ 小马（坐在椅子上）
  // 但 Marvis 的视觉是小马在椅子里，显示器在桌子后方桌子上，所以小马身体在椅子内，桌显示器在桌面上。
  // 视觉顺序：椅子后部 → 桌横板横跨 → 显示器立在其上 → 小马坐在椅子里（被显示器在视觉前景遮挡若干）
  function station(st, i) {
    var scarfColor = (st && st.scarfColor) || '#3a6b5e';
    var label = (st && st.label) || 'station';

    // 整体地面阴影（大椭圆，柔化）
    var ground =
      '<ellipse cx="100" cy="200" rx="78" ry="12" fill="#94a3b8" opacity="0.16" filter="url(#groundBlur)"/>' +
      '<ellipse cx="100" cy="200" rx="60" ry="8" fill="#94a3b8" opacity="0.22"/>';

    // 渲染顺序：
    // 1) 椅子的椅背部分（在桌和小马后面，看不到也行，先放确保被桌压住）
    // 2) 桌子（在椅背前面，遮住椅背中下部）
    // 3) 显示器（在桌面上方）
    // 4) 小马头和围巾（从椅背顶部冒出来）

    var inner = '';
    // 椅子的五星脚 + 气压杆
    inner += chair();
    // 桌子（在椅背前）
    inner += desk();
    // 显示器（在桌面上方居中）
    inner += monitor(scarfColor);
    // 小马（在椅子上，围巾在显示器下方，头在显示器屏幕前显眼位置）
    inner += horse(scarfColor);

    return '<svg viewBox="0 0 200 220" class="iso-station" role="img" aria-label="' + label + '">' +
      shadowFilter() +
      '<filter id="groundBlur"><feGaussianBlur stdDeviation="4"/></filter>' +
      ground +
      inner +
      '</svg>';
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
