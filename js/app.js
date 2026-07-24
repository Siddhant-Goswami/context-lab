/* ============================================================
   THE CONTEXT LAB: app controller
   Linear player: one thing per screen. Every exercise is a
   felt failure → a hands-on fix → the reveal.
   ============================================================ */

const LS_KEY = 'context-lab.v1';
const state = load();
function load(){ try{ const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : {}; }catch(e){ return {}; } }
function persist(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} }
state.pos        = Number.isInteger(state.pos) ? state.pos : 0;
state.maxReached = Number.isInteger(state.maxReached) ? state.maxReached : 0;
state.answered   = state.answered && typeof state.answered === 'object' ? state.answered : {};
state.results    = state.results && typeof state.results === 'object' ? state.results : {};

/* ---------- helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function ic(name, attrs=''){ return `<i data-lucide="${name}" ${attrs}></i>`; }
function icons(){ if(window.lucide) try{ lucide.createIcons(); }catch(e){} }
function esc(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, kind=''){ const t = $('#toast'); t.innerHTML = (kind==='good'?ic('check'):kind==='bad'?ic('x'):ic('lightbulb'))+`<span>${msg}</span>`; t.className = 'toast show '+kind; icons(); clearTimeout(t._t); t._t = setTimeout(()=>t.className='toast', 3600); }

/* ---------- search engine (mini-Sage) ---------- */
function tok(q){ return q.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w && !STOP.has(w)); }
function kwSearch(q){
  const ts = tok(q);
  return DOCS.map(d=>{
    const hay = (d.t+' '+d.x).toLowerCase();
    const hits = ts.filter(w=>hay.includes(w));
    let score = 0; hits.forEach(w=>{ score += (hay.split(w).length-1); if(d.t.toLowerCase().includes(w)) score += 2; });
    return { d, score, hits };
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
}
function semSearch(q){
  const ts = tok(q);
  const concepts = new Set(); ts.forEach(w=>{ (MEANING[w]||[]).forEach(c=>concepts.add(c)); });
  return DOCS.map(d=>{
    const overlap = d.tags.filter(t=>concepts.has(t));
    const kwbits = ts.filter(w=>(d.t+' '+d.x).toLowerCase().includes(w)).length;
    const score = overlap.length*3 + kwbits;
    return { d, score, hits: overlap, cos: (0.55+0.13*overlap.length).toFixed(2) };
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
}
function resultsHTML(rows, semMode){
  if(!rows.length) return `<div class="noresult">${ic('search-x')} 0 results: no query word appears anywhere in the corpus.</div>`;
  return rows.slice(0,3).map((r,i)=>{
    let snip = esc(r.d.x.slice(0,150))+'…';
    if(!semMode){ r.hits.forEach(w=>{ snip = snip.replace(new RegExp('('+w+')','ig'),'<mark>$1</mark>'); }); }
    return `<div class="rdoc ${i===0?'hit':''}">
      <div class="rt"><span>${i+1}. ${esc(r.d.t)}</span><span class="rs">${semMode?('cos '+(r.cos||'0.70')):('score '+r.score)}</span></div>
      <div class="rm">module: ${r.d.m}</div><div class="rx">${snip}</div></div>`;
  }).join('');
}

/* ---------- flatten ---------- */
const FLAT = []; const MOD_START = [];
MODULES.forEach((m,mi)=>{ MOD_START[mi] = FLAT.length; m.steps.forEach(step=>FLAT.push({ mi, module:m, step })); });
const TOTAL = FLAT.length;
state.pos = Math.max(0, Math.min(TOTAL-1, state.pos));
state.maxReached = Math.max(state.pos, Math.min(TOTAL-1, state.maxReached));
function moduleOf(gi){ return FLAT[gi].mi; }
function moduleUnlocked(mi){ return MODULES[mi].open || MOD_START[mi] <= state.maxReached; }
function moduleDone(mi){ const next = MOD_START[mi+1]; return next !== undefined && state.maxReached >= next; }

/* ---------- navigation ---------- */
function goStep(gi){
  gi = Math.max(0, Math.min(TOTAL-1, gi));
  state.pos = gi; state.maxReached = Math.max(state.maxReached, gi); persist();
  closeSidebar(); render(); window.scrollTo({ top:0, behavior:'smooth' });
  $('#stage').focus({ preventScroll:true });
}
function goModule(mi){ if(moduleUnlocked(mi)) goStep(MOD_START[mi]); }
function closeSidebar(){ $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded','false'); }
function openSidebar(){ $('#sidebar').classList.add('open'); $('#scrim').classList.add('open'); $('#menuBtn').setAttribute('aria-expanded','true'); }

/* ---------- nav + topbar + footer ---------- */
function renderNav(){
  const nav = $('#moduleNav'); nav.innerHTML = '';
  MODULES.forEach((m,mi)=>{
    const unlocked = moduleUnlocked(mi), done = moduleDone(mi), active = moduleOf(state.pos)===mi;
    const item = el(`<button type="button" class="mod ${active?'active':''} ${done?'done':''} ${unlocked?'':'locked'}" ${unlocked?'':'disabled'}>
      <span class="mod-ic">${ic(done?'check':m.icon)}</span>
      <span class="mod-label">${m.title}</span>
      ${unlocked?'':ic('lock','width=14 height=14')}</button>`);
    if(unlocked) item.onclick = ()=>goModule(mi);
    nav.appendChild(item);
  });
  icons();
}
function renderTop(){
  const pct = Math.round(state.pos/(TOTAL-1)*100);
  $('#progressFill').style.width = pct+'%';
  $('#progressBar').setAttribute('aria-valuenow', String(pct));
  $('#progressLabel').textContent = `${FLAT[state.pos].module.title} · ${state.pos+1}/${TOTAL}`;
}
function renderFooter(){
  const gi = state.pos, { step } = FLAT[gi];
  const back = $('#backBtn'), cont = $('#continueBtn'), dots = $('#stepDots');
  back.style.visibility = gi===0 ? 'hidden' : 'visible';
  back.onclick = ()=>goStep(gi-1);
  cont.disabled = !!step.gate && !state.answered[gi];
  cont.style.visibility = gi===TOTAL-1 ? 'hidden' : 'visible';
  cont.innerHTML = 'Continue '+ic('arrow-right');
  cont.onclick = ()=>{ if(!cont.disabled) goStep(gi+1); };
  const mi = moduleOf(gi), start = MOD_START[mi], len = MODULES[mi].steps.length;
  dots.innerHTML = '';
  for(let k=0;k<len;k++){ const g = start+k; dots.appendChild(el(`<span class="sdot ${g<gi?'done':''} ${g===gi?'cur':''}"></span>`)); }
  icons();
}

/* ============================================================
   RENDERERS
   ============================================================ */
function render(){
  const { step } = FLAT[state.pos];
  renderNav(); renderTop();
  const stage = $('#stage'); stage.innerHTML = '';
  const fn = RENDER[step.t] || renderReveal;
  stage.appendChild(fn(step));
  renderFooter(); icons();
}

function stepHead(step){
  return `${step.eyebrow?`<div class="eyebrow-row"><span class="pill pill--coral">${step.eyebrow}</span></div>`:''}
    <h1>${(step.title||'').replace(/\n/g,'<br>')}</h1>
    ${step.fail?`<div class="fail-line">${esc(step.fail)}</div>`:''}
    ${step.subtitle?`<p class="subtitle">${step.subtitle}</p>`:''}`;
}

function renderIntro(step){
  return el(`<div class="step step--intro">
    ${step.pill?`<div class="eyebrow-row" style="justify-content:center"><span class="pill pill--coral">${ic('sparkles')} ${step.pill}</span></div>`:''}
    <h1>${step.title.replace(/\n/g,'<br>')}</h1>
    <p class="subtitle">${step.subtitle||''}</p>
    <p class="caption byline">Siddhant Goswami · Co-Founder and CTO, 100xEngineers</p>
  </div>`);
}

function renderQuestion(step){
  return el(`<div class="step step--q">
    ${step.eyebrow?`<div class="eyebrow-row"><span class="pill pill--coral">${step.eyebrow}</span></div>`:''}
    <div class="qtext">${step.q.replace(/\n/g,'<br>')}</div>
    ${step.sub?`<p class="qsub">${step.sub}</p>`:''}
  </div>`);
}

function renderReveal(step){
  return el(`<div class="step">
    ${step.eyebrow?`<div class="eyebrow-row">${ic('eye')}<span class="eyebrow eyebrow--accent">${step.eyebrow}</span></div>`:''}
    <h1>${(step.title||'').replace(/\n/g,'<br>')}</h1>
    ${step.subtitle?`<p class="subtitle">${step.subtitle}</p>`:''}
    ${step.body?`<p class="body">${step.body}</p>`:''}
    ${step.art||''}
  </div>`);
}

/* ---------- quiz (gated) ---------- */
function renderQuiz(step){
  const gi = state.pos, answered = !!state.answered[gi];
  const node = el(`<div class="step">
    <div class="eyebrow-row">${ic('help-circle')}<span class="eyebrow eyebrow--accent">${step.eyebrow||'Checkpoint'}</span></div>
    <h2 class="q-prompt">${step.prompt}</h2>
    <div class="choices"></div>
    <div class="explain" role="status" aria-live="polite"></div>
  </div>`);
  const choices = $('.choices',node), explain = $('.explain',node);
  step.options.forEach(opt=>{
    const b = el(`<button type="button" class="choice ${answered?'locked':''} ${answered&&opt.correct?'correct':''}" ${answered?'disabled':''}><span class="mark">${ic('check')}</span><span>${opt.label}</span></button>`);
    b.onclick = ()=>{
      if(state.answered[gi]) return;
      if(opt.correct){
        $$('.choice',choices).forEach(c=>{ c.classList.add('locked'); c.disabled = true; });
        b.classList.add('correct');
        explain.innerHTML = `<div class="card card--surface">${ic('lightbulb')}<p>${opt.fb}</p></div>`;
        state.answered[gi] = true; persist();
        toast('Correct','good');
        renderFooter(); icons();
      } else {
        b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
        explain.innerHTML = `<div class="card card--surface warn-card">${ic('info')}<p>${opt.fb}</p></div>`;
        icons();
      }
    };
    choices.appendChild(b);
  });
  if(answered){ const o = step.options.find(x=>x.correct); explain.innerHTML = `<div class="card card--surface">${ic('lightbulb')}<p>${o.fb}</p></div>`; }
  return node;
}

/* ---------- START · ask the base model ---------- */
function renderBasemodel(step){
  const node = el(`<div class="step">
    ${stepHead(step)}
    <div class="presets"></div>
    <div class="basecard">
      <div class="basehead">${ic('bot')} base model · no retrieval, no tools, no docs</div>
      <div class="baseq mono"></div>
      <div class="basea"></div>
      <div class="basenote"></div>
    </div>
  </div>`);
  const presets = $('.presets',node), qEl = $('.baseq',node), aEl = $('.basea',node), noteEl = $('.basenote',node);
  let token = 0;
  function ask(item){
    const tk = ++token;
    qEl.textContent = '> '+item.q;
    aEl.textContent = ''; noteEl.className = 'basenote'; noteEl.textContent = '';
    let i = 0;
    (function type(){
      if(tk!==token) return;
      aEl.textContent = item.a.slice(0, i);
      i += 3;
      if(i <= item.a.length+2) setTimeout(type, 12);
      else{
        noteEl.className = 'basenote show '+(item.ok?'ok':'bad');
        noteEl.innerHTML = (item.ok?ic('check-circle'):ic('alert-triangle'))+'<span>'+esc(item.note)+'</span>';
        icons();
      }
    })();
  }
  BASE_QA.forEach((item,idx)=>{
    const b = el(`<button class="btn btn--secondary btn--sm">“${esc(item.q)}”</button>`);
    b.onclick = ()=>ask(item);
    presets.appendChild(b);
  });
  ask(BASE_QA[0]);
  return node;
}

/* ---------- MAP · four buckets (guess-then-flip) ---------- */
function renderBuckets(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="bucketcards"></div>
  </div>`);
  const wrap = $('.bucketcards',node);
  BUCKETS4.forEach((b,i)=>{
    const card = el(`<div class="flip"><div class="flip-inner">
      <div class="face front"><span class="bnum">${i+1}</span><h5>${esc(b.gap)}</h5><p>${esc(b.symptom)}</p><div class="hint">what’s the fix? · flip</div></div>
      <div class="face back"><span class="fixlb">fix</span><h5>${esc(b.fix)}</h5><p>${esc(b.why)}</p></div>
    </div></div>`);
    card.onclick = ()=>card.classList.toggle('flipped');
    wrap.appendChild(card);
  });
  const note = el(`<p class="caption" style="margin-top:var(--space-4)">Hold on to bucket 3: the twelve exercises of this lab live entirely inside it. And bucket 4 will make one surprise return at generation time.</p>`);
  node.appendChild(note);
  return node;
}

/* ---------- MAP · the stack ---------- */
function renderStack(step){
  const node = el(`<div class="step">
    ${stepHead(step)}
    <div class="stack"></div>
    <div class="anchor">${ic('anchor')} Start with the cheapest layer that passes your golden set. Small corpus that fits comfortably? Load the whole thing. <strong>The best RAG is no RAG.</strong></div>
  </div>`);
  const wrap = $('.stack',node);
  LAYERS.forEach(L=>{
    const cd = COST_DETAIL[L.lb];
    const math = cd ? `<div class="costmath">
        <div class="cm-head mono">${esc(cd.headline)}</div>
        <table class="cm-tbl">${cd.rows.map(r=>`<tr><td>${esc(r[0])}</td><td class="mono">${esc(r[1])}</td></tr>`).join('')}</table>
        <div class="cm-note">${esc(cd.note)}</div>
      </div>` : '';
    wrap.appendChild(el(`<div class="stackrow ${L.hot?'hot':''}">
      <span class="lb">${L.lb}</span>
      <div class="sr-body"><strong>${esc(L.name)}</strong><span class="d">${esc(L.d)}</span>
        <details class="costfold"><summary><span class="cost">${esc(L.cost)}</span><span class="cm-toggle mono">${ic('calculator')} show the math</span></summary>${math}</details>
      </div></div>`));
  });
  icons();
  return node;
}

/* ---------- MAP · C.W. AND B. truth-table game ---------- */
function renderTT(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="ttrows"></div>
    <div class="scoreline"></div>
  </div>`);
  const rows = $('.ttrows',node), score = $('.scoreline',node);
  let done = 0, right = 0;
  TT_CASES.forEach(c=>{
    const row = el(`<div class="game-row">
      <span class="msg"><span class="ttflags"><span class="ttf ${c.cw?'yes':'no'}">C.W. ${c.cw?'✓':'✗'}</span><span class="ttf ${c.b?'yes':'no'}">B. ${c.b?'✓':'✗'}</span></span>${esc(c.label)}</span>
      <span class="pair"><button class="pick" data-r="send">Send directly</button><button class="pick" data-r="rag">Retrieve</button></span>
      <span class="why">${esc(c.why)}</span></div>`);
    $$('.pick',row).forEach(p=>p.onclick = ()=>{
      const picked = p.dataset.r==='send';
      row.classList.add('done');
      p.classList.add('picked', picked===c.send?'right':'wrong');
      if(picked!==c.send) $(`[data-r="${c.send?'send':'rag'}"]`,row).classList.add('answer');
      done++; if(picked===c.send) right++;
      score.textContent = `${right} / ${done}`+(done===TT_CASES.length?'. One green cell, three orange. RAG is not the modern default; it is what you buy when EITHER constraint fails.':'');
    });
    rows.appendChild(row);
  });
  node.appendChild(el(`<p class="caption" style="margin-top:var(--space-3)">And RAG is not a rival to tools; in production it usually <em>is</em> a tool: <code>search_knowledge_base</code>. Keep that sentence; Exercise 8 turns it into architecture.</p>`));
  return node;
}

/* ---------- MAP · route the queue (gated) ---------- */
function renderRouteGame(step){
  const gi = state.pos;
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="rq-list"></div>
    <div class="row-wrap"><button class="btn btn--primary" id="mqCheck">Check my routing</button><span class="scoreline" id="mqScore"></span></div>
  </div>`);
  const list = $('.rq-list',node);
  const sel = {};
  function draw(){
    list.innerHTML = '';
    MAP_QUEUE.forEach((it,i)=>{
      const d = el(`<div class="rq"><div class="qq">${esc(it.q)}</div><div class="opts">${
        MAP_LAYERS.map((l,o)=>`<button data-i="${i}" data-o="${o}" class="${sel[i]===o?'sel':''}">${l}</button>`).join('')
      }</div><div class="verdict" id="mqv${i}"></div></div>`);
      list.appendChild(d);
    });
    $$('button[data-i]',list).forEach(b=>b.onclick = ()=>{ sel[+b.dataset.i] = +b.dataset.o; draw(); });
  }
  draw();
  $('#mqCheck',node).onclick = ()=>{
    let right = 0, answered = 0;
    MAP_QUEUE.forEach((it,i)=>{
      const v = $('#mqv'+i,node); v.style.display = 'block';
      const s = sel[i];
      if(s===undefined){ v.textContent = 'pick a layer'; v.className = 'verdict mut'; return; }
      answered++;
      $$(`button[data-i="${i}"]`,list).forEach(b=>{
        const o = +b.dataset.o;
        if(o===it.a) b.classList.add('good'); else if(o===s) b.classList.add('bad');
      });
      if(s===it.a){ right++; v.textContent = '✓ '+MAP_LAYERS[it.a]+' · cheapest layer that passes'; v.className = 'verdict ok'; }
      else if(s>it.a){ v.textContent = '✗ works, but '+MAP_LAYERS[it.a]+' already passes. A layer the eval never demanded is pure cost.'; v.className = 'verdict warn'; }
      else{ v.textContent = '✗ too cheap: this bucket cannot be closed at '+MAP_LAYERS[s]+'. Answer: '+MAP_LAYERS[it.a]; v.className = 'verdict err'; }
    });
    $('#mqScore',node).textContent = answered<MAP_QUEUE.length ? 'route every query first' :
      (right===MAP_QUEUE.length ? right+'/4, cheapest passing layer, every time' : right+'/4, re-check the buckets and try again');
    if(answered===MAP_QUEUE.length){
      state.results.mapRoute = { right }; state.answered[gi] = true; persist(); renderFooter();
      toast(right===MAP_QUEUE.length ? 'Perfect routing. Watch the same decision reappear inside L3, in Exercise 9.' : 'Diagnosis before purchase: re-read the buckets and route again.', right===MAP_QUEUE.length?'good':'');
    }
  };
  return node;
}

/* ---------- BRIDGE · seven buckets ---------- */
function renderSevenBuckets(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="seven"></div>
  </div>`);
  const wrap = $('.seven',node);
  BUCKETS7.forEach(b=>{
    wrap.appendChild(el(`<div class="sbucket"><span class="bnum">${b.n}</span>
      <div class="sb-body"><div class="sb-top"><h5>${esc(b.name)}</h5><span class="sb-ex mono">${esc(b.ex)}</span></div><p>${esc(b.d)}</p></div></div>`));
  });
  node.appendChild(el(`<div class="anchor" style="margin-top:var(--space-5)">${ic('anchor')} The seven retrieval buckets are the fine structure of bucket 3. Each exercise ahead starts with a query that fails into one of them, and you derive the fix by doing it.</div>`));
  return node;
}

/* ---------- BRIDGE · the opened L3 box ---------- */
function renderL3Map(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="l3wrap">
      <div class="stackrow dim"><span class="lb">L0</span><div class="sr-body"><span class="d"><strong>Base model</strong> · ship it if it already passes</span></div></div>
      <div class="stackrow dim"><span class="lb">L1</span><div class="sr-body"><span class="d"><strong>In-context</strong> · small corpus? load the whole thing, stop here</span></div></div>
      <div class="stackrow dim"><span class="lb">L2</span><div class="sr-body"><span class="d"><strong>Tool calling</strong> · live data at request time</span></div><span class="crosswire mono">← Exercise 8 returns here</span></div>
      <div class="l3open">
        <div class="l3head"><span class="lb">L3</span><strong>RAG, opened</strong><span class="mono flow">ingest → retrieve → rank → ground</span></div>
        <div class="l3stages"></div>
      </div>
    </div>
    <p class="caption" style="margin-top:var(--space-4)">Three wires cross levels, watch for them: <strong>Exercise 8</strong> is L2’s tool-calling loop pointed at your own corpus. <strong>Exercise 10</strong> is bucket 4 resurfacing at generation time. <strong>Exercises 9, 11 and 12</strong> are the map itself, re-instantiated inside L3.</p>
  </div>`);
  const stages = $('.l3stages',node);
  L3_STAGES.forEach(s=>{
    stages.appendChild(el(`<div class="stage"><div class="stlab mono">${esc(s.stage)}</div>
      <div class="exchips">${s.chips.map(c=>`<span class="exchip"><b>${c.n}</b>${esc(c.t)}</span>`).join('')}</div></div>`));
  });
  return node;
}

/* ---------- shared bench pieces ---------- */
function benchHTML(title, inner, foot){
  return `<div class="bench"><div class="bench-title">${ic('terminal')} ${title}</div>${inner}${foot?`<div class="bench-foot mono">${foot}</div>`:''}</div>`;
}

/* ---------- EX 1 · the floor ---------- */
function renderExSearch(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Sage: keyword floor', `
      <div class="presets">
        <button class="chipbtn" data-q="What is RAG?">What is RAG?</button>
        <button class="chipbtn" data-q="How does the ReAct framework work?">How does ReAct work?</button>
        <button class="chipbtn" data-q="What is LoRA training?">What is LoRA training?</button>
      </div>
      <div class="sim-in"><input class="input" value="What is RAG?" aria-label="Student question"><button class="btn btn--primary">Search</button></div>
      <div class="glabel">retrieved · top 3</div>
      <div class="results"></div>`,
      '12 documents · BM25-style term matching · runs in your browser')}
    <div class="bts"><div class="btslabel mono">behind the scenes · why these documents</div><pre class="codeblk bts-pre">(search to see the term-by-term score)</pre></div>
  </div>`);
  const input = $('.input',node), res = $('.results',node), pre = $('.bts-pre',node);
  function run(){
    const q = input.value, rows = kwSearch(q);
    res.innerHTML = resultsHTML(rows,false);
    let bts = 'query   : '+q+'\ntokens  : ['+tok(q).join(', ')+']   (stop-words removed)\n\n';
    if(rows.length){
      rows.slice(0,3).forEach(r=>{ bts += r.d.k.padEnd(28)+' score '+String(r.score).padStart(3)+'   matched: '+r.hits.join(', ')+'\n'; });
      bts += '\nEvery point of that score is explainable: these words, this document.';
    } else bts += 'no document contains any query token.';
    pre.textContent = bts;
  }
  $('.sim-in .btn',node).onclick = run;
  input.onkeydown = e=>{ if(e.key==='Enter') run(); };
  $$('.chipbtn',node).forEach(c=>c.onclick = ()=>{ input.value = c.dataset.q; run(); });
  run();
  return node;
}

/* ---------- EX 2 · meaning mode ---------- */
function renderExMeaning(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Sage: floor + meaning mode', `
      <label class="switchrow"><input type="checkbox" class="semtoggle"><span class="slab">Meaning mode</span><span class="ssub">match by meaning-neighbourhoods, what embeddings buy you</span></label>
      <div class="presets">
        <button class="chipbtn" data-q="make the bot stop lying">make the bot stop lying</button>
        <button class="chipbtn" data-q="when will I learn to automate my job">automate my job</button>
        <button class="chipbtn" data-q="how do I make ai images">make ai images</button>
      </div>
      <div class="sim-in"><input class="input" value="make the bot stop lying" aria-label="Student question"><button class="btn btn--primary">Search</button></div>
      <div class="glabel">retrieved · top 3</div>
      <div class="results"></div>`)}
    <div class="bts"><div class="btslabel mono">behind the scenes · letters vs meaning</div><pre class="codeblk bts-pre">(search to compare the two matchers)</pre></div>
    <p class="honest">Honest note: real embeddings compute these neighbourhoods from data; this lab precomputed them so you can feel the behaviour without a GPU. The decision logic is identical.</p>
  </div>`);
  const input = $('.input',node), res = $('.results',node), pre = $('.bts-pre',node), sem = $('.semtoggle',node);
  let feltGap = false;
  function run(){
    const q = input.value, isSem = sem.checked;
    const kw = kwSearch(q), se = semSearch(q);
    res.innerHTML = resultsHTML(isSem?se:kw, isSem);
    const ts = tok(q);
    let bts = 'tokens: ['+ts.join(', ')+']\n\nLETTERS (BM25):  '+(kw.length?kw.slice(0,2).map(r=>r.d.k).join(', '):'0 results, zero shared characters')+'\nMEANING mode :  ';
    if(se.length){
      bts += se.slice(0,2).map(r=>r.d.k+' (cos '+r.cos+')').join(', ')+'\n\nneighbourhoods used:\n';
      ts.forEach(w=>{ if(MEANING[w]) bts += '  "'+w+'"  ≈  '+MEANING[w].join(', ')+'\n'; });
    } else bts += '(no neighbourhood found either)';
    pre.textContent = bts;
    icons();
    if(!isSem && !kw.length && !feltGap){ feltGap = true; toast('Zero results, and the answer IS in the corpus. That is bucket 1. Now flip on Meaning mode.','bad'); }
    if(isSem && se.length && feltGap){ toast('Same query, same corpus. The only thing that changed is the matcher. That is what embeddings buy.','good'); }
  }
  $('.sim-in .btn',node).onclick = run;
  input.onkeydown = e=>{ if(e.key==='Enter') run(); };
  sem.onchange = run;
  $$('.chipbtn',node).forEach(c=>c.onclick = ()=>{ input.value = c.dataset.q; run(); });
  run();
  return node;
}

/* ---------- EX 3a · chunking bench (ChunkViz) ---------- */
const CURRICULUM_PASSAGE =
  CHUNK_DOC.body.map(s=>s[0]+'. '+s[1]).join('\n\n') + '\n\n' +
  'Retrieval-Augmented Generation. ' + DOCS.find(d=>d.k==='rag').x + '\n\n' +
  'Embeddings. ' + DOCS.find(d=>d.k==='embeddings').x;
function renderExChunks(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Chunk the curriculum yourself', `
      <p class="bench-intro">This is the live <b>ChunkViz</b> tool (by Greg Kamradt). Copy a page of curriculum data, paste it into the box, then drag the <b>chunk size</b> slider: small character-count chunks slice thoughts mid-sentence, and splitting on structure keeps each idea whole.</p>
      <div class="presets">
        <button class="btn btn--primary btn--sm copytext">${ic('copy')} Copy curriculum text</button>
        <a class="btn btn--secondary btn--sm" href="https://chunkviz.up.railway.app/" target="_blank" rel="noopener">${ic('external-link')} Open in a new tab</a>
      </div>
      <div class="chunkviz-wrap"><iframe class="chunkviz" src="https://chunkviz.up.railway.app/" title="ChunkViz, a chunk-size visualizer" loading="lazy"></iframe></div>`,
      'paste the curriculum text · drag the chunk-size slider · watch thoughts get sliced')}
  </div>`);
  $('.copytext',node).onclick = ()=>{
    const txt = CURRICULUM_PASSAGE;
    const done = ()=>toast('Curriculum text copied. Paste it into ChunkViz above, then drag the chunk-size slider.','good');
    const fallback = ()=>{ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');done();}catch(e){toast('Copy failed; select and copy manually.','bad');} document.body.removeChild(ta); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(fallback); else fallback();
  };
  return node;
}

/* ---------- EX 3b · orphan demo ---------- */
function renderExOrphan(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('The orphan demo', `
      <div class="sim-in"><input class="input" value="Which flag do I redeploy with?" readonly aria-label="Student question (locked)"><button class="btn btn--primary go">Search</button><button class="btn btn--secondary stamp">Add context to each chunk</button></div>
      <div class="glabel">retrieved</div>
      <div class="results"><div class="rdoc mut"><div class="rx">search to feel the orphan failure</div></div></div>`)}
    <p class="honest">Honest note: this bench replays one fixed query (the box is locked) so every student feels the same orphan failure. Contextual retrieval itself is real: same chunk, one situating sentence, written once at indexing time.</p>
  </div>`);
  const res = $('.results',node);
  let passport = false;
  function run(){
    if(!passport){
      res.innerHTML = `<div class="rdoc orphan"><div class="rt"><span>1. (unknown source)</span><span class="rs">score 4</span></div>
        <div class="rx">“…then <mark>redeploy</mark> with the <mark>flag</mark> enabled. The flag is version-pinning…”</div>
        <div class="rm err-t">retrieved, but WHICH flag? which doc? which lecture? The chunk lost its address.</div></div>`;
    } else {
      res.innerHTML = `<div class="rdoc hit"><div class="rt"><span>1. Deployment on Replicate › Shipping a new version</span><span class="rs">score 9</span></div>
        <div class="rx"><span class="passport-add">“From Module 1 (Diffusion); section ‘Deployment on Replicate › Shipping a new version’.”</span> …then <mark>redeploy</mark> with the <mark>flag</mark> enabled. The flag is version-pinning: callers stay on the old model until you flip them.</div>
        <div class="rm ok-t">same chunk + one situating sentence = an answer with an address. Paid once, at indexing.</div></div>`;
    }
  }
  $('.go',node).onclick = run;
  $('.stamp',node).onclick = function(){
    passport = true; this.textContent = 'Context added ✓'; this.disabled = true; run();
    toast('One sentence per chunk, written once at indexing time. Anthropic call this contextual retrieval.','good');
  };
  return node;
}

/* ---------- EX 4 · fusion ---------- */
function renderExFusion(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('One query, two ranked lists', `
      <div class="fuse2">
        <div class="flist"><h4 class="mono">keyword (BM25)</h4><ol class="kwlist"></ol></div>
        <div class="flist"><h4 class="mono">meaning (embeddings)</h4><ol class="semlist"></ol></div>
      </div>
      <div class="presets">
        <button class="btn btn--secondary btn--sm onlyk">Trust keyword only</button>
        <button class="btn btn--secondary btn--sm onlys">Trust meaning only</button>
        <button class="btn btn--primary btn--sm dofuse">Fuse (RRF)</button>
      </div>
      <div class="glabel">verdict</div>
      <div class="results"><div class="rdoc mut"><div class="rx">pick a strategy</div></div></div>`)}
    <div class="bts"><div class="btslabel mono">behind the scenes · the RRF math</div><div class="tblwrap"><table class="rrf"></table></div></div>
  </div>`);
  [[FUSE_KW,'.kwlist'],[FUSE_SEM,'.semlist']].forEach(([L,s])=>{
    const ol = $(s,node);
    L.forEach((it,i)=>ol.appendChild(el(`<li class="${it[2]?'star':''}"><span class="rank mono">#${i+1}</span><span>${it[2]?'★ ':''}${esc(it[0])}</span></li>`)));
  });
  const out = $('.results',node), tbl = $('.rrf',node);
  function verdict(msg, rows){
    out.innerHTML = `<div class="rdoc"><div class="rx">${msg}</div></div>`+
      (rows||[]).map((r,i)=>`<div class="rdoc ${r.star?'hit':''}"><div class="rt"><span>${i+1}. ${r.star?'★ ':''}${esc(r.name)}</span><span class="rs">${r.score}</span></div></div>`).join('');
  }
  $('.onlyk',node).onclick = ()=>{ verdict('<b>Keyword only:</b> the exact term wins the list, but the target (★) sits at #3, below two docs that merely mention BM25 a lot. The fuzzy “agents module” signal was thrown away.'); tbl.innerHTML=''; };
  $('.onlys',node).onclick = ()=>{ verdict('<b>Meaning only:</b> scope understood, ★ at #2, but the module overview outranks it, because “meaning” can’t feel the exact term BM25. The precise signal was thrown away.'); tbl.innerHTML=''; };
  $('.dofuse',node).onclick = ()=>{
    const K = 60, score = {}, star = {};
    FUSE_KW.forEach((it,i)=>{ score[it[0]] = (score[it[0]]||0)+1/(K+i+1); star[it[0]] = star[it[0]]||!!it[2]; });
    FUSE_SEM.forEach((it,i)=>{ score[it[0]] = (score[it[0]]||0)+1/(K+i+1); star[it[0]] = star[it[0]]||!!it[2]; });
    const ranked = Object.entries(score).sort((a,b)=>b[1]-a[1]);
    verdict('<b>Fused (RRF):</b> the consensus document (never #1 in either list) takes #1 overall. Both signals kept, no unit conversion invented.',
      ranked.slice(0,4).map(([name,sc])=>({ name, score:sc.toFixed(4), star:star[name] })));
    let html = '<tr><th>document</th><th>kw rank</th><th>sem rank</th><th>1/(60+r) + 1/(60+r)</th><th>fused</th></tr>';
    ranked.slice(0,5).forEach(([name,sc])=>{
      const ki = FUSE_KW.findIndex(it=>it[0]===name), si = FUSE_SEM.findIndex(it=>it[0]===name);
      const parts = []; if(ki>-1) parts.push('1/'+(K+ki+1)); if(si>-1) parts.push('1/'+(K+si+1));
      html += `<tr class="${star[name]?'win':''}"><td>${esc(name.slice(0,26))}</td><td>${ki>-1?'#'+(ki+1):'–'}</td><td>${si>-1?'#'+(si+1):'–'}</td><td>${parts.join(' + ')}</td><td>${sc.toFixed(4)}</td></tr>`;
    });
    tbl.innerHTML = html;
    toast('Ranked #3 and #2, wins the fusion. Consensus beats a lone first place. That is RRF.','good');
  };
  return node;
}

/* ---------- EX 5 · rewrite + HyDE ---------- */
function renderExRewrite(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Query in, better key out', `
      <div class="sim-in"><input class="input" value="When will I learn how to automate my job?" readonly aria-label="Student question (locked)"><button class="btn btn--primary rw">Rewrite</button><button class="btn btn--secondary hyde">Search with a fake answer</button></div>
      <div class="glabel">search key actually used</div>
      <div class="keybox"><span class="mut">the raw query, so far</span></div>
      <div class="glabel">retrieved</div>
      <div class="results"><div class="rdoc mut"><div class="rx">rewrite, or search with a fake answer, to see the move</div></div></div>`)}
    <div class="bts"><div class="btslabel mono">the meaning-space map · watch where the probe lands</div>
      <div class="mapwrap"><canvas class="spacemap" width="560" height="300"></canvas></div>
      <pre class="codeblk bts-pre">(rewrite, or search with a fake answer, to see the move)</pre></div>
    <p class="honest">Honest note: the rewrite and the probe are precomputed for this one query (the box is locked) so you can feel the move without an API key. In real Sage a cheap LLM produces both, live, from the lexicon. The decision logic is identical.</p>
  </div>`);
  const keybox = $('.keybox',node), res = $('.results',node), pre = $('.bts-pre',node), cv = $('.spacemap',node);
  let mode = 'raw';
  function map(){
    const ctx = cv.getContext && cv.getContext('2d');
    if(!ctx) return;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle = '#F9F9F9'; ctx.fillRect(0,0,cv.width,cv.height);
    const clusters = [
      { label:'full-stack cluster', x:150, y:95, c:'#F96846', pts:[[128,78],[165,70],[142,108],[180,100],[155,128],[120,118]] },
      { label:'agents cluster', x:390, y:85, c:'#14B8A6', pts:[[370,66],[406,72],[382,100],[418,96],[398,118]] },
      { label:'diffusion cluster', x:120, y:225, c:'#F59E0B', pts:[[100,210],[136,204],[112,242],[148,232]] },
    ];
    ctx.font = '11px JetBrains Mono, monospace';
    clusters.forEach(cl=>{
      ctx.fillStyle = cl.c;
      cl.pts.forEach(p=>{ ctx.beginPath(); ctx.arc(p[0],p[1],4,0,7); ctx.fill(); });
      ctx.globalAlpha = .75; ctx.fillText(cl.label, cl.x-38, cl.y-34); ctx.globalAlpha = 1;
    });
    ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(480,240,6,0,7); ctx.fill();
    ctx.fillStyle = '#666'; ctx.fillText('the question, as typed', 388, 262);
    if(mode!=='raw'){
      const px = mode==='hyde'?404:392, py = mode==='hyde'?106:128;
      ctx.strokeStyle = '#F96846'; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(480,240); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#F96846'; ctx.beginPath(); ctx.arc(px,py,6,0,7); ctx.fill();
      ctx.strokeStyle = '#F96846'; ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.arc(px,py,34,0,7); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#C53D1B';
      ctx.fillText(mode==='hyde'?'the fake ANSWER (probe)':'the rewritten query', px-70, py-14);
    }
  }
  $('.rw',node).onclick = ()=>{
    mode = 'rw';
    keybox.innerHTML = '<b>rewritten:</b> '+esc(REWRITE_KEY);
    res.innerHTML = resultsHTML(semSearch(REWRITE_KEY), true); map();
    pre.textContent = 'LEXICON row applied:\n  "automate my job"  →  AAA agent progression, agentic workflows\n\nThe lexicon is harvested from YOUR failed queries. It is the two-column\ndictionary of student-language vs corpus-language, and this one line of\ntranslation just turned a miss into a hit.';
    toast('Same intent, new key. The rewriter is a translator, nothing more, and it is the highest-ROI component in the system.','good');
  };
  $('.hyde',node).onclick = ()=>{
    mode = 'hyde';
    keybox.innerHTML = '<b>the probe (a made-up answer):</b> '+esc(HYDE_KEY);
    res.innerHTML = resultsHTML(semSearch(HYDE_KEY), true); map();
    pre.textContent = 'We searched with a FAKE ANSWER, not the question.\n\nLook at the map: the question sits far from every cluster: questions are\nphrased like questions. The fake answer is phrased like the real answers,\nso it lands inside the agents cluster, and its nearest neighbours are the\ntrue passages. Factually worthless, geometrically precious.';
    toast('Answers live near answers. Questions don’t. That is the whole trick.','good');
  };
  requestAnimationFrame(map);
  return node;
}

/* ---------- EX 6 · rerank ---------- */
function renderExRerank(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Candidates in fast-pass order: fix the ranking', `
      <div class="cands"></div>
      <div class="presets" style="margin-top:var(--space-3)">
        <button class="btn btn--primary btn--sm runce">Run the careful re-ranker</button>
        <button class="btn btn--secondary btn--sm resetce">Reset order</button>
      </div>
      <div class="costnote" hidden>
        <div class="costbox badc"><b class="mono">re-rank everything</b>every chunk × every query, one model pass per pair. Unshippable.</div>
        <div class="costbox goodc"><b class="mono">staged (what Sage does)</b>cheap search screens a shortlist → the careful pass judges those → top 6 to the generator.</div>
      </div>`)}
    <div class="bts"><div class="btslabel mono">behind the scenes</div><pre class="codeblk bts-pre">The fast pass embeds every chunk on its own, before your query exists → fast, but blind to the question.
The careful pass reads (query + chunk) together, one pair at a time → accurate, but expensive. Run it to see scores.</pre></div>
  </div>`);
  const list = $('.cands',node), pre = $('.bts-pre',node), costs = $('.costnote',node);
  let order = [0,1,2,3,4,5], ran = false;
  function draw(){
    list.innerHTML = '';
    order.forEach((ci,pos)=>{
      const c = RERANK_C[ci];
      const d = el(`<div class="cand ${ran&&c.answer?'answer':''}">
        <span class="pos mono">#${pos+1}</span><span class="ctext">${esc(c.t)}</span>
        ${ran?`<span class="ce mono">${c.ce.toFixed(2)}</span>`:''}
        <span class="updown"><button data-i="${pos}" data-d="-1" aria-label="move up">▲</button><button data-i="${pos}" data-d="1" aria-label="move down">▼</button></span></div>`);
      list.appendChild(d);
    });
    $$('button[data-i]',list).forEach(b=>b.onclick = ()=>{
      const i = +b.dataset.i, d = +b.dataset.d, j = i+d;
      if(j<0 || j>=order.length) return;
      [order[i],order[j]] = [order[j],order[i]]; draw();
    });
  }
  draw();
  $('.runce',node).onclick = ()=>{
    ran = true;
    const myTop = order[0];
    order = [...order].sort((a,b)=>RERANK_C[b].ce-RERANK_C[a].ce);
    draw();
    costs.hidden = false;
    pre.textContent = 'These two passes have names.\n'+
      'The fast one is a BI-ENCODER: query and chunks embedded separately, in mutual ignorance.\n'+
      'The careful one is a CROSS-ENCODER: it reads (query + chunk) together, one pair at a time.\n\n'+
      'Scores, judged together:\n'+
      RERANK_C.map(c=>'  '+c.ce.toFixed(2)+'  '+c.t.slice(0,58)+'…').join('\n')+
      '\n\nYour #1 pick '+(RERANK_C[myTop].answer
        ? 'matched the careful re-ranker. You read query and chunk together. That IS the algorithm.'
        : 'differed. Compare with the top-scoring chunk: it answers BOTH halves of the question (what MCP is + what problem it solves).');
    toast(RERANK_C[myTop].answer
      ? 'You out-ranked the fast pass. Now imagine paying for that judgement on every chunk, every query.'
      : 'The careful re-ranker promotes the chunk that answers both halves. Cheap retrieval finds; expensive judgement decides.', RERANK_C[myTop].answer?'good':'');
  };
  $('.resetce',node).onclick = ()=>{ order = [0,1,2,3,4,5]; ran = false; costs.hidden = true; draw(); };
  return node;
}

/* ---------- EX 7 · the graph ---------- */
function renderExGraph(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Click <b>tool-calling</b>, then widen the hops', `
      <div class="gsvgwrap"></div>
      <div class="presets" style="margin-top:var(--space-3)">
        <button class="btn btn--secondary btn--sm hopbtn">+1 hop</button>
        <button class="btn btn--secondary btn--sm gclear">Clear</button>
      </div>
      <div class="glabel">traversal log · your answer</div>
      <pre class="codeblk bts-pre">(click the tool-calling node to traverse)</pre>`)}
  </div>`);
  const wrap = $('.gsvgwrap',node), pre = $('.bts-pre',node);
  let depth = 1, active = false;
  let svg = `<svg viewBox="0 0 470 300" role="img" aria-label="curriculum knowledge graph">
    <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" stroke-width="1.2"/></marker></defs>`;
  GRAPH_E.forEach(([a,b],i)=>{
    const A = GRAPH_N[a], B = GRAPH_N[b];
    const dx = B.x-A.x, dy = B.y-A.y, L = Math.hypot(dx,dy), ux = dx/L, uy = dy/L;
    svg += `<line class="gedge" id="ge${i}" x1="${A.x+ux*16}" y1="${A.y+uy*16}" x2="${B.x-ux*18}" y2="${B.y-uy*18}"/>`;
  });
  Object.entries(GRAPH_N).forEach(([k,n])=>{
    svg += `<g class="gnode" id="gn-${k}" tabindex="0" role="button" aria-label="${n.t}"><circle cx="${n.x}" cy="${n.y}" r="15"/><text x="${n.x}" y="${n.y+27}">${n.t}</text></g>`;
  });
  wrap.innerHTML = svg+'</svg>';
  function paint(){
    Object.keys(GRAPH_N).forEach(k=>$('#gn-'+k,wrap).setAttribute('class','gnode'));
    GRAPH_E.forEach((e,i)=>$('#ge'+i,wrap).setAttribute('class','gedge'));
    if(!active) return;
    $('#gn-tool-calling',wrap).setAttribute('class','gnode seed');
    const hop1 = [];
    GRAPH_E.forEach(([a,b],i)=>{ if(b==='tool-calling'){ hop1.push(a); $('#ge'+i,wrap).setAttribute('class','gedge glow'); $('#gn-'+a,wrap).setAttribute('class','gnode hop1'); } });
    let hop2 = [];
    if(depth>=2) GRAPH_E.forEach(([a,b],i)=>{ if(hop1.includes(b)){ hop2.push(a); $('#ge'+i,wrap).setAttribute('class','gedge glow2'); $('#gn-'+a,wrap).setAttribute('class','gnode hop2'); } });
    let log = 'seed    : tool-calling  (the entity the query names)\nhop 1 ← : '+hop1.map(k=>GRAPH_N[k].t).join(', ')+'\n';
    if(depth>=2) log += 'hop 2 ← : '+(hop2.length?hop2.map(k=>GRAPH_N[k].t).join(', '):'(none)')+'\n';
    log += '\nANSWER: lectures that assume tool calling:\n  '+hop1.map(k=>GRAPH_N[k].t).join('\n  ')+
      (depth>=2 && hop2.length ? '\n  '+hop2.map(k=>GRAPH_N[k].t+'  (via ReAct)').join('\n  ') : '');
    log += '\n\nNo similarity score was computed. You read edges and followed them.';
    pre.textContent = log;
    if(depth===1) toast('Three incoming edges = three lectures that reference tool calling. Try +1 hop for the indirect dependency.');
  }
  Object.keys(GRAPH_N).forEach(k=>{
    const g = $('#gn-'+k,wrap);
    const click = ()=>{
      if(k!=='tool-calling'){ pre.textContent = 'You clicked '+GRAPH_N[k].t+', but the question is about tool-calling. Seed the traversal from the entity the query names.'; return; }
      active = true; depth = 1; paint();
    };
    g.onclick = click;
    g.onkeydown = e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); click(); } };
  });
  $('.hopbtn',node).onclick = ()=>{ if(!active){ toast('Click the tool-calling node first.'); return; } depth = 2; paint(); };
  $('.gclear',node).onclick = ()=>{ active = false; depth = 1; paint(); pre.textContent = '(click the tool-calling node to traverse)'; };
  return node;
}

/* ---------- EX 8 · the librarian loop ---------- */
function renderExLoop(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('The librarian loop <span class="invoice mono">spent: ₹0</span>', `
      <div class="hoplog"></div>
      <div class="presets">
        <button class="btn btn--primary srch">Search: <span class="mono nextq">"AAA agent progression"</span></button>
        <button class="btn btn--secondary ans">Answer now</button>
        <button class="btn btn--ghost btn--sm restart">Restart</button>
      </div>
      <div class="glabel">the answer, if you stop here</div>
      <div class="outbox"><span class="mut">search first, then decide when you can answer</span></div>`)}
    <p class="honest">Honest note: the three hops replay a recorded Sage trace for this one query, so everyone feels the same loop. What is yours is the decision of when to stop, and that decision is the lesson.</p>
  </div>`);
  const log = $('.hoplog',node), out = $('.outbox',node), inv = $('.invoice',node), btn = $('.srch',node), nextq = $('.nextq',node);
  let i = 0, spent = 0;
  function ui(){
    inv.textContent = 'spent: ₹'+spent;
    if(i < LOOP_HOPS.length){ btn.disabled = false; nextq.textContent = LOOP_HOPS[i].q; }
    else { btn.disabled = true; nextq.textContent = '(nothing left to search. Answer!)'; }
  }
  btn.onclick = ()=>{
    if(i >= LOOP_HOPS.length) return;
    const h = LOOP_HOPS[i];
    log.appendChild(el(`<div class="hop"><span class="hq mono">hop ${i+1} · search ${esc(h.q)} · ₹2</span><div class="hf">${esc(h.found)}</div><div class="hr">${esc(h.realize)}</div></div>`));
    spent += 2; i++; ui();
    if(i===LOOP_HOPS.length) toast('Notice what just happened three times: read → realise → refine. A pipeline can’t “realise”. A loop can.','good');
  };
  $('.ans',node).onclick = ()=>{
    if(i===0){ out.innerHTML = '<span class="err-t">“You’ll learn to automate your job at some point in the curriculum.” Retrieved nothing, grounded on nothing. This is the answer a single-shot pipeline gives.</span>'; return; }
    if(i < LOOP_HOPS.length){
      out.innerHTML = '<span class="err-t">Incomplete. You know: '+LOOP_FRAGS.slice(0,i).join('; ')+'. Still missing: '+LOOP_FRAGS.slice(i).join('; ')+'. The result you just read told you what to search next. Use it.</span>';
      return;
    }
    out.innerHTML = '<span class="ok-t">'+esc(LOOP_ANSWER)+' · grounded on 3 hops · total ₹'+spent+'</span>';
    toast('Three searches, each derived from reading the last. That is retrieval as a TOOL, not a step, bounded at 4 hops.','good');
  };
  $('.restart',node).onclick = ()=>{ i = 0; spent = 0; log.innerHTML = ''; out.innerHTML = '<span class="mut">search first, then decide when you can answer</span>'; ui(); };
  ui();
  return node;
}

/* ---------- EX 9 · the router ---------- */
function renderExRouter(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Six real queries <span class="invoice mono">your invoice: ₹0</span>', `
      <div class="rq-list"></div>
      <div class="presets"><button class="btn btn--primary rcheck">Check my routing</button></div>
      <pre class="codeblk bts-pre" hidden></pre>`)}
  </div>`);
  const list = $('.rq-list',node), inv = $('.invoice',node), pre = $('.bts-pre',node);
  const sel = {};
  function draw(){
    list.innerHTML = '';
    ROUTER_Q.forEach((it,i)=>{
      const d = el(`<div class="rq"><div class="qq">${esc(it.q)}</div><div class="opts">${
        ['single','graph','agentic'].map(o=>`<button data-i="${i}" data-o="${o}" class="${sel[i]===o?'sel':''}">${o} · ₹${ROUTER_COST[o]}</button>`).join('')
      }</div><div class="verdict" id="rv${i}"></div></div>`);
      list.appendChild(d);
    });
    $$('button[data-i]',list).forEach(b=>b.onclick = ()=>{ sel[+b.dataset.i] = b.dataset.o; draw(); invUpd(); });
  }
  function invUpd(){
    let tot = 0; Object.values(sel).forEach(o=>tot += ROUTER_COST[o]);
    inv.textContent = 'your invoice: ₹'+tot.toFixed(1);
  }
  draw();
  $('.rcheck',node).onclick = ()=>{
    let right = 0, tot = 0, opt = 0, answered = 0;
    ROUTER_Q.forEach((it,i)=>{
      const v = $('#rv'+i,node); v.style.display = 'block';
      const s = sel[i]; opt += ROUTER_COST[it.a];
      if(!s){ v.textContent = 'not routed yet'; v.className = 'verdict mut'; return; }
      answered++; tot += ROUTER_COST[s];
      $$(`button[data-i="${i}"]`,list).forEach(b=>{
        if(b.dataset.o===it.a) b.classList.add('good'); else if(b.dataset.o===s) b.classList.add('bad');
      });
      if(s===it.a){ right++; v.textContent = '✓ correct'; v.className = 'verdict ok'; }
      else if(ROUTER_COST[s]>ROUTER_COST[it.a]){ v.textContent = '✗ works, but you paid ₹'+ROUTER_COST[s]+' for a ₹'+ROUTER_COST[it.a]+' question. The failure is the invoice.'; v.className = 'verdict warn'; }
      else { v.textContent = '✗ too cheap: a '+s+' path can’t answer this shape (relationship / multi-hop). The failure is the answer.'; v.className = 'verdict err'; }
    });
    pre.hidden = false;
    pre.textContent = right+'/6 routed correctly · your invoice ₹'+tot.toFixed(1)+' vs optimal ₹'+opt.toFixed(1)+
      '\n\nrelationship words (prerequisite, before, builds on, which lectures) → graph'+
      '\npersonal multi-part synthesis (plan, roadmap, "when will I…") → agentic'+
      '\neverything else → single. The cheap majority goes down the cheap path.';
    if(answered===ROUTER_Q.length){
      state.results.router = { right, tot:+tot.toFixed(1), opt:+opt.toFixed(1) }; persist();
      toast(right===6 ? '6/6. You are a working receptionist. Notice you never answered a single question.' : 'Compare the two invoices. Routing is the cost model as architecture.', right===6?'good':'');
    }
  };
  return node;
}

/* ---------- EX 10 · grounding audit ---------- */
function renderExGround(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Q: “What is the hallucination formula?”', `
      <div class="glabel">retrieved context</div>
      <div class="gr-src" data-s="1"><div class="st mono">[S1] Hallucination &amp; Grounding</div>Hallucination = uncertainty × forced response. Grounding pins the model to retrieved context and removes the forced response by allowing “I don’t know.”</div>
      <div class="gr-src" data-s="2"><div class="st mono">[S2] Evals</div>recall@k asks whether retrieval fetched the answer; faithfulness asks whether the generated answer is supported by what was fetched.</div>
      <div class="glabel">generated answer: click the sentences you don’t trust</div>
      <div class="gr-ans"></div>
      <div class="presets" style="margin-top:var(--space-3)"><button class="btn btn--primary acheck">Check the audit</button></div>
      <pre class="codeblk bts-pre" hidden></pre>`)}
  </div>`);
  const ans = $('.gr-ans',node), pre = $('.bts-pre',node);
  const flagged = new Set();
  const srcEls = { 1:$('[data-s="1"]',node), 2:$('[data-s="2"]',node) };
  function draw(){
    ans.innerHTML = '';
    AUDIT_S.forEach((s,i)=>{
      const sp = el(`<span class="sent ${flagged.has(i)?'flagged':''}" tabindex="0" role="button">${esc(s.t)} </span>`);
      const light = on=>{ srcEls[1].classList.toggle('lit', on && s.src===1); srcEls[2].classList.toggle('lit', on && s.src===2); };
      sp.onmouseenter = ()=>light(true); sp.onmouseleave = ()=>light(false);
      sp.onfocus = ()=>light(true); sp.onblur = ()=>light(false);
      sp.onclick = ()=>{ flagged.has(i)?flagged.delete(i):flagged.add(i); draw(); };
      sp.onkeydown = e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); sp.click(); } };
      ans.appendChild(sp);
    });
  }
  draw();
  $('.acheck',node).onclick = ()=>{
    [...ans.children].forEach((sp,i)=>{
      sp.classList.remove('flagged');
      sp.classList.add(AUDIT_S[i].src===0?'confirm-bad':'confirm-good');
    });
    const gotIt = flagged.has(3) && flagged.size===1;
    pre.hidden = false;
    pre.textContent = (gotIt?'Perfect audit. ':'The audit: ')+
      'Sentences 1–3 each pin to a retrieved source (hover them). Sentence 4 pins to NOTHING:\n'+
      'no retrieved passage mentions Karpathy or Lecture 9. It is fluent, specific, confident… and invented.\n\n'+
      'The two levers that stop it:\n  1. uncertainty pinned low  → answer ONLY from the context\n  2. forced response removed → "I haven’t written this up in my notes yet" is a legal answer\n\n'+
      'Sage’s faithfulness eval automates exactly the audit you just did by hand.';
    state.results.audit = gotIt; persist();
    toast(gotIt ? 'You flagged exactly the invented sentence. That instinct is the faithfulness eval.' : 'Sentence 4 was the invention: it cites a lecture that was never retrieved.', gotIt?'good':'bad');
  };
  return node;
}

/* ---------- EX 11 · the build order ---------- */
/* coverage state: every rung is a slider, 0 to 100% of query traffic */
function buildCoverage(){
  const saved = state.results.build || {};
  const cov = {};
  RUNGS.forEach(r=>{ cov[r.id] = 0; });
  if(saved.cov) RUNGS.forEach(r=>{ const v = +saved.cov[r.id]; if(v>=0 && v<=100) cov[r.id] = Math.round(v); });
  else if(Array.isArray(saved.on)) saved.on.forEach(id=>{ if(id in cov) cov[id] = 100; });  /* migrate the old switches */
  return cov;
}
function buildScore(cov){
  let kw = BUILD_FLOOR.kw, sem = BUILD_FLOOR.sem, spend = 0;
  RUNGS.forEach(r=>{
    const c = (cov[r.id]||0)/100; if(!c) return;
    kw = Math.min(BUILD_FLOOR.cap, kw + r.kw*c);
    sem = Math.min(BUILD_FLOOR.cap, sem + r.sem*c);
    spend += r.cost*c;
  });
  return { kw, sem, overall:.75*kw+.25*sem, spend:Math.round(spend) };
}
function renderExBuild(step){
  const node = el(`<div class="step step--build">
    ${stepHead(step)}

    <div class="probcard">
      <div class="btslabel mono">the problem · what the golden set says</div>
      <p class="body-sm">You wrote <strong>100 golden pairs</strong>, a real student query plus the one curriculum document that should answer it, and classified every pair. <strong>75 are keyword-style</strong>: the student uses the corpus’s own words (“what is LoRA training?”). <strong>25 are meaning-style</strong>: the student’s words never appear in the corpus (“why does my bot keep lying to students?” should retrieve <em>Hallucination &amp; Grounding</em>). That split is why overall recall weighs <code>0.75 × keyword + 0.25 × meaning</code>.</p>
      <pre class="codeblk">floor (FTS + metadata, free)     keyword 88%    meaning 32%    overall recall@6 = 74%</pre>
      <div class="anchor">${ic('target')} <span>Get overall recall@6 to <strong>85%</strong> for the smallest possible spend. Seven techniques collapse into five rungs: two free, three priced per 1,000 queries. Each one is a <strong>slider, not a switch</strong>, so you buy the fraction of traffic it covers and the cost scales with it. Partial coverage is legal, and that is the whole point.</span></div>
    </div>

    <div class="buildgrid">
      ${benchHTML('Spend wisely', `
        <div class="meter"><div class="mlab mono"><span>keyword-style queries (75 of 100)</span><b class="kwv"></b></div><div class="mbar"><i class="kwb"></i></div></div>
        <div class="meter"><div class="mlab mono"><span>meaning-style queries (25 of 100)</span><b class="semv"></b></div><div class="mbar"><i class="semb"></i></div></div>
        <div class="meter"><div class="mlab mono"><span><strong>overall recall@6</strong> · target 85%</span><b class="allv"></b></div><div class="mbar overall"><i class="allb"></i><span class="target" style="left:85%"><span class="tmark mono">target</span></span></div></div>
        <div class="rungs"></div>
        <div class="spend mono">spend: <b class="spendv">₹0</b> / 1,000 queries</div>
        <div class="buildmsg mut"></div>
        <div class="presets" style="margin:var(--space-3) 0 0"><button class="btn btn--secondary btn--sm breset">${ic('rotate-ccw')} Reset to the floor</button></div>`,
        'coverage in, recall and invoice out · the same numbers as the rest of the lab, made continuous')}

      ${benchHTML('Practice set · 8 of the 100 pairs, live', `
        <div class="pcount mono"><b class="pcv">0</b>/8 pairs retrieved in the top 6</div>
        <div class="pairs"></div>
        <p class="honest">No rung is “good” or “bad” in the abstract. A pair passes when the bar <em>it lives on</em> rises. If a rung you paid for flips no pairs, you bought the wrong rung.</p>`)}
    </div>

    <div class="bts"><div class="btslabel mono">behind the scenes · what each rung moved</div><pre class="codeblk bts-pre"></pre></div>
  </div>`);

  const rungWrap = $('.rungs',node), pairWrap = $('.pairs',node), pre = $('.bts-pre',node), msg = $('.buildmsg',node);
  const cov = buildCoverage();
  let won = false;

  RUNGS.forEach(r=>{
    rungWrap.appendChild(el(`<div class="rung" data-rung="${r.id}">
      <span class="rinfo"><span class="rn">${esc(r.n)}</span><span class="rs">${esc(r.s)}</span></span>
      <input type="range" min="0" max="100" step="1" value="${cov[r.id]}" data-r="${r.id}" aria-label="${esc(r.n)} coverage">
      <span class="rv mono"><b class="pct">0%</b><span class="rc ${r.cost?'paid':'free'}">${r.cost?'₹0/1k q':'free'}</span></span>
    </div>`));
  });
  BUILD_PAIRS.forEach((p,i)=>{
    pairWrap.appendChild(el(`<div class="pair" data-pair="${i}">
      <span class="st mono">✗</span>
      <span class="pbody">
        <span class="pq">${esc(p.q)}<span class="kind mono">${p.kind}</span></span>
        <span class="pd">should retrieve → <b>${esc(p.doc)}</b></span>
        <span class="need mono"></span>
      </span></div>`));
  });

  function calc(){
    const { kw, sem, overall, spend } = buildScore(cov);
    const lines = ['floor (FTS + metadata, free)'.padEnd(38)+'kw 88.0   sem 32.0   overall 74.0'];
    RUNGS.forEach(r=>{
      const row = $(`.rung[data-rung="${r.id}"]`,node), c = cov[r.id];
      $('.pct',row).textContent = c+'%';
      $('input',row).style.setProperty('--fill', c+'%');
      row.classList.toggle('active', c>0);
      if(r.cost) $('.rc',row).textContent = '₹'+Math.round(r.cost*c/100)+'/1k q';
    });
    /* the trace is cumulative, in rung order, so you can read where each point came from */
    let tk = BUILD_FLOOR.kw, ts = BUILD_FLOOR.sem;
    RUNGS.forEach(r=>{
      const c = cov[r.id]/100; if(!c) return;
      tk = Math.min(BUILD_FLOOR.cap, tk + r.kw*c); ts = Math.min(BUILD_FLOOR.cap, ts + r.sem*c);
      lines.push('+ '+(r.n.toLowerCase()+' ('+cov[r.id]+'%)').padEnd(36)+' kw '+tk.toFixed(1).padStart(4)+'   sem '+ts.toFixed(1).padStart(4)+'   overall '+(.75*tk+.25*ts).toFixed(1));
    });

    $('.kwv',node).textContent  = Math.round(kw)+'%';   $('.kwb',node).style.width  = kw+'%';
    $('.semv',node).textContent = Math.round(sem)+'%';  $('.semb',node).style.width = sem+'%';
    $('.allv',node).textContent = (Math.round(overall*10)/10)+'%'; $('.allb',node).style.width = overall+'%';
    $('.allb',node).classList.toggle('pass', overall>=BUILD_FLOOR.target);
    $('.semb',node).classList.toggle('bleed', sem<50);
    $('.spendv',node).textContent = '₹'+spend;

    if(overall>=BUILD_FLOOR.target){
      const rightRung = !cov.rewrite && !cov.rerank && cov.passport===100 && cov.graph===100;
      msg.className = 'buildmsg ok-t';
      if(rightRung && spend<=30){
        msg.textContent = '✓ target hit at the MINIMUM: free rungs maxed, then only the coverage the gap demanded.';
        if(!won){ won = true; toast('About ₹29. Free rungs first, then exactly enough semantic coverage to close a 5-point gap. That is eval-driven build order, bought by the metre.','good'); }
      } else if(rightRung){
        msg.textContent = '✓ target hit on the right rung. Cheaper still: how much semantic coverage does a 5-point gap actually need?';
      } else {
        msg.textContent = '✓ target hit. Could you get here cheaper? (hint: which bar was actually bleeding, and which rung is priced for it?)';
      }
    } else {
      msg.className = 'buildmsg mut';
      msg.textContent = overall>=80 ? 'close: look at which bar is still red, and which rung is priced for it' : '';
    }

    let pass = 0;
    BUILD_PAIRS.forEach((p,i)=>{
      const ok = (p.bar==='kw'?kw:sem) >= p.need; if(ok) pass++;
      const row = $(`.pair[data-pair="${i}"]`,node);
      row.classList.toggle('pass', ok);
      $('.st',row).textContent = ok ? '✓' : '✗';
      $('.need',row).textContent = ok ? 'retrieved in top 6' : ('needs the '+(p.bar==='kw'?'keyword':'meaning')+' bar at '+p.need+'%');
    });
    $('.pcv',node).textContent = pass;

    pre.textContent = lines.join('\n') + (lines.length>1
      ? '\n\nread the trace: every rupee should move the bar that was failing.\nif it moved the healthy bar, you bought the wrong rung.'
      : '\nnothing bought yet: drag a slider and watch the split, not the total.');

    state.results.build = { cov:{...cov} }; persist();
  }

  $$('input[data-r]',rungWrap).forEach(i=>i.oninput = ()=>{ cov[i.dataset.r] = +i.value; calc(); });
  $('.breset',node).onclick = ()=>{
    RUNGS.forEach(r=>{ cov[r.id] = 0; });
    $$('input[data-r]',rungWrap).forEach(i=>{ i.value = 0; });
    won = false; calc();
  };
  calc();
  return node;
}

/* ---------- EX 11, continued · the solution ---------- */
function renderBuildSolution(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="lockednote">
      <p class="body-sm">You cannot un-see this. Drag the sliders yourself before you read it: the lesson is the moment a paid rung moves the bar that was already healthy.</p>
      <button class="btn btn--primary sreveal">${ic('key-round')} Reveal the solution</button>
    </div>
    <div class="solbody" hidden>
      <h3 class="solh">Step 1 · Read the split before spending</h3>
      <p class="body">The floor is not “74% bad”. It is <strong>88% healthy</strong> on keyword queries and <strong>32% bleeding</strong> on meaning queries. One number is a grade; the split is a roadmap. The 25 meaning-style pairs are the failing subset, so every rupee has to land on the meaning bar.</p>

      <h3 class="solh">Step 2 · Exhaust the free rungs</h3>
      <pre class="codeblk">+ contextual retrieval (100%)    kw 88→92   sem 32→38   overall 78.5   ₹0
+ knowledge graph (100%)         kw 92→94   sem 38→38   overall 80.0   ₹0</pre>
      <p class="body">Contextual retrieval is a one-time indexing cost; the graph is built from links the curriculum data already carries. Six points of overall recall for nothing. Never pay before the free rungs are maxed.</p>

      <h3 class="solh">Step 3 · The failing bar names the one paid rung</h3>
      <p class="body">You are at 80, five points short, and the meaning bar sits at 38. Three paid rungs exist:</p>
      <div class="tblwrap"><table class="uc"><tr><th>rung</th><th>cost at 100%</th><th>where its gain lands</th><th>verdict</th></tr>${
        BUILD_PAID_TABLE.map(r=>`<tr class="${r[4]?'win':''}"><td>${esc(r[0])}</td><td class="mono">${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td>${r[4]?'<strong>'+esc(r[3])+'</strong>':esc(r[3])}</td></tr>`).join('')
      }</table></div>

      <h3 class="solh">Step 4 · The slider insight: buy only the coverage the gap needs</h3>
      <p class="body">With switches, the answer is semantic at 100% for <strong>₹40</strong>, giving keyword 94, meaning 66, overall <strong>87%</strong>. The sliders let you ask a sharper question. The gap is 5 overall points, and semantic contributes <code>0.25 × 28 × coverage</code>:</p>
      <pre class="codeblk">need:  0.25 × 28 × coverage ≥ 5   →   coverage ≥ 72%
buy :  contextual retrieval 100% (₹0) + graph 100% (₹0) + semantic 72% (≈₹29)
get :  kw 94   meaning 58   overall 85    target hit at ≈₹29 / 1,000 queries</pre>
      <div class="anchor">${ic('anchor')} <span>Minimum build: <strong>free rungs first, then exactly enough of the one rung the failing bar demanded.</strong> ₹29 with sliders, ₹40 with switches, and ₹0 of it spent on rungs the healthy bar never asked for.</span></div>

      <h3 class="solh">Step 5 · Why the tempting wrong builds are wrong</h3>
      ${BUILD_WRONG.map(w=>`<div class="wrongbuild"><h4>✗ ${esc(w.h)}</h4><p>${esc(w.p)}</p></div>`).join('')}

      <h3 class="solh">The takeaway</h3>
      <div class="anchor">${ic('trending-up')} <span>The metric is not a grade; it is the roadmap. The failing subset <em>is</em> the build order, and coverage sliders mean you can buy that roadmap by the metre instead of by the kilometre.</span></div>
      <p class="honest">When you fork this for your own corpus, your first deliverable is not code. It is a domain model and 100 golden pairs. Whoever models the domain owns the design.</p>
    </div>
  </div>`);
  const body = $('.solbody',node), lock = $('.lockednote',node);
  if(state.results.buildSolved){ lock.hidden = true; body.hidden = false; }
  $('.sreveal',node).onclick = ()=>{
    lock.hidden = true; body.hidden = false;
    state.results.buildSolved = true; persist(); icons();
    toast('Free rungs first, then exactly the coverage the failing bar demanded. Nothing else is engineering.','good');
  };
  return node;
}

/* ---------- EX 12 · the chooser ---------- */
function renderExChooser(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Three questions, one stack', `
      <div class="rq-list"></div>
      <div class="presets"><button class="btn btn--primary cgo">Get the verdict</button></div>
      <div class="glabel" hidden>the verdict</div>
      <div class="results"></div>`)}
    <div class="bts"><div class="btslabel mono">the field guide · six common corpora</div>
      <div class="tblwrap"><table class="uc"><tr><th>use case</th><th>the floor</th><th>first paid technique</th><th>tool class</th></tr>${
        FIELD_GUIDE.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')
      }</table></div></div>
  </div>`);
  const list = $('.rq-list',node), out = $('.results',node), vlab = $$('.glabel',node)[0];
  const sel = (state.results.chooser && state.results.chooser.sel) || {};
  function draw(){
    list.innerHTML = '';
    CHOOSER_Q.forEach(g=>{
      const d = el(`<div class="rq"><div class="qq">${esc(g.q)}</div><div class="opts">${
        g.opts.map(([v,l])=>`<button data-g="${g.id}" data-v="${v}" class="${sel[g.id]===v?'sel':''}">${esc(l)}</button>`).join('')
      }</div></div>`);
      list.appendChild(d);
    });
    $$('button[data-g]',list).forEach(b=>b.onclick = ()=>{ sel[b.dataset.g] = b.dataset.v; draw(); });
  }
  draw();
  function verdict(){
    const c = sel.corpus, m = sel.mix, st = sel.stage;
    const out = [];
    if(c==='fits'){
      out.push({ t:'No RAG', x:'The whole corpus fits in the context window, so load it (with prompt caching) and skip retrieval entirely. The best retrieval system is the one you never built. Write the 100 golden pairs anyway; the day the corpus outgrows the window, they become your floor eval on day one.' });
      if(m==='rel') out.push({ t:'Relationships in-context', x:'With everything in the window the model can read the edges itself. Revisit the graph only when the corpus leaves the window.' });
      return out;
    }
    out.push({ t:'The floor, always first', x:'Full-text search plus metadata filters inside the database you already run: Postgres or Supabase FTS, SQLite FTS5, or the Elasticsearch you already pay for. Measure recall@k on your pairs before buying anything.' });
    if(m==='kw') out.push({ t:'Then stop', x:'Your split says the floor carries it. Apply contextual retrieval at indexing (free) and hold. Do not add embeddings until the meaning bar bleeds in your own eval, not in a vendor demo.' });
    if(m==='sem') out.push({ t:'Embeddings, inside the same database', x:'pgvector on the Postgres or Supabase you already run, plus the rewrite lexicon harvested from your failed queries. A dedicated vector database earns its place only when scale or latency genuinely breaks pgvector, and it arrives with a second system of record to keep in sync.' });
    if(m==='rel') out.push({ t:'Graph from structure you already own', x:'Existing links, foreign keys, and folder trees are a free graph; route relationship queries to traversal. Multi-hop questions get a bounded search loop (search as a tool, hard hop cap). A graph database earns its place only when traversal depth breaks the simple version.' });
    if(c==='huge') out.push({ t:'At this size, ingestion is the product', x:'Chunk on meaning, apply contextual retrieval at indexing, and for long structured documents (the financial and legal pattern) consider reasoning over a document index (the PageIndex pattern) before any similarity machinery.' });
    if(st==='mvp') out.push({ t:'MVP rule', x:'One paid technique maximum, no reranker, no second system of record. Ship, log the failed queries, and let the failing bucket name the next purchase.' });
    if(st==='prod') out.push({ t:'Production adds two non-negotiables', x:'A cross-encoder rerank stage over the top 20, and a faithfulness eval on every answer. Grounding is a launch gate, not a polish item.' });
    return out;
  }
  $('.cgo',node).onclick = ()=>{
    if(!sel.corpus || !sel.mix || !sel.stage){ toast('Answer all three questions first: the tool cannot be chosen before the corpus and the query mix are.','bad'); return; }
    const v = verdict();
    vlab.hidden = false;
    out.innerHTML = v.map((r,i)=>`<div class="rdoc ${i===0?'hit':''}"><div class="rt"><span>${i+1}. ${esc(r.t)}</span></div><div class="rx">${esc(r.x)}</div></div>`).join('');
    state.results.chooser = { sel:{...sel}, summary: [sel.corpus,sel.mix,sel.stage].map(x=>CHOOSER_LABEL[x]).join(' · ')+' → '+v.map(r=>r.t).join('; ') };
    persist();
    toast('Notice the verdict never opened with a vendor. Corpus and query mix first; the tool is a consequence.','good');
  };
  return node;
}

/* ---------- receipt ---------- */
function buildReceipt(){
  const names = { passport:'contextual retrieval', graph:'graph', semantic:'semantic', rewrite:'rewrite+HyDE', rerank:'rerank' };
  const cov = buildCoverage();
  const { overall, spend } = buildScore(cov);
  const techniques = RUNGS.filter(r=>cov[r.id]>0).map(r=>(names[r.id]||r.id)+' '+cov[r.id]+'%');
  const r = state.results;
  return [
    '100xEngineers · Context Engineering → Advanced RAG · Done Equals receipt',
    'date        : '+new Date().toISOString().slice(0,10),
    'progress    : step '+(state.maxReached+1)+'/'+TOTAL+' reached',
    'the map (P1): '+(r.mapRoute ? r.mapRoute.right+'/4 routed at the cheapest passing layer' : 'not attempted'),
    'router (9)  : '+(r.router ? r.router.right+'/6 correct · invoice ₹'+r.router.tot+' vs optimal ₹'+r.router.opt : 'not attempted'),
    'audit (10)  : '+(typeof r.audit==='boolean' ? (r.audit?'flagged exactly the invented sentence':'attempted; missed the invented sentence') : 'not attempted'),
    'build (11)  : '+(techniques.length?techniques.join(' + '):'floor only')+' · spend ₹'+spend+'/1k queries · overall recall@6 '+(Math.round(overall*10)/10)+'% (target 85%)',
    'chooser (12): '+((r.chooser && r.chooser.summary) || 'not attempted'),
    '',
    'Post this in your track channel. A facilitator verifies it against the lab;',
    'the receipt is the Done Equals gate, the claim is not.',
  ].join('\n');
}
function renderReceipt(step){
  const node = el(`<div class="step">
    ${stepHead(step)}
    <pre class="codeblk receipt-pre">(generate your receipt)</pre>
    <div class="presets">
      <button class="btn btn--secondary rgen">${ic('file-check')} Generate receipt</button>
      <button class="btn btn--primary rcopy" disabled>${ic('copy')} Copy receipt</button>
    </div>
  </div>`);
  const pre = $('.receipt-pre',node), copy = $('.rcopy',node);
  $('.rgen',node).onclick = ()=>{
    pre.textContent = buildReceipt();
    copy.disabled = false;
    toast('Receipt generated. Copy it and post it; behavioural evidence outranks the claim.','good');
  };
  copy.onclick = ()=>{
    const txt = pre.textContent;
    const fallback = ()=>{
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); toast('Receipt copied.','good'); }catch(e){ toast('Copy failed; select the text and copy manually.','bad'); }
      document.body.removeChild(ta);
    };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>toast('Receipt copied. Post it in your track channel.','good')).catch(fallback);
    else fallback();
  };
  return node;
}

/* ---------- zoom table ---------- */
function renderZoomTable(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    <div class="tblwrap"><table class="uc zoomt">
      <tr><th></th><th>the app (Part 1)</th><th>inside L3 (the lab)</th></tr>
      ${ZOOM_ROWS.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}
    </table></div>
    <div class="anchor" style="margin-top:var(--space-5)">${ic('anchor')} Measure → diagnose → buy exactly one thing the biggest failing bucket names → re-measure. The procedure is <strong>scale-free</strong>. Point it at any layer and it opens the same way L3 just did.</div>
  </div>`);
  return node;
}

/* ---------- closing ---------- */
function renderClosing(step){
  return el(`<div class="step">
    <div class="cert">
      <h1>${step.title}</h1>
      <p class="body">${step.body}</p>
      <p class="caption">Done Equals for this lecture: the Exercise 12 receipt, posted in your track channel, verified by a facilitator against this lab. The claim is not the gate; the receipt is.</p>
    </div>
  </div>`);
}

const RENDER = {
  intro:renderIntro, question:renderQuestion, reveal:renderReveal, quiz:renderQuiz,
  basemodel:renderBasemodel, buckets:renderBuckets, stack:renderStack, ttgame:renderTT,
  routegame:renderRouteGame, sevenbuckets:renderSevenBuckets, l3map:renderL3Map,
  exsearch:renderExSearch, exmeaning:renderExMeaning, exchunks:renderExChunks, exorphan:renderExOrphan,
  exfusion:renderExFusion, exrewrite:renderExRewrite, exrerank:renderExRerank, exgraph:renderExGraph,
  exloop:renderExLoop, exrouter:renderExRouter, exground:renderExGround, exbuild:renderExBuild,
  buildsolution:renderBuildSolution, exchooser:renderExChooser, receipt:renderReceipt, zoomtable:renderZoomTable, closing:renderClosing,
};

/* ---------- boot ---------- */
$('#homeLink').onclick = ()=>goStep(0);
$('#resetBtn').onclick = ()=>{ if(confirm('Wipe all progress?')){ localStorage.removeItem(LS_KEY); location.reload(); } };
$('#menuBtn').onclick = ()=>$('#sidebar').classList.contains('open')?closeSidebar():openSidebar();
$('#scrim').onclick = ()=>{ closeSidebar(); $('#menuBtn').focus(); };
document.addEventListener('keydown', e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if(e.key==='Escape' && $('#sidebar').classList.contains('open')){ closeSidebar(); return; }
  if(e.key==='ArrowRight'){ const c = $('#continueBtn'); if(!c.disabled && state.pos<TOTAL-1) goStep(state.pos+1); }
  if(e.key==='ArrowLeft' && state.pos>0) goStep(state.pos-1);
});
render(); icons();
