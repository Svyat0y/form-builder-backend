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
import { validationPipeConfig } from '../config/validation.config';
import { UserId } from '../auth/decorators/user-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/user.entity';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import { PaginatedFormsResponse } from './dto/paginated-forms.response';

@ApiTags('Forms')
@ApiBearerAuth('JWT-auth')
@Controller('api/forms')
@UseGuards(JwtAuthGuard)
@UsePipes(validationPipeConfig)
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Get()
  @ApiOperation({
    summary: "List the current user's forms (paginated, searchable by title)",
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a page of forms',
    type: PaginatedFormsResponse,
  })
  async list(
    @UserId() ownerId: string,
    @Query() query: ListFormsQueryDto,
  ): Promise<PaginatedFormsResponse> {
    return this.formsService.findAllByOwner(ownerId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new form (DRAFT)' })
  @ApiResponse({ status: 201, description: 'Form created' })
  async create(@UserId() ownerId: string, @Body() dto: CreateFormDto) {
    return this.formsService.create(ownerId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a form (owner only)' })
  @ApiResponse({ status: 200, description: 'Returns the form' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
  ) {
    return this.formsService.findOwnedForm(id, ownerId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update title/description/fields/settings (autosave)',
  })
  @ApiResponse({ status: 200, description: 'Form updated' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.formsService.update(id, ownerId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a form' })
  @ApiResponse({ status: 200, description: 'Form deleted' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
  ) {
    await this.formsService.remove(id, ownerId);
    return { message: 'Form deleted successfully' };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a form: DRAFT|CLOSED -> ACTIVE' })
  @ApiResponse({ status: 200, description: 'Form published' })
  @ApiResponse({ status: 400, description: 'Form is already published' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
  ) {
    return this.formsService.publish(id, ownerId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a form: ACTIVE -> CLOSED' })
  @ApiResponse({ status: 200, description: 'Form unpublished' })
  @ApiResponse({
    status: 400,
    description: 'Only a published form can be unpublished',
  })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async unpublish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() ownerId: string,
  ) {
    return this.formsService.unpublish(id, ownerId);
  }

  // Admin Panel "Forms" tab — browse/unpublish/delete another user's forms.
  // ADMIN can only act on regular USER accounts, SUPER_ADMIN can act on
  // anyone's (mirrors the session-management rule in UsersController).
  @Get('admin/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "List a specific user's forms (admin)" })
  @ApiResponse({
    status: 200,
    description: 'Returns a page of the target user\'s forms',
    type: PaginatedFormsResponse,
  })
  @ApiResponse({
    status: 403,
    description: 'Admins can only browse forms of regular users',
  })
  async listForUserAdmin(
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @UserId() requestingUserId: string,
    @Query() query: ListFormsQueryDto,
  ): Promise<PaginatedFormsResponse> {
    return this.formsService.findAllByOwnerAdmin(
      requestingUserId,
      targetUserId,
      query,
    );
  }

  @Post('admin/:id/unpublish')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Unpublish any user's form (admin)" })
  @ApiResponse({ status: 200, description: 'Form unpublished' })
  @ApiResponse({
    status: 403,
    description: 'Admins can only manage forms of regular users',
  })
  async unpublishAdmin(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() requestingUserId: string,
  ) {
    return this.formsService.unpublishAdmin(id, requestingUserId);
  }

  @Delete('admin/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Delete any user's form (admin)" })
  @ApiResponse({ status: 200, description: 'Form deleted' })
  @ApiResponse({
    status: 403,
    description: 'Admins can only manage forms of regular users',
  })
  async removeAdmin(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() requestingUserId: string,
  ) {
    await this.formsService.removeAdmin(id, requestingUserId);
    return { message: 'Form deleted successfully' };
  }
}
