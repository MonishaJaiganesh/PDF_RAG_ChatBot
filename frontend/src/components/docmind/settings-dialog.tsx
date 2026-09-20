import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_SETTINGS } from "@/lib/docmind/config";
import { saveSettings } from "@/lib/docmind/store";
import type { ApiSettings } from "@/lib/docmind/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ApiSettings;
};

const FIELDS: { key: keyof ApiSettings; label: string; hint: string }[] = [
  { key: "baseUrl", label: "API base URL", hint: "e.g. http://127.0.0.1:8000" },
  { key: "uploadPath", label: "Upload endpoint", hint: "POST, multipart/form-data" },
  { key: "chatPath", label: "Chat endpoint", hint: "POST, JSON" },
  { key: "documentFieldName", label: "Upload field name", hint: "Form field for the PDF" },
];

export function SettingsDialog({ open, onOpenChange, settings }: Props) {
  const [draft, setDraft] = useState<ApiSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backend settings</DialogTitle>
          <DialogDescription>
            DocMind never answers in the browser — every question is sent to your FastAPI
            service.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={`setting-${field.key}`}>{field.label}</Label>
              <Input
                id={`setting-${field.key}`}
                value={draft[field.key]}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                spellCheck={false}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_SETTINGS)}>
            Reset defaults
          </Button>
          <Button
            onClick={() => {
              saveSettings(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
