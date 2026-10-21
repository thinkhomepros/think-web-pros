import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = 'You help small business owners design logos and websites for Think Web Pros. Answer the request directly and concisely.';

// Pulls the first JSON object out of a model reply (tolerates code fences or a sentence around it).
export function parseJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

// Returns null when no API key is configured, so the studio falls back to its built-in idea engine.
export function createAi({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5' } = {}) {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });

  return {
    model,
    async complete(prompt, { json = false } = {}) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{
          role: 'user',
          content: json ? `${prompt}\nReturn the JSON object only, with no other text.` : prompt,
        }],
      });
      if (response.stop_reason === 'refusal') {
        const err = new Error('The AI declined this request.');
        err.code = 'refused';
        throw err;
      }
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { text, json: json ? parseJsonObject(text) : undefined };
    },
  };
}
