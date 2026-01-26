/* eslint-disable @typescript-eslint/no-unsafe-return */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return userId;
  },
);
