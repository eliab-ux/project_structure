import { Handle } from '../../../src/contexts/watchlist/domain/value-objects/handle.vo';
import { InvalidHandleException } from '../../../src/contexts/watchlist/domain/exceptions/invalid-handle.exception';

describe('Handle VO', () => {
  it('strips a leading @, trims and lowercases', () => {
    expect(Handle.create('@AnaMaria').value).toBe('anamaria');
    expect(Handle.create('  JosePereira  ').value).toBe('josepereira');
  });

  it('accepts dots and underscores', () => {
    expect(Handle.create('ana.maria_01').value).toBe('ana.maria_01');
  });

  it('rejects invalid characters', () => {
    expect(() => Handle.create('ana maria')).toThrow(InvalidHandleException);
    expect(() => Handle.create('joão!')).toThrow(InvalidHandleException);
    expect(() => Handle.create('')).toThrow(InvalidHandleException);
  });

  it('rejects handles longer than 30 chars', () => {
    expect(() => Handle.create('a'.repeat(31))).toThrow(InvalidHandleException);
  });
});
