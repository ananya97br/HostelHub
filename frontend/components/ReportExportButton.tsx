"use client";

export default function ReportExportButton({ rows }: { rows: Array<Record<string, string | number>> }) {
  function exportReport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header] ?? "")))]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dormdesk-operational-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <button type="button" onClick={exportReport} disabled={rows.length === 0} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-950 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button>;
}
