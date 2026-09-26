export const accountRoles: Record<string,string> = {
 CREW_STORE:'Crew Store', CREW_EVENT:'Crew Event', HEAD_STORE:'Head Store', EVENT_MANAGER:'Event Manager',
 HEAD_OFFICE:'Head Office', OFFICE_STAFF:'Staff Kantor', PRODUCTION_STAFF:'Staff Produksi', SUPER_ADMIN:'Super Admin',
}
export const officeDivisions=['Operational','Finance','Business Development','Marketing','Produksi','Teknisi']
export const roleDivisions=(role:string)=>['HEAD_OFFICE','OFFICE_STAFF'].includes(role)?officeDivisions:role==='PRODUCTION_STAFF'?['Packing','Produksi']:[]
