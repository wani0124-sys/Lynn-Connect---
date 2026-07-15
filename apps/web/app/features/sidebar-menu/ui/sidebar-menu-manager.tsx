import { useState } from "react"
import { FolderPlus, Pencil, Trash2 } from "lucide-react"
import {
  SIDEBAR_MENU_ROUTE_ICON,
  SIDEBAR_MENU_GROUP_ICON,
  type SidebarMenuItem,
  type SidebarMenuNode,
  type SidebarMenuPlacement,
} from "~/entities/sidebar-menu/model/sidebar-menu.types"
import { Badge } from "~/shared/ui/badge"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/shared/ui/card"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface SidebarMenuManagerProps {
  tree: Record<SidebarMenuPlacement, SidebarMenuNode[]>
  pending: boolean
  onRename: (id: number, label: string) => void
  onCreateGroup: (label: string, placement: SidebarMenuPlacement) => void
  onDeleteGroup: (id: number) => void
  onSetParent: (id: number, parentId: number | null) => void
  onSetPlacement: (id: number, placement: SidebarMenuPlacement) => void
  onReorderTopLevel: (placement: SidebarMenuPlacement, items: { id: number; sortOrder: number }[]) => void
  onReorderChildren: (parentId: number, items: { id: number; sortOrder: number }[]) => void
}

const PLACEMENT_LABEL: Record<SidebarMenuPlacement, string> = { primary: "주 메뉴", secondary: "관리 메뉴" }

export function SidebarMenuManager({
  tree,
  pending,
  onRename,
  onCreateGroup,
  onDeleteGroup,
  onSetParent,
  onSetPlacement,
  onReorderTopLevel,
  onReorderChildren,
}: SidebarMenuManagerProps) {
  const allGroups = [...tree.primary, ...tree.secondary].filter((node) => node.route === null)

  return (
    <div className="space-y-4">
      {(["primary", "secondary"] as const).map((placement) => (
        <PlacementSection
          key={placement}
          placement={placement}
          nodes={tree[placement]}
          allGroups={allGroups}
          pending={pending}
          onRename={onRename}
          onCreateGroup={onCreateGroup}
          onDeleteGroup={onDeleteGroup}
          onSetParent={onSetParent}
          onSetPlacement={onSetPlacement}
          onReorderTopLevel={onReorderTopLevel}
          onReorderChildren={onReorderChildren}
        />
      ))}
    </div>
  )
}

function PlacementSection({
  placement,
  nodes,
  allGroups,
  pending,
  onRename,
  onCreateGroup,
  onDeleteGroup,
  onSetParent,
  onSetPlacement,
  onReorderTopLevel,
  onReorderChildren,
}: {
  placement: SidebarMenuPlacement
  nodes: SidebarMenuNode[]
  allGroups: SidebarMenuItem[]
} & Omit<SidebarMenuManagerProps, "tree">) {
  const [newGroupLabel, setNewGroupLabel] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{PLACEMENT_LABEL[placement]}</CardTitle>
        <CardDescription>
          {placement === "primary" ? "사이드바 상단(스크롤 영역)에 표시됩니다." : "사이드바 하단(고정 영역)에 표시됩니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y divide-border rounded-md border border-border">
          <SortableList
            items={nodes}
            onReorder={(items) => onReorderTopLevel(placement, items.map((item, index) => ({ id: item.id, sortOrder: index })))}
            renderItem={(node, drag) => (
              <MenuRow
                node={node}
                drag={drag}
                allGroups={allGroups}
                pending={pending}
                onRename={onRename}
                onDeleteGroup={onDeleteGroup}
                onSetParent={onSetParent}
                onSetPlacement={onSetPlacement}
                onReorderChildren={onReorderChildren}
              />
            )}
          />
          {nodes.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">메뉴가 없습니다.</p> : null}
        </div>

        <div className="flex items-end gap-2">
          <Input
            value={newGroupLabel}
            onChange={(e) => setNewGroupLabel(e.target.value)}
            placeholder="새 그룹 이름 (예: 업무 관리)"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || !newGroupLabel.trim()}
            onClick={() => {
              onCreateGroup(newGroupLabel.trim(), placement)
              setNewGroupLabel("")
            }}
          >
            <FolderPlus className="size-4" aria-hidden />
            그룹 추가
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MenuRow({
  node,
  drag,
  allGroups,
  pending,
  onRename,
  onDeleteGroup,
  onSetParent,
  onSetPlacement,
  onReorderChildren,
}: {
  node: SidebarMenuNode
  drag: Parameters<Parameters<typeof SortableList>[0]["renderItem"]>[1]
  allGroups: SidebarMenuItem[]
  pending: boolean
  onRename: (id: number, label: string) => void
  onDeleteGroup: (id: number) => void
  onSetParent: (id: number, parentId: number | null) => void
  onSetPlacement: (id: number, placement: SidebarMenuPlacement) => void
  onReorderChildren: (parentId: number, items: { id: number; sortOrder: number }[]) => void
}) {
  const isGroup = node.route === null
  const Icon = node.route === null ? SIDEBAR_MENU_GROUP_ICON : SIDEBAR_MENU_ROUTE_ICON[node.route]

  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <DragHandle {...drag} />
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <LabelEditor label={node.label} pending={pending} onSave={(label) => onRename(node.id, label)} />
        </div>
        {isGroup ? <Badge tone="info">그룹</Badge> : null}

        <Select
          aria-label="상위 메뉴"
          value={node.parentId ?? ""}
          disabled={pending || isGroup}
          onChange={(e) => onSetParent(node.id, e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">(최상위)</option>
          {allGroups
            .filter((group) => group.id !== node.id)
            .map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
        </Select>

        {node.parentId === null ? (
          <Select
            aria-label="배치"
            value={node.placement}
            disabled={pending}
            onChange={(e) => onSetPlacement(node.id, e.target.value as SidebarMenuPlacement)}
          >
            <option value="primary">주 메뉴</option>
            <option value="secondary">관리 메뉴</option>
          </Select>
        ) : null}

        {isGroup ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="그룹 삭제"
            disabled={pending}
            onClick={() => onDeleteGroup(node.id)}
          >
            <Trash2 className="size-4 text-danger" aria-hidden />
          </Button>
        ) : null}
      </div>

      {isGroup && node.children.length > 0 ? (
        <div className="ml-9 mt-2 divide-y divide-border rounded-md border border-border">
          <SortableList
            items={node.children}
            onReorder={(items) => onReorderChildren(node.id, items.map((item, index) => ({ id: item.id, sortOrder: index })))}
            renderItem={(child, childDrag) => (
              <div className="flex items-center gap-2 p-2">
                <DragHandle {...childDrag} />
                {child.route ? (
                  (() => {
                    const ChildIcon = SIDEBAR_MENU_ROUTE_ICON[child.route]
                    return <ChildIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  })()
                ) : null}
                <div className="min-w-0 flex-1">
                  <LabelEditor label={child.label} pending={pending} onSave={(label) => onRename(child.id, label)} />
                </div>
                <Select
                  aria-label="상위 메뉴"
                  value={child.parentId ?? ""}
                  disabled={pending}
                  onChange={(e) => onSetParent(child.id, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(최상위로 승격)</option>
                  {allGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          />
        </div>
      ) : null}
    </div>
  )
}

function LabelEditor({ label, pending, onSave }: { label: string; pending: boolean; onSave: (label: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)

  if (!editing) {
    return (
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 text-left text-sm font-medium hover:underline"
        onClick={() => {
          setValue(label)
          setEditing(true)
        }}
      >
        <span className="truncate">{label}</span>
        <Pencil className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="h-8"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onSave(value.trim())
            setEditing(false)
          }
          if (e.key === "Escape") setEditing(false)
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !value.trim()}
        onClick={() => {
          onSave(value.trim())
          setEditing(false)
        }}
      >
        저장
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        취소
      </Button>
    </div>
  )
}
