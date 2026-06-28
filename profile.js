async function loadProfilePage() {
  document.getElementById('pageNav').innerHTML = ForumCore.buildShellLinks('profile');
  document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark';
  const auth = await ForumCore.getCurrentUser();
  const requestedId = ForumCore.getQueryParam('id') || auth.user?.id;
  if (!requestedId) {
    document.getElementById('profileHero').innerHTML = '<div class="community-empty">Accedi o apri un profilo specifico.</div>';
    return;
  }
  const [{ data: profile }, { data: threads }, { data: comments }, { data: badges }] = await Promise.all([
    ForumCore.db.from('profiles').select('*').eq('id', requestedId).maybeSingle(),
    ForumCore.db.from('thread_overview').select('*').eq('author_id', requestedId).order('created_at', { ascending: false }).limit(12),
    ForumCore.db.from('post_overview').select('*').eq('author_id', requestedId).order('created_at', { ascending: false }).limit(12),
    ForumCore.db.from('user_badges').select('badge_id,badges(name,color,icon)').eq('user_id', requestedId)
  ]);
  if (!profile) {
    document.getElementById('profileHero').innerHTML = '<div class="community-empty">Profilo non trovato.</div>';
    return;
  }
  document.title = `${profile.display_name} · INC. Forum`;
  const extra = profile.profile_extra || {};
  const badgeRows = (badges || []).map((row) => row.badges).filter(Boolean);
  document.getElementById('profileHero').innerHTML = `
    <div class="community-author-chip">
      <div class="community-avatar xl" style="${profile.avatar_url ? `background-image:url('${ForumCore.escapeHtml(profile.avatar_url)}')` : ''}">${profile.avatar_url ? '' : ForumCore.initial(profile.display_name)}</div>
      <div class="community-profile-summary">
        <div class="community-meta-row">
          <span class="community-flair">${ForumCore.escapeHtml(profile.level_label || 'Nuovo utente')}</span>
          <span class="badge">${ForumCore.escapeHtml(profile.role || 'user')}</span>
          ${profile.is_artist ? '<span class="badge">Artista</span>' : ''}
        </div>
        <h1 class="community-thread-title">${ForumCore.escapeHtml(profile.display_name || 'Utente')}</h1>
        <p class="community-muted">${ForumCore.escapeHtml(profile.bio || extra.headline || 'Nessuna bio ancora.')}</p>
        <div class="community-meta-row">
          <span>${Number(profile.reputation || 0)} reputazione</span>
          <span>${Number(profile.post_count || 0)} thread</span>
          <span>${Number(profile.comment_count || 0)} commenti</span>
          <span>Iscritto ${ForumCore.fmtShortDate(profile.created_at)}</span>
        </div>
        <div class="community-badge-row">
          ${badgeRows.map((badge) => `<span class="community-flair" style="background:${ForumCore.escapeHtml(badge.color || '#8b2cff')}22;border-color:${ForumCore.escapeHtml(badge.color || '#8b2cff')}77">${ForumCore.escapeHtml(badge.name || badge.icon || 'Badge')}</span>`).join('') || '<span class="community-muted">Nessun badge ancora</span>'}
        </div>
      </div>
    </div>
  `;
  document.getElementById('profileThreads').innerHTML = (threads || []).map((thread) => `
    <a class="community-link-card" href="post.html?thread=${ForumCore.escapeHtml(thread.id)}" style="padding:14px">
      <strong>${ForumCore.escapeHtml(thread.title)}</strong>
      <div class="community-muted">${Number(thread.score || 0)} punti · ${Number(thread.reply_count || 0)} commenti</div>
    </a>
  `).join('') || '<div class="community-empty">Nessun thread pubblicato.</div>';
  document.getElementById('profileComments').innerHTML = (comments || []).map((comment) => `
    <a class="community-link-card" href="post.html?thread=${ForumCore.escapeHtml(comment.thread_id)}" style="padding:14px">
      <strong>${ForumCore.escapeHtml(comment.body || '').slice(0, 120)}</strong>
      <div class="community-muted">${Number(comment.score || 0)} punti · ${ForumCore.fmtDate(comment.created_at)}</div>
    </a>
  `).join('') || '<div class="community-empty">Nessun commento recente.</div>';
  if (auth.user?.id === requestedId) {
    document.getElementById('savedSection').classList.remove('hidden');
    const { data: bookmarks } = await ForumCore.db.from('thread_bookmarks').select('thread_id').eq('user_id', requestedId);
    const savedIds = (bookmarks || []).map((row) => row.thread_id);
    const { data: savedThreads } = savedIds.length
      ? await ForumCore.db.from('thread_overview').select('*').in('id', savedIds).order('created_at', { ascending: false })
      : { data: [] };
    document.getElementById('savedThreads').innerHTML = (savedThreads || []).map((thread) => `
      <a class="community-link-card" href="post.html?thread=${ForumCore.escapeHtml(thread.id)}" style="padding:14px">
        <strong>${ForumCore.escapeHtml(thread.title)}</strong>
        <div class="community-muted">${ForumCore.escapeHtml(thread.category_name || 'Categoria')} · ${Number(thread.score || 0)} punti</div>
      </a>
    `).join('') || '<div class="community-empty">Non hai ancora salvato nessun post.</div>';
  }
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  localStorage.setItem('incForumTheme', next);
});

loadProfilePage();
