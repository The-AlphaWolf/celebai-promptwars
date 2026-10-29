import { GoogleGenAI } from '@google/genai';

/**
 * Thin wrapper around the Gemini SDK that always asks for JSON matching a
 * schema. The API key stays on the server; it is never sent to the browser.
 *
 * @param {{ apiKey: string, model?: string, timeoutMs?: number }} options
 * @returns {{ model: string, generateJson: (args: { system: string, prompt: string, schema: object }) => Promise<unknown> }}
 */
export function createGeminiClient({ apiKey, model = 'gemini-2.5-flash', timeoutMs = 20_000 }) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } });

  return {
    model,
    async generateJson({ system, prompt, schema }) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      });
      return JSON.parse(response.text ?? '');
    },
  };
}
