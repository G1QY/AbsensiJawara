import {useSyncExternalStore} from 'react';
import english from './locales/en.json';
export type Language='id'|'en';
const key='jawara_language';
let language:Language='id';
try { language=localStorage.getItem(key)==='en'?'en':'id'; } catch {}
const listeners=new Set<()=>void>();
function applyLanguage(next:Language){language=next;document.documentElement.lang=next;listeners.forEach(listener=>listener());}
if(typeof document!=='undefined')document.documentElement.lang=language;
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===key)applyLanguage(event.newValue==='en'?'en':'id');});
export function setLanguage(next:Language){if(next!=='id'&&next!=='en')return;try{localStorage.setItem(key,next);}catch{}applyLanguage(next);}
export function useLanguage(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>language,()=> 'id' as Language);}
export function getLocale(){return language==='en'?'en-GB':'id-ID';}
export function t(text:string|number):string {const source=String(text);return language==='en'?((english as Record<string,string>)[source]||source):source;}

export function tx(text:string, values:Record<string,string|number>):string {return t(text).replace(/\{(\w+)\}/g,(token,name)=>name in values?String(values[name]):token);}
