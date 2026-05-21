"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { colorForCode } from "@/lib/fis/simulatedProvider";

export type BulkState = { done?: boolean; created?: number; linked?: number; skipped?: number; errors?: string[] };

// Flexible header → field mapping (case/space-insensitive).
const FIELD: Record<string, string> = {
  firstname: "firstName", first: "firstName", "first name": "firstName",
  lastname: "lastName", last: "lastName", "last name": "lastName", surname: "lastName",
  email: "email", "e-mail": "email",
  nationality: "nationality", nation: "nationality", country: "nationality",
  gender: "gender", sex: "gender",
  sport: "sport",
  discipline: "discipline", event: "discipline",
  dob: "dob", birthdate: "dob", "birth date": "dob", born: "dob",
  fispoints: "fisPoints", points: "fisPoints",
  fiscode: "fisCode", code: "fisCode",
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === "," || c === ";" || c === "\t") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function bulkImportAthletes(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const academyId = await requireAcademyId();
  const text = String(formData.get("csv") ?? "").trim();
  if (!text) return { done: true, errors: ["Paste some rows first."] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { done: true, errors: ["Add a header row plus at least one athlete."] };

  const header = parseCsvLine(lines[0]).map((h) => FIELD[h.toLowerCase()] ?? "");
  if (!header.includes("firstName") || !header.includes("lastName")) {
    return { done: true, errors: ["Header must include at least 'firstName' and 'lastName'."] };
  }

  let created = 0, linked = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((key, idx) => { if (key) row[key] = cells[idx] ?? ""; });

    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    if (!firstName || !lastName) { errors.push(`Row ${i + 1}: missing name`); continue; }

    const email = row.email?.trim().toLowerCase() || null;
    const sport = row.sport?.trim() || "ski";
    const dob = row.dob && !isNaN(Date.parse(row.dob)) ? new Date(row.dob) : new Date(Date.UTC(2008, 0, 1));
    const fisPoints = row.fisPoints && !isNaN(Number(row.fisPoints)) ? Number(row.fisPoints) : null;

    try {
      // Dedup by email (most reliable), else by fisCode.
      let athlete = email ? await prisma.athlete.findFirst({ where: { email } }) : null;
      if (!athlete && row.fisCode) athlete = await prisma.athlete.findUnique({ where: { fisCode: row.fisCode.trim() } });
      const isNew = !athlete;

      if (!athlete) {
        athlete = await prisma.athlete.create({
          data: {
            firstName, lastName, email, dob,
            nationality: row.nationality?.trim() || "",
            sport, discipline: row.discipline?.trim() || "",
            gender: (row.gender?.trim().toUpperCase() === "F" ? "F" : "M"),
            fisPoints, fisCode: row.fisCode?.trim() || null,
            photoColor: colorForCode(`${firstName}${lastName}${email ?? i}`),
            location: row.nationality?.trim() || null,
          },
        });
      }

      // Ensure an active enrollment in this academy.
      const existingEnr = await prisma.enrollment.findFirst({ where: { academyId, athleteId: athlete.id } });
      if (existingEnr) {
        skipped++; // already on the roster
      } else {
        await prisma.enrollment.create({ data: { academyId, athleteId: athlete.id, status: "active" } });
        if (isNew) created++; else linked++;
      }
    } catch {
      errors.push(`Row ${i + 1}: import failed`);
    }
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard");
  return { done: true, created, linked, skipped, errors };
}
