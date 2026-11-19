const sourceNames = {1: 'Mermer Foods', 2: 'Malatq Pazari'};
const $=id=>document.getElementById(id);
const icons={mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',layers:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',chat:'<path d="M4 4h16v12H9l-5 4z"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',table:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M10 9v12"/>',link:'<path d="m10 14 4-4m-6 3-1 1a3 3 0 0 0 4 4l3-3m2-4 1-1a3 3 0 0 0-4-4l-3 3"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',refresh:'<path d="M20 10a8 8 0 1 0-1 7m1-13v6h-6"/>',clip:'<path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9"/>'};
for(const i of document.querySelectorAll('[data-icon]'))i.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[i.dataset.icon]+'</svg>';
const host='https://replydesk-alex-okan.alexvenmil.chatgpt.site/api/desk';
const valid=k=>/^[0-9a-f]{64}$/.test(k||'');
const incoming=new URLSearchParams(location.hash.slice(1)).get('room');
const saved=localStorage.getItem('replydesk.room');
const room=valid(incoming)?incoming:valid(saved)?saved:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
localStorage.setItem('replydesk.room',room);
const invite=new URL(location.href);invite.hash='room='+room;
history.replaceState(null,'',invite);
let author=localStorage.getItem('replydesk.author')||'',items=[],sources=[],filter='all',source=0,active='',revision=0,loadVersion=0,messageStamp='',pending=null,busy=false;
const drafts=new Map(),urls=new Set(),ids=new WeakMap();
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text||'';if(cls)e.className=cls;return e}
function identity(){ $('initial').textContent=author?author[0].toUpperCase():'•';$('rename').textContent=author||'Твоето име';}
function named(fn){if(author)return fn();pending=fn;$('identity').showModal();$('name').focus();}
$('rename').onclick=()=>{$('name').value=author;pending=null;$('identity').showModal()};
$('nameForm').onsubmit=e=>{e.preventDefault();const v=$('name').value.trim();if(!v)return;author=v;localStorage.setItem('replydesk.author',v);identity();$('identity').close();const fn=pending;pending=null;fn?.()};
$('share').onclick=()=>{$('invite').value=invite.href;$('copied').textContent='';$('sharing').showModal()};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(invite.href);$('copied').textContent='Линкът е копиран.'}catch{$('invite').select();$('copied').textContent='Копирай избрания линк.'}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
async function api(query='',form=null,binary=false){
 const r=await fetch(host+query,{method:form?'POST':'GET',headers:{'x-room':room},body:form,cache:'no-store',credentials:'omit'});
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'Грешка при връзката ('+r.status+'). Опитай отново.')}
 return binary?r.blob():r.json();
}
function date(v){return new Date(v).toLocaleString('bg-BG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function paint(){
 const shown=items.filter(t=>(!source||t.source===source)&&(filter==='all'||Boolean(t.done)===(filter==='done'))&&(t.lead+' '+t.title).toLowerCase().includes($('search').value.trim().toLowerCase()));
 for(const [k,n] of [['all',items.length],['open',items.filter(t=>!t.done).length],['done',items.filter(t=>t.done).length]])$('n-'+k).textContent=n;
 for(const b of document.querySelectorAll('[data-filter]'))b.classList.toggle('active',!source&&b.dataset.filter===filter);
 for(const b of document.querySelectorAll('[data-source]'))b.classList.toggle('active',Number(b.dataset.source)===source);
 $('listTitle').textContent=source?sourceNames[source]:({all:'Всички имейли',open:'За обсъждане',done:'Готови'})[filter];
 $('total').textContent=shown.length;$('sheet').hidden=!(source&&sources[source-1]);if(!$('sheet').hidden)$('sheet').href=sources[source-1];
 $('list').replaceChildren(...shown.map(t=>{const b=node('button','','item');b.classList.toggle('active',t.id===active);b.append(node('small',t.done?'✓ Готово':'За обсъждане'),node('b',t.title),node('small',t.lead+' · '+date(t.updated)));b.onclick=()=>select(t.id).catch(report);return b}));
 if(!shown.length)$('list').append(node('p',items.length?'Няма имейли за този избор.':'Още няма имейли. Добави първия от „Нов имейл“.','listEmpty'));
 const t=items.find(t=>t.id===active);$('thread').hidden=!t;$('empty').hidden=!!t;
 if(t){$('subject').textContent=t.title;$('tag').textContent=t.done?'✓ ГОТОВО':'ЗА ОБСЪЖДАНЕ';$('lead').textContent=t.lead+' · '+sourceNames[t.source]+(t.rownum?' · ред '+t.rownum:'');$('done').textContent=t.done?'Върни за обсъждане':'✓ Готово'}
}
function report(e){$('status').textContent=e.message||'Връзката прекъсна. Натисни „Обнови“.'}
function fileLabels(form){form.querySelector('.chosen').textContent=Array.from(form.elements.files.files,x=>x.name).join(', ')}
function clearUrls(){for(const url of urls)URL.revokeObjectURL(url);urls.clear()}
async function select(id){
 if(active&&active!==id)drafts.set(active,{body:$('comment').value,files:$('reply').elements.files.files});
 if(active!==id){active=id;revision++;messageStamp='';$('history').replaceChildren();clearUrls();$('reply').reset();const d=drafts.get(id);if(d){$('comment').value=d.body;$('reply').elements.files.files=d.files}fileLabels($('reply'))}
 paint();if(id)await messages();
}
function entry(m){
 const e=node('div','','entry');e.append(node('b',m.author),node('time',date(m.created)));if(m.body)e.append(node('p',m.body));
 for(const f of JSON.parse(m.files)){
  const b=node('button','📎 '+f.name,'light');e.append(b);
  b.onclick=async()=>{b.disabled=true;const rev=revision;
   try{const blob=await api('?file='+encodeURIComponent(f.key),null,true);if(rev!==revision)return;
    const ext=f.name.split('.').pop().toLowerCase(),mime=({png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'})[ext];
    const url=URL.createObjectURL(new Blob([blob],{type:mime||'application/octet-stream'}));urls.add(url);
    if(mime){const img=node('img');img.alt=f.name;img.src=url;e.append(img)}
    const a=node('a','Изтегли '+f.name);a.href=url;a.download=f.name;e.append(a);b.remove();if(!mime)a.click();
   }catch(err){report(err)}finally{b.disabled=false}
  };
 }
 return e;
}
let mVersion=0;
async function messages(){const ver=++mVersion,id=active;if(!id)return;const all=await api('?id='+id);if(active!==id||ver!==mVersion)return;const stamp=all.map(m=>m.id).join(',');if(stamp===messageStamp)return;messageStamp=stamp;clearUrls();$('history').replaceChildren(...all.map(entry))}
async function refresh(){const ver=++loadVersion;const all=await api();if(ver!==loadVersion)return;items=all;paint();if(active)await messages();$('status').textContent=''}
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
  const tx=prev&&prev.target===target&&prev.stamp===stamp?prev:{target,stamp,id:isNew?crypto.randomUUID():active,mid:crypto.randomUUID()};ids.set(form,tx);
  fd.set('author',author);fd.set('op',isNew?'new':'message');fd.set('id',tx.id);fd.set('mid',tx.mid);
  const button=form.querySelector('button.primary');busy=true;button.disabled=true;
  try{await api('',fd);ids.delete(form);if(isNew)$('composer').close();if(isNew||active===tx.id){form.reset();fileLabels(form)}drafts.delete(tx.id);if(isNew){source=0;filter='open';$('search').value=''}await refresh();if(isNew)await select(tx.id)}
  catch(err){error.textContent=err.message;report(err)}finally{busy=false;button.disabled=false}
 })};
}
$('done').onclick=async()=>{const t=items.find(i=>i.id===active);if(!t||busy)return;const f=new FormData();f.set('op','status');f.set('id',t.id);f.set('done',t.done?'0':'1');busy=true;$('done').disabled=true;
 try{await api('',f);filter=t.done?'open':'done';source=0;await refresh()}catch(e){report(e)}finally{busy=false;$('done').disabled=false}};
identity();$('list').textContent='Зареждане…';refresh().catch(report);api('?sources=1').then(v=>{sources=v;paint()}).catch(report);
setInterval(()=>{if(!document.hidden&&!busy&&!document.querySelector('dialog[open]'))refresh().catch(report)},12000);
