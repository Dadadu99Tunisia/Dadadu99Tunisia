/* SIGILLE · film de lancement · moteur de scènes.
 *
 * Chaque image est une fonction pure du temps : window.render(t) place tous les éléments pour
 * l'instant t (secondes). tools/render.mjs appelle render(t) pour chaque image et la capture.
 * Les textes et le minutage viennent de data.js (généré depuis script/*.json).
 * Les captures d'écran sont réelles (voir docs/MANIFESTE_ASSETS_LICENCES.md) : on ne les retouche
 * pas, on les cadre, on les déplace, on les éclaire.
 */
(() => {
  const F = window.FILM;
  const W = 1920, H = 1080;
  const stage = document.getElementById("stage");

  // ───────────────────────── outils ─────────────────────────
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  /** Enveloppe 0 → 1 → 0 : entrée [a, a+fi], sortie [b-fo, b]. */
  const env = (t, a, b, fi = 0.7, fo = 0.7) => Math.min(easeOut(ramp(t, a, a + fi)), 1 - easeIO(ramp(t, b - fo, b)));
  const scene = (id) => F.scenes.find((s) => s.id === id);

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent || stage).appendChild(e);
    return e;
  }
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function place(e, { o = 1, x = 0, y = 0, s = 1, extra = "" } = {}) {
    e.style.opacity = o.toFixed(4);
    e.style.visibility = o <= 0.001 ? "hidden" : "visible";
    e.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)}) ${extra}`;
  }
  /** Interpolation de images-clés [[t, ...valeurs]] avec easing. */
  function keys(t, ks) {
    if (t <= ks[0][0]) return ks[0].slice(1);
    for (let i = 0; i < ks.length - 1; i++) {
      const [a, b] = [ks[i], ks[i + 1]];
      if (t <= b[0]) {
        const k = easeIO(ramp(t, a[0], b[0]));
        return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
      }
    }
    return ks[ks.length - 1].slice(1);
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // Symbole officiel (website/components/Logo.tsx, géométrie inchangée).
  const MARK_PATH =
    "M870,861L829,820L804,799L771,774L769,778L767,813L761,841L744,886L729,911L699,950L672,975L648,992L627,1004L594,1019L565,1028L525,1036L426,1038L371,1045L337,1053L297,1067L253,1088L220,1109L194,1128L178,1141L152,1167L116,1212L100,1235L91,1251L66,1303L55,1344L52,1351L42,1395L40,1429L39,1430L39,1516L555,1517L556,1516L581,1515L636,1505L679,1492L703,1482L740,1463L773,1443L804,1420L827,1399L863,1360L889,1323L903,1298L925,1251L937,1215L948,1169L948,1162L952,1139L952,1059L946,1020L939,992L929,962L908,918L891,890ZM457,628L430,635L404,649L388,660L368,682L356,704L347,732L344,753L344,773L346,787L353,812L365,836L376,850L394,867L417,881L440,890L461,894L502,893L526,886L549,875L567,862L592,835L605,809L612,782L612,746L609,723L597,692L580,670L556,649L528,635L499,628ZM906,0L383,0L373,2L364,2L320,10L281,22L245,36L203,58L178,74L138,106L97,149L80,171L62,198L31,257L14,308L4,356L1,404L0,405L0,436L5,481L14,523L30,571L46,604L64,634L86,663L140,715L180,745L189,748L191,722L197,691L208,655L221,628L235,605L251,584L285,551L319,526L352,509L379,499L403,493L437,488L533,485L569,480L607,471L655,455L693,437L733,412L767,385L796,357L820,329L848,288L870,246L886,206L899,159L906,110Z";

  /** Symbole : tracé progressif (k_trace) puis remplissage (k_fill). */
  function makeMark(parent, h) {
    const w = (953 / 1518) * h;
    const svg = svgEl("svg", { width: w, height: h, viewBox: "-20 -20 993 1558" });
    svg.style.position = "absolute";
    parent.appendChild(svg);
    const parts = MARK_PATH.split(/(?=M)/).filter(Boolean);
    const strokes = parts.map((d) => svgEl("path", { d, fill: "none", stroke: "#f3efe6", "stroke-width": 7, "stroke-linejoin": "round" }, svg));
    const fill = svgEl("path", { d: MARK_PATH, fill: "#ffffff", "fill-rule": "evenodd" }, svg);
    const lens = strokes.map((p) => p.getTotalLength());
    strokes.forEach((p, i) => p.setAttribute("stroke-dasharray", `${lens[i]} ${lens[i]}`));
    return {
      svg, w, h,
      set(kTrace, kFill, kStrokeOut = kFill) {
        // Le cercle (2e forme) se trace en premier, puis les deux lames.
        const order = [1, 0, 2];
        order.forEach((idx, n) => {
          const k = easeIO(clamp(kTrace * 3 - n * 0.8, 0, 1));
          strokes[idx].setAttribute("stroke-dashoffset", (lens[idx] * (1 - k)).toFixed(1));
          strokes[idx].style.opacity = (1 - kStrokeOut).toFixed(3);
        });
        fill.style.opacity = easeIO(kFill).toFixed(3);
      },
    };
  }

  /** Fenêtre contenant une capture réelle, avec caméra (centre source cx, cy ; zoom z). */
  function makeWin(parent, src, sw, sh, r, opts = {}) {
    const root = el("div", "win", parent);
    Object.assign(root.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
    const top = opts.url ? 44 : 0;
    if (opts.url) {
      const c = el("div", "chrome", root, `<i></i><i></i><i></i><div class="url">${esc(opts.url)}</div>`);
      c.style.zIndex = 3;
    }
    const img = el("img", "", root);
    img.src = "assets/" + src;
    img.width = sw; img.height = sh;
    const foci = (opts.focus || []).map((f) => {
      const d = el("div", "focus" + (f.signal ? " signal" : ""), root);
      d.style.zIndex = 2;
      return { ...f, d };
    });
    const win = { root, img, r, sw, sh, top, foci, cam: opts.cam, z: 1, tx: 0, ty: 0 };
    win.camera = (cx, cy, z) => {
      const fw = r.w, fh = r.h - top;
      z = Math.max(z, Math.max(fw / sw, fh / sh));
      let tx = fw / 2 - cx * z, ty = fh / 2 - cy * z;
      tx = clamp(tx, fw - sw * z, 0);
      ty = clamp(ty, fh - sh * z, 0);
      Object.assign(win, { z, tx, ty });
      img.style.transform = `translate(${tx.toFixed(2)}px, ${(ty + top).toFixed(2)}px) scale(${z.toFixed(4)})`;
    };
    win.update = (t) => {
      if (win.cam) win.camera(...keys(t, win.cam));
      for (const f of win.foci) {
        const o = env(t, f.a, f.b, 0.45, 0.4);
        const [x0, y0, x1, y1] = f.r, p = 7;
        Object.assign(f.d.style, {
          left: (win.tx + x0 * win.z - p).toFixed(1) + "px",
          top: (win.ty + win.top + y0 * win.z - p).toFixed(1) + "px",
          width: ((x1 - x0) * win.z + 2 * p).toFixed(1) + "px",
          height: ((y1 - y0) * win.z + 2 * p).toFixed(1) + "px",
          opacity: o.toFixed(3),
          visibility: o > 0.001 ? "visible" : "hidden",
        });
      }
    };
    return win;
  }

  // ───────────────────────── calques de scène ─────────────────────────
  const layers = {};
  const updaters = [];
  for (const s of F.scenes) {
    const l = el("div", "layer", stage);
    l.dataset.scene = s.id;
    layers[s.id] = l;
  }
  function onScene(id, fn) { updaters.push({ id, fn }); }

  // Textes d'écran (script/ecran.json), placés selon la scène.
  const textLayer = el("div", "layer", stage);
  textLayer.style.zIndex = 20;
  const POS = {
    s01: { mode: "centre", y: 690, size: 30 },
    s02: { mode: "gauche", x: 140, y: 112, size: 30, maxW: 1640 },
    s03: { mode: "gauche", x: 140, y: 420, size: 26, maxW: 600, ls: 0.16 },
    s04: { mode: "gauche", x: 140, y: 112, size: 30, maxW: 1640 },
    s06: { mode: "gauche", x: 140, y: 112, size: 30, maxW: 1640 },
    s07: { mode: "gauche", x: 140, y: 430, size: 26, maxW: 600, ls: 0.16 },
    s08: { mode: "centre", y: 560, size: 60 },
  };
  const texts = F.ecran.map((e) => {
    let d;
    if (e.style === "etape") {
      const [num, lib] = e.texte.split("|");
      d = el("div", "etape", textLayer, `<span class="num">${esc(num)}</span><span class="lib">${esc(lib)}</span>`);
      Object.assign(d.style, { left: "140px", top: "62px" });
    } else if (e.style === "serif") {
      const html = esc(e.texte).replace("SIGILLE", "<em>SIGILLE</em>").replace(/\|/g, "<br>");
      d = el("div", "serif-txt", textLayer, html);
      const big = e.scene === "s03";
      Object.assign(d.style, { left: 0, width: W + "px", textAlign: "center", fontSize: big ? "112px" : "60px", top: big ? "430px" : "560px" });
    } else {
      const p = POS[e.scene];
      d = el("div", "titre", textLayer, esc(e.texte).replace(/\|/g, "<br>"));
      d.style.fontSize = p.size + "px";
      if (p.mode === "centre") Object.assign(d.style, { left: 0, width: W + "px", textAlign: "center", top: p.y + "px" });
      else Object.assign(d.style, { left: p.x + "px", top: p.y + "px" });
      d._maxW = p.maxW;
      d._ls = p.ls || 0.32;
      d.style.letterSpacing = d._ls + "em";
    }
    return { e, d };
  });
  function fitTexts() {
    for (const { d } of texts) {
      if (!d._maxW) continue;
      let size = parseFloat(d.style.fontSize);
      while (d.scrollWidth > d._maxW && size > 14) { size -= 1; d.style.fontSize = size + "px"; }
    }
  }
  function updateTexts(t) {
    for (const { e, d } of texts) {
      const o = env(t, e.debut, e.fin, 0.9, 0.7);
      if (o <= 0) { d.style.visibility = "hidden"; d.style.opacity = 0; continue; }
      const k = easeOut(ramp(t, e.debut, e.debut + 1.6));
      place(d, { o, y: lerp(16, 0, k) });
      if (d.classList.contains("titre")) d.style.letterSpacing = lerp(d._ls + 0.1, d._ls, k).toFixed(3) + "em";
    }
  }

  // Ligne de lumière aux changements de scène.
  const sweep = el("div", "abs", stage);
  Object.assign(sweep.style, { left: 0, top: "539px", height: "2px", width: W + "px", zIndex: 30,
    background: "linear-gradient(90deg, transparent, rgba(243,239,230,0.65), transparent)" });
  function updateSweep(t) {
    let o = 0, sx = 0;
    for (const s of F.scenes.slice(1)) {
      const k = ramp(t, s.debut - 0.5, s.debut + 0.6);
      if (k > 0 && k < 1) { o = Math.sin(k * Math.PI) * 0.55; sx = easeOut(k); }
    }
    place(sweep, { o, s: 1 }); sweep.style.transform = `scaleX(${sx.toFixed(3)})`;
  }

  // ───────────────────────── S01 · Ouverture ─────────────────────────
  {
    const L = layers.s01;
    const holder = el("div", "abs", L);
    const mark = makeMark(holder, 210);
    Object.assign(holder.style, { left: (W - mark.w) / 2 + "px", top: "250px", width: mark.w + "px", height: "210px" });
    const word = el("div", "abs", L, "SIGILLE");
    Object.assign(word.style, { left: 0, width: W + "px", textAlign: "center", top: "512px", font: "500 40px var(--sans)", letterSpacing: "0.62em", paddingLeft: "0.62em", color: "#f3efe6" });
    const line = el("div", "rule", L);
    Object.assign(line.style, { left: "660px", width: "600px", top: "600px" });
    onScene("s01", (t) => {
      mark.set(ramp(t, 0.6, 4.2), ramp(t, 3.6, 5.0));
      place(holder, { o: 1 - ramp(t, 18.4, 19.6), y: lerp(0, -10, ramp(t, 4, 19)) });
      const kw = easeOut(ramp(t, 4.0, 5.8));
      place(word, { o: kw * (1 - ramp(t, 18.4, 19.6)) });
      word.style.letterSpacing = lerp(0.9, 0.62, kw).toFixed(3) + "em";
      const kl = easeIO(ramp(t, 1.2, 3.6));
      line.style.transform = `scaleX(${kl.toFixed(3)})`;
      line.style.opacity = (0.8 * (1 - ramp(t, 18.4, 19.6))).toFixed(3);
    });
  }

  // ───────────────────────── S02 · Le problème ─────────────────────────
  {
    const L = layers.s02;
    const lines = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    Object.assign(lines.style, { position: "absolute", left: 0, top: 0 });
    L.appendChild(lines);
    const field = el("div", "abs", L);
    Object.assign(field.style, { left: 0, top: 0, width: W + "px", height: H + "px", perspective: "1600px" });

    // Pièces : cartes abstraites (pas de contenu réel).
    const cards = [];
    const CARD_POS = [[820, 330, -16], [1040, 300, -10], [1260, 345, -4], [900, 560, -14], [1120, 590, -8], [1340, 560, -2]];
    CARD_POS.forEach(([x, y, ry], i) => {
      const c = el("div", "card", field);
      Object.assign(c.style, { left: x + "px", top: y + "px", width: "190px", height: "236px", padding: "18px" });
      let html = `<div class="note" style="color:#9dbbee">PIÈCE ${String(i + 1).padStart(2, "0")}</div>`;
      for (let k = 0; k < 7; k++) html += `<div style="height:7px;margin-top:${k ? 13 : 22}px;border-radius:4px;background:rgba(243,239,230,${k % 3 === 2 ? 0.1 : 0.18});width:${[92, 80, 64, 88, 72, 54, 84][k]}%"></div>`;
      c.innerHTML = html;
      cards.push({ c, x, y, ry, cx: x + 95, cy: y + 118 });
    });

    // Éléments extraits : dates, faits, références, reliés à leurs pièces.
    const CHIPS = [
      { t: "12/08/2016", cls: "date", x: 1560, y: 250, card: 2, a: 27.2 },
      { t: "Pièce 3 · p. 1", cls: "", x: 1580, y: 470, card: 2, a: 28.0 },
      { t: "21/09/2019", cls: "date", x: 1600, y: 690, card: 5, a: 28.8 },
      { t: "Fait", cls: "", x: 1250, y: 860, card: 4, a: 29.6 },
      { t: "Argument", cls: "", x: 960, y: 865, card: 3, a: 30.4 },
      { t: "Source ?", cls: "", x: 1440, y: 190, card: 1, a: 31.2 },
      { t: "Pièce 15 · p. 2", cls: "", x: 760, y: 230, card: 0, a: 32.0 },
    ];
    const chipEls = CHIPS.map((ch) => {
      const d = el("div", "chip " + ch.cls, field, esc(ch.t));
      Object.assign(d.style, { left: ch.x + "px", top: ch.y + "px" });
      const c = cards[ch.card];
      const ln = svgEl("line", { x1: c.cx, y1: c.cy, x2: ch.x + 60, y2: ch.y + 20, stroke: "rgba(243,239,230,0.28)", "stroke-width": 1.2 }, lines);
      const len = Math.hypot(ch.x + 60 - c.cx, ch.y + 20 - c.cy);
      ln.setAttribute("stroke-dasharray", `${len} ${len}`);
      return { ...ch, d, ln, len };
    });

    // La contradiction : un même événement, deux dates.
    const fact = el("div", "chip", field, "Un même événement");
    Object.assign(fact.style, { left: "110px", top: "560px" });
    const dA = el("div", "chip date", field, "05/01/2015 · pièce 6");
    const dB = el("div", "chip date", field, "09/09/2015 · pièce 24");
    Object.assign(dA.style, { left: "430px", top: "430px" });
    Object.assign(dB.style, { left: "430px", top: "700px" });
    const lA = svgEl("path", { d: "M 385 580 C 410 580, 400 450, 430 450", fill: "none", "stroke-width": 1.6 }, lines);
    const lB = svgEl("path", { d: "M 385 580 C 410 580, 400 720, 430 720", fill: "none", "stroke-width": 1.6 }, lines);
    const lAc = svgEl("line", { x1: 690, y1: 450, x2: 820 + 95, y2: 330 + 118, "stroke-width": 1.2 }, lines);
    const lBc = svgEl("line", { x1: 700, y1: 720, x2: 900 + 95, y2: 560 + 118, "stroke-width": 1.2 }, lines);
    const neq = el("div", "abs", field, "≠");
    Object.assign(neq.style, { left: "352px", top: "546px", font: "500 40px var(--sans)", color: "var(--signal)" });
    const lab = el("div", "note", field, "Dates contradictoires");
    Object.assign(lab.style, { position: "absolute", left: "110px", top: "630px", color: "var(--signal)", fontSize: "18px" });
    const conv = el("div", "abs", L);
    Object.assign(conv.style, { left: "954px", top: "534px", width: "12px", height: "12px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 30px 10px rgba(157,187,238,0.7)" });

    onScene("s02", (t) => {
      const kConv = easeIO(ramp(t, 52.6, 55.0)); // tout converge vers le centre
      const conv2 = (x, y) => [lerp(x, 960, kConv), lerp(y, 540, kConv)];
      const drift = (i, amp = 6) => [Math.sin(t * 0.35 + i * 1.7) * amp, Math.cos(t * 0.3 + i * 2.1) * amp];
      field.style.opacity = (1 - ramp(t, 54.0, 55.2)).toFixed(3);
      lines.style.opacity = field.style.opacity;
      cards.forEach((c, i) => {
        const k = easeOut(ramp(t, 20.6 + i * 0.55, 22.4 + i * 0.55));
        const [dx, dy] = drift(i, 5);
        const [px, py] = conv2(c.x, c.y);
        place(c.c, { o: k * (1 - 0.35 * ramp(t, 44, 47)), x: px - c.x + dx, y: py - c.y + dy, s: lerp(1, 0.1, kConv),
          extra: `rotateY(${c.ry}deg) translateZ(${lerp(-420, 0, k).toFixed(1)}px)` });
      });
      chipEls.forEach((ch, i) => {
        const k = easeOut(ramp(t, ch.a, ch.a + 1.2));
        const [dx, dy] = drift(i + 7, 7);
        const [px, py] = conv2(ch.x, ch.y);
        place(ch.d, { o: k * (1 - 0.45 * ramp(t, 44, 47)), x: px - ch.x + dx, y: py - ch.y + dy, s: lerp(1, 0.1, kConv) });
        ch.ln.setAttribute("stroke-dashoffset", (ch.len * (1 - easeIO(ramp(t, ch.a - 0.2, ch.a + 1.4)))).toFixed(1));
        ch.ln.style.opacity = ((1 - 0.5 * ramp(t, 44, 47)) * (1 - kConv)).toFixed(3);
      });
      const kf = easeOut(ramp(t, 36.4, 37.6)), kd = easeIO(ramp(t, 37.4, 40.0)), ks = ramp(t, 39.2, 40.4);
      const sig = (a) => `rgba(224,106,50,${a})`;
      const [fx, fy] = conv2(110, 560);
      place(fact, { o: kf, x: fx - 110, y: fy - 560, s: lerp(1, 0.1, kConv) });
      // Les deux dates s'écartent : la contradiction devient visible.
      const spread = lerp(0, 1, kd);
      [[dA, 430, -1], [dB, 700, 1]].forEach(([d, y0, sgn]) => {
        const [px, py] = conv2(430, y0);
        place(d, { o: kf, x: px - 430 + spread * 30, y: py - y0 + sgn * spread * 12, s: lerp(1, 0.1, kConv) });
        d.classList.toggle("signal", ks > 0.5);
      });
      for (const p of [lA, lB]) {
        p.setAttribute("stroke", ks > 0 ? sig(lerp(0.3, 0.9, ks)) : "rgba(243,239,230,0.3)");
        p.style.opacity = (kf * (1 - kConv)).toFixed(3);
      }
      for (const p of [lAc, lBc]) { p.setAttribute("stroke", "rgba(243,239,230,0.2)"); p.style.opacity = (kd * (1 - kConv)).toFixed(3); }
      place(neq, { o: ks * (1 - kConv) });
      place(lab, { o: ramp(t, 40.0, 41.2) * (1 - kConv) });
      place(conv, { o: Math.sin(clamp(ramp(t, 53.8, 55.6)) * Math.PI), s: lerp(0.4, 1.6, ramp(t, 53.8, 55.6)) });
    });
  }

  // ───────────────────────── S03 · Voici SIGILLE ─────────────────────────
  {
    const L = layers.s03;
    const holder = el("div", "abs", L);
    const mark = makeMark(holder, 120);
    Object.assign(holder.style, { left: (W - mark.w) / 2 + "px", top: "250px" });
    const persp = el("div", "abs", L);
    Object.assign(persp.style, { left: 0, top: 0, width: W + "px", height: H + "px", perspective: "2200px" });
    const R = { x: 800, y: 168, w: 980, h: 712 };
    const w1 = makeWin(persp, "captures/00-pupitre.png", 1440, 900, R, {
      cam: [[64.5, 560, 450, 0.79], [75.6, 640, 380, 0.95]],
      focus: [{ r: [1082, 188, 1400, 430], a: 70.0, b: 75.2 }],
    });
    const w2 = makeWin(persp, "captures/05-redaction.png", 1920, 1080, R, {
      cam: [[75.0, 760, 560, 0.75], [84.8, 760, 700, 0.9]],
      focus: [{ r: [415, 657, 1118, 720], a: 78.0, b: 84.0 }],
    });
    const kick = el("div", "kicker abs", L, "Capture réelle de l'application");
    Object.assign(kick.style, { left: "140px", top: "372px" });
    const note = el("div", "note abs", L, "Dossier fictif de recette<br>Octobre 2026");
    Object.assign(note.style, { left: "140px", top: "560px", lineHeight: "1.7" });
    onScene("s03", (t) => {
      mark.set(ramp(t, 54.8, 56.4), ramp(t, 55.8, 57.0));
      place(holder, { o: 1 - ramp(t, 63.4, 64.4), y: lerp(0, -20, ramp(t, 55, 64)) });
      const kin = easeOut(ramp(t, 64.2, 66.0));
      const rot = lerp(-14, -4, easeOut(ramp(t, 64.2, 84)));
      for (const [w, a, b] of [[w1, 64.2, 75.6], [w2, 75.0, 85.0]]) {
        const o = Math.min(ramp(t, a, a + 0.8), 1 - ramp(t, b - 0.6, b + 0.3));
        place(w.root, { o: (w === w1 ? kin : 1) * o, x: lerp(120, 0, kin), extra: `rotateY(${rot.toFixed(2)}deg)` });
        w.root.style.transformOrigin = "0% 50%";
        if (o > 0) w.update(t);
      }
      place(kick, { o: env(t, 66.0, 84.0, 0.9, 0.7) });
      place(note, { o: env(t, 67.0, 84.0, 0.9, 0.7) });
    });
  }

  // ───────────────────────── S04 · Circuit fermé ─────────────────────────
  {
    const L = layers.s04;
    const g = svgEl("svg", { width: 1640, height: 620, viewBox: "0 0 1640 620" });
    Object.assign(g.style, { position: "absolute", left: "140px", top: "250px" });
    L.appendChild(g);
    const C = { iv: "#f3efe6", iv2: "#cfc9bd", mu: "#8d95a4", co: "#5b8fe0", ct: "#9dbbee", sig: "#e06a32" };
    const items = [];
    const grp = (a) => { const e = svgEl("g", {}, g); items.push({ e, a }); return e; };
    const text = (p, x, y, s, { size = 22, fill = C.iv, font = "Onest", weight = 400, anchor = "start", ls = 0 } = {}) => {
      const e = svgEl("text", { x, y, "font-family": font, "font-size": size, fill, "font-weight": weight, "text-anchor": anchor, "letter-spacing": ls }, p);
      e.textContent = s;
      return e;
    };
    const box = (p, x, y, w, h, title, sub, { dash = false, stroke = "rgba(243,239,230,0.3)", fill = "rgba(17,29,51,0.95)" } = {}) => {
      svgEl("rect", { x, y, width: w, height: h, rx: 12, fill, stroke, "stroke-width": 1.4, ...(dash ? { "stroke-dasharray": "7 6" } : {}) }, p);
      text(p, x + 20, y + 37, title, { size: 21, weight: 500 });
      if (sub) text(p, x + 20, y + 64, sub, { size: 16, fill: C.iv2 });
    };
    // Votre poste
    const gPoste = grp(87.0);
    svgEl("rect", { x: 0, y: 30, width: 800, height: 520, rx: 22, fill: "rgba(17,29,51,0.45)", stroke: C.co, "stroke-width": 1.6 }, gPoste);
    text(gPoste, 28, 72, "VOTRE POSTE", { size: 17, fill: C.ct, font: "JetBrains Mono", ls: 3 });
    const gA = grp(88.4); box(gA, 50, 100, 330, 92, "Application SIGILLE", "interface et dossiers");
    const gB = grp(89.4); box(gB, 50, 250, 330, 92, "Moteur IA local", "fonctionne sur ce poste");
    const gC = grp(90.4); box(gC, 50, 400, 330, 92, "Pièces et base du dossier", "stockées sur ce poste");
    const gLoop = grp(91.6);
    svgEl("line", { x1: 215, y1: 192, x2: 215, y2: 250, stroke: C.co, "stroke-width": 1.6 }, gLoop);
    svgEl("line", { x1: 120, y1: 192, x2: 120, y2: 400, stroke: C.co, "stroke-width": 1.6 }, gLoop);
    const dots = [0, 1, 2].map(() => svgEl("circle", { r: 5, fill: C.ct }, gLoop));
    // Garde des connexions sortantes
    const gGuard = grp(93.6);
    svgEl("circle", { cx: 640, cy: 290, r: 60, fill: "rgba(17,29,51,0.95)", stroke: C.co, "stroke-width": 2 }, gGuard);
    svgEl("path", { d: "M640 255 L668 266 L668 292 C668 310 655 322 640 328 C625 322 612 310 612 292 L612 266 Z", fill: "none", stroke: C.iv, "stroke-width": 2.2 }, gGuard);
    text(gGuard, 640, 384, "Garde des connexions", { size: 19, anchor: "middle", weight: 500 });
    text(gGuard, 640, 410, "sortantes", { size: 19, anchor: "middle", weight: 500 });
    svgEl("line", { x1: 380, y1: 146, x2: 582, y2: 272, stroke: "rgba(243,239,230,0.35)", "stroke-width": 1.4 }, gGuard);
    const packet = svgEl("circle", { r: 6, fill: C.iv }, gGuard);
    const cross = svgEl("text", { x: 700, y: 236, "font-family": "Onest", "font-size": 34, fill: C.sig, "font-weight": 600 }, gGuard);
    cross.textContent = "✕";
    // Réseau du cabinet
    const gNet = grp(98.6);
    svgEl("rect", { x: 840, y: 30, width: 320, height: 520, rx: 22, fill: "none", stroke: "rgba(243,239,230,0.28)", "stroke-width": 1.4, "stroke-dasharray": "7 6" }, gNet);
    text(gNet, 864, 72, "RÉSEAU DU CABINET", { size: 17, fill: C.mu, font: "JetBrains Mono", ls: 3 });
    box(gNet, 862, 240, 276, 100, "Services internes", "déclarés · facultatif");
    svgEl("line", { x1: 700, y1: 290, x2: 862, y2: 290, stroke: "rgba(91,143,224,0.6)", "stroke-width": 1.4, "stroke-dasharray": "4 5" }, gNet);
    // Limite réseau
    const gLim = grp(100.8);
    svgEl("line", { x1: 1200, y1: 0, x2: 1200, y2: 600, stroke: C.iv2, "stroke-width": 1.4, "stroke-dasharray": "10 8" }, gLim);
    text(gLim, 1200, -10, "LIMITE RÉSEAU", { size: 16, fill: C.iv2, font: "JetBrains Mono", anchor: "middle", ls: 3 });
    // Extérieur
    const gExt = grp(102.2);
    text(gExt, 1240, 72, "EXTÉRIEUR", { size: 17, fill: C.mu, font: "JetBrains Mono", ls: 3 });
    [["Services d'IA en ligne", 100], ["Télémétrie, statistiques", 190], ["Journalisation externe", 280]].forEach(([s, y]) => {
      svgEl("rect", { x: 1240, y, width: 400, height: 70, rx: 12, fill: "rgba(17,29,51,0.6)", stroke: "rgba(243,239,230,0.22)", "stroke-width": 1.2 }, gExt);
      text(gExt, 1262, y + 43, s, { size: 20, fill: C.iv2 });
      const x = text(gExt, 1604, y + 45, "✕", { size: 24, fill: C.sig, weight: 600, anchor: "middle" });
    });
    const gDep = grp(104.6);
    svgEl("rect", { x: 1240, y: 384, width: 400, height: 166, rx: 12, fill: "none", stroke: "rgba(243,239,230,0.45)", "stroke-width": 1.4, "stroke-dasharray": "7 6" }, gDep);
    text(gDep, 1262, 422, "Dépendance externe identifiée", { size: 15, fill: C.ct, font: "JetBrains Mono" });
    text(gDep, 1262, 456, "Installation : application", { size: 20, weight: 500 });
    text(gDep, 1262, 482, "et modèle d'IA local", { size: 20, weight: 500 });
    text(gDep, 1262, 512, "Mises à jour : fenêtre ouverte", { size: 16, fill: C.iv2 });
    text(gDep, 1262, 534, "par le cabinet, fermée en circuit fermé", { size: 16, fill: C.iv2 });
    // Légende
    const gLeg = grp(106.0);
    svgEl("circle", { cx: 8, cy: 600, r: 6, fill: C.ct }, gLeg);
    text(gLeg, 24, 607, "Traitement local", { size: 18, fill: C.iv2 });
    text(gLeg, 230, 608, "✕", { size: 20, fill: C.sig, weight: 600 });
    text(gLeg, 256, 607, "Refusé par le garde (mode circuit fermé)", { size: 18, fill: C.iv2 });
    svgEl("line", { x1: 690, y1: 601, x2: 730, y2: 601, stroke: C.iv2, "stroke-width": 1.4, "stroke-dasharray": "7 6" }, gLeg);
    text(gLeg, 742, 607, "Dépendance externe ou service facultatif", { size: 18, fill: C.iv2 });

    // Capture réelle : l'indicateur CLOSED CIRCUIT.
    const win = makeWin(L, "captures/06-reseau-closed-circuit.png", 1440, 790, { x: 140, y: 214, w: 1040, h: 686 }, {
      cam: [[113.0, 720, 395, 0.87], [117.0, 860, 300, 1.12], [121.4, 900, 470, 1.08], [126.4, 940, 600, 1.12], [135.6, 950, 610, 1.14]],
      focus: [
        { r: [562, 284, 872, 318], a: 114.6, b: 120.6 },
        { r: [1108, 18, 1304, 46], a: 115.6, b: 120.6 },
        { r: [578, 400, 1366, 596], a: 121.4, b: 126.0 },
        { r: [560, 608, 1354, 634], a: 126.4, b: 135.4, signal: true },
      ],
    });
    const ann = [
      { k: "« CLOSED CIRCUIT » : circuit fermé", s: "Indicateur affiché par l'application, dans la barre du haut et la page Réseau.", a: 114.6 },
      { k: "Mode en cours de validation", s: "Pas encore inclus dans la version distribuée.", a: 119.0 },
      { k: "Constaté le 9 octobre 2026", s: "Environnement de test : 2 connexions de télémétrie d'une dépendance (Next.js) refusées.", a: 126.4, signal: true },
      { k: "Limites connues", s: "Processus enfants et UDP non couverts. Le pare-feu du système reste la seconde barrière.", a: 129.6 },
    ].map((n, i) => {
      const d = el("div", "annot" + (n.signal ? " signal" : ""), L, `<b class="k">${esc(n.k)}</b>${esc(n.s)}`);
      Object.assign(d.style, { left: "1240px", top: 230 + i * 166 + "px", width: "540px", fontSize: "20px" });
      return { ...n, d };
    });
    onScene("s04", (t) => {
      const outD = 1 - ramp(t, 111.8, 113.2);
      g.style.opacity = outD.toFixed(3);
      g.style.visibility = outD > 0 ? "visible" : "hidden";
      for (const it of items) it.e.style.opacity = (easeOut(ramp(t, it.a, it.a + 0.9))).toFixed(3);
      // Boucle locale : des points circulent entre l'application, le moteur et les pièces.
      dots.forEach((d, i) => {
        const ph = ((t * 0.55 + i / 3) % 1);
        const [x, y] = i === 2 ? [120, lerp(192, 400, ph)] : [215, lerp(192, 250, (ph * 2) % 1)];
        d.setAttribute("cx", x); d.setAttribute("cy", y);
        d.style.opacity = Math.sin(ph * Math.PI).toFixed(3);
      });
      // Une tentative de sortie : le paquet part, le garde le refuse.
      const cyc = (t - 95.0) % 4.0, on = t > 95.0 && t < 111.0;
      const kp = clamp(cyc / 1.4);
      packet.setAttribute("cx", lerp(380, 600, easeIO(kp)).toFixed(1));
      packet.setAttribute("cy", lerp(146, 276, easeIO(kp)).toFixed(1));
      packet.style.opacity = on ? (cyc < 1.5 ? 1 : 0) : 0;
      cross.style.opacity = on ? (Math.sin(clamp((cyc - 1.4) / 1.6) * Math.PI)).toFixed(3) : 0;

      const ow = Math.min(ramp(t, 112.6, 113.6), 1 - ramp(t, 135.4, 136.2));
      place(win.root, { o: ow, y: lerp(30, 0, easeOut(ramp(t, 112.6, 114))) });
      if (ow > 0) win.update(t);
      for (const n of ann) place(n.d, { o: env(t, n.a, 135.6, 0.8, 0.6), x: lerp(18, 0, easeOut(ramp(t, n.a, n.a + 1))) });
    });
  }

  // ───────────────────────── S05 · Démonstration ─────────────────────────
  {
    const L = layers.s05;
    const R = { x: 140, y: 150, w: 1640, h: 750 };
    const DEMO = [
      { src: "captures/01-dossier-vide-import.png", sw: 1440, sh: 900, a: 136.2, b: 147.7,
        cam: [[136.2, 720, 330, 1.14], [141.0, 560, 470, 1.32], [147.7, 560, 520, 1.36]],
        focus: [{ r: [20, 422, 1084, 655], a: 139.4, b: 147.2 }, { r: [383, 598, 722, 624], a: 142.6, b: 147.2 }] },
      { src: "captures/02-chronologie.png", sw: 1440, sh: 900, a: 147.4, b: 157.9,
        cam: [[147.4, 560, 250, 1.5], [152.0, 640, 300, 1.42], [157.9, 760, 420, 1.26]],
        focus: [{ r: [48, 181, 595, 205], a: 148.4, b: 152.4 }, { r: [800, 180, 1056, 206], a: 151.6, b: 157.4, signal: true }, { r: [692, 265, 776, 292], a: 154.2, b: 157.4 }] },
      { src: "captures/03-piece-passage.png", sw: 1440, sh: 900, a: 157.6, b: 163.7,
        cam: [[157.6, 570, 760, 1.3], [163.7, 880, 560, 1.2]],
        focus: [{ r: [214, 752, 932, 812], a: 158.2, b: 163.3 }, { r: [1082, 160, 1400, 472], a: 160.2, b: 163.3 }] },
      { src: "captures/04-arguments.png", sw: 1440, sh: 900, a: 163.4, b: 173.5,
        cam: [[163.4, 540, 300, 1.35], [168.0, 560, 420, 1.3], [173.5, 560, 560, 1.3]],
        focus: [{ r: [18, 214, 1042, 236], a: 164.4, b: 168.4 }, { r: [40, 350, 1064, 640], a: 168.4, b: 173.0 }] },
      { src: "captures/05-redaction.png", sw: 1920, sh: 1080, a: 173.2, b: 200.3,
        cam: [[173.2, 960, 420, 0.9], [177.0, 770, 680, 1.25], [182.6, 780, 690, 1.25], [184.4, 1600, 340, 1.3], [189.4, 1600, 360, 1.3], [190.8, 1640, 460, 1.3], [194.6, 1640, 460, 1.3], [196.0, 1100, 230, 1.25], [200.3, 1060, 260, 1.2]],
        focus: [{ r: [415, 657, 1118, 720], a: 175.6, b: 182.4 }, { r: [742, 692, 834, 713], a: 177.4, b: 182.4 },
                { r: [1478, 248, 1712, 318], a: 185.0, b: 190.2 }, { r: [1478, 400, 1800, 472], a: 191.0, b: 195.4 }, { r: [964, 196, 1236, 232], a: 196.4, b: 199.8 }] },
      { src: "captures/00-pupitre.png", sw: 1440, sh: 900, a: 200.0, b: 218.0,
        cam: [[200.0, 600, 450, 1.3], [206.0, 760, 420, 1.2], [211.0, 900, 450, 1.16], [217.0, 700, 330, 1.14]],
        focus: [{ r: [1082, 188, 1400, 430], a: 204.8, b: 210.8 }, { r: [1082, 462, 1400, 640], a: 211.2, b: 216.6 }] },
    ].map((d) => ({ ...d, win: makeWin(L, d.src, d.sw, d.sh, R, { cam: d.cam, focus: d.focus }) }));
    const cap = el("div", "note abs", L, "Captures réelles de l'application · recette d'octobre 2026 · dossier fictif");
    Object.assign(cap.style, { right: "140px", top: "76px", textAlign: "right" });
    onScene("s05", (t) => {
      for (const d of DEMO) {
        const o = Math.min(ramp(t, d.a, d.a + 0.5), 1 - ramp(t, d.b - 0.3, d.b + 0.2));
        place(d.win.root, { o });
        if (o > 0) d.win.update(t);
      }
      place(cap, { o: env(t, 137.0, 217.4, 1.0, 0.8) });
    });
  }

  // ───────────────────────── S06 · Vision ─────────────────────────
  {
    const L = layers.s06;
    const head1 = el("div", "kicker abs", L, "Testé en recette sur l'application construite · octobre 2026");
    Object.assign(head1.style, { left: "140px", top: "236px" });
    const head2 = el("div", "kicker abs", L, "Feuille de route · en préparation, non disponible aujourd'hui");
    Object.assign(head2.style, { left: "140px", top: "636px", color: "var(--muted)" });
    const SOLID = [
      ["Import des pièces", "PDF, Word, images, courriels"], ["Chronologie", "dates contradictoires signalées"],
      ["Provenance", "pièce, page et passage d'origine"], ["Arguments", "fondement, preuves, fragilités"],
      ["Rédaction", "sept types d'actes, faits sourcés"], ["Export", "Word et PDF"],
      ["Sauvegarde", "du cabinet, horodatée"], ["Licence", "vérifiée sur le poste, sans connexion"],
    ];
    const FUTUR = [
      ["Fonctions IA locales", "qualité en cours de validation"], ["Circuit fermé", "mode en cours de validation"],
      ["Mises à jour automatiques", "prévues"], ["Windows", "à valider sur un poste réel"],
    ];
    const cw = (1640 - 3 * 24) / 4;
    const tiles = [];
    SOLID.forEach(([t1, s], i) => {
      const d = el("div", "tile", L, `<span class="ok"></span><div class="t">${esc(t1)}</div><div class="s">${esc(s)}</div>`);
      Object.assign(d.style, { left: 140 + (i % 4) * (cw + 24) + "px", top: 282 + Math.floor(i / 4) * 164 + "px", width: cw + "px", height: "140px" });
      tiles.push({ d, a: 219.6 + i * 0.42 });
    });
    FUTUR.forEach(([t1, s], i) => {
      const d = el("div", "tile futur", L, `<span class="tag">À VENIR</span><div class="t">${esc(t1)}</div><div class="s">${esc(s)}</div>`);
      Object.assign(d.style, { left: 140 + i * (cw + 24) + "px", top: "682px", width: cw + "px", height: "140px" });
      tiles.push({ d, a: 233.0 + i * 0.5, futur: true });
    });
    onScene("s06", (t) => {
      place(head1, { o: env(t, 219.2, 249.6, 0.8, 0.6) });
      place(head2, { o: env(t, 232.6, 249.6, 0.8, 0.6) });
      for (const ti of tiles) {
        const k = easeOut(ramp(t, ti.a, ti.a + 0.9));
        const pulse = ti.futur ? 0.75 + 0.25 * Math.sin(Math.max(0, t - 240) * 1.6) : 1;
        place(ti.d, { o: k * (1 - ramp(t, 249.0, 250.2)) * pulse, y: lerp(24, 0, k) });
      }
    });
  }

  // ───────────────────────── S07 · L'offre ─────────────────────────
  {
    const L = layers.s07;
    const R = { x: 800, y: 176, w: 980, h: 724 };
    const SITE = [
      { src: "site/home-full.png", sw: 1920, sh: 11656, a: 250.2, b: 259.6, cam: [[250.2, 960, 380, 0.62], [253.0, 960, 380, 0.62], [259.6, 960, 860, 0.62]], focus: [] },
      { src: "site/securite.png", sw: 1920, sh: 1080, a: 259.3, b: 266.6, cam: [[259.3, 960, 520, 0.56], [266.6, 960, 560, 0.62]], focus: [] },
      { src: "site/tarifs.png", sw: 1920, sh: 1080, a: 266.3, b: 278.0, cam: [[266.3, 960, 540, 0.56], [269.6, 760, 470, 0.74], [278.0, 760, 500, 0.74]],
        focus: [{ r: [302, 390, 928, 418], a: 268.8, b: 277.2 }] },
    ].map((d) => ({ ...d, win: makeWin(L, d.src, d.sw, d.sh, R, { url: "sigille.fr", cam: d.cam, focus: d.focus }) }));
    const note = el("div", "note abs", L, "Site sigille.fr<br>même code que la version en ligne<br>(déploiement du 4 octobre 2026)");
    Object.assign(note.style, { left: "140px", top: "640px", lineHeight: "1.7" });
    onScene("s07", (t) => {
      for (const d of SITE) {
        const o = Math.min(ramp(t, d.a, d.a + 0.5), 1 - ramp(t, d.b - 0.3, d.b + 0.2));
        place(d.win.root, { o, y: lerp(26, 0, easeOut(ramp(t, 250.0, 251.6))) });
        if (o > 0) d.win.update(t);
      }
      place(note, { o: env(t, 251.4, 277.6, 0.8, 0.6) });
    });
  }

  // ───────────────────────── S08 · Clôture ─────────────────────────
  {
    const L = layers.s08;
    const holder = el("div", "abs", L);
    const mark = makeMark(holder, 190);
    Object.assign(holder.style, { left: (W - mark.w) / 2 + "px", top: "250px" });
    const url = el("div", "abs", L, "sigille.fr");
    Object.assign(url.style, { left: 0, width: W + "px", textAlign: "center", top: "748px", font: "500 30px var(--mono)", letterSpacing: "0.12em", color: "var(--cobalt-text)" });
    const cta = el("div", "cta", L, "DÉCOUVRIR SIGILLE");
    const ctaW = 420;
    Object.assign(cta.style, { left: (W - ctaW) / 2 + "px", width: ctaW + "px", textAlign: "center", top: "818px" });
    const black = el("div", "abs", stage);
    Object.assign(black.style, { left: 0, top: 0, width: W + "px", height: H + "px", background: "#000", zIndex: 50 });
    onScene("s08", (t) => {
      mark.set(ramp(t, 278.2, 281.0), ramp(t, 280.4, 281.8));
      place(holder, { o: 1 });
      place(url, { o: easeOut(ramp(t, 287.6, 288.8)), y: lerp(10, 0, easeOut(ramp(t, 287.6, 289))) });
      place(cta, { o: easeOut(ramp(t, 288.4, 289.6)), y: lerp(10, 0, easeOut(ramp(t, 288.4, 289.8))) });
    });
    updaters.push({ id: null, fn: (t) => { black.style.opacity = Math.max(1 - ramp(t, 0, 0.6), ramp(t, 298.4, 299.9)).toFixed(3); } });
  }

  const vig = el("div", "vignette", stage);
  vig.style.zIndex = 40;

  // ───────────────────────── boucle de rendu ─────────────────────────
  function render(t) {
    for (const s of F.scenes) {
      const o = Math.min(ramp(t, s.debut - 0.05, s.debut + 0.7), 1 - ramp(t, s.fin - 0.1, s.fin + 0.6));
      const l = layers[s.id];
      l.style.opacity = o.toFixed(3);
      l.style.display = o > 0 ? "block" : "none";
    }
    for (const u of updaters) {
      if (u.id) {
        const s = scene(u.id);
        if (t < s.debut - 0.6 || t > s.fin + 0.8) continue;
      }
      u.fn(t);
    }
    updateTexts(t);
    updateSweep(t);
  }

  window.ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
    fitTexts();
    render(0);
    return true;
  })();
  window.render = render;
})();
