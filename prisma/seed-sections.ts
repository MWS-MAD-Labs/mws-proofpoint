// prisma/seed-sections.ts
// Standalone : npx tsx prisma/seed-sections.ts
// Via seed.ts : import { seedSections } from "./seed-sections.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const rubricData: Record<
  string,
  { sections: { name: string; weight: number; indicators: { name: string; description: string }[] }[] }
> = {
  "DETAILED CLASSROOM OBSERVATION": {
    sections: [
      { name: "Classroom Environment", weight: 20, indicators: [
        { name: "Classroom Setup",               description: "Penataan ruang kelas mendukung pembelajaran" },
        { name: "Learning Objectives Displayed", description: "Tujuan pembelajaran ditampilkan dan dapat dibaca siswa" },
        { name: "Resources Available",           description: "Bahan ajar dan sumber belajar tersedia dan mudah diakses" },
      ]},
      { name: "Lesson Delivery", weight: 40, indicators: [
        { name: "Clear Explanation",   description: "Guru menjelaskan materi dengan jelas dan terstruktur" },
        { name: "Appropriate Pacing",  description: "Kecepatan mengajar sesuai dengan kemampuan siswa" },
        { name: "Use of Examples",     description: "Guru menggunakan contoh-contoh yang relevan dan konkret" },
        { name: "Student Questioning", description: "Guru mendorong siswa untuk bertanya dan berpikir kritis" },
      ]},
      { name: "Student Engagement", weight: 25, indicators: [
        { name: "Active Participation",        description: "Siswa aktif berpartisipasi dalam kegiatan pembelajaran" },
        { name: "On-task Behavior",            description: "Siswa tetap fokus dan mengerjakan tugas yang diberikan" },
        { name: "Student-Teacher Interaction", description: "Interaksi positif antara siswa dan guru terjalin dengan baik" },
      ]},
      { name: "Assessment & Feedback", weight: 15, indicators: [
        { name: "Formative Assessment", description: "Guru melakukan penilaian formatif selama pembelajaran" },
        { name: "Feedback Quality",     description: "Guru memberikan umpan balik yang konstruktif kepada siswa" },
      ]},
    ],
  },
  "CHECKLIST FOR DIRECT INSTRUCTION": {
    sections: [
      { name: "Preparation", weight: 25, indicators: [
        { name: "Lesson Plan Ready",  description: "RPP/lesson plan telah disiapkan sebelum pembelajaran" },
        { name: "Materials Prepared", description: "Materi dan media pembelajaran sudah disiapkan" },
      ]},
      { name: "Instruction Delivery", weight: 50, indicators: [
        { name: "Opening / Set Induction", description: "Guru membuka pelajaran dengan efektif (apersepsi, motivasi)" },
        { name: "Modelling",               description: "Guru mendemonstrasikan konsep atau keterampilan secara jelas" },
        { name: "Guided Practice",         description: "Guru membimbing siswa berlatih bersama-sama" },
        { name: "Independent Practice",    description: "Siswa diberikan kesempatan berlatih secara mandiri" },
        { name: "Closure",                 description: "Guru menutup pelajaran dengan rangkuman dan refleksi" },
      ]},
      { name: "Classroom Management", weight: 25, indicators: [
        { name: "Time Management",     description: "Waktu pembelajaran dikelola dengan efisien" },
        { name: "Behavior Management", description: "Perilaku siswa dikelola dengan baik" },
      ]},
    ],
  },
  "Special Education Teacher Supervision Instrument": {
    sections: [
      { name: "Individualized Support", weight: 35, indicators: [
        { name: "IEP Implementation",        description: "Program pembelajaran individual (IEP) diimplementasikan dengan benar" },
        { name: "Adaptive Materials",        description: "Materi adaptif digunakan sesuai kebutuhan siswa" },
        { name: "Individualized Strategies", description: "Strategi individual diterapkan untuk setiap siswa berkebutuhan khusus" },
      ]},
      { name: "Inclusive Practices", weight: 35, indicators: [
        { name: "Accommodation Provided", description: "Akomodasi yang sesuai diberikan kepada siswa" },
        { name: "Positive Environment",   description: "Lingkungan belajar yang positif dan inklusif diciptakan" },
        { name: "Peer Interaction",       description: "Interaksi positif antar siswa difasilitasi" },
      ]},
      { name: "Communication & Collaboration", weight: 30, indicators: [
        { name: "Parent Communication", description: "Komunikasi dengan orang tua dilakukan secara rutin" },
        { name: "Team Collaboration",   description: "Kolaborasi dengan tim pendidikan berjalan dengan baik" },
      ]},
    ],
  },
  "CHECKLIST FOR LEARNING AND UNDERSTANDING": {
    sections: [
      { name: "Knowledge Building", weight: 40, indicators: [
        { name: "Prior Knowledge Activation", description: "Pengetahuan awal siswa diaktifkan sebelum materi baru" },
        { name: "Concept Explanation",        description: "Konsep dijelaskan dengan cara yang mudah dipahami" },
        { name: "Examples & Non-examples",    description: "Contoh dan bukan contoh digunakan untuk memperjelas konsep" },
      ]},
      { name: "Comprehension Check", weight: 35, indicators: [
        { name: "Checking for Understanding", description: "Guru secara berkala mengecek pemahaman siswa" },
        { name: "Questioning Techniques",     description: "Teknik bertanya yang efektif digunakan" },
        { name: "Student Responses",          description: "Respon siswa diperhatikan dan ditindaklanjuti" },
      ]},
      { name: "Application", weight: 25, indicators: [
        { name: "Practical Application", description: "Siswa diberi kesempatan menerapkan konsep yang dipelajari" },
        { name: "Problem Solving",        description: "Siswa dilatih memecahkan masalah menggunakan konsep baru" },
      ]},
    ],
  },
  "FOCUS ON LEARNERS – STUDENT ENGAGEMENT": {
    sections: [
      { name: "Active Learning", weight: 50, indicators: [
        { name: "Student Participation Rate", description: "Persentase siswa yang aktif berpartisipasi dalam pembelajaran" },
        { name: "Hands-on Activities",        description: "Kegiatan hands-on diberikan untuk meningkatkan keterlibatan" },
        { name: "Discussion Facilitation",    description: "Diskusi kelas difasilitasi dengan baik oleh guru" },
        { name: "Student Voice",              description: "Siswa diberi kesempatan untuk mengekspresikan pendapat mereka" },
      ]},
      { name: "Motivation & Interest", weight: 30, indicators: [
        { name: "Relevance to Real Life", description: "Materi dikaitkan dengan kehidupan nyata siswa" },
        { name: "Student Choice",         description: "Siswa diberi pilihan dalam proses pembelajaran" },
        { name: "Positive Reinforcement", description: "Penguatan positif diberikan secara konsisten" },
      ]},
      { name: "On-task Behavior", weight: 20, indicators: [
        { name: "Focus & Attention", description: "Siswa tetap fokus selama pembelajaran berlangsung" },
        { name: "Task Completion",   description: "Siswa menyelesaikan tugas yang diberikan tepat waktu" },
      ]},
    ],
  },
  "CHECKLIST FOR DIFFERENTIATION": {
    sections: [
      { name: "Content Differentiation", weight: 35, indicators: [
        { name: "Tiered Materials",         description: "Materi dibedakan berdasarkan tingkat kemampuan siswa" },
        { name: "Multiple Representations", description: "Konsep disajikan dalam berbagai representasi" },
        { name: "Varied Complexity",        description: "Tingkat kompleksitas tugas disesuaikan" },
      ]},
      { name: "Process Differentiation", weight: 35, indicators: [
        { name: "Flexible Grouping",    description: "Pengelompokan fleksibel diterapkan sesuai kebutuhan" },
        { name: "Learning Stations",    description: "Stasiun belajar digunakan untuk mengakomodasi gaya belajar berbeda" },
        { name: "Scaffolding Provided", description: "Scaffolding diberikan kepada siswa yang membutuhkan" },
      ]},
      { name: "Product Differentiation", weight: 30, indicators: [
        { name: "Varied Assessment Options", description: "Pilihan penilaian beragam ditawarkan kepada siswa" },
        { name: "Student Choice in Output",  description: "Siswa dapat memilih cara mendemonstrasikan pemahaman mereka" },
      ]},
    ],
  },
  "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING": {
    sections: [
      { name: "Group Structure", weight: 30, indicators: [
        { name: "Purposeful Grouping", description: "Pengelompokan dilakukan dengan tujuan yang jelas" },
        { name: "Clear Roles",         description: "Peran setiap anggota kelompok didefinisikan dengan jelas" },
        { name: "Group Size",          description: "Ukuran kelompok sesuai dengan aktivitas yang dilakukan" },
      ]},
      { name: "Collaboration Quality", weight: 40, indicators: [
        { name: "Peer Interaction",      description: "Interaksi antar siswa dalam kelompok berjalan produktif" },
        { name: "Accountable Talk",      description: "Siswa menggunakan bahasa akademis dalam diskusi kelompok" },
        { name: "Conflict Resolution",   description: "Perbedaan pendapat diselesaikan dengan cara yang positif" },
        { name: "Shared Responsibility", description: "Tanggung jawab dibagi secara merata dalam kelompok" },
      ]},
      { name: "Teacher Support", weight: 30, indicators: [
        { name: "Monitoring Groups",     description: "Guru memantau perkembangan setiap kelompok" },
        { name: "Targeted Intervention", description: "Guru memberikan bantuan yang tepat sasaran" },
      ]},
    ],
  },
  "CLASSROOM DISPLAY CHECKLIST": {
    sections: [
      { name: "Learning Environment", weight: 40, indicators: [
        { name: "Learning Objectives Posted",     description: "Tujuan pembelajaran dipasang dan terlihat jelas" },
        { name: "Word Wall / Vocabulary Display", description: "Kosakata kunci ditampilkan di kelas" },
        { name: "Student Work Displayed",         description: "Hasil karya siswa dipajang di kelas" },
        { name: "Classroom Rules Posted",         description: "Aturan kelas dipasang dan mudah dibaca" },
      ]},
      { name: "Organization & Aesthetics", weight: 35, indicators: [
        { name: "Cleanliness & Order",  description: "Ruang kelas bersih dan tertata rapi" },
        { name: "Displays are Current", description: "Display di kelas relevan dengan materi yang sedang dipelajari" },
        { name: "Accessible Resources", description: "Sumber belajar mudah dijangkau oleh siswa" },
      ]},
      { name: "Safety & Comfort", weight: 25, indicators: [
        { name: "Adequate Lighting",      description: "Pencahayaan ruangan memadai" },
        { name: "Comfortable Temperature",description: "Suhu ruangan nyaman untuk belajar" },
        { name: "Safe Movement Space",    description: "Ruang gerak yang aman tersedia untuk siswa" },
      ]},
    ],
  },
  "Test Observation": {
    sections: [
      { name: "Test Section", weight: 100, indicators: [
        { name: "Test Indicator 1", description: "Indikator pertama untuk testing" },
        { name: "Test Indicator 2", description: "Indikator kedua untuk testing" },
      ]},
    ],
  },
  "Lesson Preparation Walkthrough": {
    sections: [
      { name: "Planning Documents", weight: 40, indicators: [
        { name: "Lesson Plan Quality",         description: "Kualitas rencana pembelajaran yang dibuat guru" },
        { name: "Alignment to Curriculum",     description: "Kesesuaian dengan kurikulum yang berlaku" },
        { name: "Learning Objectives Clarity", description: "Kejelasan tujuan pembelajaran yang dirumuskan" },
      ]},
      { name: "Resources & Materials", weight: 35, indicators: [
        { name: "Materials Prepared",     description: "Bahan ajar telah disiapkan sebelum pembelajaran" },
        { name: "Technology Integration", description: "Teknologi diintegrasikan dalam pembelajaran jika sesuai" },
        { name: "Assessment Tools Ready", description: "Instrumen penilaian telah disiapkan" },
      ]},
      { name: "Teacher Readiness", weight: 25, indicators: [
        { name: "Content Mastery",            description: "Guru menguasai materi yang akan diajarkan" },
        { name: "Anticipation of Challenges", description: "Guru mengantisipasi tantangan yang mungkin muncul" },
      ]},
    ],
  },
  "DELIVERY OF INSTRUCTION": {
    sections: [
      { name: "Opening", weight: 15, indicators: [
        { name: "Attention Getter",            description: "Guru membuka pelajaran dengan cara yang menarik perhatian siswa" },
        { name: "Connection to Prior Learning",description: "Materi dikaitkan dengan pelajaran sebelumnya" },
      ]},
      { name: "Instruction", weight: 50, indicators: [
        { name: "Clarity of Instruction",    description: "Instruksi disampaikan dengan jelas dan mudah dipahami" },
        { name: "Use of Visual Aids",         description: "Alat bantu visual digunakan secara efektif" },
        { name: "Student Interaction",        description: "Interaksi dengan siswa terjaga selama pembelajaran" },
        { name: "Differentiated Instruction", description: "Instruksi didiferensiasi sesuai kebutuhan siswa" },
        { name: "Higher Order Thinking",      description: "Pertanyaan tingkat tinggi (HOTS) digunakan" },
      ]},
      { name: "Practice & Application", weight: 25, indicators: [
        { name: "Guided Practice",      description: "Latihan terbimbing diberikan setelah penjelasan" },
        { name: "Independent Practice", description: "Latihan mandiri diberikan untuk mengukur pemahaman" },
      ]},
      { name: "Closing", weight: 10, indicators: [
        { name: "Summary / Recap",        description: "Guru merangkum materi yang telah dipelajari" },
        { name: "Preview of Next Lesson", description: "Guru memberikan gambaran materi berikutnya" },
      ]},
    ],
  },
  "obstest": {
    sections: [
      { name: "Test Section A", weight: 50, indicators: [
        { name: "Indicator A1", description: "Test indicator pertama" },
        { name: "Indicator A2", description: "Test indicator kedua" },
      ]},
      { name: "Test Section B", weight: 50, indicators: [
        { name: "Indicator B1", description: "Test indicator ketiga" },
        { name: "Indicator B2", description: "Test indicator keempat" },
      ]},
    ],
  },
  "obsertvertest": {
    sections: [
      { name: "Observer Test Section", weight: 100, indicators: [
        { name: "Observer Indicator 1", description: "Indikator observer test pertama" },
        { name: "Observer Indicator 2", description: "Indikator observer test kedua" },
      ]},
    ],
  },
};

export async function seedSections(prisma: PrismaClient): Promise<void> {
  console.log("\n📐 [seed-sections] Mulai seeding sections & indicators...\n");

  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (const [rubricName, data] of Object.entries(rubricData)) {
    try {
      const rubric = await prisma.rubricTemplate.findFirst({
        where:   { name: rubricName },
        include: { sections: true },
      });

      if (!rubric) {
        console.log(`⚠️  Rubric tidak ditemukan: "${rubricName}" — skip`);
        skipCount++;
        continue;
      }

      if (rubric.sections.length > 0) {
        await prisma.rubricSection.deleteMany({ where: { templateId: rubric.id } });
        console.log(`🗑️  Hapus ${rubric.sections.length} section lama dari "${rubricName}"`);
      }

      // ✅ FIX: Ganti for(let i...) dengan for...of agar tidak ada possibly undefined
      let sortOrder = 0;
      for (const sectionData of data.sections) {
        sortOrder++;
        const section = await prisma.rubricSection.create({
          data: {
            id:        crypto.randomUUID(),
            templateId:rubric.id,
            name:      sectionData.name,
            weight:    sectionData.weight,
            sortOrder,
          },
        });

        let indOrder = 0;
        for (const ind of sectionData.indicators) {
          indOrder++;
          await prisma.rubricIndicator.create({
            data: {
              id:          crypto.randomUUID(),
              sectionId:   section.id,
              name:        ind.name,
              description: ind.description,
              sortOrder:   indOrder,
            },
          });
        }

        console.log(`  ✅ Section "${sectionData.name}" (${sectionData.indicators.length} indikator)`);
      }

      console.log(`✅ "${rubricName}" — ${data.sections.length} section selesai\n`);
      successCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error rubric "${rubricName}":`, message);
      errorCount++;
    }
  }

  const totalSections   = await prisma.rubricSection.count();
  const totalIndicators = await prisma.rubricIndicator.count();
  console.log(`🎉 [seed-sections] Selesai!`);
  console.log(`   ✅ Rubric berhasil : ${successCount}`);
  console.log(`   ⚠️  Skip           : ${skipCount}`);
  console.log(`   ❌ Error           : ${errorCount}`);
  console.log(`   Total sections    : ${totalSections}`);
  console.log(`   Total indicators  : ${totalIndicators}\n`);
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedSections(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}