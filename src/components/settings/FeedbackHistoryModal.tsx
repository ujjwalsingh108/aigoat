"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Calendar, Mail, FileText, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Feedback = {
  id: string;
  email: string;
  type: string;
  detail: string;
  attachments: string[];
  created_at: string;
};

type FeedbackHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackHistory: Feedback[];
  loading?: boolean;
};

type ImagePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageName: string;
};

// Image Preview Modal Component
function ImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}: ImagePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm truncate">{imageName}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[70vh] bg-black">
          <Image
            src={imageUrl}
            alt={imageName}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 80vw"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Feedback Type Badge Component
function FeedbackTypeBadge({ type }: { type: string }) {
  const typeColors: Record<string, string> = {
    how_to_use: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    functionality_issue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    billing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    feature_requests: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    ui_issue: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    product_unresponsive: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    business_cooperation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  };

  const typeLabels: Record<string, string> = {
    how_to_use: "How to use?",
    functionality_issue: "Functionality Issue",
    billing: "Billing & Subscription",
    feature_requests: "Feature Request",
    ui_issue: "UI Issue",
    product_unresponsive: "Product Unresponsive",
    business_cooperation: "Business Cooperation",
  };

  return (
    <Badge
      variant="secondary"
      className={cn("text-xs font-normal", typeColors[type] || "bg-gray-100 text-gray-800")}
    >
      {typeLabels[type] || type}
    </Badge>
  );
}

// Main Feedback History Modal Component
export function FeedbackHistoryModal({
  open,
  onOpenChange,
  feedbackHistory,
  loading = false,
}: FeedbackHistoryModalProps) {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const extractImageName = (url: string) => {
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "image");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              Feedback History
            </DialogTitle>
            <DialogDescription>
              View all your submitted feedback and their status
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading feedback history...
                </p>
              </div>
            ) : feedbackHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    No feedback yet
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Submit your first feedback to get started. We'll show all
                    your submissions here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {feedbackHistory.map((feedback, index) => (
                  <div
                    key={feedback.id}
                    className={cn(
                      "rounded-lg border bg-card p-5 space-y-4 transition-all hover:shadow-md",
                      index === 0 && "border-blue-500 border-2"
                    )}
                  >
                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FeedbackTypeBadge type={feedback.type} />
                          {index === 0 && (
                            <Badge
                              variant="default"
                              className="bg-blue-600 text-white text-xs"
                            >
                              Latest
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(feedback.created_at)}</span>
                      </div>
                    </div>

                    {/* Email Section */}
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {feedback.email}
                      </span>
                    </div>

                    {/* Detail Section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Details:
                      </h4>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {feedback.detail}
                      </p>
                    </div>

                    {/* Attachments Section */}
                    {feedback.attachments && feedback.attachments.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Attachments ({feedback.attachments.length})
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {feedback.attachments.map((url, imgIndex) => (
                            <button
                              key={imgIndex}
                              onClick={() =>
                                setSelectedImage({
                                  url,
                                  name: extractImageName(url),
                                })
                              }
                              className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              <Image
                                src={url}
                                alt={`Attachment ${imgIndex + 1}`}
                                fill
                                className="object-cover transition-transform group-hover:scale-110"
                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 text-gray-900" />
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-900/50">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreviewModal
          open={!!selectedImage}
          onOpenChange={(open) => !open && setSelectedImage(null)}
          imageUrl={selectedImage.url}
          imageName={selectedImage.name}
        />
      )}
    </>
  );
}
