'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';

const RegisterPage = () => {
    const router = useRouter();
    const [form, setForm] = useState({
        firstname: '',
        lastname: '',
        username: '',
        password: '',
        role: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (value: string) => {
        setForm({ ...form, role: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const res = await fetch('http://localhost:5001/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });

        const data = await res.json();

        if (res.ok) {
            setSuccess(data.message);
            setForm({ firstname: '', lastname: '', username: '', password: '', role: form.role });
            //   setTimeout(() => router.push('/login'), 1500);
            setTimeout(() => setSuccess(''), 1500);
        } else {
            setError(data.message || 'Registration failed');
        }
    };

    return (
        <>
            <Navbar />
            <div className="flex min-h-screen items-center justify-center bg-gray-100">
                <Card className="w-full max-w-md">
                    <CardContent className="p-6 space-y-4">
                        <h1 className="text-center text-2xl font-bold">Register</h1>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="firstname">Firstname</Label>
                                <Input
                                    id="firstname"
                                    name="firstname"
                                    value={form.firstname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="lastname">Lastname</Label>
                                <Input
                                    id="lastname"
                                    name="lastname"
                                    value={form.lastname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="username">ID_studer / ID_teacher</Label>
                                <Input
                                    id="username"
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="password">Password (init same ID_studer / ID_teacher)</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="role">Role</Label>
                                <Select defaultValue="Student" onValueChange={handleRoleChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Student">Student</SelectItem>
                                        <SelectItem value="Teacher">Teacher</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}

                            {success && (
                                <Card className="bg-green-100 border border-green-400 text-green-800">
                                    <CardContent className="p-4 text-center">
                                        <p className="font-medium">{success}</p>
                                    </CardContent>
                                </Card>
                            )}
                            <Button type="submit" className="w-full">
                                Register
                            </Button>
                            <p className="text-center text-sm">
                                Already have an account?{' '}
                                <span
                                    className="cursor-pointer text-blue-600 underline"
                                    onClick={() => router.push('/login')}
                                >
                                    Login
                                </span>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default RegisterPage;