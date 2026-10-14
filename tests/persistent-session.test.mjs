import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {randomBytes,createHash} from 'node:crypto';

test('shop session renews old cookie and still revokes expired, suspended and deleted sessions',async()=>{
 const db=new PrismaClient();let shop;
 try{
 shop=await db.shop.create({data:{name:'Session test',email:`session-${Date.now()}@example.invalid`,passwordHash:'unused',accessStatus:'active'}});
 const token=randomBytes(32).toString('hex'),id=createHash('sha256').update(token).digest('hex');
 const headers={cookie:`floralhelp_session=${token}`};
 const check=()=>fetch('http://127.0.0.1:3000/api/session',{headers});
 const seed=()=>db.session.create({data:{id,shopId:shop.id,expiresAt:new Date(Date.now()-86400000)}});
 await seed();
 let response=await check();assert.equal((await response.json()).active,true);
 assert.match(response.headers.get('set-cookie'),/HttpOnly/i);
 assert.ok((await db.session.findUniqueOrThrow({where:{id}})).expiresAt.getTime()>Date.now()+390*86400000);
 response=await check();assert.equal(response.headers.get('set-cookie'),null);
 await db.shop.update({where:{id:shop.id},data:{accessUntil:new Date(Date.now()-1000)}});
 assert.equal((await (await check()).json()).reason,'expired');
 assert.equal(await db.session.count({where:{shopId:shop.id}}),0);
 await db.shop.update({where:{id:shop.id},data:{accessUntil:null,accessStatus:'suspended'}});await seed();
 assert.equal((await (await check()).json()).reason,'suspended');
 await db.shop.update({where:{id:shop.id},data:{accessStatus:'active'}});
 assert.equal((await (await check()).json()).active,false);
 }finally{if(shop)await db.shop.delete({where:{id:shop.id}});await db.$disconnect();}
});
