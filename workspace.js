const sourceNames = {1: 'Mermer Foods', 2: 'Malatq Pazari'};
const $=id=>document.getElementById(id);
const icons={mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',layers:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',chat:'<path d="M4 4h16v12H9l-5 4z"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',table:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M10 9v12"/>',link:'<path d="m10 14 4-4m-6 3-1 1a3 3 0 0 0 4 4l3-3m2-4 1-1a3 3 0 0 0-4-4l-3 3"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',refresh:'<path d="M20 10a8 8 0 1 0-1 7m1-13v6h-6"/>',clip:'<path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9"/>'};
for(const i of document.querySelectorAll('[data-icon]'))i.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[i.dataset.icon]+'</svg>';
const host='https://replydesk-alex-okan.alexvenmil.chatgpt.site/api/desk';
const valid=k=>/^[0-9a-f]{64}$/.test(k||'');
const incoming=new URLSearchParams(location.hash.slice(1)).get('room');
const saved=localStorage.getItem('replydesk.room');
const room=valid(incoming)?incoming:valid(saved)?saved:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
localStorage.setItem('replydesk.room',room);
const invite=new URL(location.href);invite.hash='room='+room;
history.replaceState(null,'',invite);
const sessionKey='replydesk.profile.'+room;
let account={};try{account=JSON.parse(localStorage.getItem(sessionKey)||'{}')}catch{}
const savedProfileKey=name=>sessionKey+'.trusted.'+name;
if(['Alex','Okan'].includes(account.name)&&valid(account.key))localStorage.setItem(savedProfileKey(account.name),account.key);
function remembered(name){const key=localStorage.getItem(savedProfileKey(name));return valid(key)?key:null}
let author=valid(account.key)?account.name:'',items=[],sources=[],filter='all',source=0,active='',revision=0,loadVersion=0,messageStamp='',pending=null,busy=false;
const drafts=new Map(),urls=new Set(),ids=new WeakMap();
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text||'';if(cls)e.className=cls;return e}
function identity(){ $('initial').textContent=author?author[0].toUpperCase():'•';$('rename').textContent=author||'Твоето име';}
let registered=[],profileLoaded=false;
async function deriveKey(name,password){
  const enc=new TextEncoder();
  const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode('Replydesk:'+room+':'+name),iterations:310000},material,256);
  return Array.from(new Uint8Array(bits),n=>n.toString(16).padStart(2,'0')).join('');
}
function profileHint(){
 const name=$('name').value,exists=registered.includes(name),password=$('personalPassword');
 const trusted=Boolean(remembered(name));
 password.closest('label').hidden=!profileLoaded||!name||trusted;
 password.disabled=trusted||!name;password.required=Boolean(name)&&!trusted;
 $('changePass').hidden=!trusted||name!==author||!profileLoaded||!name;
 password.minLength=1;password.autocomplete=exists?'current-password':'new-password';
 $('profileHelp').textContent=!profileLoaded?'Проверяване на профилите…':!name?'Избери личния си профил.':trusted?'Профилът е запомнен в този браузър.':exists?'Отключи профила еднократно за този браузър.':'Първо активиране. Създай своя парола от точно 4 символа.';
 $('unlock').disabled=!profileLoaded||!name;
 $('unlock').textContent=trusted?'Избери профила':exists?'Отключи':'Активирай профила';
}
async function openProfile(fn){
 pending=fn;profileLoaded=false;$('name').value=author||'';$('personalPassword').value='';$('profileError').textContent='';profileHint();$('identity').showModal();
 try{registered=await api('?profiles=1');profileLoaded=true;profileHint()}catch(e){$('profileError').textContent=e.message}
}
function named(fn){if(author&&valid(account.key))return fn();openProfile(fn)}
$('rename').onclick=()=>openProfile(null);$('name').onchange=()=>{profileHint();if(profileLoaded&&remembered($('name').value))$('nameForm').requestSubmit()};
$('nameForm').onsubmit=async e=>{
 e.preventDefault();const name=$('name').value,password=$('personalPassword').value;
 if(!profileLoaded||!['Alex','Okan'].includes(name))return;
 $('unlock').disabled=true;
 try{
  let key=remembered(name);
  if(!key){
  if(!registered.includes(name)&&[...password].length!==4)throw Error('Паролата трябва да е точно 4 символа.');
  key=await deriveKey(name,password);
  }
  const data=new FormData();data.set('op','profile');data.set('name',name);data.set('profileKey',key);data.set('setup',registered.includes(name)?'0':'1');
  await api('',data);localStorage.setItem(savedProfileKey(name),key);account={name,key};author=name;localStorage.setItem(sessionKey,JSON.stringify(account));identity();messageStamp='';$('personalPassword').value='';$('identity').close();
  const fn=pending;pending=null;await refresh();fn?.();
 }catch(err){$('profileError').textContent=err.message;registered=await api('?profiles=1').catch(()=>registered)}
 finally{profileHint()}
};
$('share').onclick=()=>{$('invite').value=invite.href;$('copied').textContent='';$('sharing').showModal()};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(invite.href);$('copied').textContent='Линкът е копиран.'}catch{$('invite').select();$('copied').textContent='Копирай избрания линк.'}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
async function api(query='',form=null,binary=false){
 if(form&&!form.has('profileKey')&&account.key)form.set('profileKey',account.key);
 const r=await fetch(host+query,{method:form?'POST':'GET',headers:{'x-room':room},body:form,cache:'no-store',credentials:'omit'});
 if(r.status===401){
  const name=form?.get('name')||account.name;
  if(remembered(name)===form?.get('profileKey'))localStorage.removeItem(savedProfileKey(name));
  if(account.key===form?.get('profileKey')){author='';account={};localStorage.removeItem(sessionKey);identity()}
 }
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'Грешка при връзката ('+r.status+'). Опитай отново.')}
 return binary?r.blob():r.json();
}
function date(v){return new Date(v).toLocaleString('bg-BG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function mailLabels(thread) {
 const labels=node('span','','mail-labels');
 const company=node('span',sourceNames[thread.source],'company-badge');
 company.classList.add(Number(thread.source)===1?'company-mermer':'company-malatq');
 labels.append(company,node('small',thread.done?'✓ Готово':'За обсъждане'));
 return labels;
}
function paint(){
 const shown=items.filter(t=>(!source||t.source===source)&&(filter==='all'||Boolean(t.done)===(filter==='done'))&&(t.lead+' '+t.title).toLowerCase().includes($('search').value.trim().toLowerCase()));
 for(const [k,n] of [['all',items.length],['open',items.filter(t=>!t.done).length],['done',items.filter(t=>t.done).length]])$('n-'+k).textContent=n;
 for(const b of document.querySelectorAll('[data-filter]'))b.classList.toggle('active',!source&&b.dataset.filter===filter);
 for(const b of document.querySelectorAll('[data-source]'))b.classList.toggle('active',Number(b.dataset.source)===source);
 $('listTitle').textContent=source?sourceNames[source]:({all:'Всички имейли',open:'За обсъждане',done:'Готови'})[filter];
 $('total').textContent=shown.length;$('sheet').hidden=!(source&&sources[source-1]);if(!$('sheet').hidden)$('sheet').href=sources[source-1];
 $('list').replaceChildren(...shown.map(t=>{const b=node('button','','item');b.classList.toggle('active',t.id===active);b.append(mailLabels(t),node('b',t.title),node('small',t.lead+' · '+date(t.updated)));b.onclick=()=>select(t.id).catch(report);return b}));
 if(!shown.length)$('list').append(node('p',items.length?'Няма имейли за този избор.':'Още няма имейли. Добави първия от „Нов имейл“.','listEmpty'));
 const t=items.find(t=>t.id===active);$('thread').hidden=!t;$('empty').hidden=!!t;
 $('edit').hidden=!t||Boolean(t.done);
 if(t){$('subject').textContent=t.title;$('tag').replaceChildren(mailLabels(t));$('lead').textContent=t.lead+(t.rownum?' · ред '+t.rownum:'');$('done').textContent=t.done?'Върни за обсъждане':'✓ Готово'}
}
function report(e){$('status').textContent=e.message||'Връзката прекъсна. Натисни „Обнови“.'}

function currentMail(text) {
 return text.normalize('NFKC').replace(/[\u200b-\u200d]/g,'').split(/^\s*(?:-{2,}\s*(?:original message|forwarded message|първоначално съобщение)|On .{3,180} wrote:|На .{3,180} написа:)/im)[0].split('\n').filter(line=>!line.trimStart().startsWith('>')).join('\n');
}
function screenshotSubject(text) {
 const topics=[
  [/minimum order|\bmoq\b|минимална поръчка/i,'Минимална поръчка'],
  [/not interested|нямаме интерес|не проявяваме интерес/i,'Отказ от предложение'],
  [/price list|pricing|prices?|quotation|ценова оферта|ценова листа|цени|fiyat/i,'Запитване за цени'],
  [/samples?|мостри|numune/i,'Запитване за мостри'],
  [/catalog|каталог|katalog/i,'Продуктов каталог'],
  [/delivery|shipping|доставка|teslimat/i,'Условия за доставка'],
  [/payment terms|условия за плащане/i,'Условия за плащане'],
  [/distribut|дистриб/i,'Обсъждане на дистрибуция'],
  [/appointment|meeting|среща/i,'Уговаряне на среща'],
  [/partnership|collaborat|партньорство|cooperation/i,'Предложение за партньорство']
 ];
 const lines=currentMail(text).split('\n').map(line=>line.trim()).filter(Boolean);
 const header=/^(?:subject|тема|относно|betreff|konu|objet|asunto)\s*[:：\-]\s*/iu;
 const at=lines.findIndex(line=>header.test(line));
 const subject=at<0?'':(lines[at].replace(header,'')||lines[at+1]||'').replace(/^(?:(?:re|fw|fwd|отг|aw)\s*:\s*)+/i,'');
 const body=lines.filter(line=>!header.test(line)&&!/@|^(?:from|to|cc|от|до|sent|date)\s*:/i.test(line));
 const topic=line=>topics.find(([pattern])=>pattern.test(line))?.[1];
 const request=body.find(line=>/please|could you|would like|interested|моля|бихме|може ли|искаме/i.test(line)&&topic(line));
 const words=subject.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)||[];
 return topic(subject)||(request&&topic(request))||(words.length>=2&&words.slice(0,3).join(' '))||topic(body.join(' '))||'';
}
function screenshotCountry(text) {
 const codes = 'AW AF AO AI AX AL AD AE AR AM AS AQ TF AG AU AT AZ BI BE BJ BQ BF BD BG BH BS BA BL BY BZ BM BO BR BB BN BT BV BW CF CA CC CH CL CN CI CM CD CG CK CO KM CV CR CU CW CX KY CY CZ DE DJ DM DK DO DZ EC EG ER EH ES EE ET FI FJ FK FR FO FM GA GB GE GG GH GI GN GP GM GW GQ GR GD GL GT GF GU GY HK HM HN HR HT HU ID IM IN IO IE IR IQ IS IL IT JM JE JO JP KZ KE KG KH KI KN KR KW LA LB LR LY LC LI LK LS LT LU LV MO MF MA MC MD MG MV MX MH MK ML MT MM ME MN MP MZ MR MS MQ MU MW MY YT NA NC NE NF NG NI NU NL NO NP NR NZ OM PK PA PN PE PH PW PG PL PR KP PT PY PS PF QA RE RO RU RW SA SD SN SG GS SH SJ SB SL SV SM SO PM RS SS ST SR SK SI SE SZ SX SC SY TC TD TG TH TJ TK TM TL TO TT TN TR TV TW TZ UG UA UM UY US UZ VA VC VE VG VI VN VU WF WS YE ZA ZM ZW'.split(' ');
 const bg=new Intl.DisplayNames(['bg'],{type:'region'});
 const en=new Intl.DisplayNames(['en'],{type:'region'});
 const aliases={GB:['uk','great britain'],US:['usa','united states of america'],TR:['turkey','türkiye'],AE:['uae'],DE:['deutschland'],FR:['république française'],ES:['españa'],IT:['italia'],NL:['nederland'],GR:['hellas','ελλάδα'],PL:['polska'],RO:['românia']};
 const normalize=s=>s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const scores=new Map();
 const record=(code,score)=>scores.set(code,Math.max(score,scores.get(code)||0));
 for(const line of currentMail(text).split('\n')){
  if(/^\s*(?:to|до|cc|bcc|subject|тема|относно)\s*:/i.test(line))continue;
  const sender=/^\s*(?:from|от|sender|подател|von|kimden)\s*:/i.test(line);
  const location=/(?:address|country|based in|registered office|located in|адрес|държава|седалище)\s*[:\s]/i.test(line);
  const normalized=' '+normalize(line)+' ';
  for(const code of codes){
   if([bg.of(code),en.of(code),...(aliases[code]||[])].some(name=>normalized.includes(' '+normalize(name)+' ')))record(code,location?5:sender?4:2);
  }
  for(const match of line.matchAll(/@[\w.-]+\.([a-z]{2})\b/gi)){
   const suffix=match[1].toUpperCase(),code=suffix==='UK'?'GB':suffix;
   if(codes.includes(code)&&!['IO','AI','CO','ME','TV','CC'].includes(code))record(code,sender?4:1);
  }
 }
 const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
 return ranked.length&&ranked[0][1]!==ranked[1]?.[1]?bg.of(ranked[0][0]):'';
}
let libraryLoad;
function loadReader() {
 if(!libraryLoad)libraryLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.integrity='sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
  script.crossOrigin='anonymous';
  script.onload=()=>resolve(window.Tesseract);
  script.onerror=()=>{libraryLoad=null;script.remove();reject(Error('OCR'))};
  document.head.append(script);
 });
 return libraryLoad;
}
async function prepareScreenshot(file) {
 if(typeof createImageBitmap!=='function')return file;
 let image;
 try{
  image=await createImageBitmap(file);
  const scale=Math.min(2,3200/image.width,4000/image.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=pixels.data;
  let dark=0,total=0;
  for(let i=0;i<data.length;i+=4*131){if((data[i]+data[i+1]+data[i+2])/3<100)dark++;total++}
  const invert=dark>total*.6;
  for(let i=0;i<data.length;i+=4){
   const gray=.299*data[i]+.587*data[i+1]+.114*data[i+2];
   data[i]=data[i+1]=data[i+2]=((invert?255-gray:gray)-128)*1.22+128;
  }
  ctx.putImageData(pixels,0,0);
  return canvas;
 }catch{return file}finally{image?.close()}
}
const suggestedValues=new WeakMap();
function updateSuggestion(input,value){
 if(!input.value.trim()||input.value===suggestedValues.get(input)){
  input.value=value;
  suggestedValues.set(input,value);
 }
}
let scanNumber=0;
async function suggestFromScreenshot(form) {
 const number=++scanNumber;
 const status=$('scanStatus');
 status.textContent='';
 const file=Array.from(form.elements.files.files).reverse().find(f=>f.type.startsWith('image/'));
 updateSuggestion(form.elements.title,'');
 updateSuggestion(form.elements.lead,'');
 if(!file||file.size>20*1024*1024)return;
 status.textContent='Разпознаване на текста от снимката…';
 let reader;
 try {
  const lib=await loadReader();
  if(scanNumber!==number)return;
  let onFailure;
  const failure=new Promise((_,reject)=>{onFailure=reject});
  reader=await Promise.race([lib.createWorker('eng+bul',1,{errorHandler:onFailure}),failure]);
  if(scanNumber!==number)return;
  const input=await prepareScreenshot(file);
  if(scanNumber!==number)return;
  let result=await Promise.race([reader.recognize(input),failure]);
  if(scanNumber!==number)return;
  if(result.data.confidence<60||result.data.text.trim().length<20){
   await reader.setParameters({tessedit_pageseg_mode:lib.PSM.SPARSE_TEXT});
   const retry=await Promise.race([reader.recognize(file),failure]);
   if(retry.data.text.trim()&&retry.data.confidence>=result.data.confidence)result=retry;
  }
  if(scanNumber!==number)return;
  const text=result.data.text;
  const {title,lead}=form.elements;
  updateSuggestion(title,screenshotSubject(text));
  updateSuggestion(lead,screenshotCountry(text));
  status.textContent=title.value&&lead.value?'Провери темата и държавата.':'Провери предложенията и попълни празните полета.';
 } catch {
  if(scanNumber===number)status.textContent='Снимката не беше разчетена. Въведи темата и държавата.';
 } finally {
  if(reader)await reader.terminate();
 }
}

let previewUrls=[];
function fileLabels(form){
 const list=form.querySelector('.chosen');
 const input=form.elements.files;
 const files=Array.from(input.files);
 if(form.id!=='create'){
  list.textContent=files.map(file=>file.name).join(', ');
  return;
 }
 list.replaceChildren();
 previewUrls.forEach(url=>URL.revokeObjectURL(url));
 previewUrls=[];
 files.forEach((file,index)=>{
  const row=node('span');
  row.style.cssText='display:flex;align-items:center;gap:.6rem;margin:.4rem 0';
  if(file.type.startsWith('image/')){
   const thumb=document.createElement('img');
   thumb.src=URL.createObjectURL(file);
   previewUrls.push(thumb.src);
   thumb.alt='';
   thumb.style.cssText='width:44px;height:44px;object-fit:cover;border-radius:5px';
   row.append(thumb);
  }
  const label=node('span',file.name);
  label.style.cssText='flex:1;overflow-wrap:anywhere;min-width:0';
  const remove=node('button','Премахни','light');
  remove.type='button';
  remove.setAttribute('aria-label','Премахни '+file.name);
  remove.onclick=()=>{
   if(busy)return;
   const remaining=new DataTransfer();
   files.forEach((item,i)=>{if(i!==index)remaining.items.add(item)});
   input.files=remaining.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  row.append(label,remove);
  list.append(row);
 });
}
function clearUrls(){for(const url of urls)URL.revokeObjectURL(url);urls.clear()}
async function select(id){
 if(active&&active!==id)drafts.set(active,{body:$('comment').value,files:$('reply').elements.files.files});
 if(active!==id){active=id;revision++;messageStamp='';$('history').replaceChildren();clearUrls();$('reply').reset();const d=drafts.get(id);if(d){$('comment').value=d.body;$('reply').elements.files.files=d.files}fileLabels($('reply'))}
 paint();if(id)await messages();
}
const audioFormats={wav:'audio/wav',webm:'audio/webm',ogg:'audio/ogg',mp4:'audio/mp4',m4a:'audio/mp4',mp3:'audio/mpeg'};
function audioAttachment(file,mime){
 const box=node('div','','voice-message'),label=node('small','Гласово съобщение'),player=node('audio'),retry=node('button','Зареди записа','light');
 box.append(label,player,retry);player.controls=true;player.preload='metadata';player.hidden=true;
 async function loadAudio(){
  retry.disabled=true;retry.textContent='Зареждане…';
  try{
   const data=await api('?file='+encodeURIComponent(file.key),null,true);if(!box.isConnected)return;
   const url=URL.createObjectURL(new Blob([data],{type:mime}));urls.add(url);player.src=url;player.hidden=false;retry.hidden=true;
   const link=node('a','Изтегли записа');link.href=url;link.download=file.name;box.append(link);
   player.onerror=()=>{label.textContent='Този формат не се възпроизвежда в браузъра. Можеш да изтеглиш записа.'};
  }catch{retry.textContent='Опитай отново'}finally{retry.disabled=false}
 }
 retry.onclick=loadAudio;
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();loadAudio()}});
  observer.observe(box);
 }
 return box;
}
function entry(m){
 const e=node('div','','entry');e.dataset.id=m.id;e.classList.toggle('own',!!author&&m.author.trim().toLowerCase()===author.toLowerCase());e.append(node('b',m.author),node('time',date(m.created)));if(m.body)e.append(node('p',m.body));
 if(e.classList.contains('own')){
  const menu=node('details','','message-menu'),toggle=node('summary','•••');toggle.setAttribute('aria-label','Опции за съобщението');
  const actions=node('div','','message-actions');for(const [op,label] of [['editMessage','Редактирай'],['removeMessage','Изтрий']]){
   const b=node('button',label);b.onclick=()=>{menu.open=false;showMessageForm(m,op)};actions.append(b);
  }
  menu.append(toggle,actions);e.prepend(menu);
 }
 for(const f of JSON.parse(m.files)){
  const audioMime=audioFormats[f.name.split('.').pop().toLowerCase()];
  if(audioMime){e.append(audioAttachment(f,audioMime));continue}
  const b=node('button',f.name.startsWith('voice-')?'▶ Гласово съобщение':'📎 '+f.name,'light');e.append(b);
  b.onclick=async()=>{b.disabled=true;const rev=revision;
   try{const blob=await api('?file='+encodeURIComponent(f.key),null,true);if(rev!==revision)return;
    const ext=f.name.split('.').pop().toLowerCase(),mime=({png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'})[ext];
    const url=URL.createObjectURL(new Blob([blob],{type:mime||'application/octet-stream'}));urls.add(url);
    if(mime){const zoom=node('button','','image-preview');zoom.title='Увеличи снимката';const img=node('img');img.alt=f.name;img.src=url;zoom.append(img);zoom.onclick=()=>showPhoto(url,f.name);e.append(zoom);showPhoto(url,f.name)}
    const a=node('a','Изтегли '+f.name);a.href=url;a.download=f.name;e.append(a);b.remove();if(!mime)a.click();
   }catch(err){report(err)}finally{b.disabled=false}
  };
 }
 return e;
}
let mVersion=0;
async function messages(){
 const ver=++mVersion,id=active;if(!id)return;const all=await api('?id='+id);if(active!==id||ver!==mVersion)return;
 const stamp=JSON.stringify([author,all.map(m=>[m.id,m.body])]);if(stamp===messageStamp)return;messageStamp=stamp;
 const rendered=new Map([...$('history').children].map(el=>[el.dataset.id,el]));
 for(const m of all){
  const old=rendered.get(m.id),signature=JSON.stringify([author,m.body]);rendered.delete(m.id);
  if(old?.dataset.signature===signature)continue;
  const el=entry(m);el.dataset.signature=signature;if(old)old.replaceWith(el);else $('history').append(el);
 }
 for(const el of rendered.values())el.remove();
}
let editingMessage=null;
function showMessageForm(m,op){
 editingMessage={m,op,thread:active};const del=op==='removeMessage';
 $('msgHeading').textContent=del?'Изтриване на съобщение':'Редактиране на съобщение';$('msgLabel').hidden=del;
 $('msgText').value=m.body;$('msgSave').textContent=del?'Изтрий за двама ни':'Запази';
 $('msgNote').textContent=del?'Съобщението и файловете му ще бъдат изтрити и за двама ви.':'';
 $('msgError').textContent='';$('messageDialog').showModal();
}
$('messageForm').onsubmit=async e=>{
 e.preventDefault();if(!editingMessage)return;
 const {m,op,thread}=editingMessage, data=new FormData();data.set('id',thread);data.set('mid',m.id);data.set('op',op);
 data.set('body',$('msgText').value.trim());data.set('original',m.body);
 $('msgSave').disabled=true;
 try{await api('',data);$('messageDialog').close();await refresh()}catch(err){$('msgError').textContent=err.message}finally{$('msgSave').disabled=false}
};
async function refresh(){const ver=++loadVersion;const all=await api();if(ver!==loadVersion)return;items=all;if(active&&!all.some(t=>t.id===active))await select('');paint();if(active)await messages();$('status').textContent=''}
function move(f,s){filter=f;source=s;select('').catch(report)}
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>move(b.dataset.filter,0);
for(const b of document.querySelectorAll('[data-source]'))b.onclick=()=>move('all',Number(b.dataset.source));
$('search').oninput=paint;$('refresh').onclick=()=>refresh().catch(report);
$('add').onclick=()=>{if(source)$('create').elements.source.value=source;$('composer').showModal()};
$('create').addEventListener('input',event=>suggestedValues.delete(event.target));
$('create').addEventListener('reset',()=>{scanNumber++;$('scanStatus').textContent=''});
for(const form of [$('create'),$('reply')]){
 const filesChanged=()=>{fileLabels(form);if(form.id==='create')suggestFromScreenshot(form)};
 form.elements.files.onchange=filesChanged;
 form.onpaste=e=>{const files=Array.from(e.clipboardData?.files||[]);if(!files.length)return;e.preventDefault();const dt=new DataTransfer();for(const f of [...form.elements.files.files,...files])dt.items.add(f);form.elements.files.files=dt.files;filesChanged()};
 form.onsubmit=e=>{e.preventDefault();named(async()=>{
  if(busy)return;const isNew=form.id==='create',fd=new FormData(form),error=form.querySelector('.error');error.textContent='';
  if(!String(fd.get('body')||'').trim()&&!form.elements.files.files.length){error.textContent='Добави текст или прикачи файл.';return}
  const files=Array.from(form.elements.files.files);if(files.length>8||files.reduce((a,b)=>a+b.size,0)>20*1024*1024){error.textContent='До 8 файла и до 20 MB общо.';return}
  const prev=ids.get(form);const target=isNew?'new':active;const stamp=JSON.stringify([...fd].map(([k,v])=>[k,typeof v==='string'?v:[v.name,v.size,v.lastModified]]));
  const tx=prev&&prev.author===author&&prev.target===target&&prev.stamp===stamp?prev:{target,stamp,author,id:isNew?crypto.randomUUID():active,mid:crypto.randomUUID()};ids.set(form,tx);
  fd.set('author',author);fd.set('op',isNew?'new':'message');fd.set('id',tx.id);fd.set('mid',tx.mid);
  const button=form.querySelector('button.primary');busy=true;button.disabled=true;
  try{await api('',fd);ids.delete(form);if(isNew)$('composer').close();if(isNew||active===tx.id){form.reset();fileLabels(form)}drafts.delete(tx.id);if(isNew){source=0;filter='open';$('search').value=''}await refresh();if(isNew)await select(tx.id)}
  catch(err){error.textContent=err.message;report(err)}finally{busy=false;button.disabled=false}
 })};
}
let editing;
$('edit').onclick=()=>named(()=>{
 const thread=items.find(item=>item.id===active);
 if(!thread||thread.done)return;
 editing={...thread};
 const form=$('editForm');
 for(const key of ['title','lead','source','rownum'])form.elements[key].value=thread[key]??'';
 form.querySelector('.error').textContent='';
 $('editor').showModal();form.elements.title.focus();
});
$('editForm').onsubmit=async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('button.primary');
 if(button.disabled||!editing)return;
 const original=editing, data=new FormData(form);
 data.set('author',author);data.set('op','edit');data.set('id',original.id);
 data.set('oldTitle',original.title);data.set('oldLead',original.lead);
 data.set('oldSource',original.source);data.set('oldRow',original.rownum||0);
 button.disabled=true;form.querySelector('.error').textContent='';
 try{
  await api('',data);$('editor').close();
  if(source===original.source)source=Number(data.get('source'));
  await refresh();
 }catch(err){form.querySelector('.error').textContent=err.message;report(err);await refresh().catch(report)}
 finally{button.disabled=false}
};
$('done').onclick=()=>named(async()=>{const t=items.find(i=>i.id===active);if(!t||busy)return;const f=new FormData();f.set('op','status');f.set('id',t.id);f.set('done',t.done?'0':'1');busy=true;$('done').disabled=true;
 try{await api('',f);filter=t.done?'open':'done';source=0;await refresh()}catch(e){report(e)}finally{busy=false;$('done').disabled=false}});
identity();$('list').textContent='Зареждане…';refresh().catch(report);api('?sources=1').then(v=>{sources=v;paint()}).catch(report);
setInterval(()=>{if(!document.hidden&&!busy&&!document.querySelector('dialog[open]'))refresh().catch(report)},12000);

let deleteTarget='';
$('deleteMail').onclick=()=>named(()=>{
 const t=items.find(i=>i.id===active);if(!t)return;
 deleteTarget=t.id;$('deleteTitle').textContent=t.title;$('deleteError').textContent='';$('deleting').showModal();
});
$('confirmDelete').onclick=async()=>{
 const button=$('confirmDelete');button.disabled=true;
 const data=new FormData();data.set('op','delete');data.set('id',deleteTarget);
 try{await api('',data);$('deleting').close();if(active===deleteTarget)await select('');drafts.delete(deleteTarget);await refresh()}
 catch(e){$('deleteError').textContent=e.message}finally{button.disabled=false}
};

let scale=1;
function zoomPhoto(value){
 scale=Math.min(6,Math.max(1,value));$('photo').style.width=(scale*100)+'%';
 $('fit').textContent=Math.round(scale*100)+'%';$('smaller').disabled=scale===1;$('larger').disabled=scale===6;
}
function showPhoto(url,name){
 $('photoName').textContent=name;$('photo').alt=name;$('photo').src=url;
 zoomPhoto(1);$('viewer').showModal();$('viewer').querySelector('.pan').scrollTo(0,0);
}
$('larger').onclick=()=>zoomPhoto(scale+.5);$('smaller').onclick=()=>zoomPhoto(scale-.5);
$('fit').onclick=()=>zoomPhoto(1);$('photo').ondblclick=()=>zoomPhoto(scale===1?2:1);

$('changePass').onclick=()=>{$('newPass').value='';$('passError').textContent='';$('passDialog').showModal()};
$('passForm').onsubmit=async e=>{
 e.preventDefault();const password=$('newPass').value,button=e.currentTarget.querySelector('button.primary');
 if([...password].length!==4){$('passError').textContent='Паролата трябва да е точно 4 символа.';return}
 button.disabled=true;
 try{
  const name=author,key=await deriveKey(name,password),data=new FormData();
  data.set('op','changePassword');data.set('replacement',key);
  await api('',data);
  account={name,key};localStorage.setItem(sessionKey,JSON.stringify(account));localStorage.setItem(savedProfileKey(name),key);
  $('newPass').value='';$('passDialog').close();$('identity').close();$('status').textContent='Паролата е сменена.';
 }catch(err){$('passError').textContent=err.message}finally{button.disabled=false}
};

const sampleStates={pending:'За изпращане',sent:'Изпратени',waiting:'Чакаме уточнение',review:'За проверка',none:'Други топли лийдове'};
let sampleRows=[],sampleVersion=0;
async function loadSamples(){
 const version=++sampleVersion;
 $('sampleStatus').textContent='Зареждане…';
 try{
  const rows=await api('?samples=1');
  if(version!==sampleVersion)return;
  sampleRows=rows;
  $('sampleStatus').textContent='';
  renderSamples();
 }catch(err){if(version===sampleVersion)$('sampleStatus').textContent=err.message}
}
function renderSamples(){
 const target=$('sampleGroups'),previouslyOpen=new Set(Array.from(target.querySelectorAll('details[open]'),e=>e.dataset.state));
 const first=!target.childElementCount;
 target.replaceChildren();
 const term=$('sampleSearch').value.trim().toLowerCase();
 const rows=sampleRows.filter(r=>(!$('sampleSource').value||String(r.source)===$('sampleSource').value)&&(r.company+' '+r.country).toLowerCase().includes(term));
 for(const [state,label] of Object.entries(sampleStates)){
  const group=node('details');
  group.dataset.state=state;
  group.open=!!term||(first?state==='pending'||state==='sent':previouslyOpen.has(state));
  const matches=rows.filter(r=>r.state===state);
  const heading=node('summary',label+' · '+matches.length);
  heading.style.cssText='cursor:pointer;padding:.8rem 0;font-weight:700;';
  group.append(heading);
  for(const row of matches){
   const card=node('div');
   card.style.cssText='border-top:1px solid #465453;padding:.7rem 0;display:grid;gap:.4rem';
   card.append(node('strong',row.company),node('small',[sourceNames[row.source],row.country,'Warm Leads · ред '+row.row].filter(Boolean).join(' · ')));
   if(row.note)card.append(node('small','От таблицата: '+row.note));
   if(row.author)card.append(node('small','Обновено от '+row.author+' · '+date(row.updated)));
   const select=node('select');select.setAttribute('aria-label','Статус на мострите за '+row.company);
   for(const [value,name] of Object.entries(sampleStates))select.add(new Option(name,value));
   select.value=state;
   select.onchange=()=>{
    const next=select.value;select.value=state;
    named(async()=>{
     select.disabled=true;
     try{
      const form=new FormData();form.set('op','sampleState');form.set('id',row.id);form.set('state',next);form.set('previous',state);
      await api('',form);await loadSamples();
     }catch(err){await loadSamples();$('sampleStatus').textContent=err.message}
     finally{select.disabled=false}
    });
   };
   card.append(select);group.append(card);
  }
  if(!matches.length)group.append(node('p','Няма записи.'));
  target.append(group);
 }
}
$('openSamples').onclick=()=>{$('samples').showModal();loadSamples()};
$('reloadSamples').onclick=loadSamples;
$('sampleSource').onchange=renderSamples;
$('sampleSearch').oninput=renderSamples;
