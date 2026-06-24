import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAutomaticPeriod(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // Semester 1: Nov-Feb
  // Nov 2024 - Feb 2025 -> Semester 1, 2024/2025
  if (month >= 11 || month <= 2) {
    let academicYear = "";
    if (month >= 11) {
      academicYear = `${year}/${year + 1}`;
    } else {
      academicYear = `${year - 1}/${year}`;
    }
    return `Semester 1, ${academicYear}`;
  }

  // Semester 2: May-Aug
  // May - Aug 2025 -> Semester 2, 2025
  if (month >= 5 && month <= 8) {
    return `Semester 2, ${year}`;
  }

  // Fallback for other months
  if (month > 2 && month < 5) return `Semester 2 Preparation, ${year}`;
  return `Annual Review ${year}`;
}
