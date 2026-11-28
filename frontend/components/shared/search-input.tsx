import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "ref"> {
  /** Additional CSS classes for the outer wrapper element */
  containerClassName?: string;
  /** Callback invoked when the search is cleared via the clear button or Escape key */
  onClear?: () => void;
  /** Whether to display the keyboard shortcut badge when empty (default: true) */
  showShortcut?: boolean;
  /** The shortcut key string displayed inside the Kbd badge (default: "/") */
  shortcutKey?: string;
  /** Ref forwarded to the underlying HTML input element */
  ref?: React.Ref<HTMLInputElement>;
}

export function SearchInput({
  className,
  containerClassName,
  value,
  onChange,
  onClear,
  onKeyDown,
  placeholder = "Search...",
  showShortcut = true,
  shortcutKey = "/",
  disabled,
  ref,
  type = "search",
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const setMergedRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref && "current" in ref) {
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }
  };

  const stringValue = typeof value === "string" ? value : String(value ?? "");
  const hasValue = stringValue.length > 0;

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      const syntheticEvent = {
        target: { value: "" },
        currentTarget: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (hasValue) {
        e.preventDefault();
        handleClear();
      } else {
        inputRef.current?.blur();
      }
    }
    onKeyDown?.(e);
  };

  return (
    <InputGroup
      className={cn(
        "w-full sm:w-72 h-11 sm:h-9 min-h-11 sm:min-h-9 rounded-lg sm:rounded-xl border border-border bg-background",
        containerClassName
      )}
      data-slot="search-input-container"
    >
      <InputGroupAddon align="inline-start">
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        ref={setMergedRef}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-full text-base sm:text-sm [&::-webkit-search-cancel-button]:appearance-none",
          className
        )}
        aria-keyshortcuts={showShortcut ? shortcutKey : undefined}
        {...props}
      />
      {(hasValue || showShortcut) && (
        <InputGroupAddon align="inline-end">
          {hasValue ? (
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleClear}
              disabled={disabled}
              className="relative rounded-full text-muted-foreground hover:text-foreground cursor-pointer after:absolute after:-inset-2 after:content-['']"
              aria-label="Clear search"
            >
              <X aria-hidden="true" />
            </InputGroupButton>
          ) : (
            <Kbd
              className="hidden sm:inline-flex h-5 border-border bg-muted px-1.5 text-xs text-muted-foreground font-medium pointer-events-none"
              aria-hidden="true"
            >
              {shortcutKey}
            </Kbd>
          )}
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
