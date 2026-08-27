import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePublicUrl } from '../src/lib/short-links/public-url.mjs';
import { resolveShortLink } from '../src/lib/short-links/resolve';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../src/lib/supabase/server', () => ({ getServiceClient: () => mocks }));
const record = { id: 'test-id', slug: 'AbCd', status: 'active', expires_at: null, destination_type: 'url', integration_source: 'geobot', destination_url: 'https://example.com/path?a=1&a=2#section' };
beforeEach(() => { mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: [record], error: null }); });
describe('public URL policy and resolver', () => {
  it.each(['https://example.com/path?a=1&a=2#section', 'http://example.org', 'https://münich.de/ação?q=olá', 'https://8.8.8.8', 'https://[2606:4700:4700::1111]'])( 'accepts %s', raw => {
    expect(normalizePublicUrl(raw)).toBe(new URL(raw).toString());
  });
  it.each(['javascript:alert(1)', 'file:///tmp/a', 'data:text/html,x', 'https://user:pass@example.com', 'https://localhost', 'http://127.1', 'http://0x7f000001', 'http://10.1.1.1', 'http://172.16.0.1', 'http://192.168.1.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'https://www.encurta.io./ABCD', 'https://example.com/\nfoo', 'https://intranet'])( 'rejects %s', raw => {
    expect(() => normalizePublicUrl(raw)).toThrow();
  });
  it('resolves without fetching the destination or losing query/hash', async () => {
    expect(await resolveShortLink('AbCd')).toEqual({ kind: 'active', id: record.id, slug: record.slug, destinationUrl: record.destination_url });
    expect(mocks.rpc).toHaveBeenCalledWith('resolve_short_link_v2', { p_slug: 'AbCd' });
  });
  it.each([
    [{ destination_type: 'url', integration_source: 'alcance_ia' }, 'error'],
    [{ destination_url: 'javascript:alert(1)' }, 'error'],
    [{ destination_type: 'whatsapp' }, 'error'],
    [{ destination_type: 'other' }, 'error'],
    [{ status: 'blocked' }, 'blocked'], [{ status: 'disabled' }, 'blocked'],
    [{ status: 'deleted' }, 'not-found'], [{ status: 'expired' }, 'expired'],
    [{ expires_at: '2000-01-01T00:00:00Z' }, 'expired'],
  ])('fails closed for %j', async (change, kind) => {
    mocks.rpc.mockResolvedValue({ data: [{ ...record, ...change }], error: null });
    expect(await resolveShortLink('AbCd')).toEqual({ kind });
  });
  it('preserves existing WhatsApp redirects regardless of source', async () => {
    for (const source of ['alcance_ia', 'geobot', null]) {
      mocks.rpc.mockResolvedValue({ data: [{ ...record, integration_source: source, destination_type: 'whatsapp', destination_url: 'https://wa.me/5511999999999?text=Oi' }], error: null });
      expect((await resolveShortLink('AbCd')).kind).toBe('active');
    }
  });
});
