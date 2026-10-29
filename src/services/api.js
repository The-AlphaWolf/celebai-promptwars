/**
 * Browser client for the CelebAI API. Every call degrades to the in-browser
 * planning engine when the server or Gemini is unavailable (for example on
 * static hosting), so the planner always works.
 */
import { generatePlan } from '../domain/planner.js';
import { respondOffline } from '../domain/assistant.js';
import { normalizePlan, sanitizeText } from '../domain/planSchema.js';

const REQUEST_TIMEOUT_MS = 25_000;
const OFFLINE_NOTICE = 'Planning server unreachable, so the plan was built in your browser.';

/** Static hosting (GitHub Pages) has no API server: skip the network and use the engine directly. */
const isStaticDemo = () => import.meta.env.VITE_STATIC_DEMO === 'true';

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** @returns {Promise<'live' | 'offline'>} whether Gemini is configured on the server */
export async function checkAiStatus() {
  if (isStaticDemo()) return 'offline';
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return 'offline';
    const data = await response.json();
    return data.ai === true ? 'live' : 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * @param {object} intake form data
 * @returns {Promise<{ plan: object, source: 'gemini' | 'engine', notice?: string }>}
 */
export async function createPlan(intake) {
  if (isStaticDemo()) return { plan: generatePlan(intake), source: 'engine' };
  try {
    const data = await postJson('/api/plan', intake);
    const plan = normalizePlan(data.plan);
    if (!plan) throw new Error('INVALID_PLAN');
    return { plan, source: data.source === 'gemini' ? 'gemini' : 'engine', notice: data.notice };
  } catch {
    return { plan: generatePlan(intake), source: 'engine', notice: OFFLINE_NOTICE };
  }
}

/**
 * @returns {Promise<{ reply: string, plan: object | null, source: 'gemini' | 'engine', notice?: string }>}
 */
export async function sendChat(plan, message) {
  if (isStaticDemo()) return offlineReply(plan, message);
  try {
    const data = await postJson('/api/chat', { plan, message });
    const reply = sanitizeText(data.reply, 4000);
    if (!reply) throw new Error('EMPTY_REPLY');
    return { reply, plan: data.plan ? normalizePlan(data.plan) : null, source: data.source === 'gemini' ? 'gemini' : 'engine', notice: data.notice };
  } catch {
    return offlineReply(plan, message);
  }
}

function offlineReply(plan, message) {
  const result = respondOffline(plan, message);
  return { reply: result.text, plan: result.plan ?? null, source: 'engine' };
}
