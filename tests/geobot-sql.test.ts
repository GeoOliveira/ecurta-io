import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real PostgreSQL in memory; never connects to Supabase or production.
let db: PGlite;
const dir = resolve(process.cwd(), "supabase/migrations");
const migration = "202608270001_geobot_integration.sql";
let existingDefinitions: unknown[];
async function definitions() {
  return (
    await db.query(
      "select proname, pg_get_functiondef(oid) as definition from pg_proc where proname in ('create_internal_whatsapp_short_link','update_internal_link_slug','check_and_record_integration_rate_limit_v2') order by proname",
    )
  ).rows;
}
async function create(
  source: "geobot" | "alcance_ia",
  requestId: string,
  slug: string,
  hash = "a".repeat(64),
) {
  const fn =
    source === "geobot"
      ? "create_geobot_whatsapp_short_link"
      : "create_internal_whatsapp_short_link";
  return (
    await db.query<{ result: string; link_id: string; slug: string }>(
      `select * from ${fn}($1,$2,$3,'https://wa.me/5571999999999',null,null,null,'{}')`,
      [requestId, hash, slug],
    )
  ).rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);",
  );
  for (const file of readdirSync(dir)
    .filter((file) => file.endsWith(".sql") && file < migration)
    .sort()) {
    await db.exec(readFileSync(resolve(dir, file), "utf8"));
  }
  existingDefinitions = await definitions();
  await db.exec(readFileSync(resolve(dir, migration), "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("Geobot PostgreSQL migration", () => {
  it("does not modify any existing Alcance RPC or enable either client", async () => {
    expect(await definitions()).toEqual(existingDefinitions);
    const result = await db.query(
      "select value from app_settings where key in ('integrations.geobot.enabled','integrations.geobot.creation_enabled','integrations.alcance_ia.enabled')",
    );
    expect(result.rows).toEqual([
      { value: false },
      { value: false },
      { value: false },
    ]);
  });
  it("isolates idempotency across integrations and rejects changed payloads", async () => {
    const geobot = await create("geobot", "request_same_123", "Geo1");
    const alcance = await create("alcance_ia", "request_same_123", "Alc1");
    expect(geobot.result).toBe("created");
    expect(alcance.result).toBe("created");
    expect(geobot.link_id).not.toBe(alcance.link_id);
    const replay = await create("geobot", "request_same_123", "Geo2");
    expect(replay.result).toBe("replay");
    expect(replay.link_id).toBe(geobot.link_id);
    expect(
      (await create("geobot", "request_same_123", "Geo3", "b".repeat(64)))
        .result,
    ).toBe("conflict");
    expect(
      (
        await db.query(
          "select integration_source, count(*)::int as count from short_links group by integration_source order by integration_source",
        )
      ).rows,
    ).toEqual([
      { integration_source: "alcance_ia", count: 1 },
      { integration_source: "geobot", count: 1 },
    ]);
  });
  it("blocks slug changes across tenants in both directions", async () => {
    const geo = await create("geobot", "request_owner_geo", "GeoOwn");
    const alc = await create("alcance_ia", "request_owner_alc", "AlcOwn");
    for (const [fn, id] of [
      ["update_geobot_link_slug", alc.link_id],
      ["update_internal_link_slug", geo.link_id],
    ]) {
      expect(
        (
          await db.query<{ result: string }>(
            `select * from ${fn}($1,'Blocked','request_patch_123')`,
            [id],
          )
        ).rows[0].result,
      ).toBe("denied");
    }
    expect(
      (
        await db.query<{ result: string }>(
          "select * from update_geobot_link_slug($1,'GeoNew','request_patch_ok')",
          [geo.link_id],
        )
      ).rows[0].result,
    ).toBe("updated");
  });
  it("keeps rate limits independent while honoring Geobot's limit", async () => {
    const sql =
      "select * from check_and_record_geobot_rate_limit('geobot','/test','POST',$1,1,2,3)";
    expect(
      (await db.query<{ allowed: boolean }>(sql, ["rate_geobot_1"])).rows[0]
        .allowed,
    ).toBe(true);
    expect(
      (await db.query<{ allowed: boolean }>(sql, ["rate_geobot_2"])).rows[0]
        .allowed,
    ).toBe(false);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select * from check_and_record_integration_rate_limit_v2('alcance_ia','/test','POST','rate_alcance_1',1,2,3)",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("only grants RPC execution to service_role", async () => {
    for (const fn of [
      "create_geobot_whatsapp_short_link(text,text,text,text,timestamptz,text,text,jsonb)",
      "update_geobot_link_slug(uuid,text,text)",
      "check_and_record_geobot_rate_limit(text,text,text,text,int,int,int)",
    ]) {
      const result = await db.query(
        "select has_function_privilege('anon',$1,'EXECUTE') as anon, has_function_privilege('authenticated',$1,'EXECUTE') as authenticated, has_function_privilege('service_role',$1,'EXECUTE') as service",
        [fn],
      );
      expect(result.rows[0]).toEqual({
        anon: false,
        authenticated: false,
        service: true,
      });
    }
  });
  it("records the correct source in requests and audit events", async () => {
    const result = await db.query(
      "select r.integration_source from integration_requests r join short_links l on l.id=r.short_link_id where r.integration_source <> l.integration_source",
    );
    expect(result.rows).toEqual([]);
    expect(
      (
        await db.query(
          "select count(*)::int as n from audit_logs where after_data->>'integration_source'='geobot'",
        )
      ).rows[0],
    ).toEqual({ n: 3 });
  });
});
