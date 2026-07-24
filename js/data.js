/* ============================================================
   THE CONTEXT LAB: content
   Context Engineering → Advanced RAG, as a derivation.
   Part 1 builds the map. The bridge opens the L3 box.
   Twelve exercises run every part of Sage's retrieval brain
   in the browser. Part 3 zooms back out.
   ============================================================ */

/* ---------- the mini corpus (12 curriculum pages Sage searches) ---------- */
const DOCS = [
 { k:'rag', t:'Retrieval-Augmented Generation', m:'full-stack',
   x:'RAG retrieves the passages that hold the answer, augments the prompt with them, and generates a grounded, cited reply. Retrieval-augmented generation is how your app answers from your corpus instead of its training data.',
   tags:['retrieval','search','grounding','context','knowledge'] },
 { k:'hallucination-and-grounding', t:'Hallucination & Grounding', m:'full-stack',
   x:'Hallucination = uncertainty times forced response. Grounding pins the model to retrieved context and removes the forced response by allowing "I don\'t know". Trustworthy answers come from deterministic verification, not vibes.',
   tags:['hallucination','grounding','trust','truth'] },
 { k:'tool-calling-architecture', t:'Tool-Calling Architecture', m:'full-stack',
   x:'A tool call has three layers: the LLM chooses the tool and arguments, an execution layer runs it, and the result returns as context. Function calling is how a model acts on the world.',
   tags:['tools','function-calling','integration'] },
 { k:'mcp-model-context-protocol', t:'MCP: Model Context Protocol', m:'agents',
   x:'MCP, the Model Context Protocol, solves the N times M integration problem: one protocol so any client can call any tool server. REST for AI.',
   tags:['tools','protocol','integration'] },
 { k:'react-framework', t:'The ReAct Framework', m:'agents',
   x:'ReAct loops thought, action, observation: the model reasons, calls a tool, reads the result, and repeats until the task is done.',
   tags:['agent','loop','reasoning'] },
 { k:'aaa-agent-progression', t:'The AAA Agent Progression', m:'agents',
   x:'The AAA progression moves you from Assistant (you drive) to Automation (it runs a workflow) to Autonomous agent (it decides). This is the path to automating real work with agentic workflows.',
   tags:['agent','automation','workflow','autonomy'] },
 { k:'lora-training', t:'LoRA Training', m:'diffusion',
   x:'LoRA training fine-tunes a diffusion model on your own photos with a trigger word and a low-rank adapter, so it can generate you.',
   tags:['training','custom-model','image'] },
 { k:'diffusion-models', t:'Diffusion Models', m:'diffusion',
   x:'Diffusion models generate an image by denoising: start from pure noise and remove it step by step toward the prompt.',
   tags:['image','generation','visual'] },
 { k:'embeddings', t:'Embeddings', m:'full-stack',
   x:'Embeddings turn text into vectors so closeness in space means closeness in meaning; cosine similarity finds nearest neighbours.',
   tags:['meaning','vectors','similarity'] },
 { k:'evals', t:'Evals: Golden Pairs', m:'full-stack',
   x:'Evals use golden pairs of query and expected document. recall@k asks whether retrieval fetched the answer; faithfulness asks whether the generated answer used it.',
   tags:['testing','measurement','quality'] },
 { k:'llm-fine-tuning', t:'LLM Fine-Tuning', m:'full-stack',
   x:'Fine-tuning (SFT) teaches a model new behaviour; RAG gives it new knowledge. Choose by asking whether your gap is skills or facts.',
   tags:['training','custom-model','sft'] },
 { k:'ship-cycle', t:'The Ship Cycle', m:'full-stack',
   x:'The ship cycle: scope an MVP, build the cheapest slice first, launch weekly, and let usage - never vibes - pick the next investment.',
   tags:['mvp','launch','revenue'] },
];

const STOP = new Set(['the','a','an','is','are','was','what','how','my','i','me','to','of','in','on','for','and','or','it','does','do','with','that','this','will','when','learn','you','your']);

/* student-language → corpus-concept neighbourhoods (precomputed embeddings stand-in) */
const MEANING = {
  lying:['hallucination','grounding'], lies:['hallucination'], lie:['hallucination'],
  hallucinating:['hallucination'], trust:['trust','grounding'], truth:['truth','grounding'],
  automate:['automation','agent','workflow'], job:['workflow','automation'], work:['workflow'],
  images:['image','visual','generation'], image:['image'], pictures:['image','visual'], make:['generation'],
  money:['revenue','mvp','launch'], test:['testing','measurement'], measure:['measurement'],
  meaning:['meaning','vectors'], similar:['similarity'], search:['search','retrieval'],
  documents:['retrieval','search'], connect:['integration','tools'], integrations:['integration'],
  agents:['agent'], agent:['agent'], loop:['loop'], stop:['grounding'],
};

/* ---------- start: ask the base model ---------- */
const BASE_QA = [
  { q:'What is an API?', ok:true,
    a:'An API is a contract that lets one program call another: you send a request in an agreed shape, you get a response in an agreed shape.',
    note:'Correct: this was all over the training data. L0 passes. Ship it, buy nothing.' },
  { q:'Which track should I choose at 100xEngineers?', ok:false,
    a:'Great question! The Applied AI track is ideal for beginners, while the GenAI Engineering track suits developers. I’d recommend the Applied AI track for the strongest career outcomes.',
    note:'Fluent, specific, confident, and invented. The real track details were never in the training data. It is guessing.' },
  { q:'What is Sage’s refund policy?', ok:false,
    a:'Sage offers a standard 30-day money-back guarantee on all purchases, no questions asked.',
    note:'There is no such policy: the model has never seen your internal docs. Same disease: a supply problem, not an intelligence problem.' },
];

/* ---------- the four buckets (guess-then-flip) ---------- */
const BUCKETS4 = [
  { gap:'Knowledge gap', symptom:'Stable facts never published: tracks, policies, internal docs.', fix:'In-context (L1)', why:'The information is static, small, reusable: put it in the prompt.' },
  { gap:'Freshness gap', symptom:'Changes between requests: weather, order status, inventory.', fix:'Tool calling (L2)', why:'It is stale the moment you save the file: fetch it at request time.' },
  { gap:'Scale gap', symptom:'The information exists but you cannot afford to send all of it, every time.', fix:'RAG (L3)', why:'A selection strategy: which few pieces deserve the window for this question.' },
  { gap:'Behaviour gap', symptom:'Right knowledge, wrong format or reasoning style.', fix:'Instructions + few-shot', why:'Not a supply problem at all: show it how, don’t feed it more.' },
];

/* ---------- the four layers ---------- */
const LAYERS = [
  { lb:'L0', name:'Base model', d:'Training knowledge alone: “What is an API?”', cost:'free' },
  { lb:'L1', name:'In-context: put it in the room', d:'Static docs, instructions, few-shot examples in the prompt. Closes buckets 1 and 4. One page of track info turns the hallucinated recommendation into a correct answer. The token cost repeats on every request, fine for one page, ruinous for a thousand.', cost:'prompt tokens, per request' },
  { lb:'L2', name:'Tools: fetch it at request time', d:'“Weather right now?” cannot live in a system prompt. Closes bucket 2. But “hourly weather for ten years, analyse the patterns” breaks it: the API can return millions of records, the model cannot receive them. The tool did its job; the failure is the handoff.', cost:'2 model passes + tool tokens' },
  { lb:'L3', name:'RAG: a bouncer for the context window', d:'Not a way to access information: tools already do that. A selection strategy: which few pieces of a large base deserve the window for this question. Closes bucket 3. Chunking and indexing are paid once, at indexing time; sending everything is paid on every query, forever.', cost:'infrastructure + indexing', hot:true },
];

/* ---------- per-layer cost math (collapsible example) ---------- */
const COST_DETAIL = {
  L0:{ headline:'model inference only', rows:[
    ['the question','“What is an API?” ≈ 10 tokens in'],
    ['added context','none'],
    ['the answer','≈ 60 tokens out'] ],
    note:'Nothing is added to the prompt. You pay for the question and the answer, nothing more.' },
  L1:{ headline:'static context, re-sent on every request', rows:[
    ['the question','≈ 10 tokens'],
    ['one page of track info in the prompt','≈ 800 tokens, on every single request'],
    ['the answer','≈ 60 tokens'] ],
    note:'One page is cheap. The same 800 tokens across 100,000 requests is that page paid for 100,000 times.' },
  L2:{ headline:'two model passes, plus whatever the tool returns', rows:[
    ['pass 1 · prompt + tool definitions','≈ 20 + 150 tokens in → a tool call out'],
    ['the tool result, appended','≈ 400 tokens (often far more)'],
    ['pass 2 · prompt + result → answer','≈ 570 tokens in → 60 out'] ],
    note:'The cost is not “one API call”. It is the tokens to read the request out of the prompt, plus the tokens to send the whole augmented prompt back through the model with the tool’s data attached, both passes, every time.' },
  L3:{ headline:'indexing paid once, then a slim query', rows:[
    ['indexing','embed every chunk, one time'],
    ['retrieve','the top few chunks ≈ 6 × 120 tokens'],
    ['prompt + those chunks → answer','≈ 740 tokens in → 60 out'] ],
    note:'Compare with sending everything: the whole corpus in the prompt, on every query, forever. RAG pays once at indexing so the query stays slim.' },
};

/* ---------- C.W. AND B. truth-table game ---------- */
const TT_CASES = [
  { cw:true,  b:true,  label:'Fits the window · affordable to repeat', send:true,
    why:'Both constraints pass: send it directly. In-context for static, full tool output for dynamic.' },
  { cw:true,  b:false, label:'Fits the window · too expensive to repeat', send:false,
    why:'Fitting is not the same as affordable. Paying that token bill on every request, forever, is the economic ceiling failing.' },
  { cw:false, b:true,  label:'Affordable · physically will not fit', send:false,
    why:'The hard ceiling. No budget generosity squeezes 40,000 pages into one window.' },
  { cw:false, b:false, label:'Too big · too expensive', send:false,
    why:'Retrieve, no debate. Both ceilings failed.' },
];

/* ---------- route the queue (Part 1 capstone) ---------- */
const MAP_QUEUE = [
  { q:'What is an API?', a:0 },
  { q:'Which track should I choose at 100xEngineers? (one page of track info exists)', a:1 },
  { q:'Where is my order right now?', a:2 },
  { q:'Answer support questions from our 40,000-page policy archive.', a:3 },
];
const MAP_LAYERS = ['L0 · base model','L1 · in-context','L2 · tool call','L3 · RAG'];

/* ---------- the seven retrieval buckets ---------- */
const BUCKETS7 = [
  { n:1, name:'Vocabulary gap', d:'The student and the corpus mean the same thing and share no letters.', ex:'Exercise 2' },
  { n:2, name:'Bad search key', d:'The query is vague, rambling, or phrased in words the corpus never uses.', ex:'Exercise 5' },
  { n:3, name:'Orphaned chunk', d:'A retrieved chunk lost its document, section, and address at ingestion.', ex:'Exercise 3' },
  { n:4, name:'Right chunk, wrong rank', d:'The answer came back, below what the generator actually reads.', ex:'Exercise 6' },
  { n:5, name:'Needs a second search', d:'The first result only reveals what to search next; one pass can never close it.', ex:'Exercise 8' },
  { n:6, name:'Relationship, not passage', d:'The answer lives across documents, in the edges, inside no single chunk.', ex:'Exercise 7' },
  { n:7, name:'Dirty corpus', d:'Ingestion sliced or polluted the chunks before any search ever ran.', ex:'Exercise 3' },
];

/* ---------- L3 opened: where the twelve exercises sit ---------- */
const L3_STAGES = [
  { stage:'ingest · paid once, at indexing time', chips:[{ n:3, t:'chunks & context' }] },
  { stage:'the query side · fix the key before you search', chips:[{ n:2, t:'meaning mode (embeddings)' },{ n:5, t:'rewrite + HyDE' }] },
  { stage:'retrieve wide & cheap', chips:[{ n:1, t:'the floor (BM25)' },{ n:4, t:'fusion (RRF)' }] },
  { stage:'judge narrow & expensive', chips:[{ n:6, t:'rerank (cross-encoder)' }] },
  { stage:'beyond similarity · edges and loops', chips:[{ n:7, t:'the graph' },{ n:8, t:'the loop → back to L2' }] },
  { stage:'the G · bucket 4, at generation', chips:[{ n:10, t:'grounding' }] },
  { stage:'the map, run inside L3', chips:[{ n:9, t:'the router' },{ n:11, t:'the build order' },{ n:12, t:'the chooser' }] },
];

/* ---------- ex 3: ingestion bench ---------- */
const CHUNK_DOC = { title:'Deployment on Replicate', body:[
  ['Why deploy','Your fine-tuned model is useless on your laptop. Deployment puts it behind an API endpoint so any app can call it. Replicate rents you the GPU per second of use.'],
  ['The cold start problem','The first call after idling is slow because the GPU container must boot. Keep-warm pings fix it, at a cost. Budget for it or your demo dies on stage.'],
  ['Shipping a new version','Push the new weights, run the smoke test, then redeploy with the flag enabled. The flag is version-pinning: callers stay on the old model until you flip them.'],
]};

/* ---------- ex 4: fusion lists ---------- */
const FUSE_KW = [['BM25 Scoring: cheat-sheet','full-stack'],['Keyword Floor: BM25 + metadata','full-stack'],
  ['Assignment: Hybrid Search','agents',true],['Evals: recall@k','full-stack'],['The Ship Cycle','full-stack']];
const FUSE_SEM = [['Agents Module Overview','agents'],['Assignment: Hybrid Search','agents',true],
  ['The ReAct Framework','agents'],['Keyword Floor: BM25 + metadata','full-stack'],['MCP: Model Context Protocol','agents']];

/* ---------- ex 5: rewrite + HyDE ---------- */
const REWRITE_KEY = 'AAA agent progression · agentic workflows · automation roadmap';
const HYDE_KEY = 'You progress through the AAA ladder: first an assistant helps you, then automation runs a workflow end-to-end, and finally an autonomous agent decides and acts on its own. The Agents module covers this progression.';

/* ---------- ex 6: rerank candidates ---------- */
const RERANK_C = [
  { t:'A tool call has three layers: the LLM chooses the tool, an execution layer runs it, the result returns as context.', ce:0.55 },
  { t:'The Agents Module overview mentions MCP in week 2, alongside multi-agent patterns and guardrails.', ce:0.45 },
  { t:'ReAct loops thought, action, observation: the model reasons, calls a tool, reads the result, repeats.', ce:0.30 },
  { t:'Embeddings turn text into vectors so closeness in space means closeness in meaning.', ce:0.10 },
  { t:'MCP, the Model Context Protocol, solves the N×M integration problem: one protocol, any client, any tool server. REST for AI.', ce:0.95, answer:true },
  { t:'The ship cycle: scope an MVP, build the cheapest slice first, launch weekly.', ce:0.05 },
];

/* ---------- ex 7: the curriculum graph ---------- */
const GRAPH_N = {
  'tool-calling':{ x:215, y:150, t:'tool-calling' },
  'mcp':{ x:90, y:75, t:'MCP (L07)' },
  'react':{ x:110, y:230, t:'ReAct (L02)' },
  'multi-agent':{ x:330, y:60, t:'multi-agent (L05)' },
  'aaa':{ x:40, y:160, t:'AAA ladder (L01)' },
  'rag':{ x:370, y:200, t:'RAG (M2·L08)' },
  'embeddings':{ x:300, y:265, t:'embeddings' },
  'lora':{ x:420, y:90, t:'LoRA (M1)' },
};
const GRAPH_E = [['mcp','tool-calling'],['react','tool-calling'],['multi-agent','tool-calling'],
  ['aaa','react'],['rag','embeddings'],['lora','rag']];

/* ---------- ex 8: the librarian loop ---------- */
const LOOP_HOPS = [
  { q:'"AAA agent progression"',
    found:'AAA ladder: Assistant → Automation → Autonomous. Where YOU start depends on your track (code vs no-code).',
    realize:'…realise: I don’t know this student’s track. Search it.',
    next:'"code vs no-code track: module map"' },
  { q:'"code vs no-code track: module map"',
    found:'Track map: no-code track reaches agentic automation in Module 3; code track builds it in Module 2, Lecture 8.',
    realize:'…realise: need Module 3 prerequisites to say WHEN they’ll be ready.',
    next:'"Module 3 prerequisites"' },
  { q:'"Module 3 prerequisites"',
    found:'Module 3 assumes tool calling (Module 2, L07) and the ReAct loop. Runs in weeks 9 to 14.',
    realize:'…that closes it: track + timing + prerequisites. You can answer now.',
    next:null },
];
const LOOP_FRAGS = ['the AAA progression exists','which module fits this student’s track','when they’ll be ready (prereqs + weeks)'];
const LOOP_ANSWER = '“It depends on your track: no-code students reach agentic automation in Module 3 (weeks 9–14); code students build their first agent in Module 2, L08. Either way you’ll need tool calling (L07) and the ReAct loop first; that’s the AAA path from assistant to autonomous.”';

/* ---------- ex 9: the router ---------- */
const ROUTER_Q = [
  { q:'What is ControlNet used for?', a:'single' },
  { q:'What should I know before the MCP lecture?', a:'graph' },
  { q:'Plan my path from vibe coding to shipping an agent.', a:'agentic' },
  { q:'How does the ReAct loop work?', a:'single' },
  { q:'What builds on LoRA training?', a:'graph' },
  { q:'When will I learn to automate my job?', a:'agentic' },
];
const ROUTER_COST = { single:0.5, graph:1, agentic:8 };

/* ---------- ex 10: grounding audit ---------- */
const AUDIT_S = [
  { t:'Hallucination is what happens when uncertainty is high and the model is forced to respond anyway.', src:1 },
  { t:'Grounding fixes it by pinning the model to the retrieved context and explicitly allowing it to say "I don’t know."', src:1 },
  { t:'You can measure whether an answer stayed grounded using a faithfulness eval over the retrieved context.', src:2 },
  { t:'Karpathy introduced this exact formula in Lecture 9 of the curriculum.', src:0 },
];

/* ---------- ex 11: the build order ---------- */
/* the measured floor: full-text search + module metadata, over all 100 pairs */
const BUILD_FLOOR = { kw:88, sem:32, target:85, cap:97 };

/* seven techniques collapse into five buyable rungs. two free, three priced per 1,000 queries.
   every rung is a coverage slider: gain and cost both scale with the fraction of traffic it covers. */
const RUNGS = [
  { id:'passport', n:'Contextual retrieval', s:'one situating sentence per chunk, at indexing', cost:0, kw:4, sem:6 },
  { id:'graph', n:'Knowledge graph', s:'built free from links already in the curriculum data, for relationship queries', cost:0, kw:2, sem:0 },
  { id:'semantic', n:'Semantic search (embeddings)', s:'match meaning, not letters', cost:40, kw:0, sem:28 },
  { id:'rewrite', n:'Query rewrite + HyDE', s:'translate the student into corpus language', cost:60, kw:2, sem:12 },
  { id:'rerank', n:'Cross-encoder rerank', s:'re-judge the top 20, keep 6', cost:120, kw:4, sem:10 },
];

/* 8 of the 100 golden pairs, live: each flips the moment ITS bar clears the level it needs */
const BUILD_PAIRS = [
  { q:'“What is LoRA training?”', doc:'LoRA Training', kind:'keyword', bar:'kw', need:85 },
  { q:'“Explain the ReAct framework loop.”', doc:'The ReAct Framework', kind:'keyword', bar:'kw', need:90 },
  { q:'“What does MCP actually solve?”', doc:'MCP: Model Context Protocol', kind:'keyword', bar:'kw', need:93 },
  { q:'“golden pairs, recall@k: how do evals work?”', doc:'Evals: Golden Pairs', kind:'keyword', bar:'kw', need:96 },
  { q:'“Why does my bot keep lying to students?”', doc:'Hallucination & Grounding', kind:'meaning', bar:'sem', need:40 },
  { q:'“How do I make it answer from our own notes?”', doc:'Retrieval-Augmented Generation', kind:'meaning', bar:'sem', need:50 },
  { q:'“Can it turn my selfies into professional headshots?”', doc:'LoRA Training', kind:'meaning', bar:'sem', need:58 },
  { q:'“Which words count as close in meaning?”', doc:'Embeddings', kind:'meaning', bar:'sem', need:66 },
];

/* ---------- ex 11, continued: the solution walkthrough ---------- */
const BUILD_PAID_TABLE = [
  ['Semantic search (embeddings)','₹40','meaning +28','buy: it is the meaning bar’s rung', true],
  ['Query rewrite + HyDE','₹60','keyword +2 · meaning +12','skip: 1.5× the price for less than half the meaning gain'],
  ['Cross-encoder rerank','₹120','keyword +4 · meaning +10','skip: rerank re-orders candidates you already fetched, and the meaning failures never fetched one'],
];
const BUILD_WRONG = [
  { h:'Rerank first, ₹120',
    p:'keyword 92, meaning 42, overall 79.5: the most expensive rung on the board, still short of target. Rerank polishes the ranking of documents you already fetched; the meaning failures are documents that were never fetched at all. You paid ₹120 to re-judge an empty room.' },
  { h:'Everything on, ₹220',
    p:'Overall about 95, target smashed, and you are paying ₹191 more per 1,000 queries than the minimum build, forever, for points nobody asked for. Passing the eval is not the goal. Passing it at the smallest standing cost is.' },
  { h:'Query rewrite instead of semantic, ₹60',
    p:'keyword 96, meaning 50, overall 84.5: so close it hurts, ₹20 dearer than semantic at full coverage, and still failing. “Almost, but more expensive” is the signature of buying by plausibility instead of by the failing subset.' },
];

/* ---------- ex 12: the chooser ---------- */
const CHOOSER_Q = [
  { id:'corpus', q:'1 · How big is the corpus, honestly?', opts:[
    ['fits','fits in one context window'],['mid','hundreds to ~10k pages'],['huge','huge, or changes daily']]},
  { id:'mix', q:'2 · What does your 100-pair split say?', opts:[
    ['kw','mostly keyword, the common split'],['sem','heavy meaning + vocabulary gaps'],['rel','relationships + multi-hop']]},
  { id:'stage', q:'3 · What are you shipping?', opts:[
    ['mvp','an MVP this month'],['prod','production, paying users']]},
];
const CHOOSER_LABEL = { fits:'fits in one window', mid:'hundreds to ~10k pages', huge:'huge or fast-changing',
  kw:'mostly keyword', sem:'heavy meaning', rel:'relationship + multi-hop', mvp:'MVP', prod:'production' };

const FIELD_GUIDE = [
  ['Support bot over curriculum data (Sage)','FTS + metadata','embeddings (the meaning bar)','Postgres or Supabase + pgvector'],
  ['Product or catalogue search','metadata filters + BM25','rarely any','the database you have; Elasticsearch if it already exists'],
  ['Long structured documents (financial, legal)','section index + metadata','reasoning over the index (the PageIndex pattern)','LLM + a document index'],
  ['Small internal corpus','none: load the context','none','context caching; the best RAG is no RAG'],
  ['Prerequisite and dependency questions','graph from existing links','bounded agentic loop if multi-hop','existing links and foreign keys before any graph database'],
  ['Compliance-heavy answers','any of the above','grounding + faithfulness evals (not optional)','an evals harness before more retrieval'],
];

/* ---------- part 3: zoom out ---------- */
const ZOOM_ROWS = [
  ['instrument','golden set: query → expected answer','golden pairs: query → the document that should answer it'],
  ['failure buckets','four: knowledge, freshness, scale, behaviour','seven: vocabulary gap through dirty corpus'],
  ['unit you buy','a layer: L1, L2, L3','a technique: embeddings, rerank, graph, loop'],
  ['cheapest floor','L0, the base model','BM25 plus metadata, effectively free'],
  ['stop condition','the eval passes','recall@k hits target'],
  ['the anti-pattern','“it seems better”','“it seems better”'],
];

/* ============================================================
   MODULES: the linear player
   ============================================================ */
const MODULES = [

/* ---------- 0 · START ---------- */
{ id:'start', title:'Start here', icon:'sparkles', open:true, steps:[
  { t:'intro',
    pill:'100xEngineers · Context Engineering → Advanced RAG',
    title:'Confident. Fluent.\nCompletely wrong.',
    subtitle:'One lecture, one derivation: a decision framework for what context to buy and when, then twelve hands-on exercises inside the RAG box. Everything runs right here in your browser: no code, no API keys, same lab for everyone.' },
  { t:'basemodel',
    title:'Ask the base model.',
    subtitle:'Three student questions. No extra context. Watch which ones it can actually answer.' },
  { t:'question', eyebrow:'The first question',
    q:'Can the model already answer correctly,\n<em>without</em> extra context?',
    sub:'If yes, stop. Do not solve a problem that does not exist. Every technique in this lab costs money, latency, and maintenance.' },
  { t:'reveal', eyebrow:'The diagnosis',
    title:'A supply problem,\nnot an intelligence problem.',
    body:'The track details were never in the training data. <strong>The information was never in the room.</strong> So the first question is never “which technique?” It is “what exactly is missing, and what is the cheapest way to put it in the room?” This lecture is one procedure for answering that, and you are going to derive every box of it.' },
]},

/* ---------- 1 · THE MAP ---------- */
{ id:'map', title:'Part 1 · The map', icon:'map', steps:[
  { t:'reveal', eyebrow:'The Map · the referee',
    title:'The golden set is the referee.',
    body:'Write down real user questions. For each, record: <strong>expected answer, current answer, missing information, why it fails</strong>. This is not a checkbox you file away; you re-run it after <strong>every</strong> layer you add. The failing subset is your roadmap; a passing score is your stop condition.',
    art:'<div class="quotecard">Without it, every architecture decision is <b>“it seems better”</b>, the sentence that has burned more budgets than any bug. You will meet it again inside RAG, wearing the same disguise.</div>' },
  { t:'buckets',
    title:'Every failure lands in one of four buckets.',
    subtitle:'Each bucket names exactly one fix. Guess the fix, then flip. Diagnosis becomes mechanical, not vibes.' },
  { t:'stack',
    title:'Four layers, and the cost of each.',
    subtitle:'Each layer costs more to build, run, and maintain than the one below. You add a layer only when a bucket forces you to.' },
  { t:'ttgame',
    title:'The rule: send directly only when C.W. AND B.',
    subtitle:'C.W.: it fits the context window, the hard ceiling. B.: it is reasonable to send on every request, forever, the economic ceiling. Call each case: send, or retrieve?' },
  { t:'routegame', gate:true,
    title:'You are the router.',
    subtitle:'Route each query to the cheapest layer that can pass. Overspending is a failure too: a layer the eval never demanded is pure cost.' },
  { t:'reveal', eyebrow:'The shape of what you just did',
    title:'The map is not a tree.\nIt is a loop.',
    body:'You did not walk a tree once. You ran a loop, and it repeats until the eval passes.',
    art:'<div class="loopsteps"><div class="lstep"><span class="ln">1</span><div><b>Measure</b><span>run the golden set on what you have</span></div></div><div class="lstep"><span class="ln">2</span><div><b>Diagnose</b><span>sort the failures into the four buckets</span></div></div><div class="lstep"><span class="ln">3</span><div><b>Add one layer</b><span>exactly the one the biggest bucket names</span></div></div><div class="lstep"><span class="ln">4</span><div><b>Re-measure</b><span>stop when the eval passes</span></div></div></div><p class="loopnote">One layer per iteration, so you always know which change moved the number. The failing subset is always the roadmap.</p>' },
]},

/* ---------- 2 · THE BRIDGE ---------- */
{ id:'bridge', title:'Opening the L3 box', icon:'package-open', steps:[
  { t:'question', eyebrow:'The bridge',
    q:'“Retrieve only what earns the window.”\n<em>How does that fail?</em>',
    sub:'On the map, L3 was one box. Up close, retrieval turns out to fail in more than one way, and each way has its own fix.' },
  { t:'sevenbuckets',
    title:'Bucket 3 splits into seven.',
    subtitle:'Zoom into the scale gap and it splits, the way a spectral line splits under a stronger instrument. Same diagnosis discipline, finer instrument.' },
  { t:'l3map',
    title:'One box on the map,\ntwelve techniques inside it.',
    subtitle:'The procedure does not change; only the nouns do. Golden set becomes golden pairs. Four buckets become seven. A layer becomes a single technique. You buy them one at a time, named by the biggest failing bucket, never by vibes.' },
]},

/* ---------- 3 · EX 1+2 · THE FLOOR ---------- */
{ id:'floor', title:'Ex 1–2 · The floor', icon:'search', steps:[
  { t:'exsearch', eyebrow:'Exercise 1 of 12 · the floor of L3',
    title:'Search that costs nothing.',
    subtitle:'Your curriculum data was never in any model’s training set, so Sage (the student support bot) must retrieve before it can answer. This is a real mini-Sage over 12 curriculum pages, using the cheapest retrieval there is: keyword matching (BM25). Try the chips, or type your own, and read “behind the scenes”.' },
  { t:'reveal', eyebrow:'The MVP rule',
    title:'The cheap floor answers\nmost real student queries.',
    body:'Zero keys, zero GPU, effectively free, and every match is explainable: these exact words, in this exact document. Everything else in this lab must <strong>earn its place</strong> against it. In most MVPs a simple index plus metadata is cheaper <em>and faster</em> than any embedding engine.' },
  { t:'exmeaning', eyebrow:'Exercise 2 of 12 · bucket 1 · vocabulary gap',
    title:'The query that breaks the floor.',
    subtitle:'Submit the pre-loaded query. Zero results: the corpus never says “lying”; it says “hallucination”, “grounding”. The student and the corpus mean the same thing and share no letters. Then flip on Meaning mode and search again.',
    fail:'✗ “make the bot stop lying”' },
  { t:'question', eyebrow:'The decision rule',
    q:'So when do you\n<em>buy</em> embeddings?',
    sub:'Not because they are modern. You buy them the day your own failing queries start looking like the one you just fixed: same meaning, no shared words. Until that shows up in your eval, the free floor is still winning.' },
]},

/* ---------- 4 · EX 3 · INGESTION ---------- */
{ id:'ingest', title:'Ex 3 · Ingestion', icon:'scissors', steps:[
  { t:'exchunks', eyebrow:'Exercise 3 of 12 · bucket 7 · dirty corpus',
    title:'Everything rests on ingestion.',
    subtitle:'Before any search, documents get cut into chunks, the units retrieval actually returns. Two ways to cut. Try naive: every 180 characters, wherever that lands. The red fragments are thoughts sliced mid-sentence: retrieval will return them, generation will cite them, and you’ll ship fluent, source-tagged garbage.' },
  { t:'exorphan', eyebrow:'Exercise 3, continued · bucket 3 · orphaned chunk',
    title:'The orphan demo.',
    subtitle:'Search the locked query. You retrieve “then redeploy with the flag enabled”, a chunk that lost its document, its lecture, its flag. Technically retrieved, practically useless. Then apply contextual retrieval: one situating sentence, saying where each chunk comes from, is prepended to every chunk at indexing time. Search again.',
    fail:'✗ “Which flag do I redeploy with?”' },
  { t:'reveal', eyebrow:'The receipt',
    title:'Pay at indexing time, once,\nnot at query time, forever.',
    body:'No architecture downstream of ingestion recovers information ingestion destroyed. Garbage in isn’t garbage out; it’s <strong>cited</strong> garbage out, which is worse. Anthropic measured this exact move, which they call <strong>contextual retrieval</strong>, at a large drop in failed retrievals, more still when paired with a keyword index and a reranker. <a href="https://www.anthropic.com/engineering/contextual-retrieval" target="_blank" rel="noopener">Read their write-up →</a>' },
]},

/* ---------- 5 · EX 4 · FUSION ---------- */
{ id:'fusion', title:'Ex 4 · Fusion', icon:'git-merge', steps:[
  { t:'question', eyebrow:'Exercise 4 of 12 · retrieve stage',
    q:'“Show me the <em>BM25</em> assignment\nfrom the <em>agents module</em>.”',
    sub:'An exact term AND a fuzzy scope in one query. Keyword search nails the term; meaning search nails the scope. Which one do you trust?' },
  { t:'exfusion',
    title:'Two searchers, one answer list.',
    subtitle:'Trust each list alone and you drop half the signal: the document you actually want (★) is #3 in one list and #2 in the other, never #1. So merge. But BM25 scores are unbounded term arithmetic and cosine scores live in −1…1; adding them is adding rupees to dollars. What do the lists share? Not scores. Ranks.' },
  { t:'quiz', gate:true, eyebrow:'Checkpoint',
    prompt:'Why does RRF fuse ranks instead of scores?',
    options:[
      { label:'Ranks are the only honest common currency between the two lists', correct:true,
        fb:'BM25 and cosine scores live on incompatible scales; no exchange rate exists. Ranks are comparable by construction. Reciprocal Rank Fusion (score = Σ 1/(60+rank)) is the entire “hybrid search” checkbox in every vector database: one loop.' },
      { label:'Ranks are faster to compute than scores',
        fb:'Both are already computed by the time you fuse. Speed isn’t the issue; comparability is: the two score scales share no exchange rate.' },
      { label:'Scores are less accurate than ranks',
        fb:'Within one list, scores carry MORE information than ranks. The problem is across lists: two different scales, no conversion. Ranks are the shared unit.' },
    ]},
]},

/* ---------- 6 · EX 5 · FIX THE QUERY ---------- */
{ id:'rewrite', title:'Ex 5 · Fix the query', icon:'languages', steps:[
  { t:'exrewrite', eyebrow:'Exercise 5 of 12 · buckets 1 & 2 · bad search key',
    title:'Fix the query before you search.',
    subtitle:'The corpus speaks of “AAA agent progression” and “agentic workflows”. The query as typed is simply a bad search key, and why should a student speak your corpus’s language? Put a cheap LLM in front with one job: translation. Click Rewrite, then try a stranger move: search with a made-up answer instead of the question.',
    fail:'✗ “When will I learn how to automate my job?”' },
  { t:'reveal', eyebrow:'The geometry',
    title:'Answers live near answers.\nQuestions don’t.',
    body:'That move has a name: <strong>HyDE</strong> (Hypothetical Document Embeddings). You ask an LLM to <em>make up a plausible answer</em> (factually unreliable!) and search with <strong>that</strong> instead of the question. It works because of geometry: a fake answer is phrased like the real answers, so it lands inside the right cluster. Factually worthless, geometrically precious. And the rewriter’s dictionary (the <strong>lexicon</strong>, two columns of “what students say → what the corpus says”, harvested from your own failed queries) is the highest-ROI component in the whole system.' },
]},

/* ---------- 7 · EX 6 · RERANK ---------- */
{ id:'rerank', title:'Ex 6 · Rerank', icon:'list-ordered', steps:[
  { t:'exrerank', eyebrow:'Exercise 6 of 12 · bucket 4 · right chunk, wrong rank',
    title:'Retrieval worked.\nThe answer still failed.',
    subtitle:'“What is MCP and what problem does it solve?”: the perfect chunk came back at position 5, and the generator reads the top 3. The fast first pass embeds every chunk on its own, long before your question existed, so it never reads your query and the chunk side by side. Your turn to be the fix: reorder the candidates so the best answer is #1, reading question and chunk together every time, then run the careful re-ranker and compare.' },
  { t:'quiz', gate:true, eyebrow:'Checkpoint',
    prompt:'Why not just cross-encode the whole corpus for every query?',
    options:[
      { label:'One model pass per query-chunk pair, at query time, unshippable at corpus scale', correct:true,
        fb:'951 chunks × every query is latency and money you can’t ship. Hence the staging: retrieve wide & cheap (~20 candidates), judge narrow & expensive (cross-encode those, keep 6). The written test screens thousands; the interview panel sees twenty.' },
      { label:'Cross-encoders are less accurate than bi-encoders',
        fb:'The opposite: reading query and chunk together is MORE accurate; you just proved it by hand. What it can’t be is cheap.' },
      { label:'Cross-encoders can’t handle long documents',
        fb:'Length isn’t the wall. The wall is one forward pass per (query, chunk) pair, at query time, across the whole corpus.' },
    ]},
]},

/* ---------- 8 · EX 7 · THE GRAPH ---------- */
{ id:'graph', title:'Ex 7 · The graph', icon:'waypoints', steps:[
  { t:'question', eyebrow:'Exercise 7 of 12 · bucket 6 · relationship, not passage',
    q:'“Which lectures assume I already know\n<em>tool calling</em>?”',
    sub:'Search all you want: no chunk contains this sentence. The answer is a pattern ACROSS documents, in how they connect. Similarity search returns single passages; this question is about the links between them.' },
  { t:'exgraph',
    title:'Read the answer off the edges.',
    subtitle:'Build a knowledge graph: every topic is a node, every reference from one topic to another is an edge. Your curriculum data already records which lesson points to which, so the graph is almost free to build. Retrieval here is not similarity, it is traversal: start at the topic the question names, then follow the edges outward. Click the tool-calling node, then widen by one hop, and read the answer off the connections.' },
  { t:'reveal', eyebrow:'This is Graph RAG',
    title:'Some answers live in the edges,\nnot the passages.',
    body:'When a question is about how things relate, prerequisites, dependencies, what builds on what, no single chunk holds the answer, and ranking passages will never find it. <strong>Graph RAG</strong> turns retrieval into a walk: it starts at the entity the question names and follows the connections, one hop at a time. Build the graph from structure you already own, existing links, foreign keys, folder trees, before you reach for a dedicated graph database.' },
]},

/* ---------- 9 · EX 8 · THE LOOP ---------- */
{ id:'loop', title:'Ex 8 · The loop', icon:'repeat', steps:[
  { t:'exloop', eyebrow:'Exercise 8 of 12 · bucket 5 · needs a second search',
    title:'When one search can never be enough.',
    subtitle:'Even perfectly rewritten, one retrieval pass can’t answer this: the first result only reveals what to look for next. You run the loop by hand: do the first search, read what came back, and decide: answer now, or search again? Try answering early. Every hop costs money; the invoice is ticking.',
    fail:'✗ “When will I learn to automate my job?”, properly this time' },
  { t:'reveal', eyebrow:'The shape of the fix',
    title:'One search becomes\nsearch, read, decide.',
    body:'Each result did not answer the question; it told you what to search for next. So a single retrieval step turns into a small loop: search, read what came back, then decide whether you can answer yet or need one more search. The skill is not the searching; it is knowing when you have enough to stop. Every loop needs a stop condition and a hard limit (this lab caps it at four searches), or the runaway invoice keeps climbing.' },
]},

/* ---------- 10 · EX 9 · THE ROUTER ---------- */
{ id:'router', title:'Ex 9 · The router', icon:'signpost', steps:[
  { t:'exrouter', eyebrow:'Exercise 9 of 12 · the failure is the invoice',
    title:'The receptionist.',
    subtitle:'“What is RAG?” sent through the agentic loop: four LLM hops, real money, for a lookup the free floor answers instantly. Nothing wrong with the answer: the failure is the invoice. Three paths, three costs: single ~₹0.5, graph ~₹1, agentic ~₹8. Route the morning queue; your invoice is compared with the optimal one.' },
  { t:'reveal', eyebrow:'The principle',
    title:'The receptionist classifies.\nIt never solves.',
    body:'It can run on every query precisely <em>because</em> it does nothing else. In Sage this is one cheap LLM call, with a keyless regex fallback: words like <em>prerequisite, requires, which lectures</em> smell like graph. The cheap majority goes down the cheap path; this is the Part 1 routing decision, re-instantiated inside L3.' },
]},

/* ---------- 11 · EX 10 · GROUNDING ---------- */
{ id:'grounding', title:'Ex 10 · Grounding', icon:'shield-check', steps:[
  { t:'exground', eyebrow:'Exercise 10 of 12 · the G in RAG · bucket 4 at generation',
    title:'You are the auditor.',
    subtitle:'Retrieval done. Now generation, and its one disease. Below: a generated answer and the two sources it retrieved. Hover each sentence: its supporting source lights up. One sentence lights up nothing. Click every sentence you believe is unsupported, then check the audit.' },
  { t:'reveal', eyebrow:'The formula',
    title:'Hallucination =\nuncertainty × forced response.',
    body:'Grounding pins the first low (answer only from the retrieved context) and removes the second (the model is <em>allowed to say</em> “I haven’t written this up in my notes yet”). The invented sentence sounds exactly as confident as the true ones; that’s what makes ungrounded generation dangerous, and why the eval measures <strong>faithfulness</strong>, not eloquence. This is bucket 4, the behaviour gap, resurfacing at generation time, exactly as the bridge promised.' },
]},

/* ---------- 12 · EX 11 · THE BUILD ORDER ---------- */
{ id:'build', title:'Ex 11 · The build order', icon:'trending-up', steps:[
  { t:'exbuild', eyebrow:'Exercise 11 of 12 · the capstone decision',
    title:'The build-order game.',
    subtitle:'You now know seven techniques. Which do you buy, how much of each, and in what order? Never by vibes; by evals: golden pairs scored as recall@k, split keyword-style vs meaning-style. Every rung here is a coverage slider, not a switch, so you can buy a fraction of one. Watch WHICH bar is bleeding before you spend a rupee.',
    fail:'✗ “it seems better”, the sentence that has burned more RAG budgets than any bug' },
  { t:'buildsolution', eyebrow:'Exercise 11 · the solution',
    title:'Buy the roadmap by the metre,\nnot by the kilometre.',
    subtitle:'Play first. The solution means nothing until you have watched a paid rung move the wrong bar.' },
]},

/* ---------- 13 · EX 12 · THE CHOOSER ---------- */
{ id:'chooser', title:'Ex 12 · The chooser', icon:'compass', steps:[
  { t:'question', eyebrow:'Exercise 12 of 12 · the field guide',
    q:'“Which vector database\nshould we use?”\n<em>The wrong first question.</em>',
    sub:'Every tool on the market is an implementation of the techniques you just derived. The corpus, the query mix, and the failing bucket choose the tool, never the other way round. A vendor name before your golden pairs exist means you are shopping, not engineering.' },
  { t:'exchooser',
    title:'Three questions, one stack.',
    subtitle:'Answer honestly for YOUR app and read the verdict. Notice it never opens with a vendor.' },
  { t:'receipt',
    title:'Done Equals: your receipt.',
    subtitle:'Generate your completion receipt and post it in your track channel. A facilitator verifies it against this lab. The receipt is the gate; the claim is not.' },
]},

/* ---------- 14 · ZOOM OUT ---------- */
{ id:'zoom', title:'Part 3 · Zoom out', icon:'telescope', steps:[
  { t:'zoomtable',
    title:'One procedure,\ntwo magnifications.',
    subtitle:'You have now run the same loop twice without changing a single step. Only the nouns changed.' },
  { t:'closing',
    title:'Minimum sufficient context.',
    body:'The goal is never the <em>maximum</em> possible context. It is the <strong>minimum sufficient context</strong> for a correct answer, at the lowest layer that passes the eval, with the cheapest technique that closes the failing bucket.<br><br>The last AI feature you built: which layer is it on, which technique closes it, and can you show the failing golden pairs that justified each?' },
]},

];
