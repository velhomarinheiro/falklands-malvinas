#!/usr/bin/env python3
"""
build_case_study.py — Converte o estudo de caso (.docx) na página
public/estudo-de-caso.html e copia as figuras para public/estudo-de-caso/img/.

Uso:  python3 scripts/build_case_study.py [docs/estudo-de-caso.docx]

Só usa a biblioteca padrão. Depois de regenerar a página, gere também o PDF:
      node scripts/case_study_pdf.js
"""
import html
import re
import shutil
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT   = Path(__file__).resolve().parent.parent
SRC    = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs' / 'estudo-de-caso.docx'
OUT    = ROOT / 'public' / 'estudo-de-caso.html'
IMGDIR = ROOT / 'public' / 'estudo-de-caso' / 'img'
PDF    = '/estudo-de-caso/Zona-de-Exclusao-Estudo-de-Caso.pdf'

W  = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A  = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R  = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
WP = '{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'

HEADINGS = {'Title': 'h1', 'Heading1': 'h1', 'Heading2': 'h2', 'Heading3': 'h3', 'Heading4': 'h4'}
SPOILER  = 'Anexo C'   # desenrolar histórico: ler somente após o jogo


def slug(text, used):
    s = unicodedata.normalize('NFKD', re.sub(r'<[^>]+>', '', html.unescape(text)))
    s = re.sub(r'[^a-z0-9]+', '-', s.encode('ascii', 'ignore').decode().lower()).strip('-')[:60] or 'secao'
    base, n = s, 2
    while s in used:
        s, n = f'{base}-{n}', n + 1
    used.add(s)
    return s


def on(el):
    return el is not None and el.get(W + 'val') not in ('0', 'false')


class Converter:
    def __init__(self, z):
        self.z = z
        rels = z.read('word/_rels/document.xml.rels').decode()
        self.rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
        num = z.read('word/numbering.xml').decode()
        self.abs_of = dict(re.findall(r'<w:num w:numId="(\d+)"><w:abstractNumId w:val="(\d+)"/>', num))
        self.abs_fmt = {m.group(1): re.findall(r'<w:numFmt w:val="([a-zA-Z]+)"/>', m.group(0))
                        for m in re.finditer(r'<w:abstractNum w:abstractNumId="(\d+)".*?</w:abstractNum>', num, re.S)}
        self.images = []

    def runs(self, p):
        out = []
        for r in p.iter(W + 'r'):
            rp = r.find(W + 'rPr')
            b = rp is not None and on(rp.find(W + 'b'))
            i = rp is not None and on(rp.find(W + 'i'))
            for ch in r:
                if ch.tag == W + 't':
                    t = html.escape(ch.text or '', quote=False)
                    if b: t = f'<strong>{t}</strong>'
                    if i: t = f'<em>{t}</em>'
                    out.append(t)
                elif ch.tag == W + 'br':
                    out.append('<br>')
                elif ch.tag == W + 'tab':
                    out.append(' ')
                elif ch.tag == W + 'drawing':
                    blip = ch.find('.//' + A + 'blip')
                    doc_pr = ch.find('.//' + WP + 'docPr')
                    alt = (doc_pr.get('descr') or doc_pr.get('title') or '') if doc_pr is not None else ''
                    target = self.rels[blip.get(R + 'embed')]
                    name = Path(target).name
                    self.images.append(name)
                    out.append(f'<img src="/estudo-de-caso/img/{name}" alt="{html.escape(alt)}" loading="lazy">')
        return ''.join(out).replace('</strong><strong>', '').replace('</em><em>', '')

    def pinfo(self, p):
        pp = p.find(W + 'pPr')
        if pp is None:
            return None, None, None
        st = pp.find(W + 'pStyle')
        n = pp.find(W + 'numPr')
        lvl = nid = None
        if n is not None:
            lvl = int(n.find(W + 'ilvl').get(W + 'val'))
            nid = n.find(W + 'numId').get(W + 'val')
        return (st.get(W + 'val') if st is not None else None), lvl, nid

    def table(self, t):
        rows = []
        for tr in t.findall(W + 'tr'):
            cells = []
            for tc in tr.findall(W + 'tc'):
                span = tc.find(W + 'tcPr/' + W + 'gridSpan')
                inner = self.blocks(list(tc))
                m = re.fullmatch(r'<p>(.*)</p>', inner, re.S)
                if m and '<p>' not in m.group(1):
                    inner = m.group(1)
                cells.append((inner, int(span.get(W + 'val')) if span is not None else 1))
            rows.append(cells)
        cls = ' class="wide"' if rows and len(rows[0]) >= 5 else ''
        h = [f'<div class="table-wrap"><table{cls}>']
        for i, cells in enumerate(rows):
            tag = 'th' if i == 0 else 'td'
            row = ''.join(f'<{tag}' + (f' colspan="{sp}"' if sp > 1 else '') + f'>{c}</{tag}>' for c, sp in cells)
            h.append(('<thead>' if i == 0 else '<tbody>' if i == 1 else '') + f'<tr>{row}</tr>' + ('</thead>' if i == 0 else ''))
        h.append('</tbody></table></div>')
        return ''.join(h)

    def blocks(self, els):
        out, stack = [], []

        def close_to(n):
            while len(stack) > n:
                out.append(f'</li></{stack.pop()}>')

        for el in els:
            if el.tag == W + 'tbl':
                close_to(0)
                out.append(self.table(el))
                continue
            if el.tag != W + 'p':
                continue
            st, lvl, nid = self.pinfo(el)
            c = self.runs(el)
            if nid is not None:
                fmts = self.abs_fmt[self.abs_of[nid]]
                tag = 'ol' if fmts[lvl] == 'decimal' else 'ul'
                close_to(lvl + 1)
                if len(stack) == lvl + 1:
                    out.append('</li><li>' + c)
                else:
                    while len(stack) < lvl + 1:
                        stack.append(tag)
                        out.append(f'<{tag}><li>' + (c if len(stack) == lvl + 1 else ''))
                continue
            close_to(0)
            if not c.strip():
                continue
            if st in HEADINGS:
                out.append(f'<{HEADINGS[st]}>{c}</{HEADINGS[st]}>')
            elif st == 'Code':
                out.append(f'<pre>{c}</pre>')
            elif re.fullmatch(r'<img [^>]*>', c):
                out.append(f'<figure>{c}</figure>')
            else:
                out.append(f'<p>{c}</p>')
        close_to(0)
        return ''.join(out)


def latex_to_html(tex):
    """Converte a única fórmula do documento (tempo de trânsito) em HTML legível."""
    tex = html.unescape(tex)
    tex = re.sub(r'\\text\{([^}]*)\}', r'\1', tex)
    tex = re.sub(r'_\{([^}]*)\}', r'<sub>\1</sub>', tex)
    tex = re.sub(r'\\frac\{(.*?)\}\{(.*)\}',
                 r'<span class="frac"><span>\1</span><span>\2</span></span>', tex)
    return tex.replace('\\times', '×')


def postprocess(body):
    # Fórmula em LaTeX (estilo "Code") → HTML.
    body = re.sub(r'<pre>(.*?)</pre>', lambda m: f'<div class="formula">{latex_to_html(m.group(1))}</div>', body)
    # Figura + parágrafo de legenda → <figure><figcaption>.
    def fig(m):
        img, cap = m.group(1), m.group(2)
        alt = html.unescape(re.search(r'alt="([^"]*)"', img).group(1))
        plain = html.unescape(re.sub(r'<[^>]+>', '', cap))
        if plain.startswith('Figura') or plain.strip() == alt.strip():
            return f'<figure>{img}<figcaption>{cap}</figcaption></figure>'
        return m.group(0)
    body = re.sub(r'<figure>(<img [^>]*>)</figure><p>(.*?)</p>', fig, body)
    return body


def build():
    with zipfile.ZipFile(SRC) as z:
        conv = Converter(z)
        root = ET.fromstring(z.read('word/document.xml'))
        body = postprocess(conv.blocks(list(root.find(W + 'body'))))
        IMGDIR.mkdir(parents=True, exist_ok=True)
        for name in conv.images:
            with z.open(f'word/media/{name}') as src, open(IMGDIR / name, 'wb') as dst:
                shutil.copyfileobj(src, dst)

    # Título e linha de autoria (primeiros elementos) viram o cabeçalho da página.
    m = re.match(r'<h1>(.*?)</h1><p>(.*?)</p>', body)
    title, byline = m.group(1), m.group(2).replace('@', '')
    months = dict(zip('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(),
                      'jan fev mar abr mai jun jul ago set out nov dez'.split()))
    byline = re.sub(r'\b([A-Z][a-z]{2}) (\d{1,2}), (\d{4})',
                    lambda d: f'{d.group(2)} {months.get(d.group(1), d.group(1))} {d.group(3)}', byline)
    body = body[m.end():]

    # Âncoras nas seções e sumário (h2 + h3).
    used, toc, depth = set(), [], 0
    def anchor(m):
        level, text = m.group(1), m.group(2)
        sid = slug(text, used)
        if level in ('2', '3'):
            toc.append((int(level), sid, re.sub(r'<[^>]+>', '', text)))
        return f'<h{level} id="{sid}">{text}</h{level}>'
    body = re.sub(r'<h([234])>(.*?)</h\1>', anchor, body)

    # Cada h2 abre uma <section>; o Anexo C fica recolhido (spoiler do desfecho).
    parts = re.split(r'(?=<h2 )', body)
    sections = []
    for part in parts:
        if not part.strip():
            continue
        if part.startswith('<h2 ') and SPOILER in part[:200]:
            head_end = part.index('</h2>') + 5
            sections.append(
                f'<section class="spoiler">{part[:head_end]}'
                '<details class="spoiler-box"><summary>'
                '<span class="spoiler-warn">⚠ Leia somente após o jogo.</span> '
                'Este anexo narra o desenrolar histórico da campanha. Clique para abrir.'
                f'</summary>{part[head_end:]}</details></section>')
        else:
            sections.append(f'<section>{part}</section>')

    toc_html, open_sub = ['<ol class="toc-list">'], False
    for level, sid, text in toc:
        if level == 2:
            if open_sub:
                toc_html.append('</ol>'); open_sub = False
            if len(toc_html) > 1:
                toc_html.append('</li>')
            toc_html.append(f'<li><a href="#{sid}">{html.escape(text, quote=False)}</a>')
        else:
            if not open_sub:
                toc_html.append('<ol>'); open_sub = True
            toc_html.append(f'<li><a href="#{sid}">{html.escape(text, quote=False)}</a></li>')
    toc_html.append(('</ol>' if open_sub else '') + '</li></ol>')

    page = TEMPLATE.format(
        title=title, title_plain=html.escape(re.sub(r'<[^>]+>', '', html.unescape(title))),
        byline=byline, toc=''.join(toc_html), body='\n'.join(sections), pdf=PDF)
    OUT.write_text(page, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {len(toc)} seções, {len(conv.images)} figuras')


TEMPLATE = """<!DOCTYPE html>
<!-- Gerado por scripts/build_case_study.py a partir de docs/estudo-de-caso.docx — não edite à mão. -->
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estudo de Caso — Zona de Exclusão, Atlântico Sul 1982</title>
  <meta name="description" content="Estudo de caso do jogo de guerra Zona de Exclusão — Atlântico Sul, 1982: contexto histórico, cadeias de comando, ordem de batalha, situação em 30 de abril de 1982, fatores de planejamento e questões para a estimativa do comandante.">
  <link rel="icon" type="image/png" sizes="32x32" href="/img/brand/favicon-32.png">
  <link rel="stylesheet" href="/css/estudo.css">
</head>
<body>
<header class="cs-bar">
  <a class="cs-back" href="/">← Voltar ao jogo</a>
  <img class="cs-logo" src="/img/brand/logo_horizontal_pt.png" alt="Zona de Exclusão — Atlântico Sul, 1982">
  <a class="cs-pdf" href="{pdf}" download>⬇ Exportar PDF</a>
</header>

<div class="cs-layout">
  <nav class="cs-toc" aria-label="Sumário">
    <details open>
      <summary>Sumário</summary>
      {toc}
    </details>
  </nav>

  <main class="cs-doc">
    <header class="cs-head">
      <p class="cs-kicker">Estudo de caso para o jogo de guerra</p>
      <h1>{title}</h1>
      <p class="cs-byline">{byline}</p>
      <div class="cs-head-actions">
        <a class="cs-btn" href="{pdf}" download>⬇ Exportar PDF</a>
        <a class="cs-btn ghost" href="/#lobby">▶ Jogar</a>
      </div>
    </header>
{body}
    <footer class="cs-foot">
      <a class="cs-btn" href="{pdf}" download>⬇ Exportar PDF</a>
      <a class="cs-btn ghost" href="#top" onclick="window.scrollTo(0,0);return false;">↑ Topo</a>
      <a class="cs-btn ghost" href="/">← Voltar ao jogo</a>
    </footer>
  </main>
</div>
<script>
  // Na impressão, abre o anexo recolhido para que o documento saia completo.
  window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => {{ d.dataset.wasOpen = d.open; d.open = true; }}));
  window.addEventListener('afterprint',  () => document.querySelectorAll('details').forEach(d => {{ d.open = d.dataset.wasOpen === 'true'; }}));
  // Links do sumário abrem o anexo recolhido quando apontam para dentro dele.
  document.querySelectorAll('.cs-toc a').forEach(a => a.addEventListener('click', () => {{
    const target = document.querySelector(a.getAttribute('href'));
    const box = target && target.closest('details.spoiler-box');
    if (box) box.open = true;
  }}));
</script>
</body>
</html>
"""

if __name__ == '__main__':
    build()
