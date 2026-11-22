// HTML overlay: text cards, progress, dive view, help, speaker notes, print.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const CH = 'lf-classroom-deck';

const STR = {
  fr: {
    enter: 'pour voir le vrai site', back: 'Entrée ou → pour revenir', explore: 'Mode exploration · E pour quitter',
    help: 'Commandes', notes: 'Notes', next: 'Ensuite', reset: 'Remettre à zéro', scene: 'Scène', waiting: 'Ouvrez la présentation dans l’autre fenêtre.',
    keys: [['→ Espace', 'étape suivante'], ['←', 'étape précédente'], ['Début / Fin', 'première / dernière scène'],
      ['chiffres + Entrée', 'aller à une scène'], ['L', 'français / anglais'], ['S', 'notes de l’orateur'], ['E', 'explorer la scène à la souris'], ['F', 'plein écran'], ['P', 'imprimer / PDF'], ['H', 'cette aide']],
  },
  en: {
    enter: 'to see the real site', back: 'Enter or → to go back', explore: 'Explore mode · E to leave',
    help: 'Controls', notes: 'Notes', next: 'Next', reset: 'Reset', scene: 'Scene', waiting: 'Open the presentation in the other window.',
    keys: [['→ Space', 'next step'], ['←', 'previous step'], ['Home / End', 'first / last scene'],
      ['digits + Enter', 'jump to a scene'], ['L', 'French / English'], ['S', 'speaker notes'], ['E', 'explore the scene with the mouse'], ['F', 'fullscreen'], ['P', 'print / PDF'], ['H', 'this help']],
  },
};
const getLang = () => {
  try { const v = localStorage.getItem('lf.deck.lang'); if (v === 'fr' || v === 'en') return v; } catch { /* ignore */ }
  const q = new URLSearchParams(location.search).get('lang');
  return q === 'en' ? 'en' : 'fr';
};
const tr = (v, lang) => (v == null ? '' : typeof v === 'string' ? v : v[lang] ?? v.fr ?? v.en ?? '');

function beatHtml(t, lang, hasShot) {
  if (!t) return '';
  let h = '';
  if (t.h) h += `<h1>${esc(tr(t.h, lang))}<svg class="u" viewBox="0 0 300 10" preserveAspectRatio="none"><path d="M2 6 C 50 1, 90 9, 150 5 S 250 2, 298 6"/></svg></h1>`;
  if (t.big) h += `<div class="big">${esc(tr(t.big, lang))}</div>`;
  if (t.b && t.b.length) h += `<ul>${t.b.map((x) => `<li>${esc(tr(x, lang))}</li>`).join('')}</ul>`;
  return h;
}

export class UI {
  constructor({ scenes, text, onNav, onGoto, onLang }) {
    Object.assign(this, { scenes, text, onNav, onGoto, onLang });
    const q = new URLSearchParams(location.search).get('lang');
    this.lang = q === 'en' || q === 'fr' ? q : getLang();
    this.card = $('card');
    this.bc = 'BroadcastChannel' in window ? new BroadcastChannel(CH) : null;
    if (this.bc) this.bc.onmessage = (e) => { if (e.data && e.data.nav) this.onNav(e.data.nav); if (e.data && e.data.hello) this.post(); };
    $('btn-lang').onclick = () => this.toggleLang();
    $('btn-help').onclick = () => this.help();
    $('help').onclick = () => this.help(false);
    $('dive').onclick = () => this.onNav(1);
    const p = $('progress');
    scenes.forEach((s, i) => {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.innerHTML = '<i></i>';
      seg.onclick = () => this.onGoto(i, 0);
      p.appendChild(seg);
    });
    this.applyLang();
    this.buildPrint();
  }

  applyLang() {
    document.documentElement.lang = this.lang;
    $('btn-lang').textContent = this.lang === 'fr' ? 'EN' : 'FR';
    $('help-title').textContent = STR[this.lang].help;
    $('help-table').innerHTML = STR[this.lang].keys.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('');
    $('explore-badge').textContent = STR[this.lang].explore;
    [...$('progress').children].forEach((seg, i) => { seg.title = `${i} · ${tr(this.text[this.scenes[i].id]?.name, this.lang)}`; });
  }
  toggleLang() {
    this.lang = this.lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('lf.deck.lang', this.lang); } catch { /* ignore */ }
    this.applyLang();
    this.buildPrint();
    this.onLang();
  }

  show(si, bi, nBeats, beat) {
    this.state = { si, bi, nBeats };
    const sc = this.text[this.scenes[si].id] || {};
    const t = (sc.beats || [])[bi];
    $('scene-name').textContent = `${si} · ${tr(sc.name, this.lang)}`;
    const c = this.card;
    const hasShot = !!(beat && (beat.shot || (beat.screen && beat.screen.userData.shot)));
    c.classList.remove('on');
    clearTimeout(this._t);
    const fill = () => {
      c.className = 'card ' + ((t && t.side) || 'left');
      if (!t || (!t.h && !t.b && !t.big)) { c.classList.add('empty'); c.innerHTML = ''; return; }
      c.innerHTML = beatHtml(t, this.lang, hasShot);
      void c.offsetWidth;
      c.classList.add('on');
    };
    this._t = setTimeout(fill, 220);
    [...$('progress').children].forEach((seg, i) => {
      seg.classList.toggle('done', i < si);
      seg.firstChild.style.width = i < si ? '100%' : i === si ? `${((bi + 1) / nBeats) * 100}%` : '0';
    });
    this.post();
  }
  post() {
    if (this.bc && this.state) this.bc.postMessage({ state: this.state, lang: this.lang });
  }

  fade(on) { $('veil').classList.toggle('on', on); }
  toast(msg) { const t = $('toast'); t.hidden = !msg; t.textContent = msg; }
  setExplore(on) { $('explore-badge').hidden = !on; this.card.style.visibility = on ? 'hidden' : ''; }
  help(on) { const h = $('help'); h.hidden = on === undefined ? !h.hidden : !on; }

  dive(shot, delay = 0) {
    const d = $('dive');
    $('dive-img').src = `shots/${shot}.webp`;
    d.hidden = false;
    this.card.style.visibility = 'hidden';
    clearTimeout(this._d);
    this._d = setTimeout(() => d.classList.add('on'), delay * 1000 + 20);
  }
  undive() {
    const d = $('dive');
    clearTimeout(this._d);
    d.classList.remove('on');
    this.card.style.visibility = '';
    this._d = setTimeout(() => { d.hidden = true; }, 460);
  }

  openNotes() {
    window.open(location.pathname + '?notes=1', 'lf-deck-notes', 'width=760,height=620');
    setTimeout(() => this.post(), 800);
  }

  print() { window.print(); }
  buildPrint() {
    const out = [];
    this.scenes.forEach((s, i) => {
      const sc = this.text[s.id] || {};
      const shot = sc.shot;
      const body = (sc.beats || []).filter((b) => b && (b.h || b.b || b.big)).map((b) =>
        `${b.h ? `<h3>${esc(tr(b.h, this.lang))}</h3>` : ''}${b.big ? `<div class="big">${esc(tr(b.big, this.lang))}</div>` : ''}${b.b ? `<ul>${b.b.map((x) => `<li>${esc(tr(x, this.lang))}</li>`).join('')}</ul>` : ''}`).join('');
      out.push(`<div class="page${shot ? '' : ' noshot'}"><div><div class="num">${STR[this.lang].scene} ${i}</div><h2>${esc(tr(sc.name, this.lang))}</h2>${body}</div>${shot ? `<img src="shots/${shot}.webp" alt="" loading="lazy">` : ''}</div>`);
    });
    $('print').innerHTML = out.join('');
  }
}

/** Speaker notes window: index.html?notes=1 (kept in sync through BroadcastChannel). */
export async function initNotesWindow() {
  const [{ ORDER, TEXT }] = await Promise.all([import('./scenes.js')]);
  document.body.className = 'notes ready';
  const root = document.createElement('div');
  root.id = 'notes';
  document.body.appendChild(root);
  let lang = getLang(), state = null, t0 = Date.now();
  const bc = new BroadcastChannel(CH);
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const beatAt = (si, bi) => (TEXT[ORDER[si]]?.beats || [])[bi];
  function render() {
    const L = STR[lang];
    if (!state) { root.innerHTML = `<h1>${L.notes}</h1><p>${L.waiting}</p>`; return; }
    const { si, bi, nBeats } = state;
    const sc = TEXT[ORDER[si]] || {};
    const b = beatAt(si, bi) || {};
    let nsi = si, nbi = bi + 1;
    if (nbi >= nBeats) { nsi = si + 1; nbi = 0; }
    const nb = beatAt(nsi, nbi);
    root.innerHTML = `<div class="meta"><span class="timer" id="timer">${fmt(Date.now() - t0)}</span><button id="reset">${L.reset}</button>
      <span>${L.scene} ${si} · ${esc(tr(sc.name, lang))} — ${bi + 1}/${nBeats}</span><button id="prev">←</button><button id="nextb">→</button></div>
      <h1>${esc(tr(b.h, lang) || tr(sc.name, lang))}</h1>
      <div class="now card">${esc(tr(b.n, lang) || (b.b || []).map((x) => tr(x, lang)).join(' · ') || '—')}</div>
      <div class="next"><strong>${L.next} :</strong> ${nb ? esc(tr(nb.h, lang) || tr(TEXT[ORDER[nsi]]?.name, lang)) : '—'}</div>`;
    document.getElementById('reset').onclick = () => { t0 = Date.now(); };
    document.getElementById('prev').onclick = () => bc.postMessage({ nav: -1 });
    document.getElementById('nextb').onclick = () => bc.postMessage({ nav: 1 });
  }
  bc.onmessage = (e) => { if (e.data && e.data.state) { state = e.data.state; lang = e.data.lang || lang; render(); } };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') bc.postMessage({ nav: 1 });
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') bc.postMessage({ nav: -1 });
  });
  setInterval(() => { const el = document.getElementById('timer'); if (el) el.textContent = fmt(Date.now() - t0); }, 500);
  render();
  bc.postMessage({ hello: 1 });
}
