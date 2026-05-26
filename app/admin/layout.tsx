import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Bot, Wrench, BookOpen, MessagesSquare, ScrollText, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Overview', icon: Bot },
  { href: '/admin/agent', label: 'Agent', icon: Bot },
  { href: '/admin/capabilities', label: 'Capabilities', icon: Wrench },
  { href: '/admin/kb', label: 'Knowledge base', icon: BookOpen },
  { href: '/admin/conversations', label: 'Conversations', icon: MessagesSquare },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex h-14 items-center border-b border-neutral-200 px-4 text-sm font-semibold dark:border-neutral-800">
          Slack Legal OS
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700',
                'hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
