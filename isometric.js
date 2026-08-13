// 等距 2.5D 渲染引擎：手绘办公家具，高保真贴近 Marvis 质感（纯 SVG，轻量、手机流畅）
(function () {
  'use strict';

  var C = Math.cos(Math.PI / 6); // 0.8660
  var S = Math.sin(Math.PI / 6); // 0.5
  var UID = 0;
  function uid() { return 'g' + (UID++); }

  function P(x, y, z, ox, oy) { return [ox + (x - y) * C, oy + (x + y) * S - z]; }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function poly(p, fill, extra) { return '<polygon points="' + pts(p) + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  function box(x, y, z, w, d, h, pal, ox, oy) {
    var T = [P(x, y, z + h, ox, oy), P(x + w, y, z + h, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    var R = [P(x + w, y, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x + w, y, z + h, ox, oy)];
    var L = [P(x, y + d, z, ox, oy), P(x + w, y + d, z, ox, oy), P(x + w, y + d, z + h, ox, oy), P(x, y + d, z + h, ox, oy)];
    return poly(L, pal.left) + poly(R, pal.right) + poly(T, pal.top);
  }

  function blob(cx, cy, cz, r, fill, ox, oy) {
    var p = P(cx, cy, cz, ox, oy);
    return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="' + fill + '"/>';
  }

  // 柔和接触阴影（径向渐变，无滤镜、兼容好）
  function softShadow(cx, cy, rx, ry, op) {
    var id = uid();
    return '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#1e293b" stop-opacity="' + op + '"/>' +
      '<stop offset="70%" stop-color="#1e293b" stop-opacity="' + (op * 0.5).toFixed(3) + '"/>' +
      '<stop offset="100%" stop-color="#1e293b" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + ')"/>';
  }

  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (t) { return Math.max(0, Math.min(255, Math.round(t + (p / 100) * 255))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  var WHITE = { top: '#ffffff', left: '#eef2f6', right: '#e1e8ef' };
  var DARK = { top: '#5b6573', left: '#454e5b', right: '#363d49' };
  var WOOD = { top: '#d9a877', left: '#c59568', right: '#b3855a' };
  var SKIN = { top: '#f3cba6', left: '#e3b78f', right: '#d6a87e' };
  var PERSON = ['#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee', '#facc15'];

  // ---- 办公桌 ----
  function desk(ox, oy) {
    var s = '', tw = 60, td = 42, lh = 26, leg = 5, th = 4;
    [[0, 0], [tw - leg, 0], [0, td - leg], [tw - leg, td - leg]].forEach(function (p) {
      s += box(p[0], p[1], 0, leg, leg, lh, WHITE, ox, oy);
    });
    s += box(0, 0, lh, tw, td, th, WHITE, ox, oy);
    // 桌面高光条，增加干净质感
    var T = [P(2, 2, lh + th, ox, oy), P(tw - 2, 2, lh + th, ox, oy), P(tw - 2, td - 2, lh + th, ox, oy), P(2, td - 2, lh + th, ox, oy)];
    s += poly(T, '#ffffff');
    return s;
  }

  // ---- 人体工学椅 ----
  function chair(ox, oy, by) {
    var s = '', seatH = 15, seatW = 32, seatD = 28, seatT = 5;
    var c = P(seatW / 2, by + seatD / 2, 0, ox, oy);
    // 五星脚（简化：底盘 + 几根辐条）
    s += blob(c[0], c[1], 0, 13, 'rgba(30,41,59,0.10)', ox, oy);
    [[ -10, -6], [10, -6], [-10, 8], [10, 8]].forEach(function (l) {
      s += box(seatW / 2 - 2 + l[0], by + seatD / 2 - 2 + l[1], 0, 5, 5, 4, DARK, ox, oy);
    });
    s += box(seatW / 2 - 3, by + seatD / 2 - 3, 3, 6, 6, seatH - 3, DARK, ox, oy); // 气压杆
    s += box(0, by, seatH, seatW, seatD, seatT, WHITE, ox, oy);                   // 坐垫
    s += box(2, by + 2, seatH + seatT, seatW - 4, 5, 30, WHITE, ox, oy);          // 靠背
    s += box(0, by, seatH + 4, 4, 4, 9, DARK, ox, oy);                            // 左扶手
    s += box(seatW - 4, by, seatH + 4, 4, 4, 9, DARK, ox, oy);                    // 右扶手
    return s;
  }

  // ---- 坐姿人物 ----
  function person(ox, oy, by, color) {
    var s = '', seatTop = 20;
    var pal = { top: color, left: shade(color, -14), right: shade(color, -26) };
    s += box(13, by + 8, seatTop, 17, 11, 20, pal, ox, oy);     // 身体
    s += box(16, by + 9, seatTop + 20, 11, 9, 12, SKIN, ox, oy); // 头
    return s;
  }

  // ---- 显示器（屏面可放自定义图片，带纤薄边框）----
  function monitor(ox, oy, img, id, baseZ) {
    baseZ = baseZ || 26;
    var s = '';
    s += box(22, 11, baseZ, 16, 10, 3, WHITE, ox, oy);          // 底座
    s += box(27, 14, baseZ + 3, 5, 4, 14, DARK, ox, oy);        // 支架
    var bx = 5, byf = 3, bw = 48, bh = 30, bd = 8;
    s += box(bx, byf, baseZ + 17, bw, bd, bh, { top: '#0b1220', left: '#0b1220', right: '#0b1220' }, ox, oy); // 边框
    var zTop = baseZ + 17 + bh;
    var P2 = function (X, Y, Z) { return P(X, Y, Z, ox, oy); };
    var ix = bx + 3, iw = bw - 6, iz0 = baseZ + 17 + 1, iz1 = zTop - 1;
    var a = P2(ix, byf + bd, iz0), b = P2(ix + iw, byf + bd, iz0);
    var c = P2(ix + iw, byf + bd, iz1), d = P2(ix, byf + bd, iz1);
    var face = pts([a, b, c, d]);
    if (img) {
      s += '<clipPath id="scr' + id + '"><polygon points="' + face + '"/></clipPath>';
      var e = ox + (ix - (byf + bd)) * C;
      var f = oy + (ix + byf + bd) * S - iz0;
      s += '<image href="' + img + '" width="' + iw + '" height="' + (iz1 - iz0) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#scr' + id + ')" transform="matrix(' + C.toFixed(4) + ',' + S.toFixed(4) + ',0,1,' + e.toFixed(2) + ',' + f.toFixed(2) + ')"/>';
    } else {
      s += '<polygon points="' + face + '" fill="#0f172a"/>';
      s += '<polygon points="' +
        (a[0] + (b[0] - a[0]) * 0.16).toFixed(1) + ',' + (a[1] + (b[1] - a[1]) * 0.16).toFixed(1) + ' ' +
        (a[0] + (b[0] - a[0]) * 0.84).toFixed(1) + ',' + (a[1] + (b[1] - a[1]) * 0.84).toFixed(1) + ' ' +
        (d[0] + (c[0] - d[0]) * 0.84).toFixed(1) + ',' + (d[1] + (c[1] - d[1]) * 0.84).toFixed(1) + ' ' +
        (d[0] + (c[0] - d[0]) * 0.16).toFixed(1) + ',' + (d[1] + (c[1] - d[1]) * 0.16).toFixed(1) + '" fill="#1e293b"/>';
    }
    return s;
  }

  // ---- 装饰区物件 ----
  function decor(name) {
    var ox = 50, oy = 60, s = '';
    if (name === 'clock') {
      s += '<line x1="50" y1="6" x2="50" y2="22" stroke="#cbd5e1" stroke-width="2"/>';
      s += '<circle cx="50" cy="62" r="37" fill="#ffffff" stroke="#dde4ea" stroke-width="3"/>';
      for (var t = 0; t < 12; t++) {
        var aa = t * Math.PI / 6;
        var x1 = 50 + Math.sin(aa) * 30, y1 = 62 - Math.cos(aa) * 30;
        var x2 = 50 + Math.sin(aa) * 35, y2 = 62 - Math.cos(aa) * 35;
        s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#cbd5e1" stroke-width="1.5"/>';
      }
      s += '<line x1="50" y1="62" x2="50" y2="44" stroke="#374151" stroke-width="3" stroke-linecap="round"/>';
      s += '<line x1="50" y1="62" x2="66" y2="62" stroke="#374151" stroke-width="2" stroke-linecap="round"/>';
      s += '<circle cx="50" cy="62" r="3" fill="#ef4444"/>';
      return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="clock">' + s + '</svg>';
    }
    var center = P(45, 38, 0, ox, oy);
    var shadow = softShadow(center[0], center[1] + 4, 36, 14, 0.10);
    if (name === 'plant') {
      s += box(36, 32, 4, 16, 16, 14, WOOD, ox, oy);             // 花盆
      s += box(35, 31, 4, 18, 18, 3, { top: '#e7b98a', left: '#d3a676', right: '#c2966a' }, ox, oy);
      s += blob(43, 39, 24, 16, '#2f9e6b', ox, oy);
      s += blob(37, 35, 27, 12, '#3fb97f', ox, oy);
      s += blob(49, 37, 26, 11, '#37a874', ox, oy);
      s += blob(43, 42, 30, 9, '#4fd093', ox, oy);
    } else if (name === 'coffee') {
      s += box(28, 26, 0, 34, 20, 18, WHITE, ox, oy);
      s += box(34, 31, 18, 16, 10, 16, WHITE, ox, oy);
      s += box(34, 31, 34, 16, 10, 2, { top: '#d8b08a', left: '#c79a76', right: '#b98a64' }, ox, oy);
      s += box(52, 33, 20, 3, 5, 8, DARK, ox, oy);
    } else if (name === 'treadmill') {
      s += box(20, 24, 2, 50, 28, 4, DARK, ox, oy);
      s += box(22, 26, 6, 46, 4, 14, { top: '#525a66', left: '#3f4753', right: '#333a45' }, ox, oy);
      s += box(22, 48, 6, 46, 4, 14, { top: '#525a66', left: '#3f4753', right: '#333a45' }, ox, oy);
      s += box(26, 22, 20, 6, 32, 3, { top: '#6b7280', left: '#525a66', right: '#434a55' }, ox, oy);
    } else if (name === 'watercooler') {
      s += box(34, 34, 0, 18, 18, 30, WHITE, ox, oy);
      s += box(36, 36, 30, 14, 14, 18, { top: '#bfe0f5', left: '#9fcdec', right: '#8bbfe0' }, ox, oy);
      s += box(40, 52, 8, 5, 5, 10, { top: '#dbe4ee', left: '#c7d2de', right: '#b9c4d2' }, ox, oy);
    } else if (name === 'toilet') {
      s += box(34, 30, 0, 20, 16, 15, WHITE, ox, oy);
      s += box(33, 40, 0, 22, 18, 8, { top: '#fbfdff', left: '#e9eef3', right: '#dde4ea' }, ox, oy);
      s += box(35, 43, 8, 18, 12, 4, WHITE, ox, oy);
    } else if (name === 'muffin') {
      s += box(26, 26, 0, 40, 22, 16, WHITE, ox, oy);
      s += box(32, 32, 16, 13, 13, 13, WOOD, ox, oy);
      s += blob(38, 38, 32, 12, '#c9883f', ox, oy);
      s += blob(36, 36, 34, 8, '#e0a85a', ox, oy);
    } else {
      s += box(38, 36, 0, 12, 12, 12, WOOD, ox, oy);
      s += blob(44, 42, 16, 10, '#43bd84', ox, oy);
    }
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="' + name + '">' + shadow + s + '</svg>';
  }

  // ---- 一个工位（显示器图片可配置）----
  function station(st, i) {
    var ox = 105, oy = 150, by = 48;
    var img = st.image || '';
    var center = P(29, 20, 0, ox, oy);
    var shadow = softShadow(center[0], center[1] + 6, 62, 25, 0.12);
    var inner = '';
    inner += monitor(ox, oy, img, 's' + i, 26);
    inner += desk(ox, oy);
    inner += chair(ox, oy, by);
    if (st.character !== false) inner += person(ox, oy, by, PERSON[i % PERSON.length]);
    return '<svg viewBox="0 0 220 240" class="iso" role="img" aria-label="' + (st.label || 'station') + '">' + shadow + inner + '</svg>';
  }

  window.OfficeArt = { desk: desk, chair: chair, person: person, monitor: monitor, decor: decor, station: station };
})();
