import { describe, it, expect, vi } from 'vitest';

const generateContent = vi.fn();
const constructorArgs = [];
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options) {
      constructorArgs.push(options);
      this.models = { generateContent };
    }
  },
}));

const { createGeminiClient } = await import('../../server/gemini.js');

describe('createGeminiClient', () => {
  it('requests schema-constrained JSON with the system instruction and a timeout', async () => {
    generateContent.mockResolvedValue({ text: '{"reply":"ok"}' });
    const client = createGeminiClient({ apiKey: 'test-key', timeoutMs: 1234 });
    const schema = { type: 'object' };

    await expect(client.generateJson({ system: 'SYS', prompt: 'PROMPT', schema })).resolves.toEqual({ reply: 'ok' });
    expect(client.model).toBe('gemini-2.5-flash');
    expect(constructorArgs.at(-1)).toEqual({ apiKey: 'test-key', httpOptions: { timeout: 1234 } });
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: 'PROMPT',
      config: expect.objectContaining({ systemInstruction: 'SYS', responseMimeType: 'application/json', responseJsonSchema: schema }),
    });
  });

  it('throws on non-JSON output so callers fall back to the engine', async () => {
    generateContent.mockResolvedValue({ text: 'not json' });
    await expect(createGeminiClient({ apiKey: 'k', model: 'm' }).generateJson({ system: '', prompt: '', schema: {} })).rejects.toThrow(SyntaxError);
    generateContent.mockResolvedValue({ text: undefined });
    await expect(createGeminiClient({ apiKey: 'k' }).generateJson({ system: '', prompt: '', schema: {} })).rejects.toThrow(SyntaxError);
  });
});
