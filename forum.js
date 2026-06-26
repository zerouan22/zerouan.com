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
  links: { instagram: $('linkInstagram'), youtube: $('linkYoutube'), spotify: $('linkSpotify'), soundcloud: $('linkSoundcloud'), tiktok: $('linkTiktok'), bandcamp: $('linkBandcamp'), apple_music: $('linkAppleMusic'), x: $('linkX'), twitch: $('linkTwitch'), discord: $('linkDiscord'), hub: $('linkHub'), website: $('linkWebsite') },
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
  bindV3Events();
  applySavedTheme();
  await loadSession();
  await Promise.all([loadCategories(), loadStats(), loadLivePanels(), loadThreads(), loadSoundCards(), loadAdminBlocks()]);
  await openInitialThreadFromUrl();
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
  const navAdmin = $('navAdmin'); if (navAdmin) navAdmin.classList.toggle('hidden', !isAdmin());
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
    return `<article class="thread-item" data-id="${t.id}"><div class="author-avatar" style="${t.author_avatar_url?`background-image:url('${escapeHtml(t.author_avatar_url)}')`:''}">${t.author_avatar_url?'':initial(t.author_name)}</div><div><div class="author-row"><a class="profile-link">${escapeHtml(t.author_name)}</a><span class="muted small">${fmtDate(t.created_at)}</span>${media.length?`<span class="media-badge">📎 ${media.length} media</span>`:''}</div><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.body || '').slice(0,190)}${(t.body || '').length>190?'…':''}</p></div><div class="thread-stats"><span>💬 ${t.reply_count || 0}</span><span>👁 ${t.view_count || 0}</span></div></article>`;
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
    .on('postgres_changes',{event:'*',schema:'public',table:'sound_cards'}, async()=>{ await loadSoundCards(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'admin_blocks'}, async()=>{ await loadAdminBlocks(); })
    .subscribe();
}


/* ===================== INC FORUM V3: SOUND CARDS + ADMIN ===================== */
state.soundCards = [];
state.adminBlocks = [];
state.soundFilter = '';
state.currentMode = 'forum';

function isAdmin(){ return state.profile?.role === 'admin'; }
function csv(value){ return String(value || '').split(',').map(x=>x.trim()).filter(Boolean); }
function lowerSet(arr){ return new Set((arr || []).map(x=>String(x).trim().toLowerCase()).filter(Boolean)); }
function platformFromUrl(url){ const u = safeUrl(url); if(!u) return 'link'; if(u.includes('open.spotify.com')) return 'Spotify'; if(u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube'; if(u.includes('soundcloud.com')) return 'SoundCloud'; if(u.includes('bandcamp.com')) return 'Bandcamp'; return 'Link'; }

function bindV3Events(){
  $('navForum')?.addEventListener('click', e=>{ e.preventDefault(); showForumMode(); });
  $('navSoundCards')?.addEventListener('click', e=>{ e.preventDefault(); showSoundCardsMode(); });
  $('navAdmin')?.addEventListener('click', e=>{ e.preventDefault(); openAdminEditor(); });
  $('newSoundCardBtn')?.addEventListener('click', openSoundCardComposer);
  $('createSoundCardBtn')?.addEventListener('click', openSoundCardComposer);
  $('resetSoundMapBtn')?.addEventListener('click', ()=>renderSoundCards());
  $('soundSearchInput')?.addEventListener('input', e=>{ state.soundFilter=e.target.value.trim().toLowerCase(); renderSoundCards(); });
  $('soundCardForm')?.addEventListener('submit', createSoundCard);
  $('closeSoundCardBtn')?.addEventListener('click', ()=>$('soundCardDialog')?.close());
  $('cancelSoundCardBtn')?.addEventListener('click', ()=>$('soundCardDialog')?.close());
  $('adminForm')?.addEventListener('submit', saveAdminBlock);
  $('closeAdminBtn')?.addEventListener('click', ()=>$('adminDialog')?.close());
  $('cancelAdminBtn')?.addEventListener('click', ()=>$('adminDialog')?.close());
  $('insertAdminTemplateBtn')?.addEventListener('click', insertAdminTemplate);
  $('previewAdminBtn')?.addEventListener('click', previewAdminBlock);
}

function setNavActive(id){ document.querySelectorAll('.main-nav a').forEach(a=>a.classList.remove('active')); $(id)?.classList.add('active'); }
function showForumMode(){ state.currentMode='forum'; setNavActive('navForum'); $('soundCardsSection')?.classList.add('hidden'); document.querySelector('.composer-card')?.classList.remove('hidden'); document.querySelector('.tabs')?.classList.remove('hidden'); document.querySelector('.thread-list')?.classList.remove('hidden'); $('threadView')?.classList.toggle('hidden', !state.currentThread); updateHero(state.categories.find(c=>c.id===state.selectedCategoryId)); loadAdminBlocks(); }
function showSoundCardsMode(){ state.currentMode='sound'; setNavActive('navSoundCards'); $('soundCardsSection')?.classList.remove('hidden'); document.querySelector('.composer-card')?.classList.add('hidden'); document.querySelector('.tabs')?.classList.add('hidden'); document.querySelector('.thread-list')?.classList.add('hidden'); $('threadView')?.classList.add('hidden'); $('currentSection').textContent='INC. Sound Cards'; $('pageTitle').textContent='Sound Cards Map'; $('pageSubtitle').textContent='Carte musicali, preview, link e mappa concettuale per genere e affinità.'; renderSoundCards(); loadAdminBlocks(); }

async function loadSoundCards(){
  const { data, error } = await db.from('sound_cards').select('*').eq('is_hidden', false).order('created_at', {ascending:false}).limit(500);
  if (error) { console.warn('sound_cards:', error.message); return; }
  state.soundCards = data || [];
  renderSoundCards();
}

function soundCardMatches(card){
  if(!state.soundFilter) return true;
  const hay = [card.title, card.artist, card.description, card.main_genre, ...(card.genres||[]), ...(card.subgenres||[]), ...(card.collaborators||[]), ...(card.tags||[])].join(' ').toLowerCase();
  return hay.includes(state.soundFilter);
}

function renderSoundCards(){
  const cards = (state.soundCards || []).filter(soundCardMatches);
  renderSoundCardList(cards);
  renderSoundMap(cards);
}

function renderSoundCardList(cards){
  const host = $('soundCardList'); if(!host) return;
  host.innerHTML = cards.map(c=>`
    <article class="sound-card-mini" data-id="${c.id}">
      ${c.cover_url ? `<img src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}" loading="lazy">` : `<div class="mini-cover"></div>`}
      <div><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.artist)} · ${escapeHtml(c.main_genre || 'Senza genere')}</p></div>
      <div class="mini-actions">
        <a href="${escapeHtml(safeUrl(c.track_url))}" target="_blank" rel="noopener">Ascolta</a>
        <button type="button" data-open="${c.id}">Apri</button>
        ${isStaff()?`<button type="button" class="danger" data-hide="${c.id}">Nascondi</button>`:''}
      </div>
    </article>`).join('') || '<p class="muted small">Nessuna Sound Card trovata.</p>';
  host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSoundCardDetail(b.dataset.open)));
  host.querySelectorAll('[data-hide]').forEach(b=>b.addEventListener('click',()=>hideSoundCard(b.dataset.hide)));
}

function relationScore(a,b){
  let score = 0;
  if ((a.main_genre||'').toLowerCase() && (a.main_genre||'').toLowerCase()===(b.main_genre||'').toLowerCase()) score += .70;
  const A = lowerSet([...(a.genres||[]), ...(a.subgenres||[]), ...(a.collaborators||[]), ...(a.tags||[]), a.artist]);
  const B = lowerSet([...(b.genres||[]), ...(b.subgenres||[]), ...(b.collaborators||[]), ...(b.tags||[]), b.artist]);
  let shared=0; A.forEach(x=>{ if(B.has(x)) shared++; });
  score += Math.min(.28, shared * .07);
  return Math.min(1, score);
}

function buildSoundEdges(cards){
  const edges=[];
  const byGenre = new Map();
  cards.forEach(c=>{ const g=(c.main_genre||'Altro').toLowerCase(); if(!byGenre.has(g)) byGenre.set(g,[]); byGenre.get(g).push(c); });
  for(const group of byGenre.values()){
    for(let i=1;i<group.length;i++) edges.push({a:group[i-1].id,b:group[i].id,score:.88,type:'strong'});
  }
  const cross=[];
  for(let i=0;i<cards.length;i++) for(let j=i+1;j<cards.length;j++){
    const s=relationScore(cards[i],cards[j]);
    if(s>=.18 && (cards[i].main_genre||'').toLowerCase() !== (cards[j].main_genre||'').toLowerCase()) cross.push({a:cards[i].id,b:cards[j].id,score:s,type:s>.38?'medium':'weak'});
  }
  cross.sort((x,y)=>y.score-x.score);
  return edges.concat(cross.slice(0, Math.max(3, Math.ceil(cards.length*1.5))));
}

function positionCards(cards, w, h){
  const genres=[...new Set(cards.map(c=>c.main_genre||'Altro'))];
  const centers=new Map();
  const R=Math.min(w,h)*.30;
  genres.forEach((g,i)=>{ const a=(Math.PI*2*i/Math.max(1,genres.length))-Math.PI/2; centers.set(g,{x:w/2+Math.cos(a)*R,y:h/2+Math.sin(a)*R}); });
  const counts={};
  return cards.map((c)=>{
    const g=c.main_genre||'Altro'; const n=counts[g]=(counts[g]||0)+1; const center=centers.get(g); const a=n*2.399963; const r=36+18*Math.sqrt(n);
    return {...c, _x: Number(c.map_x) || center.x + Math.cos(a)*r, _y: Number(c.map_y) || center.y + Math.sin(a)*r};
  });
}

function renderSoundMap(cards){
  const host=$('soundMap'); if(!host) return;
  const rect = host.getBoundingClientRect(); const w = rect.width || 900, h = rect.height || 620;
  const placed = positionCards(cards, w, h); const byId = new Map(placed.map(c=>[c.id,c])); const edges = buildSoundEdges(placed);
  const lines = edges.map(e=>{ const a=byId.get(e.a), b=byId.get(e.b); if(!a||!b) return ''; const op=e.type==='strong'?'.72':e.type==='medium'?'.38':'.18'; const dash=e.type==='weak'?'6 8':'none'; const width=e.type==='strong'?'3':e.type==='medium'?'2':'1.3'; return `<line data-a="${e.a}" data-b="${e.b}" x1="${a._x}" y1="${a._y}" x2="${b._x}" y2="${b._y}" stroke="currentColor" stroke-width="${width}" stroke-opacity="${op}" stroke-dasharray="${dash}"/>`; }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines}</svg>` + placed.map(c=>`
    <article class="sound-node" data-id="${c.id}" style="left:${c._x}px;top:${c._y}px">
      ${c.cover_url ? `<img class="cover" src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}" loading="lazy">` : `<div class="cover"></div>`}
      <h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.artist)}</p><span class="genre-chip">${escapeHtml(c.main_genre || 'Altro')}</span>
    </article>`).join('');
  host.querySelectorAll('.sound-node').forEach(node=>makeSoundNodeDraggable(node, host));
}

function makeSoundNodeDraggable(node, host){
  let dragging=false, dx=0, dy=0;
  const id=node.dataset.id;
  node.addEventListener('dblclick',()=>openSoundCardDetail(id));
  node.addEventListener('pointerdown', e=>{ dragging=true; node.setPointerCapture(e.pointerId); const r=node.getBoundingClientRect(); dx=e.clientX-r.left-r.width/2; dy=e.clientY-r.top-r.height/2; });
  node.addEventListener('pointermove', e=>{ if(!dragging) return; const hr=host.getBoundingClientRect(); const x=e.clientX-hr.left-dx; const y=e.clientY-hr.top-dy; node.style.left=x+'px'; node.style.top=y+'px'; updateSoundLines(id,x,y,host); });
  node.addEventListener('pointerup', async e=>{ if(!dragging) return; dragging=false; try{ node.releasePointerCapture(e.pointerId); }catch{} if(isStaff()){ const x=parseFloat(node.style.left), y=parseFloat(node.style.top); await adminEdge('update-sound-card', { id, target_type:'sound_card', map_x:x, map_y:y }); } });
}
function updateSoundLines(id,x,y,host){ host.querySelectorAll(`line[data-a="${id}"]`).forEach(l=>{l.setAttribute('x1',x);l.setAttribute('y1',y);}); host.querySelectorAll(`line[data-b="${id}"]`).forEach(l=>{l.setAttribute('x2',x);l.setAttribute('y2',y);}); }

function openSoundCardComposer(){
  if(!state.user) return requireLogin();
  $('soundCardForm')?.reset(); $('soundCardMessage').textContent=''; $('soundCardDialog')?.showModal();
}

async function createSoundCard(e){
  e.preventDefault(); if(!state.user) return requireLogin();
  $('soundCardMessage').textContent='Salvataggio Sound Card...';
  const main = $('scMainGenre').value.trim();
  const sub = csv($('scSubgenres').value); const collabs = csv($('scCollaborators').value);
  const genres = [...new Set([main, ...sub].filter(Boolean))];
  const payload={ author_id:state.user.id, track_url:safeUrl($('scUrl').value.trim()), platform:platformFromUrl($('scUrl').value.trim()), preview_url:safeUrl($('scPreviewUrl').value.trim())||null, title:$('scTitle').value.trim(), artist:$('scArtist').value.trim(), description:$('scDescription').value.trim(), cover_url:safeUrl($('scCoverUrl').value.trim())||null, genres, main_genre:main, subgenres:sub, collaborators:collabs, tags:extractTags(`${$('scDescription').value} ${main} ${sub.join(' ')}`) };
  const { data, error } = await db.from('sound_cards').insert(payload).select('*').single();
  if(error){ $('soundCardMessage').textContent=error.message; return; }
  const cat = state.categories.find(c=>['musica','generale','feedback-brani'].includes(c.slug)) || state.categories[0];
  if(cat){
    await db.from('threads').insert({ category_id:cat.id, author_id:state.user.id, title:`Sound Card: ${payload.title} — ${payload.artist}`, body:payload.description || `Nuova Sound Card condivisa: ${payload.title} di ${payload.artist}.`, media_items:[{type:'sound_card', sound_card_id:data.id, url:payload.track_url, title:payload.title}], tags:payload.tags });
  }
  $('soundCardDialog')?.close(); await Promise.all([loadSoundCards(), loadThreads(), loadStats(), loadLivePanels()]); toast('Sound Card pubblicata e collegata al feed'); showSoundCardsMode();
}

function openSoundCardDetail(id){
  const c = state.soundCards.find(x=>x.id===id); if(!c) return;
  let dlg=$('soundDetailDialog');
  if(!dlg){ dlg=document.createElement('dialog'); dlg.id='soundDetailDialog'; dlg.className='modal'; document.body.appendChild(dlg); }
  const chips=[c.main_genre, ...(c.subgenres||[]), ...(c.collaborators||[])].filter(Boolean).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
  const preview = c.preview_url ? `<audio controls src="${escapeHtml(safeUrl(c.preview_url))}" style="width:100%;margin-top:12px"></audio>` : '';
  dlg.innerHTML=`<div class="modal-card"><button class="close-btn" type="button" id="closeSoundDetailBtn">×</button><div class="sound-modal-card">${c.cover_url?`<img class="sound-modal-cover" src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}">`:`<div class="sound-modal-cover"></div>`}<div><p class="eyebrow">${escapeHtml(c.platform||'Sound Card')}</p><h2>${escapeHtml(c.title)}</h2><h3>${escapeHtml(c.artist)}</h3><div class="sound-meta">${chips}</div><p class="muted">${escapeHtml(c.description||'Nessuna descrizione inserita.')}</p>${preview}<a class="primary-btn sound-platform-link" href="${escapeHtml(safeUrl(c.track_url))}" target="_blank" rel="noopener">Apri piattaforma</a></div></div></div>`;
  $('closeSoundDetailBtn').addEventListener('click',()=>dlg.close()); dlg.showModal();
}

async function hideSoundCard(id){
  if(!isAdmin()) return toast('Solo admin.');
  if(!confirm('Nascondere questa Sound Card dalla mappa?')) return;
  const { error } = await db.from('sound_cards').update({is_hidden:true}).eq('id',id);
  if(error) return toast(error.message); await loadSoundCards(); toast('Sound Card nascosta');
}

async function loadAdminBlocks(){
  const { data, error } = await db.from('admin_blocks').select('*').eq('is_active', true).order('sort_order');
  if(error){ console.warn('admin_blocks:', error.message); return; }
  state.adminBlocks=data||[]; renderAdminBlocks();
}
function renderAdminBlocks(){
  const host=$('adminBlocksHost'); if(!host) return;
  const loc = state.currentMode === 'sound' ? 'sound_top' : 'forum_top';
  const blocks=state.adminBlocks.filter(b=>b.location===loc);
  host.innerHTML = blocks.map(b=>`<section class="admin-block" data-block="${b.id}">${b.css?`<style>${b.css}</style>`:''}${b.html||''}</section>`).join('');
}
function openAdminEditor(){ if(!isAdmin()) return toast('Accesso admin richiesto.'); $('adminForm')?.reset(); $('adminPreview').innerHTML=''; $('adminMessage').textContent=''; $('adminDialog')?.showModal(); }
function insertAdminTemplate(){ $('adminHtml').value = `<div class="custom-card">\n  <p class="eyebrow">INC. Update</p>\n  <h2>Titolo blocco</h2>\n  <p>Testo del blocco admin. Puoi aggiungere link, immagini leggere o call-to-action.</p>\n</div>`; $('adminCss').value = `.custom-card{padding:22px;border-radius:18px;background:linear-gradient(135deg,rgba(255,79,216,.18),rgba(72,215,255,.10));border:1px solid rgba(255,255,255,.12)}\n.custom-card h2{margin:0 0 8px}`; previewAdminBlock(); }
function previewAdminBlock(){ $('adminPreview').innerHTML = `${$('adminCss').value?`<style>${$('adminCss').value}</style>`:''}${$('adminHtml').value}`; }
async function saveAdminBlock(e){
  e.preventDefault(); if(!isAdmin()) return toast('Solo admin.');
  $('adminMessage').textContent='Salvataggio...';
  const payload={title:$('adminBlockTitle').value.trim()||'Blocco admin', location:$('adminBlockLocation').value, html:$('adminHtml').value, css:$('adminCss').value, is_active:true, updated_by:state.user.id};
  const { error } = await db.from('admin_blocks').insert(payload);
  if(error){ $('adminMessage').textContent=error.message; return; }
  $('adminDialog')?.close(); await loadAdminBlocks(); toast('Blocco admin salvato');
}



/* ===================== INC FORUM V3.1: SOUND CARDS SEPARATE + SEGNALE MAP ===================== */
state.soundGenreFilter = 'all';

function isSoundCategory(cat){
  return ['sound-cards','soundcards','sound_cards'].includes(String(cat?.slug || '').toLowerCase()) || String(cat?.name || '').toLowerCase().includes('sound cards');
}

function bindV3Events(){
  $('navForum')?.addEventListener('click', e=>{ e.preventDefault(); showForumMode(); });
  $('navSoundCards')?.addEventListener('click', e=>{ e.preventDefault(); showSoundCardsMode(); });
  $('navAdmin')?.addEventListener('click', e=>{ e.preventDefault(); openAdminEditor(); });
  $('openSoundHubCard')?.addEventListener('click', e=>{ if(e.target?.id !== 'newSoundCardBtn') showSoundCardsMode(); });
  $('openSoundHubCard')?.addEventListener('keydown', e=>{ if(e.key === 'Enter') showSoundCardsMode(); });
  $('newSoundCardBtn')?.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); openSoundCardComposer(); });
  $('createSoundCardBtn')?.addEventListener('click', openSoundCardComposer);
  $('resetSoundMapBtn')?.addEventListener('click', ()=>{ clearManualSoundPositions(); renderSoundCards(); });
  $('centerSoundMapBtn')?.addEventListener('click', ()=>centerSoundMap());
  $('soundSearchInput')?.addEventListener('input', e=>{ state.soundFilter=e.target.value.trim().toLowerCase(); renderSoundCards(); });
  $('soundGenreFilter')?.addEventListener('change', e=>{ state.soundGenreFilter=e.target.value; renderSoundCards(); });
  $('soundCardForm')?.addEventListener('submit', createSoundCard);
  $('closeSoundCardBtn')?.addEventListener('click', ()=>$('soundCardDialog')?.close());
  $('cancelSoundCardBtn')?.addEventListener('click', ()=>$('soundCardDialog')?.close());
  $('adminForm')?.addEventListener('submit', saveAdminBlock);
  $('closeAdminBtn')?.addEventListener('click', ()=>$('adminDialog')?.close());
  $('cancelAdminBtn')?.addEventListener('click', ()=>$('adminDialog')?.close());
  $('insertAdminTemplateBtn')?.addEventListener('click', insertAdminTemplate);
  $('previewAdminBtn')?.addEventListener('click', previewAdminBlock);

  // Il pulsante "Brano / progetto" del composer NON deve più aprire una discussione normale.
  els.quickMusicBtn?.addEventListener('click', e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    openSoundCardComposer();
  }, true);
}

function renderCategories() {
  const visible = state.categories.filter(c=>!isSoundCategory(c));
  els.categoryList.innerHTML = visible.map(cat => `<button class="category-item ${cat.id===state.selectedCategoryId?'active':''}" type="button" data-id="${cat.id}"><span class="left"><span>${escapeHtml(cat.icon)}</span>${escapeHtml(cat.name)}</span><span class="pill">${cat.thread_count || 0}</span></button>`).join('');
  els.categoryList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    const cat = state.categories.find(c=>c.id===btn.dataset.id);
    if(!cat) return;
    state.selectedCategoryId = cat.id;
    state.selectedCategorySlug = cat.slug;
    showForumMode();
    renderCategories();
    updateHero(cat);
    renderThreads();
    closeThread();
  }));
  if(!visible.some(c=>c.id===state.selectedCategoryId) && visible[0]){
    state.selectedCategoryId = visible[0].id;
    state.selectedCategorySlug = visible[0].slug;
  }
  updateHero(state.categories.find(c=>c.id===state.selectedCategoryId));
}

function renderCategorySelect() {
  els.newCategory.innerHTML = state.categories.filter(c=>!isSoundCategory(c)).map(c=>`<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join('');
}

function showForumMode(){
  state.currentMode='forum';
  setNavActive('navForum');
  $('soundCardsSection')?.classList.add('hidden');
  document.querySelector('.hero-card')?.classList.remove('hidden');
  document.querySelector('.composer-card')?.classList.remove('hidden');
  document.querySelector('.tabs')?.classList.remove('hidden');
  document.querySelector('.thread-list')?.classList.remove('hidden');
  $('threadView')?.classList.toggle('hidden', !state.currentThread);
  updateHero(state.categories.find(c=>c.id===state.selectedCategoryId));
  loadAdminBlocks();
}

function showSoundCardsMode(){
  state.currentMode='sound';
  setNavActive('navSoundCards');
  $('soundCardsSection')?.classList.remove('hidden');
  document.querySelector('.hero-card')?.classList.add('hidden');
  document.querySelector('.composer-card')?.classList.add('hidden');
  document.querySelector('.tabs')?.classList.add('hidden');
  document.querySelector('.thread-list')?.classList.add('hidden');
  $('threadView')?.classList.add('hidden');
  renderSoundGenreFilter();
  renderSoundCards();
  loadAdminBlocks();
}

function soundCardMatches(card){
  const genreOK = !state.soundGenreFilter || state.soundGenreFilter === 'all' || String(card.main_genre || 'Altro') === state.soundGenreFilter;
  if(!genreOK) return false;
  if(!state.soundFilter) return true;
  const hay = [card.title, card.artist, card.description, card.main_genre, ...(card.genres||[]), ...(card.subgenres||[]), ...(card.collaborators||[]), ...(card.tags||[])].join(' ').toLowerCase();
  return hay.includes(state.soundFilter);
}

function renderSoundGenreFilter(){
  const select = $('soundGenreFilter'); if(!select) return;
  const genres = [...new Set((state.soundCards || []).map(c=>c.main_genre || 'Altro'))].sort((a,b)=>a.localeCompare(b));
  const current = select.value || 'all';
  select.innerHTML = `<option value="all">Tutti i generi</option>` + genres.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
  select.value = genres.includes(current) ? current : 'all';
  state.soundGenreFilter = select.value;
}

function renderSoundCards(){
  renderSoundGenreFilter();
  const cards = (state.soundCards || []).filter(soundCardMatches);
  renderSoundCardList(cards);
  renderSoundMap(cards);
}

function renderSoundCardList(cards){
  const host = $('soundCardList'); if(!host) return;
  host.innerHTML = cards.map(c=>`
    <article class="sound-card-mini signal-mini" data-id="${c.id}">
      ${c.cover_url ? `<img src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}" loading="lazy">` : `<div class="mini-cover">◆</div>`}
      <div><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.artist)} · ${escapeHtml(c.main_genre || 'Senza genere')}</p></div>
      <div class="mini-actions">
        <a href="${escapeHtml(safeUrl(c.track_url))}" target="_blank" rel="noopener">Ascolta</a>
        <button type="button" data-open="${c.id}">Apri card</button>
        ${isStaff()?`<button type="button" class="danger" data-hide="${c.id}">Nascondi</button>`:''}
      </div>
    </article>`).join('') || '<p class="muted small">Nessuna Sound Card trovata. Crea la prima: la mappa si genera appena esistono carte.</p>';
  host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSoundCardDetail(b.dataset.open)));
  host.querySelectorAll('[data-hide]').forEach(b=>b.addEventListener('click',()=>hideSoundCard(b.dataset.hide)));
}

function tokenSet(card){
  return lowerSet([...(card.genres||[]), ...(card.subgenres||[]), ...(card.collaborators||[]), ...(card.tags||[]), card.artist, card.metadata?.mood, card.metadata?.origin]);
}

function relationScore(a,b){
  let score = 0;
  const sameMain = String(a.main_genre||'').toLowerCase() === String(b.main_genre||'').toLowerCase() && String(a.main_genre||'').trim();
  if (sameMain) score += .74;
  const A = tokenSet(a), B = tokenSet(b);
  let shared=0; A.forEach(x=>{ if(B.has(x)) shared++; });
  score += Math.min(.32, shared * .08);
  return Math.min(1, score);
}

function buildSoundEdges(cards){
  const edges=[];
  const byGenre = new Map();
  cards.forEach(c=>{ const g=(c.main_genre||'Altro').toLowerCase(); if(!byGenre.has(g)) byGenre.set(g,[]); byGenre.get(g).push(c); });

  // MST locale per ogni isola di genere: collega ogni card alla più affine già presente.
  for(const group of byGenre.values()){
    if(group.length < 2) continue;
    const connected=[group[0]], remaining=group.slice(1);
    while(remaining.length){
      let best={i:0, a:connected[0], b:remaining[0], s:-1};
      connected.forEach(a=>remaining.forEach((b,i)=>{ const s=relationScore(a,b); if(s>best.s) best={i,a,b,s}; }));
      edges.push({a:best.a.id,b:best.b.id,score:Math.max(.82,best.s),type:'strong'});
      connected.push(best.b); remaining.splice(best.i,1);
    }
  }

  // Ponti tra isole: pochi, deboli/medi, solo se c'è affinità reale.
  const cross=[];
  for(let i=0;i<cards.length;i++) for(let j=i+1;j<cards.length;j++){
    if(String(cards[i].main_genre||'').toLowerCase() === String(cards[j].main_genre||'').toLowerCase()) continue;
    const s=relationScore(cards[i],cards[j]);
    if(s>=.08) cross.push({a:cards[i].id,b:cards[j].id,score:s,type:s>=.30?'medium':'weak'});
  }
  cross.sort((x,y)=>y.score-x.score);
  return edges.concat(cross.slice(0, Math.min(cross.length, Math.max(4, Math.ceil(cards.length*1.2)))));
}

function positionCards(cards, w, h){
  const genres=[...new Set(cards.map(c=>c.main_genre||'Altro'))];
  const centers=new Map();
  const R=Math.min(w,h)*.30;
  genres.forEach((g,i)=>{ const a=(Math.PI*2*i/Math.max(1,genres.length))-Math.PI/2; centers.set(g,{x:w/2+Math.cos(a)*R,y:h/2+Math.sin(a)*R}); });
  const counts={};
  return cards.map((c)=>{
    const g=c.main_genre||'Altro'; const n=counts[g]=(counts[g]||0)+1; const center=centers.get(g) || {x:w/2,y:h/2}; const a=n*2.399963; const r=80+44*Math.sqrt(n);
    const manualX = Number(c.map_x), manualY = Number(c.map_y);
    return {...c, _x: manualX || center.x + Math.cos(a)*r, _y: manualY || center.y + Math.sin(a)*r, _genreCx:center.x, _genreCy:center.y};
  });
}

function clearManualSoundPositions(){
  state.soundCards = state.soundCards.map(c=>({...c, map_x:null, map_y:null}));
}

function renderSoundMap(cards){
  const host=$('soundMap'); if(!host) return;
  const nodesLayer = $('soundNodes'); const linksSvg = $('soundLinks');
  if(!nodesLayer || !linksSvg) return;
  const rect = host.getBoundingClientRect(); const w = Math.max(rect.width || 900, 760), h = Math.max(rect.height || 680, 620);
  linksSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  linksSvg.setAttribute('width', w); linksSvg.setAttribute('height', h);

  if(!cards.length){
    linksSvg.innerHTML='';
    nodesLayer.innerHTML='<div class="sound-empty-map"><h3>Nessuna Sound Card</h3><p>Crea una card: apparirà qui come nodo della costellazione.</p></div>';
    return;
  }

  const placed = positionCards(cards, w, h); const byId = new Map(placed.map(c=>[c.id,c])); const edges = buildSoundEdges(placed);
  linksSvg.innerHTML = edges.map(e=>{ const a=byId.get(e.a), b=byId.get(e.b); if(!a||!b) return ''; return `<line class="sound-link ${e.type}" data-a="${e.a}" data-b="${e.b}" x1="${a._x}" y1="${a._y}" x2="${b._x}" y2="${b._y}"/>`; }).join('');
  nodesLayer.innerHTML = placed.map(c=>`
    <article class="sound-node signal-node" data-id="${c.id}" style="left:${c._x}px;top:${c._y}px">
      <div class="sound-node-cover">${c.cover_url ? `<img src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}" loading="lazy">` : `<span>◆</span>`}</div>
      <div class="sound-node-body">
        <strong class="sound-node-title">${escapeHtml(c.title)}</strong>
        <span class="sound-node-artist">${escapeHtml(c.artist)}</span>
        <div class="sound-node-tags"><span>${escapeHtml(c.main_genre || 'Altro')}</span>${(c.subgenres||[]).slice(0,2).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div>
      </div>
    </article>`).join('');
  nodesLayer.querySelectorAll('.sound-node').forEach(node=>makeSoundNodeDraggable(node, host));
}

function makeSoundNodeDraggable(node, host){
  let dragging=false, moved=false, dx=0, dy=0;
  const id=node.dataset.id;
  node.addEventListener('dblclick',()=>openSoundCardDetail(id));
  node.addEventListener('click',()=>{ if(!moved) openSoundCardDetail(id); });
  node.addEventListener('pointerdown', e=>{ dragging=true; moved=false; node.setPointerCapture(e.pointerId); const r=node.getBoundingClientRect(); dx=e.clientX-r.left-r.width/2; dy=e.clientY-r.top-r.height/2; });
  node.addEventListener('pointermove', e=>{ if(!dragging) return; moved=true; const hr=host.getBoundingClientRect(); const x=e.clientX-hr.left-dx; const y=e.clientY-hr.top-dy; node.style.left=x+'px'; node.style.top=y+'px'; updateSoundLines(id,x,y,host); });
  node.addEventListener('pointerup', async e=>{ if(!dragging) return; dragging=false; try{ node.releasePointerCapture(e.pointerId); }catch{} if(isStaff() && moved){ const x=parseFloat(node.style.left), y=parseFloat(node.style.top); await adminEdge('update-sound-card', { id, target_type:'sound_card', map_x:x, map_y:y }); } setTimeout(()=>{moved=false;},0); });
}

function centerSoundMap(){
  const host=$('soundMap'); if(!host) return;
  host.scrollTo?.({left:0, top:0, behavior:'smooth'});
}

async function createSoundCard(e){
  e.preventDefault(); if(!state.user) return requireLogin();
  $('soundCardMessage').textContent='Salvataggio Sound Card nella mappa...';
  const main = $('scMainGenre').value.trim();
  const sub = csv($('scSubgenres').value); const collabs = csv($('scCollaborators').value);
  const genres = [...new Set([main, ...sub].filter(Boolean))];
  const payload={
    author_id:state.user.id,
    track_url:safeUrl($('scUrl').value.trim()),
    platform:platformFromUrl($('scUrl').value.trim()),
    preview_url:safeUrl($('scPreviewUrl').value.trim())||null,
    title:$('scTitle').value.trim(),
    artist:$('scArtist').value.trim(),
    description:$('scDescription').value.trim(),
    cover_url:safeUrl($('scCoverUrl').value.trim())||null,
    genres,
    main_genre:main,
    subgenres:sub,
    collaborators:collabs,
    tags:extractTags(`${$('scDescription').value} ${main} ${sub.join(' ')} ${collabs.join(' ')}`)
  };
  const { data, error } = await db.from('sound_cards').insert(payload).select('*').single();
  if(error){ $('soundCardMessage').textContent=error.message; return; }

  // Feed generale: crea SOLO un riferimento social, non una categoria Sound Cards e non un thread mascherato da card.
  const cat = state.categories.find(c=>['musica','generale','feedback-brani'].includes(c.slug) && !isSoundCategory(c)) || state.categories.find(c=>!isSoundCategory(c));
  if(cat){
    await db.from('threads').insert({
      category_id:cat.id,
      author_id:state.user.id,
      title:`◆ ${payload.title} — ${payload.artist}`,
      body:`Sound Card pubblicata nella mappa Segnale 01.\n\n${payload.description || ''}`,
      media_items:[{type:'sound_card', sound_card_id:data.id, url:payload.track_url, title:payload.title}],
      tags:[...payload.tags, 'soundcard']
    });
  }
  $('soundCardDialog')?.close();
  await Promise.all([loadSoundCards(), loadThreads(), loadStats(), loadLivePanels()]);
  toast('Sound Card creata: ora è nella mappa Segnale 01');
  showSoundCardsMode();
}

function openSoundCardDetail(id){
  const c = state.soundCards.find(x=>x.id===id); if(!c) return;
  let dlg=$('soundDetailDialog');
  if(!dlg){ dlg=document.createElement('dialog'); dlg.id='soundDetailDialog'; dlg.className='modal'; document.body.appendChild(dlg); }
  const chips=[c.main_genre, ...(c.subgenres||[]), ...(c.collaborators||[])].filter(Boolean).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
  const preview = c.preview_url ? `<audio controls src="${escapeHtml(safeUrl(c.preview_url))}" style="width:100%;margin-top:18px"></audio>` : '';
  dlg.innerHTML=`<div class="modal-card sound-detail-shell"><button class="close-btn" type="button" id="closeSoundDetailBtn">×</button><div class="sound-modal-card signal-detail">${c.cover_url?`<img class="sound-modal-cover" src="${escapeHtml(c.cover_url)}" alt="${escapeHtml(c.title)}">`:`<div class="sound-modal-cover empty-cover">◆</div>`}<div><p class="eyebrow">${escapeHtml(c.platform||'Sound Card')}</p><h2>${escapeHtml(c.title)}</h2><h3>${escapeHtml(c.artist)}</h3><div class="sound-meta">${chips}</div><p class="muted">${escapeHtml(c.description||'Nessuna descrizione inserita.')}</p>${preview}<a class="sound-primary sound-platform-link" href="${escapeHtml(safeUrl(c.track_url))}" target="_blank" rel="noopener">Apri piattaforma</a></div></div></div>`;
  $('closeSoundDetailBtn').addEventListener('click',()=>dlg.close()); dlg.showModal();
}


/* ===================== INC FORUM V3.3: RUOLI, PROMO, PROFILI ESTESI, THREAD CLASSICO ===================== */
const RESERVED_CATEGORY_SLUGS = new Set(['sound-cards','soundcards','sound_cards']);
const ADMIN_ONLY_SLUGS = new Set(['annunci']);
const ARTIST_ONLY_SLUGS = new Set(['promozioni-release','promozioni-e-release','promozioni_release','release','promo-release']);
const HOMEPAGE_NEWS_TAG = 'homepage-news';

function userGroup(){
  return String(state.profile?.user_group || state.profile?.profile_type || state.profile?.role || 'user').toLowerCase();
}
function isArtist(){
  return isAdmin() || state.profile?.is_artist === true || userGroup() === 'artist' || String(state.profile?.role || '').toLowerCase() === 'artist';
}
function categoryById(id){ return state.categories.find(c=>c.id === id); }
function isReservedCategory(cat){ return RESERVED_CATEGORY_SLUGS.has(String(cat?.slug || '').toLowerCase()); }
function isAnnouncementCategory(cat){ return ADMIN_ONLY_SLUGS.has(String(cat?.slug || '').toLowerCase()); }
function isPromotionCategory(cat){ return ARTIST_ONLY_SLUGS.has(String(cat?.slug || '').toLowerCase()); }
function canCreateInCategory(cat){
  if(!cat || isReservedCategory(cat)) return false;
  if(isAnnouncementCategory(cat)) return isAdmin();
  if(isPromotionCategory(cat)) return isArtist();
  return !!state.user;
}
function categoryRestrictionText(cat){
  return '';
}

function renderRoleBadge(){
  const badge = $('userBadge'); if(!badge) return;
  badge.classList.remove('is-admin','is-artist');
  if(isAdmin()) badge.classList.add('is-admin');
  else if(isArtist()) badge.classList.add('is-artist');
}

const _renderAuthStateV33 = renderAuthState;
renderAuthState = function(){
  _renderAuthStateV33();
  renderRoleBadge();
};

renderCategories = function() {
  const visible = state.categories.filter(c=>!isReservedCategory(c));
  if (!visible.some(c=>c.id===state.selectedCategoryId) && visible[0]) {
    state.selectedCategoryId = visible[0].id;
    state.selectedCategorySlug = visible[0].slug;
  }
  els.categoryList.innerHTML = visible.map(cat => {
    const isActive = cat.id===state.selectedCategoryId;
    return `<button class="category-item ${isActive?'active':''}" type="button" data-id="${cat.id}">
      <span class="left"><span>${escapeHtml(cat.icon)}</span><span>${escapeHtml(cat.name)}</span></span>
      <span class="category-meta"><span class="pill">${cat.thread_count || 0}</span></span>
    </button>`;
  }).join('');
  els.categoryList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    const cat = state.categories.find(c=>c.id===btn.dataset.id);
    state.selectedCategoryId = cat.id;
    state.selectedCategorySlug = cat.slug;
    showForumMode();
    renderCategories();
    updateHero(cat);
    renderThreads();
    closeThread();
  }));
  updateHero(state.categories.find(c=>c.id===state.selectedCategoryId));
};

renderCategorySelect = function() {
  const visible = state.categories.filter(c=>!isReservedCategory(c));
  els.newCategory.innerHTML = visible.map(c=>{
    const blocked = state.user && !canCreateInCategory(c);
    return `<option value="${c.id}" ${blocked?'disabled':''}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`;
  }).join('');
};

updateHero = function(cat) {
  if (!cat) return;
  els.pageTitle.textContent = cat.name;
  els.pageSubtitle.textContent = cat.description || 'Discussioni della community.';
  els.currentSection.textContent = isPromotionCategory(cat) ? 'INC. Release Board' : 'INC. Forum';
  els.heroThreads.textContent = cat.thread_count || 0;
  els.heroPosts.textContent = cat.post_count || 0;
  const icon = document.querySelector('.category-icon');
  if(icon) icon.textContent = cat.icon || '🎛️';
};

function firstAllowedCategoryId(preferId){
  const visible = state.categories.filter(c=>!isReservedCategory(c));
  const preferred = visible.find(c=>c.id===preferId && canCreateInCategory(c));
  if(preferred) return preferred.id;
  const fallback = visible.find(canCreateInCategory);
  return fallback?.id || visible[0]?.id || '';
}

openThreadComposer = function(sourceId) {
  if (!state.user) return requireLogin();
  if (sourceId === 'quickMusicBtn') return openSoundCardComposer();
  const selected = categoryById(state.selectedCategoryId);
  if(selected && !canCreateInCategory(selected)){
    return toast('Non puoi pubblicare in questa sezione.');
  }
  state.threadMedia=[]; els.threadForm.reset(); els.threadMessage.textContent='';
  els.newCategory.value = firstAllowedCategoryId(state.selectedCategoryId);
  if (sourceId === 'quickPhotoBtn') setTimeout(()=>els.threadFiles.click(),100);
  if (sourceId === 'quickVideoBtn' || sourceId === 'quickLinkBtn') setTimeout(()=>openLinkDialog('thread'),100);
  renderMediaPreview('thread'); els.threadDialog.showModal();
};

const _createThreadV32 = createThread;
createThread = async function(e){
  e.preventDefault();
  if (!state.user) return requireLogin();
  const cat = categoryById(els.newCategory.value);
  if(!canCreateInCategory(cat)){
    els.threadMessage.textContent = 'Non puoi pubblicare in questa sezione.'; return;
  }
  return _createThreadV32(e);
};

function profileExtra(){ return state.profile?.profile_extra || {}; }
function artistProfile(){ return state.profile?.artist_profile || {}; }
function setInputValue(id, value){ const el=$(id); if(el) el.value = value || ''; }
function getInputValue(id){ return ($(id)?.value || '').trim(); }
function csvProfile(id){ return getInputValue(id).split(',').map(x=>x.trim()).filter(Boolean); }

openProfileEditor = function() {
  if (!state.user) return requireLogin();
  els.profileMessage.textContent='';
  els.profileDisplayName.value=state.profile?.display_name||'';
  els.profileUsername.value=state.profile?.username||'';
  els.profileBio.value=state.profile?.bio||'';
  els.profileTheme.value=state.profile?.theme||'dark';
  const links = state.profile?.social_links || {};
  Object.entries(els.links).forEach(([k,el])=>el.value=links[k]||'');
  const extra = profileExtra();
  setInputValue('profileHeadline', extra.headline);
  setInputValue('profileLocation', extra.location);
  setInputValue('profileSignature', extra.signature);
  setInputValue('profileInterests', Array.isArray(extra.interests)?extra.interests.join(', '):extra.interests);
  setInputValue('profileTools', Array.isArray(extra.tools)?extra.tools.join(', '):extra.tools);
  setInputValue('profileAvailableFor', Array.isArray(extra.available_for)?extra.available_for.join(', '):extra.available_for);
  const art = artistProfile();
  setInputValue('artistNameProfile', art.name);
  setInputValue('artistGenres', Array.isArray(art.genres)?art.genres.join(', '):art.genres);
  setInputValue('artistRoles', Array.isArray(art.roles)?art.roles.join(', '):art.roles);
  setInputValue('artistInfluences', Array.isArray(art.influences)?art.influences.join(', '):art.influences);
  setInputValue('artistLatestRelease', art.latest_release);
  setInputValue('artistBio', art.bio);
  renderAvatar(els.profilePreviewAvatar,state.profile,state.profile?.display_name);
  els.profileDialog.showModal();
};

saveProfile = async function(e) {
  e.preventDefault(); if(!state.user) return requireLogin(); els.profileMessage.textContent='Salvataggio profilo esteso...';
  let avatar_url = state.profile?.avatar_url || null;
  const file = els.avatarFile.files[0];
  if (file) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${state.user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { upsert:true, cacheControl:'3600' });
    if (error) { els.profileMessage.textContent = error.message; return; }
    avatar_url = db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const social_links = {}; Object.entries(els.links).forEach(([k,el])=>{ const u=safeUrl(el.value.trim()); if(u) social_links[k]=u; });
  const profile_extra = {
    headline:getInputValue('profileHeadline'),
    location:getInputValue('profileLocation'),
    signature:getInputValue('profileSignature'),
    interests:csvProfile('profileInterests'),
    tools:csvProfile('profileTools'),
    available_for:csvProfile('profileAvailableFor')
  };
  const artist_profile = {
    name:getInputValue('artistNameProfile'),
    genres:csvProfile('artistGenres'),
    roles:csvProfile('artistRoles'),
    influences:csvProfile('artistInfluences'),
    latest_release:getInputValue('artistLatestRelease'),
    bio:getInputValue('artistBio')
  };
  const update = { display_name:els.profileDisplayName.value.trim(), username:els.profileUsername.value.trim().toLowerCase() || null, bio:els.profileBio.value.trim(), theme:els.profileTheme.value, avatar_url, social_links, profile_extra, artist_profile, last_seen_at:new Date().toISOString() };
  const { error } = await db.from('profiles').update(update).eq('id', state.user.id);
  if (error) { els.profileMessage.textContent = error.message; return; }
  await loadProfile(); renderAuthState(); els.profileDialog.close(); toast('Profilo aggiornato'); await loadLivePanels();
};

function chipsHtml(values, max=4){
  return (values || []).filter(Boolean).slice(0,max).map(v=>`<span>${escapeHtml(v)}</span>`).join('');
}
function publicUserGroup(profile){
  if(!profile) return 'visitatore';
  if(profile.is_artist || String(profile.user_group||'').toLowerCase()==='artist' || String(profile.role||'').toLowerCase()==='artist') return 'artista';
  const g = String(profile.user_group || 'visitatore').toLowerCase();
  if(['scrittore','critico','ascoltatore','visitatore'].includes(g)) return g;
  return 'visitatore';
}
function groupDisplayName(group){
  const labels = {
    artista:'ARTISTA',
    scrittore:'SCRITTORE',
    critico:'CRITICO',
    ascoltatore:'ASCOLTATORE',
    visitatore:'VISITATORE'
  };
  return labels[group] || String(group || 'visitatore').toUpperCase();
}
function groupBadgeHtml(profile, role){
  const g = publicUserGroup(profile || {role});
  return `<span class="badge group-badge ${escapeHtml(g)}">${escapeHtml(groupDisplayName(g))}</span>`;
}
function profileFromOverview(row){
  return {
    display_name: row.author_name,
    avatar_url: row.author_avatar_url,
    role: row.author_role,
    user_group: row.author_user_group || row.user_group || row.profile_group,
    is_artist: row.author_is_artist || row.is_artist
  };
}
function forumUserCardHtml(profile, fallbackName, role){
  const extra = profile?.profile_extra || {};
  const art = profile?.artist_profile || {};
  const name = profile?.display_name || fallbackName || 'Utente';
  const artist = profile?.is_artist || String(profile?.user_group||'').toLowerCase()==='artist' || String(role||'').toLowerCase()==='artist';
  const avatarStyle = profile?.avatar_url ? `style="background-image:url('${escapeHtml(profile.avatar_url)}')"` : '';
  const genreChips = artist ? chipsHtml(art.genres || [], 3) : '';
  return `<aside class="forum-user-card">
    <div class="author-avatar xl" ${avatarStyle}>${profile?.avatar_url?'':initial(name)}</div>
    <strong>${escapeHtml(name)}</strong>
    ${groupBadgeHtml(profile || {role}, role)}
    ${extra.headline?`<p>${escapeHtml(extra.headline)}</p>`:''}
    ${extra.location?`<small>📍 ${escapeHtml(extra.location)}</small>`:''}
    ${genreChips?`<div class="forum-user-chips">${genreChips}</div>`:''}
  </aside>`;
}
async function fetchProfileById(id){
  if(!id) return null;
  const { data } = await db.from('profiles').select('id,display_name,username,avatar_url,role,user_group,is_artist,profile_extra,artist_profile,social_links').eq('id', id).maybeSingle();
  return data || null;
}

openThread = async function(id) {
  const t = state.threads.find(x=>x.id===id); if (!t) return; state.currentThread = t;
  els.threadView.classList.remove('hidden');
  els.breadcrumbCategory.textContent=t.category_name; els.threadTitle.textContent=t.title; els.threadMeta.textContent=`${t.author_name} · ${fmtDate(t.created_at)} · ${t.view_count || 0} visite`; els.threadBody.textContent=t.body; els.replyCount.textContent=t.reply_count || 0; renderMedia(els.threadMedia, mediaArray(t.media_items));
  const mainProfile = await fetchProfileById(t.author_id);
  const mainArticle = els.threadView.querySelector('.thread-main');
  if(mainArticle){
    mainArticle.classList.add('classic-thread-post');
    let card = mainArticle.querySelector('.forum-user-card');
    if(card) card.remove();
    mainArticle.insertAdjacentHTML('afterbegin', forumUserCardHtml(mainProfile, t.author_name, t.author_role));
  }
  await db.rpc('increment_thread_views', { thread_id_input: id });
  await loadPosts(id); els.threadView.scrollIntoView({behavior:'smooth',block:'start'});
};

loadPosts = async function(threadId) {
  const { data, error } = await db.from('post_overview').select('*').eq('thread_id', threadId).order('created_at');
  if (error) return toast('Errore risposte: ' + error.message);
  const rows = data || [];
  const profiles = new Map();
  for (const p of rows) {
    if (p.author_id && !profiles.has(p.author_id)) profiles.set(p.author_id, await fetchProfileById(p.author_id));
  }
  els.postsList.innerHTML = rows.map(p=>{
    const prof = profiles.get(p.author_id) || {display_name:p.author_name, avatar_url:p.author_avatar_url, role:p.author_role};
    const extra = prof?.profile_extra || {};
    return `<article class="post classic-reply-post">
      ${forumUserCardHtml(prof, p.author_name, p.author_role)}
      <div class="forum-post-content">
        <div class="author-row"><strong>${escapeHtml(p.author_name)}</strong><span class="muted small">${fmtDate(p.created_at)}</span></div>
        <div class="post-body">${escapeHtml(p.body)}</div>
        <div class="media-grid">${mediaHtml(mediaArray(p.media_items))}</div>
        ${extra.signature?`<div class="forum-signature">${escapeHtml(extra.signature)}</div>`:''}
      </div>
    </article>`;
  }).join('') || '<p class="muted" style="padding:20px 24px">Ancora nessuna risposta.</p>';
};


/* ===================== INC FORUM V3.4: ADMIN CONTROL PANEL, AUTO GROUPS, REACTIONS ===================== */
state.reactions = {};
state.adminUsers = [];
state.adminBlocksCache = [];
function reactionCounts(id){ return state.reactions[id] || {like:0, dislike:0, share:0}; }
function reactionBarHtml(threadId, compact=false){
  const r = reactionCounts(threadId);
  return `<div class="reaction-bar ${compact?'compact':''}" data-thread-reactions="${escapeHtml(threadId)}">
    <button class="reaction-btn" type="button" data-reaction="like" data-thread-id="${escapeHtml(threadId)}">👍 ${r.like||0}</button>
    <button class="reaction-btn" type="button" data-reaction="dislike" data-thread-id="${escapeHtml(threadId)}">👎 ${r.dislike||0}</button>
    <button class="reaction-btn" type="button" data-reaction="share" data-thread-id="${escapeHtml(threadId)}">↗ ${r.share||0}</button>
  </div>`;
}
async function loadReactions(){
  const ids = (state.threads || []).map(t=>t.id).filter(Boolean);
  state.reactions = {};
  if(!ids.length) return;
  const { data } = await db.from('thread_reaction_counts').select('*').in('thread_id', ids);
  (data || []).forEach(r=>{ state.reactions[r.thread_id] = {like:r.like_count||0, dislike:r.dislike_count||0, share:r.share_count||0}; });
}
async function reactThread(threadId, type){
  if(type === 'share'){
    const url = `${location.origin}${location.pathname}?thread=${encodeURIComponent(threadId)}`;
    try{ await navigator.clipboard.writeText(url); toast('Link discussione copiato.'); }catch{ toast('Link: ' + url); }
  }
  if(!state.user) return requireLogin();
  if(type === 'like' || type === 'dislike'){
    const { data: existing } = await db.from('thread_reactions').select('id,reaction_type').eq('thread_id', threadId).eq('user_id', state.user.id).in('reaction_type', ['like','dislike']);
    const same = (existing || []).find(r=>r.reaction_type === type);
    if(same){
      await db.from('thread_reactions').delete().eq('id', same.id);
    } else {
      await db.from('thread_reactions').delete().eq('thread_id', threadId).eq('user_id', state.user.id).in('reaction_type', ['like','dislike']);
      const { error } = await db.from('thread_reactions').insert({ thread_id:threadId, user_id:state.user.id, reaction_type:type });
      if(error) return toast(error.message);
    }
  } else {
    const { error } = await db.from('thread_reactions').upsert({ thread_id:threadId, user_id:state.user.id, reaction_type:type }, { onConflict:'thread_id,user_id,reaction_type' });
    if(error) return toast(error.message);
  }
  await loadReactions(); renderThreads();
  if(state.currentThread?.id === threadId) renderThreadReactionInView(threadId);
}
function bindReactionButtons(scope=document){
  scope.querySelectorAll('[data-reaction][data-thread-id]').forEach(btn=>{
    btn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); reactThread(btn.dataset.threadId, btn.dataset.reaction); });
  });
}
function renderThreadReactionInView(threadId){
  let host = $('threadReactionHost');
  if(!host){
    host = document.createElement('div'); host.id='threadReactionHost';
    els.threadMedia?.insertAdjacentElement('afterend', host);
  }
  host.innerHTML = reactionBarHtml(threadId);
  bindReactionButtons(host);
}

const _loadThreadsV34Base = loadThreads;
loadThreads = async function(){
  const { data, error } = await db.from('thread_overview').select('*').order('last_activity_at',{ascending:false}).limit(250);
  if (error) return toast('Errore discussioni: ' + error.message);
  state.threads = data || [];
  await loadReactions();
  renderThreads(); renderPopular();
};

renderThreads = function(){
  const items = filteredThreads();
  els.emptyThreads.classList.toggle('hidden', items.length>0);
  els.threadList.innerHTML = items.map(t => {
    const media = mediaArray(t.media_items);
    const admin = isStaff() ? `<div class="thread-admin-actions">
      <button type="button" data-admin-edit-thread="${escapeHtml(t.id)}">Modifica</button>
      <button type="button" data-admin-move-thread="${escapeHtml(t.id)}">Sposta</button>
      <button type="button" class="admin-danger" data-admin-delete-thread="${escapeHtml(t.id)}">Elimina</button>
    </div>` : '';
    const authorProfile = profileFromOverview(t);
    const hasPublicGroup = authorProfile.user_group || authorProfile.is_artist || String(authorProfile.role||'').toLowerCase()==='artist';
    const groupBadge = hasPublicGroup ? groupBadgeHtml(authorProfile, t.author_role) : '';
    return `<article class="thread-item" data-id="${escapeHtml(t.id)}">
      <div class="author-avatar" style="${t.author_avatar_url?`background-image:url('${escapeHtml(t.author_avatar_url)}')`:''}">${t.author_avatar_url?'':initial(t.author_name)}</div>
      <div>
        <div class="author-row"><a class="profile-link">${escapeHtml(t.author_name)}</a>${groupBadge}<span class="muted small">${fmtDate(t.created_at)}</span>${media.length?`<span class="media-badge">📎 ${media.length} media</span>`:''}</div>
        <h3>${escapeHtml(t.title)}</h3>
        <p>${escapeHtml(t.body || '').slice(0,190)}${(t.body || '').length>190?'…':''}</p>
        ${reactionBarHtml(t.id,true)}
        ${admin}
      </div>
      <div class="thread-stats"><span>💬 ${t.reply_count || 0}</span><span>👁 ${t.view_count || 0}</span></div>
    </article>`;
  }).join('');
  els.threadList.querySelectorAll('.thread-item').forEach(el => el.addEventListener('click', e => {
    if(e.target.closest('button,a,select,input,textarea')) return;
    openThread(el.dataset.id);
  }));
  bindReactionButtons(els.threadList);
  bindAdminThreadShortcutButtons(els.threadList);
};

const _openThreadV34Base = openThread;
openThread = async function(id){
  await _openThreadV34Base(id);
  renderThreadReactionInView(id);
};
async function openInitialThreadFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get('thread');
  if(!threadId) return;
  if(!state.threads.some(t=>t.id===threadId)) await loadThreads();
  if(state.threads.some(t=>t.id===threadId)) await openThread(threadId);
}

const _createReplyV34Base = createReply;
createReply = async function(e){
  await _createReplyV34Base(e);
  if(state.user) await db.rpc('recalculate_user_group', { user_id_input: state.user.id });
  await loadProfile(); renderAuthState();
};

const _createSoundCardV34Base = createSoundCard;
createSoundCard = async function(e){
  await _createSoundCardV34Base(e);
  if(state.user) await db.rpc('recalculate_user_group', { user_id_input: state.user.id });
  await loadProfile(); renderAuthState();
};

const _createThreadV34Base = createThread;
createThread = async function(e){
  const result = await _createThreadV34Base(e);
  if(state.user) await db.rpc('recalculate_user_group', { user_id_input: state.user.id });
  await loadProfile(); renderAuthState();
  return result;
};

const _openSoundCardDetailV34Base = openSoundCardDetail;
openSoundCardDetail = function(id){
  _openSoundCardDetailV34Base(id);
  recordSoundCardView(id);
};
async function recordSoundCardView(id){
  if(!state.user || !id) return;
  await db.from('sound_card_views').upsert({ sound_card_id:id, user_id:state.user.id }, { onConflict:'sound_card_id,user_id' });
  await db.rpc('recalculate_user_group', { user_id_input: state.user.id });
  await loadProfile(); renderAuthState();
}

const _renderAuthStateV34Base = renderAuthState;
renderAuthState = function(){
  _renderAuthStateV34Base();
  const badge = $('userBadge'); if(!badge) return;
  const g = publicUserGroup(state.profile);
  if(state.user && !badge.textContent.includes('·')) badge.textContent = `${badge.textContent} · ${groupDisplayName(g)}`;
};

function bindAdminThreadShortcutButtons(scope=document){
  scope.querySelectorAll('[data-admin-delete-thread]').forEach(btn=>btn.addEventListener('click', e=>{ e.stopPropagation(); adminDeleteThread(btn.dataset.adminDeleteThread); }));
  scope.querySelectorAll('[data-admin-edit-thread]').forEach(btn=>btn.addEventListener('click', e=>{ e.stopPropagation(); adminEditThread(btn.dataset.adminEditThread); }));
  scope.querySelectorAll('[data-admin-move-thread]').forEach(btn=>btn.addEventListener('click', e=>{ e.stopPropagation(); adminMoveThread(btn.dataset.adminMoveThread); }));
  scope.querySelectorAll('[data-admin-home-news]').forEach(btn=>btn.addEventListener('click', e=>{ e.stopPropagation(); adminToggleHomepageNews(btn.dataset.adminHomeNews); }));
}
function threadTags(thread){
  if(Array.isArray(thread?.tags)) return thread.tags.filter(Boolean).map(t=>String(t).trim()).filter(Boolean);
  if(typeof thread?.tags === 'string') return thread.tags.split(',').map(t=>t.trim()).filter(Boolean);
  return [];
}
function isHomepageNewsThread(thread){
  return threadTags(thread).map(t=>t.toLowerCase()).includes(HOMEPAGE_NEWS_TAG);
}
async function adminDeleteThread(id){
  if(!isAdmin()) return toast('Accesso admin richiesto.');
  const t = state.threads.find(x=>x.id===id); if(!t) return;
  if(!confirm(`Eliminare definitivamente la discussione: ${t.title}?`)) return;
  const { error } = await db.from('threads').delete().eq('id', id);
  if(error) return toast(error.message);
  if(state.currentThread?.id === id) closeThread();
  await Promise.all([loadThreads(), loadCategories(), loadStats(), loadLivePanels()]);
  toast('Discussione eliminata.');
}
async function adminEditThread(id){
  if(!isAdmin()) return toast('Accesso admin richiesto.');
  const t = state.threads.find(x=>x.id===id); if(!t) return;
  const title = prompt('Nuovo titolo:', t.title); if(title === null) return;
  const body = prompt('Nuovo testo:', t.body || ''); if(body === null) return;
  const { error } = await db.from('threads').update({ title:title.trim(), body:body.trim() }).eq('id', id);
  if(error) return toast(error.message);
  await loadThreads(); if(state.currentThread?.id===id) await openThread(id);
  toast('Discussione modificata.');
}
async function adminMoveThread(id){
  if(!isAdmin()) return toast('Accesso admin richiesto.');
  const t = state.threads.find(x=>x.id===id); if(!t) return;
  const visible = state.categories.filter(c=>!isReservedCategory(c));
  const msg = visible.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
  const raw = prompt(`Sposta in quale categoria?\n${msg}`, '1'); if(raw===null) return;
  const idx = Number(raw)-1; const cat = visible[idx]; if(!cat) return toast('Categoria non valida.');
  const { error } = await db.from('threads').update({ category_id:cat.id }).eq('id', id);
  if(error) return toast(error.message);
  await Promise.all([loadThreads(), loadCategories()]); toast('Discussione spostata.');
}
async function adminToggleHomepageNews(id){
  if(!isAdmin()) return toast('Accesso admin richiesto.');
  const t = state.threads.find(x=>x.id===id); if(!t) return;
  const { data: threadRow, error: fetchError } = await db.from('threads').select('tags').eq('id', id).maybeSingle();
  if(fetchError) return toast(fetchError.message);
  const currentThread = { ...t, tags: threadRow?.tags ?? t.tags };
  const tags = threadTags(currentThread);
  const active = isHomepageNewsThread(currentThread);
  const nextTags = active
    ? tags.filter(tag=>tag.toLowerCase()!==HOMEPAGE_NEWS_TAG)
    : [...tags.filter(tag=>tag.toLowerCase()!==HOMEPAGE_NEWS_TAG), HOMEPAGE_NEWS_TAG];
  const { error } = await db.from('threads').update({ tags: nextTags }).eq('id', id);
  if(error) return toast(error.message);
  await loadThreads();
  renderAdminThreads();
  toast(active ? 'Rimossa dalla bacheca News.' : 'Aggiunta alla bacheca News.');
}

/* Admin full dashboard */
function setAdminTab(name){
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active', b.dataset.adminTab===name));
  document.querySelectorAll('.admin-tab-panel').forEach(p=>p.classList.remove('active'));
  $('adminTab'+name.charAt(0).toUpperCase()+name.slice(1))?.classList.add('active');
}
function bindAdminControlEvents(){
  document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>setAdminTab(btn.dataset.adminTab)));
  $('refreshAdminPanelBtn')?.addEventListener('click', loadAdminDashboard);
  $('adminContentSearch')?.addEventListener('input', renderAdminThreads);
  $('adminContentCategory')?.addEventListener('change', renderAdminThreads);
  $('adminUserSearch')?.addEventListener('input', renderAdminUsers);
  $('recalcGroupsBtn')?.addEventListener('click', recalcAllGroups);
  $('adminCategoryForm')?.addEventListener('submit', adminCreateCategory);
  $('adminRulesForm')?.addEventListener('submit', adminSaveRules);
}
const _openAdminEditorV34Base = openAdminEditor;
openAdminEditor = function(){
  if(!isAdmin()) return toast('Accesso admin richiesto.');
  $('adminDialog')?.showModal();
  setAdminTab('contents');
  loadAdminDashboard();
};
async function loadAdminDashboard(){
  if(!isAdmin()) return;
  await Promise.all([loadThreads(), loadCategories(), loadAdminUsers(), loadAdminBlocksForPanel(), loadAdminRules()]);
  renderAdminCategoryFilter(); renderAdminThreads(); renderAdminUsers(); renderAdminCategories(); renderAdminBlocksPanel();
}
function renderAdminCategoryFilter(){
  const sel=$('adminContentCategory'); if(!sel) return;
  const current=sel.value || 'all';
  sel.innerHTML='<option value="all">Tutte le categorie</option>'+state.categories.filter(c=>!isReservedCategory(c)).map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join('');
  sel.value = [...sel.options].some(o=>o.value===current) ? current : 'all';
}
function renderAdminThreads(){
  const host=$('adminThreadsList'); if(!host) return;
  const q=($('adminContentSearch')?.value||'').toLowerCase().trim(); const cat=$('adminContentCategory')?.value||'all';
  let rows=[...state.threads];
  if(cat!=='all') rows=rows.filter(t=>t.category_id===cat);
  if(q) rows=rows.filter(t=>`${t.title} ${t.body} ${t.author_name}`.toLowerCase().includes(q));
  host.innerHTML=rows.slice(0,80).map(t=>`<div class="admin-row">
    <div><h4>${escapeHtml(t.title)}</h4><p>${escapeHtml(t.category_name||'')} · ${escapeHtml(t.author_name||'')} · ${fmtDate(t.created_at)} · ${t.reply_count||0} risposte · ${t.view_count||0} visite</p></div>
    <div class="admin-row-actions"><button type="button" data-admin-home-news="${escapeHtml(t.id)}">${isHomepageNewsThread(t)?'Togli da News':'Metti in News'}</button><button type="button" data-admin-edit-thread="${escapeHtml(t.id)}">Modifica</button><button type="button" data-admin-move-thread="${escapeHtml(t.id)}">Sposta</button><button type="button" class="admin-danger" data-admin-delete-thread="${escapeHtml(t.id)}">Elimina</button></div>
  </div>`).join('') || '<p class="muted">Nessun contenuto trovato.</p>';
  bindAdminThreadShortcutButtons(host);
}
async function loadAdminUsers(){
  const { data, error } = await db.from('profiles').select('id,display_name,username,role,user_group,is_artist,last_seen_at,created_at,profile_extra,artist_profile').order('created_at',{ascending:false}).limit(300);
  if(error){ toast(error.message); return; }
  state.adminUsers = data || [];
}
function renderAdminUsers(){
  const host=$('adminUsersList'); if(!host) return;
  const q=($('adminUserSearch')?.value||'').toLowerCase().trim();
  let rows=[...state.adminUsers];
  if(q) rows=rows.filter(u=>`${u.display_name} ${u.username} ${u.role} ${u.user_group}`.toLowerCase().includes(q));
  const groups=['visitatore','ascoltatore','critico','scrittore','artist'];
  host.innerHTML=rows.map(u=>`<div class="admin-row">
    <div><h4>${escapeHtml(u.display_name||u.username||'Utente')}</h4><p>@${escapeHtml(u.username||'—')} · ruolo: ${escapeHtml(u.role||'user')} · gruppo: ${escapeHtml(u.user_group||'visitatore')} ${u.is_artist?'· artista verificato':''}</p><span class="user-group-note">Auto: ascoltatore ≥10 Sound Cards aperte; critico ≥20 commenti a post altrui; scrittore ≥50 discussioni. Artista è manuale.</span></div>
    <div class="admin-row-actions">
      <select data-user-group="${escapeHtml(u.id)}">${groups.map(g=>`<option value="${g}" ${String(u.user_group||'')===g?'selected':''}>${g}</option>`).join('')}</select>
      <button type="button" data-toggle-artist="${escapeHtml(u.id)}">${u.is_artist?'Togli artista':'Rendi artista'}</button>
      <button type="button" data-make-admin="${escapeHtml(u.id)}">Admin</button>
    </div>
  </div>`).join('') || '<p class="muted">Nessun utente.</p>';
  host.querySelectorAll('[data-user-group]').forEach(sel=>sel.addEventListener('change',()=>adminSetUserGroup(sel.dataset.userGroup, sel.value)));
  host.querySelectorAll('[data-toggle-artist]').forEach(btn=>btn.addEventListener('click',()=>adminToggleArtist(btn.dataset.toggleArtist)));
  host.querySelectorAll('[data-make-admin]').forEach(btn=>btn.addEventListener('click',()=>adminMakeAdmin(btn.dataset.makeAdmin)));
}
async function adminSetUserGroup(id, group){
  if(!isAdmin()) return;
  const patch = group==='artist' ? {user_group:'artist', is_artist:true} : {user_group:group, is_artist:false};
  const { error } = await db.from('profiles').update(patch).eq('id',id); if(error) return toast(error.message);
  await loadAdminUsers(); renderAdminUsers(); toast('Gruppo aggiornato.');
}
async function adminToggleArtist(id){
  const u=state.adminUsers.find(x=>x.id===id); if(!u) return;
  const patch = {is_artist:!u.is_artist, user_group:!u.is_artist?'artist':'visitatore'};
  const { error } = await db.from('profiles').update(patch).eq('id',id); if(error) return toast(error.message);
  await loadAdminUsers(); renderAdminUsers(); toast('Stato artista aggiornato.');
}
async function adminMakeAdmin(id){
  if(!confirm('Dare ruolo admin a questo utente?')) return;
  const { error } = await db.from('profiles').update({role:'admin'}).eq('id',id); if(error) return toast(error.message);
  await loadAdminUsers(); renderAdminUsers(); toast('Utente promosso admin.');
}
async function recalcAllGroups(){
  const { error } = await db.rpc('recalculate_all_user_groups');
  if(error) return toast(error.message);
  await loadAdminUsers(); renderAdminUsers(); toast('Gruppi automatici ricalcolati.');
}
function renderAdminCategories(){
  const host=$('adminCategoriesList'); if(!host) return;
  host.innerHTML=state.categories.filter(c=>!isReservedCategory(c)).map(c=>`<div class="admin-row">
    <div><h4>${escapeHtml(c.icon||'◆')} ${escapeHtml(c.name)}</h4><p>${escapeHtml(c.slug)} · ordine ${c.sort_order ?? '—'} · ${escapeHtml(c.description||'')}</p></div>
    <div class="admin-row-actions"><button type="button" data-edit-category="${escapeHtml(c.id)}">Modifica</button><button type="button" class="admin-danger" data-delete-category="${escapeHtml(c.id)}">Elimina</button></div>
  </div>`).join('');
  host.querySelectorAll('[data-edit-category]').forEach(b=>b.addEventListener('click',()=>adminEditCategory(b.dataset.editCategory)));
  host.querySelectorAll('[data-delete-category]').forEach(b=>b.addEventListener('click',()=>adminDeleteCategory(b.dataset.deleteCategory)));
}
async function adminCreateCategory(e){
  e.preventDefault(); if(!isAdmin()) return;
  const payload={name:getInputValue('adminCategoryName'), slug:getInputValue('adminCategorySlug').toLowerCase(), icon:getInputValue('adminCategoryIcon')||'forum', sort_order:Number(getInputValue('adminCategorySort')||50), description:'Categoria creata dal pannello admin.'};
  const { error } = await db.from('categories').insert(payload); if(error) return toast(error.message);
  $('adminCategoryForm')?.reset(); await loadCategories(); renderAdminCategories(); renderAdminCategoryFilter(); toast('Categoria creata.');
}
async function adminEditCategory(id){
  const c=state.categories.find(x=>x.id===id); if(!c) return;
  const name=prompt('Nome categoria:', c.name); if(name===null) return;
  const desc=prompt('Descrizione:', c.description||''); if(desc===null) return;
  const { error } = await db.from('categories').update({name:name.trim(), description:desc.trim()}).eq('id',id); if(error) return toast(error.message);
  await loadCategories(); renderAdminCategories(); renderCategories(); toast('Categoria aggiornata.');
}
async function adminDeleteCategory(id){
  if(!confirm('Eliminare categoria? Fallirà se contiene discussioni protette da vincoli.')) return;
  const { error } = await db.from('categories').delete().eq('id',id); if(error) return toast(error.message);
  await loadCategories(); renderAdminCategories(); renderCategories(); toast('Categoria eliminata.');
}
async function loadAdminBlocksForPanel(){
  const { data } = await db.from('admin_blocks').select('*').order('created_at',{ascending:false}).limit(100);
  state.adminBlocksCache = data || [];
}
function renderAdminBlocksPanel(){
  const host=$('adminBlocksList'); if(!host) return;
  host.innerHTML=(state.adminBlocksCache||[]).map(b=>`<div class="admin-row"><div><h4>${escapeHtml(b.title||'Blocco')}</h4><p>${escapeHtml(b.location||'')} · ${b.is_active?'attivo':'disattivato'}</p></div><div class="admin-row-actions"><button type="button" data-toggle-block="${escapeHtml(b.id)}">${b.is_active?'Disattiva':'Attiva'}</button><button type="button" class="admin-danger" data-delete-block="${escapeHtml(b.id)}">Elimina</button></div></div>`).join('') || '<p class="muted">Nessun blocco salvato.</p>';
  host.querySelectorAll('[data-toggle-block]').forEach(btn=>btn.addEventListener('click',()=>adminToggleBlock(btn.dataset.toggleBlock)));
  host.querySelectorAll('[data-delete-block]').forEach(btn=>btn.addEventListener('click',()=>adminDeleteBlock(btn.dataset.deleteBlock)));
}
async function adminToggleBlock(id){ const b=state.adminBlocksCache.find(x=>x.id===id); if(!b)return; const {error}=await db.from('admin_blocks').update({is_active:!b.is_active}).eq('id',id); if(error)return toast(error.message); await loadAdminBlocksForPanel(); renderAdminBlocksPanel(); await loadAdminBlocks(); }
async function adminDeleteBlock(id){ if(!confirm('Eliminare blocco HTML/CSS?'))return; const {error}=await db.from('admin_blocks').delete().eq('id',id); if(error)return toast(error.message); await loadAdminBlocksForPanel(); renderAdminBlocksPanel(); await loadAdminBlocks(); }
async function loadAdminRules(){
  const { data } = await db.from('site_settings').select('*').eq('key','rules').maybeSingle();
  const v=data?.value || {}; setInputValue('siteRulesTitle', v.title||'Regolamento INC. Forum'); setInputValue('siteRulesBody', v.body||'');
}
async function adminSaveRules(e){
  e.preventDefault(); if(!isAdmin()) return;
  const value={title:getInputValue('siteRulesTitle'), body:getInputValue('siteRulesBody'), updated_at:new Date().toISOString()};
  const { error } = await db.from('site_settings').upsert({key:'rules', value}, {onConflict:'key'}); if(error) return toast(error.message);
  toast('Regole salvate.');
}

const _bindV3EventsV34Base = bindV3Events;
bindV3Events = function(){
  _bindV3EventsV34Base();
  bindAdminControlEvents();
};

/* ===================== INC FORUM EDGE FUNCTIONS GATEWAY ===================== */
async function forumApi(action, payload = {}) {
  const { data: sessionData } = await db.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Devi accedere per questa azione.');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/forum-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action, payload })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const meta = [data?.code, data?.details, data?.hint].filter(Boolean).join(' · ');
    throw new Error((data?.error || `Edge Function HTTP ${response.status}`) + (meta ? ` (${meta})` : ''));
  }
  return data?.data ?? data;
}

async function createSignedForumUpload(file, folder = 'media') {
  const signed = await forumApi('signed-upload', {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    folder
  });
  const { error } = await db.storage.from(STORAGE_BUCKET).uploadToSignedUrl(signed.path, signed.token, file);
  if (error) throw error;
  const publicUrl = db.storage.from(STORAGE_BUCKET).getPublicUrl(signed.path).data.publicUrl;
  return { type: 'image', url: publicUrl, path: signed.path, title: file.name || 'Immagine' };
}

function currentSocialLinks() {
  const social_links = {};
  Object.entries(els.links).forEach(([key, el]) => {
    const url = safeUrl(el?.value?.trim() || '');
    if (url) social_links[key] = url;
  });
  return social_links;
}

uploadPendingMedia = async function(target) {
  const result = [];
  for (const item of state[target + 'Media']) {
    if (item.type === 'image_pending' && item.file) {
      try {
        result.push(await createSignedForumUpload(item.file, target === 'reply' ? 'replies' : 'threads'));
      } catch (error) {
        toast('Upload rifiutato: ' + error.message);
      }
    } else {
      result.push(normalizeMedia(item));
    }
  }
  return result;
};

createThread = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  const cat = categoryById(els.newCategory.value);
  if (!canCreateInCategory(cat)) {
    els.threadMessage.textContent = 'Non puoi pubblicare in questa sezione.';
    return;
  }
  els.threadMessage.textContent = 'Controllo sicurezza e pubblicazione via Edge Function...';
  try {
    const media = await uploadPendingMedia('thread');
    const title = els.newTitle.value.trim();
    const body = els.newBody.value.trim();
    const response = await forumApi('create-thread', {
      category_id: els.newCategory.value,
      title,
      body,
      media_items: media,
      tags: extractTags(`${title} ${body}`)
    });
    els.threadDialog.close();
    state.threadMedia = [];
    await Promise.all([loadThreads(), loadCategories(), loadStats(), loadLivePanels()]);
    toast(response?.moderation_status === 'pending' ? 'Post inviato in moderazione anti-spam.' : 'Discussione pubblicata su INC. Forum');
  } catch (error) {
    els.threadMessage.textContent = error.message;
  }
};

createReply = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  if (!state.currentThread) return;
  try {
    const media = await uploadPendingMedia('reply');
    await forumApi('create-reply', {
      thread_id: state.currentThread.id,
      body: els.replyBody.value.trim(),
      media_items: media
    });
    els.replyForm.reset();
    state.replyMedia = [];
    renderMediaPreview('reply');
    await Promise.all([loadPosts(state.currentThread.id), loadThreads(), loadStats(), loadLivePanels()]);
    toast('Risposta pubblicata');
  } catch (error) {
    toast(error.message);
  }
};

saveProfile = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  els.profileMessage.textContent = 'Salvataggio profilo via Edge Function...';
  try {
    let avatar_url = state.profile?.avatar_url || null;
    const file = els.avatarFile.files[0];
    if (file) {
      const uploaded = await createSignedForumUpload(file, 'avatars');
      avatar_url = uploaded.url;
    }
    const profile_extra = {
      headline: getInputValue('profileHeadline'),
      location: getInputValue('profileLocation'),
      signature: getInputValue('profileSignature'),
      interests: csvProfile('profileInterests'),
      tools: csvProfile('profileTools'),
      available_for: csvProfile('profileAvailableFor')
    };
    const artist_profile = {
      name: getInputValue('artistNameProfile'),
      genres: csvProfile('artistGenres'),
      roles: csvProfile('artistRoles'),
      influences: csvProfile('artistInfluences'),
      latest_release: getInputValue('artistLatestRelease'),
      bio: getInputValue('artistBio')
    };
    await forumApi('update-profile', {
      display_name: els.profileDisplayName.value.trim(),
      username: els.profileUsername.value.trim().toLowerCase() || null,
      bio: els.profileBio.value.trim(),
      theme: els.profileTheme.value,
      avatar_url,
      social_links: currentSocialLinks(),
      profile_extra,
      artist_profile
    });
    await loadProfile();
    renderAuthState();
    els.profileDialog.close();
    toast('Profilo aggiornato');
    await loadLivePanels();
  } catch (error) {
    els.profileMessage.textContent = error.message;
  }
};

createSoundCard = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  $('soundCardMessage').textContent = 'Controllo piattaforma e salvataggio Sound Card via Edge Function...';
  try {
    const main = $('scMainGenre').value.trim();
    const sub = csv($('scSubgenres').value);
    const collabs = csv($('scCollaborators').value);
    const payload = {
      track_url: safeUrl($('scUrl').value.trim()),
      platform: platformFromUrl($('scUrl').value.trim()),
      preview_url: safeUrl($('scPreviewUrl').value.trim()) || null,
      title: $('scTitle').value.trim(),
      artist: $('scArtist').value.trim(),
      description: $('scDescription').value.trim(),
      cover_url: safeUrl($('scCoverUrl').value.trim()) || null,
      genres: [...new Set([main, ...sub].filter(Boolean))],
      main_genre: main,
      subgenres: sub,
      collaborators: collabs,
      tags: extractTags(`${$('scDescription').value} ${main} ${sub.join(' ')} ${collabs.join(' ')}`)
    };
    await forumApi('create-sound-card', payload);
    $('soundCardDialog')?.close();
    await Promise.all([loadSoundCards(), loadThreads(), loadStats(), loadLivePanels()]);
    toast('Sound Card creata tramite Edge Function');
    showSoundCardsMode();
  } catch (error) {
    $('soundCardMessage').textContent = error.message;
  }
};

recordSoundCardView = async function(id) {
  if (!state.user || !id) return;
  try {
    await forumApi('record-sound-card-view', { sound_card_id: id });
    await loadProfile();
    renderAuthState();
  } catch (error) {
    console.warn('record-sound-card-view:', error.message);
  }
};

async function adminEdge(op, payload = {}) {
  return forumApi('admin-action', { op, ...payload });
}

function isModerator() {
  return state.profile?.role === 'moderator';
}

function isStaff() {
  return isAdmin() || isModerator();
}

const _renderAuthStateEdgeBase = renderAuthState;
renderAuthState = function() {
  _renderAuthStateEdgeBase();
  const navAdmin = $('navAdmin');
  if (navAdmin) navAdmin.classList.toggle('hidden', !isStaff());
};

openAdminEditor = function() {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  $('adminDialog')?.showModal();
  setAdminTab('contents');
  loadAdminDashboard();
};

loadAdminUsers = async function() {
  try {
    const data = await forumApi('get-admin-dashboard');
    state.adminUsers = data.users || [];
    state.adminEvents = data.events || [];
    state.adminReports = data.reports || [];
  } catch (error) {
    toast(error.message);
  }
};

adminDeleteThread = async function(id) {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  const t = state.threads.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`Nascondere la discussione: ${t.title}?`)) return;
  try {
    await adminEdge('update-thread', { id, target_type: 'thread', is_deleted: true });
    if (state.currentThread?.id === id) closeThread();
    await Promise.all([loadThreads(), loadCategories(), loadStats(), loadLivePanels()]);
    renderAdminThreads();
    toast('Discussione nascosta e tracciata nel log moderazione.');
  } catch (error) {
    toast(error.message);
  }
};

adminEditThread = async function(id) {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  const t = state.threads.find(x => x.id === id);
  if (!t) return;
  const title = prompt('Nuovo titolo:', t.title);
  if (title === null) return;
  const body = prompt('Nuovo testo:', t.body || '');
  if (body === null) return;
  try {
    await adminEdge('update-thread', { id, target_type: 'thread', title: title.trim(), body: body.trim() });
    await loadThreads();
    if (state.currentThread?.id === id) await openThread(id);
    renderAdminThreads();
    toast('Discussione modificata.');
  } catch (error) {
    toast(error.message);
  }
};

adminMoveThread = async function(id) {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  const visible = state.categories.filter(c => !isReservedCategory(c));
  const msg = visible.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
  const raw = prompt(`Sposta in quale categoria?\n${msg}`, '1');
  if (raw === null) return;
  const cat = visible[Number(raw) - 1];
  if (!cat) return toast('Categoria non valida.');
  try {
    await adminEdge('update-thread', { id, target_type: 'thread', category_id: cat.id });
    await Promise.all([loadThreads(), loadCategories()]);
    renderAdminThreads();
    toast('Discussione spostata.');
  } catch (error) {
    toast(error.message);
  }
};

adminToggleHomepageNews = async function(id) {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  const t = state.threads.find(x => x.id === id);
  if (!t) return;
  const tags = threadTags(t);
  const active = isHomepageNewsThread(t);
  const nextTags = active
    ? tags.filter(tag => tag.toLowerCase() !== HOMEPAGE_NEWS_TAG)
    : [...tags.filter(tag => tag.toLowerCase() !== HOMEPAGE_NEWS_TAG), HOMEPAGE_NEWS_TAG];
  try {
    await adminEdge('update-thread', { id, target_type: 'thread', tags: nextTags });
    await loadThreads();
    renderAdminThreads();
    toast(active ? 'Rimossa dalla bacheca News.' : 'Aggiunta alla bacheca News.');
  } catch (error) {
    toast(error.message);
  }
};

hideSoundCard = async function(id) {
  if (!isStaff()) return toast('Accesso staff richiesto.');
  if (!confirm('Nascondere questa Sound Card dalla mappa?')) return;
  try {
    await adminEdge('hide-sound-card', { id, target_type: 'sound_card' });
    await loadSoundCards();
    toast('Sound Card nascosta');
  } catch (error) {
    toast(error.message);
  }
};

adminSetUserGroup = async function(id, group) {
  if (!isAdmin()) return;
  const patch = group === 'artist' ? { user_group: 'artist', is_artist: true } : { user_group: group, is_artist: false };
  try {
    await adminEdge('update-user', { id, target_type: 'profile', patch });
    await loadAdminUsers();
    renderAdminUsers();
    toast('Gruppo aggiornato.');
  } catch (error) {
    toast(error.message);
  }
};

adminToggleArtist = async function(id) {
  const u = state.adminUsers.find(x => x.id === id);
  if (!u) return;
  const patch = { is_artist: !u.is_artist, user_group: !u.is_artist ? 'artist' : 'visitatore' };
  try {
    await adminEdge('update-user', { id, target_type: 'profile', patch });
    await loadAdminUsers();
    renderAdminUsers();
    toast('Stato artista aggiornato.');
  } catch (error) {
    toast(error.message);
  }
};

adminMakeAdmin = async function(id) {
  if (!confirm('Dare ruolo admin a questo utente?')) return;
  try {
    await adminEdge('update-user', { id, target_type: 'profile', patch: { role: 'admin' } });
    await loadAdminUsers();
    renderAdminUsers();
    toast('Utente promosso admin.');
  } catch (error) {
    toast(error.message);
  }
};

adminCreateCategory = async function(e) {
  e.preventDefault();
  if (!isAdmin()) return;
  try {
    await adminEdge('category-upsert', {
      target_type: 'category',
      name: getInputValue('adminCategoryName'),
      slug: getInputValue('adminCategorySlug').toLowerCase(),
      icon: getInputValue('adminCategoryIcon') || 'forum',
      sort_order: Number(getInputValue('adminCategorySort') || 50),
      description: 'Categoria creata dal pannello admin.'
    });
    $('adminCategoryForm')?.reset();
    await loadCategories();
    renderAdminCategories();
    renderAdminCategoryFilter();
    toast('Categoria creata.');
  } catch (error) {
    toast(error.message);
  }
};

adminEditCategory = async function(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return;
  const name = prompt('Nome categoria:', c.name);
  if (name === null) return;
  const desc = prompt('Descrizione:', c.description || '');
  if (desc === null) return;
  try {
    await adminEdge('category-upsert', {
      id,
      target_type: 'category',
      name: name.trim(),
      slug: c.slug,
      icon: c.icon || 'forum',
      sort_order: c.sort_order ?? 50,
      description: desc.trim()
    });
    await loadCategories();
    renderAdminCategories();
    renderCategories();
    toast('Categoria aggiornata.');
  } catch (error) {
    toast(error.message);
  }
};

adminDeleteCategory = async function(id) {
  if (!confirm('Eliminare categoria? Fallira se contiene discussioni protette da vincoli.')) return;
  try {
    await adminEdge('category-delete', { id, target_type: 'category' });
    await loadCategories();
    renderAdminCategories();
    renderCategories();
    toast('Categoria eliminata.');
  } catch (error) {
    toast(error.message);
  }
};

saveAdminBlock = async function(e) {
  e.preventDefault();
  if (!isAdmin()) return toast('Solo admin.');
  $('adminMessage').textContent = 'Salvataggio via Edge Function...';
  try {
    await adminEdge('admin-block-upsert', {
      target_type: 'admin_block',
      title: $('adminBlockTitle').value.trim() || 'Blocco admin',
      location: $('adminBlockLocation').value,
      html: $('adminHtml').value,
      css: $('adminCss').value,
      is_active: true
    });
    $('adminMessage').textContent = 'Blocco salvato.';
    $('adminForm')?.reset();
    $('adminPreview').innerHTML = '';
    await loadAdminBlocksForPanel();
    renderAdminBlocksPanel();
    await loadAdminBlocks();
  } catch (error) {
    $('adminMessage').textContent = error.message;
  }
};

adminToggleBlock = async function(id) {
  const b = state.adminBlocksCache.find(x => x.id === id);
  if (!b) return;
  try {
    await adminEdge('admin-block-upsert', { id, target_type: 'admin_block', ...b, is_active: !b.is_active });
    await loadAdminBlocksForPanel();
    renderAdminBlocksPanel();
    await loadAdminBlocks();
  } catch (error) {
    toast(error.message);
  }
};

adminDeleteBlock = async function(id) {
  if (!confirm('Eliminare blocco HTML/CSS?')) return;
  try {
    await adminEdge('admin-block-delete', { id, target_type: 'admin_block' });
    await loadAdminBlocksForPanel();
    renderAdminBlocksPanel();
    await loadAdminBlocks();
  } catch (error) {
    toast(error.message);
  }
};

adminSaveRules = async function(e) {
  e.preventDefault();
  if (!isAdmin()) return;
  try {
    await adminEdge('save-rules', {
      target_type: 'site_settings',
      value: {
        title: getInputValue('siteRulesTitle'),
        body: getInputValue('siteRulesBody'),
        updated_at: new Date().toISOString()
      }
    });
    toast('Regole salvate.');
  } catch (error) {
    toast(error.message);
  }
};

/* ===================== INC FORUM V4: PRO COMPOSER + ROLE PROFILES ===================== */
const THREAD_DRAFT_KEY = 'incForumThreadDraftV4';

function manualTagsFromInput() {
  const input = $('newTags');
  if (!input) return [];
  return String(input.value || '')
    .split(/[,\s]+/)
    .map(tag => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function mergedThreadTags(title, body) {
  return [...new Set([...manualTagsFromInput(), ...extractTags(`${title} ${body}`)])].slice(0, 12);
}

function markdownLite(text = '') {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>');
}

function updateComposerCounters() {
  const title = $('newTitle')?.value || '';
  const body = $('newBody')?.value || '';
  if ($('titleCounter')) $('titleCounter').textContent = `${title.length}/120`;
  if ($('bodyCounter')) $('bodyCounter').textContent = `${body.length}/6000`;
  if ($('titleValidation')) $('titleValidation').textContent = title.trim().length >= 4 ? 'Titolo valido.' : 'Minimo 4 caratteri.';
  const preview = $('threadLivePreview');
  if (preview) {
    const tags = mergedThreadTags(title, body);
    preview.innerHTML = `
      <h4>${escapeHtml(title.trim() || 'Titolo della discussione')}</h4>
      <p class="muted small">${escapeHtml(categoryById($('newCategory')?.value)?.name || 'Categoria')}</p>
      <div class="preview-body">${markdownLite(body.trim() || 'Il testo apparira qui mentre scrivi.')}</div>
      <div class="preview-tags">${tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
    `;
  }
  const firstUrl = body.match(/https?:\/\/[^\s)]+/)?.[0] || '';
  const linkPreview = $('linkPreviewBox');
  if (linkPreview) {
    linkPreview.innerHTML = firstUrl
      ? `<h3>Link preview</h3><a href="${escapeHtml(safeUrl(firstUrl))}" target="_blank" rel="noopener">${escapeHtml(firstUrl)}</a><p class="muted small">${escapeHtml(mediaKind(firstUrl))}</p>`
      : '<h3>Link preview</h3><p class="muted small">Aggiungi un link per vedere qui la sorgente riconosciuta.</p>';
  }
}

function saveThreadDraft(silent = false) {
  const payload = {
    title: $('newTitle')?.value || '',
    category_id: $('newCategory')?.value || '',
    tags: $('newTags')?.value || '',
    body: $('newBody')?.value || '',
    media: state.threadMedia || [],
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(THREAD_DRAFT_KEY, JSON.stringify(payload));
  if ($('draftStatus')) $('draftStatus').textContent = 'Bozza salvata in questo browser.';
  if (!silent) toast('Bozza salvata.');
}

function restoreThreadDraft() {
  try {
    const raw = localStorage.getItem(THREAD_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.title && $('newTitle')) $('newTitle').value = draft.title;
    if (draft.category_id && $('newCategory')) $('newCategory').value = draft.category_id;
    if (draft.tags && $('newTags')) $('newTags').value = draft.tags;
    if (draft.body && $('newBody')) $('newBody').value = draft.body;
    state.threadMedia = Array.isArray(draft.media) ? draft.media.filter(item => item.type !== 'image_pending') : [];
    renderMediaPreview('thread');
    if ($('draftStatus')) $('draftStatus').textContent = draft.updated_at ? `Bozza recuperata: ${fmtDate(draft.updated_at)}` : 'Bozza recuperata.';
    updateComposerCounters();
  } catch {
    localStorage.removeItem(THREAD_DRAFT_KEY);
  }
}

function insertAtCursor(textarea, before, after = '') {
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const selected = textarea.value.slice(start, end);
  textarea.value = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  updateComposerCounters();
}

function applyComposerFormat(kind) {
  const body = $('newBody');
  const map = {
    bold: ['**', '**'],
    italic: ['*', '*'],
    quote: ['> ', ''],
    code: ['`', '`'],
    list: ['\n- ', ''],
    link: ['[testo](', ')'],
    spoiler: ['[spoiler]', '[/spoiler]'],
    image: ['![descrizione](', ')']
  };
  const pair = map[kind];
  if (pair) insertAtCursor(body, pair[0], pair[1]);
}

function bindProComposerEvents() {
  ['newTitle', 'newBody', 'newTags', 'newCategory'].forEach(id => $(id)?.addEventListener('input', () => {
    updateComposerCounters();
    saveThreadDraft(true);
  }));
  $('saveDraftBtn')?.addEventListener('click', () => saveThreadDraft(false));
  document.querySelectorAll('.composer-toolbar [data-format]').forEach(btn => {
    btn.addEventListener('click', () => applyComposerFormat(btn.dataset.format));
  });
  $('profileKind')?.addEventListener('change', renderProfileKindPanels);
  $('bookSearchBtn')?.addEventListener('click', searchBooksForProfile);
}

const _openThreadComposerV4Base = openThreadComposer;
openThreadComposer = function(sourceId) {
  state.suppressDraftSave = true;
  _openThreadComposerV4Base(sourceId);
  state.suppressDraftSave = false;
  restoreThreadDraft();
  updateComposerCounters();
};

const _addLinkMediaV4Base = addLinkMedia;
addLinkMedia = function(e) {
  _addLinkMediaV4Base(e);
  updateComposerCounters();
  saveThreadDraft(true);
};

const _renderMediaPreviewV4Base = renderMediaPreview;
renderMediaPreview = function(target) {
  _renderMediaPreviewV4Base(target);
  if (target === 'thread' && !state.suppressDraftSave) saveThreadDraft(true);
};

createThread = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  const title = els.newTitle.value.trim();
  const body = els.newBody.value.trim();
  if (title.length < 4) {
    els.threadMessage.textContent = 'Inserisci un titolo piu chiaro: almeno 4 caratteri.';
    return;
  }
  if (body.length < 2) {
    els.threadMessage.textContent = 'Scrivi un testo prima di pubblicare.';
    return;
  }
  if ($('threadStatus')?.value === 'draft') {
    saveThreadDraft(false);
    els.threadMessage.textContent = 'Bozza salvata localmente. Cambia stato in Pubblico per pubblicare.';
    return;
  }
  const cat = categoryById(els.newCategory.value);
  if (!canCreateInCategory(cat)) {
    els.threadMessage.textContent = 'Non puoi pubblicare in questa sezione.';
    return;
  }
  els.threadMessage.textContent = 'Controllo sicurezza e pubblicazione via Edge Function...';
  try {
    const media = await uploadPendingMedia('thread');
    const response = await forumApi('create-thread', {
      category_id: els.newCategory.value,
      title,
      body,
      media_items: media,
      tags: mergedThreadTags(title, body)
    });
    els.threadDialog.close();
    state.threadMedia = [];
    localStorage.removeItem(THREAD_DRAFT_KEY);
    await Promise.all([loadThreads(), loadCategories(), loadStats(), loadLivePanels()]);
    toast(response?.moderation_status === 'pending' ? 'Post inviato in moderazione anti-spam.' : 'Discussione pubblicata su INC. Forum');
  } catch (error) {
    els.threadMessage.textContent = error.message;
  }
};

function profilePanelsData() {
  return {
    artist: {
      instruments: csvProfile('artistInstruments'),
      daw: getInputValue('artistDaw'),
      favorite_albums: csvProfile('artistAlbums'),
      influential_artists: csvProfile('artistInfluential')
    },
    writer: {
      influences: csvProfile('writerInfluences'),
      authors: csvProfile('writerAuthors'),
      genres: csvProfile('writerGenres'),
      works: csvProfile('writerWorks'),
      books: getSavedExternalCards('books')
    },
    scientist: {
      field: getInputValue('scienceField'),
      techniques: csvProfile('scienceTechniques'),
      orcid: getInputValue('scienceOrcid'),
      scholar: safeUrl(getInputValue('scienceScholar')),
    },
    gamer: {
      platforms: csvProfile('gamerPlatforms'),
      games: csvProfile('gamerGames'),
      nickname: getInputValue('gamerNickname')
    },
    developer: {
      languages: csvProfile('devLanguages'),
      frameworks: csvProfile('devFrameworks'),
      github: safeUrl(getInputValue('devGithub')),
      portfolio: safeUrl(getInputValue('devPortfolio'))
    }
  };
}

function setCsvInput(id, value) {
  setInputValue(id, Array.isArray(value) ? value.join(', ') : value);
}

function renderProfileKindPanels() {
  const kind = $('profileKind')?.value || 'general';
  document.querySelectorAll('[data-profile-panel]').forEach(panel => {
    const panelKind = panel.dataset.profilePanel;
    panel.hidden = !(panelKind === 'extended' || panelKind === kind);
  });
}

function hydrateRoleProfileFields() {
  const extra = profileExtra();
  const roles = extra.role_profiles || {};
  $('profileKind') && ($('profileKind').value = extra.profile_kind || publicUserGroup(state.profile) || 'general');
  setInputValue('profileBannerUrl', extra.banner_url);
  const artist = roles.artist || artistProfile() || {};
  setCsvInput('artistInstruments', artist.instruments);
  setInputValue('artistDaw', artist.daw);
  setCsvInput('artistAlbums', artist.favorite_albums);
  setCsvInput('artistInfluential', artist.influential_artists);
  const writer = roles.writer || {};
  setCsvInput('writerInfluences', writer.influences);
  setCsvInput('writerAuthors', writer.authors);
  setCsvInput('writerGenres', writer.genres);
  setCsvInput('writerWorks', writer.works);
  renderSavedExternalCards('books', writer.books || []);
  const scientist = roles.scientist || {};
  setInputValue('scienceField', scientist.field);
  setCsvInput('scienceTechniques', scientist.techniques);
  setInputValue('scienceOrcid', scientist.orcid);
  setInputValue('scienceScholar', scientist.scholar);
  const gamer = roles.gamer || {};
  setCsvInput('gamerPlatforms', gamer.platforms);
  setCsvInput('gamerGames', gamer.games);
  setInputValue('gamerNickname', gamer.nickname);
  const developer = roles.developer || {};
  setCsvInput('devLanguages', developer.languages);
  setCsvInput('devFrameworks', developer.frameworks);
  setInputValue('devGithub', developer.github);
  setInputValue('devPortfolio', developer.portfolio);
  renderProfileKindPanels();
}

const _openProfileEditorV4Base = openProfileEditor;
openProfileEditor = function() {
  _openProfileEditorV4Base();
  hydrateRoleProfileFields();
};

saveProfile = async function(e) {
  e.preventDefault();
  if (!state.user) return requireLogin();
  els.profileMessage.textContent = 'Salvataggio profilo via Edge Function...';
  try {
    let avatar_url = state.profile?.avatar_url || null;
    const file = els.avatarFile.files[0];
    if (file) {
      const uploaded = await createSignedForumUpload(file, 'avatars');
      avatar_url = uploaded.url;
    }
    const profile_extra = {
      headline: getInputValue('profileHeadline'),
      location: getInputValue('profileLocation'),
      signature: getInputValue('profileSignature'),
      interests: csvProfile('profileInterests'),
      tools: csvProfile('profileTools'),
      available_for: csvProfile('profileAvailableFor'),
      profile_kind: getInputValue('profileKind') || 'general',
      banner_url: safeUrl(getInputValue('profileBannerUrl')),
      role_profiles: profilePanelsData()
    };
    const artist_profile = {
      name: getInputValue('artistNameProfile'),
      genres: csvProfile('artistGenres'),
      roles: csvProfile('artistRoles'),
      influences: csvProfile('artistInfluences'),
      latest_release: getInputValue('artistLatestRelease'),
      bio: getInputValue('artistBio'),
      instruments: csvProfile('artistInstruments'),
      daw: getInputValue('artistDaw'),
      favorite_albums: csvProfile('artistAlbums'),
      influential_artists: csvProfile('artistInfluential')
    };
    await forumApi('update-profile', {
      display_name: els.profileDisplayName.value.trim(),
      username: els.profileUsername.value.trim().toLowerCase() || null,
      bio: els.profileBio.value.trim(),
      theme: els.profileTheme.value,
      avatar_url,
      social_links: currentSocialLinks(),
      profile_extra,
      artist_profile
    });
    await loadProfile();
    renderAuthState();
    els.profileDialog.close();
    toast('Profilo aggiornato');
    await loadLivePanels();
  } catch (error) {
    els.profileMessage.textContent = error.message;
  }
};

function getSavedExternalCards(kind) {
  try {
    return JSON.parse(localStorage.getItem(`incForumProfileCards:${state.user?.id || 'guest'}:${kind}`) || '[]');
  } catch {
    return [];
  }
}

function setSavedExternalCards(kind, cards) {
  localStorage.setItem(`incForumProfileCards:${state.user?.id || 'guest'}:${kind}`, JSON.stringify(cards.slice(0, 24)));
}

function renderSavedExternalCards(kind, cards = getSavedExternalCards(kind)) {
  setSavedExternalCards(kind, cards);
  const host = $('savedBooks');
  if (!host) return;
  host.innerHTML = cards.map((book, index) => `
    <article class="external-card">
      ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)}" loading="lazy">` : '<div class="external-cover"></div>'}
      <div><strong>${escapeHtml(book.title)}</strong><p>${escapeHtml(book.author || '')}</p><a href="${escapeHtml(book.url)}" target="_blank" rel="noopener">Open Library</a></div>
      <button type="button" data-remove-book="${index}">Rimuovi</button>
    </article>
  `).join('');
  host.querySelectorAll('[data-remove-book]').forEach(btn => btn.addEventListener('click', () => {
    const next = getSavedExternalCards(kind).filter((_, i) => i !== Number(btn.dataset.removeBook));
    renderSavedExternalCards(kind, next);
  }));
}

async function searchBooksForProfile() {
  const q = $('bookSearchInput')?.value.trim();
  const host = $('bookResults');
  if (!q || !host) return;
  host.innerHTML = '<p class="muted small">Ricerca libri in corso...</p>';
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8`);
    const json = await res.json();
    const books = (json.docs || []).map(item => ({
      title: item.title,
      author: (item.author_name || []).slice(0, 2).join(', '),
      cover_url: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : '',
      url: item.key ? `https://openlibrary.org${item.key}` : 'https://openlibrary.org'
    })).filter(book => book.title);
    host.innerHTML = books.map((book, index) => `
      <article class="external-card">
        ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)}" loading="lazy">` : '<div class="external-cover"></div>'}
        <div><strong>${escapeHtml(book.title)}</strong><p>${escapeHtml(book.author || 'Autore non indicato')}</p><a href="${escapeHtml(book.url)}" target="_blank" rel="noopener">Scheda</a></div>
        <button type="button" data-add-book="${index}">Salva</button>
      </article>
    `).join('') || '<p class="muted small">Nessun risultato.</p>';
    host.querySelectorAll('[data-add-book]').forEach(btn => btn.addEventListener('click', () => {
      const current = getSavedExternalCards('books');
      renderSavedExternalCards('books', [...current, books[Number(btn.dataset.addBook)]]);
      toast('Libro salvato nel profilo.');
    }));
  } catch (error) {
    host.innerHTML = `<p class="muted small">Ricerca non disponibile: ${escapeHtml(error.message)}</p>`;
  }
}

const _bindV3EventsV4Base = bindV3Events;
bindV3Events = function() {
  _bindV3EventsV4Base();
  bindProComposerEvents();
};

/* ===================== INC FORUM V4.1: stable category icons ===================== */
function categoryIconKey(cat = {}) {
  const raw = String(cat.icon || cat.slug || cat.name || '').toLowerCase();
  const slug = String(cat.slug || '').toLowerCase();
  if (/annunci|bell|news/.test(`${slug} ${raw}`)) return 'announcements';
  if (/musica|music|brani|release|headphones|sound/.test(`${slug} ${raw}`)) return 'music';
  if (/scrittura|writer|book|libri/.test(`${slug} ${raw}`)) return 'writing';
  if (/scienza|science|atom|research/.test(`${slug} ${raw}`)) return 'science';
  if (/gaming|game|gamer/.test(`${slug} ${raw}`)) return 'gaming';
  if (/developer|code|web|sviluppo/.test(`${slug} ${raw}`)) return 'code';
  if (/design|art|cover/.test(`${slug} ${raw}`)) return 'design';
  if (/ai|automazione|bot/.test(`${slug} ${raw}`)) return 'ai';
  if (/off/.test(`${slug} ${raw}`)) return 'offtopic';
  return 'forum';
}

function categoryIconHtml(cat, className = '') {
  const key = categoryIconKey(cat);
  const paths = {
    forum: '<path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v5A3.5 3.5 0 0 1 16.5 15H11l-4.5 4v-4A3.5 3.5 0 0 1 3 11.5z"/><path d="M8 8h8M8 11h5"/>',
    announcements: '<path d="M5 11V7.5A2.5 2.5 0 0 1 7.5 5H9l6-2v18l-6-2H7.5A2.5 2.5 0 0 1 5 16.5V13"/><path d="M9 5v14M18 9v6M4 13h3"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/><path d="M9 9l10-2"/>',
    writing: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13M8 7h8M8 11h7"/>',
    science: '<path d="M10 2v6l-5.5 9.5A3 3 0 0 0 7.1 22h9.8a3 3 0 0 0 2.6-4.5L14 8V2"/><path d="M8 2h8M7 16h10"/>',
    gaming: '<path d="M7 9h10a5 5 0 0 1 4.7 6.7l-.6 1.8a2.2 2.2 0 0 1-3.7.8L15 16H9l-2.4 3.3a2.2 2.2 0 0 1-3.7-.8l-.6-1.8A5 5 0 0 1 7 9z"/><path d="M7 13h4M9 11v4M16.5 13h.01M18.5 15h.01"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
    design: '<path d="M12 3l8 8-8 8-8-8z"/><path d="M12 3v16M4 11h16"/>',
    ai: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/><path d="M9 15l2-6 2 6M10 13h2.4M15 9v6"/>',
    offtopic: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/><path d="M16 3h5v5"/>'
  };
  return `<span class="category-glyph ${escapeHtml(className)}" data-icon="${escapeHtml(key)}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths[key] || paths.forum}</svg></span>`;
}

function categoryOptionLabel(cat) {
  const labels = {
    announcements: '[Annunci]',
    music: '[Musica]',
    writing: '[Scrittura]',
    science: '[Scienza]',
    gaming: '[Gaming]',
    code: '[Dev]',
    design: '[Design]',
    ai: '[AI]',
    offtopic: '[Off]',
    forum: '[Forum]'
  };
  return `${labels[categoryIconKey(cat)] || '[Forum]'} ${cat.name}`;
}

renderCategories = function() {
  const visible = state.categories.filter(c => !isReservedCategory(c));
  if (!visible.some(c => c.id === state.selectedCategoryId) && visible[0]) {
    state.selectedCategoryId = visible[0].id;
    state.selectedCategorySlug = visible[0].slug;
  }
  els.categoryList.innerHTML = visible.map(cat => {
    const isActive = cat.id === state.selectedCategoryId;
    return `<button class="category-item ${isActive ? 'active' : ''}" type="button" data-id="${escapeHtml(cat.id)}">
      <span class="left">${categoryIconHtml(cat)}<span>${escapeHtml(cat.name)}</span></span>
      <span class="category-meta"><span class="pill">${cat.thread_count || 0}</span></span>
    </button>`;
  }).join('');
  els.categoryList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    const cat = state.categories.find(c => c.id === btn.dataset.id);
    if (!cat) return;
    state.selectedCategoryId = cat.id;
    state.selectedCategorySlug = cat.slug;
    showForumMode();
    renderCategories();
    updateHero(cat);
    renderThreads();
    closeThread();
  }));
  updateHero(state.categories.find(c => c.id === state.selectedCategoryId));
};

renderCategorySelect = function() {
  const visible = state.categories.filter(c => !isReservedCategory(c));
  els.newCategory.innerHTML = visible.map(c => {
    const blocked = state.user && !canCreateInCategory(c);
    return `<option value="${escapeHtml(c.id)}" ${blocked ? 'disabled' : ''}>${escapeHtml(categoryOptionLabel(c))}</option>`;
  }).join('');
};

updateHero = function(cat) {
  if (!cat) return;
  els.pageTitle.textContent = cat.name;
  els.pageSubtitle.textContent = cat.description || 'Discussioni della community.';
  els.currentSection.textContent = isPromotionCategory(cat) ? 'INC. Release Board' : 'INC. Forum';
  els.heroThreads.textContent = cat.thread_count || 0;
  els.heroPosts.textContent = cat.post_count || 0;
  const icon = document.querySelector('.category-icon');
  if (icon) icon.innerHTML = categoryIconHtml(cat, 'hero-glyph');
};

/* ===================== INC FORUM V4.2: permission fixes ===================== */
isAdmin = function() {
  return ['owner', 'admin'].includes(String(state.profile?.role || '').toLowerCase());
};

isModerator = function() {
  return String(state.profile?.role || '').toLowerCase() === 'moderator';
};

isStaff = function() {
  return isAdmin() || isModerator();
};

isArtist = function() {
  const role = String(state.profile?.role || '').toLowerCase();
  return isStaff() || state.profile?.is_artist === true || userGroup() === 'artist' || role === 'artist';
};

canCreateInCategory = function(cat) {
  if (!state.user) return false;
  if (!cat || isReservedCategory(cat)) return false;
  if (isStaff()) return true;
  if (isAnnouncementCategory(cat)) return false;
  if (isPromotionCategory(cat)) return isArtist();
  return true;
};

function explainCategoryPermission(cat) {
  if (!state.user) return 'Devi accedere per pubblicare.';
  if (!cat) return 'Categoria non trovata: ricarica la pagina.';
  if (isReservedCategory(cat)) return 'Questa sezione e riservata al sistema.';
  if (isAnnouncementCategory(cat)) return 'Solo staff puo pubblicare annunci.';
  if (isPromotionCategory(cat)) return 'Questa sezione richiede profilo artista o staff.';
  return 'Non hai i permessi per pubblicare in questa categoria.';
}

const _openThreadComposerPermissionBase = openThreadComposer;
openThreadComposer = function(sourceId) {
  if (!state.user) return requireLogin();
  if (sourceId === 'quickMusicBtn') return openSoundCardComposer();
  const selected = categoryById(state.selectedCategoryId);
  if (selected && !canCreateInCategory(selected)) return toast(explainCategoryPermission(selected));
  return _openThreadComposerPermissionBase(sourceId);
};

const _createThreadPermissionBase = createThread;
createThread = async function(e) {
  const cat = categoryById(els.newCategory.value);
  if (!canCreateInCategory(cat)) {
    e.preventDefault();
    els.threadMessage.textContent = explainCategoryPermission(cat);
    return;
  }
  return _createThreadPermissionBase(e);
};


init();
