import { ConfigService } from '@nestjs/config';

export const createCorsConfig = (configService: ConfigService) => {
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
