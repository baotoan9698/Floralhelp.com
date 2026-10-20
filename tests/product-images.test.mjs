import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import sharp from 'sharp';
const base='http://127.0.0.1:3000';
test('Product images: limits, tenant isolation, square catalog and processing thumbnails', {timeout:120000},async()=>{
 const db=new PrismaClient(), shops=[], images=[];
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 let owner;
 try {
  const contexts=[];
  for(let i=0;i<2;i++){
   const shop=await db.shop.create({data:{name:'Image test',email:`images-${Date.now()}-${i}@example.invalid`,passwordHash:'unused',accessStatus:'active'}});shops.push(shop);
   const token=randomBytes(32).toString('hex');
   await db.session.create({data:{id:createHash('sha256').update(token).digest('hex'),shopId:shop.id,expiresAt:new Date(Date.now()+600000)}});
   const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addCookies([{name:'floralhelp_session',value:token,url:base}]);contexts.push(ctx);
  }
  owner=contexts[0];const other=contexts[1];
  const product=await db.product.create({data:{shopId:shops[0].id,name:'Hoa ảnh thử nghiệm',price:250000}});
  const buffer=await sharp(randomBytes(1200*800*3),{raw:{width:1200,height:800,channels:3}}).jpeg({quality:95}).toBuffer();
  const upload=(ctx,buf=buffer)=>ctx.request.post(`${base}/api/products/${product.id}/images`,{headers:{Origin:base},multipart:{image:{name:'flower.png',mimeType:'image/png',buffer:buf}}});
  assert.equal((await upload(other)).status(),404);
  assert.equal((await upload(owner,Buffer.from('not an image'))).status(),400);
  for(let i=0;i<3;i++){const res=await upload(owner);assert.equal(res.status(),201,await res.text());images.push((await res.json()).id);}
  assert.equal((await upload(owner)).status(),409);
  assert.equal((await other.request.get(`${base}/api/images/${images[0]}`)).status(),404);
  assert.equal((await other.request.delete(`${base}/api/images/${images[0]}`,{headers:{Origin:base}})).status(),404);
  const res=await owner.request.get(`${base}/api/images/${images[0]}`);assert.equal(res.status(),200);assert.match(res.headers()['content-type'],/image\/webp/);
  assert.equal((await owner.request.get(`${base}/api/images/${images[0]}`,{headers:{"If-None-Match":res.headers().etag}})).status(),304);
  assert.equal((await other.request.get(`${base}/api/images/${images[0]}`,{headers:{"If-None-Match":res.headers().etag}})).status(),404);
  const stored=await res.body();assert.ok(stored.length<300000);const metadata=await sharp(stored).metadata();assert.ok(Math.abs(metadata.width/metadata.height-1.5)<0.01);
  const customer=await db.customer.create({data:{shopId:shops[0].id,code:'KH1',name:'Test',phone:'0000000000',address:'',identityKey:'test'}});
  const testOrder=await db.order.create({data:{customerId:customer.id,shopId:shops[0].id,code:'DH-IMG',productId:product.id,product:product.name,customer:'Khách mẫu',phone:'0000000000',address:'',date:'2026-10-16',time:'09:00',orderDate:'2026-10-16',orderTime:'08:00',price:250000,status:'pending'}});
  const page=await owner.newPage();mkdirSync('artifacts',{recursive:true});
  await page.goto(base+'/orders/'+testOrder.id);
  await page.locator('.order-item-search input[role=combobox]').first().fill('');
  await page.locator('.order-item-search input[role=combobox]').first().fill('Hoa ảnh thử nghiệm');
  await expect(page.locator('.quick-add-suggestion')).toBeVisible();
  assert.equal(await page.locator('.product-suggestions-floating').evaluate(el=>el.parentElement===document.body),true);
  await page.locator('.order-item-search input[role=combobox]').first().fill('Quick flower photo');
  await page.locator('.order-photo-upload input').setInputFiles({name:'flower.jpg',mimeType:'image/jpeg',buffer});
  await expect(page.locator('.order-item-photo img')).toBeVisible();
  assert.equal(await db.product.count({where:{shopId:shops[0].id,name:'Quick flower photo'}}),0);
  await page.locator('.order-photo-actions .product-image-trigger').click();await expect(page.locator('.product-image-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.product-image-dialog')).toHaveCount(0);
  await page.locator('.order-item-photo').hover();
  await page.getByRole('button',{name:'Xóa ảnh Quick flower photo',exact:true}).click();
  await expect(page.locator('.order-item-photo img')).toHaveCount(0);
  assert.equal(await db.productImage.count({where:{shopId:shops[0].id}}),3);
  await page.locator('.order-photo-upload input').setInputFiles({name:'flower.jpg',mimeType:'image/jpeg',buffer});
  await expect(page.locator('.order-item-photo img')).toBeVisible();
  let uploads=0, uploadedBytes=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/images')){uploads++;uploadedBytes=request.postDataBuffer()?.length || 0;}});
  await page.getByRole('button',{name:'Lưu đơn hàng',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Đã lưu thay đổi'})).toContainText('Đã lưu thay đổi');
  assert.equal(uploads,1); 
  const quickProduct=await db.product.findFirstOrThrow({where:{shopId:shops[0].id,name:'Quick flower photo'},include:{images:true}});
  assert.equal(quickProduct.images.length,1);images.push(quickProduct.images[0].id);
  await page.getByRole('button',{name:'Lưu đơn hàng',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Đã lưu thay đổi'})).toContainText('Đã lưu thay đổi');assert.equal(uploads,1);

  await page.goto(base+'/products');
  const quickCard=page.locator('.product-card').filter({has:page.getByRole('heading',{name:'Quick flower photo',exact:true})});
  const beforeUploads=uploads;
  await quickCard.getByRole('button',{name:'Quick flower photo',exact:true}).click();
  await page.locator('dialog .product-photo-add input').setInputFiles({name:'flower.jpg',mimeType:'image/jpeg',buffer});
  await expect(page.locator('dialog[open]')).toBeVisible();assert.equal(uploads,beforeUploads);
  await page.getByRole('button',{name:'Lưu sản phẩm',exact:true}).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);assert.equal(uploads,beforeUploads+1);
  const extra=await db.productImage.findMany({where:{productId:quickProduct.id}});extra.forEach(image=>{if(!images.includes(image.id))images.push(image.id);});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.goto(base+'/products');
   await expect(page.locator('.product-images img')).toHaveCount(5);
   await page.goto(base+'/processing');await page.getByRole('button',{name:'Tất cả',exact:true}).click();
   await expect(page.locator('.processing-product-image img')).toBeVisible();
   await page.locator('.processing-product-image img').click();await expect(page.locator('.product-image-dialog')).toBeVisible();await page.getByRole('button',{name:'Đóng ảnh',exact:true}).click();await expect(page.locator('.product-image-dialog')).toHaveCount(0);
   await page.locator('.processing-product-image img').click();await expect(page.locator('.product-image-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.product-image-dialog')).toHaveCount(0);
   for(const route of ['products','processing']){
    if(route==='products') await page.goto(base+'/products');
    else {await page.goto(base+'/processing');await page.getByRole('button',{name:'Tất cả',exact:true}).click();}
    const img=page.locator(route==='products'?'.product-images img':'.processing-product-image img').first();
    await expect(img).toBeVisible();await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
    const box=await img.boundingBox();assert.ok(Math.abs(box.width-box.height)<1,JSON.stringify(box));
    await page.screenshot({path:`artifacts/product-images-${route}-${width}.png`,fullPage:true});
   }
  }
 } finally {
  if(owner)for(const id of images)await owner.request.delete(`${base}/api/images/${id}`,{headers:{Origin:base}});
  await browser.close();for(const shop of shops)await db.shop.delete({where:{id:shop.id}});await db.$disconnect();
 }
});




