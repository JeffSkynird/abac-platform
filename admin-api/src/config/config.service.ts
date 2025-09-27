import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfig {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = Number(process.env.PORT ?? 3001);

  readonly dbUrl = process.env.DB_URL!;
  readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  readonly pdpBaseUrl = process.env.PDP_BASE_URL ?? 'http://pdp:8081';

  readonly oidc = {
    issuer: process.env.OIDC_ISSUER!,
    audience: process.env.OIDC_AUDIENCE ?? 'admin-api',
    requiredRoles: (process.env.OIDC_REQUIRED_ROLES ?? 'admin,ops').split(',').map(s => s.trim())
  };
}
