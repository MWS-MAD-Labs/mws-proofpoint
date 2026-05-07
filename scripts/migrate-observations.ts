// scripts/migrate-observations.ts
// Script lama untuk scrape & migrasi data dari NLSmartrack via Puppeteer
// Sudah digantikan oleh seed-nlsmartrack-observations.ts yang lebih robust
// File ini dipertahankan sebagai referensi arsitektur scraping

import { PrismaClient } from '@prisma/client';
import puppeteer, { type Page } from 'puppeteer';

// ✅ FIX: hapus import path & fs yang tidak dipakai
const prisma = new PrismaClient();

interface Submission {
  id:          string;
  staffName:   string;
  rubricName:  string;
  status:      string;
  submittedAt: string;
  detailUrl:   string;
}

interface ObservationDetail {
  staffEmail:     string;
  managerEmail:   string;
  submittedAt:    string;
  acknowledgedAt: string;
  sections:       Section[];
}

interface Section {
  name:       string;
  weight:     string;
  indicators: Indicator[];
}

interface Indicator {
  name:  string;
  score: number;
  note:  string;
}

// ✅ FIX: pakai HTMLElement instead of Element untuk akses innerText

async function loginToNLSmartTrack(page: Page) {
  console.log('🔐 Login ke nlsmarttrack.com...');
  await page.goto('https://nlsmarttrack.com/');
  await new Promise(r => setTimeout(r, 2000));

  const googleButton = await page.$('button[data-oauth="google"], .google-login, a[href*="google"]');
  if (googleButton) {
    await googleButton.click();
    console.log('✅ Klik tombol Google login');
  } else {
    console.log('⚠️ Tombol Google tidak ditemukan');
  }

  console.log('⏳ Tunggu login manual jika perlu (60 detik)...');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {
    console.log('⚠️ Timeout navigasi, lanjutkan...');
  });

  console.log('✅ Login berhasil (asumsi)');
}

async function scrapeSubmissionsList(page: Page): Promise<Submission[]> {
  console.log('📥 Mengambil daftar submission...');
  await page.goto('https://nlsmarttrack.com/repositories/observationTool/submissions_list.php', {
    waitUntil: 'networkidle0',
    timeout:   30000
  });

  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
    console.log('⚠️ Table tidak ditemukan');
    return null;
  });

  // ✅ FIX: pakai (el as HTMLElement).innerText di dalam page.evaluate
  const submissions = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('td');
      return {
        id:          (cells[0] as HTMLElement)?.innerText?.trim() || '',
        staffName:   (cells[1] as HTMLElement)?.innerText?.trim() || '',
        rubricName:  (cells[2] as HTMLElement)?.innerText?.trim() || '',
        status:      (cells[3] as HTMLElement)?.innerText?.trim() || '',
        submittedAt: (cells[4] as HTMLElement)?.innerText?.trim() || '',
        detailUrl:   row.querySelector('a')?.getAttribute('href') || '',
      };
    }).filter(sub => sub.id);
  });

  console.log(`✅ Ditemukan ${submissions.length} submission`);
  return submissions;
}

async function scrapeObservationDetail(page: Page, url: string): Promise<ObservationDetail | null> {
  console.log(`🔍 Scrape detail: ${url}`);
  const fullUrl = url.startsWith('http') ? url : `https://nlsmarttrack.com/${url}`;
  await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // ✅ FIX: semua innerText pakai cast HTMLElement di dalam page.evaluate
  const detail = await page.evaluate(() => {
    const getText = (el: Element | null) => (el as HTMLElement | null)?.innerText?.trim() ?? '';

    const staffEmail   = getText(document.querySelector('.staff-email, [data-staff-email]'));
    const managerEmail = getText(document.querySelector('.manager-email, [data-manager-email]'));

    const sections: { name: string; weight: string; indicators: { name: string; score: number; note: string }[] }[] = [];
    const sectionElements = document.querySelectorAll('.section, .observation-section, .rubric-section');

    sectionElements.forEach(section => {
      const indicators: { name: string; score: number; note: string }[] = [];
      section.querySelectorAll('.indicator, .question, .criteria').forEach(ind => {
        indicators.push({
          name:  getText(ind.querySelector('.indicator-name, .question-text')),
          score: parseInt(ind.querySelector('.score, .rating')?.getAttribute('value') ?? '0'),
          note:  getText(ind.querySelector('.note, .comment, .feedback')),
        });
      });

      sections.push({
        name:       getText(section.querySelector('.section-title, h3, .title')) || 'General',
        weight:     getText(section.querySelector('.weight, .bobot')).replace(/\D/g, '') || '100',
        indicators,
      });
    });

    return {
      staffEmail,
      managerEmail,
      submittedAt:    getText(document.querySelector('.submitted-date, .date-submitted')),
      acknowledgedAt: getText(document.querySelector('.acknowledged-date, .date-acknowledged')),
      sections,
    };
  });

  if (!detail.staffEmail && !detail.managerEmail) {
    console.log('⚠️ Tidak dapat extract email');
    return null;
  }

  return detail;
}

async function migrateToNewDatabase(submissions: Submission[], details: (ObservationDetail | null)[]) {
  console.log('💾 Migrasi ke database baru...');
  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < submissions.length; i++) {
    // ✅ FIX: guard sub dan detail agar tidak possibly undefined
    const sub    = submissions[i];
    const detail = details[i];

    if (!sub) continue;

    if (!detail) {
      console.log(`❌ Skip ${sub.id}: No detail data`);
      failCount++;
      continue;
    }

    try {
      let staff = await prisma.user.findFirst({ where: { email: detail.staffEmail } });

      if (!staff && detail.staffEmail) {
        // ✅ FIX: roles pakai Prisma nested create, bukan string[]
        staff = await prisma.user.create({
          data: {
            email:        detail.staffEmail,
            passwordHash: crypto.randomUUID(), // placeholder
            roles: {
              create: [{ role: 'staff' as never }]
            },
          },
        });
        console.log(`✅ Created staff: ${detail.staffEmail}`);
      }

      let manager = await prisma.user.findFirst({ where: { email: detail.managerEmail } });

      if (!manager && detail.managerEmail) {
        manager = await prisma.user.create({
          data: {
            email:        detail.managerEmail,
            passwordHash: crypto.randomUUID(),
            roles: {
              create: [{ role: 'manager' as never }]
            },
          },
        });
        console.log(`✅ Created manager: ${detail.managerEmail}`);
      }

      if (!staff || !manager) {
        console.log(`❌ Skip ${sub.id}: Missing staff or manager`);
        failCount++;
        continue;
      }

      // ✅ FIX: prisma.rubric → prisma.rubricTemplate (nama model yang benar)
      let rubric = await prisma.rubricTemplate.findFirst({
        where: { name: sub.rubricName }
      });

      if (!rubric) {
        rubric = await prisma.rubricTemplate.create({
          data: {
            name:         sub.rubricName,
            templateType: 'CLASSROOM_OBSERVATION',
          },
        });
        console.log(`✅ Created rubric: ${sub.rubricName}`);
      }

      const existingObs = await prisma.observation.findUnique({ where: { id: sub.id } });

      if (existingObs) {
        console.log(`⚠️ Observation ${sub.id} already exists, skipping...`);
        successCount++;
        continue;
      }

      // ✅ FIX: hapus assignment ke `observation` yang tidak dipakai — langsung await
      await prisma.observation.create({
        data: {
          id:        sub.id,
          staffId:   staff.id,
          managerId: manager.id,
          rubricId:  rubric.id,
          status:    sub.status.toLowerCase() === 'acknowledged' ? 'acknowledged' :
                     sub.status.toLowerCase() === 'submitted'   ? 'submitted'    : 'draft',
          submittedAt:    detail.submittedAt    ? new Date(detail.submittedAt)    : null,
          acknowledgedAt: detail.acknowledgedAt ? new Date(detail.acknowledgedAt) : null,
        },
      });

      console.log(`✅ Migrated: ${sub.id} - ${sub.staffName}`);
      successCount++;

    } catch (error: unknown) {
      console.error(`❌ Error migrating ${sub.id}:`, error);
      failCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed:  ${failCount}`);
  console.log(`   Total:   ${submissions.length}`);
}

async function main() {
  console.log('🚀 Memulai migrasi data observasi...');

  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error: unknown) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args:     ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await loginToNLSmartTrack(page);
    await page.screenshot({ path: 'after-login.png' });
    console.log('📸 Screenshot saved: after-login.png');

    const submissions = await scrapeSubmissionsList(page);
    if (submissions.length === 0) {
      console.log('⚠️ Tidak ada submission ditemukan');
      return;
    }

    const details: (ObservationDetail | null)[] = [];
    const limit = Math.min(submissions.length, 10);

    for (let i = 0; i < limit; i++) {
      console.log(`\nProcessing ${i + 1}/${limit}...`);
      // ✅ FIX: submissions[i] possibly undefined — guard dulu
      const sub = submissions[i];
      if (!sub) continue;
      const detail = await scrapeObservationDetail(page, sub.detailUrl);
      details.push(detail);
      await new Promise(r => setTimeout(r, 2000)); // ✅ FIX: ganti waitForTimeout yang deprecated
    }

    await migrateToNewDatabase(submissions.slice(0, limit), details);
    console.log('🎉 Migrasi selesai!');

  } catch (error: unknown) {
    console.error('❌ Error during migration:', error);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);