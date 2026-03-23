"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, ApiError, fetchAllPages } from "@/lib/api-client";
import { randomCode } from "@/lib/utils";

// ── Types ──

export interface MasterRow {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  sort_order?: number;
  [key: string]: unknown;
}

export interface MasterPageConfig {
  title: string;
  endpoint: string;
  entityName: string;
  hasColor?: boolean;
  icon?: ReactNode;
  /** Extra fields to include in the POST body when creating */
  extraCreatePayload?: Record<string, unknown>;
}

const COLOR_PRESETS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899",
];

// ── Item Dialog ──

export function MasterItemDialog({
  open,
  onOpenChange,
  item,
  config,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MasterRow | null;
  config: MasterPageConfig;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isCreate = item === null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState("");

  useEffect(() => {
    if (!open) { setError(null); return; }
    if (item) {
      setCode(item.code);
      setName(item.name);
      const c = (item.color as string | null) ?? null;
      setColor(c);
      setHexInput(c ?? "");
    } else {
      setCode("");
      setName("");
      setColor(null);
      setHexInput("");
    }
  }, [open, item]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { code: code.trim() || randomCode(), name: name.trim() };
      if (config.hasColor) payload.color = color;
      if (isCreate) {
        await api.post(config.endpoint, { ...payload, ...config.extraCreatePayload });
      } else {
        await api.put(`${config.endpoint}/${item.id}`, payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? `New ${config.entityName}` : `Edit ${config.entityName}`}</DialogTitle>
          <DialogDescription className="sr-only">{isCreate ? `Create a new ${config.entityName}` : `Edit ${config.entityName}`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated if empty" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Name" />
          </div>

          {config.hasColor && (
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`w-7 h-7 rounded-md border-2 transition-all ${
                      color === preset ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: preset }}
                    onClick={() => { setColor(preset); setHexInput(preset); }}
                  />
                ))}
                <button
                  type="button"
                  className={`w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center text-xs text-muted-foreground ${
                    color === null ? "border-foreground" : "border-dashed border-muted-foreground/50 hover:border-muted-foreground"
                  }`}
                  onClick={() => { setColor(null); setHexInput(""); }}
                  title="Clear color"
                >
                  ×
                </button>
              </div>
              <Input
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setHexInput(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v);
                }}
                placeholder="#FF5733"
                className="font-mono text-xs w-32"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          {!isCreate && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive mr-auto" onClick={onDeleted}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
            </Button>
          )}
          {isCreate && <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>}
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : isCreate ? "Create" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Full MasterPage ──

export function MasterPage({ config }: { config: MasterPageConfig }) {
  const [items, setItems] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<MasterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MasterRow | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPages<MasterRow>(config.endpoint);
      setItems(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : `Failed to fetch ${config.entityName}`);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.entityName]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = () => { setDialogItem(null); setDialogOpen(true); };
  const handleRowClick = (item: MasterRow) => { setDialogItem(item); setDialogOpen(true); };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`${config.endpoint}/${confirmDelete.id}`);
      toast.success(`${config.entityName} deleted`);
      setConfirmDelete(null);
      setDialogOpen(false);
      fetchItems();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "Failed to delete");
    }
  };

  const handleSaved = () => {
    toast.success(dialogItem ? `${config.entityName} updated` : `${config.entityName} created`);
    setDialogOpen(false);
    fetchItems();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {config.icon && <span className="text-muted-foreground">{config.icon}</span>}
          <h2 className="text-xl font-semibold">{config.title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={handleCreate}><Plus className="h-4 w-4 mr-1" />New</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No {config.entityName} found</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/30 transition-colors cursor-pointer hover:bg-accent/20"
                  onClick={() => handleRowClick(item)}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center">
                      {config.hasColor && item.color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-2 shrink-0"
                          style={{ backgroundColor: item.color as string }}
                        />
                      )}
                      <span className="font-mono text-xs text-muted-foreground mr-2">{item.code}</span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={handleCreate}>
        <Plus className="h-6 w-6" />
      </Button>

      <MasterItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={dialogItem}
        config={config}
        onSaved={handleSaved}
        onDeleted={() => dialogItem && setConfirmDelete(dialogItem)}
      />

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
