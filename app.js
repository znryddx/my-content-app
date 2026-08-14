// 首页 = 等距工位画廊（8 个分类工位，由 config.json 驱动）
// 点工位 → 该分类「6 宫格」内容视图（Tuudo 手势：左滑删 / 右滑已完成 / 点全屏复制 / 拖红条 / 拖底钮）
// 休闲区挂钟 → 按日期回看历史（data/<cat>/<date>.json）
(function () {
  'use strict';

  var scene = document.getElementById('scene');
  var DATA = './data/';
  var LS = 'mca_state_v1';

  var cfg = null;
  var currentCat = null;   // {id,label,theme,strategy}
  var currentDate = null;  // 'YYYY-MM-DD'
  var redbar = null, addbtn = null;

  // ---------- 本地状态（已完成 / 已删除，仅本机） ----------
  function loadState() { try { return JSON.parse(localStorage.getItem(LS)) || { done: {}, del: {} }; } catch (e) { return { done: {}, del: {} }; } }
  function saveState(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  var state = loadState();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function keyOf(catId, date, cellId) { return catId + '|' + date + '|' + cellId; }

  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
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

  // ---------- 数据读取 ----------
  function fetchData(catId, date) {
    return fetch(DATA + catId + '/' + date + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function fetchDates(catId) {
    return fetch(DATA + catId + '/dates.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  function latestDate(catId) {
    return fetchDates(catId).then(function (arr) {
      if (arr && arr.length) return arr[arr.length - 1];
      return todayStr();
    });
  }

  // ---------- 首页（Marvis 布局：左休闲区竖排 + 右双列工位网格）—— 俯视写实图片 ----------
  function renderHome() {
    hideRedbar(); hideAddBtn();
    scene.innerHTML = '';
    var home = (cfg && cfg.home) || {};

    // 主容器：左休闲 + 右工位
    var layout = document.createElement('div'); layout.className = 'home-layout';

    // ===== 左侧休闲区（俯视写实图片：咖啡吧 / 跑步机 / 绿植角）=====
    var decorImages = { kitchenette: 'assets/coffee.webp', treadmill: 'assets/treadmill.webp', toilet_zone: 'assets/plant.webp' };
    var decorLabels = { kitchenette: '茶水间', treadmill: '健身区', toilet_zone: '绿植角' };

    if (home.decor && home.decor.length) {
      var lz = document.createElement('div'); lz.className = 'leisure-zone';
      home.decor.forEach(function (d) {
        var it = document.createElement('div');
        it.className = 'leisure-item' + (d === 'toilet_zone' ? ' clickable' : '');
        var imgSrc = decorImages[d] || '';
        it.innerHTML =
          '<div class="cap">' + esc(decorLabels[d] || d) + '</div>' +
          (imgSrc ? '<img class="scene-img" src="' + esc(imgSrc) + '" alt="' + esc(d) + '" loading="lazy"/>' : '<div class="img-placeholder">' + esc(d) + '</div>');
        if (d === 'toilet_zone') it.addEventListener('click', openDatePicker);
        lz.appendChild(it);
      });
      layout.appendChild(lz);
    }

    // ===== 右侧工位区（固定双列网格 —— 每个工位用同一张俯视工位图 + 分类标签）=====
    var sa = document.createElement('div'); sa.className = 'station-area';
    var grid = document.createElement('div'); grid.className = 'station-grid';
    (cfg.categories || []).forEach(function (st, i) {
      var card = document.createElement('div'); card.className = 'station';
      var stImg = st.image || 'assets/workstation.webp';  // 默认统一工位图；config 可覆盖为自定义图
      card.innerHTML =
        '<div class="label">' + esc(st.label) + '</div>' +
        '<img class="scene-img" src="' + esc(stImg) + '" alt="' + esc(st.label) + '" loading="lazy"/>' +
        '<div class="hint">点击进入 →</div>';
      card.addEventListener('click', function () {
        currentCat = st;
        latestDate(st.id).then(function (d) { currentDate = d; renderContent(); });
      });
      grid.appendChild(card);
    });
    sa.appendChild(grid);
    layout.appendChild(sa);
    scene.appendChild(layout);
    window.scrollTo(0, 0);
  }

  // ---------- 内容视图（6 宫格） ----------
  function renderContent() {
    if (!currentCat) currentCat = (cfg.categories || [])[0];
    var cat = currentCat, date = currentDate || todayStr();
    scene.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'cv';
    wrap.innerHTML =
      '<div class="cv-top"><span class="back" id="back">← 工位</span>' +
      '<span class="cv-title">' + esc(cat.label) + '</span>' +
      '<span class="cv-date" id="dated">' + date + ' ▾</span></div>' +
      '<div class="grid6" id="grid6"></div>';
    scene.appendChild(wrap);

    var grid6 = wrap.querySelector('#grid6');
    var cellsMeta = (cat.cells || cfg.cells || []);
    fetchData(cat.id, date).then(function (data) {
      var byId = {};
      if (data && data.cells) data.cells.forEach(function (c) { byId[c.id] = c; });
      cellsMeta.forEach(function (meta) {
        // 每分类可覆盖宫格标题（如 造像的 quote → 禅语金句）
        var overrides = (cat.cell_titles || {});
        var displayTitle = (meta.id && overrides[meta.id]) || meta.title;
        var body = (byId[meta.id] && byId[meta.id].body) || '今日内容生成中…（部署后将由 GitHub Models 每天自动生成）';
        var item = { id: meta.id, title: displayTitle, body: body };
        var cell = makeCell(item, cat.id, date);
        if (cell) grid6.appendChild(cell);
      });
    });

    wrap.querySelector('#back').addEventListener('click', renderHome);
    wrap.querySelector('#dated').addEventListener('click', openDatePicker);
    setupRedbar(grid6);
    setupAddBtn();
    window.scrollTo(0, 0);
  }

  function makeCell(it, catId, date) {
    var k = keyOf(catId, date, it.id);
    if (state.del[k]) return null;
    var done = !!state.done[k];
    var cell = document.createElement('div');
    cell.className = 'cell' + (done ? ' is-done' : '');
    cell.dataset.id = it.id;
    cell.innerHTML =
      '<div class="cell-bg del">删除</div>' +
      '<div class="cell-bg done">已完成</div>' +
      '<div class="cell-fg"><div class="cell-title">' + esc(it.title) + '</div>' +
      '<div class="cell-body">' + esc(it.body) + '</div></div>';
    attachSwipe(cell, it, k);
    return cell;
  }

  function attachSwipe(cell, it, k) {
    var fg = cell.querySelector('.cell-fg');
    var sx = 0, sy = 0, dx = 0, dy = 0, drag = false, decided = false, horiz = false;
    cell.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.cell-fg')) return;
      sx = e.clientX; sy = e.clientY; drag = true; decided = false; horiz = false;
      try { cell.setPointerCapture(e.pointerId); } catch (_) {}
      fg.style.transition = 'none';
    });
    cell.addEventListener('pointermove', function (e) {
      if (!drag) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (!decided) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { decided = true; horiz = Math.abs(dx) > Math.abs(dy); } }
      if (decided && horiz) {
        fg.style.transform = 'translateX(' + dx + 'px)';
        if (dx < 0) { cell.classList.add('show-del'); cell.classList.remove('show-done'); }
        else { cell.classList.add('show-done'); cell.classList.remove('show-del'); }
      }
    });
    cell.addEventListener('pointerup', function (e) {
      if (!drag) return; drag = false; fg.style.transition = 'transform .2s';
      if (decided && horiz) {
        if (dx < -80) markDelete(cell, k);
        else if (dx > 80) markDone(cell, k);
        else fg.style.transform = '';
      } else { openFull(it); }
      cell.classList.remove('show-del', 'show-done');
    });
    cell.addEventListener('pointercancel', function () { drag = false; fg.style.transform = ''; cell.classList.remove('show-del', 'show-done'); });
  }

  function markDelete(cell, k) {
    state.del[k] = true; saveState(state);
    cell.style.transition = 'opacity .25s,transform .25s'; cell.style.opacity = '0'; cell.style.transform = 'translateX(-40px)';
    setTimeout(function () { if (cell.parentNode) cell.parentNode.removeChild(cell); }, 260);
    toast('已删除（仅本机）');
  }
  function markDone(cell, k) {
    var now = !state.done[k]; state.done[k] = now; saveState(state);
    cell.classList.toggle('is-done', now);
    var fg = cell.querySelector('.cell-fg'); if (fg) fg.style.transform = '';
    toast(now ? '已标记已完成' : '已恢复');
  }

  function openFull(it) {
    var m = document.getElementById('modal');
    document.getElementById('mTitle').textContent = it.title;
    document.getElementById('mBody').textContent = it.body;
    document.getElementById('mCopy').onclick = function () { copyText(it.title + '\n' + it.body); };
    document.getElementById('mBack').onclick = function () { m.classList.remove('show'); };
    m.classList.add('show'); window.scrollTo(0, 0);
  }

  // 右侧红条拖动滚动
  function setupRedbar(grid) {
    if (!redbar) { redbar = document.createElement('div'); redbar.className = 'redbar'; redbar.id = 'redbar'; document.body.appendChild(redbar); }
    redbar.style.display = 'block';
    var dragging = false, sy = 0, ss = 0;
    redbar.addEventListener('pointerdown', function (e) { dragging = true; sy = e.clientY; ss = grid.scrollTop; try { redbar.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    redbar.addEventListener('pointermove', function (e) { if (!dragging) return; var max = grid.scrollHeight - grid.clientHeight; if (max <= 0) return; var ratio = (e.clientY - sy) / 220; grid.scrollTop = ss + ratio * max; });
    redbar.addEventListener('pointerup', function () { dragging = false; });
    redbar.addEventListener('pointercancel', function () { dragging = false; });
  }
  function hideRedbar() { if (redbar) redbar.style.display = 'none'; }

  // 底部按钮上拖
  function setupAddBtn() {
    if (!addbtn) { addbtn = document.createElement('button'); addbtn.className = 'addbtn'; addbtn.id = 'addbtn'; addbtn.textContent = '＋'; document.body.appendChild(addbtn); }
    addbtn.style.display = 'flex';
    var dragging = false, sy = 0;
    addbtn.addEventListener('pointerdown', function (e) { dragging = true; sy = e.clientY; addbtn.style.transition = 'none'; try { addbtn.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    addbtn.addEventListener('pointermove', function (e) { if (!dragging) return; var dy = Math.max(-130, Math.min(0, e.clientY - sy)); addbtn.style.transform = 'translateY(' + dy + 'px)'; });
    addbtn.addEventListener('pointerup', function (e) { dragging = false; addbtn.style.transition = 'transform .2s'; var dy = e.clientY - sy; addbtn.style.transform = ''; if (dy < -60) toast('上拖：后续可在此手动添加 / 编辑内容'); });
    addbtn.addEventListener('pointercancel', function () { dragging = false; addbtn.style.transform = ''; });
  }
  function hideAddBtn() { if (addbtn) addbtn.style.display = 'none'; }

  // ---------- 日期选择（挂钟进入） ----------
  function openDatePicker() {
    hideRedbar(); hideAddBtn();
    scene.innerHTML = '';
    var d = document.createElement('div'); d.className = 'cv';
    d.innerHTML = '<div class="cv-top"><span class="back" id="bk">← 返回</span><span class="cv-title">选择日期</span><span></span></div><div class="datelist" id="dl"></div>';
    scene.appendChild(d);
    var dl = d.querySelector('#dl');
    var catId = currentCat ? currentCat.id : null;
    if (catId) {
      fetchDates(catId).then(function (arr) {
        if (!arr.length) { dl.innerHTML = '<div class="datechip">暂无历史，部署后每日自动生成</div>'; return; }
        arr.forEach(function (dt) {
          var c = document.createElement('div');
          c.className = 'datechip' + (dt === currentDate ? ' active' : '');
          c.textContent = dt + (dt === todayStr() ? '（今天）' : '');
          c.addEventListener('click', function () { currentDate = dt; if (!currentCat) currentCat = (cfg.categories || [])[0]; renderContent(); });
          dl.appendChild(c);
        });
      });
    } else {
      dl.innerHTML = '<div class="datechip">请先从首页选择一个工位</div>';
    }
    d.querySelector('#bk').addEventListener('click', function () { currentCat ? renderContent() : renderHome(); });
    window.scrollTo(0, 0);
  }

  // ---------- 启动 ----------
  fetch('./config.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cfg = c;
      var t = document.getElementById('appTitle'); if (t && c.app_title) t.textContent = c.app_title;
      // 把挂钟的点击事件绑定到首页渲染（renderHome 内已处理）
      renderHome();
      window.addEventListener('hashchange', function () { renderHome(); });
    })
    .catch(function (e) {
      scene.innerHTML = '<div class="content-card">配置加载失败：' + esc(e.message) + '</div>';
    });
})();
