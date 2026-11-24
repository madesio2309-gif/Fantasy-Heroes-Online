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

## Aktualizacja 8 – zgłoszenia z beta testów (wersja 1.8.0)
Decyzje użytkownika: pety = **tylko bonusy pasywne** (widoczne przy bohaterze), mini gra weekendowa = **Koło fortuny**, po 150 poziomie = **zwykłe poziomy bez limitu**, finalizacja online = pełne konto, ochrona przed oszustwami, regulamin i RODO, moderacja czatu, ogłoszenia + wersja, **panel administratora** dla konta `madesio2309@gmail.com` z 3 eventami uruchamianymi ręcznie. Istniejące konta i postacie zostają (migracje tylko addytywne).

### Asset Preparation (inwentarz)
| Zasób | Użycie | Źródło | Ścieżka | Kontrola |
|---|---|---|---|---|
| 8 petów (Szlamek, Ognik, Sówka, Golemik, Kot Cienia, Smoczek, Pisklę Feniksa, Kryształowy Jednorożec), PNG z alfą | zakładka Pety, scena huba, lalka postaci, profil gracza | ai-model-calling (seedream5lite, remove_background) | public/assets/pets/*.webp (≤512 px) | arkusz `asset_src/gen8/check_sheet.jpg` – czyste krawędzie, styl zgodny z bohaterami |
| Ikony: skrzynia mityczna, jajo peta, żeton fortuny | sklep, nagrody, koło | jw. | public/assets/icons/ui_16–18.webp | jw. |
| Tło zbrojowni (16:9) | tło lalki w zakładce Postać | ai-model-calling | public/assets/bg/armory.jpg | podgląd – pusta podłoga w centrum pod postać |
| Tło Otchłani (≈21:9) | walki w Nieskończonym Lochu, karta Otchłani | ai-model-calling | public/assets/bg/abyss.jpg | podgląd – platforma na pierwszym planie |
| 10 efektów: hit, crit, magic, miss, coin, levelup, lose, click (zamiana) + tick, chest (nowe) | walka, UI, koło, skrzynie | ai-model-calling audio (AudioGen) + `asset_src/gen8/sfx/process_sfx.py` (przycięcie ciszy, wygaszenie ≥60 ms, normalizacja) | public/assets/audio/sfx_*.mp3 | obwiednia: koniec ≤ −33 dB (wcześniej crit/magic/miss 0 dB), fale `asset_src/gen8/sfx/wave/all.png` |
| Koło fortuny, ramki rzadkości mitycznej, podgląd skórek | UI | proceduralnie (SVG/canvas/CSS – ten sam shader co scena przeliczany na canvasie) | src/ | — |

### Dźwięk – przyczyna „urywania”
1. Pliki SFX były wadliwe w źródle: generator zwrócił sztywne klipy 1–2 s ucięte w trakcie dźwięku (`crit`: drugi wybuch ucięty na końcu, `magic`/`miss` kończyły się przy 0 dB, `hit`/`click` to szum ok. −40 dB). Zastąpione nowymi, obrobionymi efektami.
2. Odtwarzanie przez klonowanie `<audio>` przy każdym trafieniu (nowy element = ponowne dekodowanie, limity odtwarzaczy, na iOS przerywanie muzyki). Nowy silnik: Web Audio API – zdekodowane bufory, tor głośności *ogólna → muzyka / efekty*, limit głosów na dźwięk, płynne przejścia muzyki (crossfade 0,4–0,6 s zamiast `pause()`).
3. Paski głośności: ogólna, muzyka, efekty (+ wyciszanie) – w ⚙ Ustawieniach i w szybkim panelu 🔊 na górnym pasku; zapis per urządzenie (`fho_audio_v1`).

### Rozgrywka
- **Poziomy bez limitu**: po 6. Przebudzeniu limit znika (151, 152…); EXP, przedmioty i przeciwnicy skalują się dalej. Serwer: `lvl` 1–100000.
- **Nieskończony Loch „Otchłań”** (Lochy › Otchłań): 2000 pięter, od 100 poziomu, 15 kluczy Otchłani dziennie (1 walka = 1 klucz). Piętro f: poziom wroga 100 + ⌊0,45·f⌋, co 10. piętro boss. Nagrody: złoto/EXP co piętro; co 10: 5 💎 + epicki łup; co 50: jajo peta; co 100: legendarny łup + 50 💎 (od 500: 35% szans na mityczny); co 250 od 1000: gwarantowany mityczny; 500: skórka „Wędrowiec Otchłani”, 2000: tytuł i skórka „Władca Otchłani”. Ranking „Otchłań”.
- **Rzadkość mityczna** (6.): mnożnik 3,1, 5 dodatkowych statystyk, 11 unikatowych przedmiotów z podwójnym efektem. **Skrzynia Mityczna** w sklepie: 2000 💎 → 90% legendarny, 10% mityczny.
- **Pety** (Postać › Pety): 8 petów (rzadkości niezwykły→mityczny), jeden aktywny, bonus pasywny × (1 + 0,2·(poziom−1)), poziom 1–10 za duplikaty (duplikat na 10 poz. → 25 💎). Jaja: sklep 250 💎, Otchłań co 50 pięter, koło fortuny, prezent powitalny (1 jajo). Pet stoi obok bohatera w hubie, w lalce postaci i w profilu gracza.
- **Koło fortuny** (sobota–niedziela lub event admina „Szczęśliwe Koło”): żetony za aktywność (przygoda, loch/Otchłań, arena, bossowie, misje) + 3 darmowe dziennie; 10 pól nagród (złoto, kryształy, energia, klucze, epicki/legendarny łup, jajo peta, jackpot 250 💎, Skrzynia Mityczna). Żetony wygasają po weekendzie.

### Ekwipunek i wygląd
- Porównanie po najechaniu (mysz): dymek z przedmiotem i obecnie założonym (+ zmiana siły); dotyk – bez zmian (dotknięcie otwiera okno porównania).
- Podgląd ekwipunku innych graczy: okno „Profil gracza” (lalka z ekwipunkiem, statystyki, pet, skórka, gildia) z areny, rankingów, gildii, czatu i bossa; dane: nowa kolumna `players.equip` (zwięzły zapis 7 slotów, oczyszczany przy odczycie).
- Podgląd skórek: miniatura bohatera w każdej skórce (canvas, ten sam algorytm co shader: odcień stroju, nasycenie, tint, poświata) + „Przymierz” – podgląd na scenie przez 8 s.
- Tło zakładki Postać: obraz zbrojowni w lalce postaci (wcześniej ciemny gradient).

### Finalizacja online
- Konto: reset hasła e-mailem (obsługa linku odzyskiwania → „Ustaw nowe hasło”), potwierdzanie e-maila (obsługiwane w grze), zmiana e-maila, usunięcie konta (RPC `delete_my_account`, potwierdzenie hasłem). **Uwaga:** wbudowana poczta Supabase wysyła tylko do członków zespołu projektu (2/h) – wymaganie potwierdzenia pozostaje wyłączone na serwerze do czasu podpięcia własnego SMTP.
- Ochrona: tabela `player_guard` (niedostępna dla graczy) + wyzwalacze: limity przyrostu poziomu, kryształów i pięter Otchłani w czasie („wiadro” odnawiające się), odrzucenie nierealnych zapisów; profil areny nie może przekroczyć zweryfikowanego poziomu, siła ograniczona względem poziomu; liczniki naruszeń widoczne w panelu admina.
- Regulamin i Polityka prywatności (`src/data/legal.js`, wersja dokumentów), wymagana zgoda przy rejestracji (zapis wersji i daty w metadanych konta).
- Moderacja czatu: filtr wulgaryzmów (klient + serwer), zgłaszanie wiadomości, wyciszanie graczy (lokalnie), blokady czatu nadawane przez admina (`chat_bans`).
- Ogłoszenia (`announcements`) na ekranie startowym i w grze, numer wersji, okno „Co nowego” po aktualizacji (`src/version.js`).
- **Panel administratora** (przycisk 🛡 tylko dla `madesio2309@gmail.com`; uprawnienia wymuszane przez serwer funkcją `is_admin()` i tabelą `admins`): eventy, ogłoszenia, zgłoszenia czatu (usuń / zablokuj), gracze (szukaj, profil, blokada czatu, flagi ochrony), statystyki. Eventy (`live_events`): **Festiwal Doświadczenia** (2× EXP), **Złoty Deszcz** (2× złoto, 2× szansa na lepsze łupy), **Szczęśliwe Koło** (koło fortuny poza weekendem, 2× żetony, 5 darmowych dziennie); czas trwania 1–48 h, możliwość zatrzymania.
- UI fingerprint: kontynuacja stylu sitodruku – nowe okna (profil, koło, panel admina, dokumenty) jako papierowe karty z konturem i twardym cieniem; koło fortuny w paletach tuszu (czerwień/indygo/papier/złoto) z czerwonym wskaźnikiem; rzadkość mityczna = karmin `#FF3D6E` z pulsującą cyjanową obwódką; plakietka eventu na górnym pasku jako pas złotego tuszu.

### Weryfikacja 1.8
- Testy: `npm test` (online, konta + wymagana zgoda, `update8_test` – 56 asercji: poziomy bez limitu, Otchłań, Skrzynia Mityczna ≈10%, pety, koło fortuny, eventy, moderacja, oczyszczanie profili innych graczy; Przebudzenia; balans) – wszystkie OK; `vite build` OK; brak zewnętrznych adresów zasobów w buildzie.
- Przeglądarka (`.preview/run-008`): rejestracja bez/z zgodą, poziom 160, skrzynia mityczna, porównanie po najechaniu, tło zbrojowni, pet na scenie i na lalce, wykluwanie, podgląd/przymierzanie skórek, Otchłań (walka z tłem), koło fortuny z eventem, suwaki głośności (zapis), profil gracza, Regulamin/Polityka; dźwięk w walce: kontekst aktywny, maks. 2 głosy jednocześnie.
- Serwer: zapis eventów/ogłoszeń i statystyki admina bez uprawnień → 401; publiczny odczyt eventów/ogłoszeń działa.
- Poprawki z walidacji: helper `fill()` (natywne `replaceChildren` wypisywało „null”), widoczny przycisk Sklep na ciemnym pasku, znaczniki eventów bez zawijania paska, ikona głośności.

## Aktualizacja 8.1 – planowanie eventów (wersja 1.8.1)
- Asset Preparation: brak nowych zasobów – ikony eventów (`icons/ui_*`: star/gold/token), kolory z `LIVE_EVENTS` i styl kart panelu ponownie użyte.
- Panel 🛡 › Eventy: formularz „Zaplanuj event” (rodzaj, start i koniec jako data + godzina, szybkie terminy: teraz 1 h / 24 h, wieczór 18–22, najbliższy weekend), podgląd terminu i błędów na żywo, listy Trwające / Zaplanowane / Historia, edycja (zaplanowany: rodzaj, start, koniec; trwający: tylko koniec), anulowanie z dwuetapowym potwierdzeniem (zaplanowany – usunięcie, trwający – zakończenie teraz).
- Zasady terminu (`src/core/schedule.js`): 15 min – 7 dni, start nie w przeszłości (tolerancja 5 min), najwyżej 90 dni naprzód, eventy tego samego rodzaju nie mogą się nakładać (różne – mogą). Godziny w czasie urządzenia administratora (opis strefy w panelu).
- Serwer bez zmian schematu: `live_events` już przechowuje `starts_at`/`ends_at`, zapis tylko dla `is_admin()`. Event włącza się i wyłącza sam u graczy (status liczony z zegara względem pobranych terminów).
- Gracze: zapowiedzi na ekranie startowym (do 14 dni wcześniej, maks. 3, odliczanie co 30 s, odświeżanie z serwera co 5 min); przy zapowiedziach chowa się hasło i pasek „Gotowe!”, lista przewija się nad pasem zasad. Okno koła fortuny odlicza do zaplanowanego „Szczęśliwego Koła”, jeśli jest przed weekendem.
- UI fingerprint: kontynuacja papierowych kart – kafle rodzajów z kolorowym paskiem (wybrany = pełny kolor eventu), wiersze listy z lewym paskiem w kolorze eventu, karta zapowiedzi z czarną etykietą „📅 Zapowiedź” i czerwonym odliczaniem.
- Weryfikacja: `schedule_test` (ponad 50 sprawdzeń, także atrapa serwera dla planowania/edycji/anulowania) + pełne `npm test`; przeglądarka `.preview/run-009`: zapowiedzi na starcie, wpisanie daty z klawiatury, zapis, kolizja, edycja, „Uruchom teraz” (znacznik na pasku, koło aktywne), zatrzymanie, anulowanie. Naprawione przy walidacji: zmiana `min` pola w trakcie wpisywania gubiła datę (Chrome), odliczanie „59,5 min” pokazywało „1 min”, lata 0–99 zamieniane na 19xx.

## Aktualizacja 8.2 – VIP nadawany przez administratora (wersja 1.8.2)
- Asset Preparation: brak nowych plików – skórka „Królewski VIP” jako wpis `SKINS.vip` (tint/sat/glow w istniejącym shaderze i `skinPreview`), plakietka „VIP” i złote akcenty w CSS, 👑 jako znak tekstowy; ikony `icons/ui_*` ponownie użyte.
- Serwer (`supabase/vip_1.8.2.sql`, ten sam blok na końcu `schema.sql`): `vip` (koniec VIP-a na gracza, odczyt dla zalogowanych), `vip_log` (dziennik nadań/odebrań z paczką kryształów, odczyt: własny/administrator), brak polityk zapisu; `admin_grant_vip(p_user, p_days 1–366, p_reason)` przedłuża od końca obecnego VIP-a (maks. 730 dni naprzód, bonus 10 💎/dzień do 1000), `admin_revoke_vip` kończy teraz. **Migracja do uruchomienia ręcznie w Supabase › SQL Editor** (instrukcja w ONLINE.md).
- Korzyści (`src/data/vip.js`, bez przewagi w walce): plecak +10, Idle 16 h, +1 klucz Otchłani dziennie (od razu w dniu nadania), plakietka VIP przy nicku (czat, rankingi, gildia, profil), skórka VIP na czas trwania, paczka kryształów raz na nadanie (tylko nadania po utworzeniu postaci). Po wygaśnięciu/odebraniu: skórka wraca do klasycznej, przedmioty z większego plecaka zostają.
- Klient: stan VIP z serwera (`Net.loadVip` przy każdym odświeżeniu świata, zdarzenie `vip` → `syncVip`), zapamiętany w zapisie (`P.vip`) na czas braku połączenia; brak tabel na serwerze = jedno ostrzeżenie w konsoli, VIP wyłączony, gra bez zmian.
- Panel 🛡 › Gracze: sekcja „👑 Aktywni VIP” (+30 dni, Odbierz z potwierdzeniem), przy każdym graczu „👑 VIP” → formularz (7/30/90 dni lub własna liczba, powód do dziennika, podgląd nowego końca i paczki, nadanie/przedłużenie, odebranie, historia 5 ostatnich wpisów); żółta instrukcja, gdy brak migracji.
- Gracz: 👑 VIP na górnym pasku → okno z datą końca, pozostałym czasem i listą korzyści; karta VIP w Sklepie › Kryształy i skórki; komunikaty o nadaniu, przedłużeniu, zakończeniu i wygaśnięciu.
- UI fingerprint: złoty tusz (`#ffd36b`→`#e0a33a`) z czarnym konturem i twardym cieniem – plakietka VIP jak mała naklejka przy nicku, karta VIP i formularz z lewym złotym paskiem (spójne z wierszami eventów).
- Weryfikacja: `vip_test` (46 sprawdzeń: korzyści, skórka, synchronizacja, paczki raz na nadanie, odebranie, brak migracji, operacje panelu na atrapie serwera) i `vip_sql_test` (33 sprawdzenia na PGlite: tylko administrator, przedłużanie, limity, RLS odczytu i zapisu także przy pełnych uprawnieniach tabel, odebranie, kasowanie konta) + pełne `npm test`; przeglądarka `.preview/run-010`: brak migracji, nadanie 90 dni z powodem, blokada 400 dni, +30 dni, odebranie z potwierdzeniem, VIP gracza (paczka +300 💎, plecak 40, Idle 16 h, 16 kluczy, okno VIP, skórka na scenie), plakietki w rankingu, komunikat o zakończeniu.

## Aktualizacja 8.3 – prezenty od administracji (wersja 1.8.3)
- Asset Preparation: brak nowych plików – ikony `icons/ui_*` (złoto, kryształ), 🎁 jako znak tekstowy, istniejące style kart, chipów i wierszy list.
- Serwer (`supabase/gifts_1.8.3.sql`, także na końcu `schema.sql`): tabela `gifts` (partia, odbiorca, złoto ≤100 mln, kryształy ≤10 000, wiadomość, notatka, odbiór); RLS tylko do odczytu (własne lub administrator); funkcje `admin_send_gift` (wybrani lub wszyscy, maks. 5000), `admin_cancel_gift` (tylko nieodebrane), `admin_gift_history`, `claim_gifts` (raz, podnosi limit strażnika kryształów).
- Panel 🛡 › 🎁 Prezenty: odbiorcy (wyszukiwarka, „+ Dodaj”, „Dodaj wszystkich z listy”, „Wszyscy gracze” z liczbą kont, przycisk 🎁 przy graczu w zakładce Gracze), kwoty z gotowymi wartościami, wiadomość dla graczy, notatka, podgląd łącznej kwoty, wysyłka z potwierdzeniem (5 s), historia partii z liczbą odebranych i anulowaniem nieodebranych; żółta instrukcja, gdy brak migracji.
- Gracz: 🎁 z licznikiem na górnym pasku, okno otwiera się samo raz na nowy prezent (poza walką i innymi oknami); „Odbierz wszystko” dodaje dokładne kwoty bez mnożników eventów, blokada podwójnego kliknięcia.
- UI fingerprint: czerwona naklejka 🎁 na pasku, karta nagłówka z ciepłym gradientem papieru, pozycje z czerwonym, a partie w historii ze złotym lewym paskiem.
- Weryfikacja: `gift_test` (ponad 45 sprawdzeń: limity, opisy, odbiór dokładny i jednorazowy, blokada, atrapa serwera, brak uprawnień, brak migracji) i `gifts_sql_test` (40 sprawdzeń na PGlite z prawdziwym strażnikiem zapisów) + pełne `npm test`; przeglądarka `.preview/run-011`: baner bez migracji, wybór graczy, potwierdzenie, wysyłka do wszystkich, okno gracza, odbiór +25 000 zł / +10 000 💎, historia, anulowanie 3 nieodebranych.

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
