import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { validationPipeConfig } from '../config/validation.config';
import { UserId } from '../auth/decorators/user-id.decorator';
import { UserRole } from '../users/user.entity';
import { FeedbackService } from './feedback.service';
import { Feedback } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { PaginatedFeedbackResponse } from './dto/paginated-feedback.response';

@ApiTags('Feedback')
@ApiBearerAuth('JWT-auth')
@Controller('api/feedback')
@UseGuards(JwtAuthGuard)
@UsePipes(validationPipeConfig)
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit feedback (any authenticated user)' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  async create(@Body() dto: CreateFeedbackDto, @UserId() userId: string) {
    await this.feedbackService.create(userId, dto);
    return { message: 'Feedback submitted' };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List feedback (ADMIN/SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: PaginatedFeedbackResponse })
  async findAll(
    @Query() query: ListFeedbackQueryDto,
  ): Promise<PaginatedFeedbackResponse> {
    return this.feedbackService.findAll(query);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update feedback status (ADMIN/SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: Feedback })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @UserId() adminUserId: string,
  ): Promise<Feedback> {
    // Returns the updated row (with user/handledByUser) rather than a bare
    // message — the admin list UI replaces the row in place with this.
    return this.feedbackService.updateStatus(id, dto.status, adminUserId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete feedback (ADMIN/SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Feedback deleted' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.feedbackService.remove(id);
    return { message: 'Feedback deleted' };
  }
}
