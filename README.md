# Fantasy Heroes Online

Przeglądarkowy RPG w stylu „Shakes & Fidget”: szybkie przygody, automatyczne pojedynki z animacjami, lochy z bossami,
Przebudzenia (poziomy 100–150), arena PvP, gildie, czat i boss światowy. Interfejs w języku polskim, działa na PC i telefonie.

**Świat gry tworzą wyłącznie prawdziwi gracze** – nie ma botów. Arena, rankingi, gildie, czat i wspólny boss światowy
wymagają serwera (darmowy projekt [Supabase](https://supabase.com)); bez niego gra działa solo (przygody, lochy, Próby, ekwipunek).

## Uruchomienie lokalne

Wymagany [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev        # serwer deweloperski (adres pojawi się w konsoli)
npm run build      # wersja produkcyjna do katalogu dist/
npm test           # testy logiki: tryb online, Przebudzenia, balans
```

## Serwer gry (tryb online)

Instrukcja krok po kroku: **[ONLINE.md](ONLINE.md)** – założenie projektu Supabase, wgranie `supabase/schema.sql`
i wpisanie adresu oraz klucza `anon public` do `src/net/config.js`.

## Publikacja na GitHub Pages

Repozytorium zawiera workflow `.github/workflows/pages.yml`, który po każdym pushu do `main` buduje grę i publikuje ją
na GitHub Pages. Jednorazowo włącz: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Gra będzie dostępna pod adresem `https://<twoja-nazwa>.github.io/<nazwa-repozytorium>/`.

## Struktura

| Katalog | Zawartość |
|---|---|
| `src/core` | logika gry: postać, walka, formuły, świat (ligi, boss tygodnia) |
| `src/data` | klasy, przedmioty, przeciwnicy, przygody, Przebudzenia |
| `src/ui` | interfejs: zakładki, walka, samouczek, przeciąganie przedmiotów |
| `src/render` | scena Three.js (shadery postaci, cząsteczki, efekty) |
| `src/net` | warstwa online (Supabase) i konfiguracja |
| `public/assets` | grafiki, animacje, dźwięki i muzyka gry |
| `supabase/schema.sql` | baza danych serwera (tabele, reguły bezpieczeństwa RLS) |
| `asset_src` | testy (`*_test.mjs`) i skrypty produkcji grafiki |

Dokument projektowy: [DESIGN.md](DESIGN.md).
