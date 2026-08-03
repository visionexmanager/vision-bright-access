import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RECOVERY_KEY = "vx_chunk_recovery";
const RECOVERY_PARAM = "vx-refresh";

export function isChunkLoadError(error:unknown):boolean{
  if(!error||typeof error!=="object")return false;
  const value=error as{message?:string;name?:string;stack?:string;cause?:unknown};
  const text=`${value.message??""} ${value.stack??""}`.toLowerCase();
  return text.includes("failed to fetch dynamically imported module")||text.includes("importing a module script failed")||text.includes("unable to preload css")||text.includes("error loading dynamically imported module")||value.name==="ChunkLoadError"||Boolean(value.cause&&isChunkLoadError(value.cause));
}

export function recoveryUrl(location:Pick<Location,"href">,stamp=Date.now()):string{
  const url=new URL(location.href);url.searchParams.set(RECOVERY_PARAM,String(stamp));return url.toString();
}

export function recoverChunkLoad(error:unknown):boolean{
  if(!isChunkLoadError(error))return false;
  const previous=sessionStorage.getItem(RECOVERY_KEY);
  const current=`${location.pathname}${location.search.replace(new RegExp(`([?&])${RECOVERY_PARAM}=[^&]*&?`),"$1")}`;
  if(previous===current){sessionStorage.removeItem(RECOVERY_KEY);return false}
  sessionStorage.setItem(RECOVERY_KEY,current);
  location.replace(recoveryUrl(location));
  return true;
}

export function clearChunkRecovery(){
  sessionStorage.removeItem(RECOVERY_KEY);
  const url=new URL(location.href);
  if(url.searchParams.has(RECOVERY_PARAM)){url.searchParams.delete(RECOVERY_PARAM);history.replaceState(history.state,"",url)}
}

export function lazyWithRetry<T extends ComponentType<Record<string,unknown>>>(loader:()=>Promise<{default:T}>):LazyExoticComponent<T>{
  return lazy(()=>loader().then(module=>{clearChunkRecovery();return module}).catch(error=>{
    if(recoverChunkLoad(error))return new Promise<never>(()=>undefined);
    throw error;
  }));
}
