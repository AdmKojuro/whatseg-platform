import { useAuth } from '../hooks/useAuth'
import { Menu, LogOut, ChevronLeft } from 'lucide-react'

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth()

  const initial = user?.nombre?.charAt(0).toUpperCase() ?? '?'

  const roleLabel: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    ADMIN:      'Administrador',
    MONITOR:    'Monitor',
    CUADRANTE:  'Cuadrante',
    COMANDANTE: 'Comandante',
  }
  const displayRole = roleLabel[user?.rol ?? ''] ?? user?.rol ?? ''

  return (
    <header className="bg-gray-950 border-b border-gray-800 px-4 md:px-6 h-14 flex items-center justify-between shrink-0">

      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="md:hidden text-gray-400 hover:text-white transition-colors"
      >
        <Menu size={20} />
      </button>
      <div className="hidden md:block" />{/* spacer so flex justify-between works */}

      {/* Right: ← Módulos + avatar + name + Salir */}
      <div className="flex items-center gap-2">

        {/* ← Módulos */}
        <a
          href="/modulos"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 bg-gray-800/60 hover:bg-gray-700/60 px-3 py-1.5 rounded-lg transition-all font-medium"
        >
          <ChevronLeft size={13} />
          Módulos
        </a>

        <div className="w-px h-5 bg-gray-700 hidden sm:block mx-1" />

        {/* Avatar circle */}
        <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none">
          {initial}
        </div>

        {/* Role label */}
        <span className="hidden sm:inline text-sm font-medium text-gray-200">
          {displayRole}
        </span>

        <div className="w-px h-5 bg-gray-700 hidden sm:block mx-1" />

        {/* Salir */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors font-medium"
          title="Cerrar sesión"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
