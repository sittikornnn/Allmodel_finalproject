'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface User {
  ID_user: number;
  fname_user: string;
  lname_user: string;
  pw_user: string;
  role_user: string;
}

export default function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('http://localhost:5001/api/users')
      .then((res) => res.json())
      .then((data: User[]) => setUsers(data))
      .catch((err) => console.error('Failed to fetch users:', err));
  }, []);

  const filteredUsers = users.filter((user) =>
    user.fname_user.toLowerCase().includes(search.toLowerCase()) ||
    user.lname_user.toLowerCase().includes(search.toLowerCase()) ||
    user.role_user.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (id: number) => {
    const user = users.find((u) => u.ID_user === id);
    if (user) {
      setSelectedUser(user);
      setIsEditOpen(true);
    }
  };

  const handleDelete = async (id: number, fname: string, lname: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${fname} ${lname}?`);
    if (confirmDelete) {
      await fetch(`http://localhost:5001/api/users/${id}`, {
        method: 'DELETE',
      });
      setUsers(users.filter((user) => user.ID_user !== id));
    }
  };

  const handleRegisterClick = () => {
    router.push('/register');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch(`http://localhost:5001/api/users/${selectedUser.ID_user}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedUser),
      });

      if (res.ok) {
        const updatedUsers = users.map((user) =>
          user.ID_user === selectedUser.ID_user ? selectedUser : user
        );
        setUsers(updatedUsers);
        setIsEditOpen(false);
      } else {
        alert('Failed to update user');
      }
    } catch (error) {
      console.error('Edit error:', error);
    }
  };

  const handleRoleChange = (newRole: string) => {
    if (selectedUser) {
      setSelectedUser({ ...selectedUser, role_user: newRole });
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Search..."
            className="border border-gray-300 rounded px-3 py-2 w-full max-w-14xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={handleRegisterClick}
            className="ml-4 flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Register
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">First Name</th>
                <th className="p-2 border">Last Name</th>
                <th className="p-2 border">Password</th>
                <th className="p-2 border">Role</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.ID_user}>
                  <td className="p-2 border text-center">{user.ID_user}</td>
                  <td className="p-2 border">{user.fname_user}</td>
                  <td className="p-2 border">{user.lname_user}</td>
                  <td className="p-2 border">{user.pw_user}</td>
                  <td className="p-2 border">{user.role_user}</td>
                  <td className="p-2 border text-center">
                    <button
                      onClick={() => handleEdit(user.ID_user)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                    >
                      <Pencil className="h-5 w-5 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.ID_user, user.fname_user, user.lname_user)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit Dialog */}
        {isEditOpen && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Edit User</h2>
              <form onSubmit={handleEditSubmit}>
                <div>
                  <Label htmlFor="firstname">First Name</Label>
                  <input
                    type="text"
                    value={selectedUser.fname_user}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, fname_user: e.target.value })
                    }
                    className="border p-2 w-full mb-2"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastname">Last Name</Label>
                  <input
                    type="text"
                    value={selectedUser.lname_user}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, lname_user: e.target.value })
                    }
                    className="border p-2 w-full mb-2"
                    placeholder="Last Name"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <input
                    type="text"
                    value={selectedUser.pw_user}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, pw_user: e.target.value })
                    }
                    className="border p-2 w-full mb-2"
                    placeholder="Password"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={selectedUser.role_user} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}