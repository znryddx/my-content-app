// 等距 2.5D 渲染引擎 —— 干净、纯白、居中对齐（无人物、无动物图标）
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

  // ====== 极淡大范围柔影（Marvis 风格：超大、极透明、柔和）======
  function megaShadow(cx, cy, rx, ry) {
    var id = uid();
    return '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#94a3b8" stop-opacity="0.10"/>' +
      '<stop offset="60%" stop-color="#94a3b8" stop-opacity="0.05"/>' +
      '<stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + ')"/>';
  }

  // ====== 办公桌（纤薄白色长桌，居中）======
  function desk(ox, oy) {
    var s = '';
    var tw = 60, td = 40, th = 3, legH = 21, legW = 3;
    var legPts = [[2, 2], [tw - legW - 2, 2], [2, td - legW - 2], [tw - legW - 2, td - legW - 2]];
    legPts.forEach(function (p) { s += box(p[0], p[1], 0, legW, legW, legH, W2, ox, oy); });
    s += box(0, 0, legH, tw, td, th, W, ox, oy);
    var hl = [P(1, 1, legH + th, ox, oy), P(tw - 1, 1, legH + th, ox, oy), P(tw - 1, td - 1, legH + th, ox, oy), P(1, td - 1, legH + th, ox, oy)];
    s += poly(hl, 'rgba(255,255,255,0.7)');
    return s;
  }

  // ====== 办公转椅（白色+浅灰五星脚，居中于工位正前方）======
  function chair(ox, oy, by) {
    var s = '';
    var seatW = 26, seatD = 22, seatT = 5, seatZ = 18;
    var cx = 30; // 与桌面中心 x 对齐
    // 五星脚底盘
    var fc = P(cx, by, 0, ox, oy);
    s += '<ellipse cx="' + fc[0].toFixed(1) + '" cy="' + (fc[1] + 2).toFixed(1) + '" rx="13" ry="5.5" fill="#e8eef3"/>';
    [[-10, -4], [10, -4], [-10, 6], [10, 6], [0, -9]].forEach(function (lg) {
      s += box(cx - 1.5 + lg[0], by - 1.5 + lg[1], 1, 3, 3, 4, GK, ox, oy);
    });
    // 气压杆
    s += box(cx - 2, by - 2, 5, 4, 4, seatZ - 5, GK, ox, oy);
    // 座垫（白色厚垫）
    s += box(cx - seatW / 2, by - seatD / 2, seatZ, seatW, seatD, seatT, W, ox, oy);
    // 靠背（白色薄板，位于椅子后方 = 更小 y）
    s += box(cx - seatW / 2 + 2, by - seatD / 2 - 2, seatZ + seatT, seatW - 4, 4, 22, W, ox, oy);
    // 扶手
    s += box(cx - seatW / 2 - 1, by - seatD / 2, seatZ + 2, 3, 3, 9, GK, ox, oy);
    s += box(cx + seatW / 2 - 2, by - seatD / 2, seatZ + 2, 3, 3, 9, GK, ox, oy);
    return s;
  }

  // ====== 显示器（黑屏/蓝屏 + 纤薄边框 + 支架，居中于桌面后方）======
  function monitor(ox, oy, img, id, baseZ) {
    baseZ = baseZ || 27;
    var s = '';
    var cx = 30;
    s += box(cx - 8, 13, baseZ, 16, 10, 2.5, W2, ox, oy);   // 底座
    s += box(cx - 3, 16, baseZ + 2.5, 6, 4, 13, GK, ox, oy); // 支架
    var bx = 4, byf = 2, bw = 52, bh = 31, bd = 7;
    s += box(bx, byf, baseZ + 15.5, bw, bd, bh, DK, ox, oy);  // 外框
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
      s += '<polygon points="' + face + '" fill="#1e232d"/>';
      var r1 = a[0] + (b[0] - a[0]) * 0.08, r1y = a[1] + (b[1] - a[1]) * 0.08;
      var r2 = a[0] + (b[0] - a[0]) * 0.28, r2y = a[1] + (b[1] - a[1]) * 0.28;
      var r3 = d[0] + (c[0] - d[0]) * 0.28, r3y = d[1] + (c[1] - d[1]) * 0.28;
      var r4 = d[0] + (c[0] - d[0]) * 0.08, r4y = d[1] + (c[1] - d[1]) * 0.08;
      s += '<polygon points="' + r1.toFixed(1) + ',' + r1y.toFixed(1) + ' ' + r2.toFixed(1) + ',' + r2y.toFixed(1) + ' ' + r3.toFixed(1) + ',' + r3y.toFixed(1) + ' ' + r4.toFixed(1) + ',' + r4y.toFixed(1) + '" fill="rgba(255,255,255,0.04)"/>';
    }
    return s;
  }

  // ====== 桌面小绿植（增加生气，非动物）======
  function deskPlant(ox, oy) {
    var s = '';
    var px = 6, py = 30, pz = 27;
    s += box(px, py, pz, 9, 9, 8, { top: '#ece3d4', left: '#ddd2bf', right: '#cdc1ab' }, ox, oy); // 陶盆
    var base = P(px + 4.5, py + 4.5, pz + 8, ox, oy);
    var leaf = [[-7, -9], [5, -11], [-1, -15], [9, -6], [-10, -3]];
    leaf.forEach(function (d) {
      var p = P(px + 4.5 + d[0] * 0.5, py + 4.5 + d[1] * 0.3, pz + 8 + Math.abs(d[1]) * 0.25, ox, oy);
      s += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="2.8" ry="6" fill="#46c08a" transform="rotate(' + d[0] + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"/>';
    });
    return s;
  }

  // ====== 一个完整工位（桌 + 显示器 + 椅 + 绿植，无人物）======
  function station(st, i) {
    var ox = 100, oy = 150, by = 50; // 椅子正前方居中
    var img = st.image || '';
    var center = P(30, 22, 0, ox, oy);
    var shadow = megaShadow(center[0], center[1] + 8, 74, 28);
    var inner = '';
    inner += monitor(ox, oy, img, 's' + i, 27);
    inner += desk(ox, oy);
    inner += deskPlant(ox, oy);
    inner += chair(ox, oy, by);
    return '<svg viewBox="0 0 200 230" class="iso" role="img" aria-label="' + (st.label || 'station') + '">' + shadow + inner + '</svg>';
  }

  // ====== 装饰区物件（左列休闲区）======

  // --- 茶水间 ---
  function kitchenetteSVG() {
    var ox = 50, oy = 65, s = '';
    var center = P(40, 28, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 56, 22);
    s += box(6, 14, 0, 68, 24, 24, W, ox, oy);
    s += box(8, 16, 24, 64, 20, 1.5, W2, ox, oy);
    [12, 23, 34, 45, 56].forEach(function (px) {
      s += box(px, 18, 25.5, 5.5, 5.5, 7, W, ox, oy);
      s += '<path d="' + cupLiquidPath(px + 2.75, 20, ox, oy) + '" fill="#8B6914"/>';
    });
    [15, 27, 39].forEach(function (px) {
      s += box(px, 6, 25.5, 7, 7, 7, { top: '#d4a574', left: '#c49464', right: '#b38555' }, ox, oy);
      s += blobAt(px + 3.5, 9.5, 33, 5, '#c98a5a', ox, oy);
    });
    s += box(54, 8, 25.5, 17, 13, 19, DK, ox, oy);
    s += box(56, 10, 44.5, 13, 9, 2.5, GK, ox, oy);
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

  // --- 跑步机 ---
  function treadmillSVG() {
    var ox = 50, oy = 75, s = '';
    var center = P(38, 30, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 52, 20);
    s += box(16, 22, 2, 52, 30, 4, GK, ox, oy);
    s += box(18, 24, 6, 48, 26, 2, DK, ox, oy);
    s += box(20, 20, 8, 4, 4, 22, GK, ox, oy);
    s += box(17, 17, 30, 10, 7, 10, W, ox, oy);
    s += box(19, 19, 33, 6, 3, 6, BLK, ox, oy);
    s += box(58, 44, 8, 4, 4, 16, GK, ox, oy);
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="treadmill">' + s + '</svg>';
  }

  // --- 马桶区（无人物）---
  function toiletZoneSVG() {
    var ox = 50, oy = 80, s = '';
    var center = P(38, 36, 0, ox, oy);
    s += megaShadow(center[0], center[1] + 5, 48, 18);
    s += box(32, 30, 0, 20, 16, 14, W, ox, oy);
    s += box(31, 40, 0, 22, 18, 6, W2, ox, oy);
    s += box(33, 42, 6, 18, 12, 3, W, ox, oy);
    s += box(32, 28, 0, 18, 4, 18, W, ox, oy);
    return '<svg viewBox="0 0 110 140" class="iso" role="img" aria-label="toilet-zone">' + s + '</svg>';
  }

  // ---- 装饰物入口 ----
  function decor(name) {
    if (name === 'kitchenette') return kitchenetteSVG();
    if (name === 'treadmill') return treadmillSVG();
    if (name === 'toilet_zone') return toiletZoneSVG();
    if (name === 'clock') return clockSVG();
    var ox = 50, oy = 60;
    var center = P(45, 38, 0, ox, oy);
    var s = megaShadow(center[0], center[1] + 4, 36, 14);
    s += box(38, 36, 0, 14, 14, 14, W, ox, oy);
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="' + name + '">' + s + '</svg>';
  }

  // --- 挂钟（小号，用于日期回看入口）---
  function clockSVG() {
    var s = '';
    s += '<line x1="50" y1="2" x2="50" y2="18" stroke="#cbd5e1" stroke-width="1.5"/>';
    s += '<circle cx="50" cy="58" r="34" fill="#ffffff" stroke="#dde4ea" stroke-width="2.5"/>';
    for (var t = 0; t < 12; t++) {
      var aa = t * Math.PI / 6;
      var x1 = 50 + Math.sin(aa) * 28, y1 = 58 - Math.cos(aa) * 28;
      var x2 = 50 + Math.sin(aa) * 33, y2 = 58 - Math.cos(aa) * 33;
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#cbd5e1" stroke-width="' + (t % 3 === 0 ? 1.5 : 1) + '"/>';
    }
    s += '<line x1="50" y1="58" x2="50" y2="42" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/>';
    s += '<line x1="50" y1="58" x2="64" y2="58" stroke="#374151" stroke-width="1.8" stroke-linecap="round"/>';
    s += '<circle cx="50" cy="58" r="2.5" fill="#ef4444"/>';
    return '<svg viewBox="0 0 100 115" class="iso clickable" role="img" aria-label="clock">' + s + '</svg>';
  }

  window.OfficeArt = {
    desk: desk, chair: chair, monitor: monitor, decor: decor, station: station
  };
})();
