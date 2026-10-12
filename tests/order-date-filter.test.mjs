import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';

test('Order date range includes boundaries, ignores delivery date, resets page and selection on desktop/mobile', {timeout:120000}, async()=>{
  const db=new PrismaClient();
  const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
  let shop, otherShop;
  try {
    shop=await db.shop.create({data:{name:'Date filter test',email:`date-filter-${Date.now()}@example.com`,passwordHash:'unused',accessStatus:'active'}});
    const customer=await db.customer.create({data:{shopId:shop.id,code:'KH1',name:'Test',phone:'0000000000',address:'',identityKey:'test'}});
    otherShop=await db.shop.create({data:{name:'Other test shop',email:`other-status-${Date.now()}@example.com`,passwordHash:'unused',accessStatus:'active'}});
    const otherCustomer=await db.customer.create({data:{shopId:otherShop.id,code:'KH1',name:'Other',phone:'0000000000',address:'',identityKey:'test'}});
    const otherOrder=await db.order.create({data:{shopId:otherShop.id,customerId:otherCustomer.id,code:'OTHER',product:'Other flower',customer:'Other',phone:'0000000000',address:'',date:'2026-12-31',time:'09:00',orderDate:'2026-10-01',price:200000}});
    await db.order.createMany({data:Array.from({length:12},(_,i)=>({shopId:shop.id,customerId:customer.id,code:`DH${String(i).padStart(3,'0')}`,product:'Test flower',customer:'Test',phone:'0000000000',address:'',date:'2026-12-31',time:'09:00',orderDate:['2026-10-01','2026-10-05','2026-10-10'][Math.floor(i/4)],orderTime:'12:00',price:100000}))});
    const context=await browser.newContext();
    const token=randomBytes(32).toString('hex');
    await db.session.create({data:{id:createHash('sha256').update(token).digest('hex'),shopId:shop.id,expiresAt:new Date(Date.now()+600000)}});
    await context.addCookies([{name:'floralhelp_session',value:token,url:'http://127.0.0.1:3000'}]);
    const page=await context.newPage();
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      await page.goto('http://127.0.0.1:3000/orders');
      const list=page.locator(width>760?'.orders-table':'.mobile-orders');
      const rows=list.getByRole('checkbox',{name:/^Chọn đơn /});
      const nav=page.getByRole('navigation',{name:'Phân trang danh sách đơn hàng'});
      const range=page.getByRole('form',{name:'Lọc theo ngày tạo đơn'});
      await nav.getByRole('button',{name:'Sau',exact:true}).click();
      await expect(rows).toHaveCount(2);
      await rows.first().check();
      await range.getByLabel('Ngày bắt đầu',{exact:true}).fill('2026-10-05');
      await expect(rows).toHaveCount(2);
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(nav).toContainText('Trang 1/1');
      await expect(rows).toHaveCount(8);
      await expect(page.locator('.order-selection-toolbar')).toContainText('Đã chọn 0 đơn');
      await range.getByLabel('Ngày kết thúc',{exact:true}).fill('2026-10-05');
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(rows).toHaveCount(4);
      await page.getByLabel('Tìm đơn hàng').fill('DH004');
      await expect(rows).toHaveCount(1);
      await page.getByLabel('Tìm đơn hàng').fill('');
      await range.getByLabel('Ngày bắt đầu',{exact:true}).fill('');
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(rows).toHaveCount(8);
      await range.getByLabel('Ngày kết thúc',{exact:true}).fill('2026-09-01');
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(page.getByRole('heading',{name:'Chưa có đơn phù hợp'})).toBeVisible();
      await range.getByLabel('Ngày kết thúc',{exact:true}).fill('');
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(rows).toHaveCount(10);
      await range.getByLabel('Ngày bắt đầu',{exact:true}).fill('2026-10-10');
      await range.getByRole('button',{name:'Áp dụng'}).click();
      await expect(rows).toHaveCount(4);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await expect(page.locator('footer')).toHaveText('Powered by Floral Help');
      const target = await db.order.findFirstOrThrow({where:{shopId:shop.id,code:'DH008'}});
      const status = list.getByLabel('Trạng thái đơn DH008');
      const nextStatus = width === 1440 ? 'preparing' : 'done';
      await status.selectOption(nextStatus);
      await expect(status).toBeEnabled();
      await expect(status).toHaveValue(nextStatus);
      await expect(page).toHaveURL(/\/orders$/);
      const saved = await db.order.findUniqueOrThrow({where:{id:target.id}});
      assert.equal(saved.status,nextStatus);
      assert.equal(saved.price,target.price);
      assert.equal(saved.orderDate,target.orderDate);
      const history = await db.orderHistory.findFirstOrThrow({where:{orderId:target.id},orderBy:{createdAt:'desc'}});
      assert.equal(history.actorId,shop.id);
      assert.equal(JSON.parse(history.changes)[0].field,'Trạng thái');
      await page.reload();
      await expect(list.getByLabel('Trạng thái đơn DH008')).toHaveValue(nextStatus);
      if(width===1440) {
        const tamper=async route=>{
          const request=route.request();
          if(request.method()==='POST' && request.headers()['next-action']) {
            const args=JSON.parse(request.postData());
            assert.equal(args[0],target.id);
            args[0]=otherOrder.id;
            await route.continue({postData:JSON.stringify(args)});
          } else await route.continue();
        };
        await page.route('**/orders',tamper);
        await list.getByLabel('Trạng thái đơn DH008').selectOption('done');
        await expect(list.getByRole('alert')).toContainText('Không tìm thấy đơn hàng');
        await expect(list.getByLabel('Trạng thái đơn DH008')).toHaveValue(nextStatus);
        assert.equal((await db.order.findUniqueOrThrow({where:{id:otherOrder.id}})).status,'pending');
        assert.equal(await db.orderHistory.count({where:{orderId:otherOrder.id}}),0);
        await page.unroute('**/orders',tamper);
        await page.reload();
      }
      mkdirSync('artifacts',{recursive:true});
      await page.screenshot({path:`artifacts/order-date-filter-${width}.png`,fullPage:true});
    }
  } finally {
    await browser.close();
    if(shop) await db.shop.delete({where:{id:shop.id}});
    if(otherShop) await db.shop.delete({where:{id:otherShop.id}});
    await db.$disconnect();
  }
});
