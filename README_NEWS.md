# ZEROUAN INC. — Blog / News Update

Contenuto pacchetto:

- `index.html` — homepage aggiornata con bacheca news sopra la sezione hero attuale.
- `admin-news.html` — pannello demo per creare news da form.
- `news-data.js` — archivio statico delle news pubblicate.
- `news.js` — renderer della bacheca: filtri, ricerca, YouTube embed, card, tag, link.
- `news.css` — stile della bacheca e del pannello admin.

## Installazione rapida

1. Copia questi file nella root del tuo sito, dove sono già `style.css` e `script.js`.
2. Sostituisci il tuo vecchio `index.html` con quello presente in questo pacchetto.
3. Apri `index.html#news` per vedere la bacheca.
4. Apri `admin-news.html` per generare una news.

Password demo admin:

```txt
ZEROUAN-ADMIN-2026
```

## Pubblicazione delle news

Questa è una versione statica. Il form admin può:

- generare il JSON della notizia;
- mostrarti l'anteprima;
- salvare una preview locale nel browser;
- farti copiare la news da incollare in `news-data.js`.

Per rendere la notizia visibile a tutti i visitatori devi incollare l'oggetto generato dentro l'array `window.ZEROUAN_NEWS_DATA` in `news-data.js`, poi ricaricare/deployare il sito.

## Nota severa sulla sicurezza

`admin-news.html` NON è una vera area privata se lasciata così su un sito statico. La password è scritta nel JavaScript e quindi è leggibile dal browser.

Per una versione reale usa una di queste soluzioni:

- Basic Auth lato hosting/server;
- Netlify/Vercel con protezione accesso;
- Decap CMS collegato a GitHub;
- Supabase/Firebase con login e database;
- backend Node/PHP con autenticazione.

La struttura che ho preparato è corretta come prototipo/blog-look. Per pubblicazione automatica vera serve un backend o un CMS.
