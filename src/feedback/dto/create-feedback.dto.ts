import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    example: 'The export button on the responses page does nothing.',
    maxLength: 3000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MaxLength(3000)
  message: string;
}
