import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkAiStatus, createPlan, sendChat } from '../../src/services/api.js';
import { generatePlan } from '../../src/domain/planner.js';

const intake = { eventType: 'community', title: 'Fair', date: '2027-06-01', guestCount: 300, budget: 12000, location: 'Park' };
const plan = generatePlan(intake, new Date('2026-10-28'));

const respond = (body, ok = true, status = 200) => vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkAiStatus', () => {
  it('is live only when the server says AI is configured', async () => {
    vi.stubGlobal('fetch', respond({ ai: true }));
    expect(await checkAiStatus()).toBe('live');
    vi.stubGlobal('fetch', respond({ ai: false }));
    expect(await checkAiStatus()).toBe('offline');
  });

  it('is offline on HTTP errors and network failures (static hosting)', async () => {
    vi.stubGlobal('fetch', respond({}, false, 404));
    expect(await checkAiStatus()).toBe('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await checkAiStatus()).toBe('offline');
  });
});

describe('createPlan', () => {
  it('returns the validated server plan', async () => {
    vi.stubGlobal('fetch', respond({ plan, source: 'gemini' }));
    const result = await createPlan(intake);
    expect(result.source).toBe('gemini');
    expect(result.plan.title).toBe('Fair');
    expect(fetch).toHaveBeenCalledWith('/api/plan', expect.objectContaining({ method: 'POST' }));
  });

  it('falls back to the in-browser engine when the server is unreachable or returns an invalid plan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const offline = await createPlan(intake);
    expect(offline).toMatchObject({ source: 'engine', notice: expect.stringMatching(/browser/) });
    expect(offline.plan.budgetItems.reduce((sum, item) => sum + item.allocated, 0)).toBe(12000);

    vi.stubGlobal('fetch', respond({ plan: { title: 'bad' } }));
    expect((await createPlan(intake)).source).toBe('engine');
  });
});

describe('sendChat', () => {
  it('returns the server reply and validated plan', async () => {
    vi.stubGlobal('fetch', respond({ reply: 'Done', plan: { ...plan, budget: 13000 }, source: 'gemini' }));
    const result = await sendChat(plan, 'raise budget');
    expect(result).toMatchObject({ reply: 'Done', source: 'gemini' });
    expect(result.plan.budget).toBe(13000);
  });

  it('drops an invalid proposed plan but keeps the reply', async () => {
    vi.stubGlobal('fetch', respond({ reply: 'Hmm', plan: 'nope', source: 'gemini' }));
    expect((await sendChat(plan, 'x')).plan).toBeNull();
  });

  it('answers offline when the server fails', async () => {
    vi.stubGlobal('fetch', respond({}, false, 500));
    const result = await sendChat(plan, 'set budget to 15000');
    expect(result.source).toBe('engine');
    expect(result.plan.budget).toBe(15000);
  });
});

describe('static demo build (VITE_STATIC_DEMO=true)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never calls the network and answers with the engine', async () => {
    vi.stubEnv('VITE_STATIC_DEMO', 'true');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await checkAiStatus()).toBe('offline');
    const created = await createPlan(intake);
    expect(created).toEqual({ plan: generatePlan(intake), source: 'engine' });
    const chat = await sendChat(plan, 'set budget to 15000');
    expect(chat.plan.budget).toBe(15000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
