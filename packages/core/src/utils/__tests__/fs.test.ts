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
  await writeFile(path.join(root, 'sub', 'photo.png'), 'png-bytes');

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

  describe('glob include / exclude', () => {
    it('excludes files matching an extension glob', async () => {
      const files = await scanDirectory(root, { exclude: ['**/*.css'] });
      expect(files.some((f) => f.endsWith('.css'))).toBe(false);
      expect(names(files)).toContain(path.join('sub', 'nested.js'));
    });

    it('excludes a whole directory by glob', async () => {
      const files = await scanDirectory(root, { exclude: ['sub/**'] });
      expect(files.some((f) => f.includes(`${path.sep}sub${path.sep}`))).toBe(false);
      expect(names(files)).toContain('top.css');
    });

    it('keeps only files matching include', async () => {
      const files = await scanDirectory(root, { include: ['**/*.css'] });
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith('.css'))).toBe(true);
    });

    it('applies exclude after include', async () => {
      const files = await scanDirectory(root, {
        include: ['**/*.css'],
        exclude: ['optimized/**'],
      });
      expect(names(files)).toEqual(['top.css']);
    });

    it('matches patterns relative to the scan root', async () => {
      // 'photo.png' exists only at sub/photo.png: a root-level pattern
      // without '**' must not match it.
      const files = await scanDirectory(root, { exclude: ['photo.png'] });
      expect(names(files)).toContain(path.join('sub', 'photo.png'));
      const filtered = await scanDirectory(root, { exclude: ['sub/photo.png'] });
      expect(names(filtered)).not.toContain(path.join('sub', 'photo.png'));
    });

    it('empty glob arrays disable filtering', async () => {
      const all = await scanDirectory(root);
      const same = await scanDirectory(root, { include: [], exclude: [] });
      expect(names(same)).toEqual(names(all));
    });
  });
});
