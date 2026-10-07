import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { CuadranteLayout } from '../layouts/CuadranteLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'

import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { MapaPage } from '../pages/MapaPage'

import AdminListPage from '../pages/admins/AdminListPage'
import AdminCreatePage from '../pages/admins/AdminCreatePage'
import AdminDetailPage from '../pages/admins/AdminDetailPage'

import ComunidadListPage from '../pages/comunidades/ComunidadListPage'
import ComunidadCreatePage from '../pages/comunidades/ComunidadCreatePage'
import ComunidadDetailPage from '../pages/comunidades/ComunidadDetailPage'

import JefeListPage from '../pages/jefes/JefeListPage'
import JefeCreatePage from '../pages/jefes/JefeCreatePage'
import JefeDetailPage from '../pages/jefes/JefeDetailPage'

import ClienteListPage from '../pages/clientes/ClienteListPage'
import ClienteDetailPage from '../pages/clientes/ClienteDetailPage'

import CuadranteListPage from '../pages/cuadrantes/CuadranteListPage'
import MiPerfilPage from '../pages/cuadrantes/MiPerfilPage'
import MisComunidadesPage from '../pages/cuadrantes/MisComunidadesPage'
import MisAlarmasPage from '../pages/cuadrantes/MisAlarmasPage'

import DispositivoListPage from '../pages/dispositivos/DispositivoListPage'
import DispositivoDetailPage from '../pages/dispositivos/DispositivoDetailPage'

import ActivacionListPage from '../pages/activaciones/ActivacionListPage'

import MqttDevicesPage from '../pages/mqtt/MqttDevicesPage'

import DespachosPage from '../pages/despacho/DespachosPage'
import GuardiaPage from '../pages/guardia/GuardiaPage'
import IncidentesPage from '../pages/incidentes/IncidentesPage'
import IncidenteDetailPage from '../pages/incidentes/IncidenteDetailPage'
import WhatsAppPage from '../pages/WhatsAppPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },

  // Cuadrante pages — own layout (no sidebar)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleGuard roles={['CUADRANTE']} />,
        children: [
          // Mi Perfil + Mis Comunidades: usan CuadranteLayout con header+nav
          {
            element: <CuadranteLayout />,
            children: [
              { path: '/cuadrantes/mi-perfil',       element: <MiPerfilPage /> },
              { path: '/cuadrantes/mis-comunidades', element: <MisComunidadesPage /> },
            ],
          },
          // Mis Alarmas: full-screen, tiene su propio header
          { path: '/cuadrantes/mis-alarmas', element: <MisAlarmasPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: '/',
            element: <DashboardPage />,
          },

          // Admins — SUPERADMIN only
          {
            element: <RoleGuard roles={['SUPERADMIN']} />,
            children: [
              { path: '/admins', element: <AdminListPage /> },
              { path: '/admins/nuevo', element: <AdminCreatePage /> },
              { path: '/admins/:id', element: <AdminDetailPage /> },
            ],
          },

          // Comunidades — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/comunidades', element: <ComunidadListPage /> },
              { path: '/comunidades/nueva', element: <ComunidadCreatePage /> },
              { path: '/comunidades/:id', element: <ComunidadDetailPage /> },
            ],
          },

          // Jefes — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/jefes', element: <JefeListPage /> },
              { path: '/jefes/nuevo', element: <JefeCreatePage /> },
              { path: '/jefes/:id', element: <JefeDetailPage /> },
            ],
          },

          // Clientes — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/clientes', element: <ClienteListPage /> },
              { path: '/clientes/:id', element: <ClienteDetailPage /> },
            ],
          },

          // Dispositivos — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/dispositivos', element: <DispositivoListPage /> },
              { path: '/dispositivos/:id', element: <DispositivoDetailPage /> },
            ],
          },

          // Activaciones — SUPERADMIN, ADMIN, MONITOR
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN', 'MONITOR']} />,
            children: [
              { path: '/activaciones', element: <ActivacionListPage /> },
            ],
          },

          // MQTT — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/mqtt-devices', element: <MqttDevicesPage /> },
            ],
          },

          // Mapa — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/mapa', element: <MapaPage /> },
            ],
          },

          // Cuadrantes management — SUPERADMIN, ADMIN
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/cuadrantes', element: <CuadranteListPage /> },
            ],
          },

          // placeholder — cuadrante pages handled outside DashboardLayout

          // Despachos
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN', 'CUADRANTE', 'COMANDANTE']} />,
            children: [
              { path: '/despacho', element: <DespachosPage /> },
            ],
          },

          // Guardia
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN', 'CUADRANTE']} />,
            children: [
              { path: '/guardia', element: <GuardiaPage /> },
            ],
          },

          // Incidentes / Línea de Tiempo Forense
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/incidentes',     element: <IncidentesPage /> },
              { path: '/incidentes/:id', element: <IncidenteDetailPage /> },
            ],
          },

          // WhatsApp Bot
          {
            element: <RoleGuard roles={['SUPERADMIN', 'ADMIN']} />,
            children: [
              { path: '/whatsapp', element: <WhatsAppPage /> },
            ],
          },

          // 404
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
