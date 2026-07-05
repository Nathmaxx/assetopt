#!/usr/bin/env node
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerAnalyze } from './commands/analyze.js';
import { registerOptimize } from './commands/optimize.js';
import { registerAudit } from './commands/audit.js';
import { registerClean } from './commands/clean.js';
import { findCliVersion } from './utils/version.js';

const program = new Command();

program.name('assetopt').description('Static asset optimization tool').version(findCliVersion());

registerInit(program);
registerAnalyze(program);
registerOptimize(program);
registerAudit(program);
registerClean(program);

program.parse();
