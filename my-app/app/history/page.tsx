'use client';

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
import Navbar from '@/components/Navbar';

// Define the type based on what Flask is sending
interface HistoryItem {
    date_test: string;
    score_test: number;
    name_situ: string;
}

export default function HistoryPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [fullData, setFullData] = useState<HistoryItem[]>([]);
    const [filteredData, setFilteredData] = useState<HistoryItem[]>([]);

    useEffect(() => {
        fetch('http://localhost:5001/api/history')
            .then(response => response.json())
            .then((data: HistoryItem[]) => {
                setFullData(data);
                setFilteredData(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, []);

    useEffect(() => {
        const filtered = fullData.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
        setFilteredData(filtered);
    }, [searchTerm, fullData]);

    return (
        <>
            <Navbar />

            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">History</h1>

                <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-6"
                />

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Situation</TableHead>
                                <TableHead>Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.date_test}</TableCell>
                                    <TableCell>{row.name_situ}</TableCell>
                                    <TableCell><span className="font-bold text-sm">{row.score_test}</span></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}