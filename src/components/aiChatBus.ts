/** Cross-component signal that opens the AI chat pre-filled for a product. */
export type AIChatOpenEvent = CustomEvent<{ productName: string; prompt: string }>;

export function openAIChatWithProduct(productName: string, prompt: string) {
  window.dispatchEvent(new CustomEvent("ai-chat-open", { detail: { productName, prompt } }));
}
