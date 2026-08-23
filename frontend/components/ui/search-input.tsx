import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
    <div
      className={cn("relative w-full sm:w-72", containerClassName)}
      data-slot="search-input-container"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={setMergedRef}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] pl-9 pr-8 text-base sm:text-sm rounded-lg sm:rounded-xl [&::-webkit-search-cancel-button]:appearance-none",
          className
        )}
        aria-keyshortcuts={showShortcut ? shortcutKey : undefined}
        {...props}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : showShortcut ? (
        <div
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden items-center sm:flex"
          aria-hidden="true"
        >
          <Kbd className="h-5 border-border bg-muted px-1 text-[10px] text-muted-foreground">
            {shortcutKey}
          </Kbd>
        </div>
      ) : null}
    </div>
  );
}
