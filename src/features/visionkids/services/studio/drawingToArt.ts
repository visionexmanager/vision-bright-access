import { supabase } from "@/integrations/supabase/client";

export interface DrawingToArtResult {
  description: string;
  imageUrl: string;
}

export async function transformDrawingToArt(imageDataUrl: string): Promise<DrawingToArtResult> {
  const { data, error } = await supabase.functions.invoke("kids-drawing-to-art", { body: { image: imageDataUrl } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as DrawingToArtResult;
}
