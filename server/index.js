import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createGeminiClient } from './gemini.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GEMINI_API_KEY, GEMINI_MODEL, PORT = '8080', TRUST_PROXY } = process.env;

const ai = GEMINI_API_KEY ? createGeminiClient({ apiKey: GEMINI_API_KEY, model: GEMINI_MODEL || undefined }) : null;

const app = createApp({
  ai,
  staticDir: path.join(root, 'dist'),
  trustProxy: TRUST_PROXY ? Number(TRUST_PROXY) : false,
});

app.listen(Number(PORT), () => {
  console.log(`CelebAI listening on http://localhost:${PORT} (${ai ? `Gemini: ${ai.model}` : 'engine-only mode, GEMINI_API_KEY not set'})`);
});
