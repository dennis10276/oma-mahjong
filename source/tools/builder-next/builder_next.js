'use strict';
/**
 * builder_next.js - Request-to-puzzle level builder for Mahjong Solitaire.
 * Fulfills target difficulty requests (Family bot D within +/- 1, Skilled bot S in [2.5, 6.0]
 * or fallback [2.0, 6.0]) with high-quality, varied puzzles passing all profile e5-v1 static
 * and trace gates.
 */

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
  const context = {
    family: ys.meters.family.fingerprint,
    skilled: ys.meters.planner.fingerprint,
    familySettings: ys.pins.blocks.CURVE,
    skilledSettings: ys.pins.planner.settings,
    gateProfile: GP.loadProfile('e5-v1').fingerprint,
    source: options.sourceIdentity || M.sourceHash(__filename)
  };
  const contextKey = M.digest(context);
  const saved = knowledgeFile && fs.existsSync(knowledgeFile) ? JSON.parse(fs.readFileSync(knowledgeFile, 'utf8')) : null;
  const knowledge = saved?.contextKey === contextKey ? saved : { schema: 'builder-next-knowledge-v1', contextKey, context, observations: [] };
  const persist = () => { if (knowledgeFile) M.atomicJson(knowledgeFile, knowledge); };

  const compose = options.compose || C.composeCandidate;
  const evaluate = options.evaluate || V.evaluateDesign;

  async function build(input = {}, limits = {}) {
    const meta = C.getLayoutMeta(input.layout ?? 22);
    const request = {
      target: input.target ?? 10,
      layout: meta.layout,
      shape: input.shape || meta.shape,
      seed: input.seed ?? 1,
      tol: input.tol ?? 1,
      skilledBand: input.skilledBand ?? [2.5, 6]
    };

    if (!Number.isFinite(request.target) || request.target < 1 || request.target >= ys.pins.cap)
      throw Error('Target must be finite and below the measurement cap');
    if (!Number.isFinite(request.tol) || request.tol < 0 || request.skilledBand.length !== 2 ||
      request.skilledBand.some(x => !Number.isFinite(x)) || request.skilledBand[0] < 2 ||
      request.skilledBand[0] > request.skilledBand[1] || request.skilledBand[1] > 6)
      throw Error('Invalid difficulty band; fallback minimum 2 must be explicit');

    const maxCandidates = limits.maxCandidates ?? 6;
    const wallMs = limits.wallMs ?? 180000;
    const campaigns = limits.campaigns ?? 80;

    if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || ![40, 80].includes(campaigns) || !Number.isFinite(wallMs) || wallMs <= 0)
      throw Error('Invalid work budget');

    const started = Date.now(), cpu = process.cpuUsage();
    const attempts = [], seenRecipes = new Set(), seenBoards = new Set();
    const pool = P.proposals(request.layout, request.target);

    const finish = (status, candidate = null, evaluation = null) => {
      const used = process.cpuUsage(cpu);
      return {
        success: status === 'EXPERIMENTAL_HIT',
        status,
        request,
        contextKey,
        context,
        normalMinimum: request.skilledBand[0] >= 2.5,
        explicitFallback: request.skilledBand[0] < 2.5,
        finalCandidate: candidate,
        evaluation,
        attempts,
        measured: attempts.filter(a => a.evaluation && !a.reused).length,
        cost: { cpuS: (used.user + used.system) / 1e6, wallMs: Date.now() - started },
        note: 'Experimental construction result; no fresh ACCEPT blocks, library promotion or game-level change.'
      };
    };

    // Scoped observation cache
    const scope = M.digest({ layout: request.layout, shape: request.shape, seed: request.seed, campaigns });
    const observed = knowledge.observations.filter(r => r.scope === scope);

    // Check if an existing observed candidate in this scope meets all criteria
    const eligible = observed.filter(r => r.candidate && r.evaluation && V.diagnose(r.evaluation, request).length === 0)
      .sort((a, b) => Math.abs(a.evaluation.D - request.target) - Math.abs(b.evaluation.D - request.target));

    for (const old of eligible) {
      if (M.boardKey(old.candidate.design) === old.boardKey &&
          E.replay(old.candidate.design, old.candidate.design.solution, { strict: true }).ok) {
        attempts.push({ recipe: old.recipe, boardKey: old.boardKey, evaluation: old.evaluation, reused: true, issues: [] });
        return finish('EXPERIMENTAL_HIT', old.candidate, old.evaluation);
      }
    }

    const worthMeasuring = recipe => {
      if (seenRecipes.has(P.recipeKey(recipe))) return false;
      const old = observed.find(r => r.recipeKey === P.recipeKey(recipe));
      if (!old) return true;
      if (old.failure) return false;
      if (old.evaluation) {
        return old.evaluation.tracePass == null && V.diagnose({ ...old.evaluation, tracePass: true }, request).length === 0;
      }
      return true;
    };

    while (attempts.length < maxCandidates && Date.now() - started < wallMs) {
      const ranked = P.rankProposals(pool.filter(worthMeasuring), observed, request);
      const next = ranked[0];
      if (!next) break;

      const recipe = next.recipe, key = P.recipeKey(recipe);
      seenRecipes.add(key);

      const previous = observed.find(r => r.recipeKey === key);
      let candidate = previous?.candidate;

      if (!candidate) {
        candidate = compose(null, { ...recipe, layout: request.layout, shape: request.shape, seed: request.seed },
          { wallMs: Math.min(20000, wallMs - (Date.now() - started)) });
      }

      const attempt = { recipe, selection: { basis: next.basis, predictedD: next.predictedD } };

      if (!candidate.ok) {
        attempt.failure = candidate.fail;
        attempts.push(attempt);
        if (!previous) {
          const row = { scope, recipeKey: key, recipe, failure: candidate.fail };
          observed.push(row);
          knowledge.observations.push(row);
          persist();
        }
        continue;
      }

      const boardKey = M.boardKey(candidate.design);
      if (seenBoards.has(boardKey)) {
        attempts.push({ ...attempt, boardKey, failure: 'DUPLICATE_BOARD' });
        continue;
      }
      seenBoards.add(boardKey);

      const reusable = previous?.evaluation && (previous.evaluation.tracePass != null ||
        V.diagnose({ ...previous.evaluation, tracePass: true }, request).length > 0);

      const evaluation = reusable
        ? previous.evaluation
        : evaluate(candidate.design, {
            ys,
            request,
            shape: request.shape,
            spare: candidate.spare,
            campaigns
          });

      const issues = V.diagnose(evaluation, request);
      attempts.push({ ...attempt, boardKey, evaluation, issues, reused: !!reusable });

      const row = { scope, recipeKey: key, recipe, boardKey, candidate, evaluation };
      if (previous) {
        Object.assign(previous, row);
      } else {
        observed.push(row);
        knowledge.observations.push(row);
      }
      persist();

      if (!issues.length) {
        return finish('EXPERIMENTAL_HIT', candidate, evaluation);
      }
    }

    return finish(Date.now() - started >= wallMs ? 'BUDGET_EXHAUSTED' : 'NO_MEASURED_HIT');
  }

  return { build, knowledge, context, contextKey, ys };
}

module.exports = {
  createBuilder,
  build: (request, options) => createBuilder().build(request, options)
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
  };
  const hasFlag = flag => args.includes(flag);

  const target = parseFloat(getArg('--target', '13'));
  const layout = parseInt(getArg('--layout', '6'), 10);
  const seed = parseInt(getArg('--seed', '4'), 10);
  const tol = parseFloat(getArg('--tol', '1.0'));
  const fallback = hasFlag('--fallback') || layout === 27;
  const skilledBand = fallback ? [2.0, 6.0] : [2.5, 6.0];
  const campaigns = parseInt(getArg('--campaigns', '80'), 10);
  const wallMs = parseInt(getArg('--wallMs', '60000'), 10);

  const request = { target, layout, seed, tol, skilledBand };
  console.log(`[builder-next] Executing request: target=${target}, layout=${layout}, seed=${seed}, skilledBand=[${skilledBand.join(', ')}]...`);

  const builder = createBuilder();
  builder.build(request, { campaigns, wallMs }).then(res => {
    console.log(`[builder-next] Status: ${res.status} (success=${res.success}) in ${(res.cost.wallMs / 1000).toFixed(1)}s (CPU: ${res.cost.cpuS.toFixed(1)}s, ${res.attempts.length} attempts)`);
    if (res.evaluation) {
      console.log(`[builder-next] Rating: D=${res.evaluation.D.toFixed(2)} (target ${target} +/- ${tol}), S=${res.evaluation.S.toFixed(2)}`);
      console.log(`[builder-next] Static gates: ${res.evaluation.staticPass ? 'PASS' : 'FAIL'}, Trace gates: ${res.evaluation.tracePass ? 'PASS' : 'FAIL'}`);
      if (res.finalCandidate?.card) {
        const c = res.finalCandidate.card;
        const cardText = typeof c === 'string' ? c : (c.cardText || c.card || c.sentence || JSON.stringify(c));
        console.log(`[builder-next] Card: ${cardText}`);
      }
    }
    if (!res.success) {
      console.log('[builder-next] Issues across attempts:');
      res.attempts.forEach((a, i) => console.log(`  #${i + 1} ${a.recipe?.id || 'recipe'}: issues=${(a.issues || [a.failure]).join(', ')}`));
      process.exit(1);
    }
  }).catch(err => {
    console.error('[builder-next] Error:', err);
    process.exit(1);
  });
}
