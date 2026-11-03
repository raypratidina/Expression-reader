'use strict';
const $ = id => document.getElementById(id);
const video=$('video'), overlay=$('overlay'), ctx=overlay.getContext('2d');
const sample=document.createElement('canvas'); sample.width=48; sample.height=48;
const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
const THRESHOLD=.65;
let stream=null, running=false, paused=false, generation=0, modelPromise=null, started=0, loopTimer=null;
let history=[], candidate='', candidateCount=0, lastMoment=0, lastVideoTime=-1, status='ready';
const labels={neutral:['Netral','○'],happy:['Tersenyum','☺'],angry:['Mengerutkan wajah','⌁'],surprised:['Tampak terkejut','◉']};
function elapsed(){return started?Math.floor((Date.now()-started)/1000):0;}
function timeText(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
setInterval(()=>{$('timer').textContent=timeText(elapsed());},1000);
function message(key,title,detail,error=false){status=key; if($('statusTitle').textContent!==title)$('statusTitle').textContent=title; $('statusDetail').textContent=detail;$('guidance').classList.toggle('error',error);}
function clearEstimate(label='Menunggu wajah',hint='Hasil muncul saat satu wajah terbaca.'){$('expression').textContent=label;$('expressionIcon').textContent='—';$('confidence').textContent='—';$('confidenceFill').style.width='0%';$('confidenceMeter').removeAttribute('aria-valuenow');$('resultHint').textContent=hint;candidate='';candidateCount=0;}
function clearOverlay(){ctx.clearRect(0,0,overlay.width,overlay.height);}
function condition(key,title,detail){clearEstimate(key==='uncertain'?'Belum pasti':'Menunggu wajah',title);message(key,title,detail);}
async function models(){
 if(!modelPromise)modelPromise=(async()=>{
  if(!window.faceapi)throw new Error('MODEL');
  await faceapi.tf.ready();
  await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('/models'),faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),faceapi.nets.faceExpressionNet.loadFromUri('/models')]);
 })().catch(e=>{modelPromise=null;throw new Error('MODEL');});
 return modelPromise;
}
async function listCameras(){
 try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const selected=stream?.getVideoTracks()[0]?.getSettings().deviceId||$('camera').value;$('camera').replaceChildren();for(const [i,d] of devices.entries()){const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`Kamera ${i+1}`;$('camera').append(o);}if(devices.some(d=>d.deviceId===selected))$('camera').value=selected;}catch{}
}
function release(){if(stream){stream.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;}video.pause();video.srcObject=null;video.classList.remove('active');overlay.width=1;overlay.height=1;sampleCtx.clearRect(0,0,48,48);}
function endSession(showMessage=true){
 generation++;running=false;paused=false;clearTimeout(loopTimer);release();history=[];lastMoment=0;started=0;lastVideoTime=-1;
 $('timer').textContent='00:00';$('sessionLabel').textContent='Belum ada sesi';$('cameraBadge').textContent='Kamera nonaktif';$('viewStatus').textContent='PRATINJAU KAMERA';
 $('welcome').hidden=false;$('loading').hidden=true;$('start').disabled=false;$('start').textContent='▣  Mulai kamera';$('pause').disabled=true;$('pause').textContent='Ⅱ  Jeda';$('end').disabled=true;$('camera').disabled=false;
 clearEstimate('Menunggu kamera');renderHistory();
 if(showMessage)message('ended','Sesi berakhir. Kamera sudah dimatikan.','Riwayat sesi dan data wajah telah dihapus dari memori. Kamu bisa memulai lagi kapan saja.');
}
function failure(e){const name=e?.name;let title='Kamera tidak dapat diakses',detail='Pastikan kamera tersambung dan tidak sedang digunakan aplikasi lain, lalu coba lagi.';
 if(name==='NotAllowedError'||name==='SecurityError'){title='Izinkan kamera untuk memulai';detail='Buka pengaturan izin situs di browser, izinkan Kamera, lalu tekan Coba lagi.';}
 else if(name==='NotFoundError'||name==='OverconstrainedError'){title='Kamera tidak ditemukan';detail='Sambungkan kamera atau pilih kamera lain, lalu coba lagi.';}
 else if(e.message==='MODEL'){title='Analisis belum dapat disiapkan';detail='Periksa koneksi untuk memuat model, lalu coba lagi. Jika tetap gagal, gunakan Chrome atau Edge terbaru.';}
 else if(e.message==='UNSUPPORTED'){title='Browser belum mendukung kamera';detail='Buka situs ini melalui HTTPS di Chrome atau Edge terbaru pada perangkat dengan kamera.';}
 else if(e.message==='TIMEOUT'){title='Izin kamera belum diterima';detail='Izinkan akses melalui pesan browser, lalu tekan Coba lagi.';}
 else if(e.message==='INFERENCE'){title='Analisis terhenti';detail='Kamera telah dimatikan. Coba lagi atau gunakan browser desktop terbaru.';}
 endSession(false);message('error',title,detail,true);$('start').textContent='↻  Coba lagi';
}
async function startSession(){
 if(running)return;
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){failure(new Error('UNSUPPORTED'));return;}
 const token=++generation;running=true;paused=false;$('start').disabled=true;$('end').disabled=false;$('camera').disabled=true;
 message('permission','Menunggu izin kamera','Pilih Izinkan pada pesan browser. Kamera hanya dipakai untuk sesi ini.');
 let pendingTimeout;
 try{
  const cameraId=$('camera').value;
  const request=navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},...(cameraId?{deviceId:{exact:cameraId}}:{facingMode:'user'})}});
  request.then(s=>{if(token!==generation)s.getTracks().forEach(t=>t.stop());},()=>{});
  const s=await Promise.race([request,new Promise((_,reject)=>{pendingTimeout=setTimeout(()=>reject(new Error('TIMEOUT')),30000);})]);
  clearTimeout(pendingTimeout);if(token!==generation){s.getTracks().forEach(t=>t.stop());return;}
  stream=s;video.srcObject=s;await video.play();if(token!==generation)return;
  stream.getVideoTracks()[0].onended=()=>failure(new Error('DISCONNECTED'));
  video.classList.add('active');$('welcome').hidden=true;$('loading').hidden=false;$('cameraBadge').textContent='Kamera aktif';$('viewStatus').textContent='LOKAL · TIDAK DIREKAM';$('sessionLabel').textContent='Sesi aktif';started=Date.now();
  listCameras();message('loading','Menyiapkan analisis ekspresi','Kamera sudah aktif. Model dimuat untuk dijalankan pada perangkatmu.');
  await models();if(token!==generation)return;
  $('loading').hidden=true;$('pause').disabled=false;$('camera').disabled=false;lastVideoTime=-1;
  message('analyzing','Mencari satu wajah','Posisikan wajah menghadap kamera dengan cahaya merata.');
  tick(token);
 }catch(e){clearTimeout(pendingTimeout);if(token===generation)failure(e);}
}
function togglePause(){
 if(!running||$('pause').disabled)return;
 paused=!paused;generation++;
 if(paused){clearTimeout(loopTimer);$('pause').textContent='▷  Lanjutkan';$('sessionLabel').textContent='Sesi dijeda';$('cameraBadge').textContent='Analisis dijeda';clearEstimate('Analisis dijeda','Kamera tetap aktif. Lanjutkan saat kamu siap.');clearOverlay();message('paused','Analisis dijeda · kamera tetap aktif','Tidak ada ekspresi yang dianalisis. Pilih Akhiri sesi untuk mematikan kamera.');}
 else{$('pause').textContent='Ⅱ  Jeda';$('sessionLabel').textContent='Sesi aktif';$('cameraBadge').textContent='Kamera aktif';lastVideoTime=-1;tick(generation);}
}
function brightness(box){const x=Math.max(0,box?.x||0),y=Math.max(0,box?.y||0);const w=Math.min(box?.width||video.videoWidth,video.videoWidth-x),h=Math.min(box?.height||video.videoHeight,video.videoHeight-y);if(w<=0||h<=0)return 0;sampleCtx.drawImage(video,x,y,w,h,0,0,48,48);const data=sampleCtx.getImageData(0,0,48,48).data;let total=0;for(let i=0;i<data.length;i+=4)total+=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;sampleCtx.clearRect(0,0,48,48);return total/(48*48);}
function renderHistory(){const el=$('timeline');el.replaceChildren();$('momentCount').textContent=history.length+' momen';if(!history.length){const e=document.createElement('div');e.className='timeline-empty';e.textContent='◷  Belum ada momen. Mulai kamera untuk mengamati ekspresimu.';el.append(e);return;}
 for(const m of history.slice().reverse()){const e=document.createElement('div');e.className='moment';e.textContent=m.label;const t=document.createElement('small');t.textContent=timeText(m.time)+' · '+m.confidence+'%';e.append(t);el.append(e);}}
let inFlight=false;
async function tick(token){
 if(token!==generation||!running||paused)return;
 if(inFlight){loopTimer=setTimeout(()=>tick(token),50);return;}
 const began=performance.now();inFlight=true;
 try{
  if(video.readyState<2||video.currentTime===lastVideoTime)return;
  lastVideoTime=video.currentTime;
  const faces=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.35}));
  if(token!==generation||paused)return;
  overlay.width=video.videoWidth;overlay.height=video.videoHeight;clearOverlay();
  if(faces.length===0){if(brightness()<42)condition('lowlight','Cahaya terlalu rendah','Tambahkan cahaya di depan wajah, lalu hadap kamera.');else condition('noface','Posisikan wajah di dalam frame','Pastikan wajah terlihat jelas dan kamera tidak tertutup.');return;}
  if(faces.length>1){condition('multiple','Pastikan hanya satu wajah di frame','Analisis dijeda sampai hanya satu wajah yang terlihat.');return;}
  const face=faces[0],b=face.box;
  if(brightness(b)<42){condition('lowlight','Cahaya pada wajah terlalu rendah','Tambahkan cahaya dari depan. Hindari cahaya kuat dari belakang.');return;}
  if(b.width/video.videoWidth<.18||b.height/video.videoHeight<.22){condition('small','Dekatkan wajah ke kamera','Wajah terlalu kecil untuk menghasilkan estimasi yang andal.');return;}
  if(b.x<2||b.y<2||b.right>video.videoWidth-2||b.bottom>video.videoHeight-2||face.score<.65){condition('obscured','Pastikan seluruh wajah terlihat','Hadap kamera dan pastikan mata serta mulut tidak tertutup atau terpotong.');return;}
  // Expression inference is only performed after the single-face and quality gates.
  const input=await faceapi.extractFaces(video,[face]);
  let prediction;
  try{const landmarks=await faceapi.detectFaceLandmarksTiny(input[0]); const expressions=await faceapi.recognizeFaceExpressions(input[0]); prediction={landmarks,expressions};}finally{input.forEach(c=>{c.width=0;c.height=0;});}
  if(token!==generation||paused)return;
  if(!prediction){condition('obscured','Wajah belum terbaca jelas','Hadap kamera dan pastikan mata serta mulut terlihat.');return;}
  const points=prediction.landmarks.positions;
  const left=prediction.landmarks.getLeftEye(),right=prediction.landmarks.getRightEye(),nose=prediction.landmarks.getNose();
  const meanX=p=>p.reduce((a,v)=>a+v.x,0)/p.length;
  const eyeDistance=meanX(right)-meanX(left);
  const yaw=eyeDistance>0?Math.abs((nose[3].x-meanX(left))/eyeDistance-.5):1;
  if(yaw>.36){condition('obscured','Hadapkan wajah ke kamera','Sudut wajah terlalu miring. Pastikan kedua mata dan mulut terlihat.');return;}
  if($('landmarks').checked){ctx.strokeStyle='#bca0ff';ctx.lineWidth=2;ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.fillStyle='#c7b0ff';for(const p of points){ctx.beginPath();ctx.arc(p.x+b.x,p.y+b.y,1.6,0,Math.PI*2);ctx.fill();}}
  const [key,score]=Object.entries(prediction.expressions).sort((a,b)=>b[1]-a[1])[0];
  if(!labels[key]||score<THRESHOLD){condition('uncertain','Ekspresi belum pasti','Coba pencahayaan lebih baik dan hadap kamera. Model belum memberi estimasi yang cukup kuat.');return;}
  if(candidate===key)candidateCount++;else{candidate=key;candidateCount=1;}
  if(candidateCount<3){$('expression').textContent='Menganalisis…';$('expressionIcon').textContent='—';$('confidence').textContent='—';$('confidenceFill').style.width='0%';$('confidenceMeter').removeAttribute('aria-valuenow');$('resultHint').textContent='Menunggu hasil yang konsisten.';message('stabilizing','Menstabilkan estimasi','Pertahankan posisi wajah sejenak.');return;}
  const [label,icon]=labels[key],confidence=Math.round(score*100);
  $('expression').textContent=label;$('expressionIcon').textContent=icon;$('confidence').textContent=confidence+'%';$('confidenceFill').style.width=confidence+'%';$('confidenceMeter').setAttribute('aria-valuenow',confidence);$('resultHint').textContent='Estimasi ekspresi visual, bukan perasaan.';
  message('active','Menganalisis ekspresi yang terlihat','Satu wajah terbaca. Kamu bisa mencoba ekspresi lain atau menjeda sesi.');
  if(Date.now()-lastMoment>3000&&history.at(-1)?.label!==label){history.push({label,confidence,time:elapsed()});history=history.slice(-20);lastMoment=Date.now();renderHistory();}
 }catch(e){if(token===generation&&!paused)failure(new Error('INFERENCE'));}
 finally{inFlight=false;if(token===generation&&running&&!paused)loopTimer=setTimeout(()=>tick(token),Math.max(0,100-(performance.now()-began)));}
}
$('start').addEventListener('click',startSession);$('pause').addEventListener('click',togglePause);$('end').addEventListener('click',()=>endSession());
$('landmarks').addEventListener('change',()=>{if(!$('landmarks').checked)clearOverlay();});
$('camera').addEventListener('change',()=>{if(running){endSession(false);startSession();}});
window.addEventListener('pagehide',()=>endSession(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused&&!$('pause').disabled)togglePause();});
// Agent access deliberately excludes raw camera images, landmarks, and expression history.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});for(const tool of [
 {name:'get_camera_session_status',description:'Read whether the camera session is active or paused. Does not return face data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({running,paused,status})},
 {name:'end_camera_session',description:'Stop the camera and clear the in-memory session history.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||Object.keys(input).length)throw new Error('Expected an empty object');endSession();return{running:false,historyCleared:true};}}
 ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}}
