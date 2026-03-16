'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
}

export function TransactionFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/transactions?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/transactions');
  }

  const hasFilters = searchParams.has('category') || searchParams.has('type') || searchParams.has('search');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search transactions..."
          defaultValue={searchParams.get('search') || ''}
          className="pl-10"
          onChange={(e) => {
            const value = e.target.value;
            if (value.length === 0 || value.length >= 2) {
              updateParam('search', value || null);
            }
          }}
        />
      </div>

      <Select
        value={searchParams.get('type') || 'all'}
        onValueChange={(v) => updateParam('type', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="expense">Expenses</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('category') || 'all'}
        onValueChange={(v) => updateParam('category', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-[150px]"
        defaultValue={searchParams.get('start') || ''}
        onChange={(e) => updateParam('start', e.target.value || null)}
      />
      <span className="text-gray-400">to</span>
      <Input
        type="date"
        className="w-[150px]"
        defaultValue={searchParams.get('end') || ''}
        onChange={(e) => updateParam('end', e.target.value || null)}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
