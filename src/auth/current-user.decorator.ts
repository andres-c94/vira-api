import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  email: string;
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): JwtUser => {
  const request = context.switchToHttp().getRequest<{ user: JwtUser }>();
  return request.user;
});
