import {
  Landmark,
  Droplets,
  Moon,
  Star,
  BookOpen,
  Heart,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Landmark,
  Droplets,
  Moon,
  Star,
  BookOpen,
  Heart,
};

export function TopicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Star;
  return <Icon className={className} />;
}
