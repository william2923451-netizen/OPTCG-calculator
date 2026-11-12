// 從 optcg.one /decklists 頁面內嵌的 JSON 算出計算器要用的資料（環境牌組、卡片、少見卡）
// 瀏覽器和 Node 都能用：buildData(raw) → data.json 的內容
(function (root) {
  // 計算器有寫效果的卡（少見卡清單要列出它們）
  const FX_IDS = new Set('OP06-115 EB04-058 EB05-055 OP08-109 OP14-112 OP15-113 OP16-119 OP16-108 OP14-104 OP17-061 OP17-103 OP17-104 OP17-106 OP17-112 OP17-114 OP17-040 OP17-049 OP17-048 EB05-046 OP16-015 OP16-003 ST30-012 OP17-022 OP17-044 ST25-002 PRB02-001'.split(' '));
  const base = id => String(id).split('_')[0];
  const num = v => (v == null || v === '' || isNaN(+v)) ? 0 : +v;

  function cardInfo(rows) {
    const info = {};
    for (const x of rows) {
      const id = base(x[0]); if (info[id]) continue;
      const eff = (x[11] || '').replace(/<br>/g, ' ');
      info[id] = { id, type: String(x[3] || '').toUpperCase(), name: String(x[4] || '').slice(0, 28), cost: num(x[5]),
        power: num(x[7]), counter: num(x[8]), color: x[9] || '', eff, trig: x[14] || '', life: num(x[13]) };
    }
    return info;
  }
  function counterOf(c) {   // 反擊事件：+力量、要丟幾張
    if (!/EVENT/.test(c.type)) return null;
    const m = c.eff.match(/\[Counter\]([\s\S]*?)(?=\[(?:Main|Trigger)\]|$)/); if (!m) return null;
    const v = m[1].match(/[+−-]\s?(\d{3,5})\s*power/); if (!v) return null;
    const d = m[1].match(/trash (\d+) cards? from your hand/i);
    return { val: +v[1], disc: d ? +d[1] : 0 };
  }
  const flags = c => (/\[Blocker\]/.test(c.eff) ? 'b' : '') + (/\[Double Attack\]/.test(c.eff) ? 'd' : '') + (/\[Rush\]/.test(c.eff) ? 'r' : '') + (/\[Unblockable\]/.test(c.eff) ? 'u' : '');

  function buildData(raw, opts) {
    opts = opts || {};
    const info = cardInfo(raw.cards.data);
    const fmts = Object.keys(raw.decklists || {}).sort();
    const fmt = opts.fmt || fmts[fmts.length - 1];
    const decks = (raw.decklists[fmt] || []).filter(d => d.leader_id && d['Deck Composition']);
    const by = {};
    for (const d of decks) (by[d.leader_id] = by[d.leader_id] || []).push(d['Deck Composition']);
    const leaders = [], rare = {}, used = new Set();
    for (const lid in by) {
      const list = by[lid], cnt = {};
      for (const comp of list) {
        const seen = {};
        for (const m of comp.matchAll(/(\d+)\s*x\s*([A-Z0-9]+-\d+)/gi)) { const id = base(m[2].toUpperCase()); if (id === lid) continue; seen[id] = (seen[id] || 0) + (+m[1]); }
        for (const id in seen) { cnt[id] = cnt[id] || { n: 0, c: 0 }; cnt[id].n++; cnt[id].c += seen[id]; }
      }
      const N = list.length;
      const freq = Object.entries(cnt).map(([id, v]) => ({ id, pct: Math.round(v.n / N * 100), avg: v.c / v.n })).sort((a, b) => b.pct - a.pct || b.avg - a.avg);
      freq.forEach(f => used.add(f.id));
      const L = info[lid] || { name: lid, power: 5000, life: 4, color: '' };
      // 少見卡：不到 4 成有放、跟計算有關
      const rr = freq.filter(f => f.pct < 40).filter(f => { const c = info[f.id]; return FX_IDS.has(f.id) || (c && (counterOf(c) || (/CHARACTER/.test(c.type) && /\[Rush\]/.test(c.eff)))); });
      if (rr.length) rare[lid] = rr.map(f => f.id + ':' + f.pct).join(',');
      if (N < (opts.minDecks || 3)) continue;
      // 共識牌組：4 成以上的牌組有放，張數取平均
      // 依比例由高到低放進去，總張數不超過 50
      const core = []; let room = 50;
      for (const f of freq) { if (f.pct < 40 || room <= 0) continue; const n = Math.min(Math.max(1, Math.round(f.avg)), room); core.push({ ...f, n }); room -= n; }
      let c2 = 0, c1 = 0, total = 0; const evs = [], rush = [];
      for (const f of core) {
        const c = info[f.id]; total += f.n; if (!c) continue;
        if (/CHARACTER/.test(c.type)) {
          if (c.counter === 2000) c2 += f.n; else if (c.counter === 1000) c1 += f.n;
          if (/\[Rush\]/.test(c.eff)) rush.push({ name: c.name, n: f.n, p: c.power, cost: c.cost, da: /\[Double Attack\]/.test(c.eff), ub: /\[Unblockable\]/.test(c.eff) });
        }
        const ce = counterOf(c); if (ce) evs.push({ name: c.name, n: f.n, val: ce.val, cost: c.cost, disc: ce.disc });
      }
      evs.sort((a, b) => b.val - a.val || a.cost - b.cost);
      leaders.push({ id: lid, name: L.name, color: L.color, power: L.power || 5000, life: L.life || 4, decks: N, total, c2, c1, evs, rush,
        list: core.slice().sort((a, b) => b.n - a.n).map(f => f.n + 'x' + f.id).join(' ') });
    }
    leaders.sort((a, b) => b.decks - a.decks);
    // 卡片資料：牌組裡出現過的角色、反擊事件、領導者
    const ch = {}, ev = {}, ld = {};
    for (const id in info) {
      const c = info[id];
      if (/LEADER/.test(c.type)) { ld[id] = [c.name, c.power / 1000, c.life || 4]; continue; }
      if (!used.has(id)) continue;
      if (/CHARACTER/.test(c.type)) ch[id] = [c.name, c.power / 1000, c.cost, c.counter / 1000, flags(c)];
      else { const ce = counterOf(c); if (ce) ev[id] = [c.name, c.cost, ce.val / 1000, ce.disc]; }
    }
    return { v: 1, date: opts.date || new Date().toISOString().slice(0, 10), fmt, n: decks.length, leaders, ch, ev, ld, rare };
  }
  function extractRaw(html) {   // 從 /decklists 的 HTML 抽出內嵌 JSON
    const m = html.match(/<script type="application\/json" id="decklists-initial-data">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('找不到 decklists-initial-data');
    return JSON.parse(m[1]);
  }
  const api = { buildData, extractRaw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OPTCGData = api;
})(typeof self !== 'undefined' ? self : this);
