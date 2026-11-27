#!/usr/bin/env python3
"""把 tools/i18n.tsv（中→英／日）、tools/jp-names.tsv（卡號→日文卡名）和 tools/i18n.js 嵌進 index.html。

用法：python3 tools/build-i18n.py
改了 index.html 的中文字串後再跑一次，會列出還沒翻譯的片段。"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / 'index.html'
RUN = r'[　-〿぀-ヿ一-鿿！-｠]+'


def load_dict():
    d = {}
    for line in (ROOT / 'tools/i18n.tsv').read_text(encoding='utf-8').split('\n'):
        if not line:
            continue
        p = line.split('\t')
        if len(p) != 3:
            sys.exit(f'i18n.tsv 欄位數不對：{line!r}')
        d[p[0]] = [p[1], p[2]]
    return d


def load_jp():
    out = []
    for line in (ROOT / 'tools/jp-names.tsv').read_text(encoding='utf-8').split('\n'):
        if '\t' in line:
            i, n = line.split('\t', 1)
            out.append(f'{i}|{n.replace(";", "；")}')
    return ';'.join(out)


def main():
    d = load_dict()
    js = (ROOT / 'tools/i18n.js').read_text(encoding='utf-8')
    js = re.sub(r'/\*DICT\*/.*?/\*END\*/', lambda m: json.dumps(d, ensure_ascii=False, separators=(',', ':')), js, count=1, flags=re.S)
    js = re.sub(r"/\*JPN\*/.*?/\*END\*/", lambda m: json.dumps(load_jp(), ensure_ascii=False), js, count=1, flags=re.S)
    html = HTML.read_text(encoding='utf-8')
    block = f'<script id="i18n">\n{js}</script>\n'
    if '<script id="i18n">' in html:
        html = re.sub(r'<script id="i18n">.*?</script>\n', lambda m: block, html, count=1, flags=re.S)
    else:
        sys.exit('index.html 裡找不到 <script id="i18n">')
    HTML.write_text(html, encoding='utf-8')

    # 檢查還沒翻譯的片段（略過註解和 i18n 區塊本身）
    src = re.sub(r'<script id="i18n">.*?</script>', '', html, flags=re.S)
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'(^|[\s;{}])//[^\n]*', r'\1', src)
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)
    keys = sorted(d, key=len, reverse=True)
    missing = set()
    for run in set(re.findall(RUN, src)):
        if run in d:
            continue
        i = 0
        while i < len(run):
            k = next((k for k in keys if run.startswith(k, i)), None)
            if k:
                i += len(k)
            else:
                missing.add(run)
                break
    print(f'字典 {len(d)} 條，未翻譯片段 {len(missing)} 個')
    for m in sorted(missing):
        print('  ', m)


if __name__ == '__main__':
    main()
