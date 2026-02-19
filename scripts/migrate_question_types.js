const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
    let connection;
    try {
        console.log('Migrating database for multi-type questions...');

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

        // 1. Add question_type column to questions table
        try {
            await connection.execute(`ALTER TABLE questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'multiple_choice' AFTER id`);
            console.log('Added question_type column to questions table.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('question_type column already exists.');
            } else {
                throw e;
            }
        }

        // 2. Change correct_answer to TEXT in questions table
        try {
            await connection.execute(`ALTER TABLE questions MODIFY COLUMN correct_answer TEXT`);
            console.log('Modified correct_answer to TEXT in questions table.');
        } catch (e) {
            console.error('Failed to modify correct_answer:', e);
            throw e;
        }

        // 3. Change selected_answer to TEXT in student_answers table
        try {
            await connection.execute(`ALTER TABLE student_answers MODIFY COLUMN selected_answer TEXT`);
            console.log('Modified selected_answer to TEXT in student_answers table.');
        } catch (e) {
            console.error('Failed to modify selected_answer:', e);
            throw e;
        }

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
