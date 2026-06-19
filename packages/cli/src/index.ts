#!/usr/bin/env node
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerAnalyze } from './commands/analyze.js';
import { registerOptimize } from './commands/optimize.js';
import { registerAudit } from './commands/audit.js';

const program = new Command();

program.name('assetopt').description('Static asset optimization tool').version('1.0.0');

registerInit(program);
registerAnalyze(program);
registerOptimize(program);
registerAudit(program);

program.parse();
