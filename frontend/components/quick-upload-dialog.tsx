"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  SparklesIcon,
  ArrowRightIcon,
  XIcon,
} from "lucide-react";

interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickUploadDialog({
  open,
  onOpenChange,
}: QuickUploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG or PNG).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file size must be less than 15MB.");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleProceed = () => {
    if (!selectedFile) {
      // If no file picked yet, direct to activities
      onOpenChange(false);
      router.push("/activities");
      return;
    }

    toast.info("Opening activities to associate worksheet with a lesson...");
    onOpenChange(false);
    router.push("/activities");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClear();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <UploadCloudIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Upload Handwriting Worksheets
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload student cursive worksheets for automated OpenCV & CNN assessment.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Capture Best Practices */}
          <div className="rounded-xl bg-muted/50 border p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Quality Guidelines for Accurate Assessment
              </span>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Keep paper flat under even, natural or overhead lighting.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Ensure guideline rules (top, mid, baseline) are clearly visible.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Avoid extreme perspective angles or shadows cast across words.</span>
              </li>
            </ul>
          </div>

          {/* Upload Dropzone */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileChange(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                <CameraIcon className="size-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Click to browse or drag & drop worksheet photo
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Supports PNG, JPEG, or WebP (up to 15MB)
              </p>
              <Badge variant="outline" className="mt-3 text-[10px] font-normal border-border/80">
                EXIF GPS metadata stripped unconditionally
              </Badge>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileImageIcon className="size-5 text-primary shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold truncate text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                  aria-label="Remove selected image"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>

              {previewUrl && (
                <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Worksheet scan preview"
                    className="size-full object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 px-6 border-t bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleProceed}
            className="gap-2 text-xs font-medium"
          >
            <span>Proceed to Activity</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
