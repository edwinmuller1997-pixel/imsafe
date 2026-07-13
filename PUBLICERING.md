# 🛫 PUBLICERA IMSAFE.SE — KOMPLETT GUIDE FÖR NYBÖRJARE

Den här guiden tar dig från noll till live på imsafe.se.
Du behöver INTE kunna programmering eller terminalkommandon.
Allt görs i webbläsaren. Räkna med 30–45 minuter första gången.

Så här hänger delarna ihop:

    Din kod (GitHub) → Byggs & publiceras (Vercel) → Din domän (one.com)

- **GitHub** = där koden bor (som en Dropbox för kod, med historik)
- **Vercel** = tjänsten som förvandlar koden till en webbplats (gratis)
- **one.com** = där du äger domännamnet imsafe.se

---

## DEL 1 · LÄGG KODEN PÅ GITHUB (ca 10 min)

1. Gå till **github.com** → klicka **Sign up**
   - Välj användarnamn, e-post, lösenord. Gratiskontot räcker.

2. När du är inloggad: klicka på **+** uppe till höger → **New repository**
   - Repository name: `imsafe`
   - Välj **Public** (krävs för gratis Vercel) — koden syns, men ingen
     användardata ligger i den, så det är ofarligt
   - Klicka **Create repository**

3. Ladda upp filerna:
   - Packa först upp `imsafe-site.zip` på din dator så att du har
     mappen `imsafe-site` med filerna i
   - På den tomma repo-sidan: klicka länken **"uploading an existing file"**
   - Dra in ALLT som ligger INUTI mappen `imsafe-site`
     (alltså: `index.html`, `package.json`, `package-lock.json`,
     `vite.config.js`, `README.md`, `.gitignore` samt mappen `src`)
   - ⚠️ VIKTIGT: dra innehållet, inte själva mappen `imsafe-site` —
     `package.json` ska ligga överst i repot, inte i en undermapp
   - Om webbläsaren inte låter dig dra in `src`-mappen: klicka
     **choose your files** och markera allt i stället
   - Skriv t.ex. "Första versionen" i rutan → klicka **Commit changes**

✅ Klart när du ser filerna listade i repot, med `src` som en mapp.

---

## DEL 2 · KOPPLA VERCEL (ca 10 min)

1. Gå till **vercel.com** → **Sign Up** → välj **Continue with GitHub**
   - Logga in med GitHub-kontot du nyss skapade och godkänn kopplingen
   - Välj "Hobby" (gratis) om du får frågan

2. Klicka **Add New…** → **Project**
   - Du ser en lista över dina GitHub-repon → klicka **Import**
     bredvid `imsafe`

3. Inställningssidan:
   - Framework Preset ska stå **Vite** (Vercel hittar det själv)
   - Ändra INGENTING annat → klicka **Deploy**

4. Vänta ~1 minut. Konfetti = klart! 🎉
   - Klicka på förhandsbilden → din app är live på en adress i stil med
     `imsafe-xyz.vercel.app`
   - Testa den på mobilen redan nu!

✅ Klart när appen fungerar på vercel.app-adressen.

---

## DEL 3 · KOPPLA DOMÄNEN IMSAFE.SE (ca 10 min + väntetid)

1. I Vercel: öppna projektet → **Settings** → **Domains**
   - Skriv `imsafe.se` → **Add**
   - Vercel visar nu exakt vilka DNS-poster som behövs.
     Typiskt (men LITA PÅ DET VERCEL VISAR om det skiljer sig):

     | Typ    | Namn/Host | Värde                  |
     |--------|-----------|------------------------|
     | A      | @         | 76.76.21.21            |
     | CNAME  | www       | cname.vercel-dns.com   |

2. Lägg också till `www.imsafe.se` som domän i Vercel (den föreslår
   det själv) och välj att www omdirigerar till imsafe.se.

3. Öppna en ny flik: logga in på **one.com** → välj domänen imsafe.se
   → leta upp **DNS** / **DNS-inställningar** / "Avancerade DNS-inställningar"
   - Finns det redan en A-post för `@` (pekar mot one.com:s webbhotell)?
     **Ändra** den till Vercels IP i stället
   - Lägg till/ändra CNAME för `www` till `cname.vercel-dns.com`
   - Rör inte MX-poster (de styr e-post)

4. Vänta. DNS-ändringar tar 10 minuter–några timmar.
   Vercel-fliken Domains visar en grön bock när allt är kopplat,
   och HTTPS (hänglåset) fixas automatiskt.

✅ Klart när https://imsafe.se visar appen med hänglås i adressfältet.

---

## DEL 4 · SÅ UPPDATERAR DU APPEN (2 min per gång)

Det här är magin med upplägget — inga uppladdningar, ingen FTP:

1. Gå till ditt repo på github.com → öppna `src` → klicka `App.jsx`
2. Klicka **pennikonen** (Edit) uppe till höger
3. Gör din ändring — eller markera allt (Ctrl/Cmd+A), radera och
   klistra in en helt ny version av filen
4. Klicka **Commit changes** → skriv kort vad du ändrat → bekräfta
5. Vercel märker ändringen automatiskt och publicerar på ~1 minut.
   Följ med under fliken **Deployments** i Vercel om du är nyfiken.

**Ångra en ändring:** Vercel → Deployments → hitta en tidigare version
→ ⋯-menyn → **Instant Rollback**. Livräddare!

---

## FELSÖKNING

**"404: NOT_FOUND" efter deploy**
→ Filerna ligger troligen i en undermapp i repot. `package.json`
måste ligga överst. Flytta filerna eller gör om Del 1 steg 3.

**Bygget misslyckas (röd text i Vercel)**
→ Klicka på deployen → läs loggen längst ner. Oftast en halvklistrad
`App.jsx`. Klistra in filen på nytt i sin helhet.

**imsafe.se visar one.com:s standardsida**
→ DNS har inte slagit igenom än (vänta), eller så pekar A-posten
fortfarande på one.com. Dubbelkolla Del 3 steg 3.

**Appen ser trasig ut i mobilen men inte på datorn**
→ Hårduppdatera mobilen: öppna sidan i privat flik, eller vänta —
gamla versioner kan ligga cachade en stund.

**Sparad data försvann**
→ Data sparas per webbläsare/enhet (localStorage). Rensar man
webbhistorik försvinner den. Riktiga konton (senare steg) löser detta.

---

## CHECKLISTA (som en riktig pilot ✈️)

- [ ] GitHub-konto skapat
- [ ] Repo `imsafe` skapat och filerna uppladdade (package.json överst)
- [ ] Vercel kopplat till GitHub, projektet importerat och deployat
- [ ] Appen testad på vercel.app-adressen
- [ ] imsafe.se tillagd som domän i Vercel
- [ ] DNS-poster ändrade hos one.com
- [ ] Grön bock i Vercel → Domains
- [ ] https://imsafe.se testad i mobilen
- [ ] Testat att göra en liten ändring via github.com och sett den gå live

Lycka till — och kom ihåg appens egen regel: läs checklistan uppifrån
och ner, en punkt i taget. 🧀
