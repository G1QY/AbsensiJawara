const test = require('node:test'), assert = require('node:assert/strict');
const {validateCrew} = require('../src/modules/crew/crew.validation');
test('office assignment and location mode are allowlisted independently of account privileges', () => {
  const result=validateCrew({crewType:'CREW_STORE',assignmentKind:'OFFICE',attendanceLocationMode:'ANYWHERE',role:'SUPER_ADMIN'});
  assert.deepEqual(result,{crewType:'CREW_STORE',assignmentKind:'OFFICE',attendanceLocationMode:'ANYWHERE'});
  for(const body of [{assignmentKind:'ANYWHERE'},{attendanceLocationMode:true},{attendanceLocationMode:null},{crewType:'CREW_EVENT',assignmentKind:'OFFICE'},{crewType:'CREW_STORE',assignmentKind:'EVENT'}]) assert.throws(()=>validateCrew(body));
});
