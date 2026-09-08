const test=require('node:test'),assert=require('node:assert/strict');
const {compressAttendancePhoto}=require('../../src/utils/imageCompression');
test('reject SVG even when upload claims image/jpeg',async()=>{await assert.rejects(compressAttendancePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')));});
test('reject corrupt image and accept real JPEG',async()=>{await assert.rejects(compressAttendancePhoto(Buffer.from('not a photo')));const sharp=require('sharp');const image=await sharp({create:{width:20,height:20,channels:3,background:'#ffffff'}}).jpeg().toBuffer();const output=await compressAttendancePhoto(image);assert.equal((await sharp(output).metadata()).format,'jpeg');});
