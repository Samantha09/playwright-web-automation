export const env = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
  API_URL: process.env.API_URL || 'http://127.0.0.1:8000',
  HEADLESS: process.env.HEADLESS !== 'false',
  SLOW_MO: Number(process.env.SLOW_MO || 0),
  TRACE: process.env.TRACE === '1',
  VIDEO: process.env.VIDEO === '1',
  SCREENSHOT: process.env.SCREENSHOT || 'only-on-failure',
  USERNAME: process.env.USERNAME || '',
  PASSWORD: process.env.PASSWORD || '',
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
  MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
  MINIMAX_MODEL: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
};
