'use client';
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from '@/components/Navbar';

export default function Result() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const score = searchParams.get("total_score");
  const [allMiss, setAllMiss] = useState<Record<string, string[]>>({});

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
      } catch (error) {
        console.error("Error fetching all_miss:", error);
      }
    };

    fetchAllMiss();
  }, []);

  const resetScore = async () => {
    // try {
    //   const response = await fetch("http://127.0.0.1:5001/reset_score", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ score: 0 }),
    //   });

    //   if (!response.ok) {
    //     throw new Error("Failed to reset score");
    //   }

    //   console.log("Score reset to 0");
    //   router.push("/numberTesting");
    // } catch (error) {
    //   console.error("Error resetting score:", error);
    // }
    router.push("/numberTesting");
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 p-4">
        <h1 className="text-2xl font-bold">Result Page</h1>
        <p className="text-lg font-semibold">Your Score: {score}</p>

        <div className="w-full max-w-2xl bg-gray-100 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">รายการที่พลาด:</h2>
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(allMiss).map(([key, values]) => (
              <li key={key}>
                <strong>{key}</strong>: {values.join(", ")}
              </li>
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
