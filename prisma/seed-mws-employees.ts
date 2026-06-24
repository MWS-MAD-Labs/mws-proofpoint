/**
 * seed-mws-employees.ts
 * Import semua karyawan Millennia World School ke ProofPoint DB
 */

import bcrypt from "bcrypt";
import { createPrismaClient } from "./prisma-client.js";

const prisma = createPrismaClient();

// Data karyawan MWS dari NLSmartrack
const employees = [
  { name: "Abdullah", dept: "Kindergarten", role: "staff", designation: "Support Staff", email: "abdullah@millennia21.id" },
  { name: "Abu Bakar Ali", dept: "Junior High", role: "staff", designation: "Teacher", email: "abu@millennia21.id" },
  { name: "Adibah Hana Widjaya", dept: "Elementary", role: "staff", designation: "Staff", email: "adibah.hana@millennia21.id" },
  { name: "Adiya Herisa", dept: "Elementary", role: "staff", designation: "Staff", email: "adiya.herisa@millennia21.id" },
  { name: "Afiyanti Hardiansari", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "afiyanti.hardiansari@millennia21.id" },
  { name: "Ahmad Haikal", dept: "Elementary", role: "manager", designation: "Head Unit", email: "dodi@millennia21.id" },
  { name: "Alifananda Dhaffa Hanif Musyafa", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "dhaffa@millennia21.id" },
  { name: "Almia Ester Kristiyany Sinabang", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "almia@millennia21.id" },
  { name: "Andrean Hadinata", dept: "Junior High", role: "staff", designation: "Staff", email: "andre@millennia21.id" },
  { name: "Anggie Ayu Setya Pradini", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "anggie@millennia21.id" },
  { name: "Annisa Fitri Tanjung", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "annisa@millennia21.id" },
  { name: "Ardiansyah", dept: "Junior High", role: "staff", designation: "Support Staff", email: "ardiansyah@millennia21.id" },
  { name: "Ari Wibowo", dept: "Kindergarten", role: "admin", designation: "Staff", email: "ari.wibowo@millennia21.id" },
  { name: "Aria Wisnuwardana", dept: "Junior High", role: "manager", designation: "Head Unit", email: "aria@millennia21.id" },
  { name: "Auliya Hasanatin Suwisto", dept: "Elementary", role: "staff", designation: "Teacher", email: "alinsuwisto@millennia21.id" },
  { name: "Ayunda Primaputri", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "aprimaputri@millennia21.id" },
  { name: "Azalia Magdalena Septianti Tambunan", dept: "Kindergarten", role: "staff", designation: "Staff", email: "wina@millennia21.id" },
  { name: "Bela Kartika Sari", dept: "Elementary", role: "staff", designation: "Teacher", email: "belakartika@millennia21.id" },
  { name: "Berliana Gustina Siregar", dept: "Elementary", role: "staff", designation: "Teacher", email: "nana@millennia21.id" },
  { name: "Chantika Nur Febryanti", dept: "Elementary", role: "staff", designation: "Teacher", email: "chaca@millennia21.id" },
  { name: "Danu Irwansyah", dept: "Junior High", role: "staff", designation: "Support Staff", email: "danu@millennia21.id" },
  { name: "Denis Septian", dept: "Elementary", role: "staff", designation: "Support Staff", email: "denis@millennia21.id" },
  { name: "Derry Parmanto", dept: "Junior High", role: "staff", designation: "Staff", email: "derry@millennia21.id" },
  { name: "Devi Agriani", dept: "Elementary", role: "staff", designation: "Teacher", email: "devi.agriani@millennia21.id" },
  { name: "Devi Larasati", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "devilarasati@millennia21.id" },
  { name: "Dien Islamy", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "dien@millennia21.id" },
  { name: "Dina", dept: "Junior High", role: "staff", designation: "Support Staff", email: "dina@millennia21.id" },
  { name: "Dini Meilani Pramesti", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "dinimeilani@millennia21.id" },
  { name: "Diya Pratiwi", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "diya@millennia21.id" },
  { name: "Dona", dept: "Elementary", role: "staff", designation: "Support Staff", email: "dona@millennia21.id" },
  { name: "Fadholi Akbar", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "akbarfadholi98@millennia21.id" },
  { name: "Faisal Nur Hidayat", dept: "Kindergarten", role: "manager", designation: "Head Unit", email: "faisal@millennia21.id" },
  { name: "Faqiha Salma Achmada", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "fasa@millennia21.id" },
  { name: "Farhah Alya Nabilah", dept: "Kindergarten", role: "staff", designation: "Staff", email: "aya@millennia21.id" },
  { name: "Fayza Julia Pramesti Hapsari Prayoga", dept: "Kindergarten", role: "staff", designation: "Staff", email: "jo@millennia21.id" },
  { name: "Ferlyna Balqis", dept: "Kindergarten", role: "staff", designation: "SE Teacher", email: "ferlyna.balqis@millennia21.id" },
  { name: "Fransiska Evasari", dept: "Elementary", role: "staff", designation: "Teacher", email: "fransiskaeva@millennia21.id" },
  { name: "Gebby Rika Amdani", dept: "Elementary", role: "staff", designation: "Support Staff", email: "gebby@millennia21.id" },
  { name: "Gundah Basiswi", dept: "Elementary", role: "staff", designation: "Teacher", email: "gundah@millennia21.id" },
  { name: "Hadi", dept: "Elementary", role: "staff", designation: "Teacher", email: "hadi@millennia21.id" },
  { name: "Hana Nuzula Fajria", dept: "Kindergarten", role: "manager", designation: "Head Unit", email: "hana.fajria@millennia21.id" },
  { name: "Himawan Rizky Syaputra", dept: "Junior High", role: "staff", designation: "Teacher", email: "himawan@millennia21.id" },
  { name: "Ian Ahmad Fauzi", dept: "Junior High", role: "staff", designation: "Staff", email: "ian.ahmad@millennia21.id" },
  { name: "Iis Asifah", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "iis@millennia21.id" },
  { name: "Ika Rahayu", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "ikarahayu@millennia21.id" },
  { name: "Irawan", dept: "Junior High", role: "staff", designation: "Support Staff", email: "irawan@millennia21.id" },
  { name: "Khairul Anwar", dept: "Junior High", role: "staff", designation: "Support Staff", email: "khairul@millennia21.id" },
  { name: "Kholida Widyawati", dept: "Elementary", role: "manager", designation: "Head Unit", email: "kholida@millennia21.id" },
  { name: "Krisalyssa Esna Rehulina Tarigan", dept: "Elementary", role: "staff", designation: "Teacher", email: "alys@millennia21.id" },
  { name: "Kurnia Sandi", dept: "Elementary", role: "staff", designation: "Support Staff", email: "sandi@millennia21.id" },
  { name: "Latifah Nur Restiningtyas", dept: "Kindergarten", role: "manager", designation: "Head Unit", email: "latifah@millennia21.id" },
  { name: "Mahrukh Bashir", dept: "Junior High", role: "director", designation: "Director", email: "mahrukh@millennia21.id" },
  { name: "Maria Rosa Apriliana Jaftoran", dept: "Elementary", role: "staff", designation: "Teacher", email: "maria@millennia21.id" },
  { name: "Maulida Yunita", dept: "Junior High", role: "staff", designation: "Staff", email: "maulida.yunita@millennia21.id" },
  { name: "Muhamad Fikri Firmansyah", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "fikri@millennia21.id" },
  { name: "Muhammad Farhan Sholeh Ramadhika", dept: "Kindergarten", role: "staff", designation: "Staff", email: "muhammad.farhan@millennia21.id" },
  { name: "Muhammad Fathan Qorib", dept: "Junior High", role: "staff", designation: "Support Staff", email: "fathan.qalbi@millennia21.id" },
  { name: "Muhammad Gibran Al Wali", dept: "Junior High", role: "staff", designation: "Support Staff", email: "awal@millennia21.id" },
  { name: "Muhammad Rayhan Ananta", dept: "Junior High", role: "staff", designation: "Support Staff", email: "ananta@millennia21.id" },
  { name: "Muhammad Ubaidillah Masrur", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "ubaidillah@millennia21.id" },
  { name: "Mukron", dept: "Junior High", role: "staff", designation: "Support Staff", email: "mukron@millennia21.id" },
  { name: "Nadia", dept: "Junior High", role: "staff", designation: "Teacher", email: "nadiamws@millennia21.id" },
  { name: "Najmi Silmi Mafaza", dept: "Junior High", role: "staff", designation: "Teacher", email: "sisil@millennia21.id" },
  { name: "Nanda Citra Ryani", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "nanda@millennia21.id" },
  { name: "Nathasya Christine Prabowo", dept: "Elementary", role: "staff", designation: "Teacher", email: "nathasya@millennia21.id" },
  { name: "Nayandra Hasan Sudra", dept: "Junior High", role: "staff", designation: "Teacher", email: "nayandra@millennia21.id" },
  { name: "Nazmi Kusumawantari", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "kusumawantari@millennia21.id" },
  { name: "Ni Made Ayu Juwitasari", dept: "Elementary", role: "staff", designation: "Staff", email: "made@millennia21.id" },
  { name: "Novan Syaiful Rahman", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "novan@millennia21.id" },
  { name: "Novia Syifaputri Ramadhan", dept: "Elementary", role: "staff", designation: "Teacher", email: "novia@millennia21.id" },
  { name: "Nur Muhamad Ismail", dept: "Kindergarten", role: "staff", designation: "Staff", email: "ismail@millennia21.id" },
  { name: "Nurul Widyaningtyas Agustin", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "widya@millennia21.id" },
  { name: "Pipiet Anggreiny", dept: "Elementary", role: "staff", designation: "Teacher", email: "pipiet@millennia21.id" },
  { name: "Pricilla Cecil Leander", dept: "Elementary", role: "staff", designation: "Teacher", email: "cecil@millennia21.id" },
  { name: "Prisy Dewanti", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "prisy@millennia21.id" },
  { name: "Putri Fitriyani", dept: "Elementary", role: "staff", designation: "Teacher", email: "putri.fitriyani@millennia21.id" },
  { name: "Raditya Saputra", dept: "Elementary", role: "staff", designation: "Support Staff", email: "radit@millennia21.id" },
  { name: "Raisa Ramadhani", dept: "Elementary", role: "staff", designation: "Teacher", email: "raisa@millennia21.id" },
  { name: "Ratna Merlangen", dept: "Junior High", role: "staff", designation: "Staff", email: "ratna@millennia21.id" },
  { name: "Restia Widiasari", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "restia.widiasari@millennia21.id" },
  { name: "Reza Rizky Prayudha", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "rezarizky@millennia21.id" },
  { name: "Rifqi Satria Permana", dept: "Junior High", role: "staff", designation: "Teacher", email: "rifqi.satria@millennia21.id" },
  { name: "Rike Rahmawati", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "rike@millennia21.id" },
  { name: "Risma Ayu Angelita", dept: "Elementary", role: "staff", designation: "Teacher", email: "risma.angelita@millennia21.id" },
  { name: "Risma Galuh Pitaloka Fahdin", dept: "Elementary", role: "staff", designation: "Teacher", email: "risma.galuh@millennia21.id" },
  { name: "Rizki Amalia Fatikhah", dept: "Kindergarten", role: "staff", designation: "Staff", email: "kiki@millennia21.id" },
  { name: "Rizki Nurul Hayati", dept: "Elementary", role: "staff", designation: "Teacher", email: "rizkinurul@millennia21.id" },
  { name: "Robby Anggara", dept: "Elementary", role: "staff", designation: "Support Staff", email: "robby@millennia21.id" },
  { name: "Robby Noer Abjuny", dept: "Elementary", role: "staff", designation: "Teacher", email: "robby.noer@millennia21.id" },
  { name: "Robiatul Adawiah", dept: "Junior High", role: "staff", designation: "Support Staff", email: "robiatul@millennia21.id" },
  { name: "Rohmatulloh", dept: "Junior High", role: "staff", designation: "Support Staff", email: "rohmatulloh@millennia21.id" },
  { name: "Romasta Oryza Sativa Siagian", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "roma@millennia21.id" },
  { name: "Sarah Yuliana", dept: "Junior High", role: "manager", designation: "Head Unit", email: "sarahyuliana@millennia21.id" },
  { name: "Sayed Jilliyan", dept: "Kindergarten", role: "staff", designation: "Staff", email: "sayed.jilliyan@millennia21.id" },
  { name: "Shahrani Fatimah Azzahrah", dept: "Kindergarten", role: "manager", designation: "Head Unit", email: "rain@millennia21.id" },
  { name: "Susantika Nilasari", dept: "Junior High", role: "staff", designation: "Staff", email: "susantika@millennia21.id" },
  { name: "Tiastiningrum Nugrahanti", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "tiastiningrum@millennia21.id" },
  { name: "Tien Hadiningsih", dept: "Junior High", role: "staff", designation: "Staff", email: "hanny@millennia21.id" },
  { name: "Tri Ayu Lestari", dept: "Elementary", role: "staff", designation: "Teacher", email: "triayulestari@millennia21.id" },
  { name: "Tria Fadilla", dept: "Elementary", role: "staff", designation: "Teacher", email: "triafadilla@millennia21.id" },
  { name: "Udom Anatapong", dept: "Junior High", role: "staff", designation: "Support Staff", email: "udom@millennia21.id" },
  { name: "Vicki Aprinando", dept: "Junior High", role: "staff", designation: "Teacher", email: "vickiaprinando@millennia21.id" },
  { name: "Vickry Firmansyah", dept: "Kindergarten", role: "staff", designation: "Support Staff", email: "vickry@millennia21.id" },
  { name: "Vinka Erawati", dept: "Junior High", role: "staff", designation: "SE Teacher", email: "vinka@millennia21.id" },
  { name: "Wahyu Ramadhan", dept: "Kindergarten", role: "staff", designation: "Support Staff", email: "wahyu@millennia21.id" },
  { name: "Yeti", dept: "Kindergarten", role: "staff", designation: "Support Staff", email: "yeti@millennia21.id" },
  { name: "Yohana Setia Risli", dept: "Kindergarten", role: "staff", designation: "Teacher", email: "yohana@millennia21.id" },
  { name: "Yosafat Imanuel Parlindungan", dept: "Junior High", role: "staff", designation: "Teacher", email: "yosafat@millennia21.id" },
  { name: "Zahra Al-jamil As Sa'diyah", dept: "Elementary", role: "staff", designation: "SE Teacher", email: "zahra@millennia21.id" },
  { name: "Zavier Cloudya Mashareen", dept: "Elementary", role: "staff", designation: "Teacher", email: "oudy@millennia21.id" },
  { name: "Zolla Firmalia Rossa", dept: "Junior High", role: "staff", designation: "Teacher", email: "zolla@millennia21.id" },
];

const departments = ["Management", "Special Education", "Junior High", "Elementary", "Kindergarten"];

async function main() {
  console.log("🌱 Import karyawan MWS ke ProofPoint...");

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
if (!defaultPassword) throw new Error("Set SEED_DEFAULT_PASSWORD in .env");
const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Buat departments
  console.log("\n📦 Membuat departments...");
  const deptMap = new Map<string, string>();

  for (const deptName of departments) {
    const dept = await prisma.department.upsert({
      where: { id: deptName },
      update: { name: deptName },
      create: { name: deptName },
    });
    deptMap.set(deptName, dept.id);
    console.log(`   ✅ ${deptName}`);
  }

  // 2. Buat users
  console.log("\n👥 Membuat users...");
  let created = 0;
  let skipped = 0;

  for (const emp of employees) {
    const email = emp.email.trim().toLowerCase();
    const deptId = deptMap.get(emp.dept) ?? null;

    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash },
        create: { email, passwordHash, emailVerified: true },
      });

      await prisma.profile.upsert({
        where: { userId: user.id },
        update: { fullName: emp.name, departmentId: deptId, jobTitle: emp.designation },
        create: {
          userId: user.id,
          email,
          fullName: emp.name,
          departmentId: deptId,
          jobTitle: emp.designation,
        },
      });

      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role: emp.role as any } },
        update: {},
        create: { userId: user.id, role: emp.role as any },
      });

      created++;
    } catch (e: any) {
      console.warn(`   ⚠️  Skip ${email}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Selesai! Created: ${created}, Skipped: ${skipped}`);
  console.log("\n🔑 Default password untuk semua user: MWS@2025!");
  console.log(`   Admin login: ari.wibowo@millennia21.id / ${defaultPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
