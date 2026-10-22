function checkExportSession(epoch){if(epoch!==blogState.epoch)throw Error('계정이 변경되어 내보내기를 중단했습니다.')}
function fileName(title){return (String(title).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim().slice(0,100)||'papershelf')}
function downloadFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportMarkdown(entry){
  const epoch=blogState.epoch;let body=entry.body;const all=new Set([...entry.images,...photoRefs(body)]);
  for(const id of all){const blob=await photoGet(id);if(!blob)throw Error('사진을 찾지 못했습니다.');const data=await toDataURL(blob);checkExportSession(epoch);if(photoRefs(body).includes(id))body=body.split(`](photo:${id})`).join(`](${data})`);else body+=`\n\n![사진](${data})`}
  const metadata=['---',`title: ${JSON.stringify(entry.title)}`,`date: ${entry.date}`,`topics: ${JSON.stringify(entry.topics)}`,'---',''];
  const text=metadata.join('\n')+`\n# ${entry.title}\n\n`+body+(entry.url?`\n\n[링크](${safeUrl(entry.url)})`:'')+'\n';
  checkExportSession(epoch);downloadFile(new Blob([text],{type:'text/markdown;charset=utf-8'}),fileName(entry.title)+'.md');
}
let printing=false;
async function exportPDF(entry){
  if(printing)return;printing=true;
  const epoch=blogState.epoch;let frame;
  try{
    const prose=document.createElement('div');prose.className='prose';prose.innerHTML=renderMarkdown(entry.body);
    for(const id of entry.images.filter(id=>!photoRefs(entry.body).includes(id))){const img=document.createElement('img');img.dataset.photo=id;img.alt='사진';prose.append(img)}
    await hydrateIn(prose);checkExportSession(epoch);
    const fonts=[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].filter(rule=>rule.type===CSSRule.FONT_FACE_RULE).map(rule=>rule.cssText)}catch{return []}}).join('\n');
    const printCSS=`${fonts}\n@page{size:A4;margin:18mm}*{box-sizing:border-box}body{color:#17211e;background:white;font:11pt/1.9 Galmuri,monospace;margin:0}header{margin-bottom:25px;padding-bottom:16px;border-bottom:1px solid #bfc9c2}h1{font:700 23pt/1.6 Galmuri,monospace;margin:0 0 8px;overflow-wrap:anywhere}.meta{font-size:9pt;color:#586b62}a{color:#304e43;overflow-wrap:anywhere}p{margin:0 0 1em}h2,h3,h4{break-after:avoid}img{display:block;max-width:100%;max-height:235mm;object-fit:contain;margin:12px 0;break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f4f1;border:1px solid #d5ded6;padding:12px;font:9pt/1.6 monospace}pre code{font:inherit}.code-bar{display:none}code{font-family:monospace}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #bbc9bf;padding:6px;text-align:left}blockquote{margin-left:0;padding-left:14px;border-left:2px solid #829d8c;color:#405b4c}ul,ol{padding-left:24px}`;
    document.querySelector('#print-frame')?.remove();
    frame=document.createElement('iframe');frame.id='print-frame';frame.title=entry.title;frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-200vw;top:0;width:794px;height:1123px;border:0;pointer-events:none';document.body.append(frame);
    const doc=frame.contentDocument;doc.open();doc.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHTML(fileName(entry.title))}</title><style>${printCSS}</style></head><body><header><h1>${escapeHTML(entry.title)}</h1><div class="meta">${escapeHTML(entry.date)}${entry.topics.length?' · '+entry.topics.map(escapeHTML).join(' / '):''}</div></header><main>${prose.innerHTML}${entry.url?`<p><a href="${escapeHTML(safeUrl(entry.url))}">${escapeHTML(safeUrl(entry.url))}</a></p>`:''}</main></body></html>`);doc.close();
    await Promise.all([doc.fonts.ready,...[...doc.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=img.onerror=resolve;setTimeout(resolve,5000)}))]);
    await new Promise(resolve=>setTimeout(resolve,100));
    checkExportSession(epoch);if(!frame.isConnected)throw Error('내보내기가 취소되었습니다.');frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.focus();frame.contentWindow.print();
  }catch(error){frame?.remove();throw error}finally{printing=false}
}
