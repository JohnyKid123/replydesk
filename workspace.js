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
function fileLabels(form){form.querySelector('.chosen').textContent=Array.from(form.elements.files.files,x=>x.name).join(', ')}
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
for(const form of [$('create'),$('reply')]){
 form.elements.files.onchange=()=>fileLabels(form);
 form.onpaste=e=>{const files=Array.from(e.clipboardData?.files||[]);if(!files.length)return;e.preventDefault();const dt=new DataTransfer();for(const f of [...form.elements.files.files,...files])dt.items.add(f);form.elements.files.files=dt.files;fileLabels(form)};
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

let take=null;
function stopMic(t){
 clearInterval(t.timer);
 if(t.processor)t.processor.onaudioprocess=null;
 for(const n of [t.source,t.processor,t.mute])n?.disconnect();
 t.stream?.getTracks().forEach(track=>track.stop());
 if(t.ctx&&t.ctx.state!=='closed')t.ctx.close().catch(()=>{});
 t.recording=false;
}
function releaseTake(){
 const t=take;take=null;if(!t)return;stopMic(t);
 if(t.url)URL.revokeObjectURL(t.url);$('listen').pause();$('listen').removeAttribute('src');$('listen').load();
}
$('voicing').addEventListener('close',releaseTake);
$('voice').onclick=()=>named(()=>{
 if(!active)return;releaseTake();take={thread:active,author,mid:crypto.randomUUID()};
 $('listen').hidden=true;$('record').disabled=false;$('record').textContent='Започни запис';$('sendVoice').disabled=true;
 $('voiceState').textContent='Натисни „Започни запис“ и разреши микрофона.';$('voicing').showModal();
});
function wave(parts,rate){
 const count=parts.reduce((n,p)=>n+p.length,0),buffer=new ArrayBuffer(44+count*2),v=new DataView(buffer);
 const label=(pos,text)=>{for(let i=0;i<text.length;i++)v.setUint8(pos+i,text.charCodeAt(i))};
 label(0,'RIFF');v.setUint32(4,36+count*2,true);label(8,'WAVE');label(12,'fmt ');v.setUint32(16,16,true);
 v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);
 v.setUint16(32,2,true);v.setUint16(34,16,true);label(36,'data');v.setUint32(40,count*2,true);
 let at=44;for(const part of parts)for(const sample of part){v.setInt16(at,sample,true);at+=2}
 return new Blob([new Uint8Array(buffer)],{type:'audio/wav'});
}
function finishRecording(t){
 if(t!==take||!t.recording)return;const rate=t.ctx.sampleRate;stopMic(t);
 $('record').textContent='Запиши отново';$('record').disabled=false;
 if(!t.samples||!t.heard){$('voiceState').textContent='Не се чу звук. Провери избрания микрофон и запиши отново.';return}
 t.blob=wave(t.parts,rate);t.parts=[];t.url=URL.createObjectURL(t.blob);$('listen').src=t.url;$('listen').hidden=false;
 $('voiceState').textContent='Записът е готов за прослушване.';$('sendVoice').disabled=false;
}
$('record').onclick=async()=>{
 const t=take;if(!t)return;if(t.recording){finishRecording(t);return}
 const button=$('record');button.disabled=true;$('sendVoice').disabled=true;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio||!navigator.mediaDevices?.getUserMedia)throw Error('Този браузър не предоставя микрофон. Отвори сайта в Safari, Chrome или Opera.');
  $('listen').pause();$('listen').hidden=true;if(t.url){URL.revokeObjectURL(t.url);t.url=''}t.blob=null;
  const ctx=new Audio();t.ctx=ctx;const resumed=ctx.resume();resumed.catch(()=>{});
  $('voiceState').textContent='Изчакване на микрофона…';
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(t!==take){stream.getTracks().forEach(track=>track.stop());return}
  t.stream=stream;await resumed;if(t!==take)return;
  t.source=ctx.createMediaStreamSource(stream);t.processor=ctx.createScriptProcessor(4096,1,1);t.mute=ctx.createGain();t.mute.gain.value=0;
  t.parts=[];t.samples=0;t.heard=false;t.mid=crypto.randomUUID();t.recording=true;
  t.processor.onaudioprocess=e=>{
   if(!t.recording)return;const data=e.inputBuffer.getChannelData(0),pcm=new Int16Array(data.length);
   for(let i=0;i<data.length;i++){const val=Math.max(-1,Math.min(1,data[i]));pcm[i]=val*(val<0?32768:32767);if(Math.abs(val)>.0001)t.heard=true}
   t.samples+=pcm.length;t.parts.push(pcm);
   if(t.samples>=Math.min(ctx.sampleRate*300,9000000))finishRecording(t);
  };
  t.source.connect(t.processor);t.processor.connect(t.mute);t.mute.connect(ctx.destination);
  const tick=()=>{const sec=Math.floor(t.samples/ctx.sampleRate);$('voiceState').textContent='● Запис · '+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+(t.heard?'':' · изчакване на звук')};
  stream.getAudioTracks()[0].onended=()=>finishRecording(t);
  tick();t.timer=setInterval(tick,400);button.textContent='■ Спри записа';
 }catch(e){stopMic(t);if(t===take)$('voiceState').textContent=e.name==='NotAllowedError'?'Достъпът до микрофона е отказан. Разреши го в настройките за този сайт.':e.message}
 finally{if(t===take)button.disabled=false}
};
$('sendVoice').onclick=async()=>{
 const t=take;if(!t?.blob)return;
 const btn=$('sendVoice');btn.disabled=true;$('record').disabled=true;
 const data=new FormData(),ext='wav';
 data.set('op','message');data.set('id',t.thread);data.set('mid',t.mid);data.set('author',t.author);data.set('files',new File([t.blob],'voice-'+t.mid+'.'+ext,{type:t.blob.type}));
 try{await api('',data);if(t===take)$('voicing').close();await refresh()}
 catch(e){if(t===take){$('voiceState').textContent=e.message;btn.disabled=false;$('record').disabled=false}}
};

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
