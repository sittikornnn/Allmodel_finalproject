'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/Navbar';

interface Item {
    ID_situ: number;
    name_situ: string;
    score: number; // Add score here
}

const NumberTestingPage = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const ID_user = searchParams.get("ID_user");
    const role_user = searchParams.get("role");

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await fetch('http://localhost:5001/items');
                const data = await res.json();

                console.log(data);

                if (res.ok) {
                    // Fetch additional score data for each item (if needed)
                    const updatedItems = await Promise.all(data.map(async (item: Item) => {
                        const scoreRes = await fetch(`http://localhost:5001/best_score/${item.ID_situ}`);
                        const scoreData = await scoreRes.json();
                        item.score = scoreData.score; // Assume score is in the response
                        return item;
                    }));

                    setItems(updatedItems);
                } else {
                    console.error('Unexpected data format:', data);
                    setError(true);
                }
            } catch (err) {
                console.error('Error fetching items:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, []);

    const handleClick = (item: Item) => {
        // alert(`Clicked on ${item.name_situ}`);
        router.push(`/tempTesting?ID_situ=${item.ID_situ}`);
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-100 p-6">
                <h1 className="text-2xl font-bold mb-6 text-center">Number Testing</h1>
        
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 24 }).map((_, index) => (
                            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 text-lg font-semibold">
                        ❌ Failed to load data.
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center text-gray-600 text-lg font-semibold">
                        ⚠️ No data found.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {items.map((item) => (
                            <Card
                                key={item.ID_situ}
                                onClick={() => handleClick(item)}
                                className="cursor-pointer hover:bg-gray-200 transition-all duration-200 h-36 flex items-center justify-center"
                            >
                                <CardContent className="w-full h-full flex items-center justify-center text-center font-medium text-lg">
                                    <div>
                                        <div>{item.name_situ}</div>
                                        <div className="text-lg text-gray-500 mt-1">
                                            Score: {item.score ?? 'N/A'} {/* Display score in green */}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default NumberTestingPage;