"use client";
import { useEffect, useState } from "react";

export default function CSVPreview({ url }: { url: string }) {

  const [text, setText] = useState("");

  useEffect(() => {

    async function loadCSV() {

      try {

        if (url.startsWith("blob:")) {

          const response = await fetch(url);
          const blob = await response.blob();

          const reader = new FileReader();

          reader.onload = () => {
            setText(reader.result as string);
          };

          reader.readAsText(blob);

        } else {

          const res = await fetch(url);
          const data = await res.text();
          setText(data);

        }

      } catch (err) {
        console.error("CSV preview failed:", err);
      }
    }

    loadCSV();

  }, [url]);

  return (
    <pre className="text-xs overflow-auto p-3 bg-gray-100 rounded">
      {text}
    </pre>
  );
}