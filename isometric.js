// ===== 等距 2.5D 渲染引擎 —— Marvis 工位风格 =====
// 参考 Marvis 工位视觉：纯白为主、极浅灰辅助、黑色点缀；极淡大范围柔影
(function () {
  'use strict';

  var C = Math.cos(Math.PI / 6); // 0.8660254
  var S = Math.sin(Math.PI / 6); // 0.5
  var UID = 0;
  function uid() { return 'm' + (UID++); }

  function P(x, y, z, ox, oy) { return [ox + (x - y) * C, oy + (x + y) * S - z]; }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function poly(p, fill, extra) { return '<polygon points="' + pts(p) + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  function box(x, y, z, w, d, h, pal, ox, oy) {
    var T = [P(x, y, z + h, ox, oy), P(x + w, y, z + h, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    var R = [P(x + w, y, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x + w, y, z + h, ox, oy)];
    var L = [P(x, y + d, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    return poly(L, pal.left) + poly(R, pal.right) + poly(T, pal.top);
  }

  // ===== Marvis 配色：纯白为主、极浅灰辅助、黑色点缀 =====
  var W  = { top: '#ffffff', left: '#f4f6f8', right: '#e8eef3' };
  var W2 = { top: '#fafbfc', left: '#f0f4f7', right: '#e4eaf0' };
  var GK = { top: '#f7f8fa', left: '#ecedf0', right: '#e2e5e9' };
  var DK = { top: '#3a414c', left: '#2d333d', right: '#22262e' };
  var BLK = { top: '#1a1d24', left: '#12141a', right: '#0c0d12' };

  function shadeColor(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + p));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + p));
    var b = Math.max(0, Math.min(255, (n & 255) + p));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ===== 极淡大范围柔影（Marvis 标志性）=====
  function megaShadow(cx, cy, rx, ry) {
    var id = uid();
    return '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#94a3b8" stop-opacity="0.12"/>' +
      '<stop offset="55%" stop-color="#94a3b8" stop-opacity="0.06"/>' +
      '<stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + ')"/>';
  }

  // ===== 办公桌（纤薄白色长桌）=====
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

  // ===== 办公椅（白色 + 浅灰五星脚）=====
  function chair(ox, oy, by) {
    var s = '';
    var seatW = 26, seatD = 22, seatT = 5, seatZ = 18;
    var cx = 30;
    var fc = P(cx, by, 0, ox, oy);
    s += '<ellipse cx="' + fc[0].toFixed(1) + '" cy="' + (fc[1] + 2).toFixed(1) + '" rx="13" ry="5.5" fill="#e8eef3"/>';
    [[-10, -4], [10, -4], [-10, 6], [10, 6], [0, -9]].forEach(function (lg) {
      s += box(cx - 1.5 + lg[0], by - 1.5 + lg[1], 1, 3, 3, 4, GK, ox, oy);
    });
    s += box(cx - 2, by - 2, 5, 4, 4, seatZ - 5, GK, ox, oy);
    s += box(cx - seatW / 2, by - seatD / 2, seatZ, seatW, seatD, seatT, W, ox, oy);
    s += box(cx - seatW / 2 + 2, by - seatD / 2 - 2, seatZ + seatT, seatW - 4, 4, 22, W, ox, oy);
    s += box(cx - seatW / 2 - 1, by - seatD / 2, seatZ + 2, 3, 3, 9, GK, ox, oy);
    s += box(cx + seatW / 2 - 2, by - seatD / 2, seatZ + 2, 3, 3, 9, GK, ox, oy);
    return s;
  }

  // ===== 显示器（黑屏 + 纤薄边框 + 支架 + 屏幕中央色块）=====
  function monitor(ox, oy, scarfColor) {
    scarfColor = scarfColor || '#3a6b5e';
    var s = '';
    var cx = 30;
    s += box(cx - 8, 13, 27, 16, 10, 2.5, W2, ox, oy);
    s += box(cx - 3, 16, 29.5, 6, 4, 13, GK, ox, oy);
    var bx = 4, byf = 2, bw = 52, bh = 31, bd = 7;
    s += box(bx, byf, 42.5, bw, bd, bh, DK, ox, oy);

    var P2 = function (X, Y, Z) { return P(X, Y, Z, ox, oy); };
    var ix = bx + 2.5, iw = bw - 5, iz0 = 43.5, iz1 = iz0 + bh - 2;
    var a = P2(ix, byf + bd, iz0), b = P2(ix + iw, byf + bd, iz0);
    var c = P2(ix + iw, byf + bd, iz1), d = P2(ix, byf + bd, iz1);
    var face = pts([a, b, c, d]);
    s += '<polygon points="' + face + '" fill="#1e232d"/>';
    // 屏幕中央色块（围巾色）
    var cx2 = (a[0] + b[0]) / 2;
    var cy2 = (a[1] + c[1]) / 2;
    var w2 = 18, h2 = 12;
    s += '<polygon points="' +
      (cx2 - w2).toFixed(1) + ',' + (cy2 + h2 * 0.6).toFixed(1) + ' ' +
      (cx2 + w2).toFixed(1) + ',' + (cy2 + h2 * 0.6).toFixed(1) + ' ' +
      (cx2 + w2).toFixed(1) + ',' + (cy2 - h2 * 0.6).toFixed(1) + ' ' +
      (cx2 - w2).toFixed(1) + ',' + (cy2 - h2 * 0.6).toFixed(1) +
      '" fill="' + scarfColor + '"/>';
    // 屏幕上方浅反光
    var r1 = a[0] + (b[0] - a[0]) * 0.08, r1y = a[1] + (b[1] - a[1]) * 0.08;
    var r2 = a[0] + (b[0] - a[0]) * 0.28, r2y = a[1] + (b[1] - a[1]) * 0.28;
    var r3 = d[0] + (c[0] - d[0]) * 0.28, r3y = d[1] + (c[1] - d[1]) * 0.28;
    var r4 = d[0] + (c[0] - d[0]) * 0.08, r4y = d[1] + (c[1] - d[1]) * 0.08;
    s += '<polygon points="' + r1.toFixed(1) + ',' + r1y.toFixed(1) + ' ' + r2.toFixed(1) + ',' + r2y.toFixed(1) + ' ' + r3.toFixed(1) + ',' + r3y.toFixed(1) + ' ' + r4.toFixed(1) + ',' + r4y.toFixed(1) + '" fill="rgba(255,255,255,0.05)"/>';
    return s;
  }

  // ===== 小马吉祥物（Marvis 黑马 + 围巾）=====
  // 简化等距版本：黑色身体 + 头部 + 耳朵 + 笑眯眼 + 围巾（绕身体）
  function horse(ox, oy, scarfColor) {
    scarfColor = scarfColor || '#3a6b5e';
    var s = '';
    // 小马坐在椅子上，靠背位置：cy 偏前，cz 坐垫高度
    var cx = 30;       // x 居中
    var cy = 18;       // 座位中心
    var cz = 23;       // 坐垫顶

    // ===== 身体（坐姿，圆润立方体）=====
    // 顶部
    var bodyTop = [
      P(cx - 7, cy, cz, ox, oy),
      P(cx + 7, cy, cz, ox, oy),
      P(cx + 7, cy + 11, cz, ox, oy),
      P(cx - 7, cy + 11, cz, ox, oy)
    ];
    // 右侧（深）
    var bodyRight = [
      P(cx + 7, cy, cz, ox, oy),
      P(cx + 7, cy + 11, cz, ox, oy),
      P(cx + 7, cy + 11, cz + 10, ox, oy),
      P(cx + 7, cy, cz + 10, ox, oy)
    ];
    // 前侧（面对观者的左侧）
    var bodyFront = [
      P(cx - 7, cy, cz, ox, oy),
      P(cx + 7, cy, cz, ox, oy),
      P(cx + 7, cy, cz + 10, ox, oy),
      P(cx - 7, cy, cz + 10, ox, oy)
    ];
    s += poly(bodyRight, '#0c0d12');
    s += poly(bodyFront, '#12141a');
    s += poly(bodyTop, '#1a1d24');

    // ===== 围巾（绕在脖子，围巾色 + 阴影色）=====
    // 围巾厚度 3 单位，位于身体上方 cz+8
    var scarfZ0 = cz + 7, scarfZ1 = cz + 10;
    var scarfRight = [
      P(cx + 7, cy, scarfZ0, ox, oy),
      P(cx + 7, cy + 11, scarfZ0, ox, oy),
      P(cx + 7, cy + 11, scarfZ1, ox, oy),
      P(cx + 7, cy, scarfZ1, ox, oy)
    ];
    var scarfFront = [
      P(cx - 7, cy, scarfZ0, ox, oy),
      P(cx + 7, cy, scarfZ0, ox, oy),
      P(cx + 7, cy, scarfZ1, ox, oy),
      P(cx - 7, cy, scarfZ1, ox, oy)
    ];
    var scarfTop = [
      P(cx - 7, cy, scarfZ1, ox, oy),
      P(cx + 7, cy, scarfZ1, ox, oy),
      P(cx + 7, cy + 11, scarfZ1, ox, oy),
      P(cx - 7, cy + 11, scarfZ1, ox, oy)
    ];
    s += poly(scarfRight, shadeColor(scarfColor, -25));
    s += poly(scarfFront, scarfColor);
    s += poly(scarfTop, shadeColor(scarfColor, 10));

    // ===== 头部（位于身体前方偏上）=====
    var hx = cx, hy = cy - 1, hz0 = cz + 10, hz1 = cz + 22;
    var headW = 8, headD = 11;
    var headTop = [
      P(hx - headW, hy, hz1, ox, oy),
      P(hx + headW, hy, hz1, ox, oy),
      P(hx + headW, hy + headD, hz1, ox, oy),
      P(hx - headW, hy + headD, hz1, ox, oy)
    ];
    var headRight = [
      P(hx + headW, hy, hz0, ox, oy),
      P(hx + headW, hy + headD, hz0, ox, oy),
      P(hx + headW, hy + headD, hz1, ox, oy),
      P(hx + headW, hy, hz1, ox, oy)
    ];
    var headFront = [
      P(hx - headW, hy, hz0, ox, oy),
      P(hx + headW, hy, hz0, ox, oy),
      P(hx + headW, hy, hz1, ox, oy),
      P(hx - headW, hy, hz1, ox, oy)
    ];
    s += poly(headRight, '#0c0d12');
    s += poly(headFront, '#15171e');
    s += poly(headTop, '#1a1d24');

    // ===== 耳朵（头顶两个小三角）=====
    // 用线条画耳廓
    var ear1 = P(hx - 4, hy + 2, hz1, ox, oy);
    var ear2 = P(hx - 2, hy + 2, hz1 + 5, ox, oy);
    var ear3 = P(hx, hy + 2, hz1, ox, oy);
    s += '<polygon points="' + ear1[0].toFixed(1) + ',' + ear1[1].toFixed(1) + ' ' + ear2[0].toFixed(1) + ',' + ear2[1].toFixed(1) + ' ' + ear3[0].toFixed(1) + ',' + ear3[1].toFixed(1) + '" fill="#1a1d24"/>';
    var ear1b = P(hx + 0, hy + 2, hz1, ox, oy);
    var ear2b = P(hx + 2, hy + 2, hz1 + 5, ox, oy);
    var ear3b = P(hx + 4, hy + 2, hz1, ox, oy);
    s += '<polygon points="' + ear1b[0].toFixed(1) + ',' + ear1b[1].toFixed(1) + ' ' + ear2b[0].toFixed(1) + ',' + ear2b[1].toFixed(1) + ' ' + ear3b[0].toFixed(1) + ',' + ear3b[1].toFixed(1) + '" fill="#1a1d24"/>';

    // ===== 眼睛（笑眯的两条弧线）画在头前侧 =====
    // 前侧中心 y 大约 (headFront y0 + y1)/2，弧线用 svg path
    var eyeY = (headFront[0][1] + headFront[2][1]) / 2 - 4;
    var eyeX1 = hx - 3, eyeX2 = hx + 3;
    var eyeYO = eyeY - 2;
    s += '<path d="M ' + (eyeX1 - 2).toFixed(1) + ' ' + eyeYO.toFixed(1) + ' Q ' + eyeX1.toFixed(1) + ' ' + (eyeYO + 2.5).toFixed(1) + ' ' + (eyeX1 + 2).toFixed(1) + ' ' + eyeYO.toFixed(1) + '" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    s += '<path d="M ' + (eyeX2 - 2).toFixed(1) + ' ' + eyeYO.toFixed(1) + ' Q ' + eyeX2.toFixed(1) + ' ' + (eyeYO + 2.5).toFixed(1) + ' ' + (eyeX2 + 2).toFixed(1) + ' ' + eyeYO.toFixed(1) + '" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round"/>';

    return s;
  }

  // ===== 一个完整工位：桌 + 椅 + 显示器 + 小马吉祥物 =====
  function station(st, i) {
    var ox = 100, oy = 150, by = 50;
    var scarfColor = (st && st.scarfColor) || '#3a6b5e';
    var center = P(30, 22, 0, ox, oy);
    var shadow = megaShadow(center[0], center[1] + 8, 74, 28);
    var inner = '';
    inner += monitor(ox, oy, scarfColor);
    inner += desk(ox, oy);
    inner += horse(ox, oy, scarfColor);
    inner += chair(ox, oy, by);
    return '<svg viewBox="0 0 200 230" class="iso-station" role="img" aria-label="' + ((st && st.label) || 'station') + '">' + shadow + inner + '</svg>';
  }

  window.OfficeArt = {
    desk: desk,
    chair: chair,
    monitor: monitor,
    horse: horse,
    station: station,
    megaShadow: megaShadow,
    box: box,
    P: P,
    shadeColor: shadeColor,
    palette: { W: W, W2: W2, GK: GK, DK: DK, BLK: BLK }
  };
})();