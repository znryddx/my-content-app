// 等距 2.5D 渲染引擎 v3 —— 高保真逼近 Marvis 截图质感
// 核心改变：圆润贝塞尔人物 / 极淡大柔影 / 纤薄白家具 / 无卡片包裹 / 纯白极简配色
(function () {
  'use strict';

  var C = Math.cos(Math.PI / 6); // 0.8660254
  var S = Math.sin(Math.PI / 6); // 0.5
  var UID = 0;
  function uid() { return 'm' + (UID++); }

  // 等距投影：3D(x,y,z) → 2D(ox,oy) 偏移
  function P(x, y, z, ox, oy) { return [ox + (x - y) * C, oy + (x + y) * S - z]; }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function poly(p, fill, extra) { return '<polygon points="' + pts(p) + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  // 六面体（只画可见三面：顶/右/左）
  function box(x, y, z, w, d, h, pal, ox, oy) {
    var T = [P(x, y, z + h, ox, oy), P(x + w, y, z + h, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    var R = [P(x + w, y, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x + w, y, z + h, ox, oy)];
    var L = [P(x, y + d, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    return poly(L, pal.left) + poly(R, pal.right) + poly(T, pal.top);
  }

  // ====== 配色（严格对齐 Marvis：纯白为主、极浅灰辅助、黑色点缀）======
  var W = { top: '#ffffff', left: '#f4f6f8', right: '#e8eef3' };        // 白色家具
  var W2 = { top: '#fafbfc', left: '#f0f4f7', right: '#e4eaf0' };       // 更白的变体
  var GK = { top: '#f7f8fa', left: '#ecedf0', right: '#e2e5e9' };        // 浅灰（跑步机等）
  var DK = { top: '#3a414c', left: '#2d333d', right: '#22262e' };         // 深灰（显示器边框/咖啡机）
  var BLK = { top: '#1a1d24', left: '#12141a', right: '#0c0d12' };       // 近黑（屏面）

  // 人物围巾色（轮换，照抄 Marvis 每个角色不同色围巾）
  var SCARF = ['#ef4444', '#22c55e', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899', '#eab308'];

  // ====== 极淡大范围柔影（Marvis 风格：超大、极透明、柔和）======
  function megaShadow(cx, cy, rx, ry) {
    var id = uid();
    return '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#94a3b8" stop-opacity="0.10"/>' +
      '<stop offset="60%" stop-color="#94a3b8" stop-opacity="0.05"/>' +
      '<stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + ')"/>';
  }

  // ====== 坐姿人物（贝塞尔曲线圆润剪影 + 彩色围巾）======
  function sittingCharacter(ox, oy, scarfColor) {
    var s = '';
    // 身体——圆润的黑色豆子形（用 path 贝塞尔曲线，不是方块）
    s += '<path d="M42,78 Q38,64 44,54 Q52,48 60,54 Q66,64 62,78 Q52,84 42,78 Z" fill="#1a1a1a"/>';
    // 头——更大的圆角形状
    s += '<path d="M44,52 Q40,40 48,33 Q58,30 64,38 Q68,46 62,54 Q52,58 44,52 Z" fill="#1a1a1a"/>';
    // 围巾——绕脖子一圈的彩色条带
    s += '<path d="M45,49 Q50,45 57,47 Q63,49 61,54 Q55,56 48,53 Q43,51 45,49 Z" fill="' + scarfColor + '"/>';
    // 围巾垂下的尾巴
    s += '<path d="M57,47 Q62,52 60,62 Q58,70 54,68 Q54,58 56,52 Q55,48 57,47 Z" fill="' + scarfColor + '"/>';
    // 耳朵/头部小凸起（增加可爱感）
    s += '<path d="M43,42 Q39,38 42,35 Q46,34 47,38 Q46,43 43,42 Z" fill="#1a1a1a"/>';
    s += '<path d="M63,40 Q67,36 65,33 Q61,32 60,37 Q61,42 63,40 Z" fill="#1a1a1a"/>';
    // 眼睛——两个小白点
    s += '<circle cx="49" cy="41" r="1.8" fill="#fff"/>';
    s += '<circle cx="58" cy="40" r="1.8" fill="#fff"/>';
    return s;
  }

  // ====== 站立人物（用于休闲区马桶旁）======
  function standingCharacter(ox, oy, scarfColor) {
    var s = '';
    // 身体——竖长的豆子
    s += '<path d="M46,82 Q42,66 48,52 Q56,46 64,54 Q68,68 64,82 Q54,90 46,82 Z" fill="#1a1a1a"/>';
    // 头
    s += '<path d="M46,50 Q42,38 50,31 Q60,28 66,36 Q70,44 64,52 Q54,56 46,50 Z" fill="#1a1a1a"/>';
    // 围巾
    s += '<path d="M47,47 Q52,43 59,45 Q65,47 63,52 Q57,54 50,51 Q45,49 47,47 Z" fill="' + scarfColor + '"/>';
    s += '<path d="M59,45 Q64,50 62,62 Q60,72 56,70 Q56,58 58,52 Q57,48 59,45 Z" fill="' + scarfColor + '"/>';
    // 耳朵
    s += '<path d="M45,40 Q41,36 44,33 Q48,32 49,37 Q48,42 45,40 Z" fill="#1a1a1a"/>';
    s += '<path d="M65,38 Q69,34 67,31 Q63,30 62,35 Q63,40 65,38 Z" fill="#1a1a1a"/>';
    // 眼睛
    s += '<circle cx="51" cy="39" r="1.8" fill="#fff"/>';
    s += '<circle cx="60" cy="38" r="1.8" fill="#fff"/>';
    return s;
  }

  // ====== 办公桌（纤薄白色长桌）======
  function desk(ox, oy) {
    var s = '';
    var tw = 64, td = 44, th = 3;  // 桌面尺寸（纤薄）
    var legH = 22, legW = 3;        // 腿高和粗细
    // 四条细腿
    var legPts = [[2, 2], [tw - legW - 2, 2], [2, td - legW - 2], [tw - legW - 2, td - legW - 2]];
    legPts.forEach(function (p) {
      s += box(p[0], p[1], 0, legW, legW, legH, W2, ox, oy);
    });
    // 桌面（薄板）
    s += box(0, 0, legH, tw, td, th, W, ox, oy);
    // 桌面高光边缘（增加精致感）
    var hl = [
      P(1, 1, legH + th, ox, oy), P(tw - 1, 1, legH + th, ox, oy),
      P(tw - 1, td - 1, legH + th, ox, oy), P(1, td - 1, legH + th, ox, oy)
    ];
    s += poly(hl, 'rgba(255,255,255,0.7)');
    return s;
  }

  // ====== 办公转椅（白色+浅灰五星脚）======
  function chair(ox, oy, by) {
    var s = '';
    var seatW = 30, seatD = 26, seatT = 4;
    var seatZ = 18;  // 座垫高度
    // 五星脚底盘（椭圆近似）
    var footCX = seatW / 2 + by, footCY = seatD / 2;
    var fc = P(footCX, footCY, 0, ox, oy);
    s += '<ellipse cx="' + fc[0].toFixed(1) + '" cy="' + (fc[1] + 1).toFixed(1) + '" rx="14" ry="6" fill="#e8eef3"/>';
    // 五根辐条（简化为从中心向外的小腿）
    [[-11, -5], [11, -5], [-11, 7], [11, 7], [0, -10]].forEach(function (lg) {
      s += box(seatW / 2 - 1.5 + lg[0] + by, seatD / 2 - 1.5 + lg[1], 1, 3, 3, 5, GK, ox, oy);
    });
    // 气压杆
    s += box(seatW / 2 - 2 + by, seatD / 2 - 2, 6, 4, 4, seatZ - 6, GK, ox, oy);
    // 座垫（白色厚垫）
    s += box(0, by, seatZ, seatW, seatD, seatT, W, ox, oy);
    // 靠背（白色薄板，微后倾用两层模拟）
    s += box(2, by + 2, seatZ + seatT, seatW - 4, 5, 24, W, ox, oy);
    // 扶手（细窄）
    s += box(-1, by, seatZ + 2, 3, 3, 10, GK, ox, oy);
    s += box(seatW - 2, by, seatZ + 2, 3, 3, 10, GK, ox, oy);
    return s;
  }

  // ====== 显示器（黑屏/蓝屏 + 纤薄边框 + 支架）======
  function monitor(ox, oy, img, id, baseZ) {
    baseZ = baseZ || 26;
    var s = '';
    // 底座
    s += box(24, 13, baseZ, 16, 10, 2.5, W2, ox, oy);
    // 支架（细颈）
    s += box(29, 16, baseZ + 2.5, 6, 4, 13, GK, ox, oy);
    // 屏幕外框（极薄黑框）
    var bx = 4, byf = 2, bw = 52, bh = 31, bd = 7;
    s += box(bx, byf, baseZ + 15.5, bw, bd, bh, DK, ox, oy);
    // 屏幕内面
    var scrZ = baseZ + 15.5 + 1;
    var scrH = bh - 2;
    var P2 = function (X, Y, Z) { return P(X, Y, Z, ox, oy); };
    var ix = bx + 2.5, iw = bw - 5, iz0 = scrZ, iz1 = scrZ + scrH;
    var a = P2(ix, byf + bd, iz0), b = P2(ix + iw, byf + bd, iz0);
    var c = P2(ix + iw, byf + bd, iz1), d = P2(ix, byf + bd, iz1);
    var face = pts([a, b, c, d]);
    if (img) {
      s += '<clipPath id="scr' + id + '"><polygon points="' + face + '"/></clipPath>';
      var e = ox + (ix - (byf + bd)) * C;
      var f = oy + (ix + byf + bd) * S - iz0;
      s += '<image href="' + img + '" width="' + iw + '" height="' + scrH + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#scr' + id + ')" transform="matrix(' + C.toFixed(4) + ',' + S.toFixed(4) + ',0,1,' + e.toFixed(2) + ',' + f.toFixed(2) + ')"/>';
    } else {
      // 默认深色屏（接近黑色，不是纯黑）
      s += '<polygon points="' + face + '" fill="#1e232d"/>';
      // 屏幕反光（斜向高光条，增加真实感）
      var r1 = a[0] + (b[0] - a[0]) * 0.08, r1y = a[1] + (b[1] - a[1]) * 0.08;
      var r2 = a[0] + (b[0] - a[0]) * 0.28, r2y = a[1] + (b[1] - a[1]) * 0.28;
      var r3 = d[0] + (c[0] - d[0]) * 0.28, r3y = d[1] + (c[1] - d[1]) * 0.28;
      var r4 = d[0] + (c[0] - d[0]) * 0.08, r4y = d[1] + (c[1] - d[1]) * 0.08;
      s += '<polygon points="' + r1.toFixed(1) + ',' + r1y.toFixed(1) + ' ' + r2.toFixed(1) + ',' + r2y.toFixed(1) + ' ' + r3.toFixed(1) + ',' + r3y.toFixed(1) + ' ' + r4.toFixed(1) + ',' + r4y.toFixed(1) + '" fill="rgba(255,255,255,0.04)"/>';
    }
    return s;
  }

  // ====== 一个完整工位（桌 + 椅 + 人 + 屏）======
  function station(st, i) {
    var ox = 100, oy = 155, by = 50;
    var img = st.image || '';
    var center = P(30, 22, 0, ox, oy);
    var shadow = megaShadow(center[0], center[1] + 8, 72, 28);
    var inner = '';
    inner += monitor(ox, oy, img, 's' + i, 26);
    inner += desk(ox, oy);
    inner += chair(ox, oy, by);
    if (st.character !== false) inner += sittingCharacter(ox, oy, SCARF[i % SCARF.length]);
    return '<svg viewBox="0 0 210 250" class="iso" role="img" aria-label="' + (st.label || 'station') + '">' + shadow + inner + '</svg>';
  }

  // ====== 装饰区物件（左列休闲区）======

  // --- 茶水间（Marvis 左上：白色长柜台 + 一排咖啡杯 + 玛芬 + 咖啡机）---
  function kitchenetteSVG() {
    var ox = 50, oy = 65, s = '';
    var center = P(40, 28, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 56, 22);
    // 白色长柜台主体
    s += box(6, 14, 0, 68, 24, 24, W, ox, oy);
    // 台面（略亮）
    s += box(8, 16, 24, 64, 20, 1.5, W2, ox, oy);
    // 一排咖啡杯（5 个，棕色液面）
    [12, 23, 34, 45, 56].forEach(function (px) {
      s += box(px, 18, 25.5, 5.5, 5.5, 7, W, ox, oy);   // 杯身（白瓷）
      s += '<path d="' + cupLiquidPath(px + 2.75, 20, ox, oy) + '" fill="#8B6914"/>'; // 咖啡液面
    });
    // 玛芬排（3 个，棕色顶）
    [15, 27, 39].forEach(function (px) {
      s += box(px, 6, 25.5, 7, 7, 7, { top: '#d4a574', left: '#c49464', right: '#b38555' }, ox, oy); // 纸杯
      s += blobAt(px + 3.5, 9.5, 33, 5, '#c98a5a', ox, oy); // 玛芬顶
    });
    // 咖啡机（右侧深灰机器）
    s += box(54, 8, 25.5, 17, 13, 19, DK, ox, oy);         // 机身
    s += box(56, 10, 44.5, 13, 9, 2.5, GK, ox, oy);          // 出水槽
    // 咖啡机细节：出水口
    s += box(59, 12, 47, 3, 3, 4, DK, ox, oy);
    return '<svg viewBox="0 0 100 120" class="iso" role="img" aria-label="kitchenette">' + s + '</svg>';
  }

  function cupLiquidPath(cx, cy, ox, oy) {
    var p = P(cx, cy, 32.5, ox, oy);
    return 'M' + (p[0] - 2).toFixed(1) + ',' + (p[1]).toFixed(1) +
           ' Q' + p[0].toFixed(1) + ',' + (p[1] - 1.5).toFixed(1) + ' ' + (p[0] + 2).toFixed(1) + ',' + p[1].toFixed(1) + ' Z';
  }

  function blobAt(cx, cy, cz, r, fill, ox, oy) {
    var p = P(cx, cy, cz, ox, oy);
    return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="' + fill + '"/>';
  }

  // --- 跑步机（Marvis 左中：白色跑台 + 控制台）---
  function treadmillSVG() {
    var ox = 50, oy = 75, s = '';
    var center = P(38, 30, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 52, 20);
    // 跑台底座（长条灰色）
    s += box(16, 22, 2, 52, 30, 4, GK, ox, oy);
    // 跑带（深一点）
    s += box(18, 24, 6, 48, 26, 2, DK, ox, oy);
    // 扶手/控制台立柱（左侧）
    s += box(20, 20, 8, 4, 4, 22, GK, ox, oy);
    // 控制台面板
    s += box(17, 17, 30, 10, 7, 10, W, ox, oy);
    // 控制台屏幕（小黑屏）
    s += box(19, 19, 33, 6, 3, 6, BLK, ox, oy);
    // 另一侧扶手
    s += box(58, 44, 8, 4, 4, 16, GK, ox, oy);
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="treadmill">' + s + '</svg>';
  }

  // --- 马桶区 + 站立人物（Marvis 左下）---
  function toiletZoneSVG() {
    var ox = 50, oy = 80, s = '';
    var center = P(38, 36, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 48, 18);
    // 马桶主体（白色陶瓷）
    s += box(32, 30, 0, 20, 16, 14, W, ox, oy);
    // 马桶座圈（稍暗的白）
    s += box(31, 40, 0, 22, 18, 6, W2, ox, oy);
    // 马桶盖
    s += box(33, 42, 6, 18, 12, 3, W, ox, oy);
    // 水箱（马桶后方小突起）
    s += box(32, 28, 0, 18, 4, 18, W, ox, oy);
    // 站立的人物（在马桶右边，带青色围巾）
    s += standingCharacter(ox + 18, oy - 5, '#06b6d4');
    return '<svg viewBox="0 0 110 140" class="iso" role="img" aria-label="toilet-zone">' + s + '</svg>';
  }

  // ---- 装饰物入口 ----
  function decor(name) {
    if (name === 'kitchenette') return kitchenetteSVG();
    if (name === 'treadmill') return treadmillSVG();
    if (name === 'toilet_zone') return toiletZoneSVG();
    if (name === 'clock') return clockSVG();
    // 兜底
    var ox = 50, oy = 60;
    var center = P(45, 38, 0, ox, oy);
    var s = megaShadow(center[0], center[1] + 4, 36, 14);
    s += box(38, 36, 0, 14, 14, 14, W, ox, oy);
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="' + name + '">' + s + '</svg>';
  }

  // --- 挂钟（小号，用于日期回看入口）---
  function clockSVG() {
    var s = '';
    // 挂绳
    s += '<line x1="50" y1="2" x2="50" y2="18" stroke="#cbd5e1" stroke-width="1.5"/>';
    // 表盘（纯白圆）
    s += '<circle cx="50" cy="58" r="34" fill="#ffffff" stroke="#dde4ea" stroke-width="2.5"/>';
    // 刻度
    for (var t = 0; t < 12; t++) {
      var aa = t * Math.PI / 6;
      var x1 = 50 + Math.sin(aa) * 28, y1 = 58 - Math.cos(aa) * 28;
      var x2 = 50 + Math.sin(aa) * 33, y2 = 58 - Math.cos(aa) * 33;
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#cbd5e1" stroke-width="' + (t % 3 === 0 ? 1.5 : 1) + '"/>';
    }
    // 时针分针
    s += '<line x1="50" y1="58" x2="50" y2="42" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/>';
    s += '<line x1="50" y1="58" x2="64" y2="58" stroke="#374151" stroke-width="1.8" stroke-linecap="round"/>';
    // 中心红点
    s += '<circle cx="50" cy="58" r="2.5" fill="#ef4444"/>';
    return '<svg viewBox="0 0 100 115" class="iso clickable" role="img" aria-label="clock">' + s + '</svg>';
  }

  window.OfficeArt = {
    desk: desk, chair: chair,
    person: sittingCharacter, monitor: monitor,
    decor: decor, station: station
  };
})();
