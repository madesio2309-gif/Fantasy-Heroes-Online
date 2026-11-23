# Fantasy Heroes Online – serwer gry (Supabase)

W grze **nie ma botów** – świat tworzą wyłącznie prawdziwi gracze. Serwer (darmowy projekt Supabase) łączy wszystkich
w jednym świecie. Bez serwera gra działa solo: przygody, lochy, Próby Przebudzenia, ekwipunek i boss światowy
(z pulą PŻ dopasowaną do jednej osoby).

| Funkcja | Co robi online |
|---|---|
| Rankingi | wszyscy gracze z serwera |
| Arena PvP | walki z „kopiami” postaci innych graczy (asynchroniczne PvP, jak w S&F) – druga osoba nie musi być w grze |
| Czat globalny | wiadomości na żywo (Supabase Realtime), limit 1 wiadomość / 2 s |
| Gildie | zakładanie i dołączanie (twardy limit 30 osób w bazie), czat gildii widoczny tylko dla członków |
| Boss gildii | wspólny pasek życia – sumują się obrażenia wszystkich członków (pula rośnie z ich siłą) |
| Boss światowy | wspólny pasek – pula PŻ = 40× suma siły graczy aktywnych w ostatnich 3 dniach |
| **Konta graczy** | rejestracja i logowanie (e-mail + hasło); bohater zapisywany w tabeli `saves` – ten sam na każdym urządzeniu |

**Bez serwera** gra też ma rejestrację i logowanie, ale konta i bohaterowie zapisują się tylko w danej przeglądarce
(hasło przechowywane jako skrót PBKDF2). Bohatera można przenieść: ⚙ Ustawienia → *Pobierz plik postaci* /
*Wczytaj plik postaci*.

## Krok po kroku (ok. 10 minut, bez programowania)

**1. Konto i projekt**
1. Wejdź na https://supabase.com → **Start your project** → zaloguj się (najprościej kontem GitHub).
2. **New project**: nazwa np. `fantasy-heroes`, wymyśl i zapisz hasło bazy (nie będzie potrzebne w grze),
   region **Central EU (Frankfurt)**, plan **Free** → **Create new project**. Poczekaj ok. 1–2 minuty.

**2. Konta graczy (e-mail + hasło)**
- Menu po lewej: **Authentication → Sign In / Providers** → **Email** musi być włączony (domyślnie jest).
- **Confirm email**: włączone = gracz po rejestracji dostaje link aktywacyjny (darmowy serwer pocztowy Supabase wysyła
  tylko kilka maili na godzinę). Na czas testów najprościej **wyłączyć** – konto działa od razu po rejestracji.
- **Authentication → URL Configuration → Site URL**: wpisz adres gry (link z Preview), żeby linki z maili prowadziły do gry.
- Opcjonalnie **Allow anonymous sign-ins** – tylko jeśli ktoś ma grać online bez konta (niewymagane).

**3. Baza danych gry**
1. Menu po lewej: **SQL Editor** → **New query**.
2. Otwórz plik `supabase/schema.sql` z repozytorium, zaznacz całość (Ctrl+A), skopiuj i wklej do edytora.
3. Kliknij **Run**. Powinno pojawić się „Success. No rows returned”.

**4. Dane do połączenia** (dwie wartości)
- **Project URL** – przycisk **Connect** u góry strony albo **Project Settings → Data API**; wygląda tak:
  `https://abcdefghijkl.supabase.co`.
- **Klucz publiczny** – **Project Settings → API Keys**: *Publishable key* (`sb_publishable_…`)
  albo w zakładce *Legacy API keys* klucz **anon public** (`eyJ…`). Oba działają.
- ⚠️ **Nie kopiuj** klucza *secret* / *service_role* – ten nigdy nie może trafić do gry ani na GitHuba.

**5. Podłączenie gry**
- **Najprościej:** prześlij obie wartości (Project URL + klucz publiczny) – zostaną wpisane do gry i gra zostanie
  opublikowana ponownie. GitHub nie jest do tego potrzebny.
- **Samodzielnie (dla wszystkich graczy):** wpisz obie wartości w `src/net/config.js`:
  ```js
  export const DEFAULT_ONLINE = {
    url: 'https://abcdefghijkl.supabase.co',
    anonKey: 'sb_publishable_…',
  };
  ```
  Zapisz, zrób commit i push – GitHub Pages sam przebuduje grę (patrz README).
- **Szybki test na jednym urządzeniu:** w grze ⚙ Ustawienia → „Tryb online” → wklej URL i klucz → **Połącz**.

Na górnym pasku pojawi się zielony wskaźnik **Online**. Testerom wystarczy otworzyć link do gry – logują się automatycznie.

## Bezpieczeństwo

- Klucz publiczny (*publishable* / *anon*) jest z założenia jawny i może być w repozytorium – dostęp chronią reguły RLS
  z `schema.sql` (każdy gracz może zmieniać wyłącznie własny profil, własne wiadomości i własne obrażenia).
- **Nigdy** nie wpisuj do gry klucza `secret` / `service_role`.
- Postęp postaci liczony jest w przeglądarce gracza, więc doświadczony gracz mógłby podmienić swoje statystyki.
  Baza ogranicza wartości (poziom 1–150, limity statystyk walki przy wczytywaniu rywala), ale pełna ochrona przed
  oszustwami wymaga przeniesienia walk na serwer (Supabase Edge Functions) – to naturalny etap przed premierą.
- Hasła kont online przechowuje Supabase Auth (gra nigdy nie widzi ich w bazie). Tabela `saves` jest prywatna – RLS
  pozwala czytać i zmieniać wyłącznie własnego bohatera.
- Z kontem online bohater jest na serwerze (zapis co ok. 15 s, przy zamknięciu karty i przy wylogowaniu). Przy
  logowaniu wygrywa nowsza kopia (serwer lub przeglądarka). Grając jednocześnie na dwóch urządzeniach, ostatni zapis
  nadpisuje wcześniejszy.

## Diagnostyka

- „Rejestracja e-mail jest wyłączona…” → włącz **Email** w kroku 2.
- „Najpierw potwierdź adres e-mail” → kliknij link z maila albo wyłącz **Confirm email** (krok 2).
- „Na serwerze brakuje tabeli zapisów” → uruchom aktualny `schema.sql` (krok 3) – dodaje tabelę `saves`.
- „permission denied for table …” / „nie ma nadanych uprawnień do tabel” → nowe projekty Supabase nie nadają
  uprawnień tabelom tworzonym w SQL; aktualny `schema.sql` zawiera potrzebne `grant` – uruchom go ponownie.
- „Logowanie anonimowe: … disabled” → gra online bez konta wymaga włączenia anonimowego logowania (krok 2, opcjonalne).
- „relation "players" does not exist” → nie uruchomiono `schema.sql` (krok 3).
- „violates check constraint players_lvl_check” (gracz powyżej 100 poziomu) → baza została utworzona starszą wersją
  `schema.sql`; uruchom aktualny plik ponownie (jest bezpieczny do powtórzenia i podnosi limit poziomu do 150).
- Brak wiadomości na żywo → sprawdź **Database → Publications → supabase_realtime**, czy zawiera tabelę `chat_messages`.
- Darmowy projekt Supabase usypia się po tygodniu bez ruchu – wtedy w panelu Supabase kliknij **Restore project**.
