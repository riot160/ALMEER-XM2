import dotenv from 'dotenv';
dotenv.config();

export const config = {
  ownerNumber: process.env.OWNER_NUMBER || '',
  botName: process.env.BOT_NAME || "✞『✦ALMEER ✠ MD✦』✞",
  prefix: process.env.PREFIX || '.',
  groqApiKey: process.env.GROQ_API_KEY || '',
  sessionId: process.env.SESSION_ID || '',
  autostatus: String(process.env.AUTOSTATUS || 'true') === 'true',
  port: Number(process.env.PORT || process.env.SERVER_PORT || 3000)
};
