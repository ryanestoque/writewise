"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const ResponsiveRichOverlayContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function useResponsiveRichOverlay() {
  return React.useContext(ResponsiveRichOverlayContext);
}

function ResponsiveRichOverlay({
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveRichOverlayContext.Provider value={{ isMobile }}>
      {isMobile ? <Sheet {...props} /> : <Dialog {...props} />}
    </ResponsiveRichOverlayContext.Provider>
  );
}

function ResponsiveRichOverlayTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? <SheetTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveRichOverlayClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? <SheetClose {...props} /> : <DialogClose {...props} />;
}

type ResponsiveRichOverlayContentProps = React.ComponentProps<typeof DialogContent> & {
  sheetClassName?: string;
  mobileFullHeight?: boolean;
};

function ResponsiveRichOverlayContent({
  className,
  sheetClassName,
  mobileFullHeight = true,
  showCloseButton = true,
  overlayClassName,
  children,
  ...props
}: ResponsiveRichOverlayContentProps) {
  const { isMobile } = useResponsiveRichOverlay();

  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        showCloseButton={showCloseButton}
        className={cn(
          "flex flex-col gap-0 overflow-hidden bg-card text-card-foreground p-0",
          mobileFullHeight
            ? "h-dvh max-h-dvh rounded-none border-t-0"
            : "h-[96dvh] max-h-[96dvh] rounded-t-2xl",
          sheetClassName
        )}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      overlayClassName={overlayClassName}
      className={className}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveRichOverlayHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveRichOverlay();
  if (isMobile) {
    return (
      <SheetHeader
        className={cn("shrink-0 p-4 pb-3 text-left", className)}
        {...props}
      />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

function ResponsiveRichOverlayBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  );
}

function ResponsiveRichOverlayFooter({
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useResponsiveRichOverlay();
  if (isMobile) {
    return (
      <SheetFooter
        className={cn(
          "shrink-0 flex-row items-center justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      />
    );
  }
  return <DialogFooter showCloseButton={showCloseButton} className={className} {...props} />;
}

function ResponsiveRichOverlayTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? (
    <SheetTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

function ResponsiveRichOverlayDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? (
    <SheetDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}

export {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayTrigger,
  ResponsiveRichOverlayClose,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayTitle,
  ResponsiveRichOverlayDescription,
};
