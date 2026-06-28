(function () {
  if (typeof state === 'undefined' || typeof db === 'undefined') return;

  state.flairs = [];
  state.savedThreadIds = new Set();
  state.followedThreadIds = new Set();
  state.threadVotes = new Map();
  state.communityScope = 'all';

  function communityEscape(value = '') {
    return ForumCore.escapeHtml(value);
  }

  function threadMetaTags(thread) {
    const items = [];
    if (thread.flair_name) {
      items.push(`<span class="community-flair" style="${thread.flair_color ? `background:${communityEscape(thread.flair_color)}22;border-color:${communityEscape(thread.flair_color)}77;color:#fff;` : ''}">${communityEscape(thread.flair_name)}</span>`);
    }
    if (thread.post_type) items.push(`<span class="badge">${communityEscape(thread.post_type.replaceAll('_', ' '))}</span>`);
    if (thread.is_featured) items.push('<span class="badge">In evidenza</span>');
    if (thread.is_solved) items.push('<span class="badge">Risolto</span>');
    if (thread.is_locked) items.push('<span class="badge">Chiuso</span>');
    return items.join('');
  }

  function renderCommunityFilterBar() {
    if (document.getElementById('communityFilterBar')) return;
    const tabs = document.querySelector('.tabs');
    if (!tabs?.parentElement) return;
    const bar = document.createElement('section');
    bar.id = 'communityFilterBar';
    bar.className = 'community-filter-bar';
    bar.innerHTML = `
      <label>Flair
        <select id="flairFilterSelect">
          <option value="all">Tutti i flair</option>
        </select>
      </label>
      <label>Stato
        <select id="threadStatusFilter">
          <option value="all">Tutti gli stati</option>
          <option value="open">Aperti</option>
          <option value="solved">Risolti</option>
          <option value="locked">Chiusi</option>
          <option value="featured">In evidenza</option>
        </select>
      </label>
      <div>
        <span class="muted small">Scorciatoie feed</span>
        <div class="community-scope-row" id="communityScopeRow">
          <button class="community-scope-btn active" data-scope="all" type="button">Tutto</button>
          <button class="community-scope-btn" data-scope="unanswered" type="button">Senza risposte</button>
          <button class="community-scope-btn" data-scope="featured" type="button">In evidenza</button>
          <button class="community-scope-btn" data-scope="saved" type="button">Salvati</button>
          <button class="community-scope-btn" data-scope="following" type="button">Seguiti</button>
        </div>
      </div>
    `;
    tabs.insertAdjacentElement('afterend', bar);
    bar.querySelectorAll('[data-scope]').forEach((button) => {
      button.addEventListener('click', () => {
        state.communityScope = button.dataset.scope;
        bar.querySelectorAll('[data-scope]').forEach((node) => node.classList.toggle('active', node === button));
        renderThreads();
      });
    });
    bar.querySelector('#flairFilterSelect')?.addEventListener('change', renderThreads);
    bar.querySelector('#threadStatusFilter')?.addEventListener('change', renderThreads);
  }

  async function loadCommunityMeta() {
    const flairPromise = db.from('forum_flairs').select('*').eq('is_active', true).order('sort_order');
    const tasks = [flairPromise];
    if (state.user) {
      tasks.push(db.from('thread_bookmarks').select('thread_id').eq('user_id', state.user.id));
      tasks.push(db.from('forum_followed_threads').select('thread_id').eq('user_id', state.user.id));
      tasks.push(db.from('forum_thread_votes').select('thread_id,value').eq('user_id', state.user.id));
      tasks.push(db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id).eq('is_read', false));
    }
    const results = await Promise.all(tasks);
    state.flairs = results[0]?.data || [];
    if (state.user) {
      state.savedThreadIds = new Set((results[1]?.data || []).map((row) => row.thread_id));
      state.followedThreadIds = new Set((results[2]?.data || []).map((row) => row.thread_id));
      state.threadVotes = new Map((results[3]?.data || []).map((row) => [row.thread_id, row.value]));
      renderNotificationChip(results[4]?.count || 0);
    } else {
      state.savedThreadIds = new Set();
      state.followedThreadIds = new Set();
      state.threadVotes = new Map();
      renderNotificationChip(0);
    }
    hydrateFlairFilter();
  }

  function hydrateFlairFilter() {
    const select = document.getElementById('flairFilterSelect');
    if (!select) return;
    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Tutti i flair</option>' + state.flairs.map((flair) => `<option value="${communityEscape(flair.id)}">${communityEscape(flair.name)}</option>`).join('');
    select.value = current;
  }

  function renderNotificationChip(count) {
    const top = document.querySelector('.top-actions');
    if (!top) return;
    let link = document.getElementById('forumNotificationsLink');
    if (!link) {
      link = document.createElement('a');
      link.id = 'forumNotificationsLink';
      link.className = 'icon-btn';
      link.href = 'notifications.html';
      link.textContent = '🔔';
      top.insertBefore(link, els?.logoutBtn || null);
    }
    link.setAttribute('aria-label', count ? `Notifiche (${count})` : 'Notifiche');
    link.title = count ? `${count} notifiche non lette` : 'Notifiche';
    link.dataset.badge = String(count || 0);
  }

  function matchesCommunityFilters(thread) {
    const flairValue = document.getElementById('flairFilterSelect')?.value || 'all';
    const statusValue = document.getElementById('threadStatusFilter')?.value || 'all';
    if (flairValue !== 'all' && thread.flair_id !== flairValue) return false;
    if (statusValue === 'solved' && !thread.is_solved) return false;
    if (statusValue === 'locked' && !thread.is_locked) return false;
    if (statusValue === 'featured' && !thread.is_featured) return false;
    if (statusValue === 'open' && (thread.is_locked || thread.is_solved)) return false;
    if (state.communityScope === 'unanswered' && Number(thread.reply_count || 0) > 0) return false;
    if (state.communityScope === 'featured' && !thread.is_featured) return false;
    if (state.communityScope === 'saved' && !state.savedThreadIds.has(thread.id)) return false;
    if (state.communityScope === 'following' && !state.followedThreadIds.has(thread.id)) return false;
    return true;
  }

  const baseFilteredThreads = filteredThreads;
  filteredThreads = function filteredThreadsCommunity() {
    let items = [...state.threads].filter((thread) => thread.category_id === state.selectedCategoryId);
    if (state.search) items = items.filter((thread) => `${thread.title} ${thread.body} ${thread.author_name} ${(thread.flair_name || '')} ${(thread.tags || []).join(' ')}`.toLowerCase().includes(state.search));
    items = items.filter(matchesCommunityFilters);
    if (state.sort === 'popular') items.sort((a, b) => (Number(b.score || 0) * 10 + Number(b.reply_count || 0) * 4 + Number(b.view_count || 0)) - (Number(a.score || 0) * 10 + Number(a.reply_count || 0) * 4 + Number(a.view_count || 0)));
    if (state.sort === 'discussed') items.sort((a, b) => Number(b.reply_count || 0) - Number(a.reply_count || 0));
    if (state.sort === 'media') items = items.filter((thread) => ForumCore.mediaArray(thread.media_items).length > 0);
    if (state.sort === 'recent') items.sort((a, b) => new Date(b.last_activity_at || b.created_at) - new Date(a.last_activity_at || a.created_at));
    return items;
  };

  renderThreads = function renderThreadsCommunity() {
    const items = filteredThreads();
    els.emptyThreads.classList.toggle('hidden', items.length > 0);
    els.threadList.innerHTML = items.map((thread) => {
      const saved = state.savedThreadIds.has(thread.id);
      const following = state.followedThreadIds.has(thread.id);
      const vote = state.threadVotes.get(thread.id) || 0;
      return `
        <article class="thread-item community-feed-item" data-id="${communityEscape(thread.id)}">
          <div class="community-score-stack">
            <button class="community-vote-btn ${vote === 1 ? 'active' : ''}" type="button" data-thread-vote="${communityEscape(thread.id)}" data-value="1">▲</button>
            <strong>${Number(thread.score || 0)}</strong>
            <button class="community-vote-btn ${vote === -1 ? 'active' : ''}" type="button" data-thread-vote="${communityEscape(thread.id)}" data-value="-1">▼</button>
          </div>
          <div>
            <div class="author-row">
              <a class="profile-link" href="profile.html?id=${communityEscape(thread.author_id)}">${communityEscape(thread.author_name)}</a>
              <span class="badge">${communityEscape(thread.author_level_label || 'Livello 1')}</span>
              <span class="muted small">${ForumCore.fmtDate(thread.created_at)}</span>
              ${threadMetaTags(thread)}
            </div>
            <h3>${communityEscape(thread.title)}</h3>
            <p>${communityEscape(thread.excerpt || thread.body || '')}</p>
            <div class="reaction-bar">
              <span class="reaction-btn">💬 ${Number(thread.reply_count || 0)}</span>
              <span class="reaction-btn">👁 ${Number(thread.view_count || 0)}</span>
              <button class="reaction-btn" type="button" data-thread-save="${communityEscape(thread.id)}">${saved ? '★ Salvato' : '☆ Salva'}</button>
              <button class="reaction-btn" type="button" data-thread-follow="${communityEscape(thread.id)}">${following ? 'Seguito' : 'Segui'}</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    els.threadList.querySelectorAll('.community-feed-item').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('button,a')) return;
        window.location.href = `post.html?thread=${encodeURIComponent(card.dataset.id)}`;
      });
    });

    els.threadList.querySelectorAll('[data-thread-vote]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!state.user) return requireLogin();
        try {
          await ForumCore.forumApi('vote-thread', {
            thread_id: button.dataset.threadVote,
            value: Number(button.dataset.value)
          });
          await loadCommunityMeta();
          await loadThreads();
        } catch (error) {
          toast(error.message);
        }
      });
    });

    els.threadList.querySelectorAll('[data-thread-save]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!state.user) return requireLogin();
        try {
          await ForumCore.forumApi('toggle-save-thread', { thread_id: button.dataset.threadSave });
          await loadCommunityMeta();
          renderThreads();
        } catch (error) {
          toast(error.message);
        }
      });
    });

    els.threadList.querySelectorAll('[data-thread-follow]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!state.user) return requireLogin();
        try {
          await ForumCore.forumApi('toggle-follow-thread', { thread_id: button.dataset.threadFollow });
          await loadCommunityMeta();
          renderThreads();
        } catch (error) {
          toast(error.message);
        }
      });
    });
  };

  loadThreads = async function loadThreadsCommunity() {
    const { data, error } = await db.from('thread_overview').select('*').order('last_activity_at', { ascending: false }).limit(250);
    if (error) return toast('Errore discussioni: ' + error.message);
    state.threads = data || [];
    renderThreads();
    renderPopular();
  };

  openThread = function openThreadCommunity(id) {
    window.location.href = `post.html?thread=${encodeURIComponent(id)}`;
  };

  const baseLoadSession = loadSession;
  loadSession = async function loadSessionCommunity() {
    await baseLoadSession();
    await loadCommunityMeta();
  };

  const baseLoadCategories = loadCategories;
  loadCategories = async function loadCategoriesCommunity() {
    await baseLoadCategories();
    renderCommunityFilterBar();
    hydrateFlairFilter();
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderCommunityFilterBar();
  });

  (async () => {
    try {
      renderCommunityFilterBar();
      await loadCommunityMeta();
      await loadThreads();
    } catch (error) {
      console.error(error);
    }
  })();
})();
