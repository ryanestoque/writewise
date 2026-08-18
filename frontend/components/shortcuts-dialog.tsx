"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { CommandIcon, KeyboardIcon } from "lucide-react";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: ShortcutItem[] = [
  {
    category: "Navigation & Layout",
    keys: ["⌘", "B"],
    description: "Toggle sidebar navigation",
  },
  {
    category: "Navigation & Layout",
    keys: ["Tab"],
    description: "Move focus to next interactive element",
  },
  {
    category: "Navigation & Layout",
    keys: ["Shift", "Tab"],
    description: "Move focus to previous element",
  },
  {
    category: "Dialogs & Actions",
    keys: ["Esc"],
    description: "Close open dialog or modal",
  },
  {
    category: "Dialogs & Actions",
    keys: ["Enter"],
    description: "Confirm action or activate button",
  },
  {
    category: "Dialogs & Actions",
    keys: ["Space"],
    description: "Toggle checkbox or trigger action",
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <KeyboardIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Accelerators for fast teacher navigation in WriteWise.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {categories.map((category) => (
            <div key={category} className="space-y-2.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                {category}
              </h4>
              <div className="rounded-xl border divide-y bg-card/50">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                    >
                      <span className="text-foreground font-medium">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, keyIdx) => (
                          <Kbd key={keyIdx} className="text-[11px] px-1.5 py-0.5 font-mono">
                            {key === "⌘" ? <CommandIcon className="size-2.5 inline mr-0.5" /> : null}
                            {key === "⌘" ? "Ctrl / ⌘" : key}
                          </Kbd>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
