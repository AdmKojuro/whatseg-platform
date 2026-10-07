import { useState, type FormEvent } from 'react';

interface ContactFormState {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
}

interface UseContactFormReturn {
  form: ContactFormState;
  loading: boolean;
  success: boolean;
  error: string | null;
  handleChange: (field: keyof ContactFormState, value: string) => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
  resetForm: () => void;
}

const initialState: ContactFormState = {
  nombre: '',
  email: '',
  telefono: '',
  mensaje: '',
};

export function useContactForm(): UseContactFormReturn {
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof ContactFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      formData.append('email', form.email);
      formData.append('telefono', form.telefono);
      formData.append('mensaje', form.mensaje);

      const response = await fetch('/contacto.php', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al enviar el formulario');
      }

      setSuccess(true);
      setForm(initialState);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialState);
    setError(null);
    setSuccess(false);
  };

  return {
    form,
    loading,
    success,
    error,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
