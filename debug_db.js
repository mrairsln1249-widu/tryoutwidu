const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'to_wijaya_edu',
    });
    const [rows] = await connection.execute('DESCRIBE exam_attempts');
    const fields = rows.map(r => r.Field);
    const required = ['score', 'ability_score', 'standard_error', 'percentile', 'end_time'];
    required.forEach(f => {
        console.log(`${f}: ${fields.includes(f) ? 'OK' : 'MISSING'}`);
    });
    await connection.end();
}
check();
