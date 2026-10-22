
'use strict';
const $=s=>document.querySelector(s);const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(s){try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function valid(x){return x&&typeof x.id==='string'&&typeof x.title==='string'&&x.title.trim()&&typeof x.body==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&!Number.isNaN(Date.parse(x.date))&&['note','article','link'].includes(x.kind)&&(x.images===undefined||Array.isArray(x.images)&&x.images.every(i=>typeof i==='string'))&&typeof x.url==='string'&&(!x.url||safeUrl(x.url))&&Array.isArray(x.topics)&&x.topics.every(t=>typeof t==='string'&&t.trim())}
let topicCatalog=[],topicEditing=false;
/* Entries retain photo IDs; account-scoped storage supplies the image data. */
const PHOTO_MAX=5*1024*1024;function normalize(e){return {...e,kind:e.kind==='link'?'article':e.kind,images:Array.isArray(e.images)?e.images:[]}}
const photoGet=id=>window.blogPhotoGet(id);
const photoUrls=new Map();async function photoUrl(id){if(!photoUrls.has(id)){const epoch=blogState.epoch;const blob=await photoGet(id).catch(()=>null);if(epoch!==blogState.epoch)return '';photoUrls.set(id,blob?URL.createObjectURL(blob):'')}return photoUrls.get(id)}
function forgetPhotos(ids){ids.forEach(id=>{const u=photoUrls.get(id);if(u)URL.revokeObjectURL(u);photoUrls.delete(id)})}
/* Markdown: marked + highlight.js, sanitised with DOMPurify. Photos are referenced as ![](photo:<id>). */
const md=new marked.Marked({gfm:true,breaks:true});
md.use({renderer:{code(code,info){const lang=(info||'').trim().split(/\s+/)[0].toLowerCase();let html;try{html=lang&&hljs.getLanguage(lang)?hljs.highlight(code,{language:lang,ignoreIllegals:true}).value:escapeHTML(code)}catch{html=escapeHTML(code)}return `<div class="code-block"><div class="code-bar"><span>${escapeHTML(lang||'code')}</span><button type="button" class="code-copy" data-copy>복사</button></div><pre><code class="hljs">${html}</code></pre></div>`},
image(href,title,text){href=href||'';if(href.startsWith('photo:'))return `<img data-photo="${escapeHTML(href.slice(6))}" alt="${escapeHTML(text||'사진')}">`;return `<img src="${escapeHTML(href)}" alt="${escapeHTML(text||'')}" loading="lazy">`}}});
DOMPurify.addHook('afterSanitizeAttributes',n=>{if(n.tagName==='A'&&n.getAttribute('href')){n.setAttribute('target','_blank');n.setAttribute('rel','noopener noreferrer')}});
const photoRefs=text=>[...new Set([...String(text).matchAll(/\]\(photo:([\w-]+)\)/g)].map(m=>m[1]))];
function renderMarkdown(text){return DOMPurify.sanitize(md.parse(String(text||'')),{ADD_ATTR:['target']})}
async function hydrateIn(root,local){for(const img of root.querySelectorAll('img[data-photo]')){const id=img.dataset.photo;const u=local?.get(id)?.url||await photoUrl(id);if(u)img.src=u;else img.replaceWith(Object.assign(document.createElement('span'),{className:'photo-missing',textContent:'[사진을 찾을 수 없음]'}))}}
function fillEntry(d){const box=d.querySelector('.prose');if(!box||box.dataset.ready)return;const entry=entries.find(x=>x.id===d.dataset.id);if(!entry)return;const extra=entry.images.filter(id=>!photoRefs(entry.body).includes(id));box.innerHTML=renderMarkdown(entry.body||'아직 내용이 없습니다.')+(extra.length?`<div class="photos">${extra.map(id=>`<img data-photo="${escapeHTML(id)}" alt="첨부 사진">`).join('')}</div>`:'');box.dataset.ready='1';hydrateIn(box)}
document.addEventListener('click',e=>{const c=e.target.closest('[data-copy]');if(c){const code=c.closest('.code-block').querySelector('code').innerText;navigator.clipboard?.writeText(code).then(()=>{c.textContent='복사됨';setTimeout(()=>c.textContent='복사',1400)},()=>notify('복사하지 못했습니다.'));return}const img=e.target.closest('.prose img[src]');if(img&&!img.closest('a'))open(img.src,'_blank','noopener')});
document.getElementById('entries').addEventListener('toggle',e=>{if(e.target.open)fillEntry(e.target)},true);

let entries=[],selected=new Set(),view='all',ascending=false,editId=null,timer;
function notify(message){$('#status').textContent=message;clearTimeout(timer);timer=setTimeout(()=>$('#status').textContent='',4200)}
function render(){const opened=new Set([...document.querySelectorAll('#entries details[open]')].map(el=>el.dataset.id));const topics=[...new Set([...topicCatalog,...entries.flatMap(e=>e.topics)])].sort((a,b)=>a.localeCompare(b));selected=new Set([...selected].filter(t=>topics.includes(t)));if(!topicEditing)$('#topics').innerHTML=topics.map(t=>`<label class="topic"><input type="checkbox" value="${escapeHTML(t)}" ${selected.has(t)?'checked':''}><span>${escapeHTML(t)}</span><span class="count">(${entries.filter(e=>e.topics.includes(t)).length})</span></label>`).join('');const query=$('#search').value.toLocaleLowerCase().trim();const filtered=entries.filter(e=>(view==='all'||view===e.kind)&&(!selected.size||e.topics.some(t=>selected.has(t)))&&[e.title,e.body,...e.topics].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>(ascending?1:-1)*a.date.localeCompare(b.date));$('#total').textContent=`(${entries.length})`;$('#results').textContent=filtered.length===entries.length?'':` · ${filtered.length}`;$('#entries').innerHTML=filtered.length?filtered.map(e=>`<details class="entry" data-id="${escapeHTML(e.id)}" ${opened.has(e.id)?'open':''}><summary><span class="date">${e.date.replaceAll('-','.')}</span><span class="title">${escapeHTML(e.title)}${blogState.admin&&e.status!=='published'?' <small class="draft-badge">초안</small>':''}</span><span class="plus" aria-hidden="true">+</span></summary><div class="detail"><div class="prose"></div><div class="tags">${e.topics.map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join('')}</div><div class="actions entry-actions"><div>${safeUrl(e.url)?`<a class="small active" href="${escapeHTML(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">링크 열기 ↗</a>`:''}<a class="small" href="?post=${encodeURIComponent(e.id)}">글 주소 ↗</a><button class="small" data-action="md" aria-label="Markdown 내보내기">MD ↓</button><button class="small" data-action="pdf" aria-label="PDF로 저장">PDF ↓</button></div>${blogState.admin?'<div><button class="small" data-action="edit">수정</button><button class="small" data-action="delete">삭제</button></div>':''}</div></div></details>`).join(''):'<div class="empty">표시할 글이 없습니다.</div>';document.querySelectorAll('#entries details[open]').forEach(fillEntry)}
$('#topics').addEventListener('change',e=>{if(topicEditing||e.target.type!=='checkbox')return;e.target.checked?selected.add(e.target.value):selected.delete(e.target.value);render()});$('#search').addEventListener('input',render);function setView(v){view=v;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===v);b.setAttribute('aria-pressed',String(b.dataset.view===v))});render()}document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#sort').onclick=()=>{ascending=!ascending;$('#sort').textContent=ascending?'오래된순 ↑':'최신순 ↓';render()};

function availableTopics(){return [...new Set([...topicCatalog,...entries.flatMap(e=>e.topics)])].sort((a,b)=>a.localeCompare(b))}
function renderEntryTopics(chosen){$('#entry-topics').innerHTML=availableTopics().map(t=>`<label class="entry-topic"><input type="checkbox" name="entryTopic" value="${escapeHTML(t)}" ${chosen.includes(t)?'checked':''}><span>${escapeHTML(t)}</span></label>`).join('')||'<span class="no-topics">등록된 토픽 없음</span>'}
function readEntryTopics(){const allowed=new Set(availableTopics());return [...document.querySelectorAll('#entry-topics input:checked')].map(el=>el.value).filter(t=>allowed.has(t))}

let draftPhotos=new Map();
function clearDraftPhotos(){draftPhotos.forEach(p=>URL.revokeObjectURL(p.url));draftPhotos=new Map()}
function insertAtCursor(ta,text){ta.focus();const st=ta.selectionStart,en=ta.selectionEnd;const before=ta.value.slice(0,st);const pre=before&&!before.endsWith('\n')?'\n':'';ta.setRangeText(pre+text+'\n',st,en,'end');ta.dispatchEvent(new Event('input',{bubbles:true}))}
function addPhotos(files){if(blogState.busy)return;const ta=$('#form').elements.body;let skipped=0,added='';for(const file of files){if(!file.type.startsWith('image/'))continue;if(file.size>=PHOTO_MAX){skipped++;continue}const id=crypto.randomUUID();draftPhotos.set(id,{blob:file,url:URL.createObjectURL(file)});added+=`![${(file.name||'사진').replace(/\.[^.]+$/,'').replace(/[\[\]]/g,'')}](photo:${id})\n`}if(added){setTab('write');insertAtCursor(ta,added.trimEnd())}if(skipped)notify(`5MB 이상인 사진 ${skipped}장은 넣지 않았습니다.`)}
function setTab(tab){const preview=tab==='preview';document.querySelectorAll('.write-tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));const ta=$('#form').elements.body,pv=$('#md-preview');if(preview){pv.style.minHeight=Math.max(ta.offsetHeight,190)+'px';pv.innerHTML=renderMarkdown(ta.value||'*미리 볼 내용이 없습니다.*');hydrateIn(pv,draftPhotos)}ta.parentElement.hidden=preview;pv.hidden=!preview}
document.querySelector('.write-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)});
async function openEditor(entry){if(!blogState.admin||!blogState.ready||blogState.busy)return;if(editorDirty()&&!confirm('작성 중인 내용을 닫고 다른 글을 열까요?'))return;blogState.editVersion=entry?.version||0;blogState.editEntry=entry?structuredClone(entry):null;editId=entry?.id||null;$('#form').reset();$('#publish-entry').checked=entry?.status==='published';$('#editor-message').textContent='';setTab('write');$('#form-title').textContent=entry?'기록 수정':'새로운 기록';const f=$('#form').elements;f.title.value=entry?.title||'';f.date.value=entry?.date||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);renderEntryTopics(entry?.topics||[]);clearDraftPhotos();let body=entry?.body||'';const extra=(entry?.images||[]).filter(id=>!photoRefs(body).includes(id));if(extra.length)body+=(body?'\n\n':'')+extra.map(id=>`![사진](photo:${id})`).join('\n');f.body.value=body;$('#editor').style.removeProperty('left');$('#editor').style.removeProperty('top');$('#editor').style.removeProperty('margin');$('#editor').hidden=false;$('#add').hidden=true;$('#add').setAttribute('aria-expanded','true');$('#editor').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});f.title.focus({preventScroll:true});initialForm=JSON.stringify([...new FormData($('#form'))])}
let initialForm='';
function editorDirty(){return !$('#editor').hidden&&JSON.stringify([...new FormData($('#form'))])!==initialForm}
function closeEditor(force=false,focus=true){if(!force&&(blogState.busy||(editorDirty()&&!confirm('작성 중인 내용을 닫을까요?'))))return false;clearDraftPhotos();$('#editor').hidden=true;$('#md-preview').innerHTML='';$('#editor-message').textContent='';$('#add').hidden=!blogState.admin||!blogState.ready;$('#add').setAttribute('aria-expanded','false');if(focus&&!$('#add').hidden)$('#add').focus({preventScroll:true});return true}
$('#add').onclick=()=>openEditor();$('#cancel').onclick=()=>closeEditor();
$('#photo-add').onclick=()=>$('#photo-file').click();$('#photo-file').onchange=e=>{addPhotos(e.target.files);e.target.value=''};
{const dlg=$('#editor');let depth=0;const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
dlg.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();depth++;dlg.classList.add('dropping')});
dlg.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
dlg.addEventListener('dragleave',e=>{if(!hasFiles(e))return;if(--depth<=0){depth=0;dlg.classList.remove('dropping')}});
dlg.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();depth=0;dlg.classList.remove('dropping');addPhotos(e.dataTransfer.files)});
dlg.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();addPhotos(files)}});
addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault()});addEventListener('drop',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault()});}
$('#form').elements.body.addEventListener('keydown',e=>{if(e.key==='Tab'&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey){const ta=e.target,before=ta.value.slice(0,ta.selectionStart);const fence=(before.match(/^```/gm)||[]).length%2===1;if(fence){e.preventDefault();ta.setRangeText('  ',ta.selectionStart,ta.selectionEnd,'end')}}});
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)});
setView('all');

let topicDraft=[];
function drawTopicEditor(){const used=t=>t.original===null?0:entries.filter(e=>e.topics.includes(t.original)).length;$('#topics').innerHTML=topicDraft.map((t,i)=>`<div class="topic topic-edit"><span class="box" aria-hidden="true"></span><input class="topic-name" data-topic-index="${i}" value="${escapeHTML(t.name)}" maxlength="60" placeholder="새 토픽" aria-label="토픽 이름 ${i+1}" spellcheck="false"><span class="count">(${used(t)})</span><button type="button" class="topic-remove" data-remove-topic="${i}" aria-label="${escapeHTML(t.name||'새 토픽')} 삭제">×</button></div>`).join('')+`<button type="button" class="topic topic-add" data-topic-act="add"><span class="box" aria-hidden="true">+</span><span>토픽 추가</span></button><div class="topic-actions"><button type="button" class="small" data-topic-act="cancel">취소</button><button type="button" class="small active" data-topic-act="save">저장</button></div>`}
function setTopicEditing(on){if(on&&(!blogState.admin||!blogState.ready||blogState.busy))return;topicEditing=on;const aside=$('.layout aside');aside.classList.toggle('editing',on);$('#edit-topics').hidden=on;if(on){topicDraft=availableTopics().map(t=>({original:t,name:t}));drawTopicEditor();$('#topics').querySelector('input')?.focus()}else render()}
$('#edit-topics').onclick=()=>setTopicEditing(true);
$('#topics').addEventListener('input',e=>{if(topicEditing&&e.target.dataset.topicIndex!==undefined)topicDraft[Number(e.target.dataset.topicIndex)].name=e.target.value});
$('#topics').addEventListener('click',e=>{if(!topicEditing)return;const rm=e.target.closest('[data-remove-topic]');if(rm){topicDraft.splice(Number(rm.dataset.removeTopic),1);drawTopicEditor();return}const act=e.target.closest('[data-topic-act]')?.dataset.topicAct;if(act==='add'){topicDraft.push({original:null,name:''});drawTopicEditor();const rows=$('#topics').querySelectorAll('.topic-edit input');rows[rows.length-1].focus()}else if(act==='cancel')setTopicEditing(false);else if(act==='save')saveTopics()});
$('#topics').addEventListener('keydown',e=>{if(!topicEditing||e.isComposing)return;if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();saveTopics()}else if(e.key==='Escape'){e.preventDefault();setTopicEditing(false);$('#edit-topics').focus()}});
function alignAside(){const sec=$('.layout>section'),head=$('.table-head');if(!sec||!head)return;document.documentElement.style.setProperty('--aside-offset',Math.max(0,head.getBoundingClientRect().top-sec.getBoundingClientRect().top)+'px')}
addEventListener('resize',alignAside);document.fonts?.ready.then(alignAside);alignAside();
function transformTopics(list,draft){const map=new Map(draft.filter(t=>t.original!==null).map(t=>[t.original,t.name.trim()]));return list.map(e=>({...e,topics:[...new Set(e.topics.map(t=>map.get(t)).filter(Boolean))]}))}
(function(){
const canvas=document.getElementById("fjord-background");if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
/*
Source: https://github.com/bas3line/ascii/blob/main/src/pieces/aurora-fjord.ts
Source SHA: a7eab9753e7e7cba8221ba1296706bc475cdf26d
Adapted renderer: circles, capped updates, visibility pause.
MIT License

Copyright (c) 2026 bas3line (https://github.com/bas3line)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
/*
 * aurora fjord: curtains of aurora ripple over a fjord between snowy
 * mountains. The still water holds a broken shimmer of them, and a red cabin
 * on the far shore keeps its lamps lit.
 *
 * Shaded in colour per cell on a square grid, then drawn as a halftone: dot
 * size is brightness, ordered-dithered, in the palette colour nearest its hue.
 * The land is built once; each frame shades the sky, then mirrors it into the
 * water.
 */
                                               

const meta = {
  name: "aurora fjord",
  category: "scenes",
  note: "aurora curtains rippling over a still fjord, a cabin lit on the shore",
  cols: 200,
  rows: 100,
  cell: 1,
  fps: 15,
  ground: "#05080f",
  palette: [
    "#0b1322", "#101b30", "#16243f", "#1e3050", "#2a3f63",
    "#0e3a33", "#11573f", "#167a4c", "#22a05c", "#3ccb73", "#7cf0a0", "#c8ffdc",
    "#0f5f5c", "#16877f", "#2cb5a6", "#7fe6d6",
    "#2a1f52", "#432b78", "#6a3c9f", "#9558c6", "#c48ae4", "#363a72", "#4f5596", "#1b4f63",
    "#1a2236", "#283350", "#3b4a6e", "#566a92", "#7d91b8", "#a9bad9", "#d6e0f2", "#9fc9cf",
    "#0f1a1c", "#173128", "#24493a",
    "#4a1517", "#7c2420", "#b23a2a", "#d65aa8",
    "#ffd27c", "#ffb04a", "#fff2c4",
    "#eef3ff",
  ],
}               ;

const W = 200, H = 100;
const WL = 62; // the waterline
const DOTS = " ·•●";
const COVER = [0, 0.3, 0.6, 1];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

const AIR = 0, NEAR = 1, FAR = 2, SHORE = 3, WALL = 4, ROOF = 5, PANE = 6, TREE = 7, DOOR = 8;
const CAB = [142, 161]; // the cabin's walls, x from and to
const PANES = [[145, 148], [156, 159]];
const DOOR_X = [150, 152];
const LAMPS = [[147, 1], [158, 0.8]]; // pane centres and their strength

function hash(x        , y        )         {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x        , y        )         {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x        , y        , octaves        )         {
  let s = 0, n = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise(x * f, y * f);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
}

const clamp = (v        ) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a        , b        , v        ) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const mix = (a        , b        , k        ) => a + (b - a) * k;
const hex = (s        ) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

// Ranges as tent peaks [x, height, slope], roughened.
const LEFT                             = [[25, 38, 1.3], [6, 29, 0.9], [50, 25, 1.0], [72, 13, 0.6]];
const RIGHT                             = [[172, 30, 1.15], [194, 24, 0.85], [151, 16, 1.0], [212, 22, 0.6]];
const DISTANT                             = [[100, 10, 0.5], [119, 12, 0.55], [86, 7, 0.45], [134, 8, 0.5]];

function range(x        , peaks                            , seed        , rough        )                   {
  let m = -99, px = 0;
  for (const [cx, h, s] of peaks) {
    const v = h - Math.abs(x - cx) * s;
    if (v > m) (m = v), (px = cx);
  }
  const j = rough * (fbm(x * 0.09, seed, 3) - 0.5) + rough * 0.45 * (noise(x * 0.45, seed + 5) - 0.5);
  return [m + j * Math.min(1, Math.max(0, m) / 6), px];
}

function auroraFjord()        {
  const P = meta.palette.map(hex);
  const N = W * H;
  const out           = new Array(N);

  const lut = new Uint8Array(32768).fill(255);
  const nearest = (r        , g        , b        )         => {
    const k = (Math.min(31, (r * 31.99) | 0) << 10) | (Math.min(31, (g * 31.99) | 0) << 5) | Math.min(31, (b * 31.99) | 0);
    if (lut[k] !== 255) return lut[k];
    let best = 0, bd = 1e9;
    for (let i = 0; i < P.length; i++) {
      const dr = P[i][0] - r, dg = P[i][1] - g, db = P[i][2] - b;
      const d = 0.3 * dr * dr + 0.5 * dg * dg + 0.2 * db * db;
      if (d < bd) (bd = d), (best = i);
    }
    return (lut[k] = best);
  };

  // --- the land, built once ------------------------------------------------
  const mat = new Uint8Array(N);
  const sr = new Float32Array(N), sg = new Float32Array(N), sb = new Float32Array(N);
  const rec = new Float32Array(N); // how much aurora light a cell picks up
  const rim = new Float32Array(N); // aurora light caught on ridgelines and treetops
  const nearTop = new Float32Array(W), farTop = new Float32Array(W), peakX = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const [hl, pl] = range(x + 0.5, LEFT, 3.1, 4);
    const [hr, pr] = range(x + 0.5, RIGHT, 7.7, 4);
    const [hd] = range(x + 0.5, DISTANT, 11.3, 2.2);
    nearTop[x] = WL - Math.max(hl, hr, 0);
    peakX[x] = hl > hr ? pl : pr;
    farTop[x] = WL - Math.max(hd, 0);
  }
  const shoreTop = (x        ) => WL - 2.2 * smooth(134, 140, x) * smooth(178, 168, x) - 0.6 * noise(x * 0.3, 2);
  const cabBase = WL - 2.2;

  for (let r = 0; r < WL; r++) {
    for (let x = 0; x < W; x++) {
      const k = r * W + x;
      const y = r + 0.5;
      if (y >= nearTop[x]) {
        mat[k] = NEAR;
        const px = peakX[x];
        const side = x + 0.5 - px;
        const depth = y - nearTop[x];
        const height = WL - nearTop[x];
        // Faces turned toward the fjord catch the aurora; the ridge between
        // the faces wanders as it comes down from the peak.
        const ridge = px + (depth + 1) * 0.6 * (noise(y * 0.1, px) - 0.5);
        const inward = px < 100 ? 1 : -1;
        const face = smooth(-4, 4, (x + 0.5 - ridge) * inward);
        // ribs and couloirs running down the fall line, each with a lit side
        const u = x + depth * 0.45 * Math.sign(side || 1);
        const rib = (v        ) => fbm(v * 0.13, px * 0.37, 3);
        const grad = (rib(u + 1) - rib(u - 1)) * 7 * inward;
        // the snow reaches further down the ribs than the couloirs, in fingers
        const reach = 3 + height * (0.62 + 0.42 * rib(u + 40));
        const streak = smooth(0.56, 0.64, fbm(u * 0.32, y * 0.035 + px, 3)) * smooth(1, 5, depth);
        // a stand of spruce climbing the slope behind the cabin, jagged on top
        const cx = x + 0.5 - 152;
        const wood = WL - 18.5 + 9 * (cx / 19) ** 2 + 1.5 * (noise(x * 0.7, 9) - 0.5) - 2.6 * hash(x, 77) * ((x & 1) ? 1 : 0.3);
        const snow = smooth(reach + 1.6, reach - 1.6, depth) * (1 - smooth(WL - 3, WL - 0.5, y)) * (1 - 0.5 * streak);
        const lit = clamp(0.35 + 0.55 * face + grad * 0.5);
        // blue-grey rock below the snow, a little lighter on the lit faces
        const rv = 0.75 + 0.5 * fbm(x * 0.4, y * 0.4, 2);
        const rr = (0.05 + 0.03 * lit) * rv, rg = (0.065 + 0.035 * lit) * rv, rb = (0.11 + 0.05 * lit) * rv;
        const s = 0.34 + 0.66 * Math.pow(lit, 1.5);
        sr[k] = mix(rr, 0.62 * s + 0.04, snow);
        sg[k] = mix(rg, 0.7 * s + 0.05, snow);
        sb[k] = mix(rb, 0.86 * s + 0.09, snow);
        rec[k] = snow * (0.25 + 0.75 * lit) + 0.06;
        rim[k] = smooth(2.2, 0.3, depth) * 0.5;
        if (y > wood && cx > -14 - 2 * hash(r, 3) && cx < 13 + 2 * hash(r, 4)) {
          mat[k] = TREE;
          const h = hash(x * 13 + r, 5);
          sr[k] = 0.02 + 0.03 * h, sg[k] = 0.045 + 0.045 * h, sb[k] = 0.06 + 0.04 * h;
          rec[k] = 0.05;
          rim[k] = smooth(wood + 1.6, wood + 0.2, y) * (0.7 + 0.3 * h);
        }
      } else if (y >= farTop[x]) {
        mat[k] = FAR;
        const depth = y - farTop[x];
        const snow = smooth(0.5, 0.62, fbm(x * 0.18, y * 0.25, 3) * 0.6 + (1 - depth / 7) * 0.55);
        const lit = 0.5 + 0.3 * (noise(x * 0.25, y * 0.1) - 0.5);
        sr[k] = mix(0.075, 0.22 * lit + 0.12, snow);
        sg[k] = mix(0.1, 0.27 * lit + 0.15, snow);
        sb[k] = mix(0.17, 0.36 * lit + 0.24, snow);
        rec[k] = 0.2 + 0.3 * snow;
      }
      // the shelf the cabin stands on, snowed over
      if (x > 132 && x < 180 && y >= shoreTop(x)) {
        mat[k] = SHORE;
        const f = 0.6 + 0.3 * fbm(x * 0.3, y * 0.5, 2);
        sr[k] = 0.26 * f, sg[k] = 0.3 * f, sb[k] = 0.42 * f;
        rec[k] = 0.4;
        rim[k] = 0;
      }
    }
  }

  // a spruce treeline along the foot of both ranges, open where the fjord runs in
  const spruce = (tx        , th        , tw        , tb        , guard                                 ) => {
    for (let r = Math.max(0, Math.floor(tb - th)); r < WL; r++) {
      const y = r + 0.5, dy = y - (tb - th);
      if (dy < 0 || y >= tb + 0.5) continue;
      const tier = (dy + th * 0.3) / 1.8;
      const w = (dy / th) * tw * (0.7 + 0.45 * (tier - Math.floor(tier))) + 0.35;
      for (let x = Math.max(0, Math.floor(tx - tw - 1)); x <= Math.min(W - 1, tx + tw + 1); x++) {
        const k = r * W + x;
        const ex = x + 0.5 - tx;
        if (Math.abs(ex) > w || (guard && guard(k))) continue;
        mat[k] = TREE;
        const h = hash(x * 13 + r, 5);
        const s = ex < 0 ? 0.7 : 0.3; // the aurora is up and left
        sr[k] = 0.02 + 0.03 * s * h, sg[k] = 0.04 + 0.05 * s, sb[k] = 0.055 + 0.045 * s;
        rec[k] = 0.05;
        rim[k] = Math.max(smooth(1.6, 0.2, dy), ex < 0 && ex < -w + 1 ? 0.45 * smooth(th, 0, dy) : 0);
      }
    }
  };
  const solid = (k        ) => mat[k] === WALL || mat[k] === ROOF || mat[k] === PANE || mat[k] === DOOR || mat[k] === SHORE;
  for (let x = -1; x < W + 2; ) {
    const h = hash(Math.floor(x * 7), 21);
    const open = smooth(96, 80, x) + smooth(122, 136, x);
    const onShelf = x > 132 && x < 180;
    if (open > 0.05 && !(x > 136 && x < 166)) {
      const th = (3.2 + hash(Math.floor(x * 3), 5) * 3 + (hash(Math.floor(x * 5), 8) > 0.7 ? 2.4 : 0)) * Math.min(1, open) * (onShelf ? 0.7 : 1);
      if (th > 1.5) spruce(x + hash(Math.floor(x), 2), th, 1 + hash(Math.floor(x), 4) * 0.6, onShelf ? shoreTop(x) - 0.4 : WL + 0.3, onShelf ? solid : null);
    }
    x += 2 + 2.2 * h;
  }

  // The cabin: red boards, a snowed roof, two warm panes, a door, a chimney.
  const eave = cabBase - 7;
  const roofTop = eave - 8;
  const CHIM = CAB[1] - 5, CHIM_TOP = eave - 8.5;
  for (let r = 0; r < WL; r++) {
    for (let x = CAB[0] - 3; x <= CAB[1] + 3; x++) {
      const k = r * W + x;
      const y = r + 0.5;
      const cx = (CAB[0] + CAB[1] + 1) / 2;
      if (x >= CAB[0] && x <= CAB[1] && y >= eave && y < cabBase + 0.5) {
        mat[k] = WALL;
        const boards = r & 1 ? 0.82 : 1;
        const s = (0.5 + 0.5 * ((CAB[1] - x) / (CAB[1] - CAB[0]))) * boards;
        sr[k] = 0.7 * s, sg[k] = 0.14 * s, sb[k] = 0.11 * s;
        rim[k] = 0;
        for (const [a, b] of PANES) if (x >= a && x <= b && y >= eave + 1.5 && y < cabBase - 2) mat[k] = PANE;
        if (x >= DOOR_X[0] && x <= DOOR_X[1] && y >= eave + 1.5) {
          mat[k] = DOOR;
          sr[k] = 0.16, sg[k] = 0.06, sb[k] = 0.05;
        }
      }
      const half = 12.5 - (eave - y) * 1.45;
      if (y >= roofTop && y < eave && Math.abs(x + 0.5 - cx) <= half) {
        mat[k] = ROOF;
        const snowy = y < eave - 1;
        const s = 0.78 + 0.22 * ((cx - x - 0.5) / 12);
        if (snowy) (sr[k] = 0.78 * s), (sg[k] = 0.84 * s), (sb[k] = 0.96 * s);
        else (sr[k] = 0.12), (sg[k] = 0.05), (sb[k] = 0.06);
        rec[k] = snowy ? 0.5 : 0;
        rim[k] = 0;
      }
      if (x >= CHIM && x <= CHIM + 1 && y >= CHIM_TOP && y < eave - 4) {
        mat[k] = WALL;
        const s = x === CHIM ? 1 : 0.55;
        sr[k] = 0.2 * s, sg[k] = 0.21 * s, sb[k] = 0.27 * s;
        rim[k] = 0;
      }
    }
  }

  // a few spruce on the shelf, beside the cabin
  for (const [tx, th] of [[134, 7], [137.8, 10], [166.5, 9], [170, 6], [174.5, 8]]) {
    spruce(tx, th, 2.2, shoreTop(tx) + 0.5, (k) => mat[k] === WALL || mat[k] === ROOF || mat[k] === PANE || mat[k] === DOOR);
  }

  // the warm light the panes throw on the snow and the air around them
  const lampLand = new Float32Array(WL * W);
  for (let r = 0; r < WL; r++) {
    for (let x = 0; x < W; x++) {
      const k = r * W + x, m = mat[k];
      if (m === PANE || m === WALL || m === ROOF || m === DOOR) continue;
      let g = 0;
      for (const [lx, s] of LAMPS) {
        const wx = x + 0.5 - lx, wy = r + 0.5 - (cabBase - 2.5);
        const d = Math.sqrt(wx * wx * 0.6 + wy * wy * 2.2);
        g += s * Math.exp(-d / 5.5) * 0.6;
      }
      lampLand[k] = g * (m === AIR ? 0.3 : m === TREE ? 0.4 : 0.75 + 0.5 * hash(x, r + 31));
    }
  }

  // the sky's unevenness and its stars
  const haze = new Float32Array(WL * W);
  for (let k = 0; k < WL * W; k++) haze[k] = fbm((k % W) * 0.04, Math.floor(k / W) * 0.07, 3);
  const star = new Float32Array(WL * W);
  for (let k = 0; k < WL * W; k++) {
    const h = hash(k % W, Math.floor(k / W) + 101);
    if (h > 0.986) star[k] = 0.35 + (h - 0.986) * 45;
  }
  // rows of the water that break the reflection into strips
  const gap = new Uint8Array(H);
  for (let r = WL; r < H; r++) gap[r] = hash(r, 404) < 0.3 ? 1 : 0;

  // per-column aurora state, filled each frame
  const baseA = new Float32Array(W), tallA = new Float32Array(W), envA = new Float32Array(W);
  const baseB = new Float32Array(W), envB = new Float32Array(W);
  const RAYS = 4 * W;
  const raysA = new Float32Array(RAYS + 2), raysB = new Float32Array(RAYS + 2);
  const R = new Float32Array(WL * W), G = new Float32Array(WL * W), B = new Float32Array(WL * W);
  const lightX = new Float32Array(W); // the aurora's light falling on the land below

  const ray = (arr              , u        ) => {
    const s = u * 4;
    let i = Math.floor(s);
    const f = s - i;
    i = ((i % RAYS) + RAYS) % RAYS;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  };

  return (t, { color } = {}) => {
    // --- the curtains -------------------------------------------------------
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // the main curtain sweeps down from the upper left, low over the fjord,
      // and lifts again to the right; ripples travel along it and fold it
      baseA[x] = 5 + 40 * Math.pow(Math.sin(Math.min(1, u / 0.6) * Math.PI / 2), 1.5) - 13 * smooth(0.6, 0.95, u)
        + 2.6 * Math.sin(x * 0.07 - t * 0.55) + 1.4 * Math.sin(x * 0.17 + t * 0.9 + 1.3) + 2.2 * Math.sin(x * 0.22 + t * 1.2)
        + 4 * (fbm(x * 0.015 + t * 0.03, 4.2, 2) - 0.5);
      tallA[x] = 11 + 8 * fbm(x * 0.03 - t * 0.05, 1.7, 2);
      envA[x] = smooth(0.0, 0.2, u) * smooth(0.98, 0.72, u) * (0.4 + 0.8 * fbm(x * 0.022 - t * 0.07, 8.8, 3));
      // a fainter curtain behind, higher up, on the right
      baseB[x] = 14 + 4 * Math.sin(x * 0.035 + t * 0.3 + 2) + 1.6 * Math.sin(x * 0.11 - t * 0.7);
      envB[x] = smooth(0.45, 0.7, u) * smooth(1.05, 0.85, u) * (0.25 + 0.5 * fbm(x * 0.03 + t * 0.05, 3.3, 2));
    }
    for (let i = 0; i <= RAYS + 1; i++) {
      const u = i / 4;
      raysA[i] = 0.14 + Math.pow(fbm(u * 0.6 + t * 0.35, t * 0.12, 3), 2.4) * 2.5;
      raysB[i] = 0.1 + Math.pow(fbm(u * 0.45 - t * 0.2, 5 + t * 0.1, 3), 2.2) * 2.0;
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let d = -24; d <= 24; d += 6) {
        const xx = Math.min(W - 1, Math.max(0, x + d));
        s += envA[xx] + 0.4 * envB[xx];
      }
      lightX[x] = s / 9;
    }
    const flick = 0.92 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 7.1);

    // --- sky and land ---------------------------------------------------------
    for (let r = 0; r < WL; r++) {
      const y = r + 0.5;
      const v = y / WL;
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        const m = mat[k];
        let cr        , cg        , cb        ;
        if (m === AIR) {
          const hz = 0.85 + 0.3 * haze[k];
          cr = (0.025 + 0.03 * v * v) * hz;
          cg = (0.04 + 0.07 * v * v) * hz;
          cb = (0.1 + 0.11 * v * v) * hz;
          // curtain A: a sharp lower hem, rays rising and fading to violet
          let a = 0;
          const d = baseA[x] - y;
          if (d > -4 && d < 46) {
            const bend = Math.abs(baseA[Math.min(W - 1, x + 1)] - baseA[Math.max(0, x - 1)]);
            const hc = tallA[x];
            const lean = ray(raysA, x + d * 0.22);
            const prof = d < 0 ? Math.exp(-d * d * 0.9) : (1 - Math.exp(-(d + 0.4) * 1.1)) * Math.exp(-d / hc);
            // the rays, over a continuous bright band along the hem
            const band = d < 0 ? Math.exp(-d * d) : Math.exp(-d / 3);
            a = (prof * lean + 0.3 * band * (0.55 + 0.45 * Math.min(1.4, lean))) * envA[x] * (1.15 + 0.35 * bend);
            const up = clamp(d / (hc * 1.6));
            const gk = 1 - smooth(0, 0.5, up), vk = smooth(0.4, 0.9, up);
            const tk = 1 - gk - vk;
            cr += a * (0.18 * gk + 0.06 * tk + 0.42 * vk);
            cg += a * (1.0 * gk + 0.78 * tk + 0.16 * vk);
            cb += a * (0.48 * gk + 0.7 * tk + 0.75 * vk);
            // pink at the very hem where it is brightest
            const hem = Math.exp(-((d + 0.6) ** 2) * 1.2) * smooth(0.3, 0.8, a) * 0.8 * (0.45 + 0.55 * Math.min(1, lean));
            cr += hem * 0.95, cg *= 1 - 0.55 * Math.min(1, hem * 1.6), cb += hem * 0.4;
          }
          // curtain B, further away, thinning out toward the top of the frame
          const db = baseB[x] - y;
          if (db > -3 && db < 30) {
            const prof = db < 0 ? Math.exp(-db * db) : (1 - Math.exp(-(db + 0.4))) * Math.exp(-db / 9);
            const b = prof * ray(raysB, x + db * 0.18) * envB[x] * 0.85 * smooth(0, 8, y);
            const up = clamp(db / 12);
            cr += b * (0.1 + 0.4 * up);
            cg += b * (0.75 - 0.5 * up);
            cb += b * (0.7 + 0.2 * up);
            a += b;
          }
          // a little glow round the curtain, kept tight under the hem so the
          // hem reads as an edge over dark sky
          const below = y - baseA[x];
          const gl = envA[x] * (below > 0 ? Math.exp(-below / 6) * 0.1 : Math.exp(below / 8) * 0.18);
          cr += gl * 0.12, cg += gl * 0.62, cb += gl * 0.52;
          // airglow on the horizon
          const ag = Math.exp(-(WL - y) / 10) * (0.1 + 0.16 * lightX[x]);
          cg += ag * 0.7, cb += ag * 0.75, cr += ag * 0.2;
          const st = star[k];
          if (st > 0) {
            const tw = 0.7 + 0.3 * Math.sin(t * (1.3 + 3 * hash(x, r)) + 6.28 * hash(r, x));
            const s = st * tw * clamp(1 - a * 1.6) * smooth(WL - 2, 30, y);
            cr = Math.max(cr, s * 0.9), cg = Math.max(cg, s * 0.94), cb = Math.max(cb, s);
          }
        } else {
          cr = sr[k], cg = sg[k], cb = sb[k];
          const L = lightX[x] * rec[k];
          cr += L * 0.03, cg += L * 0.14, cb += L * 0.1;
          const e = rim[k];
          if (e > 0) {
            const q = e * (m === TREE ? 0.2 + 0.45 * lightX[x] : 0.05 + 0.22 * lightX[x]);
            cr += q * 0.25, cg += q * 0.95, cb += q * 0.7;
          }
          if (m === PANE) {
            const f = flick + 0.04 * Math.sin(t * 5.3 + x);
            cr = f, cg = 0.76 * f, cb = 0.38 * f;
          } else if (m === DOOR) {
            // light through the crack of the door
            if (x === DOOR_X[1] && r > eave + 1) (cr = 0.55 * flick), (cg = 0.36 * flick), (cb = 0.14 * flick);
          }
        }
        const lg = lampLand[k] * flick;
        if (lg > 0) cr += lg, cg += lg * 0.62, cb += lg * 0.26;
        R[k] = cr, G[k] = cg, B[k] = cb;
      }
    }

    for (let r = 0; r < H; r++) {
      const y = r + 0.5;
      let floor = 0.1, fade = 1;
      const dw = y - WL;
      const deep = r >= WL ? mix(1, 0.45, dw / (H - WL)) : 1;
      const ry = WL - 1 - (r - WL) - Math.round(0.4 * Math.sin(r * 0.9 + t * 0.6));
      const r0 = Math.max(0, ry) * W, r1 = Math.max(0, ry - 1) * W, r2 = Math.max(0, ry - 2) * W;
      for (let x = 0; x < W; x++) {
        const k = r * W + x;
        let cr        , cg        , cb        ;
        if (r < WL) {
          cr = R[k], cg = G[k], cb = B[k];
          const m = mat[k];
          floor = m === AIR ? 0.1 : m === NEAR ? 0.05 : m === TREE ? 0.04 : 0.06;
        } else {
          // still water: the mirror image, stretched and broken by slow ripples
          const wave = noise(x * 0.04 + t * 0.05, r * 0.55 - t * 0.35);
          const sx = x + (0.5 + dw * 0.12) * Math.sin(r * 1.3 + t * 1.6 + wave * 4);
          let ix = Math.floor(sx);
          const fx = sx - ix;
          ix = Math.max(0, Math.min(W - 2, ix));
          const a0 = r0 + ix, a1 = r1 + ix, a2 = r2 + ix;
          const sky = mat[a0] === AIR;
          let kr = (sky ? 0.55 : 0.64) * (0.82 + 0.3 * wave) * deep;
          if (sky && gap[r] && wave < 0.45) kr *= 0.12;
          // the cabin's own image is soft; the lamplight road below carries it
          const ms = mat[a0];
          if (ms === PANE) kr *= 0.4;
          else if (ms === WALL || ms === ROOF || ms === DOOR) kr *= 0.7;
          const gx = 1 - fx;
          cr = ((R[a0] * gx + R[a0 + 1] * fx) * 0.5 + (R[a1] * gx + R[a1 + 1] * fx) * 0.3 + (R[a2] * gx + R[a2 + 1] * fx) * 0.2) * kr;
          cg = ((G[a0] * gx + G[a0 + 1] * fx) * 0.5 + (G[a1] * gx + G[a1 + 1] * fx) * 0.3 + (G[a2] * gx + G[a2 + 1] * fx) * 0.2) * kr;
          cb = ((B[a0] * gx + B[a0 + 1] * fx) * 0.5 + (B[a1] * gx + B[a1 + 1] * fx) * 0.3 + (B[a2] * gx + B[a2 + 1] * fx) * 0.2) * kr;
          if (ms !== WALL && ms !== DOOR) cr += 0.02, cg += 0.035, cb += 0.065;
          // a pale line where the water meets the shore
          if (r === WL) {
            const e = 0.3 * (0.3 + 0.7 * smooth(0.25, 0.75, noise(x * 0.3, t * 0.4)));
            cr += e * 0.6, cg += e * 0.85, cb += e;
          }
          // the lamplight laid on the water as a broken golden road
          if (dw < 14 && x > 138 && x < 166) {
            const rip = noise(x * 0.5 - t * 0.2, r * 1.4 - t * 1.5);
            for (const [lx, s] of LAMPS) {
              const lw = 1 + dw * 0.1;
              const q = (x + 0.5 - lx) / lw;
              const g = Math.exp(-q * q) * Math.exp(-dw / 8) * smooth(0.3, 0.65, rip) * s * 1.6 * flick;
              cr += g, cg += g * 0.68, cb += g * 0.28;
            }
          }
          floor = sky ? 0.07 * deep : 0.03;
          fade = smooth(H + 3, H - 12, y);
        }
        const peak = Math.max(cr, cg, cb, 1e-4);
        const level = clamp(floor + (1 - floor) * Math.pow(peak, 0.85) * 0.95) * fade;
        const step = Math.max(0, Math.min(3, Math.round(level * 3 + BAYER[(r & 3) * 4 + (x & 3)])));
        out[k] = DOTS[step];
        if (color) {
          const want = step ? Math.min(1, (level + 0.06) / COVER[step]) : 0;
          const s = (0.3 + 0.7 * want) / peak;
          color[k] = nearest(clamp(cr * s), clamp(cg * s), clamp(cb * s));
        }
      }
    }
    const lines           = [];
    for (let r = 0; r < H; r++) lines.push(out.slice(r * W, (r + 1) * W).join(""));
    return lines.join("\n");
  };
}



const frame=auroraFjord(),colors=new Uint8Array(W*H);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let timer=null,elapsed=0,previous=0,interval=100,resizeTimer;
let scale=1,offsetX=0,offsetY=0;
function fit(){const width=innerWidth,height=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);scale=Math.max(width/W,height/H);offsetX=(width-W*scale)*(width<600?.65:.5);offsetY=(height-H*scale)/2;}
function paint(){const begin=performance.now();const rows=frame(elapsed/1000,{color:colors}).split('\n');const paths=Array.from({length:meta.palette.length},()=>new Path2D());
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const level=DOTS.indexOf(rows[y][x]);if(level<1)continue;const radius=[0,.12,.23,.37][level]*scale;const px=offsetX+(x+.5)*scale,py=offsetY+(y+.5)*scale;if(px+radius<0||px-radius>innerWidth||py+radius<0||py-radius>innerHeight)continue;const path=paths[colors[y*W+x]];path.moveTo(px+radius,py);path.arc(px,py,radius,0,Math.PI*2);}
ctx.clearRect(0,0,innerWidth,innerHeight);for(let i=0;i<paths.length;i++){ctx.fillStyle=meta.palette[i];ctx.fill(paths[i]);}
// Lower update frequency on devices that need more time for a frame.
if(performance.now()-begin>35)interval=167;
}
function tick(){timer=null;if(document.hidden||reduced.matches)return;const now=performance.now();elapsed+=Math.min(now-previous,250);previous=now;paint();timer=setTimeout(tick,interval);}
function resume(){clearTimeout(timer);timer=null;previous=performance.now();if(!document.hidden&&!reduced.matches)timer=setTimeout(tick,interval);}
document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',()=>{if(reduced.matches){elapsed=0;paint()}resume()});
addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{fit();paint()},180)});fit();paint();resume();

})();
