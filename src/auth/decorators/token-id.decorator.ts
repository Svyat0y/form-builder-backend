/* eslint-disable @typescript-eslint/no-unsafe-return */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TokenId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tokenId = request.user?.tokenId;

    if (!tokenId) {
      throw new Error('Token ID not found in request');
    }

    return tokenId;
  },
);
