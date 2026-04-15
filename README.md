# Strona Głosowania — Instrukcja dla Administratora

## Spis treści
1. [Uruchomienie serwera](#uruchomienie-serwera)
2. [Panel admina](#panel-admina)
3. [Zmiana hasła admina](#zmiana-hasła-admina)
4. [Dodawanie zdjęć](#dodawanie-zdjęć)
5. [Ustawienie terminu głosowania](#ustawienie-terminu-głosowania)
6. [Reset głosów](#reset-głosów)
7. [Baza danych](#baza-danych)
8. [Struktura plików](#struktura-plików)

---

## Uruchomienie serwera

Wymagania: **Python 3.x** z zainstalowanym Flask.

```bash
# Instalacja zależności (tylko za pierwszym razem)
pip install flask

# Uruchomienie
python app.py
```

Serwer startuje pod adresem:
- Strona główna: `http://127.0.0.1:5000`
- Panel admina: `http://127.0.0.1:5000/admin/login`

---

## Panel admina

1. Wejdź na `http://127.0.0.1:5000/admin/login`
2. Podaj hasło (domyślne: `admin123`)
3. W panelu dostępne są:
   - Podgląd wyników głosowania w czasie rzeczywistym (tabela + wykres)
   - Zmiana terminu zakończenia głosowania
   - Reset wszystkich głosów

---

## Zmiana hasła admina

Otwórz plik `app.py` i zmień wartość w linii:

```python
ADMIN_PASSWORD = 'admin123'   # ← wpisz tutaj swoje hasło
```

> **Ważne:** Zmień hasło przed udostępnieniem strony publicznie.

---

## Dodawanie zdjęć

### Krok 1 — dodaj plik zdjęcia

Wrzuć nowe zdjęcia do folderu `media/` zgodnie z nazewnictwem:

```
media/image20.jpg
media/image21.jpg
...
```

### Krok 2 — zaktualizuj licznik w dwóch miejscach

**Plik `app.py`** (linia ~12):
```python
PHOTO_COUNT = 19   # ← zmień na nową liczbę zdjęć
```

**Plik `skrypt.js`** (linia 2):
```js
const PHOTO_COUNT = 19;   // ← zmień na tę samą liczbę
```

> Obie wartości muszą być **identyczne**. `app.py` używa jej do walidacji głosów po stronie serwera, `skrypt.js` do budowania galerii w przeglądarce.

---

## Ustawienie terminu głosowania

Termin można zmienić na dwa sposoby:

### A) Przez panel admina (zalecane)
1. Zaloguj się do panelu
2. W sekcji "Termin głosowania" wpisz datę i godzinę
3. Kliknij "Zapisz"

### B) Bezpośrednio w bazie danych
```sql
UPDATE config SET value = '2026-05-01T12:00:00' WHERE key = 'deadline';
```

Format daty: `RRRR-MM-DDTHH:MM:SS` (np. `2026-05-01T12:00:00`)

---

## Reset głosów

Reset usuwa **wszystkie** oddane głosy i odblokowuje możliwość ponownego głosowania (również dla osób, które już głosowały z przeglądarki).

**Przez panel admina:**
1. Kliknij przycisk "Resetuj wszystkie głosy"
2. Potwierdź wpisując `RESET`

> Po resecie system automatycznie zwiększa wewnętrzny licznik generacji (`vote_generation`). Przeglądarki, które zapamiętały oddany głos, wykryją zmianę i odblokują przyciski głosowania.

---

## Baza danych

Plik: `glosowanie.db` (SQLite, tworzony automatycznie przy pierwszym uruchomieniu)

Tabele:
- `votes` — lista oddanych głosów (`photo_id`, `ip_address`, `timestamp`)
- `config` — konfiguracja (`deadline`, `vote_generation`)

Podgląd bazy (opcjonalnie):
```bash
sqlite3 glosowanie.db "SELECT * FROM votes;"
```

> Jeden głos jest dozwolony **na adres IP**. Głosujący nie może zmienić swojego głosu.

---

## Struktura plików

```
strona_glosowanie/
├── app.py              # serwer Flask (backend, API, panel admina)
├── skrypt.js           # logika galerii i głosowania (frontend)
├── strona.html         # strona główna
├── styl.css            # style CSS
├── glosowanie.db       # baza danych SQLite (tworzona automatycznie)
├── favicon.ico         # ikona strony
├── cloudflared.exe     # tunel Cloudflare (opcjonalne udostępnienie publiczne)
├── media/              # folder ze zdjęciami (image1.jpg, image2.jpg, ...)
└── templates/
    ├── admin_login.html
    └── admin_panel.html
```
