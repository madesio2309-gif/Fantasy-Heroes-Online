// Regulamin i Polityka prywatności (wersja dokumentów zapisywana przy rejestracji)
export const LEGAL_VERSION = '2026-11-24';
export const ADMIN_CONTACT = 'madesio2309@gmail.com';

export const TERMS = {
  title: 'Regulamin gry Fantasy Heroes Online',
  sections: [
    ['§1. Postanowienia ogólne', [
      'Fantasy Heroes Online („Gra”) to bezpłatna gra przeglądarkowa prowadzona przez jej twórcę („Administrator”, kontakt: ' + ADMIN_CONTACT + ').',
      'Gra jest w fazie testów (beta). Zawartość, balans i zasady mogą się zmieniać, a postępy w wyjątkowych sytuacjach mogą zostać skorygowane.',
      'Korzystanie z Gry oznacza akceptację niniejszego Regulaminu i Polityki prywatności.',
    ]],
    ['§2. Konto', [
      'Konto online zakłada się adresem e-mail i hasłem. Jedna osoba może posiadać jedno konto online.',
      'Gracz odpowiada za poufność hasła. Konto można w każdej chwili usunąć w ⚙ Ustawieniach (usuwa to także postać i dane konta z serwera).',
      'Konto lokalne działa tylko w danej przeglądarce i nie jest przechowywane na serwerze.',
      'Z Gry mogą korzystać osoby, które ukończyły 16 lat, a młodsze – za zgodą rodzica lub opiekuna.',
    ]],
    ['§3. Zasady zachowania', [
      'Zabronione jest: używanie błędów Gry, modyfikowanie kodu, zapisu lub ruchu sieciowego w celu zdobycia przewagi, korzystanie z botów i skryptów.',
      'Na czacie i w nazwach postaci/gildii zabronione są wulgaryzmy, obrażanie innych, treści nienawistne, spam, reklama i podawanie danych osobowych innych osób.',
      'Wiadomości naruszające zasady można zgłosić. Administrator może usunąć treść, zablokować czat lub konto oraz skorygować postępy zdobyte nieuczciwie.',
    ]],
    ['§4. Waluty i przedmioty wirtualne', [
      'Złoto, kryształy, przedmioty, pety i skórki są wirtualne, zdobywa się je wyłącznie grając i nie mają wartości pieniężnej.',
      'Gra nie zawiera płatności za prawdziwe pieniądze. Handel kontami i przedmiotami poza Grą jest zabroniony.',
    ]],
    ['§5. Odpowiedzialność', [
      'Gra jest udostępniana „taka, jaka jest”. Administrator dokłada starań, aby działała poprawnie, ale nie gwarantuje ciągłej dostępności serwera ani braku błędów.',
      'Administrator nie odpowiada za utratę postępów wynikającą z wyczyszczenia danych przeglądarki (konto lokalne) lub działania osób trzecich.',
    ]],
    ['§6. Zmiany i kontakt', [
      'O zmianach Regulaminu Administrator informuje w ogłoszeniach w Grze. Dalsze korzystanie z Gry oznacza ich akceptację.',
      'Zgłoszenia i reklamacje: ' + ADMIN_CONTACT + '.',
    ]],
  ],
};

export const PRIVACY = {
  title: 'Polityka prywatności',
  sections: [
    ['1. Administrator danych', [
      'Administratorem danych osobowych jest twórca Gry Fantasy Heroes Online (kontakt: ' + ADMIN_CONTACT + ').',
    ]],
    ['2. Jakie dane przetwarzamy', [
      'Konto online: adres e-mail, hasło (przechowywane wyłącznie w postaci skrótu przez dostawcę uwierzytelniania), data rejestracji i ostatniego logowania, data akceptacji dokumentów.',
      'Gra: nazwa i wygląd postaci, postępy, ekwipunek, wyniki w rankingach, gildia, wiadomości czatu i zgłoszenia.',
      'Dane techniczne: adres IP i informacje o przeglądarce przetwarzane przez dostawców hostingu w celu obsługi połączeń i bezpieczeństwa.',
    ]],
    ['3. Cele i podstawy prawne', [
      'Świadczenie usługi Gry i prowadzenie konta – art. 6 ust. 1 lit. b RODO.',
      'Bezpieczeństwo, przeciwdziałanie oszustwom i moderacja czatu – prawnie uzasadniony interes Administratora (art. 6 ust. 1 lit. f RODO).',
      'Wiadomości e-mail wysyłane są wyłącznie w sprawach konta (potwierdzenie adresu, reset hasła). Gra nie wysyła reklam.',
    ]],
    ['4. Odbiorcy i miejsce przechowywania', [
      'Dane konta i Gry przechowuje Supabase Inc. (podmiot przetwarzający) na serwerach w Unii Europejskiej (Irlandia).',
      'Pliki Gry udostępniają serwisy hostingowe (Seeles, GitHub Pages). Dane nie są sprzedawane ani udostępniane w celach marketingowych.',
    ]],
    ['5. Okres przechowywania', [
      'Dane przechowujemy do czasu usunięcia konta. Wiadomości czatu i zgłoszenia – do 12 miesięcy. Po usunięciu konta dane są usuwane z bazy niezwłocznie, a z kopii zapasowych dostawcy – zgodnie z jego cyklem.',
    ]],
    ['6. Twoje prawa', [
      'Masz prawo dostępu do danych, ich sprostowania, usunięcia (⚙ Ustawienia → Usuń konto), przenoszenia (⚙ Ustawienia → Pobierz plik postaci), ograniczenia przetwarzania i sprzeciwu.',
      'Przysługuje Ci skarga do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).',
    ]],
    ['7. Pamięć przeglądarki', [
      'Gra zapisuje w pamięci przeglądarki (localStorage) wyłącznie dane niezbędne: zapis postaci, sesję logowania i ustawienia dźwięku. Gra nie używa ciasteczek reklamowych ani analitycznych.',
    ]],
  ],
};
