const { query } = require('../src/lib/db');

async function fixSubjects() {
    console.log('Fixing subjects categories...');
    try {
        // Ensure category column exists (might fail if duplicate, which is fine)
        try {
            await query(`ALTER TABLE subjects ADD COLUMN category VARCHAR(50) DEFAULT 'SMA' AFTER icon`);
            console.log('Added category column to subjects.');
        } catch (e) {
            console.log('Category column already exists or other error:', e.message);
        }

        // Update existing subjects to SMA by default
        await query("UPDATE subjects SET category = 'SMA' WHERE category IS NULL");

        // SD Subjects
        const sdSubjects = ['Matematika', 'Bahasa Indonesia', 'IPA', 'Bahasa Inggris', 'IPS'];
        for (const name of sdSubjects) {
            // Check if exists
            const existing = await query("SELECT id FROM subjects WHERE name = ?", [name]);
            if (existing.length > 0) {
                await query("UPDATE subjects SET category = 'SD' WHERE name = ?", [name]);
                console.log(`Updated ${name} to SD.`);
            } else {
                // Insert if not exists
                let icon = '📚';
                if (name === 'Matematika') icon = '📐';
                if (name === 'Bahasa Indonesia') icon = '📖';
                if (name === 'IPA') icon = '🔬';
                if (name === 'IPS') icon = '🌍';
                await query("INSERT INTO subjects (name, icon, category) VALUES (?, ?, ?)", [name, icon, 'SD']);
                console.log(`Added ${name} as SD subject.`);
            }
        }

        console.log('Fix completed.');
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit();
}

fixSubjects();
