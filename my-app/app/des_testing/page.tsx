'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Navbar from '@/components/Navbar';

interface HistoryItem {
    sentence: string;
    check_sent: string[];
    scoring: number[];
}

export default function HistoryPage() {
    const [data, setData] = useState<HistoryItem[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const ID_test = searchParams.get("ID_test");

    useEffect(() => {
        if (!ID_test) return;
        fetch(`http://localhost:5001/api/history_conversation/${ID_test}`)
            .then(response => response.json())
            .then((data: HistoryItem[]) => {
                setData(data);
                console.log(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, [ID_test]);

    const handleBack = () => {
        router.push('/check_score');
    };

    return (
        <>
            <Navbar />
            <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">History Conversation</h1>
                    <Button onClick={handleBack}>Back</Button>
                </div>

                <div className="rounded-md border w-full">
                    <Table className="table-fixed w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/2">Sentence</TableHead>
                                <TableHead className="w-1/2">Checklist Sentence</TableHead>
                                <TableHead className="w-[100px] text-center">Scoring</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell className="break-words whitespace-pre-wrap">{row.sentence}</TableCell>
                                    <TableCell className="break-words whitespace-pre-wrap">
                                        {Array.isArray(row.check_sent)
                                            ? row.check_sent.map((text, i) => (
                                                <div key={i}>- {text}</div>
                                            ))
                                            : <div>-</div>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {Array.isArray(row.scoring)
                                            ? row.scoring.map((score, i) => (
                                                <div key={i}>{score}</div>
                                            ))
                                            : <div>-</div>}
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