const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
    let connection;
    try {
        console.log('Migrating database...');

        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || '';
        const database = process.env.DB_NAME || 'to_wijaya_edu';
        const port = parseInt(process.env.DB_PORT || '3306');

        console.log(`Connecting to database ${database} at ${host}...`);

        connection = await mysql.createConnection({
            host,
            user,
            password,
            database,
            port
        });

        // Add max_score column to exams table if it doesn't exist
        try {
            await connection.execute(`ALTER TABLE exams ADD COLUMN max_score INT DEFAULT 100 AFTER passing_score`);
            console.log('Added max_score column to exams table.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('max_score column already exists.');
            } else {
                throw e;
            }
        }

        await connection.execute(`UPDATE exams SET max_score = 1000 WHERE passing_score > 100`);
        await connection.execute(`UPDATE exams SET max_score = 100 WHERE max_score IS NULL OR max_score < 100`);
        console.log('Synchronized max_score values based on existing passing_score data.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

migrate();
