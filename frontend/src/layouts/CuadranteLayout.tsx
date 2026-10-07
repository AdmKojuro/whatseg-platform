import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { User, Building2, Bell, LogOut } from 'lucide-react'

const navItems = [
  { to: '/cuadrantes/mi-perfil',       label: 'Mi Perfil',       icon: <User size={14} /> },
  { to: '/cuadrantes/mis-comunidades', label: 'Mis Comunidades',  icon: <Building2 size={14} /> },
  { to: '/cuadrantes/mis-alarmas',     label: 'Mis Alarmas',      icon: <Bell size={14} /> },
]

export function CuadranteLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800 px-4 h-14 flex items-center justify-between shrink-0 z-30">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-4">
          <img
            src="/whatseg_logo.webp"
            alt="WhatsEg"
            className="h-8 w-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <nav className="flex gap-0.5">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.nombre?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-200">{user?.nombre}</span>
          </div>
          <div className="w-px h-5 bg-gray-700 hidden sm:block" />
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

      {/* Content — sin padding para que MisAlarmas use todo el espacio */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
