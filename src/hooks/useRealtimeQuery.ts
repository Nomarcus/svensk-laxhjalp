import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeQueryOptions {
  table: string;
  filters?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  enabled?: boolean;
}

export function useRealtimeQuery<T extends { id: string }>({
  table,
  filters = {},
  order,
  enabled = true,
}: UseRealtimeQueryOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const filterKey = JSON.stringify(filters);
  const orderKey = order ? `${order.column}-${order.ascending}` : '';

  const fetchData = useCallback(async () => {
    if (!enabled) { setData([]); setLoading(false); return; }

    let query = supabase.from(table).select('*');
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        query = query.contains(key, value);
      } else {
        query = query.eq(key, value);
      }
    }
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    const { data: result, error } = await query;
    if (error) {
      console.error(`Realtime query error [${table}]:`, error.message);
    } else {
      setData((result || []) as T[]);
    }
    setLoading(false);
  }, [table, filterKey, orderKey, enabled]);

  useEffect(() => {
    fetchData();

    if (!enabled) return;

    // Build realtime filter string for a single eq filter
    const filterEntries = Object.entries(filters);
    let realtimeFilter: string | undefined;
    if (filterEntries.length === 1) {
      const [key, value] = filterEntries[0];
      if (!Array.isArray(value)) {
        realtimeFilter = `${key}=eq.${value}`;
      }
    }

    const channelName = `${table}-${filterKey}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(realtimeFilter ? { filter: realtimeFilter } : {}),
        },
        (payload) => {
          const { eventType } = payload;
          if (eventType === 'INSERT') {
            const newRow = payload.new as T;
            // Check if the new row matches our filters (for compound filters)
            if (matchesFilters(newRow, filters)) {
              setData(prev => {
                if (prev.find(item => item.id === newRow.id)) return prev;
                if (order?.ascending === false) return [newRow, ...prev];
                return [...prev, newRow];
              });
            }
          } else if (eventType === 'UPDATE') {
            const updated = payload.new as T;
            setData(prev => prev.map(item => item.id === updated.id ? updated : item));
          } else if (eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setData(prev => prev.filter(item => item.id !== deleted.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filterKey, orderKey, enabled, fetchData]);

  return { data, loading, refetch: fetchData };
}

function matchesFilters(row: any, filters: Record<string, any>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      // contains check
      const rowVal = row[key];
      if (!Array.isArray(rowVal)) return false;
      if (!value.every(v => rowVal.includes(v))) return false;
    } else {
      if (row[key] !== value) return false;
    }
  }
  return true;
}
