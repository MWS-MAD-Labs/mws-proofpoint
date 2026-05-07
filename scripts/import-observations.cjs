// scripts/import-observations.cjs
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const logger = require('winston');

// ============================================
// TESTING MODE CONFIGURATION
// ============================================
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_EMAIL = process.env.TEST_EMAIL || 'ari.wibowo@millennia21.id';
const SEND_EMAILS = process.env.SEND_EMAILS === 'true';

// ✅ Daftar email yang DIZINKAN menerima notifikasi (whitelist)
const ALLOWED_EMAILS = [
    'ari.wibowo@millennia21.id',      // Email admin
     //'manager1@millennia21.id',     // Tambah email manager
    //'manager2@millennia21.id',     // Tambah email manager lain
    //'staff@millennia21.id',        // Tambah email staff
    // Tambah email lain yang diizinkan di sini
];

// ✅ Setup Winston Logger
const loggerConfig = logger.createLogger({
    level: 'info',
    format: logger.format.combine(
        logger.format.timestamp(),
        logger.format.errors({ stack: true }),
        logger.format.json()
    ),
    defaultMeta: { service: 'import-observations' },
    transports: [
        new logger.transports.File({ filename: 'error.log', level: 'error' }),
        new logger.transports.File({ filename: 'import.log' }),
        new logger.transports.Console({
            format: logger.format.simple()
        })
    ]
});

const prisma = new PrismaClient();

// ✅ Email Configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'ari.wibowo@millennia21.id',
        pass: process.env.SMTP_PASS || 'wkbtlncdcduircpx'
    }
});

/**
 * ✅ CEK apakah email diizinkan menerima notifikasi
 */
function isEmailAllowed(email) {
    if (TEST_MODE) return true; // Test mode: semua ke email test
    return ALLOWED_EMAILS.includes(email);
}

/**
 * ✅ Send notification email dengan whitelist
 */
async function sendNotification(to, subject, html, context = {}) {
    if (!SEND_EMAILS) {
        console.log(`\n📧 [EMAIL DISABLED] Would send to: ${to}`);
        console.log(`   Subject: ${subject}`);
        return { success: true, preview: 'Email disabled' };
    }
    
    let actualTo = to;
    let isTestRedirect = false;
    
    // TEST MODE: redirect ke email test
    if (TEST_MODE) {
        actualTo = TEST_EMAIL;
        isTestRedirect = true;
        console.log(`\n🔒 [TEST MODE] Email redirected:`);
        console.log(`   Original: ${to}`);
        console.log(`   Actual: ${actualTo}`);
        console.log(`   Subject: ${subject}`);
    }
    
    // VALIDASI whitelist (kecuali test mode)
    if (!TEST_MODE && !isEmailAllowed(actualTo)) {
        console.log(`\n⚠️ [BLOCKED] Email not allowed: ${actualTo}`);
        return { success: false, blocked: true };
    }
    
    try {
        const info = await emailTransporter.sendMail({
            from: `"ProofPoint System" <${process.env.SMTP_FROM || 'noreply@smarttrack.com'}>`,
            to: actualTo,
            subject: isTestRedirect ? `[TEST] ${subject}` : subject,
            html: isTestRedirect ? `
                <div style="background: #fff3cd; padding: 10px; border: 1px solid #ffc107;">
                    <p><strong>🔒 TEST MODE</strong></p>
                    <p>Original recipient: ${to}</p>
                    <hr>
                </div>
                ${html}
            ` : html,
            replyTo: 'support@millennia21.id'
        });
        
        console.log(`\n✅ Email sent to: ${actualTo}`);
        console.log(`   Subject: ${subject}`);
        
        return info;
        
    } catch (error) {
        console.error(`\n❌ Email failed to: ${actualTo}`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * ✅ NOTIFIKASI ke ADMIN
 */
async function notifyAdmin(subject, html, metadata = {}) {
    const adminEmails = ALLOWED_EMAILS.filter(email => 
        email.includes('ari.wibowo') || email.includes('admin')
    );
    
    const results = [];
    for (const email of adminEmails) {
        const result = await sendNotification(email, subject, html, { type: 'admin' });
        results.push(result);
    }
    return results;
}

/**
 * ✅ NOTIFIKASI ke MANAGER (ketika observation dibuat)
 */
async function notifyManagerAssigned(managerEmail, observationId, staffName, rubricName) {
    const subject = `📋 New Observation Assigned: ${rubricName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head><style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style></head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📋 New Observation Assigned</h2>
                </div>
                <div class="content">
                    <p>Dear Manager,</p>
                    <p>You have been assigned to complete an observation for:</p>
                    <ul>
                        <li><strong>Staff:</strong> ${staffName}</li>
                        <li><strong>Rubric:</strong> ${rubricName}</li>
                        <li><strong>Observation ID:</strong> ${observationId}</li>
                    </ul>
                    <p>Please login to the system to fill out the observation form.</p>
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/observations/${observationId}" 
                       class="button">View Observation →</a>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated notification.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendNotification(managerEmail, subject, html, { type: 'manager', observationId });
}

/**
 * ✅ NOTIFIKASI ke STAFF (ketika observation disubmit oleh manager)
 */
async function notifyStaffAcknowledgment(staffEmail, observationId, managerName, rubricName) {
    const subject = `📋 Observation Ready for Acknowledgment: ${rubricName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head><style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style></head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📋 Observation Ready for Acknowledgment</h2>
                </div>
                <div class="content">
                    <p>Dear Staff,</p>
                    <p>Your manager <strong>${managerName}</strong> has completed an observation for you.</p>
                    <ul>
                        <li><strong>Rubric:</strong> ${rubricName}</li>
                        <li><strong>Observation ID:</strong> ${observationId}</li>
                    </ul>
                    <p>Please login to acknowledge the results.</p>
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/observations/${observationId}" 
                       class="button">Acknowledge Observation →</a>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated notification.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendNotification(staffEmail, subject, html, { type: 'staff', observationId });
}

/**
 * ✅ NOTIFIKASI ke ADMIN (ketika staff acknowledge)
 */
async function notifyAdminAcknowledged(observationId, staffName, managerName, rubricName) {
    const subject = `✅ Staff Acknowledged Observation: ${rubricName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head><style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background: #9C27B0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style></head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>✅ Staff Acknowledged Observation</h2>
                </div>
                <div class="content">
                    <p>Dear Admin,</p>
                    <p>The following observation has been acknowledged by staff:</p>
                    <ul>
                        <li><strong>Staff:</strong> ${staffName}</li>
                        <li><strong>Manager:</strong> ${managerName}</li>
                        <li><strong>Rubric:</strong> ${rubricName}</li>
                        <li><strong>Observation ID:</strong> ${observationId}</li>
                    </ul>
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/observations/${observationId}" 
                       class="button">View Observation →</a>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated notification.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await notifyAdmin(subject, html, { observationId });
}

// ============================================
// FUNGSI UTAMA IMPORT (dengan notifikasi lengkap)
// ============================================

async function importObservations() {
    loggerConfig.info('🚀 Starting observation data import...\n');
    
    const startTime = Date.now();
    let stats = {
        success: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        errors: []
    };
    
    // Tracking untuk notifikasi
    let notifiedManagers = new Set();
    let notifiedStaff = new Set();

    try {
        // Cari file JSON
        const jsonPaths = [
            path.join(process.cwd(), 'observations.json'),
            path.join(process.cwd(), 'observation.json'),
        ];

        let jsonPath = null;
        for (const p of jsonPaths) {
            if (fs.existsSync(p)) {
                jsonPath = p;
                loggerConfig.info(`✅ Found file: ${p}\n`);
                break;
            }
        }

        if (!jsonPath) {
            throw new Error('observations.json atau observation.json tidak ditemukan');
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const submissions = JSON.parse(rawData);
        stats.total = submissions.length;
        
        loggerConfig.info(`📋 Will import ${submissions.length} observations\n`);

        // Kirim notifikasi mulai
        await notifyAdmin(
            '🚀 Observation Data Import Started',
            `<h2>Import Started</h2>
             <p>Total records to import: ${submissions.length}</p>
             <p>Started at: ${new Date().toLocaleString()}</p>
             <p>You will receive another notification when import is completed.</p>`
        );

        // Proses setiap submission
        for (let i = 0; i < submissions.length; i++) {
            const sub = submissions[i];
            const observationId = String(sub.id);
            const progress = Math.round((i + 1) / submissions.length * 100);
            process.stdout.write(`\r📊 Progress: ${i + 1}/${submissions.length} (${progress}%)`);

            try {
                const exists = await prisma.observation.findUnique({
                    where: { id: observationId }
                });

                if (exists) {
                    stats.skipped++;
                    continue;
                }

                // Parse data
                const staffName = (sub.status || '').replace(/[,\s]+$/g, '').trim();
                const staffId = sub.rubricName || '';
                const rubricName = sub.staffName || 'Default Rubric';
                const status = parseStatus(sub);

                // Buat staff user
                const staffEmail = `${staffId || staffName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@millennia21.id`;
                const staffUser = await findOrCreateUser(staffEmail, staffName, 'staff');
                
                // Buat rubric
                const rubric = await findOrCreateRubric(rubricName);
                
                // Dapatkan admin sebagai manager default
                const admin = await getOrCreateAdmin();

                // Buat observation
                await createObservation(observationId, staffUser, admin, rubric, status, rubricName);
                
                stats.success++;
                
                // 🔔 KIRIM NOTIFIKASI ke MANAGER (admin sebagai manager)
                if (!notifiedManagers.has(admin.email)) {
                    await notifyManagerAssigned(admin.email, observationId, staffName, rubricName);
                    notifiedManagers.add(admin.email);
                }
                
                // 🔔 KIRIM NOTIFIKASI ke STAFF (jika status acknowledged)
                if (status === 'acknowledged' && !notifiedStaff.has(staffUser.email)) {
                    await notifyStaffAcknowledgment(staffUser.email, observationId, admin.email || 'Admin', rubricName);
                    notifiedStaff.add(staffUser.email);
                }

            } catch (error) {
                stats.failed++;
                stats.errors.push(`Failed ${observationId}: ${error.message}`);
                loggerConfig.error(`Failed ${observationId}:`, error.message);
            }
        }

        // HASIL AKHIR
        console.log('\n\n📊 IMPORT RESULTS:');
        console.log(`✅ Success: ${stats.success}`);
        console.log(`❌ Failed: ${stats.failed}`);
        console.log(`⏭️  Skipped: ${stats.skipped}`);
        console.log(`📋 Total: ${stats.total}`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Duration: ${duration}s`);

        // Kirim notifikasi selesai
        await notifyAdmin(
            '✅ Observation Data Import Completed',
            `<h2>Import Completed</h2>
             <p>Success: ${stats.success}</p>
             <p>Failed: ${stats.failed}</p>
             <p>Skipped: ${stats.skipped}</p>
             <p>Duration: ${duration}s</p>
             <p>Notified: ${notifiedManagers.size} managers, ${notifiedStaff.size} staff</p>
             ${stats.errors.length > 0 ? `<p>Errors: ${stats.errors.length}</p>` : ''}`
        );

        const totalObs = await prisma.observation.count();
        console.log(`\n🎉 Total observations in database: ${totalObs}`);

    } catch (error) {
        loggerConfig.error('🔴 CRITICAL ERROR:', error);
        await notifyAdmin('🔴 Import Failed', `<h2>Import Failed</h2><p>${error.message}</p>`);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Helper functions (sama seperti sebelumnya)
function parseStatus(submission) {
    const text = (submission.submittedAt || '').toString().toLowerCase();
    if (text.includes('acknowledged')) return 'acknowledged';
    if (text.includes('submitted')) return 'submitted';
    return 'pending';
}

async function findOrCreateUser(email, fullName, role) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) return user;
    
    return await prisma.user.create({
        data: {
            email,
            passwordHash: 'temporary_hash_change_me',
            status: 'active',
            roles: { create: { role } },
            profile: { create: { email, fullName: fullName || email.split('@')[0] } }
        }
    });
}

async function findOrCreateRubric(name) {
    let rubric = await prisma.rubricTemplate.findFirst({ where: { name } });
    if (rubric) return rubric;
    
    return await prisma.rubricTemplate.create({
        data: {
            name,
            isGlobal: true,
            sections: {
                create: {
                    name: 'General Assessment',
                    weight: 100,
                    indicators: {
                        create: [
                            { name: 'Overall Performance', sortOrder: 0 },
                            { name: 'Key Strengths', sortOrder: 1 },
                            { name: 'Areas for Development', sortOrder: 2 }
                        ]
                    }
                }
            }
        }
    });
}

async function getOrCreateAdmin() {
    let admin = await prisma.user.findFirst({
        where: { roles: { some: { role: 'admin' } } }
    });
    
    if (!admin) {
        admin = await prisma.user.create({
            data: {
                email: 'ari.wibowo@millennia21.id',
                passwordHash: 'temporary_hash_change_me',
                status: 'active',
                roles: { create: { role: 'admin' } },
                profile: { create: { email: 'ari.wibowo@millennia21.id', fullName: 'System Admin' } }
            }
        });
    }
    return admin;
}

async function createObservation(id, staff, manager, rubric, status, rubricName) {
    return await prisma.$transaction(async (tx) => {
        const obs = await tx.observation.create({
            data: {
                id,
                staffId: staff.id,
                managerId: manager.id,
                rubricId: rubric.id,
                status,
                type: 'MANAGER',
                title: rubricName,
                submittedAt: status === 'acknowledged' ? new Date() : null,
                acknowledgedAt: status === 'acknowledged' ? new Date() : null,
            }
        });
        
        // Create answers
        const answers = [];
        for (const section of rubric.sections) {
            for (const indicator of section.indicators) {
                answers.push({
                    observationId: obs.id,
                    indicatorId: indicator.id,
                    score: 0,
                    note: 'Migrated from legacy system'
                });
            }
        }
        if (answers.length) {
            await tx.observationAnswer.createMany({ data: answers });
        }
        return obs;
    });
}

// Jalankan
importObservations();