import { Badge, type BadgeVariant } from './Badge';

type EntityStatus =
  | 'ACTIVO'
  | 'INACTIVO'
  | 'BLOQUEADO'
  | 'EXITOSO'
  | 'FALLIDO'
  | 'PENDIENTE'
  | 'EN_PROCESO';

interface StatusBadgeProps {
  status: EntityStatus | string;
  className?: string;
}

const statusConfig: Record<EntityStatus, { variant: BadgeVariant; label: string }> = {
  ACTIVO: { variant: 'success', label: 'Activo' },
  INACTIVO: { variant: 'neutral', label: 'Inactivo' },
  BLOQUEADO: { variant: 'danger', label: 'Bloqueado' },
  EXITOSO: { variant: 'success', label: 'Exitoso' },
  FALLIDO: { variant: 'danger', label: 'Fallido' },
  PENDIENTE: { variant: 'warning', label: 'Pendiente' },
  EN_PROCESO: { variant: 'info', label: 'En proceso' },
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as EntityStatus];

  if (!config) {
    return (
      <Badge variant="neutral" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps, EntityStatus };
