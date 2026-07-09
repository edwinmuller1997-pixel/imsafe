# imsafe.se

Den självklara genomgången innan flygning.

## Arbetsflöde (efter engångs-setup)

1. Ändra i koden (allt ligger i `src/App.jsx`)
2. Spara → commit → push till GitHub
3. Vercel bygger och publicerar automatiskt på imsafe.se inom ~1 minut

Man kan även redigera `src/App.jsx` direkt på github.com i webbläsaren
(tryck på punkt-tangenten i repot för webbeditor) – varje sparad commit
publiceras automatiskt.

## Köra lokalt (frivilligt)

Kräver Node.js (nodejs.org):

    npm install     # en gång
    npm run dev     # startar på http://localhost:5173

## Struktur

- `index.html`   – sidskal, favicon, Tailwind
- `src/main.jsx` – startpunkt + lagringsshim (localStorage)
- `src/App.jsx`  – hela appen

## Framtid: riktiga konton

`window.storage` i `src/main.jsx` är byggd för att bytas mot ett API
(t.ex. Supabase) när riktig inloggning ska införas – appkoden behöver
då inte ändras.
