const { query } = require('../src/lib/db');

async function migrate() {
    console.log('Starting phone column migration...');
    try {
        await query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER email`);
        console.log('Added phone column to users table.');
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
    process.exit();
}

migrate();
