import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useContactForm } from '../../hooks/useContactForm';

export default function ContactForm() {
  const { form, loading, success, error, handleChange, handleSubmit } =
    useContactForm();

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="nombre"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Nombre
        </label>
        <input
          id="nombre"
          type="text"
          required
          value={form.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder="Tu nombre completo"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-whatsapp focus:ring-2 focus:ring-whatsapp/20"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="tu@email.com"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-whatsapp focus:ring-2 focus:ring-whatsapp/20"
        />
      </div>

      <div>
        <label
          htmlFor="telefono"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Teléfono
        </label>
        <input
          id="telefono"
          type="tel"
          required
          value={form.telefono}
          onChange={(e) => handleChange('telefono', e.target.value)}
          placeholder="+57 300 000 0000"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-whatsapp focus:ring-2 focus:ring-whatsapp/20"
        />
      </div>

      <div>
        <label
          htmlFor="mensaje"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Mensaje
        </label>
        <textarea
          id="mensaje"
          required
          rows={4}
          value={form.mensaje}
          onChange={(e) => handleChange('mensaje', e.target.value)}
          placeholder="Cuéntanos cómo podemos ayudarte..."
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-whatsapp focus:ring-2 focus:ring-whatsapp/20"
        />
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <p>Mensaje enviado correctamente. Te contactaremos pronto.</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-whatsapp/25 transition-all hover:bg-whatsapp-dark hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-5 w-5" />
            Enviar Mensaje
          </>
        )}
      </button>
    </form>
  );
}
