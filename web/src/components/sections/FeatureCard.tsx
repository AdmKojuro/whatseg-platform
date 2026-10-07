import {
  MessageCircle,
  Volume2,
  Camera,
  Bell,
  Users,
  Cpu,
  LayoutDashboard,
  MapPin,
  Siren,
  Mic,
  Brain,
  Globe,
  Cctv,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import type { Feature } from '../../data/features';

const iconMap: Record<string, LucideIcon> = {
  MessageCircle,
  Volume2,
  Camera,
  Bell,
  Users,
  Cpu,
  LayoutDashboard,
  MapPin,
  Siren,
  Mic,
  Brain,
  Globe,
  Cctv,
  Settings2,
};

interface FeatureCardProps {
  feature: Feature;
}

export default function FeatureCard({ feature }: FeatureCardProps) {
  const Icon = iconMap[feature.icon] || MessageCircle;

  return (
    <div className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-whatsapp/10 text-whatsapp transition-colors group-hover:bg-whatsapp group-hover:text-white">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-gray-900">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">
        {feature.description}
      </p>
    </div>
  );
}
