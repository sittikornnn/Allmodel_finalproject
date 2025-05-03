'use client';

import { useSearchParams, useRouter } from "next/navigation";

export default function Result() {
  const searchParams = useSearchParams();  // To access query parameters in the URL
  const router = useRouter();              // For navigation control
  const score = searchParams.get("score"); // Retrieve the score from query params

  const resetScore = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5001/reset_score", {
        method: "POST",  // Assuming you are using POST to reset the score
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ score: 0 }), // Send the new score (reset to 0)
      });

      if (!response.ok) throw new Error("Failed to reset score");

      console.log("Score reset to 0");

      // After resetting the score, navigate back to the home page
      router.push("/");
    } catch (error) {
      console.error("Error resetting score:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold">Result Page</h1>
      <p className="text-lg font-bold">Your Score: {score}</p>

      <button
        onClick={resetScore}  // Call resetScore before navigating back
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Return to Home
      </button>
    </div>
  );
}
