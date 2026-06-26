# INC. Forum V2 - Setup Supabase

Questa versione aggiorna la prima base del forum in un piccolo social network musicale.

File inclusi:

- `forum.html` = pagina principale di INC. Forum
- `forum.css` = stile dark/purple come preview approvata
- `forum.js` = frontend Supabase, Auth, Realtime, profili, media upload, composer social
- `supabase_schema.sql` = database completo, viste live, RLS, Storage bucket, categorie iniziali

## Funzioni aggiunte

### 1. Personalizzazione utente

Ogni utente può gestire:

- foto profilo/avatar
- nome pubblico
- username
- bio
- tema profilo
- link Instagram
- link YouTube
- link Spotify
- link SoundCloud
- link TikTok
- sito web personale

I dati vengono salvati nella tabella `profiles`.

### 2. Forum/social musicale

La creazione di una discussione ora funziona più come un post social:

- testo lungo
- foto caricate su Supabase Storage
- link esterni
- video YouTube/Vimeo embedded
- Spotify embedded
- SoundCloud embedded
- hashtag estratti automaticamente dal testo con formato `#tag`

Le immagini vengono salvate nel bucket pubblico Supabase:

```text
forum-media
```

I link/video vengono salvati come JSON nella colonna:

```text
media_items
```

### 3. Informazioni reali e live

I box laterali non usano più numeri finti.

Sono basati su viste SQL:

- `forum_stats`
- `active_users`
- `user_of_month`
- `popular_tags`
- `category_overview`
- `thread_overview`
- `post_overview`

L'utente del mese è calcolato dai dati reali del mese corrente:

```text
+5 punti per discussione
+2 punti per risposta
```

Gli utenti attivi sono quelli con:

```sql
last_seen_at > now() - interval '15 minutes'
```

### 4. Realtime

Il frontend ascolta modifiche realtime su:

- `threads`
- `posts`
- `profiles`

Quando qualcuno pubblica o risponde, la UI si aggiorna.

## Installazione

### 1. Supabase SQL

Apri:

```text
Supabase → SQL Editor → New Query
```

Incolla tutto il contenuto di:

```text
supabase_schema.sql
```

Poi premi:

```text
Run
```

Questo aggiorna/crea:

- profili social
- categorie
- discussioni
- risposte
- media JSON
- storage bucket `forum-media`
- viste live
- funzioni
- trigger punti
- Row Level Security
- Storage policies

## 2. Carica i file nella repo

Metti nella root del sito:

```text
forum.html
forum.css
forum.js
```

Poi fai commit/push.

Esempio:

```bash
git add forum.html forum.css forum.js
git commit -m "Add INC Forum V2"
git push
```

## 3. Controlla Auth

Per test veloce:

```text
Authentication → Providers → Email → Confirm email OFF
```

Per produzione reale, meglio riattivare la conferma email.

## 4. Primo admin

Registrati dal forum.

Poi vai in:

```text
Supabase → Table Editor → profiles
```

Trova il tuo utente e cambia:

```text
role = admin
```

## 5. Sicurezza

Nel file `forum.js` c'è solo la publishable/anon key.

Va bene nel frontend.

Non mettere mai online:

- password database
- connection string PostgreSQL completa
- service_role key
- JWT secret

Se una password reale è stata pubblicata, rigenerala.

## 6. Limiti tecnici realistici

Questa è una V2 frontend-only. Funziona bene per community piccola/media.

Limiti:

- non c'è ancora moderazione grafica completa
- non c'è ancora messaggistica privata
- non c'è ancora sistema notifiche push/email
- non c'è ancora crop avatar lato client
- non usare Supabase free come archivio video pesanti: per video usa YouTube/Vimeo

## 7. Step successivo consigliato

Versione 3:

- pannello admin/moderatore
- elimina/nascondi thread e post da UI
- blocca discussioni
- pin degli annunci
- profilo pubblico visitabile tipo `/profile.html?u=username`
- follow tra utenti
- notifiche interne
- feed globale stile social
- captcha/anti-spam
