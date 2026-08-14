// 东方器物 · 每日内容 —— Marvis / 锤子 OS 风格 launcher
// 首页：暗色 launcher，品类以 squircle emoji 图标呈现 + 底部 Dock
// 点图标：滑出奶油色品类页（banner + 内容卡片网格）
// 点卡片：底部弹出奶油色详情 sheet（可复制）
(function () {
  'use strict';

  var DATA = './data/';
  var LS = 'mca_state_v1';

  // 每个品类的图标 / 渐变色 / 副标题（匹配 dongfangqiwu 的 Marvis 视觉）
  var META = {
    brief:    { emoji: '📰', color: '#2f4858', sub: '每日内容营销综合简报' },
    bracelet: { emoji: '📿', color: '#b8860b', sub: '腕间珠玉 · 手串' },
    incense:  { emoji: '💨', color: '#b5432f', sub: '焚香默坐 · 香道' },
    burner:   { emoji: '🔥', color: '#a8592a', sub: '炉瓶三事 · 香炉香插' },
    statue:   { emoji: '🗿', color: '#9c6b30', sub: '庄严妙相 · 造像' },
    agarwood: { emoji: '🪵', color: '#8a5a3c', sub: '沉水千年 · 沉香' },
    inlay:    { emoji: '💎', color: '#2e7d5b', sub: '螺光贝彩 · 百宝嵌' },
    teaware:  { emoji: '🍵', color: '#6b8e5a', sub: '一盏清茗 · 茶空间' },
    gift:     { emoji: '🎁', color: '#6d3b5e', sub: '以礼载道 · 高端礼品' }
  };
  // 底部 Dock 常驻几个品类
  var DOCK = ['brief', 'statue', 'incense', 'teaware'];

  var cfg = null;
  var catMap = {};          // id -> category config
  var curCat = null;        // 当前品类 id
  var curDate = null;       // 当前日期 'YYYY-MM-DD'

  // ---------- 工具 ----------
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + p));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + p));
    var b = Math.max(0, Math.min(255, (n & 255) + p));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { fallbackCopy(t); });
    } else { fallbackCopy(t); }
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请长按选择后复制'); }
    document.body.removeChild(ta);
  }
  function todayStr() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  var WK = ['日', '一', '二', '三', '四', '五', '六'];
  function dateLabel(d) {
    var p = String(d).split('-');
    if (p.length !== 3) return d;
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return d + '　星期' + WK[dt.getDay()];
  }

  // ---------- 数据读取 ----------
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function fetchData(catId, date) { return fetchJSON(DATA + catId + '/' + date + '.json'); }
  function fetchDates(catId) { return fetchJSON(DATA + catId + '/dates.json').then(function (a) { return Array.isArray(a) ? a : []; }); }

  function cellsOf(cat) { return (cat && cat.cells) ? cat.cells : (cfg.cells || []); }
  function cellTitle(cat, meta) {
    var ov = (cat && cat.cell_titles) || {};
    if (meta.id && ov[meta.id]) return ov[meta.id];
    return meta.title || meta.id || '';
  }

  // ---------- 首页 launcher ----------
  function renderHome() {
    var scene = $('#scene');
    scene.innerHTML =
      '<div class="desktop-top">' +
        '<div class="date-line" id="dateLine"></div>' +
        '<div class="launcher-title">' + esc(cfg.app_title || '每日内容') + '</div>' +
      '</div>' +
      '<div class="app-grid" id="appGrid"></div>';

    var grid = scene.querySelector('#appGrid');
    (cfg.categories || []).forEach(function (cat) {
      var m = META[cat.id] || { emoji: '✨', color: '#2f4858', sub: '' };
      var btn = document.createElement('button');
      btn.className = 'app-icon';
      btn.style.background = 'linear-gradient(150deg,' + m.color + ',' + shade(m.color, -30) + ')';
      btn.innerHTML = '<span class="ai-emoji">' + m.emoji + '</span><span class="ai-name">' + esc(cat.label) + '</span>';
      btn.addEventListener('click', function () { openCategory(cat.id); });
      grid.appendChild(btn);
    });

    var d = new Date();
    var mm = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2);
    var dl = scene.querySelector('#dateLine');
    if (dl) dl.textContent = d.getFullYear() + '-' + mm + '-' + dd + '　星期' + WK[d.getDay()];

    renderDock();
    window.scrollTo(0, 0);
  }

  function renderDock() {
    var dock = $('#dock');
    dock.innerHTML = '';
    DOCK.forEach(function (id) {
      var cat = catMap[id]; if (!cat) return;
      var m = META[id] || { emoji: '✨', color: '#2f4858' };
      var btn = document.createElement('button');
      btn.className = 'dock-icon';
      btn.style.background = 'linear-gradient(150deg,' + m.color + ',' + shade(m.color, -30) + ')';
      btn.innerHTML = '<span>' + m.emoji + '</span>';
      btn.addEventListener('click', function () { openCategory(id); });
      dock.appendChild(btn);
    });
  }

  // ---------- 品类页 ----------
  function openCategory(catId) {
    curCat = catId;
    fetchDates(catId).then(function (dates) {
      var date = (dates && dates.length) ? dates[dates.length - 1] : todayStr();
      loadCategory(catId, date);
    });
  }

  function loadCategory(catId, date) {
    curDate = date;
    var cat = catMap[catId];
    var m = META[catId] || { emoji: '✨', color: '#2f4858', sub: '' };

    $('#cpTitle').textContent = cat ? cat.label : catId;
    $('#cpSub').textContent = m.sub;

    var banner = $('#cpBanner');
    banner.style.background = 'linear-gradient(145deg,' + m.color + ',' + shade(m.color, -28) + ')';
    banner.innerHTML = '<div class="cp-banner-emoji">' + m.emoji + '</div><div class="cp-banner-name">' + esc(cat ? cat.label : catId) + '</div>';

    $('#cpDate').textContent = dateLabel(date);

    // 先渲染骨架，数据回来再填卡片
    var mods = $('#cpModules');
    mods.innerHTML = '<div class="cp-cell"><div class="cp-cell-title">加载中…</div></div>';

    fetchData(catId, date).then(function (data) {
      var byId = {};
      if (data && data.cells) data.cells.forEach(function (c) { byId[c.id] = c; });
      var meta = cellsOf(cat);
      mods.innerHTML = '';
      if (!meta.length) {
        mods.innerHTML = '<div class="cp-cell"><div class="cp-cell-body">该品类暂无内容模块</div></div>';
        return;
      }
      meta.forEach(function (cm) {
        var display = cellTitle(cat, cm);
        var body = (byId[cm.id] && byId[cm.id].body) || '今日内容生成中…（部署后将由 GitHub Models 每天自动生成）';
        var card = document.createElement('div');
        card.className = 'cp-cell';
        card.innerHTML = '<div class="cp-cell-title">' + esc(display) + '</div><div class="cp-cell-body">' + esc(body) + '</div>';
        card.addEventListener('click', function () { openSheet(m.emoji, display, body); });
        mods.appendChild(card);
      });
    });

    var page = $('#categoryPage');
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    page.scrollTop = 0;
  }

  function closeCategory() {
    var page = $('#categoryPage');
    page.classList.remove('open');
    page.setAttribute('aria-hidden', 'true');
  }

  // ---------- 详情 sheet ----------
  var _sheetBody = '';
  function formatBody(text) {
    var lines = String(text || '').split('\n');
    var out = [], buf = [];
    function flush() {
      if (!buf.length) return;
      var first = buf[0].trim();
      if (buf.every(function (l) { return l.trim().startsWith('|'); })) {
        var rows = buf.filter(function (l) { return !l.includes('---'); }).map(function (l) {
          return '<tr>' + l.split('|').slice(1, -1).map(function (c) { return '<td>' + c.trim() + '</td>'; }).join('') + '</tr>';
        });
        if (rows.length) {
          out.push('<table>' + rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>') + rows.slice(1).join('') + '</table>');
        }
      } else if (buf.every(function (l) { return /^[•✓]\s/.test(l.trim()); })) {
        out.push('<ul>' + buf.map(function (l) { return '<li>' + l.replace(/^[•✓]\s/, '') + '</li>'; }).join('') + '</ul>');
      } else {
        out.push('<p>' + buf.join('<br>') + '</p>');
      }
      buf = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].replace(/\r/g, '').trim();
      if (!t) { flush(); continue; }
      if (t.startsWith('[') && t.endsWith(']')) { flush(); out.push('<h4>' + t.slice(1, -1) + '</h4>'); continue; }
      if (t.startsWith('|')) { if (buf.length && !buf[0].trim().startsWith('|')) flush(); buf.push(t); continue; }
      if (/^[•✓]\s/.test(t)) { if (buf.length && !/^[•✓]\s/.test(buf[0].trim())) flush(); buf.push(t); continue; }
      if (buf.length && (/^[•✓]\s/.test(buf[0].trim()) || buf[0].trim().startsWith('|'))) flush();
      buf.push(t);
    }
    flush();
    return out.join('');
  }
  function openSheet(icon, title, body) {
    _sheetBody = body;
    $('#sheetIcon').textContent = icon || '✨';
    $('#sheetTitle').textContent = title || '';
    $('#sheetSub').textContent = '每日内容 · 可复制';
    var el = $('#sheetDesc');
    el.innerHTML = formatBody(body);
    el.scrollTop = 0;
    var s = $('#sheet');
    s.classList.add('open');
    s.setAttribute('aria-hidden', 'false');
  }
  function hideSheet() { var s = $('#sheet'); s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); }

  // ---------- 日期选择 ----------
  function openDatePicker() {
    if (!curCat) return;
    fetchDates(curCat).then(function (dates) {
      var list = $('#dateList');
      if (!dates.length) { list.innerHTML = '<div class="date-chip">暂无历史，部署后每日自动生成</div>'; }
      else {
        list.innerHTML = '';
        dates.forEach(function (dt) {
          var c = document.createElement('div');
          c.className = 'date-chip' + (dt === curDate ? ' active' : '');
          c.textContent = dateLabel(dt) + (dt === todayStr() ? '（今天）' : '');
          c.addEventListener('click', function () {
            hideDateSheet();
            loadCategory(curCat, dt);
          });
          list.appendChild(c);
        });
      }
      var s = $('#dateSheet');
      s.classList.add('open');
      s.setAttribute('aria-hidden', 'false');
    });
  }
  function hideDateSheet() { var s = $('#dateSheet'); s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); }

  // ---------- 状态栏时间 ----------
  function tick() {
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    var t = $('#sbTime'); if (t) t.textContent = hh + ':' + mm;
  }

  // ---------- 启动 ----------
  fetch('./config.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cfg = c;
      (cfg.categories || []).forEach(function (cat) { catMap[cat.id] = cat; });
      if (cfg.app_title) document.title = cfg.app_title;
      renderHome();
      tick(); setInterval(tick, 10000);

      $('#cpBack').addEventListener('click', closeCategory);
      $('#cpDateRow').addEventListener('click', openDatePicker);
      $('#sheetClose').addEventListener('click', hideSheet);
      $('#sheetCopy').addEventListener('click', function () {
        if (!_sheetBody) return;
        var clean = _sheetBody.replace(/\[|\]/g, '').replace(/^•\s/gm, '').replace(/^✓\s/gm, '');
        copyText(clean);
        var btn = $('#sheetCopy'); var old = btn.textContent;
        btn.textContent = '已复制'; setTimeout(function () { btn.textContent = old; }, 1500);
      });
      $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') hideSheet(); });
      $('#dateClose').addEventListener('click', hideDateSheet);
      $('#dateSheet').addEventListener('click', function (e) { if (e.target.id === 'dateSheet') hideDateSheet(); });
    })
    .catch(function (e) {
      $('#scene').innerHTML = '<div class="cp-cell"><div class="cp-cell-body">配置加载失败：' + esc(e.message) + '</div></div>';
    });
})();
