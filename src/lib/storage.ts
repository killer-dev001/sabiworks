import { supabase } from "@/integrations/supabase/client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DELIVERABLE_TYPES = [
  ...IMAGE_TYPES,
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const MAX_DELIVERABLE_BYTES = 50 * 1024 * 1024;

function ext(file: File): string {
  const fromName =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? "";
  return fromName.slice(0, 5) || "bin";
}

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Please choose a JPG, PNG, WebP or GIF image.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5 MB or smaller.";
  return null;
}

export function validateDeliverable(file: File): string | null {
  if (!DELIVERABLE_TYPES.includes(file.type))
    return "That file type isn't supported. Use images, MP4/MOV video, PDF, DOCX or ZIP.";
  if (file.size > MAX_DELIVERABLE_BYTES) return "Files must be 50 MB or smaller.";
  return null;
}

/** Uploads a public image under `<workspaceId>/<folder>/…` and returns its public URL. */
export async function uploadWorkspaceImage(
  workspaceId: string,
  folder: string,
  file: File,
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const path = `${workspaceId}/${folder}/${crypto.randomUUID()}.${ext(file)}`;
  const { error } = await supabase.storage
    .from("workspace-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("workspace-media").getPublicUrl(path).data.publicUrl;
}

/** Uploads a private deliverable under `<projectId>/…`. */
export async function uploadDeliverableFile(
  projectId: string,
  file: File,
): Promise<{ path: string; name: string }> {
  const problem = validateDeliverable(file);
  if (problem) throw new Error(problem);
  const path = `${projectId}/${crypto.randomUUID()}.${ext(file)}`;
  const { error } = await supabase.storage
    .from("deliverables")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name.slice(0, 120) };
}

export async function signedDeliverableUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("deliverables")
    .createSignedUrl(path, 60 * 10);
  if (error || !data) throw error ?? new Error("Could not open this file.");
  return data.signedUrl;
}
