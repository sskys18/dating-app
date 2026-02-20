import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PhotoModule } from '../photo/photo.module';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [AuthModule, PhotoModule],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
