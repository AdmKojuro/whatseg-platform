import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="text-xl text-gray-500 mt-4">Página no encontrada</p>
      <Link to="/" className="mt-6 text-brand-600 hover:text-brand-700 font-medium">Volver al inicio</Link>
    </div>
  )
}
