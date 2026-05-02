import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return false;
  }
}
