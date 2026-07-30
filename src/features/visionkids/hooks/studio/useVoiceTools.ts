import { useMutation } from "@tanstack/react-query";
import { textToSpeech, speechToText } from "@/features/visionkids/services/studio/voiceTools";

export function useTextToSpeech() {
  return useMutation({ mutationFn: (text: string) => textToSpeech(text) });
}

export function useSpeechToText() {
  return useMutation({ mutationFn: (blob: Blob) => speechToText(blob) });
}
