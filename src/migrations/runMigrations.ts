/**
 * ObeliskUSDT 数据库迁移执行器（支持 mysql / postgres / sqlite）
 *
 * @author Telegram @okgeceo
 */

import fs from 'fs';
import path from 'path';
import type { Sequelize } from 'sequelize';

/** 与 Sequelize.query 兼容的通用执行函数，便于接入 Prisma/Knex/mysql2 等 */
export type MigrationSqlQuery = (
  sql: string,
  options?: { replacements?: Record<string, unknown> },
) => Promise<unknown>;

export type MigrationDialect = 'mysql' | 'postgres' | 'sqlite';

export interface RunMigrationsOptions {
  sequelize?: Sequelize;
  /** 与 `sequelize` 二选一：需支持命名占位符替换（与 Sequelize replacements 行为一致） */
  query?: MigrationSqlQuery;
  /** 显式指定方言；未传时从 sequelize.getDialect() 推断 */
  dialect?: MigrationDialect;
  migrationDir?: string;
  migrationTableName?: string;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}

export interface RunMigrationsResult {
  migrationDir: string;
  dialect: MigrationDialect;
  totalFiles: number;
  executed: string[];
  skipped: string[];
}

function migrationRoots(): string[] {
  return [
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
  ];
}

export function resolveMigrationDialect(sequelize?: Sequelize, override?: MigrationDialect): MigrationDialect {
  if (override) return override;
  const raw = String(sequelize?.getDialect?.() || '').toLowerCase();
  if (raw === 'postgres' || raw === 'postgresql') return 'postgres';
  if (raw === 'mysql' || raw === 'mariadb') return 'mysql';
  if (raw === 'sqlite') return 'sqlite';
  throw new Error(`runObeliskUSDTMigrations: 不支持的数据库方言「${raw || 'unknown'}」`);
}

export function resolveMigrationDir(dialect: MigrationDialect, explicitDir?: string): string {
  if (explicitDir) return explicitDir;
  for (const root of migrationRoots()) {
    const nested = path.join(root, dialect);
    if (fs.existsSync(nested)) return nested;
  }
  throw new Error(`runObeliskUSDTMigrations: 未找到 ${dialect} 迁移目录`);
}

function logInfo(logger: RunMigrationsOptions['logger'], message: string, payload?: unknown): void {
  if (logger?.info) logger.info(message, payload);
}

function logWarn(logger: RunMigrationsOptions['logger'], message: string, payload?: unknown): void {
  if (logger?.warn) logger.warn(message, payload);
}

function isIgnorableIdempotentError(error: any): boolean {
  const code = String(error?.original?.code || error?.code || error?.parent?.code || '');
  const errno = Number(error?.original?.errno || error?.errno || 0);
  const message = String(
    error?.original?.sqlMessage || error?.original?.detail || error?.message || '',
  ).toLowerCase();
  if (code === 'ER_DUP_KEYNAME' || errno === 1061) return true;
  if (code === 'ER_TABLE_EXISTS_ERROR' || errno === 1050) return true;
  if (code === 'ER_DUP_FIELDNAME' || errno === 1060) return true;
  if (code === '42P07') return true;
  if (code === '42701') return true;
  if (code === '23505') return true;
  if (message.includes('duplicate key name')) return true;
  if (message.includes('already exists')) return true;
  if (message.includes('duplicate column')) return true;
  return false;
}

function resolveQuery(options: RunMigrationsOptions): MigrationSqlQuery {
  if (options.sequelize) {
    const sq = options.sequelize;
    return (sql, opts) => sq.query(sql, opts);
  }
  if (options.query) {
    return options.query;
  }
  throw new Error('runObeliskUSDTMigrations: 请传入 sequelize 或 query');
}

async function ensureMigrationTable(
  query: MigrationSqlQuery,
  tableName: string,
  dialect: MigrationDialect,
): Promise<void> {
  if (dialect === 'postgres') {
    await query(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id BIGSERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );
    return;
  }
  if (dialect === 'sqlite') {
    await query(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    return;
  }
  await query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

function splitMigrationStatements(rawSql: string): string[] {
  const lines: string[] = [];
  for (const line of rawSql.split('\n')) {
    if (line.trimStart().startsWith('--')) continue;
    lines.push(line);
  }
  const cleaned = lines.join('\n');
  const out: string[] = [];
  for (const chunk of cleaned.split(';')) {
    const stmt = chunk.trim();
    if (stmt) out.push(stmt);
  }
  return out;
}

async function getExecutedMigrations(query: MigrationSqlQuery, tableName: string): Promise<Set<string>> {
  const raw = await query(`SELECT migration_name FROM ${tableName}`);
  let list: unknown[];
  if (Array.isArray(raw) && raw.length >= 1 && Array.isArray((raw as unknown[])[0])) {
    list = (raw as unknown[])[0] as unknown[];
  } else if (Array.isArray(raw)) {
    list = raw as unknown[];
  } else {
    list = [];
  }
  const set = new Set<string>();
  for (const row of list as Array<Record<string, unknown>>) {
    const name = String(row.migration_name || '').trim();
    if (name) set.add(name);
  }
  return set;
}

export async function runObeliskUSDTMigrations(options: RunMigrationsOptions): Promise<RunMigrationsResult> {
  const query = resolveQuery(options);
  const dialect = resolveMigrationDialect(options.sequelize, options.dialect);
  const migrationDir = resolveMigrationDir(dialect, options.migrationDir);
  const migrationTableName = options.migrationTableName || 'obl_usdt_schema_migrations';
  const logger = options.logger;

  if (!fs.existsSync(migrationDir)) {
    throw new Error(`迁移目录不存在: ${migrationDir}`);
  }

  await ensureMigrationTable(query, migrationTableName, dialect);
  const executedSet = await getExecutedMigrations(query, migrationTableName);

  const files = fs
    .readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const executed: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (executedSet.has(file)) {
      skipped.push(file);
      continue;
    }

    const fullPath = path.join(migrationDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8').trim();
    if (!sql) {
      skipped.push(file);
      await query(`INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`, {
        replacements: { name: file },
      });
      continue;
    }

    try {
      const statements = splitMigrationStatements(sql);
      for (const stmt of statements) {
        await query(stmt);
      }
      await query(`INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`, {
        replacements: { name: file },
      });
      executed.push(file);
      logInfo(logger, '[ObeliskUSDT] 迁移执行成功', { file, dialect });
    } catch (error: any) {
      if (!isIgnorableIdempotentError(error)) {
        if (logger?.error) {
          logger.error('[ObeliskUSDT] 迁移执行失败', { file, dialect, error: error?.message || error });
        }
        throw error;
      }

      await query(`INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`, {
        replacements: { name: file },
      });
      skipped.push(file);
      logWarn(logger, '[ObeliskUSDT] 迁移命中幂等场景，自动跳过', {
        file,
        dialect,
        error: error?.message || error,
      });
    }
  }

  return {
    migrationDir,
    dialect,
    totalFiles: files.length,
    executed,
    skipped,
  };
}
