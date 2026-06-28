async function loadNotificationsPage() {
  document.getElementById('pageNav').innerHTML = ForumCore.buildShellLinks('notifications');
  document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark';
  const auth = await ForumCore.getCurrentUser();
  const host = document.getElementById('notificationsList');
  if (!auth.user) {
    host.innerHTML = '<div class="community-empty">Accedi per vedere le notifiche.</div>';
    document.getElementById('markAllReadBtn').disabled = true;
    return;
  }
  const { data } = await ForumCore.db
    .from('notifications')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(80);
  host.innerHTML = (data || []).map((notification) => {
    const payload = notification.payload || {};
    const threadLink = payload.thread_id ? `post.html?thread=${encodeURIComponent(payload.thread_id)}` : 'forum.html';
    return `
      <article class="community-notification-row ${notification.is_read ? '' : 'panel'}">
        <div>
          <div class="community-meta-row">
            <span class="community-flair">${ForumCore.escapeHtml(notification.type || 'update')}</span>
            <span>${ForumCore.fmtDate(notification.created_at)}</span>
            ${notification.is_read ? '<span class="community-muted">letta</span>' : '<span class="badge">nuova</span>'}
          </div>
          <h3 style="margin:.4rem 0">${ForumCore.escapeHtml(payload.title || payload.body || notification.type || 'Notifica')}</h3>
          <p class="community-muted">${ForumCore.escapeHtml(payload.body || JSON.stringify(payload))}</p>
        </div>
        <a class="community-mini-btn" href="${threadLink}">Apri</a>
      </article>
    `;
  }).join('') || '<div class="community-empty">Nessuna notifica.</div>';
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  localStorage.setItem('incForumTheme', next);
});

document.getElementById('markAllReadBtn').addEventListener('click', async () => {
  try {
    await ForumCore.forumApi('mark-notifications-read');
    await loadNotificationsPage();
  } catch (error) {
    console.error(error);
  }
});

loadNotificationsPage();
