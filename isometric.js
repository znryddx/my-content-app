// 等距 2.5D 渲染引擎：手绘办公家具，匹配 Marvis 截图质感（纯 SVG，轻量、手机流畅）
(function () {
  'use strict';

  var C = Math.cos(Math.PI / 6); // 0.8660
  var S = Math.sin(Math.PI / 6); // 0.5

  function P(x, y, z, ox, oy) { return [ox + (x - y) * C, oy + (x + y) * S - z]; }

  function poly(pts, fill) {
    return '<polygon points="' + pts.map(function (p) {
      return p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join(' ') + '" fill="' + fill + '"/>';
  }

  // 画一个立方体（可见三面：顶 / 右(x+) / 左(y+)）
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

  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (t) { return Math.max(0, Math.min(255, Math.round(t + (p / 100) * 255))); };
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  var WHITE = { top: '#ffffff', left: '#e9eef3', right: '#dde4ea' };
  var DARK = { top: '#3f4856', left: '#2f3744', right: '#242b35' };
  var SKIN = { top: '#f3cba6', left: '#e3b78f', right: '#d6a87e' };
  var PERSON = ['#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee', '#facc15'];

  // ---- 办公桌 ----
  function desk(ox, oy) {
    var s = '', tw = 58, td = 40, lh = 26, leg = 4, th = 4;
    [[0, 0], [tw - leg, 0], [0, td - leg], [tw - leg, td - leg]].forEach(function (p) {
      s += box(p[0], p[1], 0, leg, leg, lh, WHITE, ox, oy);
    });
    s += box(0, 0, lh, tw, td, th, WHITE, ox, oy);
    return s;
  }

  // ---- 转椅（by = 椅子在 y 方向的位置，靠前）----
  function chair(ox, oy, by) {
    var s = '', seatH = 16, seatW = 30, seatD = 28, seatT = 4;
    s += box(seatW / 2 - 3, by + seatD / 2 - 3, 0, 6, 6, seatH - 4, DARK, ox, oy); // 气压杆
    s += box(0, by, seatH, seatW, seatD, seatT, WHITE, ox, oy);                    // 坐垫
    s += box(0, by, seatH + seatT, seatW, 5, 26, WHITE, ox, oy);                   // 靠背
    return s;
  }

  // ---- 坐姿人物 ----
  function person(ox, oy, by, color) {
    var s = '', seatTop = 20;
    var pal = { top: color, left: shade(color, -14), right: shade(color, -26) };
    s += box(13, by + 8, seatTop, 16, 11, 20, pal, ox, oy);  // 身体
    s += box(16, by + 9, seatTop + 20, 11, 9, 11, SKIN, ox, oy); // 头
    return s;
  }

  // ---- 显示器（屏面可放自定义图片）----
  function monitor(ox, oy, img, id, baseZ) {
    baseZ = baseZ || 26;
    var s = '';
    s += box(20, 9, baseZ, 18, 7, 3, WHITE, ox, oy);            // 底座
    s += box(27, 11, baseZ + 3, 4, 2, 14, DARK, ox, oy);        // 支架
    var sw = 44, sh = 28, sx = 6, syf = 4, sdepth = 7;
    s += box(sx, syf, baseZ + 17, sw, sdepth, sh, WHITE, ox, oy); // 屏体
    var zTop = baseZ + 17 + sh;
    var P2 = function (X, Y, Z) { return P(X, Y, Z, ox, oy); };
    var a = P2(sx, syf + sdepth, baseZ + 17), b = P2(sx + sw, syf + sdepth, baseZ + 17);
    var c = P2(sx + sw, syf + sdepth, zTop), d = P2(sx, syf + sdepth, zTop);
    var pts = [a, b, c, d].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    if (img) {
      s += '<clipPath id="scr' + id + '"><polygon points="' + pts + '"/></clipPath>';
      var e = ox + (sx - (syf + sdepth)) * C;
      var f = oy + (sx + syf + sdepth) * S - zTop;
      s += '<image href="' + img + '" width="' + sw + '" height="' + sh + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#scr' + id + ')" transform="matrix(' + C.toFixed(4) + ',' + S.toFixed(4) + ',0,1,' + e.toFixed(2) + ',' + f.toFixed(2) + ')"/>';
    } else {
      s += '<polygon points="' + pts + '" fill="#0f172a"/>';
      // 屏内简易装饰条
      s += '<polygon points="' +
        (a[0] + (b[0] - a[0]) * 0.18).toFixed(1) + ',' + (a[1] + (b[1] - a[1]) * 0.18).toFixed(1) + ' ' +
        (a[0] + (b[0] - a[0]) * 0.82).toFixed(1) + ',' + (a[1] + (b[1] - a[1]) * 0.82).toFixed(1) + ' ' +
        (d[0] + (c[0] - d[0]) * 0.82).toFixed(1) + ',' + (d[1] + (c[1] - d[1]) * 0.82).toFixed(1) + ' ' +
        (d[0] + (c[0] - d[0]) * 0.18).toFixed(1) + ',' + (d[1] + (c[1] - d[1]) * 0.18).toFixed(1) + '" fill="#1e293b"/>';
    }
    return s;
  }

  // ---- 装饰区物件 ----
  function decor(name) {
    var ox = 50, oy = 60, s = '';
    var shadow = '<ellipse cx="' + P(45, 38, 0, ox, oy)[0].toFixed(1) + '" cy="' + P(45, 38, 0, ox, oy)[1].toFixed(1) + '" rx="34" ry="14" fill="rgba(23,32,51,0.07)"/>';
    if (name === 'plant') {
      s += box(36, 32, 2, 14, 14, 14, { top: '#c98a5a', left: '#b3774a', right: '#a3673f' }, ox, oy);
      s += blob(43, 39, 20, 15, '#3ba776', ox, oy);
      s += blob(38, 35, 22, 11, '#4cc88f', ox, oy);
      s += blob(48, 37, 21, 10, '#43bd84', ox, oy);
    } else if (name === 'coffee') {
      s += box(30, 28, 0, 30, 18, 16, WHITE, ox, oy);
      s += box(38, 33, 16, 14, 8, 13, WHITE, ox, oy);
      s += box(38, 33, 29, 14, 8, 2, { top: '#d8b08a', left: '#c79a76', right: '#b98a64' }, ox, oy);
      s += box(52, 35, 18, 3, 4, 7, WHITE, ox, oy);
    } else if (name === 'treadmill') {
      s += box(22, 26, 2, 46, 26, 4, DARK, ox, oy);
      s += box(22, 26, 6, 46, 4, 13, { top: '#4b5563', left: '#3a424e', right: '#2f3744' }, ox, oy);
      s += box(22, 48, 6, 46, 4, 13, { top: '#4b5563', left: '#3a424e', right: '#2f3744' }, ox, oy);
      s += box(24, 24, 19, 6, 30, 3, { top: '#6b7280', left: '#525a66', right: '#434a55' }, ox, oy);
    } else if (name === 'watercooler') {
      s += box(36, 34, 0, 16, 16, 30, WHITE, ox, oy);
      s += box(38, 36, 30, 12, 12, 16, { top: '#bfe0f5', left: '#9fcdec', right: '#8bbfe0' }, ox, oy);
      s += box(40, 52, 8, 4, 4, 9, { top: '#dbe4ee', left: '#c7d2de', right: '#b9c4d2' }, ox, oy);
    } else if (name === 'toilet') {
      s += box(34, 30, 0, 18, 16, 14, WHITE, ox, oy);
      s += box(33, 40, 0, 20, 18, 8, { top: '#fbfdff', left: '#e9eef3', right: '#dde4ea' }, ox, oy);
      s += box(35, 43, 8, 16, 12, 4, WHITE, ox, oy);
    } else if (name === 'muffin') {
      s += box(26, 26, 0, 40, 22, 16, WHITE, ox, oy);
      s += box(32, 32, 16, 12, 12, 12, { top: '#caa06a', left: '#b88c54', right: '#a87c45' }, ox, oy);
      s += blob(38, 38, 30, 11, '#c9883f', ox, oy);
      s += blob(36, 36, 32, 7, '#e0a85a', ox, oy);
    } else if (name === 'clock') {
      s += '<line x1="50" y1="4" x2="50" y2="22" stroke="#9aa3b2" stroke-width="2"/>';
      s += '<circle cx="50" cy="64" r="38" fill="#ffffff" stroke="#dde4ea" stroke-width="3"/>';
      for (var t = 0; t < 12; t++) {
        var aa = t * Math.PI / 6;
        var x1 = 50 + Math.sin(aa) * 31, y1 = 64 - Math.cos(aa) * 31;
        var x2 = 50 + Math.sin(aa) * 36, y2 = 64 - Math.cos(aa) * 36;
        s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#cbd5e1" stroke-width="1.5"/>';
      }
      s += '<line x1="50" y1="64" x2="50" y2="44" stroke="#374151" stroke-width="3" stroke-linecap="round"/>';
      s += '<line x1="50" y1="64" x2="68" y2="64" stroke="#374151" stroke-width="2" stroke-linecap="round"/>';
      s += '<circle cx="50" cy="64" r="3" fill="#ef4444"/>';
    } else {
      s += box(38, 36, 0, 12, 12, 12, { top: '#c98a5a', left: '#b3774a', right: '#a3673f' }, ox, oy);
      s += blob(44, 42, 16, 10, '#43bd84', ox, oy);
    }
    return '<svg viewBox="0 0 100 130" class="iso" role="img" aria-label="' + name + '">' + shadow + s + '</svg>';
  }

  // ---- 一个工位（显示器图片可配置）----
  function station(st, i) {
    var ox = 100, oy = 140, by = 46;
    var img = st.image || '';
    var center = P(29, 20, 0, ox, oy);
    var shadow = '<ellipse cx="' + center[0].toFixed(1) + '" cy="' + center[1].toFixed(1) + '" rx="58" ry="24" fill="rgba(23,32,51,0.08)"/>';
    var inner = '';
    inner += monitor(ox, oy, img, 's' + i, 26);
    inner += desk(ox, oy);
    inner += chair(ox, oy, by);
    if (st.character !== false) inner += person(ox, oy, by, PERSON[i % PERSON.length]);
    return '<svg viewBox="0 0 210 230" class="iso" role="img" aria-label="' + (st.label || 'station') + '">' + shadow + inner + '</svg>';
  }

  window.OfficeArt = { desk: desk, chair: chair, person: person, monitor: monitor, decor: decor, station: station };
})();
