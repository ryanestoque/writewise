import { Student } from "@/lib/hooks/use-students";

/**
 * Escapes a field for CSV according to RFC 4180:
 * - If field contains commas, quotes, or newlines, enclose in double quotes
 * - Double quotes inside are escaped with two double quotes
 */
function escapeCSVField(field: string | null | undefined): string {
  if (field === null || field === undefined) return "";
  const stringValue = String(field);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n") || stringValue.includes("\r")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportStudentsToCSV(students: Student[], filename?: string) {
  if (!students || students.length === 0) return;

  const headers = ["Student Name", "Class Section", "Parent Email", "Date Enrolled"];
  
  const rows = students.map((s) => [
    escapeCSVField(s.full_name),
    escapeCSVField(s.section),
    escapeCSVField(s.parent_email || ""),
    escapeCSVField(
      s.created_at
        ? new Date(s.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : ""
    ),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  // Include UTF-8 BOM so Excel opens special characters correctly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const dateStr = new Date().toISOString().split("T")[0];
  const safeFilename = filename
    ? filename.endsWith(".csv")
      ? filename
      : `${filename}.csv`
    : `writewise-roster-${dateStr}.csv`;

  link.setAttribute("download", safeFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
