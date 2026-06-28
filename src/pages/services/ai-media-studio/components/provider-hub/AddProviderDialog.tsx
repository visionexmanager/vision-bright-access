import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import type { Provider, CreateProviderInput, UpdateProviderInput, ProviderType, ProviderStatus } from "@/lib/types/provider-hub";
import { PROVIDER_TYPE_LABELS } from "@/lib/types/provider-hub";

interface AddProviderDialogProps {
  open:      boolean;
  onClose:   () => void;
  onSave:    (input: CreateProviderInput | { id: string; patch: UpdateProviderInput }) => void;
  editing?:  Provider | null;
  isPending?: boolean;
}

const BLANK: CreateProviderInput = {
  name:                  "",
  slug:                  "",
  type:                  "tts",
  status:                "inactive",
  priority:              50,
  api_key_ref:           "",
  base_url:              "",
  default_model:         "",
  cost_per_request:      0,
  cost_limit_daily_usd:  0,
  max_rpm:               60,
  capabilities:          [],
  config:                {},
};

export function AddProviderDialog({
  open, onClose, onSave, editing, isPending,
}: AddProviderDialogProps) {
  const [form, setForm] = useState<CreateProviderInput>(BLANK);
  const [capInput, setCapInput] = useState("");

  // Prefill form when editing
  useEffect(() => {
    if (editing) {
      setForm({
        name:                  editing.name,
        slug:                  editing.slug,
        type:                  editing.type,
        status:                editing.status,
        priority:              editing.priority,
        api_key_ref:           editing.api_key_ref ?? "",
        base_url:              editing.base_url ?? "",
        default_model:         editing.default_model ?? "",
        cost_per_request:      editing.cost_per_request,
        cost_limit_daily_usd:  editing.cost_limit_daily_usd,
        max_rpm:               editing.max_rpm,
        capabilities:          editing.capabilities ?? [],
        config:                editing.config ?? {},
      });
    } else {
      setForm(BLANK);
    }
  }, [editing, open]);

  const set = <K extends keyof CreateProviderInput>(k: K, v: CreateProviderInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const autoSlug = () => {
    if (!form.slug && form.name) {
      set("slug", form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const addCap = () => {
    const cap = capInput.trim().toLowerCase();
    if (cap && !form.capabilities?.includes(cap)) {
      set("capabilities", [...(form.capabilities ?? []), cap]);
      setCapInput("");
    }
  };

  const removeCap = (cap: string) =>
    set("capabilities", (form.capabilities ?? []).filter((c) => c !== cap));

  const handleSave = () => {
    if (!form.name.trim() || !form.slug.trim() || !form.type) return;
    if (editing) {
      onSave({ id: editing.id, patch: form as UpdateProviderInput });
    } else {
      onSave(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Provider" : "Add Provider"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provider Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={autoSlug}
                placeholder="e.g. My Custom TTS"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug * <span className="text-muted-foreground text-[10px]">(unique identifier)</span></Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="e.g. my-custom-tts"
                disabled={!!editing}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Type + status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provider Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as ProviderType)}
                disabled={!!editing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROVIDER_TYPE_LABELS) as [ProviderType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status ?? "inactive"}
                onValueChange={(v) => set("status", v as ProviderStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* API key ref + model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Secret Name <span className="text-muted-foreground text-[10px]">(env var)</span></Label>
              <Input
                value={form.api_key_ref ?? ""}
                onChange={(e) => set("api_key_ref", e.target.value)}
                placeholder="e.g. MY_PROVIDER_API_KEY"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Name of the Supabase secret containing the API key
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Default Model</Label>
              <Input
                value={form.default_model ?? ""}
                onChange={(e) => set("default_model", e.target.value)}
                placeholder="e.g. gpt-4o-mini-tts"
              />
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label>Base URL <span className="text-muted-foreground text-[10px]">(optional override)</span></Label>
            <Input
              value={form.base_url ?? ""}
              onChange={(e) => set("base_url", e.target.value)}
              placeholder="https://api.provider.com/v1"
            />
          </div>

          {/* Priority slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Priority</Label>
              <span className="text-sm text-muted-foreground">{form.priority} (lower = preferred)</span>
            </div>
            <Slider
              value={[form.priority ?? 50]}
              min={1} max={100} step={1}
              onValueChange={(v) => set("priority", v[0])}
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1 = Highest priority</span>
              <span>100 = Lowest priority</span>
            </div>
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost per Request ($)</Label>
              <Input
                type="number"
                value={form.cost_per_request ?? 0}
                onChange={(e) => set("cost_per_request", parseFloat(e.target.value) || 0)}
                step="0.001"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Daily Cost Limit ($) <span className="text-muted-foreground text-[10px]">0 = unlimited</span></Label>
              <Input
                type="number"
                value={form.cost_limit_daily_usd ?? 0}
                onChange={(e) => set("cost_limit_daily_usd", parseFloat(e.target.value) || 0)}
                step="0.01"
                min={0}
              />
            </div>
          </div>

          {/* Max RPM */}
          <div className="space-y-1.5">
            <Label>Max Requests per Minute</Label>
            <Input
              type="number"
              value={form.max_rpm ?? 60}
              onChange={(e) => set("max_rpm", parseInt(e.target.value) || 60)}
              min={1}
            />
          </div>

          {/* Capabilities */}
          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="flex gap-2">
              <Input
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCap(); } }}
                placeholder="e.g. emotions, ssml, streaming"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={addCap}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            {(form.capabilities ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.capabilities ?? []).map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1 text-xs">
                    {c}
                    <button onClick={() => removeCap(c)}>
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.slug.trim() || isPending}
          >
            {isPending ? "Saving…" : editing ? "Save Changes" : "Add Provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
