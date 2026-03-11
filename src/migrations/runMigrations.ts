/**
 * ObeliskUSDT 数据库迁移执行器
 *
 * @author Telegram @Mhuai8
 */

import fs from 'fs';
import path from 'path';
import type { Sequelize } from 'sequelize';

export interface RunMigrationsOptions {
  sequelize: Sequelize;
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
  totalFiles: number;
  executed: string[];
  skipped: string[];
}

function getDefaultMigrationDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function logInfo(logger: RunMigrationsOptions['logger'], message: string, payload?: unknown): void {
  if (logger?.info) logger.info(message, payload);
}

function logWarn(logger: RunMigrationsOptions['logger'], message: string, payload?: unknown): void {
  if (logger?.warn) logger.warn(message, payload);
}

function isIgnorableIdempotentError(error: any): boolean {
  const code = String(error?.original?.code || error?.code || '');
  const errno = Number(error?.original?.errno || error?.errno || 0);
  const message = String(error?.original?.sqlMessage || error?.message || '').toLowerCase();
  if (code === 'ER_DUP_KEYNAME' || errno === 1061) return true;
  if (code === 'ER_TABLE_EXISTS_ERROR' || errno === 1050) return true;
  if (code === 'ER_DUP_FIELDNAME' || errno === 1060) return true;
  if (message.includes('duplicate key name')) return true;
  return false;
}

async function ensureMigrationTable(sequelize: Sequelize, tableName: string): Promise<void> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  );
}

async function getExecutedMigrations(sequelize: Sequelize, tableName: string): Promise<Set<string>> {
  const [rows] = await sequelize.query(`SELECT migration_name FROM ${tableName}`);
  const set = new Set<string>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const name = String(row.migration_name || '').trim();
    if (name) set.add(name);
  }
  return set;
}

export async function runObeliskUSDTMigrations(options: RunMigrationsOptions): Promise<RunMigrationsResult> {
  const sequelize = options.sequelize;
  const migrationDir = options.migrationDir || getDefaultMigrationDir();
  const migrationTableName = options.migrationTableName || 'obl_usdt_schema_migrations';
  const logger = options.logger;

  if (!fs.existsSync(migrationDir)) {
    throw new Error(`迁移目录不存在: ${migrationDir}`);
  }

  await ensureMigrationTable(sequelize, migrationTableName);
  const executedSet = await getExecutedMigrations(sequelize, migrationTableName);

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
      await sequelize.query(
        `INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`,
        { replacements: { name: file } },
      );
      continue;
    }

    try {
      await sequelize.query(sql);
      await sequelize.query(
        `INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`,
        { replacements: { name: file } },
      );
      executed.push(file);
      logInfo(logger, '[ObeliskUSDT] 迁移执行成功', { file });
    } catch (error: any) {
      if (!isIgnorableIdempotentError(error)) {
        if (logger?.error) {
          logger.error('[ObeliskUSDT] 迁移执行失败', { file, error: error?.message || error });
        }
        throw error;
      }

      await sequelize.query(
        `INSERT INTO ${migrationTableName} (migration_name) VALUES (:name)`,
        { replacements: { name: file } },
      );
      skipped.push(file);
      logWarn(logger, '[ObeliskUSDT] 迁移命中幂等场景，自动跳过', {
        file,
        error: error?.message || error,
      });
    }
  }

  return {
    migrationDir,
    totalFiles: files.length,
    executed,
    skipped,
  };
}
