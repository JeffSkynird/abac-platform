import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, from, throwError } from 'rxjs';
import { catchError, finalize, mergeMap, map } from 'rxjs/operators';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly ds: DataSource) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = ctx.switchToHttp().getRequest();
    const tenantId =
      (req.query?.tenantId || req.body?.tenantId || req.headers['x-tenant-id'])?.toString();

    const qr = this.ds.createQueryRunner();
    req.qr = qr;

    return from((async () => {
      await qr.connect();
      await qr.startTransaction();
      if (tenantId) {
        await qr.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      } else {
        await qr.query(`SELECT set_config('app.tenant_id', NULL, true)`);
      }
    })()).pipe(
      mergeMap(() => next.handle()),
      mergeMap((res) =>
        from(qr.commitTransaction()).pipe(map(() => res))
      ),
      catchError((err) =>
        from((async () => {
          if (qr.isTransactionActive) await qr.rollbackTransaction();
          throw err;
        })()).pipe(mergeMap(() => throwError(() => err)))
      ),
      finalize(() => {
        qr.release().catch(() => {});
      }),
    );
  }
}
