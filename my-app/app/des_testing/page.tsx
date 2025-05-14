'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Table, TableHeader, TableRow, TableHead,
    TableBody, TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Navbar from '@/components/Navbar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface HistoryItem {
    sentence: string;
    check_sent: string[];
    scoring: number[];
}

export default function HistoryPage() {
    const [data, setData] = useState<HistoryItem[]>([]);
    const [updateSuccess, setUpdateSuccess] = useState(false);  // New state for success message
    const searchParams = useSearchParams();
    const router = useRouter();
    const ID_test = searchParams.get("ID_test");
    const check_state_param = searchParams.get("check_state") || "";
    const totalScore_param = searchParams.get("totalScore") || "";

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editedCheckState, setEditedCheckState] = useState(check_state_param);
    const [editedTotalScore, setEditedTotalScore] = useState(totalScore_param);

    useEffect(() => {
        if (!ID_test) return;
        fetch(`http://localhost:5001/api/history_conversation/${ID_test}`)
            .then(response => response.json())
            .then((data: HistoryItem[]) => {
                setData(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, [ID_test]);

    const handleBack = () => {
        router.push('/check_score');
    };

    const openEditDialog = (index: number) => {
        setEditIndex(index);
        setEditedCheckState(check_state_param); // ตั้งค่าเริ่มต้น
        setIsDialogOpen(true);
    };

    const handleUpdate = () => {
        if (editIndex === null || ID_test === null) return;

        const score = parseInt(editedTotalScore) || 0;  // แปลงค่าเป็นตัวเลข
        const selected = data[editIndex];
        const checkSent = selected.check_sent;

        // ใช้ค่าเดียวสำหรับ scoring โดยไม่ต้องใช้ .map()
        const newScoring = [score];  // ส่งเป็น array ที่มีแค่ค่าเดียว

        fetch(`http://localhost:5001/api/update_history/${ID_test}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scoring: newScoring,
                check_state: editedCheckState,
            }),
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to update');
                return res.json();
            })
            .then(() => {
                const newData = [...data];
                newData[editIndex] = {
                    ...newData[editIndex],
                    scoring: newScoring,  // Update the scoring to the new value
                };
                setData(newData);
                setIsDialogOpen(false);
                setUpdateSuccess(true); // Set success state to true
                setTimeout(() => setUpdateSuccess(false), 3000); // Hide success message after 3 seconds
            })
            .catch(err => {
                console.error(err);
                alert('Update failed!');
            });
    };

    return (
        <>
            <Navbar />
            <div className="p-6">
                {/* Success message */}
                {updateSuccess && (
                    <div className="bg-green-500 text-white p-4 rounded-md mb-4">
                        <strong>Update successful!</strong>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">History Conversation</h1>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => openEditDialog(0)}
                            disabled={data.length === 0}
                        >
                            Edit
                        </Button>
                        <Button onClick={handleBack}>Back</Button>
                    </div>
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Score and Check State</DialogTitle>
                    </DialogHeader>

                    <div>
                        <label className="block mb-1 font-medium">Total Score</label>
                        <input
                            type="number"
                            value={editedTotalScore}
                            onChange={(e) => setEditedTotalScore(e.target.value)}
                            className="border p-2 w-full mb-2"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 font-medium">Check State</label>
                        <select
                            className="w-full border rounded p-2"
                            value={editedCheckState}
                            onChange={(e) => setEditedCheckState(e.target.value)}
                        >
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button onClick={handleUpdate}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}