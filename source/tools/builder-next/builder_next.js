'use strict';
const fs = require('fs'), path = require('path');
const M = require('../factory/meter.js');
const E = require('../builder/engine.js');
const GP = require('../builder/loop/gate_profile.js');
const C = require('./components.js');
const P = require('./planner.js');
const V = require('./evaluator.js');
const { createYardstick } = require('./yardstick.js');

function createBuilder(options = {}) {
  const ys = options.ys || createYardstick();
  const knowledgeFile = options.knowledgeFile === false ? null : path.resolve(options.knowledgeFile ||
    path.join(__dirname, '../../build/builder-next/knowledge.json'));
  const context = { family: ys.meters.family.fingerprint, skilled: ys.meters.planner.fingerprint,
    familySettings: ys.pins.blocks.CURVE, skilledSettings: ys.pins.planner.settings,
    gateProfile: GP.loadProfile('e5-v1').fingerprint,
    source: options.sourceIdentity || M.sourceHash(__filename) };
  const contextKey = M.digest(context);
  const saved = knowledgeFile && fs.existsSync(knowledgeFile) ? JSON.parse(fs.readFileSync(knowledgeFile, 'utf8')) : null;
  const knowledge = saved?.contextKey === contextKey ? saved : { schema: 'builder-next-knowledge-v1', contextKey, context, observations: [] };
  const persist = () => { if (knowledgeFile) M.atomicJson(knowledgeFile, knowledge); };
  const constructBase = options.buildBase || C.buildBase;
  const compose = options.compose || C.composeCandidate;
  const evaluate = options.evaluate || V.evaluateDesign;

  async function build(input = {}, limits = {}) {
    const request = { target: input.target ?? 10, layout: input.layout ?? 22, seed: input.seed ?? 1,
      tol: input.tol ?? 1, skilledBand: input.skilledBand ?? [2.5, 6] };
    if (!Number.isFinite(request.target) || request.target < 1 || request.target >= ys.pins.cap)
      throw Error('Target must be finite and below the measurement cap');
    if (!Number.isFinite(request.tol) || request.tol < 0 || request.skilledBand.length !== 2 ||
      request.skilledBand.some(x => !Number.isFinite(x)) || request.skilledBand[0] < 2 ||
      request.skilledBand[0] > request.skilledBand[1] || request.skilledBand[1] > 6)
      throw Error('Invalid difficulty band; fallback minimum 2 must be explicit');
    const meta = Object.values(C.BASE_BODIES).find(b => b.layout === request.layout);
    if (!meta) throw Error(`No component body for layout ${request.layout}`);
    const shape = input.shape || meta.shape, stage = input.stage || meta.stage;
    if (input.seed === undefined) request.seed = meta.seed;
    const maxCandidates = limits.maxCandidates ?? 6, wallMs = limits.wallMs ?? 180000, campaigns = limits.campaigns ?? 80;
    if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || ![40, 80].includes(campaigns) || !Number.isFinite(wallMs) || wallMs <= 0)
      throw Error('Invalid work budget');
    const started = Date.now(), cpu = process.cpuUsage(), attempts = [], seenRecipes = new Set(), seenBoards = new Set();
    const pool = P.proposals(request.layout);
    const base = constructBase(request.layout, shape, stage, request.seed, { wallMs: Math.min(30000, wallMs) });
    const finish = (status, candidate = null, evaluation = null) => {
      const used = process.cpuUsage(cpu);
      return { success: status === 'EXPERIMENTAL_HIT', status, request, contextKey, context,
        normalMinimum: request.skilledBand[0] === 2.5, explicitFallback: request.skilledBand[0] < 2.5,
        finalCandidate: candidate, evaluation, attempts, measured: attempts.filter(a => a.evaluation && !a.reused).length,
        cost: { cpuS: (used.user + used.system) / 1e6, wallMs: Date.now() - started },
        note: 'Experimental construction result; no fresh ACCEPT blocks, library promotion or game-level change.' };
    };
    if (!base.design) return { ...finish('BASE_UNRESOLVED'), failure: base.fail };
    const baseKey = M.boardKey(base.design);
    // Gate calibration is target-specific and sample size affects quality confidence.
    const scope = M.digest({ baseKey, shape, stage, campaigns });
    const observed = knowledge.observations.filter(r => r.scope === scope);
    const eligible = observed.filter(r => r.candidate && r.evaluation && V.diagnose(r.evaluation, request).length === 0)
      .sort((a,b) => Math.abs(a.evaluation.D-request.target)-Math.abs(b.evaluation.D-request.target));
    for (const old of eligible) {
      if (M.boardKey(old.candidate.design) === old.boardKey && E.replay(old.candidate.design, old.candidate.design.solution, { strict: true }).ok) {
        attempts.push({ recipe: old.recipe, boardKey: old.boardKey, evaluation: old.evaluation, reused: true, issues: [] });
        return finish('EXPERIMENTAL_HIT', old.candidate, old.evaluation);
      }
    }
    const worthMeasuring = recipe => {
      if (seenRecipes.has(P.recipeKey(recipe))) return false;
      const old = observed.find(r => r.recipeKey === P.recipeKey(recipe));
      if (!old) return true;
      if (old.failure) return false;
      // Remember measured misses across requests. A previously off-target board
      // may still need traces when a different request now matches its ratings.
      if (old.evaluation) return old.evaluation.tracePass == null &&
        V.diagnose({ ...old.evaluation, tracePass: true }, request).length === 0;
      return true;
    };
    while (attempts.length < maxCandidates && Date.now() - started < wallMs) {
      const next = P.rankProposals(pool.filter(worthMeasuring), observed, request)[0];
      if (!next) break;
      const recipe = next.recipe, key = P.recipeKey(recipe);
      seenRecipes.add(key);
      const previous = observed.find(r => r.recipeKey === key);
      let candidate = previous?.candidate;
      if (!candidate) candidate = compose(base.design, recipe, { ms: 2500, finishMs: 2500 });
      const attempt = { recipe, selection: { basis: next.basis, predictedD: next.predictedD } };
      if (!candidate.ok) {
        attempt.failure = candidate.fail;
        attempts.push(attempt);
        if (!previous) { const row = { scope, recipeKey: key, recipe, failure: candidate.fail }; observed.push(row); knowledge.observations.push(row); persist(); }
        continue;
      }
      const boardKey = M.boardKey(candidate.design);
      if (seenBoards.has(boardKey)) { attempts.push({ ...attempt, boardKey, failure: 'DUPLICATE_BOARD' }); continue; }
      seenBoards.add(boardKey);
      // Previous ratings may guide exploration. Quality is evaluated again when
      // a previously off-target candidate becomes promising for a new request.
      const reusable = previous?.evaluation && (previous.evaluation.tracePass != null ||
        V.diagnose({ ...previous.evaluation, tracePass: true }, request).length > 0);
      const evaluation = reusable ? previous.evaluation : evaluate(candidate.design, { ys, request, shape,
        spare: recipe.spare, campaigns });
      const issues = V.diagnose(evaluation, request);
      attempts.push({ ...attempt, boardKey, evaluation, issues, reused: !!reusable });
      const row = { scope, recipeKey: key, recipe, boardKey, candidate, evaluation };
      if (previous) { Object.assign(previous, row); }
      else { observed.push(row); knowledge.observations.push(row); }
      persist();
      if (!issues.length) return finish('EXPERIMENTAL_HIT', candidate, evaluation);
    }
    return finish(Date.now()-started >= wallMs ? 'BUDGET_EXHAUSTED' : 'NO_MEASURED_HIT');
  }
  return { build, knowledge, context, contextKey, ys };
}
module.exports = { createBuilder, build: (request, options) => createBuilder().build(request, options) };
