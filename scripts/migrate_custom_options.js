const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
    let connection;
    try {
        console.log('Migrating database for custom options...');

        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || '';
        const database = process.env.DB_NAME || 'to_wijaya_edu';
        const port = parseInt(process.env.DB_PORT || '3306');

        connection = await mysql.createConnection({
            host,
            user,
            password,
            database,
            port
        });

        // Add options column to questions table to store JSON array of options
        try {
            await connection.execute(`ALTER TABLE questions ADD COLUMN options TEXT AFTER option_e`);
            console.log('Added options column to questions table.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('options column already exists.');
            } else {
                throw e;
            }
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
