import type { ReactNode } from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "~/shared/lib/cn"

export interface DragHandleProps {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

export interface SortableListProps<T extends { id: string | number }> {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, drag: DragHandleProps) => ReactNode
  className?: string
}

// 드래그로 순서를 바꾸는 목록. 부서/구분자 관리 모달처럼 sort_order를 가진 목록에서 공용으로 쓴다.
export function SortableList<T extends { id: string | number }>({
  items,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow<T extends { id: string | number }>({
  id,
  item,
  renderItem,
}: {
  id: string | number
  item: T
  renderItem: SortableListProps<T>["renderItem"]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { attributes, listeners })}
    </div>
  )
}

export function DragHandle({ attributes, listeners, className }: DragHandleProps & { className?: string }) {
  return (
    <button
      type="button"
      className={cn("cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing", className)}
      aria-label="드래그해서 순서 변경"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  )
}
