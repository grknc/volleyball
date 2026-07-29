import { LogoutButton } from '@/components/LogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="bg-slate-900 text-white px-6 py-3 flex gap-4 items-center">
        <span className="font-bold">Yönetim Paneli</span>
        <a href="/admin/oyuncular" className="hover:underline">Oyuncular</a>
        <a href="/admin/haftalar" className="hover:underline">Haftalar</a>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
      <div className="p-6">{children}</div>
    </div>
  );
}
