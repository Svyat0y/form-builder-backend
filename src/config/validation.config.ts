import { ValidationPipe, BadRequestException } from '@nestjs/common';

export const validationPipeConfig = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => {
    const messages = errors.map((error) => ({
      field: error.property,
      message: Object.values(error.constraints || {}).join(', '),
    }));
    return new BadRequestException({
      message: 'Validation failed',
      errors: messages,
    });
  },
});
