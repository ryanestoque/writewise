"use client";

import { Fragment } from "react";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";

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
    category: "Worksheet & Assessment",
    keys: ["⌘", "K"],
    description: "Upload Worksheet",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["Alt", "U"],
    description: "Upload worksheets for the current activity",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["Alt", "/"],
    description: "Search student work in the current activity",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["Alt", "R"],
    description: "Open Scoring Rubric",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["Alt", "C"],
    description: "Open Cursive Guide",
  },
  {
    category: "Activity Detail",
    keys: ["Alt", "U"],
    description: "Upload to the current activity",
  },
  {
    category: "Activity Detail",
    keys: ["Alt", "/"],
    description: "Search student work",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["[", "]"],
    description: "Step through diagnostic practice areas (or Alt+[ / Alt+])",
  },
  {
    category: "Worksheet & Assessment",
    keys: ["Esc"],
    description: "Dismiss active handwriting annotation tooltip",
  },
  {
    category: "Dialogs & Actions",
    keys: ["?"],
    description: "Open keyboard shortcuts guide",
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
  const { modifierKey, altKey } = useShortcutKeys();
  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="w-[calc(100%-1.5rem)] max-w-md max-h-[min(90dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        <ResponsiveModalHeader className="p-6 pb-4 border-b shrink-0">
          <ResponsiveModalTitle className="text-base font-semibold">
            Keyboard Shortcuts
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Accelerators for fast teacher navigation in WriteWise.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="p-5 sm:p-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5">
          {categories.map((category) => (
            <div key={category} className="flex flex-col gap-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                {category}
              </h3>
              <ItemGroup className="gap-0 rounded-xl border border-border bg-card">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((item, idx) => (
                    <Fragment key={`${category}-${idx}`}>
                      {idx > 0 && <ItemSeparator className="my-0" />}
                      <Item size="xs" className="justify-between">
                        <ItemContent>
                          <ItemTitle className="text-xs font-medium text-foreground line-clamp-none">
                            {item.description}
                          </ItemTitle>
                        </ItemContent>
                        <ItemActions className="gap-1 shrink-0">
                          {item.keys.map((key, keyIdx) => (
                            <Kbd key={keyIdx} className="text-[11px] px-1.5 py-0.5 font-mono">
                              {key === "⌘" ? modifierKey : key === "Alt" ? altKey : key}
                            </Kbd>
                          ))}
                        </ItemActions>
                      </Item>
                    </Fragment>
                  ))}
              </ItemGroup>
            </div>
          ))}
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
