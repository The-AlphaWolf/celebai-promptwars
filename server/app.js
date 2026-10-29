import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { generatePlan, reconcileBudget } from '../src/domain/planner.js';
import { respondOffline } from '../src/domain/assistant.js';
import { normalizeIntake, normalizePlan, sanitizeText } from '../src/domain/planSchema.js';
import { LIMITS } from '../src/domain/constants.js';
import {
  PLAN_SYSTEM_INSTRUCTION,
  CHAT_SYSTEM_INSTRUCTION,
  PLAN_RESPONSE_SCHEMA,
  CHAT_RESPONSE_SCHEMA,
  buildPlanPrompt,
  buildChatPrompt,
} from './prompts.js';

const AI_UNAVAILABLE = 'Gemini was unavailable, so the deterministic planning engine answered instead.';

function logAiFailure(route, error) {
  // Status/name only: SDK messages can echo request details.
  console.warn(`[${route}] Gemini call failed: ${error?.status ?? error?.name ?? 'unknown error'}`);
}

/** Model ideas first; engine ideas fill any shortfall so a plan never ends up with fewer ideas. */
function topUpIdeas(aiIdeas, engineIdeas) {
  const titles = new Set(aiIdeas.map((idea) => String(idea?.title).toLowerCase()));
  const fill = engineIdeas.filter((idea) => !titles.has(idea.title.toLowerCase()));
  return [...aiIdeas, ...fill].slice(0, Math.max(aiIdeas.length, engineIdeas.length));
}

/** Merges AI wording into an engine plan without touching any numbers. */
export function mergePlanEnrichment(plan, enrichment) {
  if (!enrichment || typeof enrichment !== 'object') return plan;
  const candidate = normalizePlan({
    ...plan,
    summary: enrichment.summary || plan.summary,
    creativeIdeas: topUpIdeas(Array.isArray(enrichment.creativeIdeas) ? enrichment.creativeIdeas : [], plan.creativeIdeas),
  });
  if (!candidate) return plan;
  const descriptions = new Map(
    (Array.isArray(enrichment.milestoneDescriptions) ? enrichment.milestoneDescriptions : [])
      .filter((entry) => entry && typeof entry.id === 'string')
      .map((entry) => [entry.id, sanitizeText(entry.description, LIMITS.longText)]),
  );
  return {
    ...plan,
    summary: candidate.summary,
    creativeIdeas: candidate.creativeIdeas,
    timeline: plan.timeline.map((m) => (descriptions.get(m.id) ? { ...m, description: descriptions.get(m.id) } : m)),
  };
}

/** Applies a model-proposed update on top of the current plan, then validates and re-balances it. */
export function applyProposedUpdate(plan, proposal) {
  if (!proposal || typeof proposal !== 'object') return null;
  // Budget items are a patch keyed by id: matching items are updated (keeping key and
  // colour), new ids are appended, and lines the model did not mention are kept.
  const patches = Array.isArray(proposal.budgetItems) ? proposal.budgetItems.filter((item) => item && typeof item === 'object') : [];
  const patchById = new Map(patches.map((item) => [item.id, item]));
  const budgetItems = [
    ...plan.budgetItems.map((existing) => ({ ...existing, ...patchById.get(existing.id) })),
    ...patches.filter((item) => !plan.budgetItems.some((existing) => existing.id === item.id)),
  ];
  const merged = normalizePlan({ ...plan, ...proposal, budgetItems });
  return merged ? reconcileBudget(merged) : null;
}

/**
 * @param {object} options
 * @param {{ generateJson: Function, model: string } | null} [options.ai] Gemini client, or null for engine-only mode
 * @param {string} [options.staticDir] built frontend to serve
 * @param {number | boolean} [options.trustProxy] Express "trust proxy" (1 on Cloud Run)
 * @param {number} [options.rateLimitPerMinute]
 * @param {() => Date} [options.now]
 */
export function createApp({ ai = null, staticDir, trustProxy = false, rateLimitPerMinute = 30, now = () => new Date() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: rateLimitPerMinute, standardHeaders: 'draft-8', legacyHeaders: false }));
  api.use(express.json({ limit: '64kb' }));

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', ai: Boolean(ai), model: ai?.model ?? null });
  });

  api.post('/plan', async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Expected a JSON object with the event details.' });
    }
    const intake = normalizeIntake(req.body);
    const plan = generatePlan(intake, now());
    if (!ai) return res.json({ plan, source: 'engine' });

    try {
      const enrichment = await ai.generateJson({
        system: PLAN_SYSTEM_INSTRUCTION,
        prompt: buildPlanPrompt(intake, plan),
        schema: PLAN_RESPONSE_SCHEMA,
      });
      return res.json({ plan: mergePlanEnrichment(plan, enrichment), source: 'gemini' });
    } catch (error) {
      logAiFailure('plan', error);
      return res.json({ plan, source: 'engine', notice: AI_UNAVAILABLE });
    }
  });

  api.post('/chat', async (req, res) => {
    const plan = normalizePlan(req.body?.plan);
    const message = sanitizeText(req.body?.message, LIMITS.chatMessage);
    if (!plan) return res.status(400).json({ error: 'A valid plan is required.' });
    if (!message) return res.status(400).json({ error: 'Message must be a non-empty string.' });

    const offline = () => {
      const result = respondOffline(plan, message, now());
      return { reply: result.text, plan: result.plan ?? null, source: 'engine' };
    };
    if (!ai) return res.json(offline());

    try {
      const answer = await ai.generateJson({
        system: CHAT_SYSTEM_INSTRUCTION,
        prompt: buildChatPrompt(plan, message),
        schema: CHAT_RESPONSE_SCHEMA,
      });
      const reply = sanitizeText(answer?.reply, 4000);
      if (!reply) throw new Error('EMPTY_REPLY');
      return res.json({ reply, plan: applyProposedUpdate(plan, answer.updatedPlan), source: 'gemini' });
    } catch (error) {
      logAiFailure('chat', error);
      return res.json({ ...offline(), notice: AI_UNAVAILABLE });
    }
  });

  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/api', api);

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
  app.use((error, _req, res, _next) => {
    const status = error.status || error.statusCode || 500;
    if (status >= 500) console.error('Unhandled server error:', error.name);
    res.status(status).json({ error: status === 413 ? 'Request body too large.' : status < 500 ? 'Invalid request.' : 'Internal server error.' });
  });

  return app;
}
