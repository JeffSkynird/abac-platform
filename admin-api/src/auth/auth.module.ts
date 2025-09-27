import { Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [JwtStrategy, RolesGuard],
  exports: [RolesGuard]
})
export class AuthModule {}
