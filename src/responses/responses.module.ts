import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from '../forms/form.entity';
import { FormsModule } from '../forms/forms.module';
import { FormResponse } from './response.entity';
import { ResponsesService } from './responses.service';
import { ResponsesController } from './responses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Form, FormResponse]), FormsModule],
  controllers: [ResponsesController],
  providers: [ResponsesService],
})
export class ResponsesModule {}
