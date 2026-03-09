/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import * as cheerio from "cheerio";

export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const lowerName = filename.toLowerCase();

  // TXT
  if (mimeType === "text/plain" || lowerName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  // JSON
  if (mimeType === "application/json" || lowerName.endsWith(".json")) {
    const json = JSON.parse(buffer.toString("utf-8"));
    return JSON.stringify(json, null, 2);
  }

  // CSV
  if (mimeType === "text/csv" || lowerName.endsWith(".csv")) {
    const records = parse(buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
    });

    return records
      .map((row: any, index: number) => {
        return `Row ${index + 1}:\n${Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")}`;
      })
      .join("\n\n");
  }

  // Excel
  if (
    mimeType.includes("sheet") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls")
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let output = "";

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      output += `Sheet: ${sheetName}\n`;

      json.forEach((row: any, index: number) => {
        output += `Row ${index + 1}:\n`;
        Object.entries(row).forEach(([key, value]) => {
          output += `${key}: ${value}\n`;
        });
        output += "\n";
      });

      output += "\n";
    });

    return output;
  }

  // HTML
  if (mimeType === "text/html" || lowerName.endsWith(".html")) {
    const $ = cheerio.load(buffer.toString("utf-8"));
    return $("body").text();
  }

  throw new Error("Unsupported file type");
}