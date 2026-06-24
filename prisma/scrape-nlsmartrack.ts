/**
 * scrape-nlsmartrack.ts
 * Milestone 6: Scrape existing data from NLSmartrack (PHP system)
 */

import fs   from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_URL    = "https://nlsmarttrack.com/repositories/observationTool";
const USERNAME    = process.env.NLSMARTRACK_USER ?? "";
const PASSWORD    = process.env.NLSMARTRACK_PASS ?? "";
const SCHOOL_VAL  = "nextlead_MillenniaWorldSchool:Millennia World School";
const OUT_FILE    = path.resolve("prisma", "nlsmartrack-data.json");

if (!USERNAME || !PASSWORD) {
  console.error("❌  Set NLSMARTRACK_USER dan NLSMARTRACK_PASS in .env");
  process.exit(1);
}

let cookieJar: string[] = [];

function getCookies(): string {
  return [...new Set(cookieJar)].join("; ");
}

function saveCookies(res: Response): void {
  const raw = res.headers.get("set-cookie");
  if (!raw) return;
  raw.split(",").forEach(c => {
    const part = c.split(";")[0].trim();
    if (part) cookieJar.push(part);
  });
}

async function login(): Promise<void> {
  // Step 1: GET login page → dapat PHPSESSID
  console.log("🔐  [1/3] Ambil session...");
  const r1 = await fetch(`${BASE_URL}/login.php`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  saveCookies(r1);
  console.log("    Cookie:", getCookies());

  // Step 2: POST selected_school → set school di session
  console.log("🔐  [2/3] Pilih Millennia World School...");
  const schoolForm = new URLSearchParams();
  schoolForm.append("selected_school", SCHOOL_VAL);

  const r2 = await fetch(`${BASE_URL}/login.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": getCookies(),
      "User-Agent": "Mozilla/5.0",
      "Referer": `${BASE_URL}/login.php`,
    },
    body: schoolForm.toString(),
    redirect: "manual",
  });
  saveCookies(r2);
  console.log("    Status school submit:", r2.status);

  // Step 3: POST login credentials ke logincode.php
  console.log("🔐  [3/3] Login dengan credentials...");
  const loginForm = new URLSearchParams();
  loginForm.append("email", USERNAME);
  loginForm.append("password", PASSWORD);

  const r3 = await fetch(`${BASE_URL}/logincode.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Cookie": getCookies(),
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${BASE_URL}/login.php`,
    },
    body: loginForm.toString(),
  });
  saveCookies(r3);

  const text = await r3.text();
  console.log("    Login response:", text.substring(0, 200));

  let result: any = {};
  try { result = JSON.parse(text); } catch { /* ok */ }

  if (result.success === false) {
    throw new Error(`Login gagal: ${result.message}`);
  }

  console.log("✅  Login berhasil! Cookies:", getCookies());
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "Cookie": getCookies(),
      "User-Agent": "Mozilla/5.0",
      "Referer": `${BASE_URL}/dashboard.php`,
    },
  });
  saveCookies(res);
  return res.text();
}

function parseTable(html: string): string[][] {
  const results: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    if (rowHtml.includes("<th")) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const text = tdMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

    if (cells.length > 0) results.push(cells);
  }

  return results;
}

async function main() {
  console.log("🌱 ═══════════════════════════════════════════");
  console.log("🌱  NLSmartrack Scraper — Milestone 6");
  console.log("🌱 ═══════════════════════════════════════════");

  await login();

  // Test dashboard
  console.log("\n🔍  Test akses dashboard...");
  const dashHtml = await fetchPage(`${BASE_URL}/dashboard.php`);
  const isLoggedIn = dashHtml.includes("Total Observations") || dashHtml.includes("Observation Forms");
  console.log(isLoggedIn ? "    ✅ Dashboard berhasil diakses!" : "    ⚠️  Belum login");
  if (!isLoggedIn) fs.writeFileSync("prisma/debug-dashboard.html", dashHtml);

  // Scrape employees
  console.log("\n👥  Scraping employees...");
  const empHtml = await fetchPage(`${BASE_URL}/all_employees.php`);
  const empRows = parseTable(empHtml);
  console.log(`    → ${empRows.length} baris`);

  const employees = empRows
    .filter(c => c.length >= 5 && c.some(x => x.includes("@")))
    .map(c => {
      const emailIdx = c.findIndex(x => x.includes("@"));
      return {
        id:          c[0] ?? "",
        name:        c[emailIdx - 1] ?? "",
        email:       c[emailIdx] ?? "",
        code:        c[emailIdx + 1] ?? "",
        designation: c[emailIdx + 2] ?? "",
        department:  c[emailIdx + 3] ?? "",
        role:        c[emailIdx + 4] ?? "",
      };
    });
  console.log(`    → ${employees.length} employees valid`);

  // Scrape observations
  console.log("\n📋  Scraping observations...");
  const obsHtml = await fetchPage(`${BASE_URL}/submissions_list.php`);
  const obsRows = parseTable(obsHtml);
  console.log(`    → ${obsRows.length} baris`);

  const observations = obsRows
    .filter(c => c.length >= 4 && !isNaN(Number(c[0])))
    .map(c => ({
      id:            c[0],
      form_name:     c[1] ?? "",
      observee_code: c[2] ?? "",
      observee_name: c[3] ?? "",
      status:        c[4] ?? "",
      feedback:      c[5] ?? "",
    }));
  console.log(`    → ${observations.length} observations valid`);

  const departments = [
    { id: "1", name: "Management" },
    { id: "2", name: "Special Education" },
    { id: "3", name: "Junior High" },
    { id: "4", name: "Elementary" },
    { id: "5", name: "Kindergarten" },
  ];

  const output = {
    scraped_at: new Date().toISOString(),
    employees,
    observations,
    departments,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n✅  Data disimpan ke: ${OUT_FILE}`);
  console.log(`    Employees   : ${employees.length}`);
  console.log(`    Observations: ${observations.length}`);
  console.log(`    Departments : ${departments.length}`);
}

main().catch(err => {
  console.error("❌  Scraping gagal:", err);
  process.exit(1);
});
