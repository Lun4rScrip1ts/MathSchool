const MOVIE_KEY="lunar-movie-saved";let movies=[],activeMovie=null,activeFilter="all",currentUser=null,currentLibrary="public",generatedPosterData="";
const $=s=>document.querySelector(s);
const saved=()=>{try{return JSON.parse(localStorage.getItem(MOVIE_KEY)||"[]")}catch{return[]}};
const saveList=v=>localStorage.setItem(MOVIE_KEY,JSON.stringify([...new Set(v)]));
const esc=v=>{const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML};
const isSaved=id=>saved().includes(id);
const fmt=t=>{if(!Number.isFinite(t))return"0:00";const m=Math.floor(t/60),s=Math.floor(t%60);return m+":"+(s<10?"0":"")+s};
const colorFor=id=>{let n=0;for(const c of String(id))n=(n*31+c.charCodeAt(0))>>>0;return ["#"+((n>>16)&255).toString(16).padStart(2,"0")+((n>>8)&255).toString(16).padStart(2,"0")+(n&255).toString(16).padStart(2,"0"),"#"+((n>>8)&255).toString(16).padStart(2,"0")+((n>>16)&255).toString(16).padStart(2,"0")+((n>>4)&255).toString(16).padStart(2,"0")]};
const initials=t=>String(t||"VIDEO").split(/\s+/).slice(0,3).map(x=>x[0]).join("").toUpperCase();

function setPlayIcon(){const v=$("#movie-player"),icon=$("#movie-play i"),big=$("#movie-big-play i");if(!v)return;const playing=!v.paused;icon.className=playing?"fa-solid fa-pause":"fa-solid fa-play";big.className=playing?"fa-solid fa-pause":"fa-solid fa-play";$("#movie-big-play").classList.toggle("visible",!playing);$("#movie-play").setAttribute("aria-label",playing?"Pause":"Play")}
function syncPlayer(){const v=$("#movie-player");if(!v)return;$("#movie-current-time").textContent=fmt(v.currentTime);$("#movie-duration").textContent=fmt(v.duration);$("#movie-progress").value=v.duration?(v.currentTime/v.duration)*100:0;setPlayIcon()}
function togglePlayback(){const v=$("#movie-player");if(!v)return;if(v.paused){v.play().catch(()=>{$("#movie-player-error").hidden=false;$("#movie-player-error").textContent="This video cannot be played in your browser. MP4 (H.264/AAC) is recommended.";setPlayIcon()})}else v.pause()}
function closeMovie(){const modal=$("#movie-modal"),video=$("#movie-player");if(video){video.pause();video.removeAttribute("src");video.load()}if(modal){modal.hidden=true;modal.removeAttribute("style")}document.body.classList.remove("movie-player-open")}
function closeUpload(){const modal=$("#movie-upload-modal");if(modal)modal.hidden=true;$("#movie-upload-status").textContent=""}
function posterMarkup(m){if(m.posterUrl)return '<img src="'+esc(m.posterUrl)+'" alt="" loading="lazy"><div class="movie-poster-shade"></div>';if(m.videoUrl)return '<video class="movie-poster-video" src="'+esc(m.videoUrl)+'" muted playsinline preload="metadata"></video><div class="movie-poster-shade"></div>';const c=colorFor(m.id);return '<div class="movie-generated-poster" style="--poster-a:'+c[0]+';--poster-b:'+c[1]+'"><strong>'+esc(initials(m.title))+'</strong></div><div class="movie-poster-shade"></div>'}

function openMovie(m){
  activeMovie=m;
  const old=document.getElementById("lunar-movie-theater");
  if(old)old.remove();
  const overlay=document.createElement("div");
  overlay.id="lunar-movie-theater";
  Object.assign(overlay.style,{position:"fixed",inset:"0",width:"100vw",height:"100vh",zIndex:"2147483647",background:"rgba(0,0,0,.96)",display:"flex",flexDirection:"column",alignItems:"center",overflow:"auto",padding:"18px",boxSizing:"border-box",fontFamily:"inherit"});
  const top=document.createElement("div");
  Object.assign(top.style,{width:"min(1200px,96vw)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0 12px",color:"#fff",flex:"0 0 auto"});
  const title=document.createElement("strong");title.textContent=m.title;Object.assign(title.style,{fontSize:"18px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80%"});
  const close=document.createElement("button");close.type="button";close.textContent="×";Object.assign(close.style,{width:"42px",height:"42px",border:"1px solid rgba(255,255,255,.2)",borderRadius:"12px",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:"28px",cursor:"pointer"});
  top.append(title,close);
  const wrap=document.createElement("div");
  Object.assign(wrap.style,{position:"relative",width:"min(1200px,96vw)",height:"min(68vh,calc(96vw * .5625))",minHeight:"240px",background:"#000",borderRadius:"16px",overflow:"hidden",boxShadow:"0 30px 100px rgba(0,0,0,.7)",flex:"0 0 auto"});
  const video=document.createElement("video");video.src=m.videoUrl;video.poster=m.posterUrl||"";video.controls=true;video.playsInline=true;video.preload="auto";video.style.cssText="width:100%;height:100%;object-fit:contain;display:block;background:#000";
  const error=document.createElement("div");error.textContent="Unable to play this video. MP4 (H.264/AAC) is recommended.";Object.assign(error.style,{position:"absolute",inset:"0",display:"none",placeItems:"center",padding:"20px",textAlign:"center",color:"#fff",background:"rgba(0,0,0,.8)",fontSize:"15px"});
  video.addEventListener("error",()=>{error.style.display="grid"});
  wrap.append(video,error);
  const info=document.createElement("div");Object.assign(info.style,{width:"min(1200px,96vw)",color:"#fff",padding:"18px 0 35px",flex:"0 0 auto"});
  const h=document.createElement("h2");h.textContent=m.title;Object.assign(h.style,{margin:"0 0 8px",fontSize:"28px"});
  const p=document.createElement("p");p.textContent=m.description||"Uploaded to your Lunar library.";Object.assign(p.style,{margin:"0",color:"#b8bfcc",lineHeight:"1.5"});
  info.append(h,p);
  overlay.append(top,wrap,info);
  document.body.appendChild(overlay);
  document.documentElement.style.overflow="hidden";
  document.body.style.overflow="hidden";
  const closeOverlay=()=>{video.pause();overlay.remove();document.documentElement.style.overflow="";document.body.style.overflow=""};
  close.onclick=closeOverlay;
  overlay.addEventListener("click",e=>{if(e.target===overlay)closeOverlay()});
  document.addEventListener("keydown",function escMovie(e){if(e.key==="Escape"){closeOverlay();document.removeEventListener("keydown",escMovie)}},{once:true});
  video.addEventListener("canplay",()=>error.style.display="none");
  video.load();
}
function toggleSave(m){const list=saved(),i=list.indexOf(m.id);if(i>=0)list.splice(i,1);else list.push(m.id);saveList(list);render();if(activeMovie?.id===m.id)$("#movie-pin").innerHTML=isSaved(m.id)?'<i class="fa-solid fa-bookmark"></i> Saved':'<i class="fa-regular fa-bookmark"></i> Save'}
async function deleteMovie(m){if(!confirm("Delete this video from your Lunar library?"))return;const r=await fetch("/api/movies/"+encodeURIComponent(m.id),{method:"DELETE"});if(!r.ok){alert((await r.json().catch(()=>({}))).error||"Could not delete video.");return}closeMovie();movies=movies.filter(x=>x.id!==m.id);render()}

function hydrateVideoPosters(){document.querySelectorAll(".movie-poster-video").forEach(v=>{if(v.dataset.lunarPosterReady==="1")return;v.dataset.lunarPosterReady="1";const seek=()=>{if(!Number.isFinite(v.duration)||!v.videoWidth)return;const t=Math.min(Math.max(v.duration*0.05,0),Math.max(v.duration-0.05,0));try{v.currentTime=t}catch{}};const stop=()=>{v.pause();v.removeAttribute("controls")};v.addEventListener("loadedmetadata",seek,{once:true});v.addEventListener("loadeddata",()=>{if(v.currentTime===0){try{v.currentTime=Math.min(0.1,Math.max(0,(v.duration||1)*0.05))}catch{}}},{once:true});v.addEventListener("seeked",()=>{stop()},{once:true});v.addEventListener("error",()=>{v.style.display="none"},{once:true})})}

function render(){
  const q=($("#movies-search")?.value||"").trim().toLowerCase();
  const scoped=movies.filter(m=>currentLibrary==="public"?m.visibility==="public":currentUser&&m.ownerId===currentUser.id);
  const list=scoped.filter(m=>(activeFilter==="all"||String(m.category||"other").toLowerCase()===activeFilter)&&(!q||m.title.toLowerCase().includes(q)||(m.description||"").toLowerCase().includes(q)));
  $("#movies-count").textContent=list.length+" video"+(list.length===1?"":"s");
  document.querySelector(".movie-section-head h2").textContent=currentLibrary==="public"?"Lunar Studios":"My Videos";
  $("#movie-grid").innerHTML=list.length?list.map(m=>{const sc=isSaved(m.id)?"saved":"",icon=isSaved(m.id)?"solid":"regular";return '<article class="movie-card" data-id="'+esc(m.id)+'"><button class="movie-save '+sc+'" data-save="'+esc(m.id)+'" aria-label="Save video"><i class="fa-'+icon+' fa-bookmark"></i></button><span class="movie-badge">'+esc(m.category||"OTHER")+'</span><div class="movie-poster">'+posterMarkup(m)+'<strong class="movie-poster-title">'+esc(m.title)+'</strong><span class="movie-play"><i class="fa-solid fa-play"></i></span></div><div class="movie-card-body"><h3>'+esc(m.title)+'</h3><div class="movie-meta"><span>'+esc(m.uploadedBy||"Lunar")+'</span><span>•</span><span>'+new Date(m.uploadedAt).toLocaleDateString()+'</span></div></div></article>'}).join(""):'<div class="movie-empty"><i class="fa-solid fa-film"></i><h3>Your library is empty</h3><p>Upload a video to start building your movie shelf.</p><button class="movies-primary" id="movies-empty-upload"><i class="fa-solid fa-cloud-arrow-up"></i> Upload video</button></div>';
  document.querySelectorAll(".movie-card").forEach(card=>card.onclick=e=>{if(e.target.closest(".movie-save"))return;const m=movies.find(x=>x.id===card.dataset.id);if(m)openMovie(m)});
  document.querySelectorAll(".movie-save").forEach(b=>b.onclick=e=>{e.stopPropagation();const m=movies.find(x=>x.id===b.dataset.save);if(m)toggleSave(m)});
  $("#movies-empty-upload")?.addEventListener("click",openUpload);hydrateVideoPosters();
}

async function loadLibrary(){const r=await fetch("/api/movies",{cache:"no-store"});if(!r.ok)throw new Error("Library request failed");const data=await r.json();movies=Array.isArray(data.movies)?data.movies:[]}
async function loadUser(){const r=await fetch("/api/auth/me",{cache:"no-store"});if(r.ok){const data=await r.json();currentUser=data.user||null}}

function openUpload(){const modal=$("#movie-upload-modal");modal.hidden=false;$("#movie-upload-title").focus()}
function resetPosterPreview(){generatedPosterData="";const img=$("#movie-poster-preview"),empty=$("#movie-poster-preview-empty");if(img){img.removeAttribute("src");img.hidden=true}if(empty)empty.hidden=false}
function showPosterPreview(data,label="Poster preview"){const img=$("#movie-poster-preview"),empty=$("#movie-poster-preview-empty"),note=$("#movie-poster-preview-note");if(!img)return;img.src=data;img.hidden=false;if(empty)empty.hidden=true;if(note)note.textContent=label}
function makeVideoPoster(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),v=document.createElement("video");v.muted=true;v.playsInline=true;v.preload="auto";let settled=false;const cleanup=()=>{URL.revokeObjectURL(url);v.remove()};const fail=()=>{if(settled)return;settled=true;cleanup();reject(new Error("The video preview could not be generated."))};const capture=()=>{if(settled||!v.videoWidth||!v.videoHeight)return;try{const w=1280,h=720,c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");const scale=Math.max(w/v.videoWidth,h/v.videoHeight),dw=v.videoWidth*scale,dh=v.videoHeight*scale;ctx.drawImage(v,(w-dw)/2,(h-dh)/2,dw,dh);const data=c.toDataURL("image/jpeg",.82);settled=true;cleanup();resolve(data)}catch{fail()}};v.onloadedmetadata=()=>{const t=Math.min(Math.max((v.duration||1)*0.05,0),Math.max((v.duration||1)-0.05,0));try{v.currentTime=t}catch{capture()}};v.onloadeddata=()=>{if(v.currentTime===0)capture()};v.onseeked=capture;v.onerror=fail;v.src=url})}
function readDataUrl(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file)})}
function uploadVideo(file,title,description,category){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open("POST","/api/movies/upload");xhr.setRequestHeader("Content-Type",file.type);xhr.setRequestHeader("X-Movie-Title",title);xhr.setRequestHeader("X-Movie-Description",description);xhr.setRequestHeader("X-Movie-Category",category);
  xhr.upload.onprogress=e=>{if(e.lengthComputable){$(".movie-upload-progress").hidden=false;$("#movie-upload-progress-bar").style.width=(e.loaded/e.total*100)+"%"}};
  xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText)}catch{};if(xhr.status>=200&&xhr.status<300)resolve(data.movie);else reject(new Error(data.error||"Upload failed."))};
  xhr.onerror=()=>reject(new Error("Upload connection failed."));xhr.send(file);
 });
}

async function submitUpload(){
  const file=$("#movie-upload-video").files[0],title=$("#movie-upload-title").value.trim(),description=$("#movie-upload-description").value.trim(),category=$("#movie-upload-category").value;
  const status=$("#movie-upload-status"),button=$("#movie-upload-submit");
  if(!file)return status.textContent="Choose a video first.";
  if(!title)return status.textContent="Give your video a title.";
  if(file.size>500*1024*1024)return status.textContent="That video is over the 500 MB limit.";
  button.disabled=true;status.textContent="Uploading…";$(".movie-upload-progress").hidden=false;$("#movie-upload-progress-bar").style.width="0%";
  try{
    const movie=await uploadVideo(file,title,description,category);
    const poster=$("#movie-upload-poster").files[0];
    const posterData=poster&&poster.size<=8*1024*1024?await readDataUrl(poster):generatedPosterData;
    if(posterData){try{const pr=await fetch("/api/movies/"+encodeURIComponent(movie.id)+"/poster",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:posterData})});if(pr.ok){const pd=await pr.json();movie.posterUrl=pd.movie.posterUrl}}catch{}}
    movies.unshift(movie);render();closeUpload();$("#movie-upload-title").value="";$("#movie-upload-description").value="";$("#movie-upload-video").value="";$("#movie-upload-poster").value="";resetPosterPreview();$("#movie-upload-file-label").textContent="Choose a video";
  }catch(e){status.textContent=e.message}
  finally{button.disabled=false}
}

async function init(){
 try{
  await Promise.all([loadLibrary(),loadUser()]);
  $("#movies-featured-watch").onclick=()=>{const first=movies.find(m=>currentLibrary==="public"?m.visibility==="public":currentUser&&m.ownerId===currentUser.id);if(first)openMovie(first)};
  $("#movies-random").onclick=()=>{const list=movies.filter(m=>currentLibrary==="public"?m.visibility==="public":currentUser&&m.ownerId===currentUser.id);if(list.length)openMovie(list[Math.floor(Math.random()*list.length)])};
  $("#movies-search").oninput=render;
  document.querySelectorAll(".movie-filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".movie-filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;render()});
  document.querySelectorAll(".movie-library-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".movie-library-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentLibrary=b.dataset.library;activeFilter="all";document.querySelectorAll(".movie-filter").forEach(x=>x.classList.remove("active"));document.querySelector(".movie-filter[data-filter=\"all\"]")?.classList.add("active");render()});
  document.querySelectorAll("[data-close-movie]").forEach(x=>x.onclick=closeMovie);
  document.querySelectorAll("[data-close-upload]").forEach(x=>x.onclick=closeUpload);
  $("#movies-upload-open").onclick=()=>{if(!currentUser){openUpload();return}currentLibrary="mine";document.querySelector(".movie-library-tab[data-library=\"mine\"]")?.click();openUpload()};$("#movie-upload-submit").onclick=submitUpload;
  $("#movie-upload-video").onchange=async e=>{const file=e.target.files[0];$("#movie-upload-file-label").textContent=file?.name||"Choose a video";resetPosterPreview();if(file){try{generatedPosterData=await makeVideoPoster(file);showPosterPreview(generatedPosterData,"Automatic frame from video")}catch{}}};
  $("#movie-upload-poster").onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){$("#movie-upload-status").textContent="Poster images must be 8 MB or smaller.";e.target.value="";return}try{showPosterPreview(await readDataUrl(file),"Your uploaded poster")}catch{}};
  const video=$("#movie-player");
  $("#movie-play").onclick=togglePlayback;$("#movie-big-play").onclick=togglePlayback;
  video.addEventListener("play",setPlayIcon);video.addEventListener("pause",setPlayIcon);video.addEventListener("canplay",()=>{$("#movie-player-error").hidden=true;setPlayIcon()});video.addEventListener("timeupdate",syncPlayer);video.addEventListener("loadedmetadata",syncPlayer);video.addEventListener("ended",setPlayIcon);
  let mediaRecoveryAttempts=0,mediaRecoveryTimer=0;const recoverMedia=()=>{if(mediaRecoveryAttempts>=3||!video.src)return;clearTimeout(mediaRecoveryTimer);mediaRecoveryTimer=setTimeout(()=>{if(video.readyState>=3||video.paused)return;const wasPlaying=!video.paused,current=video.currentTime;mediaRecoveryAttempts++;video.load();video.addEventListener("loadedmetadata",()=>{try{video.currentTime=Math.min(current,Math.max(0,(video.duration||current)-0.05))}catch{}},{once:true});if(wasPlaying)video.play().catch(()=>{})},700)};video.addEventListener("stalled",recoverMedia);video.addEventListener("waiting",recoverMedia);video.addEventListener("progress",()=>{mediaRecoveryAttempts=0});video.addEventListener("error",()=>{const code=video.error?.code;if(code===2){recoverMedia();return}$("#movie-player-error").textContent=code===4?"This video format is not supported by your browser. MP4 (H.264/AAC) is recommended.":"That video could not be loaded. Check the upload and try again.";$("#movie-player-error").hidden=false});
  $("#movie-progress").oninput=e=>{if(video.duration)video.currentTime=Number(e.target.value)/100*video.duration};
  $("#movie-mute").onclick=()=>{video.muted=!video.muted;$("#movie-mute i").className=video.muted?"fa-solid fa-volume-xmark":"fa-solid fa-volume-high"};
  $("#movie-fullscreen").onclick=()=>{const wrap=$(".movie-player-wrap");if(document.fullscreenElement)document.exitFullscreen();else wrap.requestFullscreen?.()};
  document.addEventListener("keydown",e=>{if(!$("#movie-modal").hidden){if(e.key==="Escape")closeMovie();if(e.key===" "&&document.activeElement.tagName!=="INPUT"){e.preventDefault();togglePlayback()}if(e.key==="ArrowRight")video.currentTime=Math.min(video.duration||0,video.currentTime+5);if(e.key==="ArrowLeft")video.currentTime=Math.max(0,video.currentTime-5)}if(!$("#movie-upload-modal").hidden&&e.key==="Escape")closeUpload()});
  render();
 }catch(e){console.error(e);$("#movie-grid").innerHTML='<div class="movie-empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Library could not load</h3><p>Try refreshing the page.</p></div>'}
}
document.addEventListener("DOMContentLoaded",init);