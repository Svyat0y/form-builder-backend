import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@ApiTags('Forms')
@ApiBearerAuth('JWT-auth')
@Controller('api/forms')
@UseGuards(JwtAuthGuard)
@UsePipes(validationPipeConfig)
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's forms" })
  @ApiResponse({ status: 200, description: 'Returns array of forms' })
  async list(@UserId() ownerId: string) {
    return this.formsService.findAllByOwner(ownerId);
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
}
