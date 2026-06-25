const SUPABASE_URL = 'https://vxnlycbuacrielnhjqqi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rwF9RZvjKHXtB1fjCTkzfw_x8xrwKQH';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  user: null,
  profile: null,
  categories: [],
  selectedCategoryId: null,
  selectedCategorySlug: 'generale',
  threads: [],
  currentThread: null,
  sort: 'recent',
  search: ''
};

const $ = (id) => document.getElementById(id);

const els = {
  categoryList: $('categoryList'),
  threadList: $('threadList'),
  emptyThreads: $('emptyThreads'),
  popularList: $('popularList'),
  userBadge: $('userBadge'),
  openAuthBtn: $('openAuthBtn'),
  logoutBtn: $('logoutBtn'),
  authDialog: $('authDialog'),
  closeAuthBtn: $('closeAuthBtn'),
  loginBtn: $('loginBtn'),
  signupBtn: $('signupBtn'),
  authEmail: $('authEmail'),
  authPassword: $('authPassword'),
  displayName: $('displayName'),
  authMessage: $('authMessage'),
  newThreadBtn: $('newThreadBtn'),
  threadDialog: $('threadDialog'),
  closeThreadBtn: $('closeThreadBtn'),
  cancelThreadBtn: $('cancelThreadBtn'),
  threadForm: $('threadForm'),
  newTitle: $('newTitle'),
  newCategory: $('newCategory'),
  newBody: $('newBody'),
  threadMessage: $('threadMessage'),
  pageTitle: $('pageTitle'),
  pageSubtitle: $('pageSubtitle'),
  heroThreads: $('heroThreads'),
  heroPosts: $('heroPosts'),
  usersCount: $('usersCount'),
  threadsCount: $('threadsCount'),
  postsCount: $('postsCount'),
  searchInput: $('searchInput'),
  threadView: $('threadView'),
  backToListBtn: $('backToListBtn'),
  breadcrumbCategory: $('breadcrumbCategory'),
  threadTitle: $('threadTitle'),
  threadMeta: $('threadMeta'),
  threadBody: $('threadBody'),
  postsList: $('postsList'),
  replyCount: $('replyCount'),
  replyForm: $('replyForm'),
  replyBody: $('replyBody'),
  replyJumpBtn: $('replyJumpBtn'),
  toast: $('toast')
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(d);
}

function initials(name = 'U') {
  return escapeHtml(name.trim().slice(0, 1).toUpperCase() || 'U');
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3200);
}

async function init() {
  bindEvents();
  await loadSession();
  await loadCategories();
  await loadStats();
  await loadThreads();
  subscribeRealtime();
}

function bindEvents() {
  els.openAuthBtn.addEventListener('click', () => els.authDialog.showModal());
  els.closeAuthBtn.addEventListener('click', () => els.authDialog.close());
  els.loginBtn.addEventListener('click', login);
  els.signupBtn.addEventListener('click', signup);
  els.logoutBtn.addEventListener('click', logout);

  els.newThreadBtn.addEventListener('click', () => {
    if (!state.user) return requireLogin();
    els.threadMessage.textContent = '';
    els.threadForm.reset();
    els.newCategory.value = state.selectedCategoryId || state.categories[0]?.id || '';
    els.threadDialog.showModal();
  });
  els.closeThreadBtn.addEventListener('click', () => els.threadDialog.close());
  els.cancelThreadBtn.addEventListener('click', () => els.threadDialog.close());
  els.threadForm.addEventListener('submit', createThread);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.sort = tab.dataset.sort;
      renderThreads();
    });
  });

  let searchTimer;
  els.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      renderThreads();
    }, 200);
  });

  els.backToListBtn.addEventListener('click', () => closeThread());
  els.replyJumpBtn.addEventListener('click', () => els.replyBody.focus());
  els.replyForm.addEventListener('submit', createReply);
}

async function loadSession() {
  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;
  await loadProfile();
  renderAuthState();

  db.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    await loadProfile();
    renderAuthState();
  });
}

async function loadProfile() {
  state.profile = null;
  if (!state.user) return;

  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();

  if (!error && data) state.profile = data;
}

function renderAuthState() {
  if (state.user) {
    els.userBadge.textContent = state.profile?.display_name || state.user.email || 'Utente';
    els.openAuthBtn.classList.add('hidden');
    els.logoutBtn.classList.remove('hidden');
  } else {
    els.userBadge.textContent = 'Ospite';
    els.openAuthBtn.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
  }
}

async function login() {
  els.authMessage.textContent = 'Accesso in corso...';
  const { error } = await db.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value
  });
  if (error) return els.authMessage.textContent = error.message;
  els.authMessage.textContent = '';
  els.authDialog.close();
  toast('Accesso effettuato.');
}

async function signup() {
  els.authMessage.textContent = 'Registrazione in corso...';
  const displayName = els.displayName.value.trim() || els.authEmail.value.split('@')[0];
  const { data, error } = await db.auth.signUp({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
    options: { data: { display_name: displayName } }
  });

  if (error) return els.authMessage.textContent = error.message;

  if (data.user) {
    await db.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName,
      avatar_url: null
    });
  }

  els.authMessage.textContent = 'Registrazione completata. Se Supabase richiede conferma email, controlla la posta.';
  toast('Account creato.');
}

async function logout() {
  await db.auth.signOut();
  state.user = null;
  state.profile = null;
  renderAuthState();
  toast('Sei uscito dal forum.');
}

async function loadCategories() {
  const { data, error } = await db
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    toast('Errore caricamento categorie: ' + error.message);
    return;
  }

  state.categories = data || [];
  state.selectedCategoryId = state.categories.find(c => c.slug === 'generale')?.id || state.categories[0]?.id || null;
  state.selectedCategorySlug = state.categories.find(c => c.id === state.selectedCategoryId)?.slug || 'generale';
  renderCategories();
}

function renderCategories() {
  els.categoryList.innerHTML = state.categories.map(cat => `
    <button class="category-item ${cat.id === state.selectedCategoryId ? 'active' : ''}" data-id="${cat.id}" type="button">
      <span>${escapeHtml(cat.icon || '💬')}</span>
      <span>${escapeHtml(cat.name)}</span>
      <span class="count" id="cat-count-${cat.id}">—</span>
    </button>
  `).join('');

  els.newCategory.innerHTML = state.categories.map(cat => `
    <option value="${cat.id}">${escapeHtml(cat.name)}</option>
  `).join('');

  document.querySelectorAll('.category-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.selectedCategoryId = btn.dataset.id;
      state.selectedCategorySlug = state.categories.find(c => c.id === state.selectedCategoryId)?.slug || '';
      closeThread(false);
      renderCategories();
      await loadThreads();
    });
  });
}

async function loadStats() {
  const [threadCount, postCount, profileCount] = await Promise.all([
    db.from('threads').select('*', { count: 'exact', head: true }),
    db.from('posts').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true })
  ]);

  els.threadsCount.textContent = threadCount.count ?? '0';
  els.postsCount.textContent = postCount.count ?? '0';
  els.usersCount.textContent = profileCount.count ?? '0';
}

async function loadThreads() {
  let query = db
    .from('thread_overview')
    .select('*')
    .eq('is_deleted', false)
    .order('is_pinned', { ascending: false })
    .order('last_activity_at', { ascending: false });

  if (state.selectedCategoryId) query = query.eq('category_id', state.selectedCategoryId);

  const { data, error } = await query;

  if (error) {
    toast('Errore caricamento discussioni: ' + error.message);
    return;
  }

  state.threads = data || [];
  renderThreads();
  renderPopular();
  updateCategoryHeader();
  updateCategoryCounts();
}

function updateCategoryHeader() {
  const cat = state.categories.find(c => c.id === state.selectedCategoryId);
  els.pageTitle.textContent = cat?.name || 'Forum';
  els.pageSubtitle.textContent = cat?.description || 'Discussioni della community.';
  els.heroThreads.textContent = state.threads.length;
  els.heroPosts.textContent = state.threads.reduce((sum, t) => sum + Number(t.reply_count || 0) + 1, 0);
}

async function updateCategoryCounts() {
  const { data } = await db.from('thread_overview').select('category_id').eq('is_deleted', false);
  const counts = (data || []).reduce((acc, row) => {
    acc[row.category_id] = (acc[row.category_id] || 0) + 1;
    return acc;
  }, {});
  Object.entries(counts).forEach(([id, count]) => {
    const el = document.getElementById(`cat-count-${id}`);
    if (el) el.textContent = count;
  });
  state.categories.forEach(cat => {
    const el = document.getElementById(`cat-count-${cat.id}`);
    if (el && !counts[cat.id]) el.textContent = '0';
  });
}

function getFilteredThreads() {
  let rows = [...state.threads];
  if (state.search) {
    rows = rows.filter(t =>
      t.title?.toLowerCase().includes(state.search) ||
      t.body?.toLowerCase().includes(state.search) ||
      t.author_name?.toLowerCase().includes(state.search)
    );
  }

  if (state.sort === 'popular') rows.sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0));
  if (state.sort === 'discussed') rows.sort((a, b) => Number(b.reply_count || 0) - Number(a.reply_count || 0));
  if (state.sort === 'recent') rows.sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));

  rows.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || 0);
  return rows;
}

function renderThreads() {
  const rows = getFilteredThreads();
  els.emptyThreads.classList.toggle('hidden', rows.length > 0);

  els.threadList.innerHTML = rows.map(thread => `
    <button class="thread-row" type="button" data-id="${thread.id}">
      <span class="thread-avatar">${initials(thread.author_name || 'Z')}</span>
      <span class="thread-info">
        <span class="thread-title">
          ${thread.is_pinned ? '<span class="badge">ANNUNCIO</span>' : ''}
          <h3>${escapeHtml(thread.title)}</h3>
        </span>
        <span class="thread-meta">${escapeHtml(thread.author_name || 'Utente')} · ${fmtDate(thread.created_at)}</span>
      </span>
      <span class="thread-stat">💬 ${Number(thread.reply_count || 0)}</span>
      <span class="thread-stat views">👁 ${Number(thread.view_count || 0)}</span>
      <span class="pin">${thread.is_pinned ? '📌' : '⋮'}</span>
    </button>
  `).join('');

  document.querySelectorAll('.thread-row').forEach(row => {
    row.addEventListener('click', () => openThread(row.dataset.id));
  });
}

function renderPopular() {
  const popular = [...state.threads]
    .sort((a, b) => Number(b.reply_count || 0) - Number(a.reply_count || 0))
    .slice(0, 5);

  els.popularList.innerHTML = popular.map(t => `
    <li>
      <div>
        <button type="button" data-id="${t.id}">${escapeHtml(t.title)}</button>
        <p>${Number(t.reply_count || 0)} risposte</p>
      </div>
    </li>
  `).join('');

  els.popularList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => openThread(btn.dataset.id));
  });
}

async function openThread(id) {
  const { data, error } = await db
    .from('thread_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return toast('Discussione non trovata.');
  state.currentThread = data;

  await db.rpc('increment_thread_views', { thread_id_input: id });

  els.threadView.classList.remove('hidden');
  els.threadList.parentElement.classList.add('hidden');
  els.emptyThreads.classList.add('hidden');

  els.breadcrumbCategory.textContent = data.category_name || 'Forum';
  els.threadTitle.textContent = data.title;
  els.threadMeta.textContent = `${data.author_name || 'Utente'} · ${fmtDate(data.created_at)} · ${Number(data.view_count || 0) + 1} visite`;
  els.threadBody.textContent = data.body;

  await loadPosts(id);
  els.threadView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadPosts(threadId) {
  const { data, error } = await db
    .from('post_overview')
    .select('*')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) return toast('Errore caricamento risposte: ' + error.message);
  const posts = data || [];
  els.replyCount.textContent = posts.length;
  els.postsList.innerHTML = posts.map(post => `
    <article class="post">
      <div class="post-avatar">${initials(post.author_name || 'U')}</div>
      <div>
        <div><span class="post-author">${escapeHtml(post.author_name || 'Utente')}</span> <span class="muted small">· ${fmtDate(post.created_at)}</span></div>
        <p class="post-body">${escapeHtml(post.body)}</p>
      </div>
    </article>
  `).join('');
}

function closeThread(scroll = true) {
  state.currentThread = null;
  els.threadView.classList.add('hidden');
  els.threadList.parentElement.classList.remove('hidden');
  renderThreads();
  if (scroll) document.querySelector('.content').scrollIntoView({ behavior: 'smooth' });
}

async function createThread(event) {
  event.preventDefault();
  if (!state.user) return requireLogin();

  els.threadMessage.textContent = 'Pubblicazione in corso...';
  const title = els.newTitle.value.trim();
  const body = els.newBody.value.trim();
  const category_id = els.newCategory.value;

  const { error } = await db.from('threads').insert({
    title,
    body,
    category_id,
    author_id: state.user.id
  });

  if (error) {
    els.threadMessage.textContent = error.message;
    return;
  }

  els.threadDialog.close();
  toast('Discussione pubblicata.');
  state.selectedCategoryId = category_id;
  renderCategories();
  await loadStats();
  await loadThreads();
}

async function createReply(event) {
  event.preventDefault();
  if (!state.user) return requireLogin();
  if (!state.currentThread) return;

  const body = els.replyBody.value.trim();
  if (!body) return;

  const { error } = await db.from('posts').insert({
    thread_id: state.currentThread.id,
    author_id: state.user.id,
    body
  });

  if (error) return toast('Errore invio risposta: ' + error.message);

  els.replyBody.value = '';
  await db.from('threads').update({ last_activity_at: new Date().toISOString() }).eq('id', state.currentThread.id);
  await loadPosts(state.currentThread.id);
  await loadStats();
  await loadThreads();
  toast('Risposta pubblicata.');
}

function requireLogin() {
  toast('Devi accedere per scrivere nel forum.');
  els.authDialog.showModal();
}

function subscribeRealtime() {
  db.channel('forum-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, async () => {
      await loadThreads();
      await loadStats();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => {
      if (state.currentThread) await loadPosts(state.currentThread.id);
      await loadThreads();
      await loadStats();
    })
    .subscribe();
}

init();
