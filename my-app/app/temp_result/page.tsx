'use client';
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from '@/components/Navbar';

export default function Result() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const score = searchParams.get("total_score");
  const [allMiss, setAllMiss] = useState<Record<string, string[]>>({});
  const [summary, setSummary] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllMiss = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5001/all_miss");
        if (!response.ok) {
          throw new Error("Failed to fetch all_miss");
        }

        const data = await response.json();
        setAllMiss(data.textmiss);
        console.log("Fetched all_miss:", data.textmiss);
        const summaryResult = summarizeMisses(data.textmiss);
        setSummary(summaryResult);
      } catch (error) {
        console.error("Error fetching all_miss:", error);
      }
    };

    fetchAllMiss();
  }, []);

  const categoryMap: Record<string, string> = {
    "ความแรง": "ปริมาณยา",
    "ขนาด": "ขนาดยา",
    "จำนวน": "จำนวนที่ให้",
    "ใช้สำหรับ": "สรรพคุณ",
    "รับประทาน": "วิธีการใช้ยา",
    "ก่อนอาหาร": "ช่วงเวลาการรับประทาน",
    "หลังอาหาร": "ช่วงเวลาการรับประทาน",
  };

  const summarizeMisses = (missData: Record<string, string[]>) => {
    const summary: Record<string, Set<string>> = {};

    for (const [phrase, drugs] of Object.entries(missData)) {
      drugs.forEach((drug) => {
        if (!summary[drug]) summary[drug] = new Set();
        for (const keyword in categoryMap) {
          if (phrase.includes(keyword)) {
            summary[drug].add(categoryMap[keyword]);
          }
        }
      });
    }

    return Object.entries(summary).map(([drug, categories]) => {
      const items = Array.from(categories).join(" และ ");
      return `ลืมพูดเกี่ยวกับยา ${drug} โดยเฉพาะ ${items}`;
    });
  };

  const resetScore = async () => {
    router.push("/numberTesting");
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 p-4">
        <h1 className="text-2xl font-bold">Result Page</h1>
        <p className="text-lg font-semibold">Your Score: {score}</p>

        {/* <div className="w-full max-w-2xl bg-gray-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">
            รายการที่ลืมพูดหรือพูดผิดพลาด:
          </h2>
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(allMiss).map(([key, values]) => (
              <li key={key}>
                ลืมพูดหรือพูดผิดพลาดของ
                <strong> {key} </strong>{" "}
                {values.map((item) => `ในยา${item}`).join(", ")}
              </li>
            ))}
          </ul>
        </div> */}

        <div className="w-full max-w-2xl bg-yellow-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">รายการที่ลืมพูดหรือพูดผิดพลาด:</h2>
          <ul className="list-disc list-inside space-y-1">
            {summary.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>

        <button
          onClick={resetScore}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          Test Again
        </button>
      </div>
    </>
  );
}