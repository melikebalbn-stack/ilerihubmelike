"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import type { CourseListItem } from "@/types/akademi-package";

interface PackageCourseItem {
  id: string;
  courseId: string;
  courseTitle: string;
  courseDifficulty: string;
  order: number;
  isRequired: boolean;
}

interface Props {
  packageId: string;
  initialCourses: PackageCourseItem[];
  onSaved: () => void;
}

function SortableRow({
  item,
  onToggleRequired,
  onRemove,
}: {
  item: PackageCourseItem;
  onToggleRequired: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-[var(--ak-surface-1)] rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1">
        <div
          className="text-sm font-medium"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {item.courseTitle}
        </div>
        <div
          className="text-xs"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {item.courseDifficulty}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={item.isRequired}
          onCheckedChange={() => onToggleRequired(item.id)}
        />
        <span
          className="text-xs"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Zorunlu
        </span>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="p-1.5 rounded-md hover:bg-red-500/10"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AdminPackageCoursesPicker({
  packageId,
  initialCourses,
  onSaved,
}: Props) {
  const [items, setItems] = useState<PackageCourseItem[]>(initialCourses);
  const [allCourses, setAllCourses] = useState<CourseListItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setItems(initialCourses);
    setDirty(false);
  }, [initialCourses]);

  const loadAllCourses = useCallback(() => {
    fetch("/api/akademi/admin/courses")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((data) => setAllCourses(data.courses ?? []))
      .catch(() => setAllCourses([]));
  }, []);

  useEffect(() => {
    if (pickerOpen && allCourses.length === 0) loadAllCourses();
  }, [pickerOpen, allCourses.length, loadAllCourses]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    setItems(arrayMove(items, oldIdx, newIdx));
    setDirty(true);
  };

  const addCourse = (course: CourseListItem) => {
    if (items.find((i) => i.courseId === course.id)) {
      toast.error("Bu kurs zaten ekli");
      return;
    }
    setItems([
      ...items,
      {
        id: `new-${course.id}`,
        courseId: course.id,
        courseTitle: course.title,
        courseDifficulty: course.difficulty,
        order: items.length,
        isRequired: true,
      },
    ]);
    setDirty(true);
    setPickerOpen(false);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    setDirty(true);
  };

  const toggleRequired = (id: string) => {
    setItems(
      items.map((i) =>
        i.id === id ? { ...i, isRequired: !i.isRequired } : i
      )
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/courses`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courses: items.map((i, idx) => ({
              courseId: i.courseId,
              order: idx,
              isRequired: i.isRequired,
            })),
          }),
        }
      );
      if (!res.ok) throw new Error("save failed");
      toast.success("Kurslar güncellendi");
      onSaved();
    } catch {
      toast.error("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/sync`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("sync failed");
      const data = await res.json();
      const m = data.materialize;
      toast.success(
        `Senkronize edildi: ${m.targetUserCount} kullanıcı, ${m.newAssignments} yeni atama`
      );
    } catch {
      toast.error("Senkronize edilemedi");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Pakete kurs ekleyin, sırayı sürükleyerek değiştirin, zorunlu/opsiyonel yapın.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Kurs Ekle
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          )}
          {!dirty && items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              title="Pakete kurs ekledikten/çıkardıktan sonra mevcut kullanıcılara yeni kursları dağıt"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Senkronize ediliyor..." : "Yeniden Senkronize Et"}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Henüz kurs yok. &ldquo;Kurs Ekle&rdquo; ile başlayın.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  onToggleRequired={toggleRequired}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kurs Seç</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Kurs ara..." />
            <CommandList>
              <CommandEmpty>Kurs bulunamadı.</CommandEmpty>
              <CommandGroup>
                {allCourses
                  .filter(
                    (c) => c.isActive && !items.find((i) => i.courseId === c.id)
                  )
                  .map((c) => (
                    <CommandItem
                      key={c.id}
                      onSelect={() => addCourse(c)}
                      value={c.title}
                    >
                      <div>
                        <div className="text-sm font-medium">{c.title}</div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--ak-text-tertiary)" }}
                        >
                          {c.difficulty}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
