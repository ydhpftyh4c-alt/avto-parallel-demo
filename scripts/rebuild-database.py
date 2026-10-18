#!/usr/bin/env python3
"""Rebuild the optional local SQLite index from human-readable JSON. No external dependencies."""
import json,sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1];db=root/'data/catalog.sqlite'
connection=sqlite3.connect(db)
with connection:
 connection.executescript('''
 DROP TABLE IF EXISTS vehicle_sources; DROP TABLE IF EXISTS prices; DROP TABLE IF EXISTS media; DROP TABLE IF EXISTS vehicles; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS intake;
 CREATE TABLE vehicles(record_id TEXT PRIMARY KEY, name TEXT, brand TEXT, model TEXT, year INTEGER, mileage_km INTEGER, status TEXT, status_date TEXT, price REAL, currency TEXT, price_date TEXT, review_required INTEGER, folder TEXT, data_json TEXT);
 CREATE TABLE messages(message_id INTEGER PRIMARY KEY,date TEXT,text TEXT,reply_to INTEGER,missing_video INTEGER);
 CREATE TABLE vehicle_sources(record_id TEXT REFERENCES vehicles(record_id),message_id INTEGER REFERENCES messages(message_id),PRIMARY KEY(record_id,message_id));
 CREATE TABLE prices(record_id TEXT REFERENCES vehicles(record_id),message_id INTEGER,date TEXT,amount REAL,currency TEXT,kind TEXT,applies_to_current INTEGER);
 CREATE TABLE media(record_id TEXT REFERENCES vehicles(record_id),path TEXT,source_file TEXT,sha256 TEXT);
 CREATE TABLE intake(path TEXT PRIMARY KEY,category TEXT,data_json TEXT);
 CREATE INDEX vehicle_brand_model ON vehicles(brand,model); CREATE INDEX vehicle_status ON vehicles(status); CREATE INDEX source_reply ON messages(reply_to);
 ''')
 messages=json.loads((root/'.local-source/messages.json').read_text(encoding='utf8'))
 connection.executemany('INSERT INTO messages VALUES(?,?,?,?,?)',[(m['id'],m['date'],m['text'],m['reply_to'],m['missing_video']) for m in messages])
 for f in sorted((root/'data/vehicles').rglob('vehicle.json')):
  v=json.loads(f.read_text(encoding='utf8'));folder=f.parent.relative_to(root).as_posix();s=json.loads((f.parent/'sources.json').read_text(encoding='utf8'));spec=v['specs']
  connection.execute('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(v['record_id'],v['name'],v['brand'],v['model'],spec['year'],spec['mileage_km'],v['status'],v['statusDate'],v['price'],v['currency'],v['priceDate'],v['review_required'],folder,json.dumps(v,ensure_ascii=False)))
  connection.executemany('INSERT INTO vehicle_sources VALUES(?,?)',[(v['record_id'],mid) for mid in v['source_message_ids']])
  connection.executemany('INSERT INTO prices VALUES(?,?,?,?,?,?,?)',[(v['record_id'],p['message_id'],p['date'],p['amount'],p['currency'],p['kind'],p['applies_to_current']) for p in v['price_history']])
  connection.executemany('INSERT INTO media VALUES(?,?,?,?)',[(v['record_id'],folder+'/'+m['file'],m['source_file'],m['source_sha256']) for m in s['media']])
 for f in (root/'data/intake').rglob('record.json'):
  v=json.loads(f.read_text(encoding='utf8'));connection.execute('INSERT INTO intake VALUES(?,?,?)',(f.parent.relative_to(root).as_posix(),v['category'],json.dumps(v,ensure_ascii=False)))
 assert connection.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 print('SQLite rebuilt:',db.name,'vehicles:',connection.execute('SELECT COUNT(*) FROM vehicles').fetchone()[0],'messages:',connection.execute('SELECT COUNT(*) FROM messages').fetchone()[0])
connection.close()
