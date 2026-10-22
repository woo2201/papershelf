const {chromium}=require('playwright');const crypto=require('node:crypto');const assert=require('node:assert/strict');const fs=require('node:fs');const http=require('node:http');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const user=id=>({id,email:id===A?'owner@example.com':'visitor@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()});
const session=id=>({access_token:['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated'})).toString('base64url'),'mock'].join('.'),refresh_token:'refresh-'+id,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:user(id)});
const entry=(id,title)=>({id,title,date:'2026-10-21',kind:'note',topics:['Test'],body:'## Markdown\n**본문**',url:'',images:[]});
const posts=new Map([['public',{id:'public',owner_id:A,entry:entry('public','공개 글'),status:'published',version:1}],['draft',{id:'draft',owner_id:A,entry:entry('draft','비공개 초안'),status:'draft',version:1}]]);
let settings={owner_id:A,topics:['Test'],version:1},oauthCalls=0,pkceExchanges=0,githubEnabled=false,oauthChallenge='';const photos=new Map();const errors=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
async function mock(context,origin){await context.route('https://shpiczkprbylbhtomynw.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());let uid;try{uid=JSON.parse(Buffer.from((req.headers().authorization||'').split('.')[1],'base64url')).sub}catch{}
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
 if(url.pathname.endsWith('/auth/v1/settings'))return json({external:{github:githubEnabled},mailer_autoconfirm:false});
 if(url.pathname.endsWith('/auth/v1/authorize')){oauthCalls++;assert.equal(url.searchParams.get('provider'),'github');assert.equal(url.searchParams.get('redirect_to'),origin+'/');assert.equal(url.searchParams.get('code_challenge_method'),'s256');oauthChallenge=url.searchParams.get('code_challenge');assert(oauthChallenge);return route.fulfill({status:302,headers:{location:origin+'/?code=github-test-code'}})}
 if(url.pathname.endsWith('/auth/v1/user'))return json(user(uid));
 if(url.pathname.endsWith('/auth/v1/token')){const body=JSON.parse(req.postData());if(url.searchParams.get('grant_type')==='pkce'){pkceExchanges++;assert.equal(body.auth_code,'github-test-code');assert.equal(crypto.createHash('sha256').update(body.code_verifier).digest('base64url'),oauthChallenge);return json(session(A))}return json(session(body.refresh_token.slice(8)))}
 if(url.pathname.endsWith('/auth/v1/logout'))return route.fulfill({status:204});
 if(url.pathname==='/rest/v1/papershelf_blog_settings')return json(uid===A?[settings]:[]);
 if(url.pathname==='/rest/v1/papershelf_posts')return json([...posts.values()].filter(p=>uid===A||p.status==='published'));
 if(url.pathname==='/rest/v1/rpc/papershelf_blog_save'){
   if(uid!==A)return json({code:'42501',message:'forbidden'},403);
   const body=JSON.parse(req.postData());
   if(body.p_topics&&body.p_topics_version!==settings.version)return json({code:'40001',message:'conflict'},409);
   for(const c of body.p_changes)if((posts.get(c.id)?.version||0)!==c.expected_version)return json({code:'40001',message:'conflict'},409);
   for(const c of body.p_changes){if(c.delete)posts.delete(c.id);else posts.set(c.id,{id:c.id,owner_id:A,entry:c.entry,status:c.status,version:c.expected_version+1})}
   if(body.p_topics)settings={...settings,topics:body.p_topics,version:settings.version+1};return json(null);
 }
 if(url.pathname.includes('/storage/v1/object/')){const name=url.pathname.split('papershelf-blog-photos/')[1];if(req.method()==='POST'){if(photos.has(name))return json({statusCode:'409',message:'Duplicate'},409);let bytes=req.postDataBuffer();if(req.headers()['content-type'].startsWith('multipart/')){const form=await new Response(bytes,{headers:{'content-type':req.headers()['content-type']}}).formData();for(const v of form.values())if(typeof v!=='string')bytes=Buffer.from(await v.arrayBuffer())}photos.set(name,bytes);return json({Key:name})}return photos.has(name)?route.fulfill({contentType:'image/png',body:photos.get(name)}):json({message:'missing'},404)}
 return json({message:'Unhandled mock '+url.pathname},500);
 });}
(async()=>{
 const root=process.cwd();const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await mock(context,origin);
 async function pageIn(ctx){const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(origin);await p.waitForFunction(()=>blogState.ready);return p}
 const page=await pageIn(context);
 assert.equal(await page.locator('.entry').count(),1);assert.equal(await page.locator('#add').isVisible(),false);assert.equal(await page.locator('[data-action=edit]').count(),0);
 await page.locator('#account').click();await page.locator('#github-login').click();await page.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('아직 완료되지 않았습니다'));assert.equal(oauthCalls,0);assert.equal(await page.locator('#github-login').isEnabled(),true);
 githubEnabled=true;await page.locator('#github-login').click();await page.waitForFunction(()=>window.blogState?.ready&&window.blogState?.admin);
 assert.equal(oauthCalls,1);assert.equal(pkceExchanges,1);assert.equal(new URL(page.url()).searchParams.get('code'),null);
 assert.equal(await page.locator('.entry').count(),2);assert(await page.locator('#add').isVisible());
 // New posts default to private; uploaded images survive save and preview.
 await page.locator('#add').click();assert.equal(await page.locator('#publish-entry').isChecked(),false);await page.locator('[name=title]').fill('사진 초안');await page.locator('#photo-file').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await page.locator('#form button[type=submit]').click();await page.waitForFunction(()=>!blogState.busy&&!document.querySelector('#editor').open);
 assert.equal(photos.size,1);assert.equal([...posts.values()].find(p=>p.entry.title==='사진 초안').status,'draft');
 const photoRow=page.locator('.entry').filter({hasText:'사진 초안'});await photoRow.locator('summary').click();await page.waitForFunction(()=>document.querySelector('.prose img')?.src.startsWith('blob:'));
 // Two browser contexts share backend, not browser session state.
 const secondContext=await browser.newContext({storageState:await context.storageState()});await mock(secondContext,origin);const second=await pageIn(secondContext);
 for(const p of [page,second]){const row=p.locator('.entry[data-id=public]');await row.locator('summary').click();await row.locator('[data-action=edit]').click()}
 await page.locator('[name=title]').fill('첫 기기 미저장 초안');await second.locator('[name=title]').fill('두 번째 기기 저장');await second.locator('#form button[type=submit]').click();await second.waitForFunction(()=>!blogState.busy&&!document.querySelector('#editor').open);
 await page.locator('#form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#editor-message').textContent.includes('다른 기기'));
 assert.equal(posts.get('public').entry.title,'두 번째 기기 저장');assert.equal(await page.locator('[name=title]').inputValue(),'첫 기기 미저장 초안');await page.evaluate(()=>blogClient.auth.refreshSession());assert.equal(await page.locator('[name=title]').inputValue(),'첫 기기 미저장 초안');
 const download=page.waitForEvent('download');await page.locator('#draft-backup').click();await download;
 await page.locator('#reload-post').click();await page.waitForFunction(()=>document.querySelector('[name=title]').value==='두 번째 기기 저장');await page.locator('#cancel').click();
 // Import preserves browser originals and stays private; repeated import is idempotent.
 const archive={entries:[entry('old','이전 기록')],topics:['Old']};await page.evaluate(a=>localStorage.setItem('personal-archive-v1',JSON.stringify(a)),archive);
 await page.locator('#account').click();await page.locator('#import-browser').click();await page.waitForFunction(()=>!blogState.busy&&document.querySelector('#account-message').textContent.includes('1개 기록'));const count=posts.size;
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('personal-archive-v1')).entries[0].title),'이전 기록');assert.equal([...posts.values()].find(p=>p.entry.title==='이전 기록').status,'draft');
 await page.locator('#import-browser').click();await page.waitForFunction(()=>!blogState.busy&&document.querySelector('#account-message').textContent.includes('0개 기록'));assert.equal(posts.size,count);await page.locator('#close-account').click();
 await page.reload();await page.waitForFunction(()=>blogState.ready&&blogState.admin);
 // Topic editing persists atomically through RPC.
 await page.locator('#edit-topics').click();await page.locator('.topic-name').first().fill('Changed');await page.locator('[data-topic-act=save]').click();await page.waitForFunction(()=>!blogState.busy&&!topicEditing);assert(settings.topics.includes('Changed'));
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/admin.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#add').click();await page.screenshot({path:'test-results/editor-mobile.png'});await page.locator('#cancel').click();
 await page.evaluate(async s=>blogClient.auth.setSession(s),session(B));await page.waitForFunction(()=>blogState.ready&&blogState.user.id==='22222222-2222-4222-8222-222222222222');assert.equal(await page.locator('.entry').count(),1);assert.equal(await page.locator('#add').isVisible(),false);assert.equal(await page.evaluate(()=>photoUrls.size),0);
 await page.locator('#account').click();await page.locator('#logout').click();await page.waitForFunction(()=>blogState.ready&&!blogState.user);assert(!await page.evaluate(()=>localStorage.getItem('papershelf-blog-session')));
 await page.goto(origin+'/?post=public');await page.waitForFunction(()=>blogState.ready);assert(await page.locator('.entry[data-id=public]').evaluate(el=>el.open));assert((await page.title()).includes('두 번째 기기 저장'));
 await page.screenshot({path:'test-results/visitor-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 // A rejected OAuth consent returns a useful retry screen without storing an authenticated session.
 const deniedContext=await browser.newContext();await mock(deniedContext,origin);const denied=await deniedContext.newPage();denied.on('pageerror',e=>errors.push(e.message));await denied.goto(origin+'/?error=access_denied&error_description=Denied');await denied.waitForFunction(()=>document.querySelector('#account-dialog').open);assert((await denied.locator('#account-message').textContent()).includes('완료하지 못했습니다'));assert.equal(await denied.evaluate(()=>blogState.user),null);assert.equal(new URL(denied.url()).searchParams.get('error'),null);await deniedContext.close();assert.deepEqual(errors,[]);
 console.log('PASS browser: public/admin separation, GitHub OAuth redirect/PKCE exchange and disabled-provider handling, persistent login/logout, photos, draft default, 2-device conflict, draft backup/reload, original-preserving import, topic editing, permalink, mobile');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exit(1)});
