'use client';

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import Navbar from '@/components/Navbar';
import { Info, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';

interface HistoryItem {
    ID_test: number;
    ID_user: number;
    fname_user: string;
    lname_user: string;
    name_situ: string;
    date_test: string;
    score_test: number;
}

export default function HistoryPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [fullData, setFullData] = useState<HistoryItem[]>([]);
    const [filteredData, setFilteredData] = useState<HistoryItem[]>([]);
    const router = useRouter();

    // Fetch data from Flask backend on mount
    useEffect(() => {
        fetch('http://localhost:5001/api/check_history')
            .then(response => response.json())
            .then((data: HistoryItem[]) => {
                setFullData(data);
                setFilteredData(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, []);

    // Filter data when search term changes
    useEffect(() => {
        const filtered = fullData.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
        setFilteredData(filtered);
    }, [searchTerm, fullData]);

    // Handle "See More" click
    const handleSeeMore = (item: HistoryItem) => {
        router.push(`/des_testing?ID_test=${item.ID_test}`);
    };

    // Handle Export to Excel
    const handleExport = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/export_excel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: filteredData }),
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'history_data.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    };

    return (
        <>
            <Navbar />

            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Check Score History</h1>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-1/2"
                    />
                    <Button onClick={handleExport} className="flex items-center gap-2">
                        <Download size={16} /> Export to Excel
                    </Button>
                </div>

                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID Test</TableHead>
                                <TableHead>User ID</TableHead>
                                <TableHead>First Name</TableHead>
                                <TableHead>Last Name</TableHead>
                                <TableHead>Situation</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.ID_test}</TableCell>
                                    <TableCell>{row.ID_user}</TableCell>
                                    <TableCell>{row.fname_user}</TableCell>
                                    <TableCell>{row.lname_user}</TableCell>
                                    <TableCell>{row.name_situ}</TableCell>
                                    <TableCell>{row.date_test}</TableCell>
                                    <TableCell>
                                        <span className="font-bold text-sm">{row.score_test}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            onClick={() => handleSeeMore(row)}
                                            className="flex items-center gap-1"
                                        >
                                            <Info size={16} /> See More
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}