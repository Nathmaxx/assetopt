import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCliError } from '../error.js';

describe('handleCliError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints an Error message and exits with code 1', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    handleCliError(new Error('boom'));

    expect(err).toHaveBeenCalledWith('Error: boom');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('stringifies non-Error values', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    handleCliError('plain string');
    expect(err).toHaveBeenCalledWith('Error: plain string');

    handleCliError(42);
    expect(err).toHaveBeenCalledWith('Error: 42');

    expect(exit).toHaveBeenCalledTimes(2);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
