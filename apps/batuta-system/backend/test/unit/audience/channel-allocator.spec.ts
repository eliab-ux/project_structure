import {
  ChannelAllocator,
  ChannelLoad,
} from '../../../src/contexts/audience/domain/services/channel-allocator';

function load(id: string, allocated: number, createdAt = '2026-01-01'): ChannelLoad {
  return { channelId: id, allocatedContacts: allocated, createdAt: new Date(createdAt) };
}

/**
 * §6.2 — the single allocation rule. The spec claims one greedy rule with a deterministic tie-break
 * covers both operational cases with no extra machinery; these tests are that claim, checked.
 */
describe('ChannelAllocator', () => {
  it('picks the least loaded channel', () => {
    const allocator = new ChannelAllocator([load('a', 100), load('b', 40), load('c', 70)]);

    expect(allocator.allocateOne().channelId).toBe('b');
  });

  it('books the load, so a batch spreads instead of dumping on one channel', () => {
    const allocator = new ChannelAllocator([load('a', 0), load('b', 0), load('c', 0)]);

    const picks = allocator.allocateMany(6).map((allocation) => allocation.channelId);

    expect(picks).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  describe('tie-break', () => {
    it('equal load → older channel wins', () => {
      const allocator = new ChannelAllocator([
        load('newer', 10, '2026-06-01'),
        load('older', 10, '2026-01-01'),
      ]);

      expect(allocator.allocateOne().channelId).toBe('older');
    });

    it('equal load and equal age → lowest id wins, so the result never depends on row order', () => {
      const allocator = new ChannelAllocator([load('zzz', 5), load('aaa', 5)]);
      const other = new ChannelAllocator([load('aaa', 5), load('zzz', 5)]);

      expect(allocator.allocateOne().channelId).toBe('aaa');
      expect(other.allocateOne().channelId).toBe('aaa');
    });
  });

  describe('the case §6.2 highlights: a new channel among loaded ones', () => {
    it('a channel with 0 takes EVERY new contact until it draws level, then the split resumes', () => {
      // One new chip at 0, two veterans at 3. No catch-up mode, no parity maths, no flag.
      const allocator = new ChannelAllocator([
        load('new', 0, '2026-06-01'),
        load('old-1', 3, '2026-01-01'),
        load('old-2', 3, '2026-01-02'),
      ]);

      const picks = allocator.allocateMany(6).map((allocation) => allocation.channelId);

      // First three all go to the new chip (0→1→2→3), then it is level and the rotation begins.
      expect(picks.slice(0, 3)).toEqual(['new', 'new', 'new']);
      expect(picks.slice(3)).toEqual(['old-1', 'old-2', 'new']);
    });

    it('ends with the loads evened out', () => {
      const allocator = new ChannelAllocator([load('new', 0), load('old', 10)]);

      allocator.allocateMany(10);

      const final = allocator.snapshot();
      expect(final.find((l) => l.channelId === 'new')?.allocatedContacts).toBe(10);
      expect(final.find((l) => l.channelId === 'old')?.allocatedContacts).toBe(10);
    });
  });

  it('does not mutate the caller array', () => {
    const original = [load('a', 5)];
    const allocator = new ChannelAllocator(original);

    allocator.allocateOne();

    expect(original[0].allocatedContacts).toBe(5);
  });

  describe('no eligible channel', () => {
    it('reports it instead of guessing', () => {
      const allocator = new ChannelAllocator([]);

      expect(allocator.hasEligibleChannel).toBe(false);
    });

    it('refuses to allocate — the import must fail with a clear message (§6.2)', () => {
      const allocator = new ChannelAllocator([]);

      expect(() => allocator.allocateOne()).toThrow(/Nenhum canal elegível/);
    });
  });

  it('snapshot reflects everything booked so far — this is what the migration preview shows', () => {
    const allocator = new ChannelAllocator([load('a', 0), load('b', 0)]);

    allocator.allocateMany(3);

    expect(allocator.snapshot()).toEqual([
      expect.objectContaining({ channelId: 'a', allocatedContacts: 2 }),
      expect.objectContaining({ channelId: 'b', allocatedContacts: 1 }),
    ]);
  });
});
