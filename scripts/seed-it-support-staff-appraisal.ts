import { randomUUID } from "crypto";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MISSING = "No descriptor provided in source rubric.";

type Item = { no: number; name: string; weight: number; r4: string; r3: string; r2: string; r1: string };
type Area = { name: string; items: Item[] };
type Part = { name: string; areas: Area[] };
const item = (no: number, name: string, weight: number, r4: string, r3: string, r2: string, r1: string): Item => ({ no, name, weight, r4: r4 || MISSING, r3: r3 || MISSING, r2: r2 || MISSING, r1: r1 || MISSING });

const parts: Part[] = [
  { name: "PART I — PLANNING", areas: [{ name: "A. Program Tahunan", items: [
    item(1, "Menyelaraskan visi kerja dengan visi sekolah", 50, "Merencanakan seluruh kegiatan pekerjaan sesuai visi dan misi sekolah dengan membuat rencana, melaksanakan, mengimplementasikan, dan mengevaluasi setiap kegiatan.", "Mengimplementasikan setiap kegiatan sesuai visi dan misi sekolah tanpa perencanaan.", "Membuat perencanaan kegiatan tetapi tidak mengimplementasikannya.", "Tidak membuat rencana dan tidak mengimplementasikan kegiatan sesuai visi dan misi sekolah."),
    item(2, "Membuat program kerja tahunan, bulanan, mingguan dan harian", 50, "Membuat rencana tertulis secara rinci untuk program tahunan, bulanan, mingguan dan harian, termasuk todo list yang jelas.", "Membuat rencana tertulis secara rinci untuk program tahunan, bulanan, mingguan dan harian.", "Hanya membuat beberapa item rencana tertulis untuk program tahunan, bulanan, mingguan dan harian.", "Tidak membuat rencana."),
  ]}]},
  { name: "PART II — PELAKSANAAN DAN KUALITAS KERJA", areas: [
    { name: "A. Pelaksanaan Kerja", items: [
      item(3, "Pelaksanaan maintenance rutin harian, mingguan dan bulanan", 100, "Rutinitas preventive maintenance reguler 100% terlaksana.", "Rutinitas preventive maintenance reguler 75% terlaksana.", "Rutinitas preventive maintenance reguler 50% terlaksana.", "Rutinitas preventive maintenance reguler di bawah 50% atau tidak terlaksana."),
      item(4, "Pelaksanaan jadwal piket khusus / sesuai surat tugas", 100, "Jadwal piket atau tugas non-schedule/surat tugas 100% terlaksana.", "Jadwal piket atau tugas non-schedule/surat tugas 80% terlaksana.", "Jadwal piket atau tugas non-schedule/surat tugas 50% terlaksana.", "Jadwal piket atau tugas non-schedule/surat tugas di bawah 50% terlaksana."),
      item(5, "Penyelesaian dan dokumentasi komplain secara reguler", 100, "Komplain diselesaikan tepat waktu 100% dan didokumentasikan pada checklist kegiatan harian.", "Komplain diselesaikan tepat waktu 100% tetapi tidak didokumentasikan pada checklist kegiatan harian.", "Komplain diselesaikan tepat waktu 50% dan tidak didokumentasikan pada checklist kegiatan harian.", "Komplain tidak direspons."),
      item(6, "Dokumentasi detail hardware rutin dan update", 100, "Pelaksanaan rutin dilaksanakan 100%.", "Pelaksanaan rutin dilaksanakan 80%.", "Pelaksanaan rutin dilaksanakan 60%.", "Pelaksanaan rutin dilaksanakan di bawah 50%."),
      item(7, "Update software, antivirus dan kualitas networking Lazuardi", 100, "Pelaksanaan rutin dilaksanakan 100%.", "Pelaksanaan rutin dilaksanakan 80%.", "Pelaksanaan rutin dilaksanakan 60%.", "Pelaksanaan rutin dilaksanakan di bawah 50%."),
      item(8, "Kecepatan dan ketepatan penyelesaian komplain dan maintenance sesuai target", 100, "Komplain diselesaikan tepat waktu 100% dan didokumentasikan pada checklist kegiatan harian.", "Komplain diselesaikan tepat waktu 100% tetapi tidak didokumentasikan pada checklist kegiatan harian.", "Komplain diselesaikan tepat waktu 50% dan tidak didokumentasikan pada checklist kegiatan harian.", "Komplain tidak direspons."),
      item(9, "Kecepatan dan ketepatan penyelesaian project baru sesuai target", 100, "Project diselesaikan tepat waktu 100% dan didokumentasikan pada checklist kegiatan harian.", "Project diselesaikan tepat waktu 100% tetapi tidak didokumentasikan.", "Penyelesaian hanya mencapai 50% dan tidak didokumentasikan pada checklist kegiatan harian.", "Project tidak direspons atau tidak diselesaikan."),
    ]},
    { name: "B. Kualitas Kerja", items: [
      item(10, "Kualitas / tingkat keberhasilan penyelesaian komplain dan maintenance rutin", 100, "Selesai 100% dengan kualitas baik.", "Selesai 100% dengan kualitas cukup baik.", "Selesai 100% dengan kualitas tidak baik.", "Tidak selesai sesuai target."),
      item(11, "Kualitas penyelesaian project baru", 100, "Selesai 100% dengan kualitas baik.", "Selesai 100% dengan kualitas cukup baik.", "Selesai 100% dengan kualitas tidak baik.", "Tidak selesai sesuai target."),
      item(12, "Efektivitas dan efisiensi pelaksanaan komplain, maintenance rutin dan project baru", 100, "Selesai 100% dengan kualitas baik.", "Selesai 100% dengan kualitas cukup baik.", "Selesai 100% dengan kualitas tidak baik.", "Tidak selesai sesuai target."),
      item(13, "Kualitas update software, antivirus dan networking Lazuardi", 100, "Selesai 100% dengan kualitas baik.", "Selesai 100% dengan kualitas cukup baik.", "Selesai 100% dengan kualitas tidak baik.", "Tidak selesai sesuai target."),
      item(14, "Cara kerja yang meminimalkan pemakaian sumber daya / biaya", 100, "Berinisiatif dan berusaha keras meminimalkan biaya.", "Tidak berinisiatif tetapi tetap berusaha meminimalkan biaya.", "Berinisiatif tanpa memperhitungkan biaya.", "Pasif."),
      item(15, "Menunjukkan kompetensi teknis / keahlian pada bidangnya", 100, "Menguasai 100% keahlian teknis di bidangnya.", "Menguasai 75% keahlian teknis.", "Menguasai 50% keahlian teknis.", "Tidak memiliki keahlian teknis yang memadai."),
      item(16, "Mampu menyelesaikan pekerjaan multitugas", 100, "Mampu menyelesaikan tugas reguler dan tambahan sesuai target kerja.", "Sebagian besar tugas reguler dan tambahan selesai sesuai target.", "Hanya mampu menyelesaikan tugas reguler atau tugas tambahan.", "Tidak mampu menjalankan multitugas."),
      item(17, "Memperhatikan keselamatan diri sendiri dan karyawan lainnya", 100, "Memperhatikan keselamatan diri, karyawan lain, dan lingkungan kerja.", "Memperhatikan keselamatan diri sendiri dan sebagian keselamatan pihak lain.", "Kadang-kadang memperhatikan keselamatan.", "Tidak memperhatikan keselamatan kerja."),
      item(18, "Kebiasaan bekerja dengan hati-hati serta memenuhi standar keselamatan kerja diri dan alat", 100, MISSING, MISSING, MISSING, MISSING),
      item(19, "Akurat, teliti dan hati-hati dalam melakukan pekerjaan", 100, "Tingkat akurasi, ketelitian dan kehati-hatian 100%.", "Tingkat akurasi, ketelitian dan kehati-hatian 75%.", "Tingkat akurasi, ketelitian dan kehati-hatian 50%.", "Tingkat akurasi, ketelitian dan kehati-hatian di bawah 50%."),
      item(20, "Mampu bekerja dengan pengawasan minimal", 100, "Tanpa pengawasan, pekerjaan selesai dengan baik.", "Dengan sebagian pengawasan, pekerjaan selesai dengan baik.", "Harus selalu diawasi.", "Tidak melaksanakan pekerjaan."),
      item(21, "Membantu menyelesaikan masalah pekerjaan yang dihadapi staf", 100, "Membantu dengan baik tanpa diminta (ownership 100%).", "Membantu setelah dikoordinasikan atau diminta (ownership 75%).", "Membantu jika pihak lain membantu dan setelah diminta (ownership 50%).", "Tidak membantu."),
      item(22, "Menangani masalah secara efektif", 100, "Menangani masalah secara taktis dan efektif.", "Menangani masalah tetapi kurang efektif.", "Penanganan masalah terlalu lama.", "Tidak menangani masalah."),
    ]},
    { name: "C. Pemeliharaan Perlengkapan Kerja", items: [
      item(23, "Pemeliharaan dan kerapihan workshop dan gudang", 50, "Rutin, tuntas, terawat dengan baik, dan tidak ada kendala.", "Rutin dan tuntas.", "Dilakukan secara rutin.", "Workshop dan gudang tidak terpelihara atau tidak rapi."),
      item(24, "Kerapihan penyimpanan alat-alat kerja", 100, "Tersimpan, terawat, dan pemakaiannya terawasi dengan baik.", "Tersimpan dan terawat.", "Tersimpan tetapi tidak terawat.", "Tidak tersimpan dengan baik atau sering hilang."),
      item(25, "Pemeliharaan alat-alat kerja", 100, "Tersimpan, terawat, dan pemakaiannya terawasi dengan baik.", "Tersimpan dan terawat.", "Tersimpan tetapi tidak terawat.", "Tidak tersimpan dengan baik atau sering hilang."),
    ]},
  ]},
  { name: "PART III — PROFESSIONALISM AND WORK ETHICS", areas: [
    { name: "A. Disiplin Waktu", items: [
      item(26, "Ketepatan waktu hadir di sekolah", 25, "Total keterlambatan 0–80 menit.", "Total keterlambatan 81–160 menit.", "Total keterlambatan 161–240 menit.", "Total keterlambatan lebih dari 241 menit."),
      item(27, "Kehadiran di sekolah", 25, "Tidak hadir 0–3 hari.", "Tidak hadir 4–6 hari.", "Tidak hadir 7–10 hari.", "Tidak hadir lebih dari 11 hari."),
      item(28, "Kemampuan mengelola waktu", 25, "Selalu memulai, melaksanakan, dan menyerahkan tugas tepat waktu; menggunakan waktu kerja optimal; hadir tepat waktu pada kegiatan unit dan lintas unit/sekolah.", "Memenuhi 70–80% kriteria.", "Memenuhi 60–69% kriteria.", "Memenuhi kurang dari 60% kriteria."),
    ]},
    { name: "B. Keterampilan Mengaji dan Berbahasa Inggris", items: [
      item(29, "Kemampuan mengaji", 25, "Membaca Al-Qur'an dengan tajwid dan makhraj sangat baik, lancar, tanpa kesalahan.", "Membaca Al-Qur'an dengan tajwid dan makhraj baik, lancar, dengan kesalahan minimal.", "Membaca Al-Qur'an dengan cukup baik dan cukup lancar, dengan beberapa kesalahan.", "Membaca Al-Qur'an kurang baik dan kurang lancar, dengan banyak kesalahan."),
      item(30, "Kemampuan Bahasa Inggris", 25, "Bahasa Inggris benar, lancar dan mudah dipahami kepada semua stakeholder; nilai 86–100/TOEFL >500; menginspirasi rekan.", "Bahasa Inggris dapat dipahami untuk komunikasi sehari-hari; nilai 76–85; mendukung rekan berkomunikasi dalam Bahasa Inggris.", "Jarang menggunakan Bahasa Inggris; nilai 66–75.", "Hampir tidak pernah menggunakan Bahasa Inggris; nilai di bawah 65."),
    ]},
    { name: "C. Pengembangan Diri", items: [
      item(31, "Pengembangan diri", 50, "Melakukan refleksi kualitas kerja, spiritual, sosial-emosional dan kesehatan; menyusun IDP dengan waktu, target dan cara yang jelas; mengikuti pengembangan internal dan eksternal; mengikuti pelatihan atas inisiatif sendiri yang relevan.", "Memenuhi 70–80% kriteria.", "Memenuhi 60–69% kriteria.", "Memenuhi kurang dari 60% kriteria."),
    ]},
    { name: "D. Penampilan Diri", items: [
      item(32, "Penampilan diri", 25, "Selalu hadir dengan sepatu dan penampilan rapi; rambut tertata bagi laki-laki; jilbab formal dan riasan sederhana bagi perempuan; pakaian serasi, santun, dan rapi.", "Memenuhi 70–80% kriteria.", "Memenuhi 60–69% kriteria.", "Memenuhi kurang dari 60% kriteria."),
    ]},
  ]},
  { name: "PART IV — INTERPERSONAL SKILLS AND RELATIONSHIPS", areas: [
    { name: "A. Menjalin Hubungan Baik dengan Atasan", items: [
      item(33, "Menjalin komunikasi positif dengan atasan", 50, "Selalu berkomunikasi positif dengan sopan, respek, terbuka, menerima masukan dengan baik, dan berintegritas.", "Sering berkomunikasi positif dengan sopan, suportif, terbuka, menerima masukan, dan berintegritas.", "Kadang-kadang berkomunikasi positif dengan sopan, suportif, terbuka, menerima masukan, dan berintegritas.", "Jarang berkomunikasi positif dengan sopan, suportif, terbuka, menerima masukan, dan berintegritas."),
      item(34, "Kooperatif dan suportif terhadap atasan", 50, "Kooperatif dan suportif terhadap program kepala unit; bertanggung jawab atas tugas utama; menerima tugas tambahan; menawarkan bantuan; memberi ide dan saran yang terimplementasi.", "Memenuhi 5 kriteria.", "Memenuhi 3 kriteria.", "Memenuhi 2 kriteria."),
    ]},
    { name: "B. Menjalin Hubungan Baik dengan Kolega", items: [
      item(36, "Menjalin komunikasi positif dengan kolega", 50, "Selalu berkomunikasi positif: sopan, membahas hal positif, memberi masukan tanpa menyinggung, terbuka terhadap masukan, dan berintegritas.", "Sering memenuhi kriteria komunikasi positif dengan kolega.", "Kadang-kadang memenuhi kriteria komunikasi positif dengan kolega.", "Jarang memenuhi kriteria komunikasi positif dengan kolega."),
      item(37, "Kooperatif dan suportif terhadap kolega", 50, "Selalu kooperatif, kolaboratif, suportif, menawarkan bantuan, dan memberikan ide positif.", "Kadang-kadang kooperatif, kolaboratif, suportif, menawarkan bantuan, dan memberikan ide positif.", "Jarang kooperatif, kolaboratif, suportif, menawarkan bantuan, dan memberikan ide positif.", MISSING),
      item(38, "Menjalin komunikasi positif dengan siswa", 50, "Memperlakukan siswa dengan hormat, menyapa, membantu saat dibutuhkan, dan menjaga keselamatan siswa.", "Memenuhi 3 kriteria.", "Memenuhi 2 kriteria.", "Memenuhi 1 kriteria."),
    ]},
  ]},
  { name: "PART V — DUKUNGAN TERHADAP VISI-MISI DAN BUDAYA SEKOLAH", areas: [
    { name: "A. Menerima, Mengikuti, dan Mendukung Visi-Misi-Core Value Sekolah", items: [
      item(39, "Mencerminkan pribadi yang welas asih dalam relasi di tempat kerja", 50, "Selalu mencerminkan nilai welas asih dalam kata, laku, dan karya.", "Sering mencerminkan nilai welas asih dalam kata, laku, dan karya.", "Kadang-kadang mencerminkan nilai welas asih dalam kata dan laku.", "Jarang mencerminkan nilai welas asih dalam kata dan laku."),
      item(40, "Menjaga lingkungan belajar bebas dari unsur politik dan SARA", 50, "Selalu menjaga lingkungan kerja positif tanpa membawa isu politik dan SARA dalam relasi maupun pembelajaran.", "Sering menjaga lingkungan kerja positif tanpa membawa isu politik dan SARA.", "Kadang-kadang menjaga lingkungan kerja positif tanpa membawa isu politik dan SARA.", "Jarang menjaga lingkungan kerja positif dari isu politik dan SARA."),
      item(41, "Menerima, mendukung, dan melaksanakan kebijakan sekolah", 50, "Selalu menerima kebijakan sekolah sepenuhnya dengan memahami rasionalisasinya.", "Menerima dan mendukung kebijakan sekolah sepenuhnya.", MISSING, MISSING),
    ]},
    { name: "B. Menyampaikan Keresahan dan Masalah dengan Cara yang Tepat", items: [
      item(42, "Menggunakan cara yang tepat dalam menyampaikan keresahan dan masalah", 50, "Menjaga kehormatan sekolah dengan menyampaikan masalah kepada atasan langsung melalui jalur yang tersedia, secara santun dan positif, serta tidak provokatif.", "Memenuhi 4 kriteria.", "Memenuhi 3 kriteria.", "Memenuhi 2 kriteria."),
    ]},
    { name: "C. Menjaga dan Menjunjung Tinggi Image dan Nama Baik Sekolah", items: [
      item(43, "Menjaga nama baik sekolah", 50, "Menjaga kerahasiaan dan nama baik sekolah; menjelaskan sekolah secara positif; ramah dan helpful kepada tamu; santun dan positif di media sosial.", "Memenuhi 4 kriteria.", "Memenuhi 3 kriteria.", "Memenuhi 2 kriteria."),
      item(44, "Menjadi agent of change", 50, "Memberikan kontribusi positif secara terencana, rutin, dan konsisten kepada institusi/dinas pendidikan tingkat kota, provinsi, atau nasional sesuai bidang kerja.", "Memberikan kontribusi positif secara terencana, rutin, dan konsisten kepada masyarakat/institusi sosial sesuai bidang kerja.", "Menyebarkan nilai sekolah secara insidental kepada masyarakat/institusi sosial.", "Memberikan kontribusi positif secara insidental di sekitar tempat tinggal."),
      item(45, "Memperlakukan siswa dengan hormat", 50, "Memperlakukan siswa dengan hormat, menyapa, membantu jika membutuhkan, dan menjaga keselamatan siswa (4 kriteria).", "Memenuhi 3 kriteria.", "Memenuhi 2 kriteria.", "Memenuhi 1 kriteria."),
    ]},
  ]},
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const department = (await client.query<{ id: string }>("SELECT id FROM departments WHERE name = 'IT Support' LIMIT 1")).rows[0];
    if (!department) throw new Error("IT Support department not found");
    const staffRole = (await client.query<{ id: string }>("SELECT id FROM department_roles WHERE department_id = $1 AND role = 'staff' LIMIT 1", [department.id])).rows[0];
    if (!staffRole) throw new Error("IT Support staff department role not found");

    const templateName = "IT Support Staff Performance Appraisal";
    let template = (await client.query<{ id: string }>("SELECT id FROM rubric_templates WHERE name = $1 LIMIT 1", [templateName])).rows[0];
    const templateId = template?.id ?? randomUUID();
    if (template) {
      await client.query("DELETE FROM kpi_domains WHERE template_id = $1", [templateId]);
      await client.query("UPDATE rubric_templates SET description=$1, department_id=$2, is_global=false, template_type='STAFF_APPRAISAL', is_active=true, updated_at=NOW() WHERE id=$3", ["Role-specific IT Support appraisal rubric seeded from the provided performance questionnaire.", department.id, templateId]);
    } else {
      await client.query("INSERT INTO rubric_templates (id,name,description,department_id,is_global,template_type,is_active) VALUES ($1,$2,$3,$4,false,'STAFF_APPRAISAL',true)", [templateId, templateName, "Role-specific IT Support appraisal rubric seeded from the provided performance questionnaire.", department.id]);
    }

    const domainWeight = 100 / parts.length;
    let itemCount = 0;
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p]; const domainId = randomUUID();
      await client.query("INSERT INTO kpi_domains (id,template_id,name,sort_order,weight,code) VALUES ($1,$2,$3,$4,$5,$6)", [domainId, templateId, part.name, p + 1, domainWeight, `PART${p + 1}`]);
      for (let a = 0; a < part.areas.length; a++) {
        const area = part.areas[a]; const standardId = randomUUID();
        await client.query("INSERT INTO kpi_standards (id,domain_id,template_id,name,sort_order,code) VALUES ($1,$2,$3,$4,$5,$6)", [standardId, domainId, templateId, area.name, a + 1, `P${p + 1}A${a + 1}`]);
        for (let i = 0; i < area.items.length; i++) {
          const value = area.items[i]; itemCount++;
          await client.query(`INSERT INTO kpis (id,standard_id,template_id,name,description,evidence_guidance,sort_order,code,rubric_4,rubric_3,rubric_2,rubric_1,performance_weight)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [randomUUID(), standardId, templateId, value.name, `Source item ${value.no}`, "Provide manager rationale and supporting evidence where available.", i + 1, `IT-${value.no}`, value.r4, value.r3, value.r2, value.r1, value.weight]);
        }
      }
    }

    const workflows = await client.query<{ id: string }>("SELECT id FROM workflow_definitions WHERE type='KPI_APPRAISAL'");
    let workflowId: string | null = null;
    for (const workflow of workflows.rows) {
      const steps = (await client.query<{ actor_role: string; action_type: string }>("SELECT actor_role,action_type FROM workflow_steps WHERE workflow_id=$1 ORDER BY step_order", [workflow.id])).rows;
      if (steps.length === 3 && steps[0].actor_role === "manager" && steps[0].action_type === "FILL_FORM" && steps[1].actor_role === "director" && ["REVIEW", "APPROVE"].includes(steps[1].action_type) && steps[2].actor_role === "staff" && steps[2].action_type === "ACKNOWLEDGE") { workflowId = workflow.id; break; }
    }
    if (!workflowId) {
      workflowId = randomUUID();
      await client.query("INSERT INTO workflow_definitions (id,name,type,description) VALUES ($1,$2,'KPI_APPRAISAL',$3)", [workflowId, "Manager-Led Staff Appraisal", "Manager completes the appraisal, director reviews it, and staff acknowledges the result."]);
      const steps = [["manager","FILL_FORM","Manager completes staff appraisal"],["director","REVIEW","Director reviews staff appraisal"],["staff","ACKNOWLEDGE","Staff acknowledges reviewed appraisal"]];
      for (let i = 0; i < steps.length; i++) await client.query("INSERT INTO workflow_steps (id,workflow_id,step_order,actor_role,action_type,description) VALUES ($1,$2,$3,$4,$5,$6)", [randomUUID(), workflowId, i + 1, ...steps[i]]);
    }

    await client.query("DELETE FROM role_workflow_assignments WHERE department_role_id=$1 AND rubric_id=$2", [staffRole.id, templateId]);
    await client.query("INSERT INTO role_workflow_assignments (id,department_role_id,workflow_id,rubric_id,is_active) VALUES ($1,$2,$3,$4,true)", [randomUUID(), staffRole.id, workflowId, templateId]);
    await client.query("COMMIT");
    console.log(`Seeded ${templateName}: ${parts.length} parts, ${parts.reduce((n,p)=>n+p.areas.length,0)} areas, ${itemCount} performance items.`);
    console.log("Assigned rubric to IT Support staff role and manager-led staff appraisal workflow.");
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); await pool.end(); }
}

main().catch((error) => { console.error("IT Support staff appraisal seed failed:", error); process.exit(1); });
