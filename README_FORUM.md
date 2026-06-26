# Zerouan Forum - Setup Supabase

Questa cartella contiene una prima versione completa del forum in stile dark/purple:

- `forum.html` = pagina forum
- `forum.css` = stile grafico
- `forum.js` = logica frontend + Supabase Auth/Database/Realtime
- `supabase_schema.sql` = database, viste, funzioni e policy RLS

## 1. Crea il database su Supabase

Apri Supabase:

Project Dashboard → SQL Editor → New Query

Incolla tutto il contenuto di:

```text
supabase_schema.sql
```

Poi premi `Run`.

Questo crea:

- `profiles`
- `categories`
- `threads`
- `posts`
- viste `thread_overview` e `post_overview`
- funzione per incrementare le visite
- trigger per creare profilo utente automatico
- Row Level Security
- categorie iniziali

## 2. Controlla Authentication

Vai in:

Authentication → Providers → Email

Per test rapido puoi disattivare temporaneamente la conferma email:

- Confirm email: OFF

Per sito pubblico reale è meglio tenerla ON.

## 3. Carica i file nella repo

Metti nella root del tuo sito:

```text
forum.html
forum.css
forum.js
```

Poi pusha su GitHub.

## 4. Apri la pagina

Dopo il deploy apri:

```text
https://tuodominio.it/forum.html
```

oppure su GitHub Pages/Vercel/Netlify.

## 5. Primo account admin

Registrati dal forum.

Poi in Supabase vai in:

Table Editor → profiles

Trova il tuo utente e cambia:

```text
role = admin
```

Per ora il frontend non mostra ancora un pannello admin completo, ma il database è già predisposto per ruoli `user`, `moderator`, `admin`.

## 6. Sicurezza

Nel frontend c'è solo la publishable/anon key, che è normale.

Non mettere mai nel codice pubblico:

- password database
- service role key
- connection string PostgreSQL completa

Se una password reale è stata pubblicata per errore, rigenerala da Supabase.

## 7. Possibili prossimi step

Versione 2 consigliata:

- pannello admin grafico
- modifica/cancellazione post da UI
- profilo utente con avatar
- paginazione thread
- markdown nei messaggi
- anti-spam/captcha
- notifiche email
- pagina regolamento
- badge founder/admin/moderatore
