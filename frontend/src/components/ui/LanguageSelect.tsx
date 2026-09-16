import {setLanguage,useLanguage,t,type Language} from '../../lib/i18n';
export default function LanguageSelect({compact=false}:{compact?:boolean}){
 const language=useLanguage();
 return <select aria-label={t('Bahasa aplikasi')} title={t('Bahasa aplikasi')} value={language} onChange={event=>setLanguage(event.target.value as Language)} className={compact?'language-select':'ui-input w-full max-w-xs'}>
  <option value="id">{compact?'ID':'Bahasa Indonesia'}</option><option value="en">{compact?'EN':'English'}</option>
 </select>;
}
