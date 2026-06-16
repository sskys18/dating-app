import { Controller, Delete, HttpCode, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';

@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(private accountService: AccountService) {}

  // REQ-RET-03 + App Store account-deletion requirement.
  @Delete()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: Request) {
    return this.accountService.deleteAccount(req.user!.id);
  }
}
