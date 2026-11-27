// GitHub Actions 每天跑：抓 optcg.one 的比賽牌組，算出 data.json
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildData, extractRaw } = require('./optcg-data.js');

const res = await fetch('https://www.optcg.one/decklists', { headers: { 'User-Agent': 'OPTCG-calculator data updater (github.com/william2923451-netizen/OPTCG-calculator)' } });
if (!res.ok) throw new Error('optcg.one 回應 ' + res.status);
const data = buildData(extractRaw(await res.text()));
if (!data.leaders.length) throw new Error('沒有算出任何環境牌組，不更新');

// 日文卡名（卡片語言切成日文時用）：data.json 用到、jp-names.json 還沒有的卡號，才去官方日文卡表抓
await updateJpNames(data);

const out = 'data.json';
let old = null; try { old = JSON.parse(fs.readFileSync(out, 'utf8')); } catch {}
const strip = o => JSON.stringify({ ...o, date: null });
if (old && strip(old) === strip(data)) { console.log('資料沒有變，不更新'); process.exit(0); }
fs.writeFileSync(out, JSON.stringify(data));
console.log(`已更新：${data.fmt}、${data.n} 副牌組、${data.leaders.length} 個領導者`);

async function updateJpNames(data) {
  const file = 'jp-names.json';
  let jp = {}; try { jp = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const need = new Set([...Object.keys(data.ch || {}), ...Object.keys(data.ev || {}), ...Object.keys(data.ld || {})]);
  (data.leaders || []).forEach(L => { need.add(L.id); (L.evs || []).forEach(v => v.id && need.add(v.id)); (L.all || '').split(',').forEach(x => x && need.add(x.split(':')[0])); });
  const miss = [...need].filter(id => !jp[id]);
  if (!miss.length) { console.log('日文卡名：沒有缺'); return; }
  const base = 'https://www.onepiece-cardgame.com/cardlist/';
  const ua = { headers: { 'User-Agent': 'OPTCG-calculator data updater (github.com/william2923451-netizen/OPTCG-calculator)' } };
  const dec = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();
  try {
    const top = await (await fetch(base, ua)).text();
    const sel = (top.match(/<select[^>]*name="series"[\s\S]*?<\/select>/) || [''])[0];
    const series = [...sel.matchAll(/value="(\d+)"/g)].map(m => m[1]);
    let added = 0;
    for (const v of series) {
      const html = await (await fetch(base + '?series=' + v, ua)).text();
      for (const m of html.matchAll(/<dl class="modalCol" id="([^"]+)">[\s\S]*?<div class="cardName">([^<]*)<\/div>/g)) {
        if (/_/.test(m[1]) || jp[m[1]]) continue;
        jp[m[1]] = dec(m[2]); added++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    const keep = {}; Object.keys(jp).sort().forEach(k => { if (need.has(k) || k in jp) keep[k] = jp[k]; });
    if (added) { fs.writeFileSync(file, JSON.stringify(keep)); console.log(`日文卡名：新增 ${added} 張`); }
    console.log('日文卡名仍缺：' + miss.filter(id => !jp[id]).join(' '));
  } catch (e) { console.log('日文卡名抓取失敗（不影響其他資料）：' + e.message); }
}
