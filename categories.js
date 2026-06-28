async function loadCategoriesPage() {
  document.getElementById('pageNav').innerHTML = ForumCore.buildShellLinks('categories');
  document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark';
  const [{ data: categories }, { data: flairs }, { data: recentThreads }] = await Promise.all([
    ForumCore.db.from('category_overview').select('*').order('sort_order'),
    ForumCore.db.from('forum_flairs').select('*').eq('is_active', true).order('sort_order'),
    ForumCore.db.from('thread_overview').select('*').order('last_activity_at', { ascending: false }).limit(60)
  ]);
  const host = document.getElementById('categoriesGrid');
  host.innerHTML = (categories || []).map((category) => {
    const categoryFlairs = (flairs || []).filter((flair) => !flair.category_id || flair.category_id === category.id);
    const lastThread = (recentThreads || []).find((thread) => thread.category_id === category.id);
    return `
      <article id="${ForumCore.escapeHtml(category.slug || category.id)}" class="community-page-panel">
        <div class="community-page-header">
          <div>
            <p class="eyebrow">${ForumCore.escapeHtml(category.slug || 'categoria')}</p>
            <h2 class="community-section-title">${ForumCore.escapeHtml(category.name)}</h2>
            <p class="community-muted">${ForumCore.escapeHtml(category.description || 'Nessuna descrizione')}</p>
          </div>
          <div class="community-stat-row">
            <div><strong>${Number(category.thread_count || 0)}</strong><div class="community-muted">Discussioni</div></div>
            <div><strong>${Number(category.post_count || 0)}</strong><div class="community-muted">Commenti</div></div>
            <div><strong>${Number(category.flair_count || 0)}</strong><div class="community-muted">Flair</div></div>
          </div>
        </div>
        <div class="community-badge-row">
          ${categoryFlairs.map((flair) => `<span class="community-flair" style="background:${ForumCore.escapeHtml(flair.color)}22;border-color:${ForumCore.escapeHtml(flair.color)}77">${ForumCore.escapeHtml(flair.name)}</span>`).join('') || '<span class="community-muted">Nessun flair attivo</span>'}
        </div>
        <div class="community-page-grid" style="margin-top:16px">
          <div class="community-main-col">
            <a class="primary-btn" href="forum.html">Apri feed</a>
          </div>
          <div class="community-side-col" style="min-width:240px">
            <div class="community-side-card">
              <p class="eyebrow">Ultimo thread</p>
              ${lastThread ? `<a href="post.html?thread=${ForumCore.escapeHtml(lastThread.id)}"><strong>${ForumCore.escapeHtml(lastThread.title)}</strong></a><div class="community-muted">${ForumCore.fmtDate(lastThread.last_activity_at || lastThread.created_at)}</div>` : '<div class="community-muted">Nessuna attività recente</div>'}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  localStorage.setItem('incForumTheme', next);
});

loadCategoriesPage();
