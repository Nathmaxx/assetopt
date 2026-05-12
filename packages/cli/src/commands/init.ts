import { writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import { DEFAULTS } from '@assetopt/core';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Generate a default .assetoptrc configuration file')
    .option('--force', 'overwrite existing config file')
    .action(async (options: { force?: boolean }) => {
      const configPath = resolve(process.cwd(), '.assetoptrc');

      if (!options.force) {
        try {
          await access(configPath);
          console.error('Error: .assetoptrc already exists. Use --force to overwrite.');
          process.exit(1);
        } catch {
          // file doesn't exist, proceed
        }
      }

      await writeFile(configPath, JSON.stringify(DEFAULTS, null, 2) + '\n');
      console.log('Created .assetoptrc');
    });
}
