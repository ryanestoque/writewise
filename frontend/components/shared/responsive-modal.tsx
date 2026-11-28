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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const ResponsiveModalContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function useResponsiveModal() {
  return React.useContext(ResponsiveModalContext);
}

type ResponsiveModalProps = Omit<React.ComponentProps<typeof Dialog>, "onOpenChange"> & {
  onOpenChange?: (open: boolean) => void;
  showSwipeHandle?: boolean;
};

function ResponsiveModal({
  showSwipeHandle = true,
  ...props
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveModalContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer swipeDirection="down" showSwipeHandle={showSwipeHandle} {...props} />
      ) : (
        <Dialog {...props} />
      )}
    </ResponsiveModalContext.Provider>
  );
}

function ResponsiveModalTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveModalClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

type ResponsiveModalContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  "render" | "style"
> & {
  style?: React.CSSProperties;
  drawerClassName?: string;
};

function ResponsiveModalContent({
  className,
  drawerClassName,
  showCloseButton = true,
  overlayClassName,
  children,
  ...props
}: ResponsiveModalContentProps) {
  const { isMobile } = useResponsiveModal();

  if (isMobile) {
    return (
      <DrawerContent
        className={cn(
          "max-h-[90dvh] rounded-t-3xl rounded-b-none border-x-0 border-b-0 bg-card text-card-foreground",
          drawerClassName
        )}
        {...props}
      >
        {children}
      </DrawerContent>
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

function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal();
  if (isMobile) {
    return (
      <DrawerHeader
        className={cn(
          "shrink-0 px-5 pt-3 pb-3 text-left group-data-[swipe-axis=y]/drawer-popup:text-left",
          className
        )}
        {...props}
      />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

function ResponsiveModalBody({
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

function ResponsiveModalFooter({
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useResponsiveModal();
  if (isMobile) {
    return (
      <DrawerFooter
        className={cn(
          "shrink-0 flex-col-reverse gap-2 border-t border-border/60 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      />
    );
  }
  return <DialogFooter showCloseButton={showCloseButton} className={className} {...props} />;
}

function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? (
    <DrawerTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? (
    <DrawerDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalBody,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
};
