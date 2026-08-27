import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db: PGlite;
let definitions: unknown[];
const dir = resolve(process.cwd(), 'supabase/migrations');
const snapshot = "select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('create_internal_whatsapp_short_link','update_internal_link_slug','check_and_record_integration_rate_limit_v2','resolve_short_link','create_geobot_whatsapp_short_link') order by proname";
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
  for (const file of readdirSync(dir).filter(file => file.endsWith('.sql')).sort()) {
    if (file === '202608270002_geobot_global_urls.sql') {
      definitions = (await db.query(snapshot)).rows;
      await db.exec("insert into short_links(slug,destination_url) values('Old1','https://wa.me/5511999999999')");
    }
    await db.exec(readFileSync(resolve(dir,file),'utf8'));
  }
}, 30000);
afterAll(async () => { await db?.close(); });
async function create(requestId: string, slug: string, url = 'https://example.com/path?a=1&a=2#section', hash = 'b'.repeat(64)) {
  return (await db.query<{result:string;link_id:string;slug:string}>("select * from create_geobot_url_short_link($1,$2,$3,$4,null,null,'global_test','{}')",[requestId,hash,slug,url])).rows[0];
}
it('preserves all existing RPCs and stored WhatsApp links', async () => {
  expect((await db.query(snapshot)).rows).toEqual(definitions);
  const rows = (await db.query("select destination_type,destination_url from resolve_short_link_v2('Old1')")).rows;
  expect(rows).toEqual([{ destination_type:'whatsapp', destination_url:'https://wa.me/5511999999999' }]);
});
it('creates, resolves, replays and detects conflicts for global URLs', async () => {
  const row = await create('global_request_001','Web1');
  expect(row.result).toBe('created');
  expect((await create('global_request_001','Web2')).link_id).toBe(row.link_id);
  expect((await create('global_request_001','Web3','https://example.org/','c'.repeat(64))).result).toBe('conflict');
  expect((await db.query("select destination_url,destination_type,integration_source from resolve_short_link_v2('Web1')")).rows).toEqual([{destination_url:'https://example.com/path?a=1&a=2#section',destination_type:'url',integration_source:'geobot'}]);
  expect((await db.query<{result:string}>("select * from update_internal_link_slug($1,'Nope','owner_request_01')",[row.link_id])).rows[0].result).toBe('denied');
});
it.each(['https://example.org/', 'http://example.com/a?x=1#anchor', 'https://xn--mnich-kva.de/', 'https://8.8.8.8/', 'https://[2606:4700:4700::1111]/'])('accepts public destination %s', async url => {
  expect((await db.query<{valid:boolean}>('select is_public_short_url($1) as valid',[url])).rows[0].valid).toBe(true);
});
it.each(['javascript:alert(1)', 'http://localhost/', 'https://user:pass@example.com/', 'http://127.0.0.1/', 'http://10.1.1.1/', 'http://[::1]/', 'http://169.254.169.254/', 'https://www.encurta.io/AbCd', 'https://intranet/', 'https://example.com/\nfoo'])('rejects invalid SQL destination %s', async url => {
  expect((await db.query<{valid:boolean}>('select is_public_short_url($1) as valid',[url])).rows[0].valid).toBe(false);
  await expect(create('invalid_request_001','Bad1',url)).rejects.toThrow();
});
it('enforces destination type and ownership even for direct table writes', async () => {
  for (const source of ['alcance_ia', null]) {
    await expect(db.query("insert into short_links(slug,destination_url,destination_type,integration_source) values('Bad2','https://example.org/','url',$1)",[source])).rejects.toThrow();
  }
  await expect(db.exec("insert into short_links(slug,destination_url) values('Bad3','https://example.org/')")).rejects.toThrow();
});
it('restricts new create and resolve RPCs to the service role', async () => {
  for (const fn of ['create_geobot_url_short_link(text,text,text,text,timestamptz,text,text,jsonb)', 'resolve_short_link_v2(text)']) {
    expect((await db.query("select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as authenticated,has_function_privilege('service_role',$1,'execute') as service",[fn])).rows).toEqual([{anon:false,authenticated:false,service:true}]);
  }
});
