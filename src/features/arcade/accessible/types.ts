export type AccessibleGameplayEventType = "instruction" | "position" | "status" | "score" | "success" | "failure" | "warning";
export type Direction = "front" | "behind" | "left" | "right" | "near" | "far";
export interface AccessibleGameplayEvent { type:AccessibleGameplayEventType; message:string; priority:"polite" | "assertive"; gameId?:string }
