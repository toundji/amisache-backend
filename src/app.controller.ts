import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NoKey, Public } from './core/decorators/api.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @NoKey()
  @ApiOperation({ summary: "Statut de l'API" })
  getStatus(): object {
    return this.appService.getStatus();
  }
}
