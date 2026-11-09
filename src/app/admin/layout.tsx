'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Database } from 'lucide-react';

const menu = [
  { href: '/admin/dashboard', label: '통합 대시보드', icon: LayoutDashboard },
  { href: '/admin/mentoring', label: '멘토링 관리', icon: CalendarDays },
  { href: '/admin/users', label: '사용자 관리', icon: Users },
  { href: '/admin/directory', label: '자료 관리', icon: Database },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="px-5 pt-6 pb-3"><p className="text-xs font-bold tracking-widest text-blue-600">EDUREPORT</p><p className="mt-1 text-lg font-black text-slate-900">관리자 센터</p></div>
        <nav aria-label="관리자 메뉴" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {menu.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`) || (href === '/admin/dashboard' && pathname.startsWith('/admin/projects/'));
            return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={18} />{label}</Link>;
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
