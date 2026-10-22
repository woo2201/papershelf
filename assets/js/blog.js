'use strict';
const client=window.blogClient, bs=window.blogState;
const BUCKET='papershelf-blog-photos';
const photoPath=id=>{if(!/^[\w-]{1,200}$/.test(id))throw Error('잘못된 사진 ID');const row=entries.find(e=>e.images.includes(id));const uid=row?.owner_id||bs.user?.id;if(!uid)throw Error('사진 소유자를 찾을 수 없습니다.');return `${uid}/${id}`};
window.blogPhotoGet=async id=>{const epoch=bs.epoch;const {data,error}=await client.storage.from(BUCKET).download(photoPath(id));if(error)throw error;if(epoch!==bs.epoch)throw Error('계정이 변경되었습니다.');return data};
const entryData=e=>({id:e.id,title:e.title,date:e.date,kind:e.kind,topics:e.topics,body:e.body,url:e.url||'',images:[...new Set([...e.images,...photoRefs(e.body)])]});
const changeFor=(e,status=e.status||'draft')=>({id:e.id,expected_version:e.version||0,entry:entryData(e),status});
function failure(error,target='#editor-message'){
  const msg=error?.code==='40001'?'다른 기기에서 수정된 글 또는 토픽입니다. 작성 내용은 유지했습니다. 필요한 내용을 복사한 뒤 취소하고 새로고침해 글을 다시 열어 주세요.':`저장/연결 실패: ${error?.message||'연결을 확인하고 다시 시도해 주세요.'}`;
  $(target).textContent=msg;notify(msg);
}
function requireAdmin(){if(!bs.admin||!bs.ready)throw Error('관리자로 로그인한 뒤 다시 시도해 주세요.')}
async function mutate(fn,target='#editor-message'){
  if(bs.busy)return;try{requireAdmin()}catch(e){failure(e,target);return}
  const epoch=bs.epoch;bs.busy=true;
  const locked=[...document.querySelectorAll('#form input,#form textarea,#form button,[data-topic-act=save]')].map(el=>[el,el.disabled]);locked.forEach(([el])=>el.disabled=true);
  try{await fn(()=>{if(epoch!==bs.epoch)throw Error('계정이 변경되어 작업을 중단했습니다.');requireAdmin()})}catch(e){if(epoch===bs.epoch)failure(e,target)}
  finally{if(epoch===bs.epoch){bs.busy=false;locked.forEach(([el,disabled])=>el.disabled=disabled)}}
}
async function save(changes,topics=null,version=null){const {error}=await client.rpc('papershelf_blog_save',{p_changes:changes,p_topics:topics,p_topics_version:version});if(error)throw error}
async function load(){
  const epoch=bs.epoch;const all=[];
  for(let from=0;;from+=500){let q=client.from('papershelf_posts').select('id,owner_id,entry,status,version').order('id').range(from,from+499);if(!bs.admin)q=q.eq('status','published');const {data,error}=await q;if(error)throw error;if(epoch!==bs.epoch)return;all.push(...data);if(data.length<500)break}
  let settings=null;
  if(bs.admin){const {data,error}=await client.from('papershelf_blog_settings').select('topics,version,owner_id').eq('owner_id',bs.user.id).maybeSingle();if(error)throw error;settings=data}
  if(epoch!==bs.epoch)return;
  entries=all.map(r=>({...normalize(r.entry),id:r.id,owner_id:r.owner_id,status:r.status,version:r.version})).filter(valid);
  bs.settings=settings;topicCatalog=settings?.topics||[];bs.ready=true;$('#load-error').hidden=true;render();openPermalink();
}
const renderArchive=render;
render=function(){renderArchive();document.querySelectorAll('[data-admin]').forEach(el=>el.hidden=!bs.admin||!bs.ready);$('#add').hidden=!bs.admin||!bs.ready||!$('#editor').hidden;if(topicEditing)$('#edit-topics').hidden=true};
function openPermalink(){const id=new URL(location.href).searchParams.get('post');if(!id)return;const row=[...document.querySelectorAll('.entry')].find(el=>el.dataset.id===id);if(row){row.open=true;fillEntry(row);document.title=`${entries.find(e=>e.id===id).title} — Papershelf`}else{$('#load-error').hidden=false;$('#load-error').textContent='이 글은 비공개이거나 존재하지 않습니다.'}}
async function acceptSession(session){
  const uid=session?.user?.id||null;if(bs.initialized&&uid===bs.user?.id)return;
  if(bs.initialized&&!uid&&!bs.user)return;
  bs.initialized=true;bs.epoch++;const epoch=bs.epoch;bs.user=session?.user||null;bs.admin=false;bs.ready=false;bs.busy=false;
  closeEditor(true,false);bs.editEntry=null;bs.editVersion=0;editId=null;$('#print-frame')?.remove();$('#form').reset();clearDraftPhotos();$('#md-preview').innerHTML='';$('#editor-message').textContent='';
  forgetPhotos([...photoUrls.keys()]);entries=[];topicCatalog=[];selected.clear();topicEditing=false;$('.layout aside').classList.remove('editing');render();updateAccount();
  try{
    if(uid){const {data,error}=await client.from('papershelf_blog_settings').select('owner_id').eq('owner_id',uid).maybeSingle();if(error)throw error;if(epoch!==bs.epoch)return;bs.admin=!!data}
    updateAccount();await load();
  }catch(e){if(epoch===bs.epoch){$('#load-error').hidden=false;$('#load-error').textContent=`글을 불러오지 못했습니다. ${e.message}`;$('#account-message').textContent=e.message}}
}
function updateAccount(){document.body.classList.toggle('blog-admin',bs.admin);$('#account').textContent=bs.user?'ACCOUNT':'LOGIN';$('#login-panel').hidden=!!bs.user;$('#account-actions').hidden=!bs.user;$('#account-email').textContent=bs.user?.email||'';if(bs.user&&!bs.admin)$('#account-message').textContent='이 계정에는 블로그 작성 권한이 없습니다.';else $('#account-message').textContent='';render()}
$('#account').onclick=()=>$('#account-dialog').showModal();$('#close-account').onclick=()=>$('#account-dialog').close();
let oauthStarting=false;
$('#github-login').onclick=async()=>{
  if(oauthStarting)return;oauthStarting=true;
  const button=$('#github-login');button.disabled=true;button.textContent='GitHub로 이동 중…';$('#account-message').textContent='';
  try{
    const response=await fetch(`${client.supabaseUrl}/auth/v1/settings`,{headers:{apikey:client.supabaseKey}});
    if(!response.ok)throw Error('로그인 서비스에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    const settings=await response.json();
    if(settings.external?.github!==true)throw Error('GitHub 로그인 연결 설정이 아직 완료되지 않았습니다.');
    const {data,error}=await client.auth.signInWithOAuth({provider:'github',options:{redirectTo:new URL('./',location.href).href,skipBrowserRedirect:true}});
    if(error)throw error;if(!data.url)throw Error('GitHub 로그인 주소를 받지 못했습니다.');
    location.assign(data.url);
  }catch(error){$('#account-message').textContent=error.message}
  finally{oauthStarting=false;button.disabled=false;button.textContent='GitHub로 로그인'}
};
$('#logout').onclick=async()=>{if(bs.busy){$('#account-message').textContent='저장 완료 후 로그아웃해 주세요.';return}const {error}=await client.auth.signOut({scope:'local'});if(error){$('#account-message').textContent=error.message;return}await acceptSession(null);$('#account-dialog').close()};
client.auth.onAuthStateChange((event,session)=>{if(event!=='TOKEN_REFRESHED')setTimeout(()=>acceptSession(session),0)});
const authCallbackUrl=new URL(location.href);
const authCallbackError=authCallbackUrl.searchParams.get('error_description')||new URLSearchParams(authCallbackUrl.hash.slice(1)).get('error_description');
client.auth.getSession().then(async({data,error})=>{
  await acceptSession(error?null:data.session);
  if(error||authCallbackError){$('#account-message').textContent='GitHub 로그인을 완료하지 못했습니다. 다시 시도해 주세요.';$('#account-dialog').showModal();for(const key of ['error','error_code','error_description'])authCallbackUrl.searchParams.delete(key);if(authCallbackUrl.hash.includes('error'))authCallbackUrl.hash='';history.replaceState(null,'',authCallbackUrl)}
});

async function uploadPhoto(id,blob,check){
  check();if(blob.size>=PHOTO_MAX||!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(blob.type))throw Error('사진은 PNG, JPEG, WebP, GIF, AVIF 형식의 5MB 미만 파일이어야 합니다.');
  const path=`${bs.user.id}/${id}`;const {error}=await client.storage.from(BUCKET).upload(path,blob,{upsert:false,contentType:blob.type});check();
  if(error){if(!['409','Duplicate'].includes(String(error.statusCode||error.code)))throw error;const {data,error:readError}=await client.storage.from(BUCKET).download(path);check();if(readError)throw readError;if(await digest(data)!==await digest(blob))throw Error('같은 ID의 다른 사진이 있어 업로드를 중단했습니다.')}
}
$('#form').onsubmit=e=>{e.preventDefault();mutate(async check=>{
  const f=e.target.elements, prev=bs.editEntry;const body=f.body.value.trim();const images=photoRefs(body);
  const entry={id:editId||crypto.randomUUID(),title:f.title.value.trim(),date:f.date.value,kind:prev?.kind||'note',topics:readEntryTopics(),body,url:prev?.url||'',images,version:bs.editVersion};
  if(!valid(entry))throw Error('제목과 날짜를 확인해 주세요.');
  const known=new Set([...(prev?.images||[]),...entries.flatMap(x=>x.images),...draftPhotos.keys()]);
  if(images.some(id=>!known.has(id)))throw Error('찾을 수 없는 사진 참조가 있습니다. 사진을 다시 넣어 주세요.');
  for(const id of images){const p=draftPhotos.get(id);if(p)await uploadPhoto(id,p.blob,check)}
  check();await save([changeFor(entry,$('#publish-entry').checked?'published':'draft')]);check();
  closeEditor(true);await load();notify('저장했습니다.');
})};
$('#entries').onclick=async e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const entry=entries.find(x=>x.id===button.closest('[data-id]').dataset.id);if(!entry)return;
  const action=button.dataset.action;
  if(action==='md'||action==='pdf'){
    button.disabled=true;try{await(action==='md'?exportMarkdown(entry):exportPDF(entry))}catch(error){notify(error.message||'내보내지 못했습니다.')}finally{button.disabled=false}return;
  }
  if(!bs.admin)return;
  if(action==='edit')openEditor(entry);
  else if(action==='delete'&&confirm(`“${entry.title}” 글을 삭제할까요?`))mutate(async check=>{await save([{id:entry.id,expected_version:entry.version,delete:true}]);check();if(editId===entry.id)closeEditor(true);await load();notify('삭제했습니다.')},'#account-message');
};
async function saveTopics(){
  const names=topicDraft.map(t=>t.name.trim());if(names.some(t=>!t)||new Set(names.map(t=>t.toLowerCase())).size!==names.length){notify('토픽 이름이 비어 있거나 중복됩니다.');return}
  const snapshot=entries.map(e=>structuredClone(e));const next=transformTopics(snapshot,topicDraft);
  const changes=next.filter((e,i)=>JSON.stringify(e.topics)!==JSON.stringify(snapshot[i].topics)).map(e=>changeFor(e));
  await mutate(async check=>{await save(changes,names,bs.settings.version);check();topicEditing=false;$('.layout aside').classList.remove('editing');selected.clear();await load();notify('토픽을 수정했습니다.')},'#account-message');
}
const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
let refreshing=false;
async function refreshIdle(){if(!bs.ready||bs.busy||refreshing||!$('#editor').hidden||topicEditing)return;refreshing=true;try{await load()}catch{}finally{refreshing=false}}
addEventListener('focus',refreshIdle);setInterval(refreshIdle,60000);
addEventListener('beforeunload',e=>{if(editorDirty()){e.preventDefault();e.returnValue=''}});
