import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { Audit } from '../../shared/audit';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  DataSource,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

@EventSubscriber()
export class UserAuditSubscriber implements EntitySubscriberInterface<Audit> {
  constructor(
    dataSource: DataSource,
    private readonly cls: ClsService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Audit;
  }

  beforeInsert(event: InsertEvent<Audit>) {
    event.entity.createdBy = this.cls.get('user')?.id;
  }

  beforeUpdate(event: UpdateEvent<Audit>) {
    if (event.entity) event.entity.updatedBy = this.cls.get('user')?.id;
  }
}

@Injectable()
export class UserAuditInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Interceptor HTTP uniquement — le contexte CLS (nestjs-cls) n'est
    // initialisé que pour les requêtes HTTP (ClsMiddleware). Un handler WS
    // (ChatGateway, @SubscribeMessage) n'a aucun contexte CLS actif : y
    // appeler `cls.set()` lève "No CLS context available" et fait planter
    // silencieusement le handler avant même son exécution (piège déjà
    // rencontré avec les guards globaux — voir jwt-auth.guard.ts).
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    this.cls.set('user', user);
    return next.handle();
  }
}
