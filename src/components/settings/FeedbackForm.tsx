"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import Image from "next/image";

type Feedback = {
  id: string;
  email: string;
  type: string;
  detail: string;
  attachments: string[];
  created_at: string;
};

export function FeedbackForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [type, setType] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const [feedbackHistory, setFeedbackHistory] = useState<Feedback[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFeedbackHistory(data as Feedback[]);

        if (data.length > 0) {
          const latest = data[0];
          setEmail(latest.email);
          setType(latest.type);
          setDetail(latest.detail);
        }
      }
    };

    fetchHistory();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    setFiles((prevFiles) => {
      // Merge old + new, then slice to max 6
      const updatedFiles = [...prevFiles, ...selectedFiles].slice(0, 6);
      return updatedFiles;
    });

    // Clear the input value so the same file can be reselected if needed
    e.target.value = "";
  };

  const handleDeleteDbImage = async (url: string) => {
    try {
      // Extract the full path from the URL
      // URL format: https://{project}.supabase.co/storage/v1/object/public/feedback/{email}/{feedbackId}/{filename}
      const urlParts = url.split("/storage/v1/object/public/feedback/");
      if (urlParts.length < 2) {
        console.error("Invalid URL format");
        return;
      }
      const filePath = urlParts[1];

      // remove from bucket
      await supabase.storage.from("feedback").remove([filePath]);

      const currentFeedback = feedbackHistory[0];
      const updated = currentFeedback.attachments.filter((att) => att !== url);

      await supabase
        .from("feedback")
        .update({ attachments: updated })
        .eq("id", currentFeedback.id);

      setFeedbackHistory((prev) => {
        const copy = [...prev];
        copy[0].attachments = updated;
        return copy;
      });
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Unauthorized access", {
        description: "You must be logged in.",
      });
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Generate a unique feedback ID for this submission
    const feedbackId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Encode email for safe folder naming (replace special characters)
    const safeEmail = user.email!.replace(/[^a-zA-Z0-9@._-]/g, "_");

    const attachmentUrls: string[] = [];

    // Upload files with new structure: feedback/{email}/{feedbackId}/{filename}
    for (const file of files) {
      const filePath = `${safeEmail}/${feedbackId}/${file.name}`;

      const { error } = await supabase.storage
        .from("feedback")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error", error.message);
        continue;
      }

      const { data: publicUrl } = supabase.storage
        .from("feedback")
        .getPublicUrl(filePath);

      attachmentUrls.push(publicUrl.publicUrl);
    }

    // Insert feedback
    const { data: newFeedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        organization_id: membership?.organization_id || null,
        email,
        type,
        detail,
        attachments: attachmentUrls,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      toast.error("Submission failed", {
        description: "Something went wrong. Please try again.",
      });
    } else {
      toast.success("Feedback submitted", {
        description: "Thank you! We'll get back to you soon.",
      });

      setFeedbackHistory((prev) => [newFeedback as Feedback, ...prev]);

      setEmail("");
      setType("");
      setDetail("");
      setFiles([]);
    }

    setLoading(false);
  };

  return (
    <Card className="border border-gray-200">
      <CardContent className="px-6 py-3 space-y-6">
        <p className="leading-7">
          You can submit any issues you encounter, and we will get back to you
          as soon as possible.
        </p>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="flex justify-between items-center gap-4">
            <Label htmlFor="email">Email:</Label>
            <Input
              required
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-gray-300"
            />
          </div>

          {/* Type */}
          <div className="flex justify-between items-center gap-4">
            <Label htmlFor="type">Type:</Label>
            <Select value={type} onValueChange={(val) => setType(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="how_to_use">How to use ?</SelectItem>
                  <SelectItem value="functionality_issue">
                    Functionality issue
                  </SelectItem>
                  <SelectItem value="billing">
                    Billing & Subscription issue
                  </SelectItem>
                  <SelectItem value="feature_requests">
                    Feature requests
                  </SelectItem>
                  <SelectItem value="ui_issue">UI issue</SelectItem>
                  <SelectItem value="product_unresponsive">
                    Product unresponsive
                  </SelectItem>
                  <SelectItem value="business_cooperation">
                    Business cooperation
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Detail */}
          <div className="flex justify-between items-start gap-4">
            <Label htmlFor="description">Detail:</Label>
            <Textarea
              id="description"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Please describe the issue in detail..."
              className="border-gray-300 min-h-[120px]"
            />
          </div>

          {/* Image Previews */}
          {feedbackHistory[0]?.attachments?.length || files.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* DB images */}
              {feedbackHistory[0]?.attachments?.map((url, idx) => (
                <div
                  key={`db-${idx}`}
                  className="relative w-24 h-24 rounded-md overflow-hidden border flex-shrink-0"
                >
                  <Image
                    width={100}
                    height={100}
                    src={url}
                    alt={`attachment-${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteDbImage(url)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* New local files */}
              {files.map((file, idx) => (
                <div
                  key={`local-${idx}`}
                  className="relative w-24 h-24 rounded-md overflow-hidden border flex-shrink-0"
                >
                  <Image
                    width={100}
                    height={100}
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* File upload */}
          <div className="space-y-4 flex flex-col">
            <Label htmlFor="screenshot">
              Attach screenshots/images (up to 6)
            </Label>
            <Input
              id="screenshot"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="border-gray-300"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary">
              Feedback History ({feedbackHistory.length})
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-white bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
