import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function getCurrentTaxYear(): number {
  return new Date().getFullYear();
}

export function getDateRangeForPeriod(period: 'month' | 'quarter' | 'year' | 'ytd'): {
  start: string;
  end: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'quarter': {
      const qStart = Math.floor(month / 3) * 3;
      const start = new Date(year, qStart, 1);
      const end = new Date(year, qStart + 3, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'year': {
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    case 'ytd': {
      return { start: `${year}-01-01`, end: now.toISOString().split('T')[0] };
    }
  }
}
