import { InstagramConnection } from '../../../src/contexts/connection/domain/entities/instagram-connection.entity';
import { ConnectionEstablishedEvent } from '../../../src/contexts/connection/domain/events/connection-established.event';

describe('InstagramConnection entity', () => {
  function establish() {
    return InstagramConnection.establish('owner-1', 'ig-9', 'anamaria', 'enc-token', null);
  }

  it('starts connected and emits ConnectionEstablishedEvent', () => {
    const conn = establish();
    expect(conn.status.value).toBe('connected');
    expect(conn.status.isConnected).toBe(true);
    const events = conn.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ConnectionEstablishedEvent);
  });

  it('markExpired moves the status to expired', () => {
    const conn = establish();
    conn.markExpired();
    expect(conn.status.value).toBe('expired');
    expect(conn.status.isConnected).toBe(false);
  });

  it('reconnect refreshes token/identity and returns to connected', () => {
    const conn = establish();
    conn.markExpired();
    conn.reconnect('ig-10', 'newhandle', 'enc-token-2', new Date('2030-01-01'));
    expect(conn.status.value).toBe('connected');
    expect(conn.igUserId).toBe('ig-10');
    expect(conn.username).toBe('newhandle');
    expect(conn.accessTokenEncrypted).toBe('enc-token-2');
  });

  it('never exposes a plaintext token (only the encrypted blob)', () => {
    const conn = establish();
    expect(conn.accessTokenEncrypted).toBe('enc-token');
    expect(Object.keys(conn)).not.toContain('accessToken');
  });
});
