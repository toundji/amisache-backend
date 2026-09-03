// ============================================================
// swagger-config.ts — Configuration Swagger / OpenAPI
// Modifiez le titre, la description et les headers d'auth
// selon votre projet.
// ============================================================
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import 'dotenv/config';

// Doit rester le même header que celui lu par
// core/middleware/api-middleware.ts (API_KEY_HEADER_NAME) — un nom en dur ici
// désynchronisé de l'env fait échouer silencieusement le bouton "Authorize"
// de Swagger (401 "API key missing" alors que la clé est bien renseignée).
const API_KEY_HEADER_NAME = process.env.API_KEY_HEADER_NAME ?? 'api-key';

const _swagger_config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription(
        `Documentation du webservice.\n\n` +
        `Contact : https://atoundji.com`,
    )
    .setVersion('1.0')
    .addApiKey(
        {
            type: 'apiKey',
            name: API_KEY_HEADER_NAME,
            description: 'Clé API client (mobile, web, back-office...)',
            in: 'header',
        },
        'apiKey',
    )
    .addBearerAuth(
        {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'JWT',
            description: 'Access token JWT',
            in: 'header',
        },
        'token',
    )
    // Exigence globale par défaut — un seul objet {apiKey, token} (AND, pas
    // deux entrées séparées qui seraient lues comme un OU) : la grande
    // majorité des routes exigent les deux ensemble (ApiKeyGuard +
    // RequireAuthGuard). Les routes @Public() n'ont pas besoin du bearer,
    // mais Swagger UI l'envoie quand même sans que ça pose de souci côté API
    // (RequireAuthGuard est bypass sur ces routes) — sans exigence globale,
    // Swagger UI n'envoyait AUCUN header sur AUCUNE route, faute de sécurité
    // déclarée par opération.
    .addSecurityRequirements({ apiKey: [], token: [] })
    .build();

export const swagger_config = (app: any) => {
    const document = SwaggerModule.createDocument(app, _swagger_config);
    SwaggerModule.setup('/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });
    writeFileSync('./swagger.json', JSON.stringify(document));
};
