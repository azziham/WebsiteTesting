/* Dapur Ziham: shared menu data helpers (site + admin). */
(function (global) {
  'use strict';

  // Fallback copy of data/menu.json, used when the file cannot be fetched
  // (for example when index.html is opened by double-click).
  const DEFAULT_MENU = {
    version: 1,
    updatedAt: '2026-10-11T00:00:00.000Z',
    settings: {
      brand: 'Dapur Ziham',
      whatsapp: '6281234567890',
      address: 'Atur alamat gerobak di halaman admin',
      hours: 'Setiap hari, 15.00 sampai habis',
      instagram: ''
    },
    categories: ['Gurih', 'Manis', 'Minuman'],
    items: [
      { id: 'pastel-bolognese', name: 'Pastel Bolognese', category: 'Gurih', price: 5000,
        desc: 'Kulit renyah berpilin, isinya saus bolognese daging yang tebal dan gurih.',
        image: 'assets/menu/pastel-bolognese.svg', badge: 'Favorit', available: true },
      { id: 'tiramisu', name: 'Tiramisu Cup', category: 'Manis', price: 15000,
        desc: 'Lapisan krim lembut dan bolu kopi, ditutup taburan cokelat. Paling enak dingin.',
        image: 'assets/menu/tiramisu.svg', badge: '', available: true },
      { id: 'pudot', name: 'Pudot (Puding Sedot)', category: 'Minuman', price: 8000,
        desc: 'Potongan puding cokelat dalam susu dingin. Disedot pakai sedotan besar, kenyal di setiap sedotan.',
        image: 'assets/menu/pudot.svg', badge: 'Baru', available: true }
    ]
  };

  const DRAFT_KEY = 'dz-admin-draft';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function normalize(data) {
    const d = data && typeof data === 'object' ? data : {};
    const settings = Object.assign({}, DEFAULT_MENU.settings, d.settings || {});
    const items = Array.isArray(d.items) ? d.items.filter(i => i && i.name).map(i => ({
      id: String(i.id || slugify(i.name)),
      name: String(i.name),
      category: String(i.category || 'Lainnya'),
      price: Math.max(0, Math.round(Number(i.price) || 0)),
      desc: String(i.desc || ''),
      image: String(i.image || ''),
      badge: String(i.badge || ''),
      available: i.available !== false
    })) : [];
    const cats = Array.isArray(d.categories) ? d.categories.map(String) : [];
    items.forEach(i => { if (!cats.includes(i.category)) cats.push(i.category); });
    return { version: 1, updatedAt: d.updatedAt || new Date().toISOString(), settings, categories: cats, items };
  }

  async function fetchPublished() {
    const res = await fetch('data/menu.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return normalize(await res.json());
  }

  // The live site reads the published file. ?preview=1 shows the admin's unpublished draft.
  async function loadMenu() {
    if (/[?&]preview=1/.test(location.search)) {
      const raw = safeGet(DRAFT_KEY);
      if (raw) { try { return { menu: normalize(JSON.parse(raw)), source: 'draft' }; } catch (e) {} }
    }
    try { return { menu: await fetchPublished(), source: 'published' }; }
    catch (e) { return { menu: normalize(DEFAULT_MENU), source: 'fallback' }; }
  }

  function slugify(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'menu';
  }

  function rupiah(n) {
    return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function waNumber(raw) {
    let n = String(raw || '').replace(/\D/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return n;
  }

  global.DZ = { DEFAULT_MENU, DRAFT_KEY, normalize, fetchPublished, loadMenu, slugify, rupiah, esc, waNumber, safeGet, safeSet };
})(window);
