// Read-only deployment check using a PUBLIC publishable key, never service_role.
const fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('assets/js/blog-client.js','utf8');
 const url=source.match(/https:\/\/[a-z]+\.supabase\.co/)[0];const key=source.match(/sb_publishable_[A-Za-z0-9_-]+/)[0];
 const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});
 if(!response.ok)throw Error('Cannot verify Auth settings: HTTP '+response.status);
 const settings=await response.json();
 if(settings.external?.github!==true)throw Error('Enable the GitHub OAuth provider in Supabase before deploying.');
 const posts=await fetch(url+'/rest/v1/papershelf_posts?select=id&status=eq.published&limit=1',{headers:{apikey:key}});
 if(!posts.ok)throw Error('Public post API unavailable: HTTP '+posts.status);
 console.log('PASS live read-only: GitHub OAuth enabled and public posts API reachable');
})().catch(e=>{console.error(e.message);process.exit(1)});
