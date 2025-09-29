import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LogOut, Menu, Search, ShieldHalf } from 'lucide-react';

import { logout } from '../lib/auth';

const navItems = [
  { label: 'Tenants', href: '/tenants' },
  { label: 'Policy Sets', href: '/policy-sets' },
  { label: 'Entities', href: '/entities' },
  { label: 'Audit', href: '/audit' },
];

const isActivePath = (currentPath: string, href: string) =>
  currentPath === href || currentPath.startsWith(`${href}/`);

export default function Header() {
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCurrentPath(window.location.pathname);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <a
          href="/"
          className="flex items-center gap-3 text-sm font-semibold tracking-wide text-slate-800"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10">
            <ShieldHalf aria-hidden className="h-4 w-4" />
          </span>
          <span>ABAC Admin</span>
        </a>

        <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => {
            const active = isActivePath(currentPath, item.href);

            return (
              <Button
                key={item.href}
                asChild
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                className={
                  active
                    ? 'rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                    : 'rounded-full text-slate-600 hover:bg-slate-100'
                }
              >
                <a href={item.href} className="px-3">
                  {item.label}
                </a>
              </Button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden w-full max-w-xs md:block">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search tenants or policies"
                className="h-9 rounded-full border-slate-200 bg-slate-50 pl-9 text-sm text-slate-600 focus:border-slate-300 focus-visible:ring-slate-200"
              />
            </div>
          </div>

          <Button
            className="hidden md:inline-flex rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
            onClick={() => logout()}
            size="sm"
            variant="secondary"
          >
            <LogOut aria-hidden className="mr-2 h-4 w-4" />
            Logout
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden">
                <Menu aria-hidden className="h-5 w-5" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col gap-6">
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-3 text-base font-semibold text-slate-800">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                    <ShieldHalf aria-hidden className="h-4 w-4" />
                  </span>
                  ABAC Admin
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActivePath(currentPath, item.href);

                  return (
                    <SheetClose asChild key={item.href}>
                      <Button
                        asChild
                        variant={active ? 'secondary' : 'ghost'}
                        className={
                          active
                            ? 'justify-start rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                            : 'justify-start rounded-full text-slate-600 hover:bg-slate-100'
                        }
                      >
                        <a href={item.href} className="w-full px-3 py-1.5 text-left">
                          {item.label}
                        </a>
                      </Button>
                    </SheetClose>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search"
                    className="h-10 rounded-full border-slate-200 bg-slate-50 pl-9 text-sm text-slate-600"
                  />
                </div>
                <Button
                  onClick={() => logout()}
                  variant="secondary"
                  className="w-full rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
                >
                  <LogOut aria-hidden className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
