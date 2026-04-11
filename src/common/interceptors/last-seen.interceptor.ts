import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LastSeenInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    return next.handle().pipe(
      tap(() => {
        if (req.user?.id) {
          void this.prisma.user.update({
            where: { id: req.user.id },
            data: { last_seen_at: new Date() },
          });
        }
      }),
    );
  }
}
