import {test} from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const source=readFileSync('lib/image-http.ts','utf8').replace('import "server-only";','');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;const {sameOrigin}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Origin validation behind nginx does not retain internal port',()=>{
 const request=(origin,host='sale.floralhelp.com',proto='https')=>new Request('http://localhost:3000/api/notifications',{headers:{host,origin,'x-forwarded-proto':proto}});
 assert.equal(sameOrigin(request('https://sale.floralhelp.com')),true);
 assert.equal(sameOrigin(request('https://attacker.example')),false);
 assert.equal(sameOrigin(request('https://sale.floralhelp.com:3000')),false);
 assert.equal(sameOrigin(request('http://localhost:3000','localhost:3000','http')),true);
 assert.equal(sameOrigin(new Request('http://localhost:3000')),false);
});
