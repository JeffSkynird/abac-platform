import { Fragment } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageSquare,
  ShieldHalf,
  Users,
} from 'lucide-react';

const stats = [
  {
    label: 'Active tenants',
    value: '12',
    trend: '+2 this month',
    icon: Users,
  },
  {
    label: 'Policies under review',
    value: '8',
    trend: '3 require attention',
    icon: FileText,
  },
  {
    label: 'Resolved requests',
    value: '24',
    trend: 'Average time 3h',
    icon: CheckCircle2,
  },
];

const quickLinks = [
  {
    label: 'Manage tenants',
    description: 'Manage registrations, cancellations.',
    href: '/tenants',
  },
  {
    label: 'Create policy set',
    description: 'Start set of policies.',
    href: '/policy-sets',
  },
  {
    label: 'Review audit',
    description: 'Track decisions.',
    href: '/audit',
  },
];

const activity = [
  {
    title: 'Policy Set approved',
    description: 'Security team validated access rules for Finance.',
    time: '2 hours ago',
  },
  {
    title: 'Tenant onboarding in progress',
    description: 'Onboarding with 3 policy sets assigned.',
    time: '5 hours ago',
  },
  {
    title: 'Entity review completed',
    description: 'The hierarchy of sensitive resources has been updated.',
    time: 'Yesterday',
  },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-8 text-white shadow-xl">
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
            <ShieldHalf aria-hidden className="h-5 w-5" />
            <span>control Panel (TODO)</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-200">
            Review the overall status of your tenants, policy sets, and recent decisions.
          </p>
        </div>
        <Button asChild size="lg" className="h-10 rounded-full bg-white text-slate-900 hover:bg-slate-100">
          <a href="/tenants" className="inline-flex items-center gap-2">
            Select Tenant
            <ArrowRight aria-hidden className="h-4 w-4" />
          </a>
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(({ icon: Icon, label, trend, value }) => (
          <Card
            key={label}
            className="border-none bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/5">
                <Icon aria-hidden className="h-4 w-4 text-slate-500" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{trend}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-none bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Quick access</CardTitle>
              <CardDescription>Common actions to continue your day.</CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-100 text-xs font-medium text-slate-600"
            >
              Admin
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {quickLinks.map(({ description, href, label }) => (
              <Button
                key={href}
                asChild
                variant="outline"
                className="h-auto flex-col items-start gap-2 rounded-2xl border-slate-200 bg-white px-4 py-5 text-left font-normal text-slate-600 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <a href={href} className="flex w-full flex-col gap-1 text-left">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{description}</span>
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-slate-900">Status of the PDP</CardTitle>
            <CardDescription>Availability of the decision platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Availability</span>
              <Badge className="rounded-full bg-emerald-100 text-emerald-700">99.9%</Badge>
            </div>
            <Progress value={90} className="h-2 bg-slate-100" />
            <Separator className="bg-slate-100" />
            <div className="space-y-2 text-xs text-slate-500">
              <p>Last deployment: 45 minutes ago</p>
              <p>Latest incident: 12 days ago</p>
              <Button asChild variant="secondary" size="sm" className="w-full border-none shadow-sm">
                <a href="/audit" className="flex items-center justify-center gap-2 text-slate-700">
                  View audit log
                  <MessageSquare aria-hidden className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-none bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-slate-900">Recent Activity</CardTitle>
            <CardDescription>A look at the latest relevant events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map(({ description, time, title }, index) => (
              <Fragment key={title}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">{description}</p>
                  </div>
                  <span className="text-xs text-slate-400">{time}</span>
                </div>
                {index < activity.length - 1 ? <Separator className="bg-slate-100" /> : null}
              </Fragment>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
