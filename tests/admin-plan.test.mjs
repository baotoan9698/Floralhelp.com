import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readdirSync,readFileSync} from 'node:fs';
test('All PostgreSQL migrations and trial plan default',async()=>{const db=new PGlite();try{for(const name of readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await db.exec(readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));await db.query('INSERT INTO "Shop" (id,name,email,"passwordHash") VALUES ($1,$2,$3,$4)',['test','Test','test@example.invalid','unused']);const {rows}=await db.query('SELECT plan FROM "Shop" WHERE id=$1',['test']);assert.equal(rows[0].plan,'trial');}finally{await db.close();}});
