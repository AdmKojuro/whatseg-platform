import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, Building2, Users, UserCheck, Cpu, Bell,
  Radio, Map, Shield, Grid3X3, User, AlertTriangle, LogOut, X,
  Truck, HeartPulse, Clock, MessageCircle,
} from 'lucide-react'
import type { Rol } from '../types/enums'
import { useEffect, useState } from 'react'
import { dispositivoService } from '../services/dispositivo.service'
import { jefeService } from '../services/jefe.service'
import { adminService } from '../services/admin.service'
import { mqttService } from '../services/mqtt.service'
import { comunidadService } from '../services/comunidad.service'
import { cuadranteService } from '../services/cuadrante.service'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: Rol[]
}

const navItems: NavItem[] = [
  { to: '/',             label: 'Dashboard',     icon: <LayoutDashboard size={16} />, roles: ['SUPERADMIN', 'ADMIN', 'MONITOR', 'COMANDANTE'] },
  { to: '/comunidades',  label: 'Comunidades',   icon: <Building2 size={16} />,       roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/jefes',        label: 'Jefes',         icon: <Users size={16} />,           roles: ['SUPERADMIN'] },
  { to: '/clientes',     label: 'Clientes',      icon: <UserCheck size={16} />,       roles: ['SUPERADMIN'] },
  { to: '/dispositivos', label: 'Dispositivos',  icon: <Cpu size={16} />,             roles: ['SUPERADMIN'] },
  { to: '/activaciones', label: 'Activaciones',  icon: <Bell size={16} />,            roles: ['SUPERADMIN', 'MONITOR'] },
  { to: '/mqtt-devices', label: 'MQTT',          icon: <Radio size={16} />,           roles: ['SUPERADMIN'] },
  { to: '/mapa',         label: 'Mapa',          icon: <Map size={16} />,             roles: ['SUPERADMIN'] },
  { to: '/whatsapp',    label: 'WhatsApp',      icon: <MessageCircle size={16} />,   roles: ['SUPERADMIN', 'ADMIN'] },
]

const adminItems: NavItem[] = [
  { to: '/admins',     label: 'Administradores', icon: <Shield size={16} />,    roles: ['SUPERADMIN'] },
  { to: '/cuadrantes', label: 'Cuadrantes',      icon: <Grid3X3 size={16} />,   roles: ['SUPERADMIN'] },
]

const cuadranteItems: NavItem[] = [
  { to: '/cuadrantes/mi-perfil',       label: 'Mi Perfil',        icon: <User size={16} />,          roles: ['CUADRANTE'] },
  { to: '/cuadrantes/mis-comunidades', label: 'Mis Comunidades',  icon: <Building2 size={16} />,     roles: ['CUADRANTE'] },
  { to: '/cuadrantes/mis-alarmas',     label: 'Mis Alarmas',      icon: <AlertTriangle size={16} />, roles: ['CUADRANTE'] },
]

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto text-[10px] bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center leading-none tabular-nums">
      {count}
    </span>
  )
}

export function Sidebar({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const role = user?.rol
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (role !== 'SUPERADMIN') return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLen = (r: PromiseSettledResult<any>) =>
      r.status === 'fulfilled' && Array.isArray(r.value.data) ? (r.value.data as unknown[]).length : 0

    Promise.allSettled([
      comunidadService.list(),
      jefeService.list(),
      dispositivoService.list(),
      mqttService.getDevices(),
      adminService.list(),
      cuadranteService.list(),
    ]).then(([coms, jefes, disp, mqtt, admins, cuads]) => {
      const mqttCount = mqtt.status === 'fulfilled'
        ? (mqtt.value.data as { channels?: unknown[] }[]).reduce(
            (sum, g) => sum + (g.channels?.length ?? 1), 0
          )
        : 0

      setCounts({
        '/comunidades':  getLen(coms),
        '/jefes':        getLen(jefes),
        '/dispositivos': getLen(disp),
        '/mqtt-devices': mqttCount,
        '/admins':       getLen(admins),
        '/cuadrantes':   getLen(cuads),
      })
    })
  }, [role])

  const renderItems = (items: NavItem[]) =>
    items
      .filter(item => role && item.roles.includes(role))
      .map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-surface-300 hover:bg-surface-700 hover:text-white'
            }`
          }
        >
          {item.icon}
          {item.label}
          {counts[item.to] !== undefined && counts[item.to] > 0 && (
            <CountBadge count={counts[item.to]} />
          )}
        </NavLink>
      ))

  return (
    <div className="h-full bg-surface-950 flex flex-col border-r border-surface-800">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <img
          src="/whatseg_logo.webp"
          alt="WhatsEg"
          className="h-9 w-auto object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <button onClick={onClose} className="md:hidden text-surface-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {renderItems(navItems)}

        {adminItems.some(i => role && i.roles.includes(role)) && (
          <>
            <div className="border-t border-surface-800 my-2" />
            <p className="px-3 pt-1 pb-1 text-[10px] text-surface-500 uppercase tracking-widest font-semibold">Administración</p>
            {renderItems(adminItems)}
          </>
        )}

        {cuadranteItems.some(i => role && i.roles.includes(role)) && (
          <>
            <div className="border-t border-surface-800 my-2" />
            {renderItems(cuadranteItems)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-surface-800 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-surface-800">
          <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate font-medium">{user?.nombre}</p>
            <p className="text-[11px] text-surface-400">{user?.rol}</p>
          </div>
          <button onClick={logout} className="text-surface-400 hover:text-red-400 transition-colors flex-shrink-0">
            <LogOut size={16} />
          </button>
        </div>
        <a href="https://phenlinea.online" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-[10px] text-surface-500 hover:text-surface-300 transition-colors">
          <span>Desarrollado por</span>
          <img src="/phenlinea_logo.png" alt="PHenLinea" className="h-4 w-auto" />
        </a>
      </div>
    </div>
  )
}
