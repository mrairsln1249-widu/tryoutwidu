const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'to_wijaya_edu',
    });

    try {
        const [columns] = await pool.query('SHOW COLUMNS FROM questions LIKE "topic"');
        if (columns.length === 0) {
            console.log('Adding topic column to questions table...');
            await pool.query('ALTER TABLE questions ADD COLUMN topic VARCHAR(100) DEFAULT NULL AFTER question_text');
            console.log('Success!');
        } else {
            console.log('Column topic already exists.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
