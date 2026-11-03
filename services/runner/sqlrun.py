# Executes a SQL script against a fresh in-memory SQLite database.
# stdin = setup SQL (from the test case) + "\n" + student SQL.
# Each statement producing rows is printed as a pipe-separated table with a header line.
import sqlite3, sys

def statements(script):
    buf = ""
    for ch in script:
        buf += ch
        if ch == ";" and sqlite3.complete_statement(buf):
            if buf.strip(" \n\t;"): yield buf.strip()
            buf = ""
    if buf.strip(): yield buf.strip()

conn = sqlite3.connect(":memory:")
cur = conn.cursor()
try:
    for stmt in statements(sys.stdin.read()):
        cur.execute(stmt)
        if cur.description:
            print(" | ".join(d[0] for d in cur.description))
            for row in cur.fetchall():
                print(" | ".join("NULL" if v is None else str(v) for v in row))
    conn.commit()
except sqlite3.Error as e:
    print(f"SQL error: {e}", file=sys.stderr); sys.exit(1)
