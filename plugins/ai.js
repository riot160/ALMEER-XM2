import Groq from 'groq-sdk';
import { config } from '../config.js';

export const commands = {
  ai: async ({ args, reply }) => {
    try {
      if (!config.groqApiKey) return reply('GROQ_API_KEY is not set.');
      const client = new Groq({ apiKey: config.groqApiKey });
      const prompt = args.join(' ');
      if (!prompt) return reply('Usage: .ai <prompt>');
      const res = await client.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }]
      });
      reply(res.choices[0].message.content);
    } catch (e) {
      reply(`AI error: ${e.message}`);
    }
  },
  gpt: async (ctx) => commands.ai(ctx)
};
