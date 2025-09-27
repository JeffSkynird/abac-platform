import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: ('admin'|'ops')[]) => SetMetadata('roles', roles);
