import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { validationPipeConfig } from '../config/validation.config';
import { UserId } from '../auth/decorators/user-id.decorator';
import { ResponsesService } from './responses.service';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ListResponsesQueryDto } from './dto/list-responses-query.dto';
import { PaginatedResponsesResponse } from './dto/paginated-responses.response';
import { PublicFormResponse } from './dto/public-form.response';

@ApiTags('Responses')
@Controller('api/forms')
@UsePipes(validationPipeConfig)
export class ResponsesController {
  constructor(private responsesService: ResponsesService) {}

  @Get(':id/public')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get an ACTIVE form for filling out (public)' })
  @ApiResponse({ status: 200, type: PublicFormResponse })
  @ApiResponse({ status: 404, description: 'Form not found or not active' })
  async getPublicForm(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PublicFormResponse> {
    return this.responsesService.getPublicForm(id);
  }

  @Post(':id/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a response to an ACTIVE form (public)' })
  @ApiResponse({ status: 201, description: 'Response recorded' })
  @ApiResponse({ status: 400, description: 'Invalid answers' })
  @ApiResponse({ status: 404, description: 'Form not found or not active' })
  async submit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmitResponseDto,
    @Req() req: Request,
  ) {
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
    const ipAddress =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress;

    return this.responsesService.submit(id, dto, { userAgent, ipAddress });
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List responses to a form (owner only, paginated)' })
  @ApiResponse({ status: 200, type: PaginatedResponsesResponse })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async list(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
    @Query() query: ListResponsesQueryDto,
  ): Promise<PaginatedResponsesResponse> {
    return this.responsesService.findAllByForm(id, ownerId, query);
  }

  @Get(':id/responses/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Aggregate response stats (owner only)' })
  @ApiResponse({ status: 200, description: 'Returns aggregated stats' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async stats(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
  ) {
    return this.responsesService.getStats(id, ownerId);
  }
}
