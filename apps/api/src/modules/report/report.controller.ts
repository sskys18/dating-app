import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminKeyGuard } from '../auth/admin-key.guard';
import { ReportService } from './report.service';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ResolveReportDto } from './dto/resolve-report.dto';

// Admin actions are attributed to this synthetic id when authenticated via the
// shared admin key (no JWT, so no req.user). See AdminKeyGuard's shortcut note.
const ADMIN_KEY_ACTOR = 'admin-key';

@ApiTags('reports')
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  // End-user surface: requires a real authenticated session.
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Report a user (captures an evidence snapshot)' })
  async createReport(@Req() req: Request, @Body() dto: CreateReportDto) {
    return this.reportService.createReport(req.user!.id, dto);
  }

  // Admin surface: AdminKeyGuard accepts the x-admin-key header OR a role=admin
  // JWT user. No JwtAuthGuard here so the key-only path works without a token.
  @Get()
  @UseGuards(AdminKeyGuard)
  @ApiOperation({ summary: 'Admin: list reports, optionally filtered by status' })
  async listReports(@Query('status') status?: string) {
    return this.reportService.listReports(status);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  @ApiOperation({ summary: 'Admin: resolve a report, optionally banning the user' })
  async resolveReport(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportService.resolveReport(id, req.user?.id ?? ADMIN_KEY_ACTOR, dto);
  }
}
