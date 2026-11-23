# Fantasy Heroes Online – dokument projektu / stan

Silnik: **Three.js + Vite** (2D). Multiplayer: **symulowany świat** (boty-gracze, deterministyczne dane dzienne, zapis w localStorage; warstwa `net/` przygotowana pod serwer).
Wymagania użytkownika są szczegółowe — są podstawą implementacji (bez rozszerzania zakresu). To nie jest odtworzenie gry – S&F to jedynie inspiracja stylu/humoru.

## Kluczowe założenia
- 2D, widok boczny „scena teatralna”: Three.js renderuje animowaną scenę bohatera (hub) i pojedynki (sprite'y na płaszczyznach, cząsteczki, shader trafienia/aury). UI w HTML/CSS nad canvasem.
- Jedna postać, zapis lokalny, czas rzeczywisty (przygody i idle działają offline – liczone z timestampów).
- Dzień gry = data lokalna; seed dzienny generuje przygody, wyzwania, sklep, bossa światowego.
- 5 statystyk: Siła, Zręczność, Inteligencja, Wytrzymałość, Szczęście. Statystyka główna klasy skaluje obrażenia.
- 100 poziomów, szybka krzywa EXP do 20 poziomu.
- 7 slotów, 5 rzadkości (Zwykły, Niezwykły, Rzadki, Epicki, Legendarny), 100+ szablonów przedmiotów z losowymi statystykami, ulepszanie +1..+10 za złoto.
- 30 przeciwników, 10 bossów (boss co 10 pięter lochu, lochy 100 pięter).
- Arena PvP z rankingiem (ELO‑podobne punkty), sezony tygodniowe z nagrodami i skórkami.
- Gildia do 30 osób (członkowie‑boty), czat globalny i gildyjny (boty piszą), boss gildyjny, boss światowy (wspólne HP z symulowanym wkładem graczy).
- Idle: złoto/EXP na minutę, limit 12 h, odbiór jednym kliknięciem.
- Ekonomia: złoto, kryształy (zdobywalne za darmo: dzienne, osiągnięcia, sezon) – kryształy tylko na kosmetykę/wygodę.

## UI design fingerprint
- Kompozycja startu: scena bohatera (Three.js, tło miasta) w centrum, prawy panel 26% (tytuł, postęp ładowania → przycisk „Graj”), dolny pas z zasadami. Wąski ekran: scena u góry, panel i zasady pod nią.
- Styl: sitodruk / plakat fantasy. Kontury 2–3 px ciemnym tuszem, twarde cienie offset 4 px (bez rozmycia), drobna rejestracja kolorów na tytule.
- Paleta: papier `#F2E4C6`, tusz `#1E1B24`, ciepły tusz (mineralna czerwień) `#B8412F`, chłodny tusz (głęboki indygo) `#2B3A78`. Rzadkości jako kolory semantyczne + nazwa: szary, zielony, niebieski, fioletowy, pomarańczowo‑złoty.
- Typografia: Cinzel (tytuły, latin‑ext), Rubik (UI, latin‑ext, polskie znaki). Rozmiary: tytuł 44–60 px, przycisk 20–22 px, tekst 15–17 px. Siatka 4 px.
- Przyciski: wciśnięcie przesuwa etykietę do cienia (100 ms), hover unosi o 1 px, disabled bez cienia.
- Gra: górny pasek zasobów (poziom, EXP, złoto, kryształy, energia), centralna scena, dolny pasek 5 zakładek (Przygody, Postać, Lochy, Arena, Gildia) + szybkie przyciski (Idle, Dzienne, Sklep, Czat, Rankingi).
- Wejście do gry: panel zjeżdża w prawo, pas zasad opada, przyciemnienie sceny znika (250 ms).

## Kierunek grafiki
Ręcznie malowana, stylizowana grafika fantasy (nowoczesny mobilny RPG), wyraźne kontury, nasycone kolory, cel‑shading, lekko humorystyczne proporcje, wysoka szczegółowość. Brak low‑poly (gra 2D).

## Zasoby (inwentarz)
| Zasób | Użycie | Źródło | Ścieżka | Status |
|---|---|---|---|---|
| 10 bohaterów (5 klas × 2 wyglądy), PNG z alfą | hub, walka, kreator | ai-model-calling | public/assets/heroes/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| 30 przeciwników (2 arkusze 4×4) | przygody, lochy | ai-model-calling + cięcie | public/assets/enemies/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| 10 bossów | lochy, boss światowy/gildyjny | ai-model-calling | public/assets/bosses/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| 48 ikon przedmiotów (3 arkusze 4×4) | ekwipunek, 100+ szablonów | ai-model-calling + cięcie | public/assets/items/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| 8 teł 16:9 | hub, przygody, lochy, arena, gildia | ai-model-calling | public/assets/bg/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| Muzyka: hub, walka | tło | ai-model-calling audio | public/assets/audio/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| SFX: trafienie, kryt, magia, monety, level up, klik, zwycięstwo | feedback | ai-model-calling audio | public/assets/audio/ | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| Czcionki Cinzel, Rubik | UI | @fontsource (npm, lokalnie w buildzie) | node_modules → dist | gotowe (pobrane lokalnie, sprawdzone na arkuszach kontrolnych asset_src/contact) |
| Efekty walki (cząsteczki, cięcia, aura, shader trafienia) | walka/hub | proceduralnie (Three.js shadery) | src/ | gotowe |
| 10 animacji ataku (5 klas × 2 wyglądy, 6 klatek, ścieżka „sheet”) | walka – zamach, klatka szczytowa przy trafieniu, powrót | sprite-generator (edycja obrazu bazowego gpt-image-2) + run_pipeline process-sheet (QC: pass ×10) + globalne usunięcie wysp tła | public/assets/anims/atk_*.webp + anims.json | gotowe (kontrola wizualna arkuszy: asset_src/anim/final_check.png) |

## Aktualizacja 2 – animacje, samouczek, online
- Walka: bohaterowie (gracz i rywale areny) używają arkuszy klatek; shader postaci próbkuje bieżącą klatkę (`uFrame/uFrames`), poświata ograniczona do klatki. Trafienia/uniki – istniejące efekty proceduralne (błysk, odrzut, cząsteczki).
- Samouczek (9 kroków, `src/ui/tutorial.js`): podświetlenie celu + dymek, przejście po wykonaniu akcji; pierwsza przygoda: darmowe przyspieszenie, pewna wygrana, 2 lepsze przedmioty, awans na 2 poziom; nagroda końcowa 50 kryształów + rzadki przedmiot; „Pomiń samouczek”.
- Tryb online (Supabase, `src/net/online.js`, `supabase/schema.sql`, instrukcja `ONLINE.md`): logowanie anonimowe, profile/rankingi, asynchroniczne PvP na snapshotach postaci, czat Realtime (globalny + gildyjny z RLS), gildie z limitem 30 w bazie, sumowane obrażenia bossów. Brak konfiguracji/błąd → tryb symulowany.

## Aktualizacja 3 – zakładka Postać › Ekwipunek
- Asset Preparation: bez nowych zasobów – ponownie użyte portrety `heroes/*.webp` i ikony `icons/*.webp` (sprawdzone na `asset_src/contact/icons_check.png`); puste sloty pokazują wyszarzone sylwetki z tego samego zestawu.
- Przyczyna wychodzenia ikon: `height:100%` obrazka w siatce nie rozwiązywał się do wysokości slotu → wysokie ikony (rękawice, amulety) renderowały się w naturalnym rozmiarze. Teraz ikona jest pozycjonowana absolutnie (76% wnętrza, `object-fit: contain`), slot ma `overflow:hidden`.
- Układ „lalki postaci”: 4 sloty po lewej, 3 po prawej, portret z poziomem i siłą; kafelki statystyk 3×2; plecak.
- Przeciąganie (`src/ui/dragdrop.js`, Pointer Events): plecak → slot (załóż), slot → plecak (zdejmij), plecak → pasek „Upuść, aby sprzedać” (nad nawigacją; epickie/legendarne z potwierdzeniem). Mysz: po 6 px; dotyk: przytrzymanie 220 ms (zwykłe przesunięcie przewija). Podświetlanie pasujących slotów, auto‑przewijanie panelu zależne od czasu, animacja „stempla” po założeniu, komunikat ze zmianą siły.

## Aktualizacja 4 – Przebudzenia (poziomy 100–150)
- Asset Preparation: bez nowych zasobów – bossowie Prób to istniejące `bosses/*.webp` (Sfinks, Lisz, Ymir, Azgor, Ignar, Serce Pustki) na ich tłach `bg/*.jpg`; wariant „przebudzony” daje shader postaci (pulsująca poświata w kolorze Próby, lekki tint/nasycenie). Skórka „Przebudzony” i poświata bohatera po Przebudzeniu – ten sam shader.
- Progi 100/110/120/130/140/150: na progu zdobywanie poziomów staje (EXP tylko do pełnego paska, nadmiar przepada; pasek EXP w paski + „Wymagane Przebudzenie!”). Pokonanie bossa Próby: umiejętność klasy (6 × 5 klas, `src/data/awakening.js`), +7% siły, limit poziomu +10, kryształy, legendarny przedmiot; VI – skórka „Przebudzony”. Zgromadzone EXP od razu przechodzi na kolejny poziom.
- Próba: wspólna pula PŻ bossa (nie odnawia się), 3 ataki dziennie (reset o północy), walka maks. 15 tur na stronę, 4 fazy (od 75/50/25% PŻ boss bije +15/30/45%). Pula = 3 ataki × docelowe dni [3,3,4,4,5,5] × obrażenia wzorca (średnia harmoniczna po fazach, 4 deterministyczne wzorce klasy: pełne talenty, epicki ekwipunek +8, poprzednie Przebudzenia). Bariera Próby: maks. 2,5× obrażeń wzorca zaliczane na atak. Słabszych bohaterów (mniej PŻ niż wzorzec) boss uderza lżej (√ stosunku PŻ, min. 60%).
- Wynik kalibracji (`asset_src/awakening_test.mjs`, 5 klas × 6 Prób): epicki +8 – 3–7 dni, legendarny +10 – 2–5 dni, niezwykły/rzadki – 6–15 dni; boss nigdy nie ginie w pojedynczej walce.
- UI: Postać › Przebudzenie (oś 6 progów, karta bossa z pulą PŻ, fazą, atakami, odnową, Barierą i szacunkiem dni, ostatnie ataki, nagroda), sekcja w Umiejętnościach, plakietka „!” i „⚔” na podzakładce, ✦N przy klasie na górnym pasku, w walce fioletowy pasek puli PŻ Próby, ekran „Przebudzenie I!”.
- Online: poziom do 150, liczba Przebudzeń w snapshocie (ograniczona poziomem), efekty nakładane przez odbiorcę; `schema.sql` zawiera zmianę ograniczenia poziomu.

## Aktualizacja 5 – świat bez botów (testy z prawdziwymi graczami)
- Asset Preparation: brak zmian w zasobach – zmiana wyłącznie logiki i komunikatów UI (sprawdzone: żadne grafiki/dźwięki nie były powiązane wyłącznie z botami).
- Usunięto symulowany świat (`world.js`: 240 botów, gildie botów, czat botów, sztuczne obrażenia „społeczności” bossa). Zostały ligi i harmonogram bossa tygodnia.
- Online: arena (do 3 rywali o podobnej sile; przy małej liczbie graczy – wszyscy dostępni), rankingi, gildie, czat – tylko prawdziwi gracze. Offline: arena/gildie/czat pokazują komunikat z przyciskiem Ustawień; misja „areny” pojawia się tylko, gdy skonfigurowano serwer.
- Boss światowy: pula PŻ = 40× suma siły Ty + gracze aktywni w ostatnich 3 dniach (typowy atak 1,3–4× siły → aktywna społeczność pokonuje go ok. 5.–6. dnia; offline – solo). Boss gildii: 34× suma siły członków, bez wkładu botów.
- Migracja zapisów: gildie botów/offline, wiadomości botów i rywale‑boty są usuwane przy wczytaniu.
- Repozytorium: `README.md`, `.gitignore` (bez `node_modules`, `dist`, roboczych grafik), workflow GitHub Pages, `npm test`.

## Aktualizacja 6 – konta graczy (rejestracja i logowanie)
- Asset Preparation: bez nowych zasobów – scena startowa (`bg/hub.jpg` + 3 bohaterów z `heroes/`) i ikona klucza `icons/ui_08.webp` (plakietka konta) sprawdzone i wystarczające.
- `src/core/accounts.js`: **konto online** (Supabase Auth e-mail + hasło, bohater w tabeli `public.saves` z RLS, synchronizacja co 15 s / przy ukryciu karty / przy wylogowaniu, nowsza kopia wygrywa przy logowaniu) lub **konto lokalne** (gdy brak serwera; hasło PBKDF2-SHA-256 120k + sól, osobny slot zapisu `fho_save_v1:l:<login>`). Starszy zapis bez konta można przypisać do konta przy rejestracji/logowaniu.
- Ustawienia → Konto gracza: status zapisu, Zapisz teraz (online), Zmień hasło, Pobierz/Wczytaj plik postaci (JSON), Wyloguj, Usuń konto (lokalne). „Nowa postać” usuwa bohatera także z serwera.
- `online.js`: jeden klient Supabase dla kont i świata online (wspólna sesja – profil gracza = id konta).
- UI fingerprint (kontynuacja stylu sitodruku): formularz w prawej kolumnie startu zamiast przycisku Start – papierowa karta z grubym konturem i twardym cieniem (6 px tusz + 2 px czerwony „przesunięty druk”), zakładki Logowanie/Rejestracja jako pas czerwonego tuszu z tytułową czcionką Cinzel, przycisk główny czerwony; tagline i pasek ładowania chowają się po otwarciu formularza, scena pozostaje widoczna. Telefon: formularz zajmuje kolumnę od dołu, tytuł i pas zasad ukryte. Po zalogowaniu: plakietka konta (klucz + login), Graj/Stwórz bohatera, Nowa postać, Wyloguj.
- Test: `asset_src/accounts_test.mjs` (39 asercji: konta lokalne + online na atrapie Supabase).

## Aktualizacja 7 – podłączony serwer Supabase
- Asset Preparation: bez zależności od zasobów (zmiana konfiguracji/backendu).
- Projekt Supabase `howpkgcffxezqgridpob` (eu-west-1) wpisany w `src/net/config.js` (URL + klucz *publishable*; klucze secret/service_role nigdy nie trafiają do gry).
- Serwer: aktualny `schema.sql` uruchomiony (tabele, RLS, limit poziomu 150, Realtime czatu) + nowy blok `grant` (nowe projekty nie nadają uprawnień tabelom z SQL – bez tego „permission denied for table saves”). Auth: e-mail włączony, potwierdzanie e-maila wyłączone na czas testów, Site URL = adres gry w Seeles.
- Konto lokalne przy skonfigurowanym serwerze gra offline (bez prób anonimowego logowania).
- Walidacja na prawdziwym serwerze (`.preview/run-007`): rejestracja → bohater → status online „on” → wiersze w `saves` i `players` → wylogowanie + czysta przeglądarka → logowanie przywraca bohatera z serwera; arena online bez botów. Konto testowe usunięte z bazy.

## Kryteria ukończenia
- Kreator postaci (5 klas, wygląd, kolor stroju, aura), hub z animowaną postacią.
- Walka auto 1v1 10–20 s z animacją, kryty, uniki, umiejętności, przycisk „Pomiń”, porównanie siły.
- Przygody: 3 losowe, 1–10 min, nagrody, wydarzenia, działa offline.
- Rozwój: poziomy, 5 statystyk, umiejętności, talenty, zmiana wyglądu.
- Ekwipunek 7 slotów, 5 rzadkości, porównanie, ulepszanie, sklep.
- Lochy z bossami co 10 pięter, wyzwania dzienne, boss światowy.
- Arena + ranking + sezon, gildia + czat + boss gildyjny, rankingi.
- Idle 12 h, dzienne nagrody/misje, wydarzenie tygodniowe, skórki.
- Responsywne (telefon/PC), publikacja.
