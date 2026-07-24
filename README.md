# The Context Lab: Context Engineering → Advanced RAG

Interactive Socratic lecture lab for **100xEngineers**. One thing per screen: a question, a felt failure, a hands-on exercise, then the reveal, until the class has derived the whole context-engineering decision framework and opened the RAG box from the inside.

Built on the 100x design system, same architecture as [memory-lab](https://github.com/Siddhant-Goswami/memory-lab) and [tool-call-c7](https://github.com/Siddhant-Goswami/tool-call-c7): linear step player, sidebar modules that unlock as you progress, quiz gating, progress persisted in `localStorage`. Everything runs in the browser: no code, no API keys, same lab for everyone.

## The arc

**Part 1 · The map**: derive the decision framework: the golden set as referee, four failure buckets, four layers (L0 base → L1 in-context → L2 tools → L3 RAG), the C.W. AND B. rule, and the measure → diagnose → buy-one-layer → re-measure loop. Capstone: route four queries to the cheapest passing layer.

**The bridge** opens the L3 box: bucket 3 (the scale gap) splits into seven retrieval buckets, and the twelve exercises map onto ingest → retrieve → rank → ground.

**Part 2 · Twelve exercises inside L3**: each starts with a query that fails, and you derive the fix by doing it, on a real mini-Sage (the student support bot) running over 12 curriculum pages in your browser:

1. **The floor**: BM25 keyword search, explainable and free
2. **The meaning gap**: "make the bot stop lying" → zero results → meaning mode
3. **Chunks & passports**: naive vs meaning-aware chunking, the orphan demo, contextual passports
4. **Fusion**: two ranked lists, rupees-vs-dollars scores, Reciprocal Rank Fusion
5. **Fix the query**: rewrite via the lexicon, then HyDE and the meaning-space map
6. **Rerank**: you are the cross-encoder: reorder candidates, then compare
7. **The graph**: answers that live in the edges; traverse the curriculum graph
8. **The loop**: you are the librarian: search, read, realise, search again
9. **The router**: three paths, three costs; the failure is the invoice
10. **Grounding**: audit a generated answer sentence-by-sentence against its sources
11. **The build order**: reach 85% recall for the least money; the failing bar is the roadmap
12. **The chooser**: corpus + query mix choose the tool, never the vendor; Done Equals receipt

**Part 3 · Zoom out**: one procedure, two magnifications: the same loop at app scale and inside L3. Carry one sentence out: *minimum sufficient context*.

## Run it

Static site, no build.

```bash
python3 -m http.server 8000
```

…or just open `index.html`.

`index.html` · `css/tokens.css` (100x design tokens, drop-in brand sheet) · `css/app.css` · `js/data.js` (content + corpus + exercise data) · `js/app.js` (player + exercise widgets)
