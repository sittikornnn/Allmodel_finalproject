'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/Navbar';

interface Item {
  ID_situ: number;
  name_situ: string;
}

const NumberTestingPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [groupedItems, setGroupedItems] = useState<Record<string, Item[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const ID_user = searchParams.get("ID_user");
  const role_user = searchParams.get("role");

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch('http://localhost:5001/items');
        const data = await res.json();

        if (res.ok) {
          setItems(data);

          // Grouping logic
          const groups: Record<string, Item[]> = {};
          data.forEach((item: Item) => {
            const match = item.name_situ.match(/(.+?)(\d+)$/);
            if (match) {
              const base = match[1].trim();
              if (!groups[base]) groups[base] = [];
              groups[base].push(item);
            }
          });

          setGroupedItems(groups);
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
    router.push(`/testing?ID_situ=${item.ID_situ}`);
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
        ) : (
          <>
            <div className="mb-6 flex justify-center">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-4 py-2 border rounded-md text-lg"
              >
                <option value="">🔽 เลือกชื่อสถานการณ์</option>
                {Object.keys(groupedItems).map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName}
                  </option>
                ))}
              </select>
            </div>

            {selectedGroup && groupedItems[selectedGroup] ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {groupedItems[selectedGroup].map((item) => (
                  <Card
                    key={item.ID_situ}
                    onClick={() => handleClick(item)}
                    className="cursor-pointer hover:bg-gray-200 transition-all duration-200 h-24 flex items-center justify-center"
                  >
                    <CardContent className="w-full h-full flex items-center justify-center text-center font-medium text-lg">
                      {item.name_situ}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-600 text-lg font-semibold">
                ⚠️ กรุณาเลือกชื่อสถานการณ์จาก dropdown.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default NumberTestingPage;