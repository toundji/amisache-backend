// ============================================================
// data-source.ts
// DataSource TypeORM pour le CLI (migrations) — distinct de
// base_orm_config.ts (utilisé par TypeOrmModule.forRoot dans
// AppModule). Pointe sur dist/ : le CLI tourne après `nest build`.
// ============================================================
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { baseOrmConfig } from './base_orm_config';

const dataSource = new DataSource({
    ...baseOrmConfig,
    entities: ['dist/**/*/*.entity{.ts,.js}'],
    migrations: ['dist/database/migrations/*.js'],
} as any);

export default dataSource;
