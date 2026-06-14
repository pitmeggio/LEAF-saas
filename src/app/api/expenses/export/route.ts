import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import { splitVat, toCsv } from "@/lib/accounting";

// Accountant CSV export — admin only. One row per expense for the chosen
// period, with the full accounting breakdown (account code, VAT rate, net, VAT,
// gross, supplier, payment, status). This is the file the regnskapsfører /
// commercialista imports — the thing that lets the academy drop PowerOffice.
export async function GET(request: Request) {
  const s = await getSession();
  if (!s?.isAdmin) return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  let academyId: string;
  try {
    academyId = await requireAcademyId();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(`${toStr}T23:59:59`) : null;

  const expenses = await prisma.expense.findMany({
    where: { academyId },
    include: { coach: { select: { name: true } }, group: { select: { name: true } }, _count: { select: { receipts: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Effective date = expenseDate ?? createdAt. Filter to the requested window.
  const inRange = expenses.filter((e) => {
    const d = e.expenseDate ?? e.createdAt;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const header = [
    "Date", "Type", "Title", "Supplier", "Category", "Account", "Coach", "Group",
    "Currency", "Net", "VAT rate %", "VAT", "Gross", "Payment", "Status", "Receipts",
    "Distance km", "Rate/km", "From", "To", "Notes",
  ];
  const rows = inRange.map((e) => {
    const { net, vat } = splitVat(e.amount, e.vatRate);
    const d = (e.expenseDate ?? e.createdAt).toISOString().slice(0, 10);
    return [
      d, e.kind, e.title, e.supplier ?? "", e.category, e.accountCode ?? "",
      e.coach?.name ?? "Academy", e.group?.name ?? "", e.currency,
      net, e.vatRate ?? 0, vat, e.amount, e.paymentMethod ?? "", e.status, e._count.receipts,
      e.distanceKm ?? "", e.ratePerKmCents != null ? (e.ratePerKmCents / 100).toFixed(2) : "",
      e.fromPlace ?? "", e.toPlace ?? "", (e.notes ?? "").replace(/\n/g, " "),
    ];
  });

  // Totals row.
  const totalNet = rows.reduce((sum, r) => sum + (r[9] as number), 0);
  const totalVat = rows.reduce((sum, r) => sum + (r[11] as number), 0);
  const totalGross = rows.reduce((sum, r) => sum + (r[12] as number), 0);
  const totalsRow = ["", "", "TOTAL", "", "", "", "", "", "", totalNet, "", totalVat, totalGross, "", "", "", "", "", "", "", ""];

  const csv = "﻿" + toCsv([header, ...rows, totalsRow]); // BOM for Excel UTF-8
  const fname = `leaf-expenses${fromStr ? `-${fromStr}` : ""}${toStr ? `_${toStr}` : ""}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
