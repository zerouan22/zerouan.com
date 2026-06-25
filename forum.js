const SUPABASE_URL = 'https://vxnlycbuacrielnhjqqi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rwF9RZvjKHXtB1fjCTkzfw_x8xrwKQH';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORAGE_BUCKET = 'forum-media';

const state = {
  user: null,
  profile: null,
  categories: [],
  selectedCategoryId: null,
  selectedCategorySlug: 'generale',
  threads: [],
  currentThread: null,
  sort: 'recent',
  search: '',
  threadMedia: [],
  replyMedia: [],
  linkTarget: 'thread'
};

const $ = (id) => document.getElementById(id);
const els = {
  categoryList: $('categoryList'), threadList: $('threadList'), emptyThreads: $('emptyThreads'), popularList: $('popularList'), tagList: $('tagList'),
  usersCount: $('usersCount'), threadsCount: $('threadsCount'), postsCount: $('postsCount'), mediaCount: $('mediaCount'), heroThreads: $('heroThreads'), heroPosts: $('heroPosts'),
  onlineStack: $('onlineStack'), onlineCount: $('onlineCount'), activeUsersList: $('activeUsersList'), monthUserAvatar: $('monthUserAvatar'), monthUserName: $('monthUserName'), monthUserMeta: $('monthUserMeta'),
  userBadge: $('userBadge'), openAuthBtn: $('openAuthBtn'), openProfileBtn: $('openProfileBtn'), logoutBtn: $('logoutBtn'), themeBtn: $('themeBtn'),
  authDialog: $('authDialog'), closeAuthBtn: $('closeAuthBtn'), loginBtn: $('loginBtn'), signupBtn: $('signupBtn'), authEmail: $('authEmail'), authPassword: $('authPassword'), displayName: $('displayName'), authMessage: $('authMessage'),
  profileDialog: $('profileDialog'), closeProfileBtn: $('closeProfileBtn'), cancelProfileBtn: $('cancelProfileBtn'), profileForm: $('profileForm'), profilePreviewAvatar: $('profilePreviewAvatar'), avatarFile: $('avatarFile'), profileDisplayName: $('profileDisplayName'), profileUsername: $('profileUsername'), profileBio: $('profileBio'), profileTheme: $('profileTheme'), profileMessage: $('profileMessage'),
  links: { instagram: $('linkInstagram'), youtube: $('linkYoutube'), spotify: $('linkSpotify'), soundcloud: $('linkSoundcloud'), tiktok: $('linkTiktok'), website: $('linkWebsite') },
  newThreadBtn: $('newThreadBtn'), quickPostBtn: $('quickPostBtn'), quickPhotoBtn: $('quickPhotoBtn'), quickVideoBtn: $('quickVideoBtn'), quickLinkBtn: $('quickLinkBtn'), quickMusicBtn: $('quickMusicBtn'), composerAvatar: $('composerAvatar'),
  threadDialog: $('threadDialog'), closeThreadBtn: $('closeThreadBtn'), cancelThreadBtn: $('cancelThreadBtn'), threadForm: $('threadForm'), newTitle: $('newTitle'), newCategory: $('newCategory'), newBody: $('newBody'), threadMessage: $('threadMessage'), threadFiles: $('threadFiles'), threadMediaPreview: $('threadMediaPreview'), threadAddLinkBtn: $('threadAddLinkBtn'), clearThreadMediaBtn: $('clearThreadMediaBtn'),
  linkDialog: $('linkDialog'), linkForm: $('linkForm'), closeLinkBtn: $('closeLinkBtn'), cancelLinkBtn: $('cancelLinkBtn'), mediaUrl: $('mediaUrl'), mediaTitle: $('mediaTitle'),
  threadView: $('threadView'), backToListBtn: $('backToListBtn'), breadcrumbCategory: $('breadcrumbCategory'), threadTitle: $('threadTitle'), threadMeta: $('threadMeta'), threadBody: $('threadBody'), threadMedia: $('threadMedia'), postsList: $('postsList'), replyCount: $('replyCount'), replyForm: $('replyForm'), replyBody: $('replyBody'), replyFiles: $('replyFiles'), replyMediaPreview: $('replyMediaPreview'), replyAddLinkBtn: $('replyAddLinkBtn'), replyJumpBtn: $('replyJumpBtn'),
  searchInput: $('searchInput'), pageTitle: $('pageTitle'), pageSubtitle: $('pageSubtitle'), currentSection: $('currentSection'), toast: $('toast')
};

function escapeHtml(value = '') { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function fmtDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
function initial(name = 'U') { return escapeHtml((name || 'U').trim().slice(0,1).toUpperCase() || 'U'); }
function toast(message) { els.toast.textContent = message; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'), 3200); }
function safeUrl(url) { try { const u = new URL(url); return ['http:','https:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; } }
function mediaKind(url) {
  const u = safeUrl(url); if (!u) return 'link';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/open\.spotify\.com/.test(u)) return 'spotify';
  if (/soundcloud\.com/.test(u)) return 'soundcloud';
  return 'link';
}
function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v') || u.pathname.split('/').pop();
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
  } catch { return ''; }
}
function vimeoEmbed(url) { const m = String(url).match(/vimeo\.com\/(\d+)/); return m ? `https://player.vimeo.com/video/${m[1]}` : ''; }
function spotifyEmbed(url) { return safeUrl(url)?.replace('open.spotify.com/', 'open.spotify.com/embed/') || ''; }
function soundcloudEmbed(url) { const u = encodeURIComponent(url); return `https://w.soundcloud.com/player/?url=${u}&visual=true`; }
function normalizeMedia(item) { return { type:item.type || mediaKind(item.url), url:item.url || '', title:item.title || '', path:item.path || '' }; }
function mediaArray(value) { return Array.isArray(value) ? value.map(normalizeMedia) : []; }
function renderAvatar(el, profile, fallbackName) {
  const url = profile?.avatar_url || profile?.author_avatar_url || profile?.avatar || '';
  if (url) { el.style.backgroundImage = `url("${url}")`; el.textContent = ''; }
  else { el.style.backgroundImage = ''; el.textContent = initial(profile?.display_name || profile?.author_name || fallbackName); }
}

async function init() {
  bindEvents();
  applySavedTheme();
  await loadSession();
  await Promise.all([loadCategories(), loadStats(), loadLivePanels(), loadThreads()]);
  subscribeRealtime();
  startHeartbeat();
}

function bindEvents() {
  els.openAuthBtn.addEventListener('click', () => els.authDialog.showModal());
  els.closeAuthBtn.addEventListener('click', () => els.authDialog.close());
  els.loginBtn.addEventListener('click', login); els.signupBtn.addEventListener('click', signup); els.logoutBtn.addEventListener('click', logout);
  els.themeBtn.addEventListener('click', toggleTheme);
  els.openProfileBtn.addEventListener('click', openProfileEditor); els.closeProfileBtn.addEventListener('click', () => els.profileDialog.close()); els.cancelProfileBtn.addEventListener('click', () => els.profileDialog.close()); els.profileForm.addEventListener('submit', saveProfile); els.avatarFile.addEventListener('change', previewAvatar);
  [els.newThreadBtn, els.quickPostBtn, els.quickPhotoBtn, els.quickVideoBtn, els.quickLinkBtn, els.quickMusicBtn].forEach(btn => btn.addEventListener('click', () => openThreadComposer(btn.id)));
  els.closeThreadBtn.addEventListener('click', () => els.threadDialog.close()); els.cancelThreadBtn.addEventListener('click', () => els.threadDialog.close()); els.threadForm.addEventListener('submit', createThread);
  els.threadFiles.addEventListener('change', () => addFilesToMedia(els.threadFiles.files, 'thread')); els.replyFiles.addEventListener('change', () => addFilesToMedia(els.replyFiles.files, 'reply'));
  els.threadAddLinkBtn.addEventListener('click', () => openLinkDialog('thread')); els.replyAddLinkBtn.addEventListener('click', () => openLinkDialog('reply')); els.clearThreadMediaBtn.addEventListener('click', () => { state.threadMedia=[]; renderMediaPreview('thread'); });
  els.closeLinkBtn.addEventListener('click', () => els.linkDialog.close()); els.cancelLinkBtn.addEventListener('click', () => els.linkDialog.close()); els.linkForm.addEventListener('submit', addLinkMedia);
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); state.sort = tab.dataset.sort; renderThreads(); }));
  let searchTimer; els.searchInput.addEventListener('input', e => { clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ state.search=e.target.value.trim().toLowerCase(); renderThreads(); },180); });
  els.backToListBtn.addEventListener('click', closeThread); els.replyJumpBtn.addEventListener('click',()=>els.replyBody.focus()); els.replyForm.addEventListener('submit', createReply);
}

function applySavedTheme() { document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark'; }
function toggleTheme() { const next = document.body.dataset.theme === 'light' ? 'dark' : 'light'; document.body.dataset.theme = next; localStorage.setItem('incForumTheme', next); }

async function loadSession() {
  const { data } = await db.auth.getSession(); state.user = data.session?.user || null; await loadProfile(); renderAuthState();
  db.auth.onAuthStateChange(async (_event, session) => { state.user = session?.user || null; await loadProfile(); renderAuthState(); await loadLivePanels(); });
}
async function loadProfile() {
  state.profile = null; if (!state.user) return;
  const { data, error } = await db.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (!error) state.profile = data;
}
function renderAuthState() {
  const logged = !!state.user; els.openAuthBtn.classList.toggle('hidden', logged); els.logoutBtn.classList.toggle('hidden', !logged); els.openProfileBtn.classList.toggle('hidden', !logged);
  const name = state.profile?.display_name || state.user?.email?.split('@')[0] || 'Ospite'; els.userBadge.textContent = logged ? name : 'Ospite';
  renderAvatar(els.openProfileBtn, state.profile, name); renderAvatar(els.composerAvatar, state.profile, name);
}
async function login() {
  els.authMessage.textContent = 'Accesso in corso...';
  const { error } = await db.auth.signInWithPassword({ email: els.authEmail.value.trim(), password: els.authPassword.value });
  els.authMessage.textContent = error ? error.message : 'Accesso effettuato.'; if (!error) { els.authDialog.close(); toast('Benvenuto in INC. Forum'); }
}
async function signup() {
  els.authMessage.textContent = 'Registrazione in corso...';
  const display_name = els.displayName.value.trim() || els.authEmail.value.split('@')[0];
  const { error } = await db.auth.signUp({ email: els.authEmail.value.trim(), password: els.authPassword.value, options: { data: { display_name } } });
  els.authMessage.textContent = error ? error.message : 'Registrazione completata. Ora puoi accedere.';
}
async function logout() { await db.auth.signOut(); state.user=null; state.profile=null; renderAuthState(); toast('Sei uscito da INC. Forum'); }
function requireLogin() { toast('Accedi per pubblicare o personalizzare il profilo.'); els.authDialog.showModal(); }

async function loadCategories() {
  const { data, error } = await db.from('category_overview').select('*').order('sort_order');
  if (error) return toast('Errore categorie: ' + error.message);
  state.categories = data || []; if (!state.selectedCategoryId && state.categories[0]) { state.selectedCategoryId = state.categories[0].id; state.selectedCategorySlug = state.categories[0].slug; }
  renderCategories(); renderCategorySelect();
}
function renderCategories() {
  els.categoryList.innerHTML = state.categories.map(cat => `<button class="category-item ${cat.id===state.selectedCategoryId?'active':''}" type="button" data-id="${cat.id}"><span class="left"><span>${escapeHtml(cat.icon)}</span>${escapeHtml(cat.name)}</span><span class="pill">${cat.thread_count || 0}</span></button>`).join('');
  els.categoryList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { const cat = state.categories.find(c=>c.id===btn.dataset.id); state.selectedCategoryId = cat.id; state.selectedCategorySlug = cat.slug; renderCategories(); updateHero(cat); renderThreads(); closeThread(); }));
  updateHero(state.categories.find(c=>c.id===state.selectedCategoryId));
}
function renderCategorySelect() { els.newCategory.innerHTML = state.categories.map(c=>`<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join(''); }
function updateHero(cat) { if (!cat) return; els.pageTitle.textContent = cat.name; els.pageSubtitle.textContent = cat.description; els.currentSection.textContent = 'INC. Forum'; els.heroThreads.textContent = cat.thread_count || 0; els.heroPosts.textContent = cat.post_count || 0; }

async function loadStats() {
  const { data, error } = await db.from('forum_stats').select('*').maybeSingle();
  if (!error && data) { els.usersCount.textContent=data.users_count||0; els.threadsCount.textContent=data.threads_count||0; els.postsCount.textContent=data.posts_count||0; els.mediaCount.textContent=data.media_count||0; }
}
async function loadLivePanels() { await Promise.all([loadActiveUsers(), loadUserOfMonth(), loadPopularTags()]); }
async function loadActiveUsers() {
  const { data } = await db.from('active_users').select('*').limit(8);
  const users = data || []; els.onlineCount.textContent = users.length;
  els.onlineStack.innerHTML = users.slice(0,5).map(u=>`<span title="${escapeHtml(u.display_name)}" style="${u.avatar_url?`background-image:url('${escapeHtml(u.avatar_url)}')`:''}">${u.avatar_url?'':initial(u.display_name)}</span>`).join('') + (users.length>5?`<span>+${users.length-5}</span>`:'');
  els.activeUsersList.innerHTML = users.length ? users.map(u=>`<div class="active-user"><span class="dot"></span><span class="author-avatar" style="${u.avatar_url?`background-image:url('${escapeHtml(u.avatar_url)}')`:''}">${u.avatar_url?'':initial(u.display_name)}</span><div><strong>${escapeHtml(u.display_name)}</strong><p class="muted small">${u.points || 0} punti</p></div></div>`).join('') : '<p class="muted small">Nessun utente attivo ora.</p>';
}
async function loadUserOfMonth() {
  const { data } = await db.from('user_of_month').select('*').limit(1).maybeSingle();
  if (!data) return;
  els.monthUserName.textContent = data.display_name || 'Nessun dato'; els.monthUserMeta.textContent = `${data.month_points || 0} punti questo mese · ${data.posts_count || 0} messaggi · ${data.threads_count || 0} discussioni`;
  renderAvatar(els.monthUserAvatar, data, data.display_name);
}
async function loadPopularTags() {
  const { data } = await db.from('popular_tags').select('*').limit(12);
  els.tagList.innerHTML = (data || []).map(t=>`<span>#${escapeHtml(t.tag)} ${t.usage_count}</span>`).join('') || '<span>#incforum</span><span>#musica</span>';
}

async function loadThreads() {
  const { data, error } = await db.from('thread_overview').select('*').order('last_activity_at',{ascending:false}).limit(200);
  if (error) return toast('Errore discussioni: ' + error.message);
  state.threads = data || []; renderThreads(); renderPopular();
}
function filteredThreads() {
  let items = [...state.threads].filter(t => t.category_id === state.selectedCategoryId);
  if (state.search) items = items.filter(t => `${t.title} ${t.body} ${t.author_name}`.toLowerCase().includes(state.search));
  if (state.sort === 'popular') items.sort((a,b)=>(b.view_count + b.reply_count*4) - (a.view_count + a.reply_count*4));
  if (state.sort === 'discussed') items.sort((a,b)=>b.reply_count - a.reply_count);
  if (state.sort === 'media') items = items.filter(t => mediaArray(t.media_items).length > 0);
  return items;
}
function renderThreads() {
  const items = filteredThreads(); els.emptyThreads.classList.toggle('hidden', items.length>0);
  els.threadList.innerHTML = items.map(t => {
    const media = mediaArray(t.media_items); const profile = {display_name:t.author_name, avatar_url:t.author_avatar_url};
    return `<article class="thread-item" data-id="${t.id}"><div class="author-avatar" style="${t.author_avatar_url?`background-image:url('${escapeHtml(t.author_avatar_url)}')`:''}">${t.author_avatar_url?'':initial(t.author_name)}</div><div><div class="author-row"><a class="profile-link">${escapeHtml(t.author_name)}</a><span class="badge">${escapeHtml(t.author_role || 'user')}</span><span class="muted small">${fmtDate(t.created_at)}</span>${media.length?`<span class="media-badge">📎 ${media.length} media</span>`:''}</div><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.body || '').slice(0,190)}${(t.body || '').length>190?'…':''}</p></div><div class="thread-stats"><span>💬 ${t.reply_count || 0}</span><span>👁 ${t.view_count || 0}</span></div></article>`;
  }).join('');
  els.threadList.querySelectorAll('.thread-item').forEach(el => el.addEventListener('click', () => openThread(el.dataset.id)));
}
function renderPopular() {
  const items = [...state.threads].sort((a,b)=>(b.view_count + b.reply_count*4) - (a.view_count + a.reply_count*4)).slice(0,5);
  els.popularList.innerHTML = items.map(t=>`<li><strong>${escapeHtml(t.title)}</strong><span>${t.reply_count || 0} risposte · ${t.view_count || 0} visite</span></li>`).join('') || '<li>Nessun dato.</li>';
}

async function openThread(id) {
  const t = state.threads.find(x=>x.id===id); if (!t) return; state.currentThread = t;
  els.threadView.classList.remove('hidden'); els.breadcrumbCategory.textContent=t.category_name; els.threadTitle.textContent=t.title; els.threadMeta.textContent=`${t.author_name} · ${fmtDate(t.created_at)} · ${t.view_count || 0} visite`; els.threadBody.textContent=t.body; els.replyCount.textContent=t.reply_count || 0; renderMedia(els.threadMedia, mediaArray(t.media_items));
  await db.rpc('increment_thread_views', { thread_id_input: id });
  await loadPosts(id); els.threadView.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeThread(){ state.currentThread=null; els.threadView.classList.add('hidden'); }
async function loadPosts(threadId) {
  const { data, error } = await db.from('post_overview').select('*').eq('thread_id', threadId).order('created_at');
  if (error) return toast('Errore risposte: ' + error.message);
  els.postsList.innerHTML = (data || []).map(p=>`<article class="post"><div class="author-avatar" style="${p.author_avatar_url?`background-image:url('${escapeHtml(p.author_avatar_url)}')`:''}">${p.author_avatar_url?'':initial(p.author_name)}</div><div><div class="author-row"><strong>${escapeHtml(p.author_name)}</strong><span class="badge">${escapeHtml(p.author_role || 'user')}</span><span class="muted small">${fmtDate(p.created_at)}</span></div><div class="post-body">${escapeHtml(p.body)}</div><div class="media-grid">${mediaHtml(mediaArray(p.media_items))}</div></div></article>`).join('') || '<p class="muted" style="padding:20px 24px">Ancora nessuna risposta.</p>';
}

function openThreadComposer(sourceId) {
  if (!state.user) return requireLogin();
  state.threadMedia=[]; els.threadForm.reset(); els.threadMessage.textContent=''; els.newCategory.value = state.selectedCategoryId || state.categories[0]?.id || '';
  if (sourceId === 'quickPhotoBtn') setTimeout(()=>els.threadFiles.click(),100);
  if (sourceId === 'quickVideoBtn' || sourceId === 'quickLinkBtn' || sourceId === 'quickMusicBtn') setTimeout(()=>openLinkDialog('thread'),100);
  renderMediaPreview('thread'); els.threadDialog.showModal();
}
async function createThread(e) {
  e.preventDefault(); if (!state.user) return requireLogin();
  els.threadMessage.textContent = 'Pubblicazione in corso...';
  const media = await uploadPendingMedia('thread');
  const tags = extractTags(`${els.newTitle.value} ${els.newBody.value}`);
  const { error } = await db.from('threads').insert({ category_id: els.newCategory.value, author_id: state.user.id, title: els.newTitle.value.trim(), body: els.newBody.value.trim(), media_items: media, tags });
  if (error) { els.threadMessage.textContent = error.message; return; }
  els.threadDialog.close(); state.threadMedia=[]; await Promise.all([loadThreads(), loadCategories(), loadStats(), loadLivePanels()]); toast('Discussione pubblicata su INC. Forum');
}
async function createReply(e) {
  e.preventDefault(); if (!state.user) return requireLogin(); if (!state.currentThread) return;
  const media = await uploadPendingMedia('reply');
  const { error } = await db.from('posts').insert({ thread_id: state.currentThread.id, author_id: state.user.id, body: els.replyBody.value.trim(), media_items: media });
  if (error) return toast(error.message);
  await db.from('threads').update({ last_activity_at: new Date().toISOString() }).eq('id', state.currentThread.id);
  els.replyForm.reset(); state.replyMedia=[]; renderMediaPreview('reply'); await Promise.all([loadPosts(state.currentThread.id), loadThreads(), loadStats(), loadLivePanels()]); toast('Risposta pubblicata');
}

function openLinkDialog(target) { state.linkTarget = target; els.linkForm.reset(); els.linkDialog.showModal(); }
function addLinkMedia(e) { e.preventDefault(); const url = safeUrl(els.mediaUrl.value.trim()); if (!url) return; const item = {type:mediaKind(url), url, title:els.mediaTitle.value.trim()}; state[state.linkTarget+'Media'].push(item); renderMediaPreview(state.linkTarget); els.linkDialog.close(); }
function addFilesToMedia(files, target) { [...files].forEach(file => state[target+'Media'].push({type:'image_pending', file, title:file.name})); renderMediaPreview(target); }
function renderMediaPreview(target) { const arr = state[target+'Media']; const el = target==='thread' ? els.threadMediaPreview : els.replyMediaPreview; el.innerHTML = mediaHtml(arr); }
async function uploadPendingMedia(target) {
  const result = [];
  for (const item of state[target+'Media']) {
    if (item.type === 'image_pending' && item.file) {
      const ext = item.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${state.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, item.file, { cacheControl:'3600', upsert:false });
      if (error) { toast('Upload fallito: ' + error.message); continue; }
      const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      result.push({ type:'image', url:data.publicUrl, path, title:item.title || 'Immagine' });
    } else result.push(normalizeMedia(item));
  }
  return result;
}
function renderMedia(container, arr) { container.innerHTML = mediaHtml(arr); }
function mediaHtml(arr) { return (arr || []).map(item => {
  const type = item.type || mediaKind(item.url); const title = escapeHtml(item.title || item.url || 'Media'); const url = safeUrl(item.url || '');
  if (type === 'image_pending') return `<div class="media-card"><div class="media-caption">📷 ${escapeHtml(item.title || item.file?.name || 'Immagine pronta')}</div></div>`;
  if (type === 'image') return `<div class="media-card"><img src="${escapeHtml(url)}" alt="${title}" loading="lazy"><div class="media-caption">${title}</div></div>`;
  let embed=''; if (type==='youtube') embed=youtubeEmbed(url); if (type==='vimeo') embed=vimeoEmbed(url); if (type==='spotify') embed=spotifyEmbed(url); if (type==='soundcloud') embed=soundcloudEmbed(url);
  if (embed) return `<div class="media-card"><iframe src="${escapeHtml(embed)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>`;
  return `<div class="media-card"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">🔗 ${title}</a></div>`;
}).join(''); }
function extractTags(text) { return [...new Set((text.match(/#[\p{L}\p{N}_-]+/gu) || []).map(t=>t.slice(1).toLowerCase()).slice(0,12))]; }

function openProfileEditor() {
  if (!state.user) return requireLogin();
  els.profileMessage.textContent=''; els.profileDisplayName.value=state.profile?.display_name||''; els.profileUsername.value=state.profile?.username||''; els.profileBio.value=state.profile?.bio||''; els.profileTheme.value=state.profile?.theme||'dark';
  const links = state.profile?.social_links || {}; Object.entries(els.links).forEach(([k,el])=>el.value=links[k]||''); renderAvatar(els.profilePreviewAvatar,state.profile,state.profile?.display_name); els.profileDialog.showModal();
}
function previewAvatar(){ const file=els.avatarFile.files[0]; if(!file)return; els.profilePreviewAvatar.style.backgroundImage=`url("${URL.createObjectURL(file)}")`; els.profilePreviewAvatar.textContent=''; }
async function saveProfile(e) {
  e.preventDefault(); if(!state.user) return requireLogin(); els.profileMessage.textContent='Salvataggio...';
  let avatar_url = state.profile?.avatar_url || null;
  const file = els.avatarFile.files[0];
  if (file) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${state.user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { upsert:true, cacheControl:'3600' });
    if (error) { els.profileMessage.textContent = error.message; return; }
    avatar_url = db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const social_links = {}; Object.entries(els.links).forEach(([k,el])=>{ const u=safeUrl(el.value.trim()); if(u) social_links[k]=u; });
  const update = { display_name:els.profileDisplayName.value.trim(), username:els.profileUsername.value.trim().toLowerCase() || null, bio:els.profileBio.value.trim(), theme:els.profileTheme.value, avatar_url, social_links, last_seen_at:new Date().toISOString() };
  const { error } = await db.from('profiles').update(update).eq('id', state.user.id);
  if (error) { els.profileMessage.textContent = error.message; return; }
  await loadProfile(); renderAuthState(); els.profileDialog.close(); toast('Profilo aggiornato'); await loadLivePanels();
}

function startHeartbeat() { setInterval(updatePresence, 60000); updatePresence(); }
async function updatePresence(){ if(!state.user) return; await db.from('profiles').update({ last_seen_at:new Date().toISOString() }).eq('id', state.user.id); }
function subscribeRealtime() {
  db.channel('inc-forum-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'threads'}, async()=>{ await Promise.all([loadThreads(),loadCategories(),loadStats(),loadLivePanels()]); })
    .on('postgres_changes',{event:'*',schema:'public',table:'posts'}, async()=>{ if(state.currentThread) await loadPosts(state.currentThread.id); await Promise.all([loadThreads(),loadCategories(),loadStats(),loadLivePanels()]); })
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'}, async()=>{ await loadLivePanels(); })
    .subscribe();
}

init();
