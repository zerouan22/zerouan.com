const FORUM_SUPABASE_URL = 'https://vxnlycbuacrielnhjqqi.supabase.co';
const FORUM_SUPABASE_ANON_KEY = 'sb_publishable_rwF9RZvjKHXtB1fjCTkzfw_x8xrwKQH';
const forumDb = window.supabase.createClient(FORUM_SUPABASE_URL, FORUM_SUPABASE_ANON_KEY);

const ForumCore = {
  db: forumDb,
  supabaseUrl: FORUM_SUPABASE_URL,
  supabaseAnonKey: FORUM_SUPABASE_ANON_KEY,
  escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },
  fmtDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  },
  fmtShortDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  },
  initial(name = 'U') {
    return String(name || 'U').trim().slice(0, 1).toUpperCase() || 'U';
  },
  safeUrl(url) {
    try {
      const parsed = new URL(String(url || '').trim());
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
      return '';
    }
  },
  getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  },
  async getSession() {
    const { data } = await forumDb.auth.getSession();
    return data.session || null;
  },
  async getCurrentUser() {
    const session = await this.getSession();
    if (!session?.user) return { session: null, user: null, profile: null };
    const { data: profile } = await forumDb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return { session, user: session.user, profile: profile || null };
  },
  async forumApi(action, payload = {}) {
    const session = await this.getSession();
    if (!session?.access_token) throw new Error('AUTH_REQUIRED');
    const response = await fetch(`${FORUM_SUPABASE_URL}/functions/v1/forum-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': FORUM_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ action, payload })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || 'EDGE_FUNCTION_ERROR');
    return json.data;
  },
  mediaArray(value) {
    return Array.isArray(value) ? value : [];
  },
  mediaHtml(items = []) {
    return items.map((item) => {
      const url = this.safeUrl(item.url);
      if (!url) return '';
      if (item.type === 'image') {
        return `<figure class="community-media-card"><img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(item.title || 'media')}" loading="lazy"></figure>`;
      }
      if (String(item.type).includes('youtube')) {
        return `<figure class="community-media-card"><iframe src="${this.escapeHtml(this.youtubeEmbed(url))}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>`;
      }
      return `<a class="community-link-card" href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${this.escapeHtml(item.title || url)}</a>`;
    }).join('');
  },
  youtubeEmbed(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(parsed.pathname.slice(1))}`;
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(parsed.searchParams.get('v') || parsed.pathname.split('/').pop() || '')}`;
    } catch {
      return '';
    }
  },
  async fetchUnreadNotificationsCount(userId) {
    if (!userId) return 0;
    const { count } = await forumDb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  },
  buildShellLinks(current = '') {
    return `
      <a class="${current === 'forum' ? 'active' : ''}" href="forum.html">Forum</a>
      <a class="${current === 'categories' ? 'active' : ''}" href="categories.html">Categorie</a>
      <a class="${current === 'notifications' ? 'active' : ''}" href="notifications.html">Notifiche</a>
      <a class="${current === 'profile' ? 'active' : ''}" href="profile.html">Profilo</a>
      <a href="index.html">Sito</a>
    `;
  }
};

window.ForumCore = ForumCore;
