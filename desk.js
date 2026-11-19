const $ = id => document.getElementById(id);
const repo = 'JohnyKid123/replydesk-inbox';
const web = 'https://github.com/' + repo;
const api = 'https://api.github.com/repos/' + repo;
const newIssue = web + '/issues/new?template=email.yml';
const nativeList = state => web + '/issues?q=' + encodeURIComponent('is:issue state:' + state);
$('tables').href = web + '/blob/main/tables.md';
$('nativeNew').href = newIssue;
$('quickNative').href = nativeList('open');
$('nativeOpen').href = nativeList('open');
$('nativeDone').href = nativeList('closed');
let token = '', state = 'open', items = [], selected = null, selection = 0, listRequest = 0, intent = '';
const uploadCache = new WeakMap();
const previews = new Set();
const drafts = new Map();
function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function bind(id, action, status = 'status') {
  const el = $(id), form = el.tagName === 'FORM';
  el.addEventListener(form ? 'submit' : 'click', async event => {
    event.preventDefault();
    const btn = form ? el.querySelector('button') : el;
    if (btn.disabled) return;
    btn.disabled = true;
    $(status).textContent = '';
    try { await action(); }
    catch (err) { $(status).textContent = err.message; }
    finally { btn.disabled = false; }
  });
}
async function request(path, options = {}, raw = false) {
  const res = await fetch(api + path, {
    method: options.method || 'GET',
    headers: {Authorization: 'Bearer ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', ...(options.body ? {'Content-Type':'application/json'} : {})},
    body: options.body && JSON.stringify(options.body), cache:'no-store', redirect:'error'
  });
  if (!res.ok) throw Error('GitHub (' + res.status + '). Провери достъпа до частната папка и опитай отново.');
  return raw ? res.blob() : res.json();
}
async function pages(path) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await request(path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}
function showLogin(next) {
  intent = next;
  $('fallback').href = next === 'new' ? newIssue : nativeList(state);
  $('authError').textContent = '';
  $('auth').showModal();
}
function paintList() {
  $('opened').className = state === 'open' ? '' : 'soft';
  $('closed').className = state === 'closed' ? '' : 'soft';
  const list = $('list');
  list.replaceChildren();
  if (!token) {
    const link = node('a', state === 'open' ? 'Отвори активните дискусии в GitHub' : 'Отвори архива в GitHub');
    link.href = nativeList(state);
    list.append(node('p','Защитена папка','none'), link);
    return;
  }
  const term = $('search').value.trim().toLowerCase();
  for (const item of items.filter(i => (i.title + ' ' + (i.body || '')).toLowerCase().includes(term))) {
    const b = node('button', item.title, 'item');
    b.setAttribute('aria-current', String(item.number === selected?.number));
    b.append(node('small', '#' + item.number + ' · ' + when(item.updated_at)));
    b.onclick = () => openThread(item).catch(e => $('status').textContent = e.message);
    list.append(b);
  }
  if (!list.children.length) list.append(node('p',term ? 'Няма съвпадения.' : 'Няма имейли с този статус.','none'));
}
async function loadList() {
  const order = ++listRequest;
  const result = await pages('/issues?sort=updated&state=' + state);
  if (order !== listRequest) return;
  items = result.filter(x => !x.pull_request);
  paintList();
}
function clearPreviews() {
  for (const url of previews) URL.revokeObjectURL(url);
  previews.clear();
}
function rememberDraft() {
  if (!selected) return;
  const f = $('reply').elements;
  drafts.set(selected.number, {text:f.text.value, files:f.files.files});
}
function resetDetail() {
  rememberDraft(); selected = null; ++selection; clearPreviews();
  $('thread').hidden = true; $('empty').hidden = !token;
}
function when(date) { return new Date(date).toLocaleString('bg-BG',{dateStyle:'short',timeStyle:'short'}); }
function fileControl(path) {
  const name = decodeURIComponent(path.split('/').pop());
  const box = node('div'), btn = node('button','📎 ' + name,'soft file');
  box.append(btn);
  btn.onclick = async () => {
    const version = selection;
    btn.disabled = true;
    try {
      const blob = await request('/contents/' + path,{},true);
      if (version !== selection) return;
      const imageType = ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'})[name.split('.').pop().toLowerCase()];
      const url = URL.createObjectURL(new Blob([blob], {type:imageType || 'application/octet-stream'}));
      previews.add(url);
      if (imageType) { const img = node('img', '', 'preview'); img.alt = name; img.src = url; box.append(img); }
      const a = node('a','Изтегли ' + name); a.href = url; a.download = name; box.append(a); btn.remove();
      if (!imageType) a.click();
    } catch(e) { $('status').textContent = e.message; }
    finally { btn.disabled = false; }
  };
  return box;
}
function message(record) {
  const block = node('section','','message');
  block.append(node('b',record.user?.login || 'GitHub'),node('time',when(record.created_at)));
  const matchFiles = /^\[Прикачен файл\]\(https:\/\/github\.com\/JohnyKid123\/replydesk-inbox\/blob\/main\/(uploads\/[a-f0-9-]{36}\/[A-Za-z0-9%._~-]+)\)$/;
  for (const line of (record.body || '').split(/\r?\n/)) {
    const file = line.match(matchFiles);
    if (file) { try {block.append(fileControl(file[1]));continue;} catch {} }
    if (line.trim()) block.append(line.startsWith('### ') ? node('strong',line.slice(4)) : node('p',line));
  }
  return block;
}
async function openThread(item) {
  const version = ++selection;
  const comments = await pages('/issues/' + item.number + '/comments');
  if (version !== selection) return;
  rememberDraft(); clearPreviews(); selected = item;
  $('reply').reset();
  const draft = drafts.get(item.number);
  if (draft) { $('reply').elements.text.value = draft.text; $('reply').elements.files.files = draft.files; }
  $('empty').hidden = true; $('thread').hidden = false; $('title').textContent = item.title;
  $('toggle').textContent = item.state === 'open' ? '✓ Готово' : 'Върни за обсъждане';
  $('original').href = web + '/issues/' + item.number;
  $('history').replaceChildren(...[item,...comments].map(message));
  paintList();
}
async function upload(file) {
  if (uploadCache.has(file)) return uploadCache.get(file);
  const clean = file.name.replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,120) || 'file';
  const path = 'uploads/' + crypto.randomUUID() + '/' + encodeURIComponent(clean);
  const data = await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);
  });
  await request('/contents/' + path,{method:'PUT',body:{message:'Attach email discussion file',content:data}});
  const link = '[Прикачен файл](' + web + '/blob/main/' + path + ')';
  uploadCache.set(file,link);
  return link;
}
async function content(form) {
  const files = Array.from(form.elements.files.files), text = form.elements.text.value.trim();
  if (!text && !files.length) throw Error('Добави текст или прикачи файл.');
  if (files.length > 8 || files.some(f => f.size > 8*1024*1024)) throw Error('До 8 файла, всеки до 8 MB.');
  const lines = [text];
  for (const file of files) lines.push(await upload(file));
  return lines.filter(Boolean).join('\n\n');
}
async function filter(value) {
  state=value; resetDetail(); items=[]; paintList();
  if(token) await loadList();
}
bind('opened',()=>filter('open'));bind('closed',()=>filter('closed'));
bind('add',()=>token ? $('compose').showModal() : showLogin('new'));
bind('connect',()=>showLogin('list'));
bind('login',async()=>{
  token = $('login').elements.token.value.trim(); $('login').reset();
  try {
    const meta = await request('');
    if (!meta.private || meta.default_branch !== 'main') throw Error('Провери настройките на частната папка.');
    await loadList();
  } catch(e) { token=''; paintList(); throw e; }
  $('auth').close();$('welcome').hidden=true;$('session').hidden=false;$('empty').hidden=false;
  if(intent==='new') $('compose').showModal();
},'authError');
bind('create',async()=>{
  const form=$('create'), f=form.elements, title=f.title.value.trim(), lead=f.lead.value.trim();
  if(!title || !lead) throw Error('Въведи тема и име на лийда.');
  const body='### Таблица\n'+f.source.value+'\n\n### Лийд / компания\n'+lead+(f.row.value?'\n\n### Ред\n'+f.row.value:'')+'\n\n### Получен имейл\n'+await content(form);
  const item=await request('/issues',{method:'POST',body:{title,body}});
  form.reset();$('compose').close();state='open';$('search').value='';await openThread(item);await loadList();
},'newError');
bind('reply',async()=>{
  const item=selected, form=$('reply'),body=await content(form);
  const saved=await request('/issues/'+item.number+'/comments',{method:'POST',body:{body}});
  drafts.delete(item.number);
  if(selected?.number===item.number){form.reset();$('history').append(message(saved));}await loadList();
});
bind('toggle',async()=>{
  const item=selected,target=item.state==='open'?'closed':'open';
  await request('/issues/'+item.number,{method:'PATCH',body:{state:target}});
  await filter(target);const changed=items.find(i=>i.number===item.number);if(changed)await openThread(changed);
});
bind('refresh',async()=>{await loadList();if(selected){const item=items.find(i=>i.number===selected.number);if(item)await openThread(item);else resetDetail();}});
$('search').oninput=paintList;$('exit').onclick=()=>location.reload();
for(const btn of document.querySelectorAll('[data-close]'))btn.onclick=()=>btn.closest('dialog').close();
for(const form of [$('reply'),$('create')])form.addEventListener('paste',e=>{
  const pasted=Array.from(e.clipboardData?.files||[]);
  if(!pasted.length)return;
  e.preventDefault(); const transfer=new DataTransfer();
  for(const file of [...form.elements.files.files,...pasted])transfer.items.add(file);
  form.elements.files.files=transfer.files;
});
paintList();
