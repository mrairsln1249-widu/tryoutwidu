const { query } = require('../src/lib/db');

async function migrate() {
    console.log('Starting category migration...');
    try {
        // Add category to users
        await query(`ALTER TABLE users ADD COLUMN category VARCHAR(50) DEFAULT 'SMA' AFTER role`);
        console.log('Added category column to users table.');

        // Add category to subjects
        await query(`ALTER TABLE subjects ADD COLUMN category VARCHAR(50) DEFAULT 'SMA' AFTER icon`);
        console.log('Added category column to subjects table.');

        // Seed some categories for subjects if possible
        // Let's assume some common subjects for SD
        // SD: Matematika, Bahasa Indonesia, IPA, Bahasa Inggris, IPS
        /*
        await query("UPDATE subjects SET category = 'SD' WHERE name IN ('Matematika', 'Bahasa Indonesia', 'IPA', 'Bahasa Inggris', 'IPS')");
        */

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
    process.exit();
}

migrate();
