import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const STORAGE_BUCKET = Deno.env.get("FORUM_STORAGE_BUCKET") || "forum-media";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedMediaHosts = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "open.spotify.com",
  "soundcloud.com",
  "bandcamp.com",
  "music.apple.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "twitch.tv",
  "discord.gg",
  "discord.com",
  "linktr.ee",
  "beacons.ai",
  "substack.com",
  "github.com",
];

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 6 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorPayload(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message || "EDGE_FUNCTION_ERROR" };
  }
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;
    const message = String(row.message || row.error_description || row.error || "EDGE_FUNCTION_ERROR");
    return {
      message,
      code: row.code ? String(row.code) : undefined,
      details: row.details ? String(row.details) : undefined,
      hint: row.hint ? String(row.hint) : undefined,
    };
  }
  return { message: String(error || "EDGE_FUNCTION_ERROR") };
}

function cleanText(value: unknown, max = 4000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function hostAllowed(url: string) {
  if (!url) return false;
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  return allowedMediaHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function sanitizeExternalLinks(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input)) {
    const url = safeUrl(raw);
    if (url) output[cleanText(key, 32)] = url;
  }
  return output;
}

function mediaKind(url: string) {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/open\.spotify\.com/.test(url)) return "spotify";
  if (/soundcloud\.com/.test(url)) return "soundcloud";
  if (/bandcamp\.com/.test(url)) return "bandcamp";
  if (/music\.apple\.com/.test(url)) return "apple_music";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  return "link";
}

function sanitizeMedia(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const url = safeUrl(row.url);
    if (String(row.type || "") === "image") {
      return {
        type: "image",
        url,
        path: cleanText(row.path, 260),
        title: cleanText(row.title, 90) || "Immagine",
      };
    }
    if (!url) return null;
    return {
      type: cleanText(row.type, 32) || mediaKind(url),
      url,
      title: cleanText(row.title, 90) || url,
    };
  }).filter(Boolean);
}

function extractTags(text: string) {
  return [...new Set((text.match(/#[\p{L}\p{N}_-]+/gu) || []).map((tag) => tag.slice(1).toLowerCase()).slice(0, 12))];
}

function spamScore(text: string, media: unknown[]) {
  const body = text.toLowerCase();
  let score = 0;
  const links = body.match(/https?:\/\//g)?.length || 0;
  if (links > 3) score += links * 2;
  if (/(casino|crypto giveaway|free followers|viagra|onlyfans leak)/i.test(body)) score += 8;
  if (/(.)\1{12,}/.test(body)) score += 5;
  if (media.length > 6) score += 3;
  return score;
}

async function currentUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("AUTH_REQUIRED");
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return { user: data.user, profile };
}

function requireRole(profile: Record<string, unknown> | null, roles: string[]) {
  const role = String(profile?.role || "user");
  if (role === "owner") return;
  if (!roles.includes(role)) throw new Error("FORBIDDEN");
}

function ensureCanPublish(profile: Record<string, unknown> | null) {
  const role = String(profile?.role || "user");
  const mutedUntil = profile?.muted_until ? new Date(String(profile.muted_until)).getTime() : 0;
  const bannedUntil = profile?.banned_until ? new Date(String(profile.banned_until)).getTime() : 0;
  if (role === "banned" || (bannedUntil && bannedUntil > Date.now())) throw new Error("USER_BANNED");
  if (role === "muted" || (mutedUntil && mutedUntil > Date.now())) throw new Error("USER_MUTED");
}

const defaultWriteRoles = ["owner", "admin", "moderator", "artist", "trusted_user", "user"];
const staffWriteRoles = ["owner", "admin", "moderator"];
const artistWriteRoles = ["owner", "admin", "moderator", "artist"];
const announcementWriteSlugs = new Set(["annunci"]);
const promotionWriteSlugs = new Set(["promozioni-release", "promozioni-e-release", "promozioni_release", "release", "promo-release"]);

function defaultCategoryWritePermissions() {
  return {
    default: [...defaultWriteRoles],
    annunci: [...staffWriteRoles],
    "promozioni-release": [...artistWriteRoles],
    "promozioni-e-release": [...artistWriteRoles],
    promozioni_release: [...artistWriteRoles],
    release: [...artistWriteRoles],
    "promo-release": [...artistWriteRoles],
  };
}

function actorWriteRoles(profile: Record<string, unknown> | null) {
  const role = String(profile?.role || "user").toLowerCase();
  const roles = new Set([role]);
  if (profile?.is_artist === true || String(profile?.user_group || "").toLowerCase() === "artist" || role === "artist") roles.add("artist");
  return [...roles];
}

async function categoryWriteRoles(slugValue: unknown) {
  const slug = String(slugValue || "").toLowerCase();
  const fallback = defaultCategoryWritePermissions();
  if (announcementWriteSlugs.has(slug)) return fallback.annunci;
  if (promotionWriteSlugs.has(slug)) return fallback[slug as keyof typeof fallback] || artistWriteRoles;
  const { data } = await admin.from("site_settings").select("value").eq("key", "category_write_permissions").maybeSingle();
  const configured = data?.value && typeof data.value === "object" ? data.value as Record<string, unknown> : {};
  const raw = configured[slug] || configured.default || fallback.default;
  return Array.isArray(raw) ? raw.map((role) => String(role).toLowerCase()).filter((role) => !["muted", "banned"].includes(role)) : fallback.default;
}

async function ensureCanWriteInCategory(profile: Record<string, unknown> | null, category: Record<string, unknown>) {
  const allowed = await categoryWriteRoles(category.slug);
  const roles = actorWriteRoles(profile);
  if (!roles.some((role) => allowed.includes(role))) throw new Error("CATEGORY_WRITE_FORBIDDEN");
}

function compact<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function cleanStringArray(value: unknown, max = 24, itemMax = 80) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, itemMax)).filter(Boolean).slice(0, max);
}

function sanitizeProfileJson(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    const cleanKey = cleanText(key, 48);
    if (!cleanKey) continue;
    if (Array.isArray(raw)) {
      output[cleanKey] = raw.slice(0, 40).map((item) => {
        if (item && typeof item === "object") return sanitizeProfileJson(item);
        return cleanText(item, 180);
      }).filter(Boolean);
    }
    else if (raw && typeof raw === "object") output[cleanKey] = sanitizeProfileJson(raw);
    else output[cleanKey] = typeof raw === "string" ? cleanText(raw, 800) : raw;
  }
  return output;
}

function extractMentions(text: string) {
  return [...new Set((text.match(/@[\p{L}\p{N}_.-]+/gu) || []).map((value) => value.slice(1).toLowerCase()).slice(0, 12))];
}

async function notifyMentions(actorId: string, text: string, payload: Record<string, unknown>) {
  const mentions = extractMentions(text);
  if (!mentions.length) return;
  const { data: profiles } = await admin.from("profiles").select("id,username").in("username", mentions);
  const rows = (profiles || [])
    .filter((row) => row.id !== actorId)
    .map((row) => ({
      user_id: row.id,
      type: "mention",
      payload: { ...payload, username: row.username, actor_id: actorId },
    }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

async function toggleVote(table: "forum_thread_votes" | "forum_post_votes", targetKey: "thread_id" | "post_id", targetId: string, userId: string, value: number) {
  const { data: existing } = await admin.from(table).select(`${targetKey},value`).eq(targetKey, targetId).eq("user_id", userId).maybeSingle();
  if (existing?.value === value) {
    const { error } = await admin.from(table).delete().eq(targetKey, targetId).eq("user_id", userId);
    if (error) throw error;
    return { active: 0 };
  }
  const { error } = await admin.from(table).upsert({ [targetKey]: targetId, user_id: userId, value }, { onConflict: `${targetKey},user_id` });
  if (error) throw error;
  return { active: value };
}

async function upsertSetting(key: string, value: unknown) {
  const { data, error } = await admin
    .from("site_settings")
    .upsert({ key: cleanText(key, 80), value: value && typeof value === "object" ? value : {} }, { onConflict: "key" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function logAction(actorId: string, action: string, targetType: string, targetId: string | null, payload: unknown) {
  await admin.from("moderation_events").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: payload || {},
  });
}

async function createNotification(userId: string | null, type: string, payload: Record<string, unknown>) {
  if (!userId) return;
  await admin.from("notifications").insert({ user_id: userId, type, payload });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { user, profile } = await currentUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};

    if (action === "get-admin-dashboard") {
      requireRole(profile, ["admin", "moderator"]);
      const [{ data: users }, { data: events }, { data: reports }] = await Promise.all([
        admin.from("profiles").select("id,display_name,username,role,user_group,is_artist,last_seen_at,created_at,profile_extra,artist_profile").order("created_at", { ascending: false }).limit(300),
        admin.from("moderation_events").select("*").order("created_at", { ascending: false }).limit(80),
        admin.from("content_reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(80),
      ]);
      return json({ data: { users: users || [], events: events || [], reports: reports || [] } });
    }

    if (action === "get-admin-dashboard-complete") {
      requireRole(profile, ["admin", "moderator"]);
      const [
        { data: users },
        { data: events },
        { data: reports },
        { data: threads },
        { data: posts },
        { data: soundCards },
        { data: notifications },
        { data: uploads },
        { data: blocks },
        { data: settingsRows },
        { data: stats },
      ] = await Promise.all([
        admin.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
        admin.from("moderation_events").select("*").order("created_at", { ascending: false }).limit(250),
        admin.from("content_reports").select("*").order("created_at", { ascending: false }).limit(250),
        admin.from("thread_overview").select("*").order("last_activity_at", { ascending: false }).limit(500),
        admin.from("post_overview").select("*").order("created_at", { ascending: false }).limit(500),
        admin.from("sound_cards").select("*").order("created_at", { ascending: false }).limit(500),
        admin.from("notifications").select("*").order("created_at", { ascending: false }).limit(250),
        admin.from("forum_uploads").select("*").order("created_at", { ascending: false }).limit(250),
        admin.from("admin_blocks").select("*").order("sort_order", { ascending: true }).limit(250),
        admin.from("site_settings").select("*"),
        admin.from("forum_stats").select("*").maybeSingle(),
      ]);
      const settings: Record<string, unknown> = {};
      for (const row of settingsRows || []) settings[row.key] = row.value;
      return json({
        data: {
          users: users || [],
          events: events || [],
          reports: reports || [],
          threads: threads || [],
          posts: posts || [],
          sound_cards: soundCards || [],
          notifications: notifications || [],
          uploads: uploads || [],
          admin_blocks: blocks || [],
          settings,
          stats: stats || {},
        },
      });
    }

    if (action === "signed-upload") {
      const fileName = cleanText(payload.fileName, 160).replace(/[^\w.\-]+/g, "-");
      const contentType = cleanText(payload.contentType, 80);
      const size = Number(payload.size || 0);
      const folder = cleanText(payload.folder, 32) || "media";
      if (!allowedImageTypes.has(contentType) || size <= 0 || size > maxImageBytes) throw new Error("UPLOAD_REJECTED");
      const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      await admin.from("forum_uploads").insert({
        user_id: user.id,
        bucket: STORAGE_BUCKET,
        path,
        filename: fileName,
        mime_type: contentType,
        size_bytes: size,
        purpose: folder,
      });
      return json({ data: { ...data, path } });
    }

    if (action === "update-profile") {
      const social_links = sanitizeExternalLinks(payload.social_links);
      const patch = {
        display_name: cleanText(payload.display_name, 32),
        username: cleanText(payload.username, 28).toLowerCase() || null,
        bio: cleanText(payload.bio, 240),
        theme: cleanText(payload.theme, 24) || "dark",
        avatar_url: safeUrl(payload.avatar_url) || null,
        social_links,
        profile_extra: sanitizeProfileJson(payload.profile_extra),
        artist_profile: sanitizeProfileJson(payload.artist_profile),
        last_seen_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("profiles").update(patch).eq("id", user.id).select("*").single();
      if (error) throw error;
      return json({ data });
    }

    if (action === "create-thread") {
      ensureCanPublish(profile);
      const title = cleanText(payload.title, 120);
      const text = cleanText(payload.body, 6000);
      if (title.length < 4) throw new Error("TITLE_TOO_SHORT");
      if (text.length < 2) throw new Error("BODY_TOO_SHORT");
      const categoryId = cleanText(payload.category_id, 80);
      const { data: category, error: categoryError } = await admin
        .from("categories")
        .select("id,slug,is_locked")
        .eq("id", categoryId)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) throw new Error("CATEGORY_NOT_FOUND");
      if (category.is_locked && !["owner", "admin", "moderator"].includes(String(profile?.role || "user"))) {
        throw new Error("CATEGORY_LOCKED");
      }
      await ensureCanWriteInCategory(profile, category);
      const media = sanitizeMedia(payload.media_items);
      const tags = [...new Set([...(Array.isArray(payload.tags) ? payload.tags.map((x) => cleanText(x, 32)) : []), ...extractTags(`${title} ${text}`)])].slice(0, 12);
      const score = spamScore(`${title}\n${text}`, media);
      const row = {
        category_id: categoryId,
        author_id: user.id,
        title,
        body: text,
        excerpt: cleanText(payload.excerpt || text, 280),
        media_items: media,
        tags,
        cover_image_url: safeUrl(payload.cover_image_url) || null,
        post_type: cleanText(payload.post_type, 24) || "discussion",
        flair_id: cleanText(payload.flair_id, 80) || null,
        status: "published",
        moderation_status: score >= 8 ? "pending" : "approved",
        spam_score: score,
      };
      const { data, error } = await admin.from("threads").insert(row).select("*").single();
      if (error) throw error;
      await notifyMentions(user.id, text, { thread_id: data.id, title });
      if (score >= 8) await logAction(user.id, "spam_hold_thread", "thread", data.id, { score });
      return json({ data, moderation_status: row.moderation_status });
    }

    if (action === "create-reply") {
      ensureCanPublish(profile);
      const text = cleanText(payload.body, 4000);
      if (text.length < 1) throw new Error("BODY_TOO_SHORT");
      const media = sanitizeMedia(payload.media_items);
      const score = spamScore(text, media);
      const threadId = cleanText(payload.thread_id, 80);
      const { data: thread } = await admin.from("threads").select("id,author_id,is_locked,is_deleted").eq("id", threadId).maybeSingle();
      if (!thread || thread.is_locked || thread.is_deleted) throw new Error("THREAD_CLOSED");
      const { data, error } = await admin.from("posts").insert({
        thread_id: threadId,
        author_id: user.id,
        parent_post_id: cleanText(payload.parent_post_id, 80) || null,
        body: text,
        media_items: media,
        moderation_status: score >= 8 ? "pending" : "approved",
        spam_score: score,
      }).select("*").single();
      if (error) throw error;
      await admin.from("threads").update({ last_activity_at: new Date().toISOString() }).eq("id", threadId);
      if (thread.author_id !== user.id) await createNotification(thread.author_id, "reply", { thread_id: threadId, post_id: data.id });
      if (payload.parent_post_id) {
        const { data: parentPost } = await admin.from("posts").select("author_id").eq("id", cleanText(payload.parent_post_id, 80)).maybeSingle();
        if (parentPost?.author_id && parentPost.author_id !== user.id) await createNotification(parentPost.author_id, "comment_reply", { thread_id: threadId, post_id: data.id, parent_post_id: payload.parent_post_id });
      }
      await notifyMentions(user.id, text, { thread_id: threadId, post_id: data.id });
      return json({ data });
    }

    if (action === "create-comment") {
      ensureCanPublish(profile);
      const text = cleanText(payload.body, 4000);
      if (text.length < 1) throw new Error("BODY_TOO_SHORT");
      const media = sanitizeMedia(payload.media_items);
      const score = spamScore(text, media);
      const threadId = cleanText(payload.thread_id, 80);
      const parentPostId = cleanText(payload.parent_post_id, 80) || null;
      const { data: thread } = await admin.from("threads").select("id,author_id,is_locked,is_deleted").eq("id", threadId).maybeSingle();
      if (!thread || thread.is_locked || thread.is_deleted) throw new Error("THREAD_CLOSED");
      const { data, error } = await admin.from("posts").insert({
        thread_id: threadId,
        parent_post_id: parentPostId,
        author_id: user.id,
        body: text,
        media_items: media,
        moderation_status: score >= 8 ? "pending" : "approved",
        spam_score: score,
      }).select("*").single();
      if (error) throw error;
      await admin.from("threads").update({ last_activity_at: new Date().toISOString() }).eq("id", threadId);
      if (thread.author_id !== user.id) await createNotification(thread.author_id, "reply", { thread_id: threadId, post_id: data.id });
      if (parentPostId) {
        const { data: parentPost } = await admin.from("posts").select("author_id").eq("id", parentPostId).maybeSingle();
        if (parentPost?.author_id && parentPost.author_id !== user.id) await createNotification(parentPost.author_id, "comment_reply", { thread_id: threadId, post_id: data.id, parent_post_id: parentPostId });
      }
      await notifyMentions(user.id, text, { thread_id: threadId, post_id: data.id });
      return json({ data });
    }

    if (action === "vote-thread") {
      ensureCanPublish(profile);
      const threadId = cleanText(payload.thread_id, 80);
      const value = Number(payload.value);
      if (![-1, 1].includes(value)) throw new Error("INVALID_VOTE");
      const result = await toggleVote("forum_thread_votes", "thread_id", threadId, user.id, value);
      return json({ data: result });
    }

    if (action === "vote-post") {
      ensureCanPublish(profile);
      const postId = cleanText(payload.post_id, 80);
      const value = Number(payload.value);
      if (![-1, 1].includes(value)) throw new Error("INVALID_VOTE");
      const result = await toggleVote("forum_post_votes", "post_id", postId, user.id, value);
      return json({ data: result });
    }

    if (action === "toggle-save-thread") {
      ensureCanPublish(profile);
      const threadId = cleanText(payload.thread_id, 80);
      const { data: existing } = await admin.from("thread_bookmarks").select("thread_id").eq("thread_id", threadId).eq("user_id", user.id).maybeSingle();
      if (existing) {
        const { error } = await admin.from("thread_bookmarks").delete().eq("thread_id", threadId).eq("user_id", user.id);
        if (error) throw error;
        return json({ data: { saved: false } });
      }
      const { error } = await admin.from("thread_bookmarks").insert({ thread_id: threadId, user_id: user.id });
      if (error) throw error;
      return json({ data: { saved: true } });
    }

    if (action === "toggle-follow-thread") {
      ensureCanPublish(profile);
      const threadId = cleanText(payload.thread_id, 80);
      const { data: existing } = await admin.from("forum_followed_threads").select("thread_id").eq("thread_id", threadId).eq("user_id", user.id).maybeSingle();
      if (existing) {
        const { error } = await admin.from("forum_followed_threads").delete().eq("thread_id", threadId).eq("user_id", user.id);
        if (error) throw error;
        return json({ data: { following: false } });
      }
      const { error } = await admin.from("forum_followed_threads").insert({ thread_id: threadId, user_id: user.id });
      if (error) throw error;
      return json({ data: { following: true } });
    }

    if (action === "mark-thread-resolved") {
      const threadId = cleanText(payload.thread_id, 80);
      const { data: thread, error } = await admin.from("threads").select("id,author_id").eq("id", threadId).maybeSingle();
      if (error) throw error;
      if (!thread) throw new Error("THREAD_NOT_FOUND");
      if (thread.author_id !== user.id) requireRole(profile, ["admin", "moderator"]);
      const { data, error: updateError } = await admin.from("threads").update({ is_solved: true, status: "resolved", solved_by: user.id }).eq("id", threadId).select("*").single();
      if (updateError) throw updateError;
      await logAction(user.id, "mark_thread_resolved", "thread", threadId, {});
      return json({ data });
    }

    if (action === "toggle-thread-lock") {
      requireRole(profile, ["admin", "moderator"]);
      const threadId = cleanText(payload.thread_id, 80);
      const lockValue = Boolean(payload.is_locked);
      const { data, error } = await admin.from("threads").update({ is_locked: lockValue, status: lockValue ? "locked" : "published", locked_by: user.id }).eq("id", threadId).select("*").single();
      if (error) throw error;
      await logAction(user.id, lockValue ? "lock_thread" : "unlock_thread", "thread", threadId, {});
      return json({ data });
    }

    if (action === "mark-notifications-read") {
      const notificationIds = Array.isArray(payload.notification_ids) ? payload.notification_ids.map((item) => cleanText(item, 80)).filter(Boolean) : [];
      let query = admin.from("notifications").update({ is_read: true }).eq("user_id", user.id);
      if (notificationIds.length) query = query.in("id", notificationIds);
      const { error } = await query;
      if (error) throw error;
      return json({ data: { ok: true } });
    }

    if (action === "create-report") {
      const targetType = cleanText(payload.target_type, 40);
      const targetId = cleanText(payload.target_id, 80);
      const reason = cleanText(payload.reason, 600);
      if (!targetType || !targetId || !reason) throw new Error("REPORT_INVALID");
      const { data, error } = await admin.from("content_reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        status: "open",
      }).select("*").single();
      if (error) throw error;
      await logAction(user.id, "report_created", targetType, targetId, { reason });
      return json({ data });
    }

    if (action === "create-sound-card") {
      const trackUrl = safeUrl(payload.track_url);
      if (!trackUrl || !hostAllowed(trackUrl)) throw new Error("URL_NOT_ALLOWED");
      const tags = Array.isArray(payload.tags) ? payload.tags.map((x) => cleanText(x, 32)).filter(Boolean).slice(0, 12) : [];
      const card = {
        author_id: user.id,
        track_url: trackUrl,
        platform: cleanText(payload.platform, 40) || mediaKind(trackUrl),
        preview_url: safeUrl(payload.preview_url) || null,
        title: cleanText(payload.title, 120),
        artist: cleanText(payload.artist, 120),
        description: cleanText(payload.description, 1200),
        cover_url: safeUrl(payload.cover_url) || null,
        genres: Array.isArray(payload.genres) ? payload.genres.map((x) => cleanText(x, 60)).filter(Boolean).slice(0, 8) : [],
        main_genre: cleanText(payload.main_genre, 60),
        subgenres: Array.isArray(payload.subgenres) ? payload.subgenres.map((x) => cleanText(x, 60)).filter(Boolean).slice(0, 8) : [],
        collaborators: Array.isArray(payload.collaborators) ? payload.collaborators.map((x) => cleanText(x, 80)).filter(Boolean).slice(0, 8) : [],
        tags,
      };
      const { data, error } = await admin.from("sound_cards").insert(card).select("*").single();
      if (error) throw error;
      const { data: cat } = await admin.from("categories").select("id").in("slug", ["musica", "generale", "feedback-brani"]).limit(1).maybeSingle();
      if (cat) {
        await admin.from("threads").insert({
          category_id: cat.id,
          author_id: user.id,
          title: `Sound Card: ${card.title} - ${card.artist}`,
          body: card.description || `Nuova Sound Card condivisa: ${card.title} di ${card.artist}.`,
          media_items: [{ type: "sound_card", sound_card_id: data.id, url: card.track_url, title: card.title }],
          tags: [...tags, "soundcard"],
          moderation_status: "approved",
        });
      }
      return json({ data });
    }

    if (action === "record-sound-card-view") {
      const soundCardId = cleanText(payload.sound_card_id, 80);
      await admin.from("sound_card_views").upsert({ sound_card_id: soundCardId, user_id: user.id }, { onConflict: "sound_card_id,user_id" });
      try {
        await admin.rpc("recalculate_user_group", { user_id_input: user.id });
      } catch {
        // Older databases can deploy the Edge Function before the SQL migration.
      }
      return json({ data: { ok: true } });
    }

    if (action === "admin-action") {
      requireRole(profile, ["admin", "moderator"]);
      const op = cleanText(payload.op, 60);
      const targetId = cleanText(payload.id, 80) || null;
      let result: unknown = null;

      if (op === "update-thread") {
        const patch = compact({
          title: payload.title === undefined ? undefined : cleanText(payload.title, 120),
          body: payload.body === undefined ? undefined : cleanText(payload.body, 6000),
          category_id: payload.category_id === undefined ? undefined : cleanText(payload.category_id, 80),
          is_deleted: payload.is_deleted === undefined ? undefined : Boolean(payload.is_deleted),
          is_locked: payload.is_locked === undefined ? undefined : Boolean(payload.is_locked),
          is_pinned: payload.is_pinned === undefined ? undefined : Boolean(payload.is_pinned),
          is_featured: payload.is_featured === undefined ? undefined : Boolean(payload.is_featured),
          is_solved: payload.is_solved === undefined ? undefined : Boolean(payload.is_solved),
          status: payload.status === undefined ? undefined : cleanText(payload.status, 24),
          flair_id: payload.flair_id === undefined ? undefined : cleanText(payload.flair_id, 80) || null,
          post_type: payload.post_type === undefined ? undefined : cleanText(payload.post_type, 24),
          moderation_status: payload.moderation_status === undefined ? undefined : cleanText(payload.moderation_status, 24),
          tags: payload.tags === undefined ? undefined : cleanStringArray(payload.tags, 12, 32),
        });
        const { data, error } = await admin.from("threads").update(patch).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "update-post") {
        const patch = compact({
          body: payload.body === undefined ? undefined : cleanText(payload.body, 4000),
          is_deleted: payload.is_deleted === undefined ? undefined : Boolean(payload.is_deleted),
          moderation_status: payload.moderation_status === undefined ? undefined : cleanText(payload.moderation_status, 24),
        });
        const { data, error } = await admin.from("posts").update(patch).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "update-user") {
        requireRole(profile, ["admin"]);
        const patch = payload.patch && typeof payload.patch === "object" ? payload.patch as Record<string, unknown> : {};
        const allowedPatch = compact({
          role: patch.role === undefined ? undefined : cleanText(patch.role, 32),
          user_group: patch.user_group === undefined ? undefined : cleanText(patch.user_group, 48),
          is_artist: patch.is_artist === undefined ? undefined : Boolean(patch.is_artist),
          profile_extra: patch.profile_extra === undefined ? undefined : sanitizeProfileJson(patch.profile_extra),
          artist_profile: patch.artist_profile === undefined ? undefined : sanitizeProfileJson(patch.artist_profile),
        });
        const { data, error } = await admin.from("profiles").update(allowedPatch).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "category-upsert") {
        requireRole(profile, ["admin"]);
        const row = {
          id: targetId || undefined,
          name: cleanText(payload.name, 80),
          slug: cleanText(payload.slug, 80).toLowerCase(),
          icon: cleanText(payload.icon, 32) || "forum",
          description: cleanText(payload.description, 260),
          sort_order: Number(payload.sort_order || 50),
        };
        const { data, error } = await admin.from("categories").upsert(row).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "flair-upsert") {
        requireRole(profile, ["admin"]);
        const row = compact({
          id: targetId || undefined,
          category_id: cleanText(payload.category_id, 80) || null,
          slug: cleanText(payload.slug, 80).toLowerCase(),
          name: cleanText(payload.name, 80),
          description: cleanText(payload.description, 220),
          color: cleanText(payload.color, 20) || "#8b2cff",
          is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
          is_staff_only: payload.is_staff_only === undefined ? false : Boolean(payload.is_staff_only),
          sort_order: Number(payload.sort_order || 100),
        });
        const { data, error } = await admin.from("forum_flairs").upsert(row).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "flair-delete") {
        requireRole(profile, ["admin"]);
        const { error } = await admin.from("forum_flairs").delete().eq("id", targetId);
        if (error) throw error;
        result = { id: targetId };
      } else if (op === "category-delete") {
        requireRole(profile, ["admin"]);
        const { error } = await admin.from("categories").delete().eq("id", targetId);
        if (error) throw error;
        result = { id: targetId };
      } else if (op === "admin-block-upsert") {
        requireRole(profile, ["admin"]);
        const row = {
          id: targetId || undefined,
          title: cleanText(payload.title, 90) || "Blocco admin",
          location: cleanText(payload.location, 40),
          html: cleanText(payload.html, 12000),
          css: cleanText(payload.css, 12000),
          is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
          updated_by: user.id,
        };
        const { data, error } = await admin.from("admin_blocks").upsert(row).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "admin-block-delete") {
        requireRole(profile, ["admin"]);
        const { error } = await admin.from("admin_blocks").delete().eq("id", targetId);
        if (error) throw error;
        result = { id: targetId };
      } else if (op === "hide-sound-card") {
        const { data, error } = await admin.from("sound_cards").update({ is_hidden: true }).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "update-sound-card") {
        const patch = compact({
          title: payload.title === undefined ? undefined : cleanText(payload.title, 120),
          artist: payload.artist === undefined ? undefined : cleanText(payload.artist, 120),
          description: payload.description === undefined ? undefined : cleanText(payload.description, 1200),
          main_genre: payload.main_genre === undefined ? undefined : cleanText(payload.main_genre, 60),
          cover_url: payload.cover_url === undefined ? undefined : safeUrl(payload.cover_url) || null,
          map_x: payload.map_x === undefined ? undefined : Number(payload.map_x),
          map_y: payload.map_y === undefined ? undefined : Number(payload.map_y),
          is_hidden: payload.is_hidden === undefined ? undefined : Boolean(payload.is_hidden),
        });
        const { data, error } = await admin.from("sound_cards").update(patch).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "save-rules") {
        requireRole(profile, ["admin"]);
        const value = payload.value || {};
        result = await upsertSetting("rules", value);
      } else if (op === "save-setting") {
        requireRole(profile, ["admin"]);
        result = await upsertSetting(cleanText(payload.key, 80), payload.value || {});
      } else if (op === "resolve-report") {
        const status = cleanText(payload.status, 32) || "resolved";
        const { data, error } = await admin.from("content_reports").update({
          status,
          moderator_id: user.id,
          moderator_note: cleanText(payload.moderator_note, 1000),
          resolved_at: new Date().toISOString(),
        }).eq("id", targetId).select("*").single();
        if (error) throw error;
        result = data;
      } else if (op === "send-notification") {
        requireRole(profile, ["admin"]);
        const target = cleanText(payload.target, 32);
        const type = cleanText(payload.type, 40) || "announcement";
        const notificationPayload = {
          title: cleanText(payload.title, 120),
          body: cleanText(payload.body, 1000),
          actor_id: user.id,
        };
        if (target === "all") {
          const { data: allUsers } = await admin.from("profiles").select("id").limit(1000);
          const rows = (allUsers || []).map((row) => ({ user_id: row.id, type, payload: notificationPayload }));
          if (rows.length) {
            const { error } = await admin.from("notifications").insert(rows);
            if (error) throw error;
          }
          result = { count: rows.length };
        } else {
          const { data: staffUsers } = await admin.from("profiles").select("id").in("role", ["owner", "admin", "moderator"]).limit(200);
          const rows = (staffUsers || []).map((row) => ({ user_id: row.id, type, payload: notificationPayload }));
          if (rows.length) {
            const { error } = await admin.from("notifications").insert(rows);
            if (error) throw error;
          }
          result = { count: rows.length };
        }
      } else if (op === "recalculate-groups") {
        requireRole(profile, ["admin"]);
        await admin.rpc("recalculate_all_user_groups");
        result = { ok: true };
      } else if (op === "delete-upload") {
        requireRole(profile, ["admin"]);
        const { error } = await admin.from("forum_uploads").delete().eq("id", targetId);
        if (error) throw error;
        result = { id: targetId };
      } else {
        throw new Error("UNKNOWN_ADMIN_ACTION");
      }

      await logAction(user.id, op, String(payload.target_type || "forum"), targetId, payload);
      return json({ data: result });
    }

    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    const payload = errorPayload(error);
    const message = payload.message;
    const status = message === "AUTH_REQUIRED" ? 401 : ["FORBIDDEN", "USER_BANNED", "USER_MUTED", "CATEGORY_LOCKED", "CATEGORY_WRITE_FORBIDDEN"].includes(message) ? 403 : 400;
    return json({
      error: message,
      code: payload.code,
      details: payload.details,
      hint: payload.hint,
    }, status);
  }
});
