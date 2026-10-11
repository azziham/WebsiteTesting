/* Dapur Ziham admin: add, edit, and publish menu items without a server. */
(function () {
  'use strict';
  const { DRAFT_KEY, DEFAULT_MENU, normalize, fetchPublished, slugify, rupiah, esc, waNumber, safeGet, safeSet } = window.DZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const GH_KEY = 'dz-gh';
  const GH_DEFAULTS = { owner: 'azziham', repo: 'WebsiteTesting', branch: 'main', folder: 'dapur-ziham', token: '' };
  const NEW = '__new__';

  let menu = null;          // the working draft
  let published = null;     // what the live site currently serves (null if unknown)
  let editingId = null;     // item id, NEW, or null
  let photo = '';           // image for the item in the editor (path or data URL)

  const clone = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isPhoto = src => !!src && !/\.svg(\?|$)/i.test(src) && !/^data:image\/svg/i.test(src);

  /* ---------------- toast + status ---------------- */
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function updateStatus() {
    const el = $('#status'), txt = el.querySelector('span');
    el.classList.remove('dirty', 'clean');
    if (!published) { txt.textContent = 'Draf tersimpan di perangkat ini'; el.classList.add('dirty'); return; }
    if (same(menu, published)) { txt.textContent = 'Semua perubahan sudah terbit'; el.classList.add('clean'); }
    else { txt.textContent = 'Ada perubahan yang belum terbit'; el.classList.add('dirty'); }
  }
  function persist() {
    if (!safeSet(DRAFT_KEY, JSON.stringify(menu))) toast('Penyimpanan perangkat penuh. Terbitkan sekarang supaya perubahan aman.');
    updateStatus();
  }

  /* ---------------- tabs ---------------- */
  const tabs = $$('[role="tab"]');
  function selectTab(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus();
    });
  });

  /* ---------------- item list ---------------- */
  const ICON = {
    up: '<svg viewBox="0 0 20 20"><path d="M10 15V5M5 9l5-5 5 5"/></svg>',
    down: '<svg viewBox="0 0 20 20"><path d="M10 5v10M5 11l5 5 5-5"/></svg>',
    edit: '<svg viewBox="0 0 20 20"><path d="M4 16l1-4 8-8 3 3-8 8z"/></svg>',
    del: '<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>'
  };
  function thumbHTML(item) {
    return item.image ? `<img class="${isPhoto(item.image) ? 'photo' : ''}" src="${esc(item.image)}" alt="">` : `<span>${esc(item.name.charAt(0))}</span>`;
  }
  function renderList() {
    const list = $('#items');
    $('#countLine').textContent = `${menu.items.length} menu, ${menu.items.filter(i => i.available).length} tersedia`;
    $('#emptyList').hidden = menu.items.length > 0;
    list.innerHTML = menu.items.map((item, i) => `<li class="item${item.available ? '' : ' off'}${item.id === editingId ? ' editing' : ''}" data-id="${esc(item.id)}">
      <div class="thumb">${thumbHTML(item)}</div>
      <div class="meta">
        <h3>${esc(item.name)}</h3>
        <p><span class="price">${rupiah(item.price)}</span><span>${esc(item.category)}</span>${item.badge ? `<span class="tag badge">${esc(item.badge)}</span>` : ''}${item.available ? '' : '<span class="tag soldout">Habis</span>'}</p>
      </div>
      <div class="acts">
        <label class="mini-switch" title="Tersedia hari ini"><input type="checkbox" data-act="toggle" ${item.available ? 'checked' : ''} aria-label="${esc(item.name)} tersedia"><i></i><span>Tersedia</span></label>
        <button class="icon-btn" type="button" data-act="up" aria-label="Naikkan ${esc(item.name)}" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
        <button class="icon-btn" type="button" data-act="down" aria-label="Turunkan ${esc(item.name)}" ${i === menu.items.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        <button class="icon-btn" type="button" data-act="edit" aria-label="Ubah ${esc(item.name)}">${ICON.edit}</button>
        <button class="icon-btn danger" type="button" data-act="del" aria-label="Hapus ${esc(item.name)}">${ICON.del}</button>
      </div>
    </li>`).join('');
  }
  $('#items').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.dataset.act === 'toggle') return;
    const id = b.closest('.item').dataset.id;
    const i = menu.items.findIndex(x => x.id === id); if (i < 0) return;
    const act = b.dataset.act;
    if (act === 'edit') return openEditor(id);
    if (act === 'del') {
      if (!confirm(`Hapus "${menu.items[i].name}" dari menu?`)) return;
      menu.items.splice(i, 1);
      if (editingId === id) closeEditor();
      toast('Menu dihapus. Tekan Terbitkan supaya situs ikut berubah.');
    }
    if (act === 'up' && i > 0) [menu.items[i - 1], menu.items[i]] = [menu.items[i], menu.items[i - 1]];
    if (act === 'down' && i < menu.items.length - 1) [menu.items[i + 1], menu.items[i]] = [menu.items[i], menu.items[i + 1]];
    persist(); renderList(); renderCats();
    const again = $(`.item[data-id="${CSS.escape(id)}"] [data-act="${act}"]`);
    if (again && !again.disabled) again.focus();
  });
  $('#items').addEventListener('change', e => {
    if (e.target.dataset.act !== 'toggle') return;
    const item = menu.items.find(x => x.id === e.target.closest('.item').dataset.id);
    item.available = e.target.checked;
    persist(); renderList();
    toast(item.available ? `${item.name} tersedia lagi.` : `${item.name} ditandai habis.`);
  });

  /* ---------------- editor ---------------- */
  const form = $('#editor');
  function fillCatSelect(selected) {
    const cats = menu.categories.length ? menu.categories : ['Lainnya'];
    $('#catSelect').innerHTML = cats.map(c => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('') + `<option value="${NEW}">+ Kategori baru…</option>`;
    $('#newCatField').hidden = true;
  }
  function openEditor(id) {
    editingId = id;
    const item = id === NEW
      ? { name: '', category: menu.categories[0] || 'Lainnya', price: '', desc: '', image: '', badge: '', available: true }
      : menu.items.find(x => x.id === id);
    $('#editorTitle').textContent = id === NEW ? 'Menu baru' : 'Ubah menu';
    $('#saveItem').textContent = id === NEW ? 'Tambahkan ke daftar' : 'Simpan perubahan';
    form.name.value = item.name; form.price.value = item.price; form.desc.value = item.desc;
    form.badge.value = ['Favorit', 'Baru', 'Terlaris', 'Promo'].includes(item.badge) ? item.badge : '';
    form.available.checked = item.available; form.newCategory.value = '';
    fillCatSelect(item.category);
    setPhoto(item.image);
    $('#formErr').hidden = true;
    $$('.bad', form).forEach(el => el.classList.remove('bad'));
    form.hidden = false; $('#editorIdle').hidden = true;
    renderList(); updatePreview();
    if (matchMedia('(max-width: 980px)').matches) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.name.focus({ preventScroll: true });
  }
  function closeEditor() {
    editingId = null; form.hidden = true; $('#editorIdle').hidden = false; renderList();
  }
  $('#addBtn').addEventListener('click', () => openEditor(NEW));
  $('#closeEditor').addEventListener('click', closeEditor);
  $('#cancelEdit').addEventListener('click', closeEditor);
  $('#catSelect').addEventListener('change', e => {
    const isNew = e.target.value === NEW;
    $('#newCatField').hidden = !isNew;
    if (isNew) form.newCategory.focus();
    updatePreview();
  });
  form.addEventListener('input', e => { if (e.target.classList.contains('bad') || e.target.closest('.bad')) { (e.target.closest('.prefix') || e.target).classList.remove('bad'); } $('#formErr').hidden = true; $('#descCount').textContent = `${form.desc.value.length}/160`; updatePreview(); });
  form.addEventListener('change', updatePreview);

  function readForm() {
    const cat = $('#catSelect').value === NEW ? form.newCategory.value.trim() : $('#catSelect').value;
    return {
      name: form.name.value.trim(),
      category: cat,
      price: form.price.value === '' ? NaN : Number(form.price.value),
      desc: form.desc.value.trim(),
      image: photo,
      badge: form.badge.value,
      available: form.available.checked
    };
  }
  function updatePreview() {
    const d = readForm();
    $('#descCount').textContent = `${form.desc.value.length}/160`;
    const img = d.image ? `<img class="${isPhoto(d.image) ? 'photo' : ''}" src="${esc(d.image)}" alt="">` : `<span class="letter">${esc((d.name || '?').charAt(0))}</span>`;
    const card = $('#pcard');
    card.className = 'pcard' + (d.available ? '' : ' off');
    card.innerHTML = `<div class="pm">${d.badge ? `<span class="pbadge">${esc(d.badge)}</span>` : ''}${img}</div>
      <div class="pb"><span class="pc">${esc(d.category || 'Kategori')}</span><h3>${esc(d.name || 'Nama menu')}</h3>
      <p>${esc(d.desc || 'Deskripsi singkat muncul di sini.')}</p><span class="pp">${isNaN(d.price) ? 'Rp ...' : rupiah(d.price)}</span></div>`;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = readForm();
    const errs = [];
    $$('.bad', form).forEach(el => el.classList.remove('bad'));
    if (!d.name) { errs.push('Nama menu belum diisi.'); form.name.classList.add('bad'); }
    if (isNaN(d.price) || d.price < 0) { errs.push('Harga belum diisi atau tidak valid.'); form.price.closest('.prefix').classList.add('bad'); }
    if (!d.category) { errs.push('Nama kategori baru belum diisi.'); form.newCategory.classList.add('bad'); }
    const dup = menu.items.find(x => x.name.toLowerCase() === d.name.toLowerCase() && x.id !== editingId);
    if (d.name && dup) { errs.push(`Sudah ada menu bernama "${dup.name}".`); form.name.classList.add('bad'); }
    if (errs.length) { const fe = $('#formErr'); fe.textContent = errs.join(' '); fe.hidden = false; return; }

    d.price = Math.round(d.price);
    if (!menu.categories.includes(d.category)) menu.categories.push(d.category);
    let id = editingId;
    if (editingId === NEW) {
      id = slugify(d.name);
      while (menu.items.some(x => x.id === id)) id = slugify(d.name) + '-' + Math.random().toString(36).slice(2, 6);
      menu.items.push(Object.assign({ id }, d));
      toast(`${d.name} ditambahkan. Tekan Terbitkan supaya muncul di situs.`);
    } else {
      Object.assign(menu.items.find(x => x.id === editingId), d);
      toast('Perubahan disimpan. Tekan Terbitkan supaya situs ikut berubah.');
    }
    persist(); closeEditor(); renderCats();
    const row = $(`.item[data-id="${CSS.escape(id)}"]`);
    if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });

  /* ---------------- photo upload (resized in the browser) ---------------- */
  const drop = $('#drop'), photoInput = $('#photoInput');
  function setPhoto(src) {
    photo = src || '';
    const img = $('#photoPreview');
    img.hidden = !photo; if (photo) img.src = photo; else img.removeAttribute('src');
    img.classList.toggle('svg', !!photo && !isPhoto(photo));
    drop.classList.toggle('has', !!photo);
    $('#dropHint').firstChild.textContent = photo ? 'Ganti foto' : 'Ketuk untuk pilih foto, atau seret foto ke sini.';
    $('#removePhoto').hidden = !photo;
  }
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('File ini bukan foto.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1000, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#FFF8EA'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibuka. Coba simpan ulang sebagai JPG atau PNG.')); };
      img.src = url;
    });
  }
  async function takeFile(file) {
    try { setPhoto(await resizeImage(file)); updatePreview(); }
    catch (err) { toast(err.message); }
  }
  drop.addEventListener('click', () => photoInput.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); } });
  photoInput.addEventListener('change', () => { if (photoInput.files[0]) takeFile(photoInput.files[0]); photoInput.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) takeFile(f); });
  $('#removePhoto').addEventListener('click', () => { setPhoto(''); updatePreview(); });

  /* ---------------- store info + categories ---------------- */
  const store = $('#storeForm');
  function renderStore() {
    ['whatsapp', 'address', 'hours', 'instagram'].forEach(k => { store[k].value = menu.settings[k] || ''; });
    checkWa();
  }
  function checkWa() {
    const n = waNumber(store.whatsapp.value);
    const ok = /^62\d{8,13}$/.test(n);
    const hint = $('#waHint');
    hint.textContent = !store.whatsapp.value ? 'Wajib diisi supaya pesanan bisa masuk.' : ok ? `Pesanan akan dikirim ke +${n}.` : 'Nomor terlihat belum lengkap. Contoh: 081234567890.';
    hint.classList.toggle('bad-txt', !ok);
    return ok;
  }
  store.addEventListener('input', e => {
    menu.settings[e.target.name] = e.target.value.trim();
    if (e.target.name === 'whatsapp') { menu.settings.whatsapp = waNumber(e.target.value); checkWa(); }
    persist();
  });

  function renderCats() {
    const used = c => menu.items.filter(i => i.category === c).length;
    $('#cats').innerHTML = menu.categories.map((c, i) => `<li>${esc(c)} <small>${used(c)}</small>
      <button class="icon-btn" type="button" data-cat="${i}" aria-label="Hapus kategori ${esc(c)}" ${used(c) ? 'disabled title="Masih dipakai menu"' : ''}>×</button></li>`).join('');
  }
  $('#cats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b || b.disabled) return;
    menu.categories.splice(+b.dataset.cat, 1); persist(); renderCats();
  });
  $('#catAdd').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#catNew').value.trim(); if (!v) return;
    if (menu.categories.some(c => c.toLowerCase() === v.toLowerCase())) return toast('Kategori itu sudah ada.');
    menu.categories.push(v); $('#catNew').value = ''; persist(); renderCats();
  });

  /* ---------------- GitHub connection ---------------- */
  const gh = $('#ghForm');
  function ghCfg() {
    let c = {};
    try { c = JSON.parse(safeGet(GH_KEY) || '{}') || {}; } catch (e) {}
    return Object.assign({}, GH_DEFAULTS, c);
  }
  function renderGh() { const c = ghCfg(); ['owner', 'repo', 'branch', 'folder', 'token'].forEach(k => { gh[k].value = c[k] || ''; }); }
  gh.addEventListener('input', () => {
    const c = {};
    ['owner', 'repo', 'branch', 'folder', 'token'].forEach(k => { c[k] = gh[k].value.trim(); });
    c.folder = c.folder.replace(/^\/+|\/+$/g, '');
    safeSet(GH_KEY, JSON.stringify(c));
    $('#ghResult').textContent = '';
  });
  $('#toggleToken').addEventListener('click', e => {
    const show = gh.token.type === 'password';
    gh.token.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Sembunyikan' : 'Lihat';
  });
  $('#forgetGh').addEventListener('click', () => {
    const c = ghCfg(); c.token = ''; safeSet(GH_KEY, JSON.stringify(c)); renderGh(); toast('Kunci dihapus dari perangkat ini.');
  });

  function ghPath(c, rel) { return [c.folder, rel].filter(Boolean).join('/'); }
  async function ghApi(c, path, opts = {}) {
    const res = await fetch('https://api.github.com' + path, Object.assign({}, opts, {
      headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
    }));
    if (res.status === 404 && opts.allow404) return null;
    if (!res.ok) {
      let detail = ''; try { detail = (await res.json()).message || ''; } catch (e) {}
      const msg = res.status === 401 ? 'Kunci GitHub salah atau sudah kedaluwarsa.'
        : res.status === 403 ? 'Kunci GitHub tidak punya izin tulis (Contents: Read and write).'
        : res.status === 404 ? 'Repo, branch, atau folder tidak ditemukan. Cek isian koneksi.'
        : res.status === 409 || res.status === 422 ? 'File sedang berubah di GitHub. Coba terbitkan lagi.'
        : `GitHub menolak permintaan (${res.status}). ${detail}`;
      throw new Error(msg);
    }
    return res.status === 204 ? {} : res.json();
  }
  const enc = p => p.split('/').map(encodeURIComponent).join('/');
  async function putFile(c, path, b64, message) {
    const q = `/repos/${enc(c.owner)}/${enc(c.repo)}/contents/${enc(path)}`;
    const cur = await ghApi(c, `${q}?ref=${encodeURIComponent(c.branch)}`, { allow404: true });
    return ghApi(c, q, { method: 'PUT', body: JSON.stringify({ message, content: b64, branch: c.branch, sha: cur && cur.sha ? cur.sha : undefined }) });
  }
  function utf8b64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function ready(c) { return c.owner && c.repo && c.branch && c.token; }

  $('#testGh').addEventListener('click', async () => {
    const c = ghCfg(), out = $('#ghResult');
    out.className = 'gh-result';
    if (!ready(c)) { out.textContent = 'Lengkapi pemilik repo, nama repo, branch, dan kunci dulu.'; out.classList.add('bad'); return; }
    out.textContent = 'Mengecek…';
    try {
      const repo = await ghApi(c, `/repos/${enc(c.owner)}/${enc(c.repo)}`);
      if (repo.permissions && !repo.permissions.push) throw new Error('Kunci ini hanya bisa membaca. Ubah izin Contents jadi Read and write.');
      const file = await ghApi(c, `/repos/${enc(c.owner)}/${enc(c.repo)}/contents/${enc(ghPath(c, 'data/menu.json'))}?ref=${encodeURIComponent(c.branch)}`, { allow404: true });
      out.textContent = file ? 'Tersambung. Tombol Terbitkan siap dipakai.' : 'Tersambung, tapi file data/menu.json belum ada di folder itu. Terbitkan akan membuatnya.';
      out.classList.add('ok');
    } catch (err) { out.textContent = err.message; out.classList.add('bad'); }
  });

  /* ---------------- publish ---------------- */
  const pubDlg = $('#pubDialog'), pubLog = $('#pubLog');
  function logStep(text) { const li = document.createElement('li'); li.textContent = text; pubLog.appendChild(li); li.scrollIntoView({ block: 'nearest' }); return li; }

  $('#publishBtn').addEventListener('click', async () => {
    if (editingId) { toast('Simpan atau batalkan menu yang sedang diubah dulu.'); return; }
    if (!checkWa()) { selectTab($('#tab-toko')); store.whatsapp.focus(); toast('Isi nomor WhatsApp yang benar dulu.'); return; }
    const c = ghCfg();
    if (!ready(c)) { selectTab($('#tab-terbit')); toast('Sambungkan GitHub dulu supaya bisa terbit.'); return; }

    pubLog.innerHTML = ''; $('#pubTitle').textContent = 'Menerbitkan menu…'; $('#pubClose').disabled = true;
    pubDlg.showModal();
    const work = clone(menu);
    try {
      const uploads = work.items.filter(i => /^data:image\//.test(i.image));
      for (const item of uploads) {
        const li = logStep(`Mengunggah foto ${item.name}…`);
        const rel = `assets/menu/${item.id}-${Date.now().toString(36)}.jpg`;
        await putFile(c, ghPath(c, rel), item.image.split(',')[1], `Foto menu: ${item.name}`);
        item.image = rel;
        // keep the draft in step so a failure later never re-uploads this photo
        const live = menu.items.find(x => x.id === item.id); if (live) live.image = rel;
        persist();
        li.classList.add('ok'); li.textContent = `Foto ${item.name} terunggah`;
      }
      const li = logStep('Menyimpan daftar menu…');
      work.updatedAt = new Date().toISOString();
      await putFile(c, ghPath(c, 'data/menu.json'), utf8b64(JSON.stringify(work, null, 2) + '\n'), `Perbarui menu (${work.items.length} item)`);
      li.classList.add('ok'); li.textContent = 'Daftar menu tersimpan';
      menu = work; published = clone(work); persist(); renderList();
      logStep('Situs akan menampilkan menu baru dalam 1 sampai 2 menit.').classList.add('ok');
      $('#pubTitle').textContent = 'Menu sudah terbit';
    } catch (err) {
      const last = pubLog.lastElementChild; if (last && !last.classList.contains('ok')) last.remove();
      logStep(err.message).classList.add('bad');
      $('#pubTitle').textContent = 'Belum berhasil terbit';
    }
    $('#pubClose').disabled = false; $('#pubClose').focus();
  });
  $('#pubClose').addEventListener('click', () => pubDlg.close());
  pubDlg.addEventListener('cancel', e => { if ($('#pubClose').disabled) e.preventDefault(); });

  /* ---------------- export / import ---------------- */
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(Object.assign(clone(menu), { updatedAt: new Date().toISOString() }), null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'menu.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    if (menu.items.some(i => /^data:/.test(i.image))) toast('Foto baru ikut tersimpan di dalam file. Ukurannya jadi lebih besar, tapi tetap jalan.');
  });
  $('#importInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = normalize(JSON.parse(await f.text()));
      if (!confirm(`Ganti menu sekarang dengan isi file (${data.items.length} menu)?`)) return;
      menu = data; persist(); closeEditor(); renderAll(); toast('Menu dari file dimuat. Tekan Terbitkan kalau sudah benar.');
    } catch (err) { toast('File itu bukan menu.json yang valid.'); }
  });

  /* ---------------- draft banner ---------------- */
  $('#discardDraft').addEventListener('click', () => {
    if (!published) return;
    if (!confirm('Buang semua perubahan yang belum terbit?')) return;
    menu = clone(published); persist(); closeEditor(); renderAll();
    $('#draftBanner').hidden = true; toast('Draf dibuang. Menu kembali ke versi terbit.');
  });

  function renderAll() { renderList(); renderStore(); renderCats(); renderGh(); updateStatus(); }

  /* ---------------- boot ---------------- */
  (async function boot() {
    try { published = await fetchPublished(); } catch (e) { published = null; }
    let draft = null;
    const raw = safeGet(DRAFT_KEY);
    if (raw) { try { draft = normalize(JSON.parse(raw)); } catch (e) {} }
    menu = draft || (published ? clone(published) : normalize(DEFAULT_MENU));
    if (draft && published && !same(draft, published)) $('#draftBanner').hidden = false;
    renderAll();
  })();
})();
