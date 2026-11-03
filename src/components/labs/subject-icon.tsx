import { Code, Braces, Coffee, FileCode, Globe, Network, Wifi, Cpu, Sparkles, MessageSquare, Smartphone, Brain, Bot, Lock, FlaskConical, type LucideIcon } from "lucide-react";
const MAP: Record<string, LucideIcon> = { code: Code, braces: Braces, coffee: Coffee, "file-code": FileCode, globe: Globe, network: Network, wifi: Wifi, cpu: Cpu, sparkles: Sparkles, "message-square": MessageSquare, smartphone: Smartphone, brain: Brain, bot: Bot, lock: Lock };
export function SubjectIcon({ name, className }: { name: string; className?: string }) {
  const I = MAP[name] ?? FlaskConical;
  return <I className={className} aria-hidden />;
}
