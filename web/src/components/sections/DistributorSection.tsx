import { ArrowRight, TrendingUp, Users, Award } from 'lucide-react';
import ScrollReveal from '../ui/ScrollReveal';

const benefits = [
  { icon: TrendingUp, title: 'Ingresos recurrentes', desc: 'Comisiones mensuales por cada comunidad activa en tu cartera.' },
  { icon: Users, title: 'Soporte técnico incluido', desc: 'Te respaldamos con capacitación, materiales y soporte directo.' },
  { icon: Award, title: 'Marca propia opcional', desc: 'Ofrece la plataforma bajo tu propia marca a tus clientes.' },
];

export default function DistributorSection() {
  return (
    <section id="distribuidores" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-green-950">
          <div className="relative px-8 py-16 lg:px-16 lg:py-20">
            {/* decorative */}
            <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 translate-x-1/3 -translate-y-1/3 rounded-full bg-whatsapp/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 -translate-x-1/3 translate-y-1/3 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
              <ScrollReveal>
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-whatsapp/15 px-4 py-1.5 text-sm font-medium text-whatsapp">
                    <Award className="h-3.5 w-3.5" /> Programa de Distribuidores
                  </span>
                  <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                    ¿Quieres vender<br />
                    <span className="text-whatsapp">WhatsEg</span>?
                  </h2>
                  <p className="mt-4 text-lg text-gray-400">
                    Conviértete en distribuidor autorizado y genera ingresos recurrentes ofreciendo
                    la plataforma de seguridad más completa para comunidades residenciales en Colombia.
                  </p>
                  <a
                    href="https://wa.me/573202413815?text=Hola%2C%20quiero%20ser%20distribuidor%20de%20WhatsEg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-whatsapp px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-whatsapp/25 transition-all hover:bg-whatsapp-dark hover:shadow-xl hover:shadow-whatsapp/30"
                  >
                    Quiero ser distribuidor
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={150}>
                <div className="space-y-5">
                  {benefits.map((b, i) => {
                    const Icon = b.icon;
                    return (
                      <div key={i} className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-whatsapp/15">
                          <Icon className="h-5 w-5 text-whatsapp" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{b.title}</p>
                          <p className="mt-1 text-sm text-gray-400">{b.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
