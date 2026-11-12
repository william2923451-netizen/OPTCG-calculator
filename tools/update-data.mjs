// GitHub Actions 每天跑：抓 optcg.one 的比賽牌組，算出 data.json
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildData, extractRaw } = require('./optcg-data.js');

const res = await fetch('https://www.optcg.one/decklists', { headers: { 'User-Agent': 'OPTCG-calculator data updater (github.com/william2923451-netizen/OPTCG-calculator)' } });
if (!res.ok) throw new Error('optcg.one 回應 ' + res.status);
const data = buildData(extractRaw(await res.text()));
if (!data.leaders.length) throw new Error('沒有算出任何環境牌組，不更新');

const out = 'data.json';
let old = null; try { old = JSON.parse(fs.readFileSync(out, 'utf8')); } catch {}
const strip = o => JSON.stringify({ ...o, date: null });
if (old && strip(old) === strip(data)) { console.log('資料沒有變，不更新'); process.exit(0); }
fs.writeFileSync(out, JSON.stringify(data));
console.log(`已更新：${data.fmt}、${data.n} 副牌組、${data.leaders.length} 個領導者`);
