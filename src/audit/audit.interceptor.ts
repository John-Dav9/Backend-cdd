import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    const method = request.method?.toUpperCase();
    if (!['admin', 'super_admin'].includes(role) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(tap(() => {
      const resourceType = request.path?.split('/').filter(Boolean)[1] ?? 'unknown';
      void this.audit.log({
        userId: request.user?.sub,
        userEmail: request.user?.email,
        action: `${resourceType}.${method.toLowerCase()}`,
        resourceType,
        resourceId: request.params?.id ?? request.params?.participantId,
        details: this.sanitize(request.body),
        ipAddress: request.ip ?? request.socket?.remoteAddress,
      }).catch(() => undefined);
    }));
  }

  private sanitize(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => this.sanitize(item));
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = /(password|code|token|secret|key)/i.test(key)
        ? '[REDACTED]'
        : this.sanitize(item);
    }
    return result;
  }
}
