// ─── Shared Excel helpers ───────────────────────────────────────────────────
// Used by AssignRollsTab (roll/standard updates) and BulkAddTab (new students).

export const ID_KEYS = ["id", "studentid", "accountid", "stuid"];
export const ROLL_KEYS = ["rollno", "rollnumber", "roll", "newroll", "newrollno", "newrollnumber"];
export const STD_KEYS = ["standard", "std", "class", "newstandard", "newstd", "newclass"];
export const NAME_KEYS = ["name", "studentname", "fullname", "student"];

export const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

export const findCol = (row: Record<string, string>, keys: string[]): string | undefined => {
  const norm = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), String(v).trim()])
  );
  for (const key of keys) if (norm[key]) return norm[key];
  return undefined;
};

/**
 * Parses the first worksheet of an .xlsx file into an array of row objects
 * keyed by the header row's cell text.
 */
export const parseExcelFile = async (file: File): Promise<Record<string, string>[]> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("Failed to parse file. Ensure it is a valid .xlsx file.");
  }
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("No worksheets found in the file.");

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const header = headers[col];
      if (!header) return;
      let val: unknown = cell.value;
      if (val && typeof val === "object") {
        if ("text" in val) val = (val as { text: string }).text;
        else if ("result" in val) val = (val as { result: unknown }).result;
        else if (val instanceof Date) val = val.toISOString();
        else val = "";
      }
      const str = val == null ? "" : String(val).trim();
      if (str) hasValue = true;
      obj[header] = str;
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
};

/**
 * Downloads an .xlsx template file built from the given columns/rows.
 */
export const downloadExcelTemplate = async (
  filename: string,
  columns: { header: string; key: string; width: number }[],
  rows: Record<string, string | number>[]
) => {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.columns = columns;
  rows.forEach((row) => ws.addRow(row));
  ws.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};