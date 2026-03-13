"use client";
import { useEffect, useState } from "react";
import Papa from "papaparse";

export default function CSVPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][]>([]);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        let text = "";

        if (url.startsWith("blob:")) {
          const res = await fetch(url);
          const blob = await res.blob();
          text = await blob.text();
        } else {
          const res = await fetch(url);
          text = await res.text();
        }

        const parsed = Papa.parse<string[]>(text);
        setRows(parsed.data.slice(0, 5)); // show first 5 rows
      } catch (err) {
        console.error("CSV preview error:", err);
      }
    };

    loadCSV();
  }, [url]);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}