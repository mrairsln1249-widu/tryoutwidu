const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
    let connection;
    try {
        console.log('Migrating exams.subject_ids...');

        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || '';
        const database = process.env.DB_NAME || 'to_wijaya_edu';
        const port = parseInt(process.env.DB_PORT || '3306', 10);

        connection = await mysql.createConnection({
            host,
            user,
            password,
            database,
            port,
        });

        try {
            await connection.execute('ALTER TABLE exams ADD COLUMN subject_ids TEXT NULL AFTER subject_id');
            console.log('Added subject_ids column to exams table.');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('subject_ids column already exists.');
            } else {
                throw error;
            }
        }

        await connection.execute(
            `UPDATE exams
             SET subject_ids = CONCAT('[', subject_id, ']')
             WHERE subject_id IS NOT NULL
               AND (subject_ids IS NULL OR subject_ids = '' OR subject_ids = '[]')`
        );
        console.log('Backfilled subject_ids from existing subject_id values.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
