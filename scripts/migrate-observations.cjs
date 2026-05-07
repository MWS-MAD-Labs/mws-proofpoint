// scripts/migrate-observations.cjs
const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// GANTI DENGAN CREDENTIAL PAK ARI YANG ASLI
const CREDENTIALS = {
  email: 'ari.wibowo@millennia21.id', // Ganti dengan email Pak Ari yang benar
  password: 'PASSWORD_ASLI_PAK_ARI', // Ganti dengan password aslinya
  school: 'Millennia World School' // Pilihan: 'FWS', 'FWS-IB', 'Millennia World School'
};

async function loginToNLSmartTrack(page) {
  console.log('🔐 Login ke nlsmarttrack.com...');
  await page.goto('https://nlsmarttrack.com/repositories/observationTool/submissions_list.php', {
    waitUntil: 'networkidle0'
  });
  
  await page.waitForTimeout(3000);
  
  // 1. Pilih School
  console.log(`📚 Memilih school: ${CREDENTIALS.school}`);
  const schoolSelect = await page.$('select:has(option), select[name*="school"]');
  if (schoolSelect) {
    await schoolSelect.select(CREDENTIALS.school);
    await page.waitForTimeout(1000);
  }
  
  // 2. Isi email
  console.log(`📧 Mengisi email: ${CREDENTIALS.email}`);
  const emailInput = await page.$('input[type="email"], input[name*="email"]');
  if (emailInput) {
    await emailInput.type(CREDENTIALS.email);
  }
  
  // 3. Isi password (jika ada field password)
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    console.log(`🔑 Mengisi password...`);
    await passwordInput.type(CREDENTIALS.password);
  }
  
  // 4. Klik tombol login/submit
  const loginBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login")');
  if (loginBtn) {
    await loginBtn.click();
  }
  
  // Tunggu navigasi setelah login
  console.log('⏳ Menunggu login berhasil...');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
  
  // Cek apakah login berhasil (ada table submissions)
  const hasTable = await page.$('table');
  if (hasTable) {
    console.log('✅ Login berhasil!');
    return true;
  } else {
    console.log('❌ Login gagal - tidak menemukan table submissions');
    return false;
  }
}

async function scrapeSubmissionsList(page) {
  console.log('📥 Mengambil daftar submission...');
  
  // Pastikan di URL yang benar
  const currentUrl = page.url();
  if (!currentUrl.includes('submissions_list.php')) {
    await page.goto('https://nlsmarttrack.com/repositories/observationTool/submissions_list.php', {
      waitUntil: 'networkidle0'
    });
  }
  
  await page.waitForTimeout(5000);
  
  // Screenshot untuk debugging
  await page.screenshot({ path: 'submissions-page.png' });
  console.log('📸 Screenshot disimpan: submissions-page.png');
  
  // Extract data dari table
  const submissions = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    if (tables.length === 0) return [];
    
    const rows = tables[0].querySelectorAll('tbody tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('td');
      return {
        id: cells[0]?.innerText?.trim() || '',
        staffName: cells[1]?.innerText?.trim() || '',
        rubricName: cells[2]?.innerText?.trim() || '',
        status: cells[3]?.innerText?.trim() || '',
        submittedAt: cells[4]?.innerText?.trim() || '',
        detailLink: row.querySelector('a')?.getAttribute('href') || ''
      };
    }).filter(sub => sub.id); // Filter yang punya ID
  });
  
  console.log(`✅ Ditemukan ${submissions.length} submission`);
  
  // Tampilkan sample
  if (submissions.length > 0) {
    console.log('\n📋 Sample data:');
    console.log(submissions[0]);
  }
  
  return submissions;
}

async function scrapeDetailObservation(page, detailUrl) {
  console.log(`🔍 Mengambil detail: ${detailUrl}`);
  
  const fullUrl = detailUrl.startsWith('http') 
    ? detailUrl 
    : `https://nlsmarttrack.com/repositories/observationTool/${detailUrl}`;
  
  await page.goto(fullUrl, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);
  
  const detail = await page.evaluate(() => {
    // Extract data dari halaman detail
    const staffEmail = document.querySelector('[data-staff], .staff-email')?.innerText || '';
    const managerEmail = document.querySelector('[data-manager], .manager-email')?.innerText || '';
    
    // Extract scores
    const scores = [];
    const scoreElements = document.querySelectorAll('.score, .rating, [data-score]');
    scoreElements.forEach(el => {
      scores.push({
        indicator: el.closest('.indicator')?.querySelector('.indicator-name')?.innerText || '',
        score: parseInt(el.innerText) || 0,
        note: el.closest('.indicator')?.querySelector('.note')?.innerText || ''
      });
    });
    
    return {
      staffEmail,
      managerEmail,
      submittedAt: document.querySelector('.submitted-date')?.innerText || '',
      acknowledgedAt: document.querySelector('.acknowledged-date')?.innerText || '',
      scores
    };
  });
  
  return detail;
}

async function migrateObservations(submissions, page) {
  console.log('\n💾 Memulai migrasi data...');
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    console.log(`\n[${i+1}/${submissions.length}] Processing: ${sub.id}`);
    
    try {
      // Cek apakah sudah ada di database
      const existing = await prisma.observation.findUnique({
        where: { id: sub.id }
      });
      
      if (existing) {
        console.log(`⚠️ Observation ${sub.id} sudah ada, skip`);
        successCount++;
        continue;
      }
      
      // Ambil detail jika ada link
      let detail = null;
      if (sub.detailLink) {
        detail = await scrapeDetailObservation(page, sub.detailLink);
        await page.waitForTimeout(1000); // Delay
      }
      
      // Cari atau buat user staff
      let staff = null;
      if (detail?.staffEmail) {
        staff = await prisma.user.findFirst({
          where: { email: detail.staffEmail }
        });
        
        if (!staff) {
          staff = await prisma.user.create({
            data: {
              email: detail.staffEmail,
              roles: ['staff'],
              full_name: sub.staffName
            }
          });
          console.log(`✅ Created staff: ${detail.staffEmail}`);
        }
      }
      
      // Cari admin/manager default (Pak Ari)
      const defaultManager = await prisma.user.findFirst({
        where: { email: { contains: 'ari.wibowo' } }
      });
      
      // Cari rubric
      let rubric = await prisma.rubric.findFirst({
        where: { name: sub.rubricName }
      });
      
      if (!rubric && sub.rubricName) {
        rubric = await prisma.rubric.create({
          data: {
            name: sub.rubricName,
            sections: {
              create: {
                name: 'General',
                weight: '100',
                indicators: {
                  create: [
                    { name: 'Indicator 1', description: 'From migration' }
                  ]
                }
              }
            }
          }
        });
        console.log(`✅ Created rubric: ${sub.rubricName}`);
      }
      
      // Buat observation
      const observation = await prisma.observation.create({
        data: {
          id: sub.id,
          staffId: staff?.id || defaultManager?.id || 'temp',
          managerId: defaultManager?.id || 'temp',
          rubricId: rubric?.id || 'temp',
          status: sub.status?.toLowerCase() === 'acknowledged' ? 'acknowledged' :
                  sub.status?.toLowerCase() === 'submitted' ? 'submitted' : 'draft',
          submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : null,
        }
      });
      
      console.log(`✅ Migrated: ${sub.id} - ${sub.staffName}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error: ${sub.id}`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n📊 HASIL MIGRASI:`);
  console.log(`✅ Berhasil: ${successCount}`);
  console.log(`❌ Gagal: ${failCount}`);
  console.log(`📋 Total: ${submissions.length}`);
}

async function main() {
  console.log('🚀 Memulai migrasi data dari nlsmarttrack.com...');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Buka browser
    const browser = await puppeteer.launch({ 
      headless: false,  // false biar keliatan proses login
      defaultViewport: null,
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Login
    const loginSuccess = await loginToNLSmartTrack(page);
    if (!loginSuccess) {
      console.log('❌ Login gagal. Silakan cek credentials.');
      console.log('Tips: Buka browser manual, login dulu, lalu copy cookies');
      await browser.close();
      return;
    }
    
    // Ambil data submissions
    const submissions = await scrapeSubmissionsList(page);
    
    if (submissions.length === 0) {
      console.log('⚠️ Tidak ada data submission ditemukan!');
      console.log('Pastikan:');
      console.log('1. Login berhasil');
      console.log('2. Ada data observasi di platform');
      await browser.close();
      return;
    }
    
    // Migrasi data
    await migrateObservations(submissions, page);
    
    await browser.close();
    
    // Tampilkan hasil akhir
    const totalObservations = await prisma.observation.count();
    console.log(`\n🎉 Selesai! Total observations di database: ${totalObservations}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan
main();