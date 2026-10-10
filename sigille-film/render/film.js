/* SIGILLE · film de lancement v2 · moteur de scènes.
 *
 * window.render(t) dessine l'image de l'instant t. Le minutage vient de data.js : chaque plan est
 * accroché aux répliques de la voix (R("n05").start …), donc l'image suit la voix réelle.
 *
 * Matière : fragments RÉELS de l'interface (render/assets/frag, découpés par tools/fragments.py dans
 * les captures de recette, sans retouche). Le film les isole, les agrandit, les relie.
 * Signature visuelle : le fil de preuve, un trait cobalt qui relie un fait à sa pièce et devient
 * le cercle du symbole SIGILLE.
 */
(() => {
  const F = window.FILM, FR = window.FRAG;
  const W = 1920, H = 1080;
  const stage = document.getElementById("stage");

  // ── outils ──
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const io = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const out = (k) => 1 - Math.pow(1 - k, 3);
  const outQ = (k) => 1 - Math.pow(1 - k, 5);
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const env = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(out(ramp(t, a, a + fi)), 1 - io(ramp(t, b - fo, b)));
  const R = (id) => F.repliques.find((r) => r.id === id);
  const S = (id) => F.scenes.find((s) => s.id === id);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function show(e, o, x = 0, y = 0, s = 1, extra = "") {
    e.style.opacity = o.toFixed(4);
    e.style.visibility = o <= 0.002 ? "hidden" : "visible";
    e.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)}) ${extra}`;
  }
  function pos(e, x, y) { e.style.left = x + "px"; e.style.top = y + "px"; }

  // Symbole officiel (website/components/Logo.tsx), géométrie inchangée.
  const MARK_PATH =
    "M870,861L829,820L804,799L771,774L769,778L767,813L761,841L744,886L729,911L699,950L672,975L648,992L627,1004L594,1019L565,1028L525,1036L426,1038L371,1045L337,1053L297,1067L253,1088L220,1109L194,1128L178,1141L152,1167L116,1212L100,1235L91,1251L66,1303L55,1344L52,1351L42,1395L40,1429L39,1430L39,1516L555,1517L556,1516L581,1515L636,1505L679,1492L703,1482L740,1463L773,1443L804,1420L827,1399L863,1360L889,1323L903,1298L925,1251L937,1215L948,1169L948,1162L952,1139L952,1059L946,1020L939,992L929,962L908,918L891,890ZM457,628L430,635L404,649L388,660L368,682L356,704L347,732L344,753L344,773L346,787L353,812L365,836L376,850L394,867L417,881L440,890L461,894L502,893L526,886L549,875L567,862L592,835L605,809L612,782L612,746L609,723L597,692L580,670L556,649L528,635L499,628ZM906,0L383,0L373,2L364,2L320,10L281,22L245,36L203,58L178,74L138,106L97,149L80,171L62,198L31,257L14,308L4,356L1,404L0,405L0,436L5,481L14,523L30,571L46,604L64,634L86,663L140,715L180,745L189,748L191,722L197,691L208,655L221,628L235,605L251,584L285,551L319,526L352,509L379,499L403,493L437,488L533,485L569,480L607,471L655,455L693,437L733,412L767,385L796,357L820,329L848,288L870,246L886,206L899,159L906,110Z";

  /** Symbole : tracé (cercle d'abord, puis les deux lames) puis remplissage. */
  function makeMark(parent, h, color = "#ffffff") {
    const w = (953 / 1518) * h;
    const svg = svgEl("svg", { width: w, height: h, viewBox: "-20 -20 993 1558" });
    svg.style.position = "absolute";
    parent.appendChild(svg);
    const parts = MARK_PATH.split(/(?=M)/).filter(Boolean);
    const strokes = parts.map((d) => svgEl("path", { d, fill: "none", stroke: color, "stroke-width": 9, "stroke-linejoin": "round" }, svg));
    const fill = svgEl("path", { d: MARK_PATH, fill: color, "fill-rule": "evenodd" }, svg);
    const lens = strokes.map((p) => p.getTotalLength());
    strokes.forEach((p, i) => p.setAttribute("stroke-dasharray", `${lens[i]} ${lens[i]}`));
    return {
      svg, w, h,
      set(kTrace, kFill) {
        [1, 0, 2].forEach((idx, n) => {
          const k = io(clamp(kTrace * 3 - n * 0.85, 0, 1));
          strokes[idx].setAttribute("stroke-dashoffset", (lens[idx] * (1 - k)).toFixed(1));
          strokes[idx].style.opacity = (1 - kFill).toFixed(3);
        });
        fill.style.opacity = io(kFill).toFixed(3);
      },
    };
  }

  /** Fragment réel d'interface, placé en (x, y) à l'échelle s. pt(u, v) → coordonnées scène d'un point du fragment. */
  function frag(parent, name, x, y, s, cls = "") {
    const [fw, fh] = FR[name];
    const d = el("div", "frag " + cls, parent);
    const img = el("img", "", d);
    img.src = `assets/frag/${name}.png`;
    Object.assign(d.style, { left: x + "px", top: y + "px", width: fw + "px", height: fh + "px" });
    const f = { d, x, y, s, fw, fh, dx: 0, dy: 0, sc: 1, marks: [] };
    f.pt = (u, v) => [f.x + f.dx + u * f.s * f.sc, f.y + f.dy + v * f.s * f.sc];
    f.set = (o, dx = 0, dy = 0, sc = 1) => {
      Object.assign(f, { dx, dy, sc });
      show(d, o, dx, dy, s * sc);
      for (const m of f.marks) m.upd(o);
    };
    /** Repère sur une zone du fragment (coordonnées du fragment), visible entre a et b. */
    f.mark = (box, a, b, signal = false) => {
      const m = el("div", "mark" + (signal ? " signal" : ""), parent);
      const mk = { box, a, b, m, t: 0 };
      mk.upd = (o) => {
        const k = env(mk.t, a, b, 0.35, 0.35) * o;
        const [x0, y0] = f.pt(box[0], box[1]), [x1, y1] = f.pt(box[2], box[3]);
        const p = 6;
        Object.assign(m.style, { left: x0 - p + "px", top: y0 - p + "px", width: x1 - x0 + 2 * p + "px", height: y1 - y0 + 2 * p + "px" });
        m.style.opacity = k.toFixed(3); m.style.visibility = k > 0.002 ? "visible" : "hidden";
        m.style.transform = `scale(${lerp(1.06, 1, out(ramp(mk.t, a, a + 0.4))).toFixed(3)})`;
      };
      f.marks.push(mk);
      return mk;
    };
    f.tick = (t) => { for (const m of f.marks) m.t = t; };
    return f;
  }

  /** Fil de preuve : courbe tracée progressivement entre deux points (avec deux points d'ancrage). */
  function thread(svg, color = "#004aad", width = 2.5) {
    const p = svgEl("path", { fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round" }, svg);
    const c0 = svgEl("circle", { r: 5, fill: color }, svg);
    const c1 = svgEl("circle", { r: 5, fill: color }, svg);
    return (a, b, k, o = 1, bend = 0.45) => {
      const [x0, y0] = a, [x1, y1] = b;
      const mx = (x0 + x1) / 2;
      const d = Math.abs(y1 - y0) > Math.abs(x1 - x0)
        ? `M${x0},${y0} C${x0},${lerp(y0, y1, bend)} ${x1},${lerp(y1, y0, bend)} ${x1},${y1}`
        : `M${x0},${y0} C${lerp(x0, mx, 1)},${y0} ${lerp(x1, mx, 1)},${y1} ${x1},${y1}`;
      p.setAttribute("d", d);
      const L = p.getTotalLength();
      p.setAttribute("stroke-dasharray", `${L} ${L}`);
      p.setAttribute("stroke-dashoffset", (L * (1 - io(k))).toFixed(1));
      for (const [c, on] of [[c0, k > 0.01], [c1, k > 0.98]]) { c.style.opacity = on ? o : 0; }
      c0.setAttribute("cx", x0); c0.setAttribute("cy", y0); c1.setAttribute("cx", x1); c1.setAttribute("cy", y1);
      p.style.opacity = o;
    };
  }

  function overlay(parent) {
    const s = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    Object.assign(s.style, { position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none" });
    parent.appendChild(s);
    return s;
  }
  function chap(parent, n, t) { return el("div", "chap", parent, `<span class="n">${n}</span><span class="t">${esc(t)}</span>`); }
  function mention(parent, txt = "Interface réelle · dossier fictif de recette") { return el("div", "mention", parent, esc(txt)); }
  function enonce(parent, html, x, y, size, opts = {}) {
    const e = el("div", "enonce", parent, html);
    Object.assign(e.style, { left: x + "px", top: y + "px", fontSize: size + "px", ...(opts.w ? { width: opts.w + "px" } : {}), ...(opts.align ? { textAlign: opts.align } : {}) });
    return e;
  }

  // ── calques de scènes ──
  const layers = {}, updaters = [];
  for (const s of F.scenes) {
    const l = el("div", "layer " + s.fond, stage);
    layers[s.id] = l;
  }
  const on = (id, fn) => updaters.push({ id, fn });

  // ══ C00 · Ouverture : la contradiction ══
  {
    const L = layers.c00, n01 = R("n01"), n02 = R("n02"), n03 = R("n03"), sc = S("c00");
    const A = frag(L, "chrono-evenement1", 160, 300, 1.55);
    const B = frag(L, "piece-passage", 700, 560, 1.45);
    const refA = el("div", "legende", L, "Chronologie du dossier"); pos(refA, 160, 258);
    const refB = frag(L, "piece-reference", 700, 520, 1.6, "nu");
    // dates contradictoires dans chaque fragment (coordonnées du fragment)
    A.mark([168, 28, 264, 52], n01.start + 1.5, n03.start + 0.6, true);
    B.mark([403, 3, 562, 33], n01.start + 1.5, n03.start + 0.6, true);
    const ov = overlay(L), th = thread(ov, "#c2410c", 2.5);
    const neq = el("div", "abs", L, "≠");
    Object.assign(neq.style, { font: "400 64px var(--serif)", color: "var(--signal)", zIndex: 7 });
    const q = enonce(L, "Une date fausse<br><em>ne se voit pas.</em>", 160, 330, 104);
    const ment = mention(L);
    on("c00", (t) => {
      const kA = outQ(ramp(t, n01.start - 0.9, n01.start + 0.2)), kB = outQ(ramp(t, n01.start + 0.5, n01.start + 1.4));
      const leave = io(ramp(t, n03.start - 0.2, n03.start + 0.7));
      const push = lerp(1, 1.04, ramp(t, 0, n03.start));
      A.tick(t); B.tick(t);
      A.set(kA * (1 - leave), lerp(-60, 0, kA) - leave * 80, 0, push);
      B.set(kB * (1 - leave), lerp(60, 0, kB) + leave * 80, 0, push);
      show(refA, kA * (1 - leave), 0, lerp(10, 0, kA));
      refB.set(kB * (1 - leave));
      const kt = ramp(t, n01.start + 1.6, n01.start + 2.6);
      th(A.pt(216, 52), B.pt(482, 3), kt, 1 - leave, 0.5);
      const [mx, my] = [(A.pt(216, 52)[0] + B.pt(482, 3)[0]) / 2, (A.pt(216, 52)[1] + B.pt(482, 3)[1]) / 2];
      pos(neq, mx + 18, my - 52);
      show(neq, out(ramp(t, n01.start + 2.4, n01.start + 2.9)) * (1 - leave));
      show(q, env(t, n03.start + 0.4, sc.fin + 0.2, 0.8, 0.5), 0, lerp(20, 0, out(ramp(t, n03.start + 0.4, n03.start + 1.4))));
      show(ment, env(t, 0.6, n03.start + 0.4, 0.8, 0.5));
    });
  }

  // ══ C01 · Titre : le sceau ══
  {
    const L = layers.c01, n04 = R("n04"), sc = S("c01");
    const holder = el("div", "abs", L);
    const mk = makeMark(holder, 230);
    pos(holder, (W - mk.w) / 2, 240);
    const word = el("div", "abs", L, "SIGILLE");
    Object.assign(word.style, { left: 0, width: W + "px", textAlign: "center", top: "520px", font: "500 44px var(--sans)", letterSpacing: ".6em", paddingLeft: ".6em" });
    const tag = enonce(L, "Chaque fait, <em>sa pièce.</em>", 0, 610, 64, { w: W, align: "center" });
    on("c01", (t) => {
      mk.set(ramp(t, sc.debut + 0.1, sc.debut + 1.6), ramp(t, sc.debut + 1.3, sc.debut + 2.2));
      const kw = out(ramp(t, sc.debut + 1.4, sc.debut + 2.6));
      show(word, kw); word.style.letterSpacing = lerp(0.95, 0.6, kw).toFixed(3) + "em";
      show(tag, out(ramp(t, n04.start + 2.0, n04.start + 3.0)), 0, lerp(14, 0, out(ramp(t, n04.start + 2.0, n04.start + 3.2))));
      show(holder, 1, 0, lerp(0, -8, ramp(t, sc.debut, sc.fin)));
    });
  }

  // ══ C02 · Importer ══
  {
    const L = layers.c02, n05 = R("n05"), n06 = R("n06"), sc = S("c02");
    chap(L, "01", "Importer"); const ment = mention(L);
    const head = frag(L, "import-entete", 240, 150, 1.45);
    const zone = frag(L, "import-zone", 240, 300, 1.3);
    const cards = ["import-carte1", "import-carte2", "import-carte3"].map((n, i) => frag(L, n, 240 + i * 478, 680, 1.25));
    zone.mark([363, 174, 704, 204], n06.start + 0.2, sc.fin - 0.2);
    head.mark([2, 44, 520, 82], n06.start + 1.4, sc.fin - 0.2);
    on("c02", (t) => {
      const k1 = outQ(ramp(t, sc.debut + 0.3, sc.debut + 1.2));
      [head, zone, ...cards].forEach((f) => f.tick(t));
      head.set(k1, 0, lerp(30, 0, k1));
      const k2 = outQ(ramp(t, sc.debut + 0.7, sc.debut + 1.7));
      zone.set(k2, 0, lerp(40, 0, k2), lerp(0.97, 1, k2));
      cards.forEach((c, i) => { const k = outQ(ramp(t, n05.start + 1.0 + i * 0.35, n05.start + 1.9 + i * 0.35)); c.set(k, 0, lerp(50, 0, k)); });
      show(ment, env(t, sc.debut + 0.4, sc.fin + 0.4, 0.6, 0.4));
    });
  }

  // ══ C03 + C04 · Comprendre, puis vérifier (même plan, continuité) ══
  {
    const L3 = layers.c03, L4 = layers.c04, n07 = R("n07"), n08 = R("n08"), n09 = R("n09"), n10 = R("n10");
    const s3 = S("c03"), s4 = S("c04");
    // Les deux scènes partagent les mêmes fragments : on les place dans c03 et on prolonge le calque.
    const L = L3; L4.style.background = "transparent";
    const c3 = chap(L, "02", "Comprendre"); const c4 = chap(L, "03", "Vérifier"); const ment = mention(L);
    const title = frag(L, "chrono-titre", 160, 140, 1.6);
    const rows = frag(L, "chrono-lignes", 160, 290, 1.15);
    const ctx = frag(L, "chrono-contexte", 1384, 290, 1.17);
    const alert = frag(L, "chrono-alerte", 1384, 196, 1.43);
    // provenance : colonne des pièces sources
    [[645, 50, 728, 76], [645, 157, 728, 183], [645, 290, 728, 316], [645, 398, 728, 424]].forEach((b, i) =>
      rows.mark(b, n08.start + 0.3 + i * 0.25, s3.fin + 0.3));
    title.mark([438, 44, 548, 62], n08.start + 2.3, s3.fin + 0.2);
    // contradictions : colonne état, liens « autre date »
    [[872, 46, 1000, 86], [872, 153, 1000, 193], [872, 286, 1000, 326], [872, 394, 1000, 434]].forEach((b, i) =>
      rows.mark(b, n09.start + 0.4 + i * 0.22, s4.fin - 0.1, true));
    [[244, 102, 404, 122], [244, 234, 412, 254], [244, 340, 412, 360]].forEach((b, i) =>
      rows.mark(b, n10.start + 0.2 + i * 0.25, s4.fin - 0.1));
    ctx.mark([16, 58, 226, 76], n09.start + 1.6, s4.fin - 0.1, true);
    // la scène c04 n'a pas de calque propre : on rend c03 visible jusqu'à la fin de c04
    on("c03", (t) => {
      [title, rows, ctx, alert].forEach((f) => f.tick(t));
      const k1 = outQ(ramp(t, s3.debut + 0.2, s3.debut + 1.1));
      title.set(k1, 0, lerp(24, 0, k1));
      // révélation des lignes de haut en bas
      const kr = io(ramp(t, n07.start + 0.2, n07.start + 2.2));
      rows.set(outQ(ramp(t, s3.debut + 0.5, s3.debut + 1.3)), 0, 0);
      rows.d.style.clipPath = `inset(0 0 ${((1 - kr) * 100).toFixed(2)}% 0 round 12px)`;
      const kc = outQ(ramp(t, n08.start, n08.start + 0.9));
      ctx.set(kc, lerp(40, 0, kc), 0);
      const ka = outQ(ramp(t, n09.start + 0.1, n09.start + 0.8));
      alert.set(ka, 0, lerp(-16, 0, ka), lerp(1.12, 1, ka));
      // légère avancée de caméra pendant « Vérifier »
      const kz = io(ramp(t, n09.start, s4.fin));
      L.style.transform = `scale(${lerp(1, 1.035, kz).toFixed(4)})`; L.style.transformOrigin = "60% 45%";
      show(c3, env(t, s3.debut + 0.2, n09.start, 0.5, 0.4));
      show(c4, env(t, n09.start, s4.fin, 0.5, 0.3));
      show(ment, env(t, s3.debut + 0.3, s4.fin, 0.5, 0.3));
    });
    on("c04", () => {});
    layers.c03._extend = s4.fin; // voir render()
  }

  // ══ C05 · Remonter à la source ══
  {
    const L = layers.c05, n11 = R("n11"), sc = S("c05");
    chap(L, "04", "Remonter à la source"); const ment = mention(L);
    const head = frag(L, "piece-entete", 160, 140, 1.2);
    const body = frag(L, "piece-texte", 160, 330, 1.08);
    const panel = frag(L, "piece-panneau", 1356, 300, 1.25);
    body.mark([104, 370, 824, 434], n11.start + 2.0, sc.fin - 0.1);
    head.mark([2, 2, 160, 22], n11.start + 1.3, sc.fin - 0.1);
    const ov = overlay(L), th = thread(ov);
    on("c05", (t) => {
      [head, body, panel].forEach((f) => f.tick(t));
      const k = outQ(ramp(t, sc.debut + 0.1, sc.debut + 0.9));
      head.set(k, 0, lerp(-20, 0, k));
      // la pièce s'ouvre : léger zoom arrière
      const kb = outQ(ramp(t, sc.debut + 0.3, sc.debut + 1.4));
      body.set(kb, 0, lerp(30, 0, kb), lerp(1.06, 1, kb));
      const kp = outQ(ramp(t, n11.start + 0.6, n11.start + 1.4));
      panel.set(kp, lerp(50, 0, kp), 0);
      // fil : du passage cité dans la rédaction (panneau) au passage exact dans la pièce
      th(panel.pt(12, 90), body.pt(824, 400), ramp(t, n11.start + 2.1, n11.start + 3.2));
      show(ment, env(t, sc.debut + 0.3, sc.fin + 0.4, 0.5, 0.4));
    });
  }

  // ══ C06 · Argumenter ══
  {
    const L = layers.c06, n12 = R("n12"), n13 = R("n13"), sc = S("c06");
    chap(L, "05", "Argumenter"); const ment = mention(L);
    const title = frag(L, "args-titre", 160, 140, 1.4);
    const note = frag(L, "args-note", 160, 248, 1.4);
    const table = frag(L, "args-table", 160, 312, 1.04);
    table.mark([603, 86, 732, 492], n12.start + 1.4, sc.fin - 0.1, true);
    note.mark([610, 2, 853, 24], n13.start + 0.1, sc.fin - 0.1);
    on("c06", (t) => {
      [title, note, table].forEach((f) => f.tick(t));
      const k = outQ(ramp(t, sc.debut + 0.1, sc.debut + 0.9));
      title.set(k, 0, lerp(-20, 0, k));
      const kt = outQ(ramp(t, sc.debut + 0.4, sc.debut + 1.4));
      table.set(kt, 0, lerp(40, 0, kt));
      table.d.style.clipPath = `inset(0 0 ${((1 - io(ramp(t, sc.debut + 0.5, n12.start + 1.5))) * 100).toFixed(2)}% 0 round 12px)`;
      const kn = outQ(ramp(t, n13.start - 0.3, n13.start + 0.4));
      note.set(kn, 0, lerp(-12, 0, kn));
      show(ment, env(t, sc.debut + 0.3, sc.fin + 0.4, 0.5, 0.4));
    });
  }

  // ══ C07 · Rédiger, relire, exporter ══
  {
    const L = layers.c07, n14 = R("n14"), n15 = R("n15"), n16 = R("n16"), sc = S("c07");
    chap(L, "06", "Rédiger"); const ment = mention(L);
    const head = frag(L, "redac-entete", 160, 140, 1.2);
    const paras = frag(L, "redac-paragraphes", 160, 300, 1.42);
    const panel = frag(L, "redac-panneau", 1296, 280, 1.4);
    const src = frag(L, "piece-passage", 300, 760, 1.0);
    const srcRef = frag(L, "piece-reference", 300, 726, 1.3, "nu");
    const exp = frag(L, "redac-export", 160, 760, 1.55);
    paras.mark([412, 218, 514, 240], n14.start + 0.8, n15.start + 0.2);
    src.mark([403, 3, 562, 33], n14.start + 2.0, n15.start + 0.2);
    panel.mark([14, 236, 340, 308], n15.start + 0.3, n16.start - 0.1);
    panel.mark([14, 82, 252, 156], n15.start + 3.1, n16.start + 0.2);
    exp.mark([86, 2, 362, 42], n16.start + 0.9, sc.fin - 0.1);
    const ov = overlay(L), th = thread(ov);
    on("c07", (t) => {
      [head, paras, panel, src, exp].forEach((f) => f.tick(t));
      const k = outQ(ramp(t, sc.debut + 0.1, sc.debut + 0.9));
      head.set(k, 0, lerp(-20, 0, k));
      const kp = outQ(ramp(t, sc.debut + 0.3, sc.debut + 1.3));
      paras.set(kp, 0, lerp(30, 0, kp));
      // le fait cité → sa pièce
      const ks = outQ(ramp(t, n14.start + 1.2, n14.start + 2.0)) * (1 - io(ramp(t, n15.start, n15.start + 0.5)));
      src.set(ks, 0, lerp(30, 0, ks)); srcRef.set(ks);
      th(paras.pt(463, 240), src.pt(482, 3), ramp(t, n14.start + 1.3, n14.start + 2.3) , 1 - io(ramp(t, n15.start, n15.start + 0.5)), 0.5);
      const kpa = outQ(ramp(t, n15.start - 0.2, n15.start + 0.6));
      panel.set(kpa, lerp(60, 0, kpa), 0);
      const ke = outQ(ramp(t, n16.start + 0.2, n16.start + 1.0));
      exp.set(ke, 0, lerp(30, 0, ke));
      show(ment, env(t, sc.debut + 0.3, sc.fin + 0.4, 0.5, 0.4));
    });
  }

  // ══ C07b · Montage : un seul espace de travail ══
  {
    const L = layers.c07b, sc = S("c07b");
    const shots = ["00-pupitre", "01-dossier-vide-import", "02-chronologie", "03-piece-passage", "04-arguments", "05-redaction"];
    const dims = { "05-redaction": [1920, 1080] };
    const wins = shots.map((s) => {
      const [iw, ih] = dims[s] || [1440, 900];
      const w = el("div", "win", L);
      Object.assign(w.style, { left: "330px", top: "150px", width: "1260px", height: "760px" });
      const img = el("img", "", w); img.src = `assets/captures/${s}.png`;
      const z = Math.max(1260 / iw, 760 / ih);
      img.style.transform = `scale(${z})`;
      return w;
    });
    const titre = enonce(L, "Un seul espace<br>de <em>travail.</em>", 160, 380, 76);
    const fl = el("div", "flash", L);
    on("c07b", (t) => {
      const n = shots.length, d = (sc.fin - sc.debut - 1.6) / n;
      wins.forEach((w, i) => {
        const a = sc.debut + 0.2 + i * d;
        const o = Math.min(ramp(t, a, a + 0.12), 1 - ramp(t, a + d, a + d + 0.12));
        const k = ramp(t, a, a + d);
        show(w, o * (t < sc.fin - 1.3 ? 1 : 0), lerp(30, -30, k), 0, lerp(1.02, 0.98, k), `perspective(1800px) rotateY(${lerp(-10, -6, k).toFixed(2)}deg)`);
      });
      show(fl, 0.5 * Math.max(0, 1 - Math.abs(t - (sc.fin - 1.3)) * 8));
      show(titre, env(t, sc.fin - 1.25, sc.fin + 0.3, 0.3, 0.3));
    });
  }

  // ══ C08 · Confidentialité ══
  {
    const L = layers.c08, n17 = R("n17"), n18 = R("n18"), n19 = R("n19"), n20 = R("n20"), sc = S("c08");
    chap(L, "07", "Confidentialité");
    const ov = overlay(L);
    // le poste : cercle du sceau ; les sorties s'arrêtent à sa limite
    const cx = 520, cy = 560, r = 230;
    const ring = svgEl("circle", { cx, cy, r, fill: "none", stroke: "#5b8fe0", "stroke-width": 2.5 }, ov);
    const ringL = 2 * Math.PI * r;
    ring.setAttribute("stroke-dasharray", `${ringL} ${ringL}`);
    const lab = el("div", "legende", L, "<b>Votre poste</b><br>pièces, index, moteur local"); pos(lab, cx - 120, cy - 34);
    lab.style.textAlign = "center"; lab.style.width = "240px";
    const rays = [-50, -15, 20, 55].map((a) => {
      const rad = (a * Math.PI) / 180;
      const line = svgEl("line", { stroke: "#cfc9bd", "stroke-width": 1.6, "stroke-dasharray": "6 6" }, ov);
      const x = svgEl("text", { fill: "#e06a32", "font-family": "Onest", "font-size": 30, "font-weight": 600, "text-anchor": "middle" }, ov);
      x.textContent = "✕";
      return { rad, line, x };
    });
    const v1 = enonce(L, "Vos dossiers restent<br><em>sur votre poste.</em>", 160, 150, 56);
    const ind = frag(L, "reseau-indicateur", 1000, 250, 2.0);
    const etat = frag(L, "reseau-etat", 1000, 360, 0.98);
    ind.mark([4, 4, 204, 32], n18.start + 2.4, n19.start + 0.2);
    etat.mark([2, 324, 800, 356], n19.start + 0.3, sc.fin - 0.1, true);
    const note = el("div", "legende", L, "Mode en cours de validation, pas encore dans la version distribuée.<br>Essai du 9 octobre 2026, environnement de test : 2 connexions de télémétrie<br>d'une dépendance refusées. Limites connues : processus enfants, UDP ;<br>le pare-feu du système reste la seconde barrière.");
    pos(note, 1000, 790); note.style.fontSize = "15px";
    on("c08", (t) => {
      [ind, etat].forEach((f) => f.tick(t));
      ring.setAttribute("stroke-dashoffset", (ringL * (1 - io(ramp(t, sc.debut + 0.2, n17.start + 1.4)))).toFixed(1));
      show(lab, out(ramp(t, n17.start + 0.4, n17.start + 1.2)));
      show(v1, env(t, n17.start - 0.2, sc.fin, 0.6, 0.4), 0, lerp(16, 0, out(ramp(t, n17.start - 0.2, n17.start + 0.8))));
      rays.forEach((ry, i) => {
        const a0 = n18.start + 0.6 + i * 0.5;
        const k = io(clamp((t - a0) / 0.9));
        const x0 = cx + Math.cos(ry.rad) * 70, y0 = cy + Math.sin(ry.rad) * 70;
        const xe = cx + Math.cos(ry.rad) * r, ye = cy + Math.sin(ry.rad) * r;
        ry.line.setAttribute("x1", x0); ry.line.setAttribute("y1", y0);
        ry.line.setAttribute("x2", lerp(x0, xe, k)); ry.line.setAttribute("y2", lerp(y0, ye, k));
        ry.line.style.opacity = t > a0 ? 1 : 0;
        ry.x.setAttribute("x", xe + Math.cos(ry.rad) * 22); ry.x.setAttribute("y", ye + Math.sin(ry.rad) * 22 + 10);
        ry.x.style.opacity = out(ramp(t, a0 + 0.85, a0 + 1.1));
      });
      const ki = outQ(ramp(t, n18.start + 2.0, n18.start + 2.8));
      ind.set(ki, lerp(30, 0, ki), 0);
      const ke = outQ(ramp(t, n18.start + 2.8, n18.start + 3.8));
      etat.set(ke, lerp(30, 0, ke), 0);
      show(note, env(t, n19.start + 0.8, sc.fin, 0.6, 0.4));
    });
  }

  // ══ C09 · Signature ══
  {
    const L = layers.c09, n21 = R("n21"), n22 = R("n22"), sc = S("c09");
    const holder = el("div", "abs", L);
    const mk = makeMark(holder, 150);
    pos(holder, (W - mk.w) / 2, 200);
    const words = ["Précision", "Traçabilité", "Confidentialité", "Sources affichées"].map((w) => {
      const e = el("div", "mot", L, esc(w)); return e;
    });
    const xs = [375, 765, 1155, 1545];   // centrés sur 960
    // répartition calée sur la diction de n21 (4 groupes, durées proportionnelles aux mots)
    const parts = [1, 1.25, 1.45, 2.2], tot = parts.reduce((a, b) => a + b, 0);
    const human = enonce(L, "L'humain <em>décide.</em>", 0, 640, 92, { w: W, align: "center" });
    on("c09", (t) => {
      mk.set(1, 1);
      show(holder, env(t, sc.debut, sc.fin, 0.5, 0.4));
      let acc = n21.start;
      words.forEach((e, i) => {
        const a = acc; acc += (parts[i] / tot) * n21.duree;
        e.style.left = xs[i] - 160 + "px"; e.style.width = "320px"; e.style.textAlign = "center"; e.style.top = "480px";
        e.style.fontSize = "22px";
        const k = outQ(ramp(t, a - 0.1, a + 0.5));
        show(e, k * (1 - io(ramp(t, n22.start + 1.2, n22.start + 1.8))), 0, lerp(14, 0, k));
      });
      show(human, env(t, n22.start + 1.3, sc.fin + 0.3, 0.6, 0.4), 0, lerp(16, 0, out(ramp(t, n22.start + 1.3, n22.start + 2.2))));
    });
  }

  // ══ C10 · Appel à l'action ══
  {
    const L = layers.c10, n23 = R("n23"), n24 = R("n24"), n25 = R("n25"), sc = S("c10");
    const w = el("div", "win", L);
    Object.assign(w.style, { left: "360px", top: "120px", width: "1200px", height: "700px" });
    el("div", "bar", w, "<i></i><i></i><i></i><span>sigille.fr</span>");
    const img = el("img", "", w); img.src = "assets/site/home.png";
    const z0 = 1200 / 1920;
    const btn = el("div", "mark", w); btn.style.zIndex = 3;
    const holder = el("div", "abs", L);
    const mk = makeMark(holder, 130);
    pos(holder, (W - mk.w) / 2, 210);
    const word = el("div", "abs", L, "SIGILLE");
    Object.assign(word.style, { left: 0, width: W + "px", textAlign: "center", top: "372px", font: "500 36px var(--sans)", letterSpacing: ".6em", paddingLeft: ".6em" });
    const tag = enonce(L, "Chaque fait, <em>sa pièce.</em>", 0, 438, 64, { w: W, align: "center" });
    const url = el("div", "abs", L, "sigille.fr");
    Object.assign(url.style, { left: 0, width: W + "px", textAlign: "center", top: "560px", font: "500 30px var(--mono)", letterSpacing: ".12em", color: "var(--cobalt-text)" });
    const cta = el("div", "cta", L, "ÊTRE PRÉVENU DE L'OUVERTURE");
    const cw = 540; Object.assign(cta.style, { left: (W - cw) / 2 + "px", width: cw + "px", textAlign: "center", top: "624px" });
    const black = el("div", "abs", stage);
    Object.assign(black.style, { inset: 0, left: 0, top: 0, width: W + "px", height: H + "px", background: "#000", zIndex: 50 });
    on("c10", (t) => {
      // le vrai site, bouton réel « Être prévenu de l'ouverture » (home.png : 703,652 → 961,706)
      const kw = outQ(ramp(t, sc.debut + 0.1, sc.debut + 1.0));
      const kz = io(ramp(t, n24.start - 0.4, n24.start + 1.6));
      const zz = lerp(z0, 0.95, kz), cx = lerp(960, 832, kz), cy = lerp(540, 600, kz);
      const fh = 700 - 40;
      const tx = clamp(600 - cx * zz, 1200 - 1920 * zz, 0), ty = clamp(fh / 2 - cy * zz, fh - 1080 * zz, 0);
      img.style.transform = `translate(${tx.toFixed(1)}px, ${(ty + 40).toFixed(1)}px) scale(${zz.toFixed(4)})`;
      const ob = env(t, n24.start + 1.0, n25.start - 0.4, 0.4, 0.3);
      Object.assign(btn.style, { left: tx + 703 * zz - 6 + "px", top: ty + 40 + 652 * zz - 6 + "px", width: 258 * zz + 12 + "px", height: 54 * zz + 12 + "px", opacity: ob, visibility: ob > 0 ? "visible" : "hidden", borderRadius: "999px" });
      const leave = io(ramp(t, n25.start - 0.9, n25.start - 0.1));
      show(w, kw * (1 - leave), 0, lerp(30, 0, kw), lerp(1, 0.96, leave));
      // carton final
      const kf = ramp(t, n25.start - 0.3, n25.start + 1.2);
      mk.set(kf, ramp(t, n25.start + 0.6, n25.start + 1.4));
      show(holder, kf > 0 ? 1 : 0);
      const kword = out(ramp(t, n25.start + 0.2, n25.start + 1.2));
      show(word, kword); word.style.letterSpacing = lerp(0.9, 0.6, kword).toFixed(3) + "em";
      show(tag, out(ramp(t, n25.start + 1.0, n25.start + 1.9)));
      show(url, out(ramp(t, n25.start + 1.6, n25.start + 2.4)), 0, lerp(10, 0, out(ramp(t, n25.start + 1.6, n25.start + 2.6))));
      show(cta, out(ramp(t, n25.start + 2.0, n25.start + 2.8)), 0, lerp(10, 0, out(ramp(t, n25.start + 2.0, n25.start + 3.0))));
    });
    updaters.push({ id: null, fn: (t) => { black.style.opacity = Math.max(1 - ramp(t, 0, 0.5), ramp(t, F.total - 1.4, F.total - 0.05)).toFixed(3); } });
  }

  // ── rendu ──
  function render(t) {
    for (const s of F.scenes) {
      const l = layers[s.id];
      const fin = l._extend || s.fin;
      // fondu enchaîné court ; c04 est porté par le calque de c03
      let o = Math.min(ramp(t, s.debut - 0.02, s.debut + 0.35), 1 - ramp(t, fin - 0.05, fin + 0.35));
      if (s.id === "c04") o = 0;
      l.style.opacity = o.toFixed(3);
      l.style.display = o > 0 ? "block" : "none";
      l.style.zIndex = F.scenes.indexOf(s);
    }
    for (const u of updaters) {
      if (u.id) {
        const s = S(u.id), fin = layers[u.id]._extend || s.fin;
        if (t < s.debut - 0.5 || t > fin + 0.6) continue;
      }
      u.fn(t);
    }
  }

  window.ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
    render(0);
    return true;
  })();
  window.render = render;
})();
