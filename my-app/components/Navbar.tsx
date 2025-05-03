'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NavigationMenu, NavigationMenuList, NavigationMenuItem } from '@/components/ui/navigation-menu'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [IDuser, setIDuser] = useState(null)
  const [NameUser, setNameUser] = useState(null)
  const [role, setRole] = useState(null)
  const router = useRouter()

  useEffect(() => {
    fetch('http://localhost:5001/check_auth', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => {
        setIDuser(data.id_user);
        setNameUser(data.name_user);
        setRole(data.role);
      })
      .catch(err => {
        console.error(err);
        setIDuser(null);
        setNameUser(null);
        setRole(null);
      });
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5001/logout', {
        method: 'POST',
        credentials: 'include',
      })
      localStorage.removeItem('user')
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <nav className="bg-gray-900 px-6 py-4 shadow-md flex justify-between items-center">
      <div className="text-white font-bold text-lg">Dispensing and Counseling</div>
      <NavigationMenu>
        <NavigationMenuList className="space-x-4">
          {role === 'Student' && (
            <>
            <NavigationMenuItem>
                <Link href="/numberTesting" passHref>
                  <Button variant="ghost" className="text-white">Testing</Button>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/history" passHref>
                  <Button variant="ghost" className="text-white">History</Button>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/best_score" passHref>
                  <Button variant="ghost" className="text-white">My Score</Button>
                </Link>
              </NavigationMenuItem>
            </>
          )}

          {role === 'Teacher' && (
            <>
              <NavigationMenuItem>
                <Link href="/register" passHref>
                  <Button variant="ghost" className="text-white">Register</Button>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/check-score" passHref>
                  <Button variant="ghost" className="text-white">Check Score</Button>
                </Link>
              </NavigationMenuItem>
            </>
          )}

          {/* Logout is shown for all roles */}
          {IDuser && (
            <NavigationMenuItem>
              <Button
                variant="ghost"
                className="text-white"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </NavigationMenuItem>
          )}
        </NavigationMenuList>
      </NavigationMenu>
      
      {/* Display user info */}
      {IDuser && role && (
        <p className="text-white text-sm">👋 {IDuser} ({role})</p>
      )}
    </nav>
  )
}