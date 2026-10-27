import * as migration_20260922_052125_new from './20260922_052125_new';

export const migrations = [
  {
    up: migration_20260922_052125_new.up,
    down: migration_20260922_052125_new.down,
    name: '20260922_052125_new'
  },
];
