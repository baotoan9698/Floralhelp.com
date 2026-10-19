import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpile(readFileSync("lib/image-capacity.ts", "utf8"), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 });
const { acquireImageSlot } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
test("image queue bounds concurrency, wakes FIFO, handles abort and double release", async () => {
 const a = await acquireImageSlot(), b = await acquireImageSlot();
 const abort = new AbortController(); const cancelled = acquireImageSlot(abort.signal); abort.abort(); assert.equal(await cancelled, null);
 let woke = false; const waiting = acquireImageSlot().then(release => { woke = true; return release; });
 await Promise.resolve(); assert.equal(woke, false); a(); const c = await waiting; assert.ok(c); a();
 const controllers = Array.from({length:20},()=>new AbortController()); const pending = controllers.map(c=>acquireImageSlot(c.signal));
 assert.equal(await acquireImageSlot(), null);
 controllers.forEach(c=>c.abort()); assert.ok((await Promise.all(pending)).every(v=>v===null));
 b(); c(); const d=await acquireImageSlot(),e=await acquireImageSlot(); assert.ok(d&&e); d();e();
});
