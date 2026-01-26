import { ConfigService } from '@nestjs/config';

// ============================================
// CORS НАСТРОЙКА: измените на true для тестирования (разрешает все origin'ы)
// false = строгий CORS (только разрешенные origin'ы из CORS_ORIGINS)
// true = разрешить все (для тестирования с ngrok/телефоном)
// ============================================
const ALLOW_ALL_ORIGINS = true; // Включено для тестирования с localtunnel

export const createCorsConfig = (configService: ConfigService) => {
  // Режим тестирования: разрешить все origin'ы
  if (ALLOW_ALL_ORIGINS) {
    console.log('⚠️  CORS: Allowing all origins (TEST MODE)');
    return {
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Bypass-Tunnel-Reminder',
        'bypass-tunnel-reminder',
      ],
      credentials: true,
    };
  }

  // Строгий режим: только разрешенные origin'ы
  const frontendUrls = configService.get<string>('CORS_ORIGINS');

  if (!frontendUrls) {
    throw new Error('CORS_ORIGINS environment variable is required');
  }

  const allowedOrigins = frontendUrls
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one URL');
  }

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('🚫 CORS blocked for origin:', origin);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  };
};
