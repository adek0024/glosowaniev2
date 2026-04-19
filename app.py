from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from functools import wraps
from datetime import datetime
import sqlite3
import os

app = Flask(__name__, template_folder='templates')
app.secret_key = 'wiosna-w-obiektywie-sekretny-klucz-2026'

# ── KONFIGURACJA ─────────────────────────────────────────────
ADMIN_PASSWORD = 'admin123'   # ← ZMIEŃ NA SWOJE HASŁO
PHOTO_COUNT    = 12
DB_PATH        = os.path.join(os.path.dirname(__file__), 'glosowanie.db')

# ── BAZA DANYCH ──────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS votes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_id   INTEGER NOT NULL,
            ip_address TEXT,
            timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES ('deadline', '2026-03-14T15:40:00')"
    )
    conn.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES ('vote_generation', '1')"
    )
    conn.commit()
    conn.close()

# ── DEKORATOR ADMINA ─────────────────────────────────────────
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_logged_in'):
            # Dla zapytań AJAX zwróć 401 JSON zamiast HTML redirect
            if request.is_json or request.path.startswith('/admin/api/'):
                return jsonify({'success': False, 'message': 'Sesja wygasła, zaloguj się ponownie'}), 401
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated

# ── PLIKI STATYCZNE ──────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'strona.html')

@app.route('/styl.css')
def css():
    return send_from_directory('.', 'styl.css')

@app.route('/skrypt.js')
def js():
    return send_from_directory('.', 'skrypt.js')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('.', 'favicon.ico', mimetype='image/x-icon')

@app.route('/media/<path:filename>')
def media(filename):
    return send_from_directory('media', filename)

# ── PUBLICZNE API ─────────────────────────────────────────────
@app.route('/api/deadline')
def api_deadline():
    conn = get_db()
    row = conn.execute("SELECT value FROM config WHERE key='deadline'").fetchone()
    gen = conn.execute("SELECT value FROM config WHERE key='vote_generation'").fetchone()
    conn.close()
    return jsonify({
        'deadline':        row['value'] if row else '2026-03-14T15:40:00',
        'vote_generation': int(gen['value']) if gen else 1,
    })


@app.route('/vote', methods=['POST'])
def vote():
    data     = request.get_json(silent=True) or {}
    photo_id = data.get('photo_id')

    if not photo_id or not (1 <= int(photo_id) <= PHOTO_COUNT):
        return jsonify({'success': False, 'message': 'Nieprawidłowe ID zdjęcia'}), 400

    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    ip = ip.split(',')[0].strip()

    conn = get_db()
    try:
        # Sprawdź czy głosowanie trwa
        row = conn.execute("SELECT value FROM config WHERE key='deadline'").fetchone()
        if row:
            deadline = datetime.fromisoformat(row['value'])
            if datetime.now() > deadline:
                return jsonify({'success': False, 'message': 'Głosowanie zostało zakończone'}), 400

        # Jeden głos na IP
        existing = conn.execute(
            "SELECT id FROM votes WHERE ip_address = ?", (ip,)
        ).fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'Z tego adresu IP już oddano głos'}), 400

        conn.execute(
            "INSERT INTO votes (photo_id, ip_address) VALUES (?, ?)",
            (int(photo_id), ip)
        )
        conn.commit()
        return jsonify({'success': True, 'message': 'Głos zapisany!'})
    finally:
        conn.close()

# ── PANEL ADMINA ─────────────────────────────────────────────
@app.route('/admin')
@admin_required
def admin_panel():
    return render_template('admin_panel.html')


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if session.get('admin_logged_in'):
        return redirect(url_for('admin_panel'))

    error = None
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            session.permanent = False
            return redirect(url_for('admin_panel'))
        error = 'Błędne hasło. Spróbuj ponownie.'

    return render_template('admin_login.html', error=error)


@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))


@app.route('/admin/api/results')
@admin_required
def admin_results():
    conn = get_db()

    rows  = conn.execute('''
        SELECT photo_id, COUNT(*) as count
        FROM votes
        GROUP BY photo_id
        ORDER BY count DESC
    ''').fetchall()

    total       = conn.execute("SELECT COUNT(*) as c FROM votes").fetchone()['c']
    deadline_row = conn.execute("SELECT value FROM config WHERE key='deadline'").fetchone()
    conn.close()

    vote_map = {r['photo_id']: r['count'] for r in rows}
    results  = [
        {'photo_id': i, 'count': vote_map.get(i, 0)}
        for i in range(1, PHOTO_COUNT + 1)
    ]
    # Sortuj malejąco po liczbie głosów
    results.sort(key=lambda x: x['count'], reverse=True)

    return jsonify({
        'results':  results,
        'total':    total,
        'deadline': deadline_row['value'] if deadline_row else '',
    })


@app.route('/admin/api/set-deadline', methods=['POST'])
@admin_required
def set_deadline():
    data = request.get_json(silent=True) or {}
    raw  = data.get('deadline', '').strip()

    try:
        dt = datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Nieprawidłowy format daty'}), 400

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('deadline', ?)", (raw,)
    )
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Termin zmieniony na {dt.strftime("%d.%m.%Y %H:%M")}'
    })


@app.route('/admin/api/reset-votes', methods=['POST'])
@admin_required
def reset_votes():
    data = request.get_json(silent=True) or {}
    if data.get('confirm') != 'RESET':
        return jsonify({'success': False, 'message': 'Wymagane potwierdzenie'}), 400

    conn = get_db()
    conn.execute("DELETE FROM votes")
    # Zwiększ generację — klienci z localStorage wykryją reset i odblokują przyciski
    conn.execute("""
        UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
        WHERE key = 'vote_generation'
    """)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Wszystkie głosy i zablokowane IP zostały usunięte'})


# ── START ────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print("Baza danych zainicjalizowana")
    print("Strona:       http://127.0.0.1:5000")
    print("Panel admina: http://127.0.0.1:5000/admin/login")
    app.run(debug=False, host='127.0.0.1', port=5000)
