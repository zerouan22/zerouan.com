const pageState = {
  session: null,
  user: null,
  profile: null,
  thread: null,
  comments: [],
  commentVotes: new Map(),
  savedThreadIds: new Set(),
  followedThreadIds: new Set(),
  threadVote: 0
};

const pageEls = {
  threadCard: document.getElementById('threadCard'),
  commentsList: document.getElementById('commentsList'),
  categoryTitle: document.getElementById('categoryTitle'),
  categoryDescription: document.getElementById('categoryDescription'),
  authorCard: document.getElementById('authorCard'),
  relatedThreads: document.getElementById('relatedThreads'),
  commentForm: document.getElementById('commentForm'),
  commentParentId: document.getElementById('commentParentId'),
  commentBody: document.getElementById('commentBody'),
  commentMessage: document.getElementById('commentMessage'),
  cancelReplyBtn: document.getElementById('cancelReplyBtn'),
  commentSort: document.getElementById('commentSort'),
  markResolvedBtn: document.getElementById('markResolvedBtn'),
  lockThreadBtn: document.getElementById('lockThreadBtn'),
  reportThreadBtn: document.getElementById('reportThreadBtn'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  profileBtn: document.getElementById('profileBtn'),
  userBadge: document.getElementById('userBadge'),
  authDialog: document.getElementById('authDialog'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  cancelAuthBtn: document.getElementById('cancelAuthBtn'),
  doLoginBtn: document.getElementById('doLoginBtn'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authMessage: document.getElementById('authMessage'),
  toast: document.getElementById('toast')
};

function toast(message) {
  pageEls.toast.textContent = message;
  pageEls.toast.classList.remove('hidden');
  setTimeout(() => pageEls.toast.classList.add('hidden'), 2800);
}

function setTheme() {
  document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark';
}

function isStaff() {
  return ['owner', 'admin', 'moderator'].includes(String(pageState.profile?.role || '').toLowerCase());
}

function canModerateThread() {
  return isStaff() || pageState.thread?.author_id === pageState.user?.id;
}

function applyAuthState() {
  pageEls.userBadge.textContent = pageState.profile?.display_name || pageState.user?.email?.split('@')[0] || 'Ospite';
  pageEls.loginBtn.classList.toggle('hidden', !!pageState.user);
  pageEls.logoutBtn.classList.toggle('hidden', !pageState.user);
  pageEls.profileBtn.classList.toggle('hidden', !pageState.user);
  if (pageState.user) pageEls.profileBtn.href = `profile.html?id=${encodeURIComponent(pageState.user.id)}`;
}

async function loadSession() {
  const auth = await ForumCore.getCurrentUser();
  pageState.session = auth.session;
  pageState.user = auth.user;
  pageState.profile = auth.profile;
  applyAuthState();
}

async function login() {
  pageEls.authMessage.textContent = 'Accesso in corso...';
  const { error } = await ForumCore.db.auth.signInWithPassword({
    email: pageEls.authEmail.value.trim(),
    password: pageEls.authPassword.value
  });
  if (error) {
    pageEls.authMessage.textContent = error.message;
    return;
  }
  pageEls.authDialog.close();
  await bootstrap();
  toast('Accesso effettuato');
}

async function logout() {
  await ForumCore.db.auth.signOut();
  await bootstrap();
}

async function loadThread() {
  const threadId = ForumCore.getQueryParam('thread');
  if (!threadId) throw new Error('THREAD_ID_REQUIRED');
  const { data, error } = await ForumCore.db.from('thread_overview').select('*').eq('id', threadId).maybeSingle();
  if (error || !data) throw new Error('THREAD_NOT_FOUND');
  pageState.thread = data;
  const [commentsResult, relatedResult] = await Promise.all([
    ForumCore.db.from('post_overview').select('*').eq('thread_id', threadId).order('created_at'),
    ForumCore.db.from('thread_overview').select('*').eq('category_id', data.category_id).neq('id', threadId).order('last_activity_at', { ascending: false }).limit(5)
  ]);
  pageState.comments = commentsResult.data || [];
  renderRelatedThreads(relatedResult.data || []);
  if (pageState.user) {
    const [commentVotes, savedRows, followedRows, threadVote] = await Promise.all([
      ForumCore.db.from('forum_post_votes').select('post_id,value').eq('user_id', pageState.user.id).in('post_id', pageState.comments.map((row) => row.id).concat('00000000-0000-0000-0000-000000000000')),
      ForumCore.db.from('thread_bookmarks').select('thread_id').eq('user_id', pageState.user.id).eq('thread_id', threadId),
      ForumCore.db.from('forum_followed_threads').select('thread_id').eq('user_id', pageState.user.id).eq('thread_id', threadId),
      ForumCore.db.from('forum_thread_votes').select('value').eq('user_id', pageState.user.id).eq('thread_id', threadId).maybeSingle()
    ]);
    pageState.commentVotes = new Map((commentVotes.data || []).map((row) => [row.post_id, row.value]));
    pageState.savedThreadIds = new Set((savedRows.data || []).map((row) => row.thread_id));
    pageState.followedThreadIds = new Set((followedRows.data || []).map((row) => row.thread_id));
    pageState.threadVote = threadVote.data?.value || 0;
  } else {
    pageState.commentVotes = new Map();
    pageState.savedThreadIds = new Set();
    pageState.followedThreadIds = new Set();
    pageState.threadVote = 0;
  }
  document.title = `${data.title} · INC. Forum`;
}

function threadActionButton(label, id, extra = '') {
  return `<button class="community-mini-btn ${extra}" type="button" id="${id}">${label}</button>`;
}

function renderThread() {
  const thread = pageState.thread;
  const flairStyle = thread.flair_color ? `style="background:${ForumCore.escapeHtml(thread.flair_color)}22;border-color:${ForumCore.escapeHtml(thread.flair_color)}88"` : '';
  const saved = pageState.savedThreadIds.has(thread.id);
  const following = pageState.followedThreadIds.has(thread.id);
  pageEls.categoryTitle.textContent = thread.category_name || 'Categoria';
  pageEls.categoryDescription.textContent = thread.category_slug || '—';
  pageEls.threadCard.innerHTML = `
    <div class="community-page-header">
      <div>
        <div class="community-meta-row">
          <a href="categories.html#${ForumCore.escapeHtml(thread.category_slug || '')}">${ForumCore.escapeHtml(thread.category_name || 'Categoria')}</a>
          ${thread.flair_name ? `<span class="community-flair" ${flairStyle}>${ForumCore.escapeHtml(thread.flair_name)}</span>` : ''}
          <span class="badge">${ForumCore.escapeHtml(thread.post_type || 'discussion')}</span>
          ${thread.is_solved ? '<span class="badge">Risolto</span>' : ''}
          ${thread.is_locked ? '<span class="badge">Chiuso</span>' : ''}
        </div>
        <h1 class="community-thread-title">${ForumCore.escapeHtml(thread.title)}</h1>
        <div class="community-meta-row">
          <a href="profile.html?id=${ForumCore.escapeHtml(thread.author_id)}">${ForumCore.escapeHtml(thread.author_name)}</a>
          <span>${ForumCore.escapeHtml(thread.author_level_label || 'Livello 1')}</span>
          <span>${Number(thread.author_reputation || 0)} reputazione</span>
          <span>${ForumCore.fmtDate(thread.created_at)}</span>
          <span>${Number(thread.view_count || 0)} visualizzazioni</span>
        </div>
      </div>
    </div>
    <div class="community-action-row">
      <div class="community-score-stack">
        <button class="community-vote-btn ${pageState.threadVote === 1 ? 'active' : ''}" type="button" data-thread-vote="1">▲</button>
        <strong>${Number(thread.score || 0)}</strong>
        <button class="community-vote-btn ${pageState.threadVote === -1 ? 'active' : ''}" type="button" data-thread-vote="-1">▼</button>
      </div>
      ${threadActionButton(saved ? '★ Salvato' : '☆ Salva', 'saveThreadBtn')}
      ${threadActionButton(following ? 'Seguito' : 'Segui discussione', 'followThreadBtn')}
    </div>
    <div class="community-thread-body">${ForumCore.escapeHtml(thread.body || '').replaceAll('\n', '<br>')}</div>
    ${ForumCore.mediaArray(thread.media_items).length ? `<div class="community-two-up">${ForumCore.mediaHtml(thread.media_items)}</div>` : ''}
  `;
  pageEls.authorCard.innerHTML = `
    <div class="community-author-chip">
      <div class="community-avatar ${thread.author_avatar_url ? '' : ''}" style="${thread.author_avatar_url ? `background-image:url('${ForumCore.escapeHtml(thread.author_avatar_url)}')` : ''}">${thread.author_avatar_url ? '' : ForumCore.initial(thread.author_name)}</div>
      <div>
        <strong>${ForumCore.escapeHtml(thread.author_name)}</strong>
        <div class="community-muted">${ForumCore.escapeHtml(thread.author_level_label || 'Livello 1')} · ${Number(thread.author_reputation || 0)} reputazione</div>
      </div>
    </div>
  `;
  pageEls.markResolvedBtn.classList.toggle('hidden', !canModerateThread());
  pageEls.lockThreadBtn.classList.toggle('hidden', !isStaff());
  bindThreadActions();
}

function sortComments(rows) {
  const mode = pageEls.commentSort.value;
  const items = [...rows];
  if (mode === 'new') items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (mode === 'old') items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (mode === 'votes') items.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  if (mode === 'best') items.sort((a, b) => (Number(b.score || 0) * 10 + new Date(b.created_at).getTime() / 1e10) - (Number(a.score || 0) * 10 + new Date(a.created_at).getTime() / 1e10));
  return items;
}

function renderComments() {
  const rows = sortComments(pageState.comments);
  const byParent = new Map();
  rows.forEach((row) => {
    const key = row.parent_post_id || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  });

  function renderBranch(parentId = 'root', visualDepth = 0) {
    return (byParent.get(parentId) || []).map((comment) => {
      const vote = pageState.commentVotes.get(comment.id) || 0;
      const children = visualDepth < 3 ? renderBranch(comment.id, visualDepth + 1) : '';
      return `
        <article class="community-comment-card" data-depth="${Math.min(visualDepth, 3)}">
          <div class="community-meta-row">
            <a href="profile.html?id=${ForumCore.escapeHtml(comment.author_id)}">${ForumCore.escapeHtml(comment.author_name)}</a>
            <span>${ForumCore.escapeHtml(comment.author_level_label || 'Livello 1')}</span>
            <span>${ForumCore.fmtDate(comment.created_at)}</span>
            ${comment.edited_at ? '<span>modificato</span>' : ''}
          </div>
          <div class="community-comment-body">${ForumCore.escapeHtml(comment.body || '').replaceAll('\n', '<br>')}</div>
          <div class="community-action-row">
            <button class="community-vote-btn ${vote === 1 ? 'active' : ''}" type="button" data-comment-vote="${ForumCore.escapeHtml(comment.id)}" data-value="1">▲ ${Number(comment.upvote_count || 0)}</button>
            <button class="community-vote-btn ${vote === -1 ? 'active' : ''}" type="button" data-comment-vote="${ForumCore.escapeHtml(comment.id)}" data-value="-1">▼ ${Number(comment.downvote_count || 0)}</button>
            <button class="community-mini-btn" type="button" data-reply-to="${ForumCore.escapeHtml(comment.id)}">Rispondi</button>
            <button class="community-mini-btn" type="button" data-report-comment="${ForumCore.escapeHtml(comment.id)}">Segnala</button>
          </div>
          ${children}
        </article>
      `;
    }).join('');
  }

  pageEls.commentsList.innerHTML = renderBranch() || '<div class="community-empty">Nessun commento ancora. Apri tu la discussione.</div>';
  bindCommentActions();
}

function renderRelatedThreads(rows) {
  pageEls.relatedThreads.innerHTML = rows.map((row) => `
    <a class="community-link-card" href="post.html?thread=${ForumCore.escapeHtml(row.id)}" style="padding:14px">
      <strong>${ForumCore.escapeHtml(row.title)}</strong>
      <div class="community-muted">${Number(row.reply_count || 0)} commenti · ${Number(row.score || 0)} punti</div>
    </a>
  `).join('') || '<div class="community-empty">Nessuna discussione correlata.</div>';
}

function requireLogin() {
  pageEls.authDialog.showModal();
}

function bindThreadActions() {
  pageEls.threadCard.querySelectorAll('[data-thread-vote]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!pageState.user) return requireLogin();
      try {
        await ForumCore.forumApi('vote-thread', { thread_id: pageState.thread.id, value: Number(button.dataset.threadVote) });
        await bootstrap();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.getElementById('saveThreadBtn')?.addEventListener('click', async () => {
    if (!pageState.user) return requireLogin();
    await ForumCore.forumApi('toggle-save-thread', { thread_id: pageState.thread.id });
    await bootstrap();
  });

  document.getElementById('followThreadBtn')?.addEventListener('click', async () => {
    if (!pageState.user) return requireLogin();
    await ForumCore.forumApi('toggle-follow-thread', { thread_id: pageState.thread.id });
    await bootstrap();
  });
}

function bindCommentActions() {
  pageEls.commentsList.querySelectorAll('[data-reply-to]').forEach((button) => {
    button.addEventListener('click', () => {
      pageEls.commentParentId.value = button.dataset.replyTo;
      pageEls.cancelReplyBtn.classList.remove('hidden');
      pageEls.commentBody.focus();
    });
  });
  pageEls.commentsList.querySelectorAll('[data-comment-vote]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!pageState.user) return requireLogin();
      try {
        await ForumCore.forumApi('vote-post', {
          post_id: button.dataset.commentVote,
          value: Number(button.dataset.value)
        });
        await bootstrap();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  pageEls.commentsList.querySelectorAll('[data-report-comment]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!pageState.user) return requireLogin();
      const reason = window.prompt('Motivo della segnalazione', 'spam');
      if (!reason) return;
      await ForumCore.forumApi('create-report', {
        target_type: 'post',
        target_id: button.dataset.reportComment,
        reason
      });
      toast('Segnalazione inviata');
    });
  });
}

async function submitComment(event) {
  event.preventDefault();
  if (!pageState.user) return requireLogin();
  pageEls.commentMessage.textContent = 'Invio commento...';
  try {
    await ForumCore.forumApi('create-comment', {
      thread_id: pageState.thread.id,
      parent_post_id: pageEls.commentParentId.value || null,
      body: pageEls.commentBody.value.trim()
    });
    pageEls.commentForm.reset();
    pageEls.commentParentId.value = '';
    pageEls.cancelReplyBtn.classList.add('hidden');
    pageEls.commentMessage.textContent = '';
    await bootstrap();
    toast('Commento pubblicato');
  } catch (error) {
    pageEls.commentMessage.textContent = error.message;
  }
}

async function bootstrap() {
  document.getElementById('pageNav').innerHTML = ForumCore.buildShellLinks('forum');
  setTheme();
  await loadSession();
  await loadThread();
  renderThread();
  renderComments();
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  localStorage.setItem('incForumTheme', next);
});
pageEls.loginBtn.addEventListener('click', requireLogin);
pageEls.logoutBtn.addEventListener('click', logout);
pageEls.closeAuthBtn.addEventListener('click', () => pageEls.authDialog.close());
pageEls.cancelAuthBtn.addEventListener('click', () => pageEls.authDialog.close());
pageEls.doLoginBtn.addEventListener('click', login);
pageEls.commentForm.addEventListener('submit', submitComment);
pageEls.cancelReplyBtn.addEventListener('click', () => {
  pageEls.commentParentId.value = '';
  pageEls.cancelReplyBtn.classList.add('hidden');
});
pageEls.commentSort.addEventListener('change', renderComments);
pageEls.reportThreadBtn.addEventListener('click', async () => {
  if (!pageState.user) return requireLogin();
  const reason = window.prompt('Motivo della segnalazione', 'spam');
  if (!reason) return;
  await ForumCore.forumApi('create-report', {
    target_type: 'thread',
    target_id: pageState.thread.id,
    reason
  });
  toast('Segnalazione inviata');
});
pageEls.markResolvedBtn.addEventListener('click', async () => {
  if (!canModerateThread()) return;
  await ForumCore.forumApi('mark-thread-resolved', { thread_id: pageState.thread.id });
  await bootstrap();
});
pageEls.lockThreadBtn.addEventListener('click', async () => {
  if (!isStaff()) return;
  await ForumCore.forumApi('toggle-thread-lock', {
    thread_id: pageState.thread.id,
    is_locked: !pageState.thread.is_locked
  });
  await bootstrap();
});

bootstrap().catch((error) => {
  pageEls.threadCard.innerHTML = `<div class="community-empty">${ForumCore.escapeHtml(error.message)}</div>`;
});
