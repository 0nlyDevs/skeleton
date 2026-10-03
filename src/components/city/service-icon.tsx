import {
  Building2,
  Droplets,
  GraduationCap,
  HeartPulse,
  Home,
  IdCard,
  Landmark,
  Leaf,
  Recycle,
  Rocket,
  Satellite,
  Shield,
  TreePine,
  Users,
  Wind,
  Wrench,
  Zap,
  Bus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Allow-listed icon names (see SERVICE_ICONS) mapped to their component. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  building: Building2,
  zap: Zap,
  droplets: Droplets,
  wind: Wind,
  bus: Bus,
  "heart-pulse": HeartPulse,
  "id-card": IdCard,
  home: Home,
  shield: Shield,
  recycle: Recycle,
  "graduation-cap": GraduationCap,
  trees: TreePine,
  wrench: Wrench,
  satellite: Satellite,
  rocket: Rocket,
  landmark: Landmark,
  users: Users,
  leaf: Leaf,
};

export function ServiceIcon({ name, className }: { readonly name: string; readonly className?: string }) {
  const Icon = ICONS[name] ?? Building2;
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground", className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
