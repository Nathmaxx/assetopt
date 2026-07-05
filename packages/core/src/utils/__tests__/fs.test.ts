import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanDirectory } from '../fs.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'assetopt-fs-'));

  await writeFile(path.join(root, 'top.css'), '.a { color: red; }');
  await writeFile(path.join(root, 'notes.txt'), 'not an asset');

  await mkdir(path.join(root, 'sub'), { recursive: true });
  await writeFile(path.join(root, 'sub', 'nested.js'), 'const x = 1;');

  await mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(path.join(root, 'node_modules', 'pkg', 'vendor.css'), '.v {}');

  await mkdir(path.join(root, '.hidden'), { recursive: true });
  await writeFile(path.join(root, '.hidden', 'secret.css'), '.s {}');

  await mkdir(path.join(root, 'optimized'), { recursive: true });
  await writeFile(path.join(root, 'optimized', 'top.css'), '.a{color:red}');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function names(files: string[]): string[] {
  return files.map((f) => path.relative(root, f)).sort();
}

describe('scanDirectory', () => {
  it('lists supported assets recursively and ignores unsupported extensions', async () => {
    const files = await scanDirectory(root);
    expect(names(files)).toContain('top.css');
    expect(names(files)).toContain(path.join('sub', 'nested.js'));
    expect(names(files)).not.toContain('notes.txt');
  });

  it('always skips node_modules', async () => {
    const files = await scanDirectory(root);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('always skips dot-directories', async () => {
    const files = await scanDirectory(root);
    expect(files.some((f) => f.includes('.hidden'))).toBe(false);
  });

  it('skips directories listed in excludePaths', async () => {
    const files = await scanDirectory(root, { excludePaths: [path.join(root, 'optimized')] });
    expect(files.some((f) => f.includes('optimized'))).toBe(false);
    expect(names(files)).toContain('top.css');
  });

  it('scans excluded-by-default content when no exclusion matches it', async () => {
    // Without excludePaths, 'optimized' is a regular directory and is scanned.
    const files = await scanDirectory(root);
    expect(files.some((f) => f.includes('optimized'))).toBe(true);
  });

  it('does not recurse with recursive: false', async () => {
    const files = await scanDirectory(root, { recursive: false });
    expect(names(files)).toEqual(['top.css']);
  });

  it('scans a dot-directory when it is the scan root itself', async () => {
    const files = await scanDirectory(path.join(root, '.hidden'));
    expect(files.map((f) => path.basename(f))).toEqual(['secret.css']);
  });
});
