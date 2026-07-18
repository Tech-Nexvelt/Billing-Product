import { useEffect } from 'react';
import { useTableStore } from '@/stores/table.store';
import { useFloorStore } from '@/stores/floor.store';
import { useOrderStore } from '@/stores/order.store';
import { useMenuStore } from '@/stores/menu.store';
import { orderService } from '@/services/order.service';

import type { Table } from '@/types/table.types';
import type { Floor } from '@/types/floor.types';
import type { MenuItemWithTags } from '@/types/menu.types';


export function useRealtime() {
  const { updateTable, addTable, removeTable } = useTableStore();
  const { updateFloor, addFloor, removeFloor } = useFloorStore();
  const { updateOrder, addOrder, removeOrder } = useOrderStore();
  const { updateMenuItem, addMenuItem, removeMenuItem } = useMenuStore();


  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { table, eventType, new: newRecord, old: oldRecord } = customEvent.detail;

      switch (table) {
        case 'tables':
          if (eventType === 'INSERT') addTable(newRecord as Table);
          else if (eventType === 'UPDATE') updateTable(newRecord as Table);
          else if (eventType === 'DELETE') removeTable(oldRecord.id);
          break;

        case 'floors':
          if (eventType === 'INSERT') addFloor(newRecord as Floor);
          else if (eventType === 'UPDATE') updateFloor(newRecord as Floor);
          else if (eventType === 'DELETE') removeFloor(oldRecord.id);
          break;

        case 'orders':
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            orderService.getOrderById(newRecord.id).then((res) => {
              if (res.success && res.data) {
                if (eventType === 'INSERT') addOrder(res.data);
                else updateOrder(res.data);
              }
            });
          } else if (eventType === 'DELETE') {
            removeOrder(oldRecord.id);
          }
          break;

        case 'menu_items':
          if (eventType === 'INSERT') {
            addMenuItem({ ...(newRecord as any), tags: [] });
          } else if (eventType === 'UPDATE') {
            const existing = useMenuStore.getState().items.find(i => i.id === newRecord.id);
            updateMenuItem({
              ...(existing || {}),
              ...(newRecord as any),
              tags: existing?.tags || []
            } as MenuItemWithTags);
          } else if (eventType === 'DELETE') {
            removeMenuItem(oldRecord.id);
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('supabase_realtime_update', handleUpdate);
    return () => {
      window.removeEventListener('supabase_realtime_update', handleUpdate);
    };
  }, [addTable, updateTable, removeTable, addFloor, updateFloor, removeFloor, addOrder, updateOrder, removeOrder, addMenuItem, updateMenuItem, removeMenuItem]);
}
