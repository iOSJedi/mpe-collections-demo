const fs = require('fs');
const path = require('path');
const postgres = require(path.join(__dirname, '..', 'node_modules', 'postgres', 'cjs', 'src', 'index.js'));

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const ddl = fs.readFileSync(path.join(__dirname, 'create-tables.sql'), 'utf8');

sql.unsafe(ddl)
  .then(() => { console.log('All tables created successfully'); return sql.end(); })
  .catch(e => { console.error('Failed:', e.message); sql.end(); process.exit(1); });
