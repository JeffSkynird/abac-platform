import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const audience = process.env.OIDC_AUDIENCE!;
    const jwksUri = process.env.OIDC_JWKS_URI!;
    const issuers = (process.env.OIDC_ACCEPTED_ISSUERS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      audience,
      issuer: issuers.length ? issuers : undefined, 
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }) as any,
    });
  }

  async validate(payload: any) {
    // TODO: Custom Validations
    return payload;
  }
}
