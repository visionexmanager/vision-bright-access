import type { HTMLAttributes } from "react";
import { render } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
import { KnowledgeArenaMotion } from "./KnowledgeArenaMotion";
vi.mock("framer-motion",()=>({useReducedMotion:()=>false,motion:{span:({animate:_a,transition:_t,...p}:HTMLAttributes<HTMLSpanElement>&{animate?:unknown;transition?:unknown})=><span {...p}/>}}));
describe("KnowledgeArenaMotion",()=>{it("is decorative",()=>{const{container}=render(<KnowledgeArenaMotion progress={50} urgent={false}/>);expect(container.firstElementChild).toHaveAttribute("aria-hidden","true")})});
