// ============================================================
// UNIFIED AUTH — api-error-filter.ts  (v2)
//
// Responsabilité unique : intercepter toutes les exceptions,
// loguer ce qui doit l'être, retourner une réponse propre.
//
// Règles :
//   • Détails internes (stack, cause DB) → logs serveur uniquement
//   • Client reçoit toujours : statusCode, msg, customCode, body, url
//   • Niveau de log respecté (error / warn / info)
// ============================================================
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { format } from 'date-fns';

import {
  ApiError,
  ApiErrorDb,
  AppValidationError,
} from '../../utils/api-error';

// ── Shape de la réponse client ────────────────────────────────

interface ApiErrorResponse {
  statusCode: number;
  msg: string;
  customCode?: number;
  body?: unknown;
  url: string;
  timestamp: string;
  // Validation uniquement
  validations?: Record<string, unknown>;
}

// ── Filter ────────────────────────────────────────────────────

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const url = request.url;
    const timestamp = new Date().toISOString();

    const { status, body } = this.resolve(exception, url, timestamp, request);

    response.status(status).json(body);
  }

  // ── Résolution par type ───────────────────────────────────

  private resolve(
    exception: unknown,
    url: string,
    timestamp: string,
    request: Request,
  ): { status: number; body: ApiErrorResponse } {
    // 1 — Erreur DB (sous-classe ApiError — vérifier avant ApiError)
    if (exception instanceof ApiErrorDb) {
      this.logDb(exception, request);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          msg: exception.msg,
          url,
          timestamp,
        },
      };
    }

    // 2 — Erreur métier (ApiError)
    if (exception instanceof ApiError) {
      const status = exception.getStatus();
      // Logger automatiquement les 5xx, et les 4xx marqués shouldLog
      if (status >= 500 || exception.shouldLog) {
        this.logApiError(exception, request);
      }
      return {
        status,
        body: {
          statusCode: status,
          msg: exception.msg,
          customCode: exception.customCode,
          body: exception.body,
          url,
          timestamp,
        },
      };
    }

    // 3 — Erreur de validation (class-validator)
    // ⚠️  Doit être avant HttpException car AppValidationError extends BadRequestException extends HttpException
    if (exception instanceof AppValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          msg: exception.msg,
          validations: exception.validations,
          url,
          timestamp,
        },
      };
    }

    // 4 — HttpException NestJS standard
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logUnexpected(exception, request);
      return {
        status,
        body: {
          statusCode: status,
          msg: exception.message,
          url,
          timestamp,
        },
      };
    }

    // 5 — Erreur JS générique / microservice
    if (exception instanceof Error) {
      this.logUnexpected(exception, request);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          msg: 'An unexpected error occurred.',
          url,
          timestamp,
        },
      };
    }

    // 6 — Inconnu
    this.logger.error('Unknown exception type', exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        msg: 'An unexpected error occurred.',
        url,
        timestamp,
      },
    };
  }

  // ── Helpers de logging ────────────────────────────────────

  private logDb(err: ApiErrorDb, req: Request): void {
    this.logger.error(
      [
        `[DB ERROR] ${err.entity}.${err.op}`,
        `  caller  : ${this.formatCaller(err)}`,
        `  request : ${this.formatRequest(req)}`,
        `  context : ${JSON.stringify(err.context)}`,
        `  cause   : ${err.dbCause instanceof Error ? err.dbCause.message : err.dbCause}`,
      ].join('\n'),
    );
  }

  private logApiError(err: ApiError, req: Request): void {
    const detail = err.detail ? ` | detail: ${err.detail}` : '';
    const line = `[${err.level.toUpperCase()}] ${err.msg}${detail} | ${this.formatCaller(err)} | ${this.formatRequest(req)}`;
    if (err.level === 'warn') {
      this.logger.warn(line);
    } else {
      this.logger.error(line);
    }
  }

  private logUnexpected(err: Error, req: Request): void {
    this.logger.error(
      `[UNEXPECTED] ${err.message}\n  request: ${this.formatRequest(req)}\n  stack: ${err.stack}`,
    );
  }

  private formatRequest(req: Request): string {
    const ts = format(new Date(), 'dd.MM.yyyy HH:mm:ss');
    const user = (req as any).user?.email ?? 'anonymous';
    const ip = (req as any).userIp ?? req.ip;
    return `${ts} ${req.method} ${req.path} | user=${user} ip=${ip}`;
  }

  private formatCaller(err: ApiError): string {
    const { file, class: cls, method } = err.caller;
    return [file, cls, method].filter(Boolean).join('.');
  }
}
