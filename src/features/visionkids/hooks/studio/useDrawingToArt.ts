import { useMutation } from "@tanstack/react-query";
import { transformDrawingToArt } from "@/features/visionkids/services/studio/drawingToArt";

export function useDrawingToArt() {
  return useMutation({ mutationFn: (imageDataUrl: string) => transformDrawingToArt(imageDataUrl) });
}
