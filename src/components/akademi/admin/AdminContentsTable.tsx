"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { AdminContentRow } from "./AdminContentRow";
import type { AdminContentItem } from "@/types/akademi-admin";

interface Props {
  contents: AdminContentItem[];
  onEdit: (c: AdminContentItem) => void;
  onDelete: (c: AdminContentItem) => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

export function AdminContentsTable({
  contents,
  onEdit,
  onDelete,
  onReorder,
}: Props) {
  const [items, setItems] = useState(contents);
  const [saving, setSaving] = useState(false);

  // Sync local state when parent re-fetches
  useEffect(() => {
    setItems(contents);
  }, [contents]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = items;
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    setSaving(true);
    try {
      await onReorder(newItems.map((i) => i.id));
    } catch {
      setItems(previous);
      toast.error("Sıralama kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (contents.length === 0) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Henüz içerik yok. &ldquo;Yeni İçerik&rdquo; butonuyla ilk içeriği ekleyin.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((content) => (
            <AdminContentRow
              key={content.id}
              content={content}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
      {saving && (
        <div className="text-xs text-gray-500 text-center py-2">
          Sıralama kaydediliyor...
        </div>
      )}
    </div>
  );
}
