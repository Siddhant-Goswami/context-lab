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
    wrap.appendChild(el(`<div class="stackrow ${L.hot?'hot':''}">
      <span class="lb">${L.lb}</span>
      <div class="sr-body"><strong>${esc(L.name)}</strong><span class="d">${esc(L.d)}</span></div>
      <span class="cost">${esc(L.cost)}</span></div>`));
  });
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
      <div><h5>${esc(b.name)}</h5><p>${esc(b.d)}</p></div>
      <span class="sb-ex mono">${esc(b.ex)}</span></div>`));
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

/* ---------- EX 3a · chunking bench ---------- */
function renderExChunks(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Cutting one wiki page into chunks', `
      <div class="presets">
        <button class="btn btn--secondary btn--sm cut-naive">Naive: every 180 chars</button>
        <button class="btn btn--primary btn--sm cut-smart">On meaning: by heading</button>
      </div>
      <div class="chunkdoc"></div>`)}
  </div>`);
  const doc = $('.chunkdoc',node);
  function draw(naive){
    doc.innerHTML = '';
    if(!naive){
      CHUNK_DOC.body.forEach((sec,i)=>{
        doc.appendChild(el(`<div class="ch"><span class="cid mono">chunk ${i+1} · “${esc(CHUNK_DOC.title)} › ${esc(sec[0])}”</span>${esc(sec[1])}</div>`));
      });
    } else {
      const full = CHUNK_DOC.body.map(s=>s[1]).join(' ');
      let i = 0, n = 1;
      while(i < full.length){
        const piece = full.slice(i, i+180);
        const cutMid = (i+180 < full.length) && !/[.!?]\s*$/.test(piece);
        doc.appendChild(el(`<div class="ch ${cutMid?'bad':''}"><span class="cid mono">chunk ${n} · chars ${i}–${i+piece.length}${cutMid?' · cut mid-thought':''}</span>${esc(piece)}${cutMid?' <span class="cut">✂ sliced here</span>':''}</div>`));
        i += 180; n++;
      }
      toast('The red chunks are future citations. Fluent, source-tagged, and wrong.','bad');
    }
  }
  $('.cut-naive',node).onclick = ()=>draw(true);
  $('.cut-smart',node).onclick = ()=>draw(false);
  draw(false);
  return node;
}

/* ---------- EX 3b · orphan demo ---------- */
function renderExOrphan(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('The orphan demo', `
      <div class="sim-in"><input class="input" value="Which flag do I redeploy with?" readonly aria-label="Student question (locked)"><button class="btn btn--primary go">Search</button><button class="btn btn--secondary stamp">Stamp passports</button></div>
      <div class="glabel">retrieved</div>
      <div class="results"><div class="rdoc mut"><div class="rx">search to feel the orphan failure</div></div></div>`)}
    <p class="honest">Honest note: this bench replays one fixed query (the box is locked) so every student feels the same orphan failure. The passport move itself is real: same chunk, one situating sentence, written once at indexing time.</p>
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
    passport = true; this.textContent = 'Passports stamped ✓'; this.disabled = true; run();
    toast('One sentence per chunk, written once at indexing time. Anthropic: −35% failed retrievals.','good');
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
      <div class="sim-in"><input class="input" value="When will I learn how to automate my job?" readonly aria-label="Student question (locked)"><button class="btn btn--primary rw">Rewrite</button><button class="btn btn--secondary hyde">HyDE</button></div>
      <div class="glabel">search key actually used</div>
      <div class="keybox"><span class="mut">the raw query, so far</span></div>
      <div class="glabel">retrieved</div>
      <div class="results"><div class="rdoc mut"><div class="rx">rewrite or HyDE to see the move</div></div></div>`)}
    <div class="bts"><div class="btslabel mono">the meaning-space map · watch where the probe lands</div>
      <div class="mapwrap"><canvas class="spacemap" width="560" height="300"></canvas></div>
      <pre class="codeblk bts-pre">(rewrite or HyDE to see the move)</pre></div>
    <p class="honest">Honest note: the rewrite and the HyDE probe are precomputed for this one query (the box is locked) so you can feel the move without an API key. In real Sage a cheap LLM produces both, live, from the lexicon. The decision logic is identical.</p>
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
    keybox.innerHTML = '<b>HyDE probe (a hallucinated answer):</b> '+esc(HYDE_KEY);
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
    ${benchHTML('Candidates in bi-encoder order: fix the ranking', `
      <div class="cands"></div>
      <div class="presets" style="margin-top:var(--space-3)">
        <button class="btn btn--primary btn--sm runce">Run cross-encoder</button>
        <button class="btn btn--secondary btn--sm resetce">Reset order</button>
      </div>
      <div class="costnote" hidden>
        <div class="costbox badc"><b class="mono">cross-encode everything</b>951 chunks × every query, one model pass per pair. Unshippable.</div>
        <div class="costbox goodc"><b class="mono">staged (what Sage does)</b>cheap search screens ~20 → cross-encoder judges those → top 6 to the generator.</div>
      </div>`)}
    <div class="bts"><div class="btslabel mono">behind the scenes</div><pre class="codeblk bts-pre">Bi-encoder: query and chunks embedded separately, in mutual ignorance → fast, blind ranking.
Cross-encoder: reads (query + chunk) together per pair → accurate, expensive. Run it to see scores.</pre></div>
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
    pre.textContent = 'Cross-encoder scores (query + chunk judged TOGETHER):\n'+
      RERANK_C.map(c=>'  '+c.ce.toFixed(2)+'  '+c.t.slice(0,58)+'…').join('\n')+
      '\n\nYour #1 pick '+(RERANK_C[myTop].answer
        ? 'matched the cross-encoder. You read query and chunk together. That IS the algorithm.'
        : 'differed. Compare with the 0.95 chunk: it answers BOTH halves of the question (what MCP is + what problem it solves).');
    toast(RERANK_C[myTop].answer
      ? 'You out-ranked the bi-encoder. Now imagine paying for that judgement 951 times per query.'
      : 'The cross-encoder promotes the chunk that answers both halves. Cheap retrieval finds; expensive judgement decides.', RERANK_C[myTop].answer?'good':'');
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
      '\neverything else → single. The cheap 75% goes down the cheap path.';
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
function renderExBuild(step){
  const node = el(`<div class="step step--wide">
    ${stepHead(step)}
    ${benchHTML('Reach 85% overall recall for the least money', `
      <div class="meter"><div class="mlab mono"><span>keyword-style queries</span><b class="kwv">88%</b></div><div class="mbar"><i class="kwb" style="width:88%"></i></div></div>
      <div class="meter"><div class="mlab mono"><span>meaning-style queries</span><b class="semv">32%</b></div><div class="mbar"><i class="semb" style="width:32%"></i></div></div>
      <div class="meter"><div class="mlab mono"><span><strong>overall recall@6</strong> · target 85%</span><b class="allv">74%</b></div><div class="mbar overall"><i class="allb" style="width:74%"></i><span class="target" style="left:85%"></span></div></div>
      <div class="toggles"></div>
      <div class="spend mono">spend: <b class="spendv">₹0</b> / 1,000 queries <span class="buildmsg"></span></div>`)}
    <div class="bts"><div class="btslabel mono">behind the scenes · what each rung moved</div><pre class="codeblk bts-pre">floor (free)                     kw 88   sem 32   overall 74
toggle rungs to watch the split move: the failing subset is your roadmap</pre></div>
  </div>`);
  const toggles = $('.toggles',node), pre = $('.bts-pre',node);
  const on = new Set((state.results.build && state.results.build.on) || []);
  RUNGS.forEach(r=>{
    const d = el(`<label class="tg"><input type="checkbox" data-r="${r.id}" ${on.has(r.id)?'checked':''}>
      <span class="tinfo"><span class="tname">${esc(r.n)}</span><span class="tsub">${esc(r.s)}</span></span>
      <span class="tcost mono ${r.cost?'paid':'free'}">${r.cost?('₹'+r.cost+'/1k q'):'free'}</span></label>`);
    toggles.appendChild(d);
  });
  function calc(){
    let kw = 88, sem = 32, spend = 0;
    const lines = ['floor (free)                     kw 88   sem 32   overall 74'];
    RUNGS.forEach(r=>{ if(on.has(r.id)){
      kw = Math.min(97,kw+r.kw); sem = Math.min(97,sem+r.sem); spend += r.cost;
      lines.push('+ '+r.n.toLowerCase().padEnd(29)+' kw '+String(kw).padStart(2)+'   sem '+String(sem).padStart(2)+'   overall '+Math.round(.75*kw+.25*sem));
    }});
    const overall = Math.round(.75*kw+.25*sem);
    $('.kwv',node).textContent = kw+'%';   $('.kwb',node).style.width = kw+'%';
    $('.semv',node).textContent = sem+'%'; $('.semb',node).style.width = sem+'%';
    $('.allv',node).textContent = overall+'%'; $('.allb',node).style.width = overall+'%';
    $('.allb',node).classList.toggle('pass', overall>=85);
    $('.semb',node).classList.toggle('bleed', sem<50);
    $('.spendv',node).textContent = '₹'+spend;
    const msg = $('.buildmsg',node);
    if(overall>=85){
      const minimal = on.has('semantic') && on.has('passport') && on.has('graph') && !on.has('rewrite') && !on.has('rerank');
      msg.textContent = minimal ? '✓ target hit at the MINIMUM spend: free rungs first, then the one paid rung the failing bar pointed at.'
        : '✓ target hit. Could you get here cheaper? (hint: which bar was actually bleeding?)';
      msg.className = 'buildmsg ok-t';
      if(minimal) toast('₹40. Free rungs first, then exactly the paid rung the semantic bar demanded. That is eval-driven build order.','good');
    } else {
      msg.textContent = overall>=80 ? 'close: look at which bar is still red' : '';
      msg.className = 'buildmsg mut';
    }
    pre.textContent = lines.join('\n')+(on.size?'\n\nread the trace: every rung you bought should move the bar that was failing.\nif it moved the healthy bar, you bought the wrong rung.':'');
    state.results.build = { on:[...on] }; persist();
  }
  $$('input[data-r]',toggles).forEach(i=>i.onchange = ()=>{ i.checked?on.add(i.dataset.r):on.delete(i.dataset.r); calc(); });
  calc();
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
      <div class="tblwrap"><table class="uc"><tr><th>use case</th><th>the floor</th><th>first paid rung</th><th>tool class</th></tr>${
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
    if(m==='kw') out.push({ t:'Then stop', x:'Your split says the floor carries it. Stamp contextual passports at indexing (free) and hold. Do not add embeddings until the meaning bar bleeds in your own eval, not in a vendor demo.' });
    if(m==='sem') out.push({ t:'Embeddings, inside the same database', x:'pgvector on the Postgres or Supabase you already run, plus the rewrite lexicon harvested from your failed queries. A dedicated vector database earns its place only when scale or latency genuinely breaks pgvector, and it arrives with a second system of record to keep in sync.' });
    if(m==='rel') out.push({ t:'Graph from structure you already own', x:'Wikilinks, foreign keys, and folder trees are a free graph; route relationship queries to traversal. Multi-hop synthesis gets a bounded agentic loop (search as a tool, hard hop cap). A graph database earns its place only when traversal depth breaks the simple version.' });
    if(c==='huge') out.push({ t:'At this size, ingestion is the product', x:'Chunk on meaning, stamp passports at indexing, and for long structured documents (the financial and legal pattern) consider reasoning over a document index (the PageIndex pattern) before any similarity machinery.' });
    if(st==='mvp') out.push({ t:'MVP rule', x:'One paid rung maximum, no reranker, no second system of record. Ship, log the failed queries, and let the failing bucket name the next purchase.' });
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
  const names = { passport:'passports', graph:'graph', semantic:'semantic', rewrite:'rewrite+HyDE', rerank:'rerank' };
  const on = new Set((state.results.build && state.results.build.on) || []);
  let kw = 88, sem = 32, spend = 0;
  RUNGS.forEach(r=>{ if(on.has(r.id)){ kw = Math.min(97,kw+r.kw); sem = Math.min(97,sem+r.sem); spend += r.cost; } });
  const overall = Math.round(.75*kw+.25*sem);
  const rungs = [...on].map(id=>names[id]||id);
  const r = state.results;
  return [
    '100xEngineers · Context Engineering → Advanced RAG · Done Equals receipt',
    'date        : '+new Date().toISOString().slice(0,10),
    'progress    : step '+(state.maxReached+1)+'/'+TOTAL+' reached',
    'the map (P1): '+(r.mapRoute ? r.mapRoute.right+'/4 routed at the cheapest passing layer' : 'not attempted'),
    'router (9)  : '+(r.router ? r.router.right+'/6 correct · invoice ₹'+r.router.tot+' vs optimal ₹'+r.router.opt : 'not attempted'),
    'audit (10)  : '+(typeof r.audit==='boolean' ? (r.audit?'flagged exactly the invented sentence':'attempted; missed the invented sentence') : 'not attempted'),
    'build (11)  : '+(rungs.length?rungs.join(' + '):'floor only')+' · spend ₹'+spend+'/1k queries · overall recall '+overall+'%',
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
      <div class="big">min(context)</div>
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
  exchooser:renderExChooser, receipt:renderReceipt, zoomtable:renderZoomTable, closing:renderClosing,
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
