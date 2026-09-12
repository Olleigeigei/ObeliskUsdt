/**
 * 迁移方言与 sqlite 冒烟测试
 *
 * @author Telegram @okgeceo
 */

import { DataTypes, Sequelize, Utils } from 'sequelize';
import {
  resolveMigrationDialect,
  resolveMigrationDir,
  runObeliskUSDTMigrations,
} from '../src/migrations/runMigrations';

const UUID_V1_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('runObeliskUSDTMigrations', () => {
  let sequelize: Sequelize;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    await sequelize.authenticate();
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('resolveMigrationDialect 识别 sqlite', () => {
    expect(resolveMigrationDialect(sequelize)).toBe('sqlite');
  });

  it('resolveMigrationDir 返回 sqlite 子目录', () => {
    const dir = resolveMigrationDir('sqlite');
    expect(dir.endsWith(`${pathSep()}sqlite`)).toBe(true);
  });

  it('sqlite 迁移可创建 obl_payment_wallets 与迁移记录表', async () => {
    const result = await runObeliskUSDTMigrations({ sequelize });
    expect(result.dialect).toBe('sqlite');
    expect(result.executed.length).toBe(4);

    const [tables] = (await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('obl_payment_wallets', 'obl_usdt_schema_migrations')",
    )) as [Array<{ name: string }>, unknown];

    const names = tables.map((row) => row.name).sort();
    expect(names).toEqual(['obl_payment_wallets', 'obl_usdt_schema_migrations']);
  });

  it('重复执行迁移应跳过已执行文件', async () => {
    const first = await runObeliskUSDTMigrations({ sequelize });
    expect(first.executed.length).toBe(4);

    const second = await runObeliskUSDTMigrations({ sequelize });
    expect(second.executed.length).toBe(0);
    expect(second.skipped.length).toBe(4);
  });
});

describe('Sequelize uuid 11 compatibility', () => {
  it('uses the audited uuid release selected by the root override', () => {
    const uuidPackage = require('uuid/package.json') as { version: string };

    expect(uuidPackage.version).toBe('11.1.1');
  });

  it('generates UUID v1 and v4 default values through Sequelize', () => {
    const uuidV1 = Utils.toDefaultValue(new DataTypes.UUIDV1());
    const uuidV4 = Utils.toDefaultValue(new DataTypes.UUIDV4());

    expect(uuidV1).toMatch(UUID_V1_PATTERN);
    expect(uuidV4).toMatch(UUID_V4_PATTERN);
  });
});

function pathSep(): string {
  return require('path').sep;
}
