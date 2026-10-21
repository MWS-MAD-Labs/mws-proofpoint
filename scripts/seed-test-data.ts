import pg from 'pg';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Starting seed process...');

        await client.query('BEGIN');

        // 1. Create Department
        const deptId = uuidv4();
        await client.query(
            'INSERT INTO departments (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [deptId, 'Quality Assurance']
        );
        console.log('Department created.');

        // 2. Create Users
        const passwordHash = await bcrypt.hash('password123', 10);

        const staffId = uuidv4();
        const managerId = uuidv4();
        const directorId = uuidv4();

        const users = [
            { id: staffId, email: 'staff@example.com', name: 'Test Staff', role: 'staff', deptId, title: 'Senior QA Engineer' },
            { id: managerId, email: 'manager@example.com', name: 'Test Manager', role: 'manager', deptId, title: 'QA Manager' },
            { id: directorId, email: 'director@example.com', name: 'Test Director', role: 'director', deptId: null, title: 'Director of Engineering' },
        ];

        for (const u of users) {
            // Create user
            await client.query(
                'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $3',
                [u.id, u.email, passwordHash]
            );

            // Create profile
            await client.query(
                'INSERT INTO profiles (user_id, email, full_name, department_id, job_title) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET full_name = $3, department_id = $4, job_title = $5',
                [u.id, u.email, u.name, u.deptId, u.title]
            );

            // Create role
            await client.query(
                'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
                [u.id, u.role]
            );
        }
        console.log('Users and profiles created.');

        // 3. Create Rubric Template
        const templateId = uuidv4();
        await client.query(
            'INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
            [templateId, 'QA Engineer Performance Rubric', 'Standard performance criteria for QA Engineers', deptId, false, managerId]
        );

        // 4. Create Sections
        const section1Id = uuidv4();
        const section2Id = uuidv4();

        await client.query(
            'INSERT INTO rubric_sections (id, template_id, name, weight, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [section1Id, templateId, 'Technical Skills', 60.0, 1]
        );
        await client.query(
            'INSERT INTO rubric_sections (id, template_id, name, weight, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [section2Id, templateId, 'Communication & Collaboration', 40.0, 2]
        );

        // 5. Create Indicators
        const scoreOptions = [
            { score: 1, label: 'Needs Improvement', enabled: true },
            { score: 2, label: 'Meets Expectations', enabled: true },
            { score: 3, label: 'Exceeds Expectations', enabled: true },
            { score: 4, label: 'Outstanding', enabled: true },
        ];

        await client.query(
            'INSERT INTO rubric_indicators (id, section_id, name, description, sort_order, evidence_guidance, score_options) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [uuidv4(), section1Id, 'Automation Proficiency', 'Ability to write and maintain automated test scripts', 1, 'Provide links to PRs or test reports', JSON.stringify(scoreOptions)]
        );
        await client.query(
            'INSERT INTO rubric_indicators (id, section_id, name, description, sort_order, evidence_guidance, score_options) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [uuidv4(), section1Id, 'Bug Reporting Quality', 'Clear, reproducible bugs with detail', 2, 'Example JIRA tickets', JSON.stringify(scoreOptions)]
        );
        await client.query(
            'INSERT INTO rubric_indicators (id, section_id, name, description, sort_order, evidence_guidance, score_options) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [uuidv4(), section2Id, 'Team Collaboration', 'Effective communication with dev and product teams', 1, 'Peer feedback or meeting notes', JSON.stringify(scoreOptions)]
        );

        await client.query('COMMIT');
        console.log('Seed completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
