import { useEffect, useState, useRef, memo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useMenuStore } from '@/stores/menu.store';
import { menuService } from '@/services/menu.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { MenuItemImage } from '@/components/shared/MenuItemImage';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TagBadge } from '@/components/shared/TagBadge';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Loader2, 
  Utensils, 
  Check, 
  AlertCircle, 
  History, 
  Upload, 
  Download,
  Copy,
  Layers
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MenuCategory, MenuItemWithTags, AvailabilityStatus } from '@/types/menu.types';
import { calculateProfitMargin, formatProfitMargin } from '@/utils/profit-margin';
import { supabase } from '@/lib/supabase';
import { BulkImageUpload } from '@/features/menu/components/BulkImageUpload';
import { ImageHistoryDialog } from '@/components/shared/ImageHistoryDialog';

// Native viewport intersection observer-based card virtualizer
const VirtualCard = memo(({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '200px' });

    const target = ref.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, []);

  return (
    <div ref={ref} className="w-full h-full min-h-[300px]">
      {isVisible ? children : <div className="w-full h-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse" />}
    </div>
  );
});
VirtualCard.displayName = 'VirtualCard';

export function MenuPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const { items, categories, tags, isLoading, setItems, setCategories, setTags, setLoading } = useMenuStore();

  const [activeTab, setActiveTab] = useState<'categories' | 'items' | 'images'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageLogs, setImageLogs] = useState<any[]>([]);

  // Bulk and History modal states
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<MenuItemWithTags | null>(null);

  // Dialog configurations
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemWithTags | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Image replacement dialog for Images tab
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [imageEditItem, setImageEditItem] = useState<MenuItemWithTags | null>(null);

  // Category Form fields
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#F59E0B');

  // Menu Item Form fields
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isVeg, setIsVeg] = useState(false);
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [availStatus, setAvailStatus] = useState<AvailabilityStatus>('available');
  const [itemSku, setItemSku] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemCatId, setItemCatId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadMenuData();
  }, [user?.restaurant_id]);

  const loadMenuData = async () => {
    setLoading(true);
    try {
      const [catsRes, itemsRes, tagsRes, logsRes] = await Promise.all([
        menuService.getCategories(user!.restaurant_id),
        menuService.getMenuItems(user!.restaurant_id),
        menuService.getTags(user!.restaurant_id),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('restaurant_id', user!.restaurant_id)
          .eq('resource_type', 'menu_items')
          .in('action', ['UPLOAD_IMAGE', 'REPLACE_IMAGE', 'DELETE_IMAGE'])
          .order('created_at', { ascending: false })
      ]);

      if (catsRes.data) {
        setCategories(catsRes.data);
        if (catsRes.data.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(catsRes.data[0].id);
        }
      }
      if (itemsRes.data) setItems(itemsRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      if (logsRes.data) setImageLogs(logsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateCategory = () => {
    setSelectedCategory(null);
    setCatName('');
    setCatDesc('');
    setCatColor('#F59E0B');
    setIsCatDialogOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCategory(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatColor(cat.color || '#F59E0B');
    setIsCatDialogOpen(true);
  };

  const handleOpenCreateItem = () => {
    setSelectedItem(null);
    setItemName('');
    setItemDesc('');
    setCostPrice('');
    setSellingPrice(0);
    setImageUrl(null);
    setIsVeg(false);
    setPrepTime('');
    setAvailStatus('available');
    setItemSku('');
    setItemBarcode('');
    setItemCatId(selectedCategoryId || categories[0]?.id || '');
    setSelectedTagIds([]);
    setIsItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: MenuItemWithTags, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    setItemName(item.name);
    setItemDesc(item.description || '');
    setCostPrice(item.cost_price === null ? '' : item.cost_price);
    setSellingPrice(item.selling_price);
    setImageUrl(item.image_url);
    setIsVeg(item.is_veg);
    setPrepTime(item.prep_time === null ? '' : item.prep_time);
    setAvailStatus(item.availability_status as AvailabilityStatus);
    setItemSku(item.sku || '');
    setItemBarcode(item.barcode || '');
    setItemCatId(item.category_id);
    setSelectedTagIds(item.tags.map((t) => t.id));
    setIsItemDialogOpen(true);
  };

  const handleOpenDeleteItem = (item: MenuItemWithTags, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    setIsConfirmOpen(true);
  };

  const handleDuplicateItem = (item: MenuItemWithTags, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(null);
    setItemName(`${item.name} (Copy)`);
    setItemDesc(item.description || '');
    setCostPrice(item.cost_price === null ? '' : item.cost_price);
    setSellingPrice(item.selling_price);
    setImageUrl(item.image_url);
    setIsVeg(item.is_veg);
    setPrepTime(item.prep_time === null ? '' : item.prep_time);
    setAvailStatus(item.availability_status as AvailabilityStatus);
    setItemSku(''); // Clear identifiers
    setItemBarcode('');
    setItemCatId(item.category_id);
    setSelectedTagIds(item.tags.map((t) => t.id));
    setIsItemDialogOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: catName,
        description: catDesc,
        color: catColor,
        displayOrder: selectedCategory ? selectedCategory.display_order : categories.length + 1,
        isActive: selectedCategory ? selectedCategory.is_active : true,
      };

      if (selectedCategory) {
        const res = await menuService.updateCategory(selectedCategory.id, selectedCategory.version, payload);
        if (res.error) throw new Error(res.error.message);
        if (res.data) {
          setCategories(categories.map((c) => (c.id === selectedCategory.id ? res.data! : c)));
        }
        toast({ title: 'Category updated successfully' });
      } else {
        const res = await menuService.createCategory(user!.restaurant_id, payload);
        if (res.error) throw new Error(res.error.message);
        if (res.data) {
          setCategories([...categories, res.data]);
        }
        toast({ title: 'Category created successfully' });
      }
      setIsCatDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCatId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        categoryId: itemCatId,
        name: itemName,
        description: itemDesc,
        costPrice: costPrice === '' ? null : Number(costPrice),
        sellingPrice: Number(sellingPrice),
        imageUrl: imageUrl || '',
        isVeg,
        prepTime: prepTime === '' ? null : Number(prepTime),
        availabilityStatus: availStatus,
        sku: itemSku || null,
        barcode: itemBarcode || null,
        displayOrder: selectedItem ? selectedItem.display_order : items.length + 1,
        tags: selectedTagIds,
      };

      if (selectedItem) {
        const res = await menuService.updateMenuItem(selectedItem.id, selectedItem.version, user!.restaurant_id, payload);
        if (res.error) throw new Error(res.error.message);
        if (res.data) {
          setItems(items.map((i) => (i.id === selectedItem.id ? res.data! : i)));
        }
        toast({ title: 'Menu item updated' });
      } else {
        const res = await menuService.createMenuItem(user!.restaurant_id, payload);
        if (res.error) throw new Error(res.error.message);
        if (res.data) {
          setItems([...items, res.data]);
        }
        toast({ title: 'Menu item created' });
      }
      setIsItemDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const res = await menuService.deleteMenuItem(selectedItem.id, user!.id);
      if (res.error) throw new Error(res.error.message);
      setItems(items.filter((i) => i.id !== selectedItem.id));
      toast({ title: 'Menu item deleted' });
      setIsConfirmOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleExportMenu = () => {
    try {
      const exportData = {
        categories: categories.map(({ id, name, description, color, display_order, is_active }) => ({
          id, name, description, color, display_order, is_active
        })),
        items: items.map(({ id, category_id, name, description, cost_price, selling_price, image_url, is_veg, prep_time, availability_status, sku, barcode, display_order }) => ({
          id, category_id, name, description, cost_price, selling_price, image_url, is_veg, prep_time, availability_status, sku, barcode, display_order
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexvelt_menu_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast({ title: 'Menu exported successfully' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleImportMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.categories || !json.items) {
          throw new Error("Invalid format. File must contain 'categories' and 'items'.");
        }

        toast({ title: 'Importing menu data', description: 'Synchronizing categories...' });

        const catIdMap: Record<string, string> = {};
        for (const importedCat of json.categories) {
          const existing = categories.find(c => c.name.toLowerCase() === importedCat.name.toLowerCase());
          if (existing) {
            catIdMap[importedCat.id] = existing.id;
          } else {
            const res = await menuService.createCategory(user!.restaurant_id, {
              name: importedCat.name,
              description: importedCat.description || '',
              color: importedCat.color || '#F59E0B',
              displayOrder: importedCat.display_order || categories.length + 1,
              isActive: importedCat.is_active !== false,
            });
            if (res.data) {
              catIdMap[importedCat.id] = res.data.id;
            }
          }
        }

        toast({ title: 'Importing menu data', description: 'Synchronizing items...' });

        let count = 0;
        for (const importedItem of json.items) {
          const targetCatId = catIdMap[importedItem.category_id] || categories[0]?.id;
          if (!targetCatId) continue;

          // Check if identical item already exists (SKU matching or name matching in same category)
          const existing = items.find(i => 
            (importedItem.sku && i.sku === importedItem.sku) ||
            (i.name.toLowerCase() === importedItem.name.toLowerCase() && i.category_id === targetCatId)
          );

          if (existing) continue;

          const res = await menuService.createMenuItem(user!.restaurant_id, {
            categoryId: targetCatId,
            name: importedItem.name,
            description: importedItem.description || '',
            costPrice: importedItem.cost_price === null ? null : Number(importedItem.cost_price),
            sellingPrice: Number(importedItem.selling_price),
            imageUrl: importedItem.image_url || '',
            isVeg: importedItem.is_veg !== false,
            prepTime: importedItem.prep_time === null ? null : Number(importedItem.prep_time),
            availabilityStatus: (importedItem.availability_status || 'available') as AvailabilityStatus,
            sku: importedItem.sku || null,
            barcode: importedItem.barcode || null,
            displayOrder: importedItem.display_order || items.length + 1,
            tags: [],
          });

          if (res.data) count++;
        }

        toast({ title: 'Import complete', description: `Successfully imported categories and ${count} items.` });
        loadMenuData();
      } catch (err: any) {
        toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
      } finally {
        setIsSubmitting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const profitMargin = calculateProfitMargin(Number(sellingPrice), costPrice === '' ? null : Number(costPrice));

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategoryId ? item.category_id === selectedCategoryId : true;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const isOwner = user?.role?.name === 'Owner';

  return (
    <div className="space-y-6">
      {/* Branded Header */}
      <PageHeader
        title="Menu Management"
        description="Configure categories, price lists, availability, and high-fidelity food photographs."
        actions={
          isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleImportTrigger} className="border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                <Upload className="w-4 h-4 mr-2" />
                Import Menu
              </Button>
              <Button variant="outline" onClick={handleExportMenu} className="border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                <Download className="w-4 h-4 mr-2" />
                Export Menu
              </Button>
              <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} className="border-primary/40 text-primary hover:bg-primary/5">
                <Layers className="w-4 h-4 mr-2" />
                Bulk Images
              </Button>
              <Button variant="outline" onClick={handleOpenCreateCategory}>
                <Plus className="w-4 h-4 mr-2" />
                Category
              </Button>
              <Button onClick={handleOpenCreateItem} className="bg-primary hover:bg-primary/90 text-white font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                Menu Item
              </Button>
            </div>
          )
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportMenu}
      />

      {/* Tabs Layout Navigation */}
      <div className="flex border-b border-border">
        {(['categories', 'items', 'images'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'categories' ? 'Categories' : tab === 'items' ? 'Menu Items' : 'Image Manager'}
          </button>
        ))}
      </div>

      {/* Categories Tab Content */}
      {activeTab === 'categories' && (
        <div className="space-y-4 animate-fade-in">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">No Categories Configured</h3>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Category" in the header to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((cat) => {
                const catItemCount = items.filter(i => i.category_id === cat.id).length;
                return (
                  <div 
                    key={cat.id} 
                    className="bg-card rounded-xl border border-border overflow-hidden p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group relative"
                  >
                    {/* Color Swatch Indicator */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-1.5" 
                      style={{ backgroundColor: cat.color || '#0AB190' }} 
                    />
                    
                    <div className="space-y-2 mt-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{cat.name}</h4>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full font-bold text-slate-500">
                          {catItemCount} Items
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                        {cat.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex justify-end gap-1 pt-3 border-t mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-slate-100" onClick={(e) => handleOpenEditCategory(cat, e)}>
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-rose-50 text-rose-500" onClick={async (e) => {
                        e.stopPropagation();
                        const confirmDelete = window.confirm(`Are you sure you want to delete category "${cat.name}"?`);
                        if (!confirmDelete) return;
                        await menuService.deleteCategory(cat.id, user!.id);
                        setCategories(categories.filter(c => c.id !== cat.id));
                        toast({ title: 'Category deleted' });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Menu Items Tab Content */}
      {activeTab === 'items' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items by name or SKU..."
                className="pl-10 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="flex h-10 w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background"
              value={selectedCategoryId || ''}
              onChange={(e) => setSelectedCategoryId(e.target.value || null)}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <Utensils className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">No menu items found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <VirtualCard key={item.id}>
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between h-full">
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      <MenuItemImage src={item.image_url} alt={item.name} availabilityStatus={item.availability_status} />
                      {item.is_veg ? (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 z-10">
                          VEG
                        </span>
                      ) : (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200 z-10">
                          NON-VEG
                        </span>
                      )}
                      
                      {/* Interactive overlays */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="w-7 h-7 bg-white shadow-sm hover:bg-slate-100" 
                          onClick={(e) => handleDuplicateItem(item, e)}
                          title="Duplicate Item"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="w-7 h-7 bg-white shadow-sm hover:bg-slate-100" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryItem(item);
                            setIsHistoryOpen(true);
                          }}
                          title="Version History"
                        >
                          <History className="w-3.5 h-3.5 text-[#0AB190]" />
                        </Button>
                        <Button variant="secondary" size="icon" className="w-7 h-7 bg-white shadow-sm" onClick={(e) => handleOpenEditItem(item, e)}>
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="destructive" size="icon" className="w-7 h-7" onClick={(e) => handleOpenDeleteItem(item, e)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-semibold text-foreground line-clamp-1">{item.name}</h4>
                          <span className="font-bold text-primary">₹{item.selling_price}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description || 'No recipe details.'}</p>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <TagBadge key={t.id} label={t.label} color={t.color} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <StatusBadge status={item.availability_status} />
                          </span>
                          {item.cost_price && (
                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                              Margin: {formatProfitMargin(calculateProfitMargin(item.selling_price, item.cost_price))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </VirtualCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Manager Tab Content */}
      {activeTab === 'images' && (
        <div className="space-y-4 animate-fade-in bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Image Coverage & Assets</h3>
              <p className="text-xs text-muted-foreground">Upload and inspect resolution details, histories and CDN uploads.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsBulkUploadOpen(true)} className="text-xs border-primary/30 text-primary">
              <Layers className="w-3.5 h-3.5 mr-1.5" /> Bulk Upload Images
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Menu Item</th>
                  <th className="py-3 px-4">Image Preview</th>
                  <th className="py-3 px-4">Upload Status</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {items.map((item) => {
                  const itemLog = imageLogs.find(l => l.resource_id === item.id);
                  const isUploaded = !!item.image_url;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          SKU: <span className="font-semibold">{item.sku || 'N/A'}</span> • Category: <span className="font-semibold">{categories.find(c => c.id === item.category_id)?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border bg-slate-100">
                          <MenuItemImage src={item.image_url} alt={item.name} />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {isUploaded ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                            <Check className="w-3 h-3" /> Live CDN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-100">
                            <AlertCircle className="w-3 h-3" /> Placeholder
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {itemLog ? new Date(itemLog.created_at).toLocaleString() : new Date(item.updated_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-primary">{itemLog?.metadata?.user_name || 'System / Seed'}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            title="Replace / Crop Image"
                            onClick={() => {
                              setImageEditItem(item);
                              setIsImageEditOpen(true);
                            }}
                            className="w-7 h-7 border-slate-200 text-slate-600 hover:border-primary/50 hover:text-primary"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </Button>
                          {isUploaded && (
                            <Button
                              variant="outline"
                              size="icon"
                              title="Remove Image"
                              onClick={async () => {
                                const confirmDelete = window.confirm(`Are you sure you want to remove the image for "${item.name}"?`);
                                if (!confirmDelete) return;
                                try {
                                  const { imageService } = await import('@/services/image.service');
                                  await imageService.deleteMenuItemImage({
                                    restaurantId: user!.restaurant_id,
                                    itemId: item.id,
                                    itemName: item.name,
                                    oldUrl: item.image_url!,
                                    userId: user!.id,
                                    userName: user!.full_name,
                                  });
                                  setItems(items.map(i => i.id === item.id ? { ...i, image_url: null } : i));
                                  toast({ title: 'Image removed' });
                                  loadMenuData();
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                              }}
                              className="w-7 h-7 border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-350"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            title="Version History"
                            onClick={() => {
                              setHistoryItem(item);
                              setIsHistoryOpen(true);
                            }}
                            className="w-7 h-7 border-slate-200 text-[#0AB190] hover:bg-primary/5"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Creation / Edit Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="catName">Category Name</Label>
              <Input id="catName" value={catName} onChange={(e) => setCatName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catDesc">Description</Label>
              <Input id="catDesc" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catColor">Label Color</Label>
              <input
                id="catColor"
                type="color"
                className="w-full h-10 border border-input rounded-md cursor-pointer"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCatDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Menu Item Form Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemDesc">Description</Label>
              <Input id="itemDesc" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price (₹)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>

            {profitMargin !== null && (
              <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-semibold ${
                profitMargin >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Computed Profit Margin: {profitMargin.toFixed(1)}%</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prepTime">Prep Time (minutes)</Label>
                <Input
                  id="prepTime"
                  type="number"
                  placeholder="e.g. 15"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="availStatus">Availability Status</Label>
                <select
                  id="availStatus"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={availStatus}
                  onChange={(e) => setAvailStatus(e.target.value as AvailabilityStatus)}
                >
                  <option value="available">Available</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="hidden">Hidden / Archived</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemSku">SKU</Label>
                <Input id="itemSku" value={itemSku} onChange={(e) => setItemSku(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemBarcode">Barcode</Label>
                <Input id="itemBarcode" value={itemBarcode} onChange={(e) => setItemBarcode(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemCatId">Category</Label>
              <select
                id="itemCatId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={itemCatId}
                onChange={(e) => setItemCatId(e.target.value)}
                required
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch id="isVeg" checked={isVeg} onCheckedChange={setIsVeg} />
              <Label htmlFor="isVeg">Vegetarian Recipe</Label>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>MenuItem Image</Label>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                restaurantId={user?.restaurant_id}
                categoryName={categories.find(c => c.id === itemCatId)?.name}
                sku={itemSku}
                itemId={selectedItem?.id}
                itemName={itemName}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedItem ? 'Save Settings' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inline Image Edit Dialog for Images Tab */}
      <Dialog open={isImageEditOpen} onOpenChange={setIsImageEditOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-card border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-foreground">Edit Item Image</DialogTitle>
          </DialogHeader>
          {imageEditItem && (
            <div className="space-y-4 py-4 flex flex-col items-center">
              <h3 className="font-bold text-sm text-center text-slate-800 dark:text-slate-200">{imageEditItem.name}</h3>
              <p className="text-xs text-muted-foreground text-center">Upload, crop or remove image for this menu item.</p>
              <ImageUpload
                value={imageEditItem.image_url}
                onChange={(newUrl) => {
                  setItems(items.map(i => i.id === imageEditItem.id ? { ...i, image_url: newUrl } : i));
                  setImageEditItem(prev => prev ? { ...prev, image_url: newUrl } : null);
                  loadMenuData();
                }}
                restaurantId={user?.restaurant_id}
                categoryName={categories.find(c => c.id === imageEditItem.category_id)?.name}
                sku={imageEditItem.sku || ''}
                itemId={imageEditItem.id}
                itemName={imageEditItem.name}
              />
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => setIsImageEditOpen(false)} className="text-xs h-9 bg-slate-800 text-white font-bold ml-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Menu Item"
        description={`Are you sure you want to delete menu item "${selectedItem?.name}"?`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDeleteItem}
      />

      {/* Bulk Image Upload Dialog */}
      <BulkImageUpload
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onUploadSuccess={loadMenuData}
      />

      {/* Version History Dialog */}
      <ImageHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        itemId={historyItem?.id || null}
        itemName={historyItem?.name || ''}
        currentUrl={historyItem?.image_url || null}
        onRestoreSuccess={(newUrl) => {
          if (historyItem) {
            setItems(items.map(i => i.id === historyItem.id ? { ...i, image_url: newUrl } : i));
          }
          loadMenuData();
        }}
      />
    </div>
  );
}
