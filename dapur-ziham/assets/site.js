/* Dapur Ziham: site behaviour. Plain JS, no build step. */
(function () {
  'use strict';
  const { loadMenu, rupiah, esc, waNumber, safeGet, safeSet } = window.DZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  let MENU = null;
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  /* ================= split headlines into words ================= */
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  $$('.split').forEach((el, n) => {
    const text = el.textContent.trim();
    const words = text.split(/\s+/);
    const r = rng(17 + n * 31);
    el.textContent = '';
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text; el.appendChild(sr);
    const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    words.forEach((w, i) => {
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
      s.style.setProperty('--th', (i / Math.max(1, words.length) * 0.42 + r() * 0.05).toFixed(3));
      vis.appendChild(s);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.appendChild(vis);
  });

  /* ================= hero: scroll-driven tray ================= */
  const hero = $('.hero');
  const cue = $('.cue');
  const dishes = $$('.dish');
  const bands = $$('.band').map(el => ({ el, a: +el.dataset.a, b: +el.dataset.b, ramp: +el.dataset.ramp || 0, op: -1, k: -1, on: null }));
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true, scrubOn = false;
  let loadK = 0, loadStart = 0, lastRot = -1, cueOn = true;

  function heroProgress() {
    const range = hero.offsetHeight - innerHeight;
    if (range <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
  }

  // Tray rotation holds still while a band is read and turns in the gaps between bands.
  function rotationAt(p) {
    return 120 * smoothstep(p, 0.46, 0.56) + 120 * smoothstep(p, 0.70, 0.80);
  }

  function placeDishes(rot) {
    if (Math.abs(rot - lastRot) < 0.05) return;
    lastRot = rot;
    dishes.forEach((d, i) => {
      const th = (i * 120 - rot) * Math.PI / 180;
      const z = Math.cos(th);
      const depth = (z + 1) / 2;
      const x = Math.sin(th) * 62;
      const y = -(1 - depth) * 30 + 15;
      const s = 0.48 + 0.52 * depth;
      d.style.transform = `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%) scale(${s.toFixed(3)}) rotate(${(Math.sin(th) * -8).toFixed(2)}deg)`;
      d.style.opacity = (0.5 + 0.5 * depth).toFixed(3);
      d.style.zIndex = String(Math.round(depth * 10) + 1);
    });
  }

  function updateCaptions(p) {
    const last = bands.length - 1;
    bands.forEach((band, i) => {
      const { a, b } = band;
      const f = Math.min(0.04, (b - a) / 3);
      const inn = i === 0 ? 1 : smoothstep(p, a, a + f);
      const out = i === last ? 1 : 1 - smoothstep(p, b - f, b);
      const op = Math.round(inn * out * 1000) / 1000;
      let k = clamp((p - a) / (band.ramp || Math.min(0.05, (b - a) * 0.35)), 0, 1);
      if (i === 0) k = loadK;
      if (Math.abs(op - band.op) > 0.004 || (op === 0) !== (band.op === 0) || (op === 1) !== (band.op === 1)) {
        band.op = op; band.el.style.opacity = op;
        const on = op > 0.5;
        if (on !== band.on) { band.on = on; band.el.classList.toggle('on', on); }
      }
      if (Math.abs(k - band.k) > 0.008 || (k === 1 && band.k !== 1) || (k === 0 && band.k !== 0)) {
        band.k = k; band.el.style.setProperty('--k', k.toFixed(3));
      }
    });
    placeDishes(rotationAt(p));
    const wantCue = p < 0.03;
    if (cue && wantCue !== cueOn) { cueOn = wantCue; cue.style.opacity = wantCue ? '1' : '0'; }
  }

  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    if (loadK < 1) {
      if (!loadStart) loadStart = now;
      const t = clamp((now - loadStart) / 1100, 0, 1);
      loadK = 1 - Math.pow(1 - t, 3);
    }
    shown += (target - shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    const settled = Math.abs(target - shown) < 0.0005;
    if (settled) shown = target;
    updateCaptions(shown);
    if (settled && loadK >= 1) { rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
  }

  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }

  new IntersectionObserver(es => {
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen && scrubOn) onScroll();
  }).observe(hero);

  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.on = null; });
    lastRot = -1;
    target = shown = heroProgress();
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn && rafId === null) { clearHeroStyles(); return; }
    scrubOn = false;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
    clearHeroStyles();
  }
  function clearHeroStyles() {
    // Hand the hero back to the static CSS layout.
    bands.forEach(b => { b.el.style.opacity = ''; b.el.style.removeProperty('--k'); b.el.classList.remove('on'); });
    dishes.forEach(d => { d.style.transform = ''; d.style.opacity = ''; d.style.zIndex = ''; });
    if (cue) cue.style.opacity = '';
    loadK = 1;
  }
  function applyHeroMode() {
    if (GATES.some(q => matchMedia(q).matches)) disableScrub();
    else enableScrub();
  }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  applyHeroMode();

  /* ================= reveals ================= */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealIO.unobserve(e.target);
    if (e.target.classList.contains('steps')) setTimeout(() => e.target.classList.add('settled'), 1300);
  }), { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal, .steps').forEach(el => revealIO.observe(el));

  /* ================= steps line draws itself with scroll ================= */
  const steps = $('.steps');
  const stepsPath = $('.steps-line path');
  let stepsVisible = false, stepsRaf = null, lastDraw = -1;
  function drawSteps() {
    stepsRaf = null;
    const r = steps.getBoundingClientRect();
    const d = RM.matches ? 1 : clamp((innerHeight - r.top) / (innerHeight * 0.75), 0, 1);
    if (Math.abs(d - lastDraw) > 0.005) { lastDraw = d; stepsPath.style.setProperty('--draw', d.toFixed(3)); }
  }
  new IntersectionObserver(es => { stepsVisible = es[0].isIntersecting; if (stepsVisible) drawSteps(); }).observe(steps);
  addEventListener('scroll', () => { if (stepsVisible && stepsRaf === null) stepsRaf = requestAnimationFrame(drawSteps); }, { passive: true });

  /* ================= pause loops on hidden tabs ================= */
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ================= menu board ================= */
  const grid = $('#menuGrid');
  const chipsEl = $('#chips');
  const TILES = ['#FBD56B', '#F7B9A5', '#BFE3C0', '#F3D2A2', '#C9DDF2', '#F5C2D6'];
  let activeCat = 'Semua';
  const cardIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); cardIO.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });

  function isPhoto(src) { return !/\.svg(\?|$)/i.test(src) && !/^data:image\/svg/i.test(src); }

  function renderChips() {
    const cats = ['Semua', ...MENU.categories.filter(c => MENU.items.some(i => i.category === c))];
    if (!cats.includes(activeCat)) activeCat = 'Semua';
    chipsEl.innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c === activeCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    chipsEl.hidden = cats.length <= 2;
  }
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    activeCat = b.dataset.cat; renderChips(); renderGrid();
  });

  function footHTML(item) {
    if (!item.available) return `<span class="price">${rupiah(item.price)}</span><button class="btn btn-sm" type="button" disabled>Habis</button>`;
    const q = cart[item.id] || 0;
    if (!q) return `<span class="price">${rupiah(item.price)}</span><button class="btn btn-sm btn-ink" type="button" data-add="${esc(item.id)}">Tambah</button>`;
    return `<span class="price">${rupiah(item.price)}</span>
      <span class="stepper" role="group" aria-label="Jumlah ${esc(item.name)}">
        <button type="button" data-dec="${esc(item.id)}" aria-label="Kurangi">−</button>
        <output aria-live="polite">${q}</output>
        <button type="button" data-inc="${esc(item.id)}" aria-label="Tambah">+</button>
      </span>`;
  }

  function renderGrid() {
    const list = MENU.items.filter(i => activeCat === 'Semua' || i.category === activeCat);
    if (!list.length) { grid.innerHTML = '<p class="grid-empty">Menu sedang disiapkan. Cek lagi nanti, ya.</p>'; return; }
    grid.innerHTML = list.map((item, n) => {
      const idx = MENU.items.indexOf(item);
      const badge = item.badge ? `<span class="badge ${item.badge.toLowerCase() === 'baru' ? 'baru' : ''}">${esc(item.badge)}</span>` : '';
      const img = item.image
        ? `<img class="${isPhoto(item.image) ? 'photo' : ''}" src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">`
        : `<span aria-hidden="true" style="font:800 64px/1 var(--f-display)">${esc(item.name.charAt(0))}</span>`;
      return `<article class="card${item.available ? '' : ' soldout'}" data-id="${esc(item.id)}" style="--tile:${TILES[idx % TILES.length]};--tilt:${n % 2 ? 1 : -1}deg;transition-delay:${(n % 3) * 90}ms">
        <div class="card-media">${badge}${img}</div>
        <div class="card-body">
          <span class="card-cat">${esc(item.category)}</span>
          <h3>${esc(item.name)}</h3>
          <p class="card-desc">${esc(item.desc)}</p>
          <div class="card-foot">${footHTML(item)}</div>
        </div>
      </article>`;
    }).join('');
    $$('.card', grid).forEach(c => {
      cardIO.observe(c);
      // Retire the stagger once the entrance is done so hovers respond at once.
      c.addEventListener('transitionend', () => { c.style.transitionDelay = '0s'; }, { once: true });
    });
  }

  function refreshCard(id) {
    const card = grid.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    const item = MENU.items.find(i => i.id === id);
    if (card && item) card.querySelector('.card-foot').innerHTML = footHTML(item);
  }

  grid.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const id = t.dataset.add || t.dataset.inc || t.dataset.dec; if (!id) return;
    changeQty(id, t.dataset.dec ? -1 : 1);
    const card = grid.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    const focusSel = t.dataset.dec ? `[data-dec]` : `[data-inc]`;
    const next = card && (card.querySelector(focusSel) || card.querySelector('[data-add]'));
    if (next) next.focus();
  });

  function renderMarquee() {
    const words = [...MENU.items.map(i => i.name), 'Dibuat tiap pagi', 'Dari dapur sendiri'];
    let set = '';
    for (let r = 0; r < 4; r++) set += words.map(w => `<span>${esc(w)}</span>`).join('');
    $('#marqueeTrack').innerHTML = set + set;
  }

  function applySettings() {
    const s = MENU.settings;
    $$('[data-set]').forEach(el => { el.textContent = s[el.dataset.set] || ''; });
    const ig = String(s.instagram || '').replace(/^@/, '').trim();
    if (ig) {
      $('#igLink').href = /^https?:/.test(ig) ? ig : 'https://instagram.com/' + encodeURIComponent(ig);
      $('.ig-wrap').hidden = false;
    }
    $$('.wa-direct').forEach(a => { a.href = 'https://wa.me/' + waNumber(s.whatsapp); });
  }

  /* ================= cart ================= */
  const CART_KEY = 'dz-cart';
  let cart = {};
  try { cart = JSON.parse(safeGet(CART_KEY) || '{}') || {}; } catch (e) { cart = {}; }
  const pill = $('#cartPill'), dlg = $('#cart'), form = $('#cartForm');

  function cartLines() {
    return Object.entries(cart).map(([id, q]) => ({ item: MENU.items.find(i => i.id === id), q }))
      .filter(l => l.item && l.item.available && l.q > 0);
  }
  function cartTotals() {
    const lines = cartLines();
    return { lines, count: lines.reduce((s, l) => s + l.q, 0), total: lines.reduce((s, l) => s + l.q * l.item.price, 0) };
  }
  function saveCart() { safeSet(CART_KEY, JSON.stringify(cart)); }

  function changeQty(id, delta) {
    const q = clamp((cart[id] || 0) + delta, 0, 99);
    if (q) cart[id] = q; else delete cart[id];
    saveCart(); refreshCard(id); renderCart();
    if (delta > 0) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
  }

  function renderCart() {
    const { lines, count, total } = cartTotals();
    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = rupiah(total);
    $('#cartSum').textContent = rupiah(total);
    pill.hidden = count === 0 || dlg.open;
    $('#cartEmpty').hidden = count > 0;
    $('#sendWa').disabled = count === 0;
    $('#cartList').innerHTML = lines.map(({ item, q }) => `<li>
      ${item.image ? `<img src="${esc(item.image)}" alt="">` : '<span></span>'}
      <div><div class="ci-name">${esc(item.name)}</div><div class="ci-price">${q} × ${rupiah(item.price)}</div></div>
      <span class="stepper" role="group" aria-label="Jumlah ${esc(item.name)}">
        <button type="button" data-dec="${esc(item.id)}" aria-label="Kurangi">−</button><output>${q}</output><button type="button" data-inc="${esc(item.id)}" aria-label="Tambah">+</button>
      </span></li>`).join('');
  }
  $('#cartList').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const id = t.dataset.inc || t.dataset.dec; if (!id) return;
    changeQty(id, t.dataset.dec ? -1 : 1);
  });

  function openCart() {
    if (!cartTotals().count) { $('#menu').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' }); return; }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    renderCart();
  }
  pill.addEventListener('click', openCart);
  $$('[data-open-cart], .wa-link').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openCart(); }));
  dlg.addEventListener('close', renderCart);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  form.addEventListener('input', e => e.target.classList.remove('field-err'));
  form.addEventListener('change', () => {
    const antar = form.cara.value === 'Minta diantar';
    $('.addr-field').hidden = !antar;
  });

  $('#sendWa').addEventListener('click', () => {
    const { lines, total } = cartTotals();
    if (!lines.length) return;
    const nama = form.nama.value.trim();
    const antar = form.cara.value === 'Minta diantar';
    const alamat = form.alamat.value.trim();
    form.nama.classList.toggle('field-err', !nama);
    form.alamat.classList.toggle('field-err', antar && !alamat);
    if (!nama) { form.nama.focus(); return; }
    if (antar && !alamat) { form.alamat.focus(); return; }
    const s = MENU.settings;
    const num = waNumber(s.whatsapp);
    const msg = [
      `Halo ${s.brand || 'Dapur Ziham'}, saya mau pesan:`, '',
      ...lines.map(l => `- ${l.q}x ${l.item.name} (${rupiah(l.q * l.item.price)})`), '',
      `Total: ${rupiah(total)}`,
      `Nama: ${nama}`,
      `Cara terima: ${form.cara.value}`,
      ...(antar ? [`Alamat: ${alamat}`] : []),
      ...(form.catatan.value.trim() ? [`Catatan: ${form.catatan.value.trim()}`] : []),
      '', 'Terima kasih!'
    ].join('\n');
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  /* ================= the sip moment ================= */
  const sipSec = $('#sedot'), holdBtn = $('#holdBtn'), sipAdd = $('#sipAdd');
  const strawFill = $('.straw-fill');
  let sip = 0, holding = false, sipRaf = null, sipLast = 0, sipDone = false, draw = 0;
  function writeSip() {
    sipSec.style.setProperty('--sip', sip.toFixed(3));
    strawFill.style.setProperty('--draw', draw.toFixed(3));
  }
  function sipTick(now) {
    const dt = Math.min(100, now - (sipLast || now)); sipLast = now;
    if (holding) { draw = Math.min(1, draw + dt / 260); if (draw >= 1) sip = Math.min(1, sip + dt / 2300); }
    else { draw = Math.max(0, draw - dt / 300); sip = Math.max(0, sip - dt / 1600 * (0.35 + sip)); }
    writeSip();
    if (sip >= 1) return finishSip();
    if (holding || sip > 0 || draw > 0) sipRaf = requestAnimationFrame(sipTick);
    else { sipRaf = null; sipLast = 0; }
  }
  function startHold(e) {
    if (sipDone) return;
    if (e) e.preventDefault();
    if (RM.matches) { sip = 1; draw = 0; writeSip(); return finishSip(); }
    holding = true;
    if (sipRaf === null) sipRaf = requestAnimationFrame(sipTick);
  }
  function endHold() { holding = false; }
  function finishSip() {
    sipDone = true; holding = false; draw = 0; sip = 1; writeSip();
    if (sipRaf !== null) { cancelAnimationFrame(sipRaf); sipRaf = null; }
    sipSec.classList.add('done');
    setTimeout(() => sipAdd.focus({ preventScroll: true }), 50);
  }
  holdBtn.addEventListener('pointerdown', e => { holdBtn.setPointerCapture && holdBtn.setPointerCapture(e.pointerId); startHold(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => holdBtn.addEventListener(t, endHold));
  holdBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());
  sipAdd.addEventListener('click', () => {
    const pudot = MENU.items.find(i => i.available && /pudot|sedot/i.test(i.id + ' ' + i.name)) || MENU.items.find(i => i.available);
    if (!pudot) return;
    changeQty(pudot.id, 1);
    sipAdd.textContent = 'Sudah masuk pesanan';
    sipAdd.disabled = true;
  });

  /* ================= reduced motion flips live ================= */
  function pinToFinalStates() {
    lastDraw = -1; drawSteps();
    if (holding) { sip = 1; finishSip(); }
  }
  RM.addEventListener('change', e => {
    if (e.matches) pinToFinalStates();
    else { lastDraw = -1; drawSteps(); applyHeroMode(); }
  });

  /* ================= boot ================= */
  loadMenu().then(({ menu, source }) => {
    MENU = menu;
    if (source === 'draft') $('#previewFlag').hidden = false;
    if (source === 'fallback' && location.protocol === 'file:') {
      const note = $('#menuNote'); note.hidden = false;
      note.textContent = 'Catatan: halaman dibuka langsung dari file, jadi menu memakai data bawaan.';
    }
    renderChips(); renderGrid(); renderMarquee(); applySettings(); renderCart();
  });
})();
