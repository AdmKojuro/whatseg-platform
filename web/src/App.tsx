import { useState } from 'react';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppFloat from './components/ui/WhatsAppFloat';
import HeroSection from './components/sections/HeroSection';
import FeaturesSection from './components/sections/FeaturesSection';
import HowItWorksSection from './components/sections/HowItWorksSection';
import PricingSection from './components/sections/PricingSection';
import FaqSection from './components/sections/FaqSection';
import DistributorSection from './components/sections/DistributorSection';
import ContactSection from './components/sections/ContactSection';
import TerminosPage from './components/pages/TerminosPage';
import PrivacidadPage from './components/pages/PrivacidadPage';
import UsoIAPage from './components/pages/UsoIAPage';

type LegalPage = 'terminos' | 'privacidad' | 'uso-ia' | null;

export default function App() {
  const [currentPage, setCurrentPage] = useState<LegalPage>(null);

  const handleNavigate = (page: LegalPage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentPage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentPage === 'terminos') return <TerminosPage onBack={handleBack} />;
  if (currentPage === 'privacidad') return <PrivacidadPage onBack={handleBack} />;
  if (currentPage === 'uso-ia') return <UsoIAPage onBack={handleBack} />;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <DistributorSection />
        <ContactSection />
      </main>
      <Footer onNavigate={handleNavigate} />
      <WhatsAppFloat />
    </div>
  );
}
