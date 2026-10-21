const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id int generated always as identity,bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users(id) values('${owner}'),('${other}');`);
 await db.exec(fs.readFileSync('supabase/setup.sql','utf8'));
 await db.exec(`insert into papershelf_private.owner_bootstrap(email) values('owner@example.com');
 update auth.users set email='owner@example.com' where id='${owner}';`);
 assert.equal((await db.query('select * from public.papershelf_blog_settings')).rows.length,0);
 await db.exec(`update auth.users set email_confirmed_at=now() where id='${owner}';`);
 assert.equal((await db.query('select owner_id from public.papershelf_blog_settings')).rows[0].owner_id,owner);
 async function as(role,uid,fn){await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid||''}',false);`);try{return await fn()}finally{await db.exec('reset role')}}
 const entry={id:'post1',title:'private',date:'2026-10-21',kind:'note',topics:['Test'],images:['photo1'],body:'![image](photo:photo1)',url:''};
 const save=(changes,topics=null,v=null)=>db.query('select public.papershelf_blog_save($1::jsonb,$2::text[],$3::int)',[JSON.stringify(changes),topics,v]);
 const change=(version,status='draft',title='private')=>({id:'post1',expected_version:version,entry:{...entry,title},status});
 await as('authenticated',owner,()=>save([change(0)]));
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['papershelf-blog-photos',owner+'/photo1']);
 for(const [role,uid] of [['anon',''],['authenticated',other]]){
   await as(role,uid,async()=>{
     assert.equal((await db.query('select * from public.papershelf_posts')).rows.length,0);
     assert.equal((await db.query('select * from storage.objects')).rows.length,0);
     await assert.rejects(()=>save([change(1,'published')]),e=>e.code==='42501');
     await assert.rejects(()=>db.query('insert into public.papershelf_posts(id,owner_id,entry) values($1,$2,$3)',['fake',other,JSON.stringify({...entry,id:'fake'})]));
     assert.equal((await db.query("update public.papershelf_posts set status='published' returning id").catch(()=>({rows:[]}))).rows.length,0);
   });
 }
 await as('authenticated',owner,()=>save([change(1,'published','public')]));
 await as('anon','',async()=>{assert.equal((await db.query('select * from public.papershelf_posts')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,1)});
 await as('authenticated',owner,async()=>{
   await assert.rejects(()=>save([change(1,'published','stale')]),e=>e.code==='40001');
   assert.equal((await db.query('select entry->>\'title\' title from public.papershelf_posts')).rows[0].title,'public');
   // Topic and post changes are one transaction; stale post must roll back topics too.
   await assert.rejects(()=>save([change(1)],['Should roll back'],1),e=>e.code==='40001');
   assert.deepEqual((await db.query('select topics from public.papershelf_blog_settings')).rows[0].topics,[]);
   await save([change(2,'draft')],['Test'],1);
   await assert.rejects(()=>db.query('update public.papershelf_blog_settings set owner_id=$1',[other]),e=>e.code==='42501');
 });
 await as('anon','',async()=>{assert.equal((await db.query('select * from public.papershelf_posts')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0)});
 await db.close();console.log('PASS database: owner-only writes, draft/photo isolation, publish/unpublish, CAS conflict, atomic rollback, immutable owner');
})().catch(e=>{console.error(e);process.exit(1)});
