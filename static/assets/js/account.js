(() => {
  const authCard=document.getElementById("auth-card"), profileCard=document.getElementById("profile-card");
  const authForm=document.getElementById("auth-form"), errorEl=document.getElementById("auth-error");
  const resetCard=document.getElementById("password-reset-card");
  const resetEmailForm=document.getElementById("reset-email-form");
  const resetCodeForm=document.getElementById("reset-code-form");
  const resetPasswordForm=document.getElementById("reset-password-form");
  let resetEmail="",resetToken="";
  const profileImageDrafts={avatar:"",banner:"",background:""};
  let profileImageEditorCropper=null,profileImageEditorResolve=null,profileImageEditorKind="";
  const profileImageEditorConfig={
    avatar:{label:"Profile picture",width:512,height:512,aspect:1},
    banner:{label:"Profile banner",width:1200,height:400,aspect:3},
    background:{label:"Profile background",width:1600,height:900,aspect:16/9}
  };
  const readFileData=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
  const imageEditorModal=document.getElementById("profile-image-editor");
  if(imageEditorModal && imageEditorModal.parentElement!==document.body)document.body.appendChild(imageEditorModal);
  const imageEditorImage=document.getElementById("profile-image-editor-image");
  const imageEditorTitle=document.getElementById("profile-image-editor-title");
  const imageEditorSubtitle=document.getElementById("profile-image-editor-subtitle");
  const imageEditorStatus=document.getElementById("profile-image-editor-status");
  const imageEditorSize=document.getElementById("profile-image-editor-size");
  const imageEditorStretchX=document.getElementById("profile-image-editor-stretch-x");
  const imageEditorStretchY=document.getElementById("profile-image-editor-stretch-y");
  const imageEditorSizeValue=document.getElementById("profile-image-editor-size-value");
  const imageEditorStretchXValue=document.getElementById("profile-image-editor-stretch-x-value");
  const imageEditorStretchYValue=document.getElementById("profile-image-editor-stretch-y-value");
  const setImageEditorButton=(id,active)=>document.getElementById(id)?.classList.toggle("active",active);
  const resetImageEditorControls=()=>{
    imageEditorSize.value="100";imageEditorStretchX.value="100";imageEditorStretchY.value="100";
    imageEditorSizeValue.textContent="100%";imageEditorStretchXValue.textContent="100%";imageEditorStretchYValue.textContent="100%";
    setImageEditorButton("profile-image-editor-crop",true);setImageEditorButton("profile-image-editor-move",false);
  };
  const closeImageEditor=()=>{
    if(profileImageEditorCropper){profileImageEditorCropper.destroy();profileImageEditorCropper=null;}
    if(imageEditorModal)imageEditorModal.hidden=true;
    document.body.classList.remove("profile-image-editor-open");
    const resolve=profileImageEditorResolve;profileImageEditorResolve=null;
    if(resolve)resolve(null);
  };
  async function openImageEditor(kind,file){
    if(!file)return null;
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type))throw new Error("Use PNG, JPG, WEBP, or GIF images.");
    if(file.size>8*1024*1024)throw new Error("Images must be smaller than 8 MB.");
    if(!window.Cropper)throw new Error("The image editor could not load. Please reload the page and try again.");
    const data=await readFileData(file);
    const cfg=profileImageEditorConfig[kind];
    return new Promise(resolve=>{
      profileImageEditorResolve=resolve;profileImageEditorKind=kind;
      imageEditorTitle.textContent="Edit "+cfg.label;
      imageEditorSubtitle.textContent="Crop, move, rotate, stretch, and resize your "+cfg.label.toLowerCase()+" before uploading.";
      imageEditorStatus.textContent="Drag the image to move it. Resize the crop frame when Crop is active.";
      resetImageEditorControls();
      imageEditorImage.src=data;imageEditorModal.hidden=false;document.body.classList.add("profile-image-editor-open");
      requestAnimationFrame(()=>{profileImageEditorCropper=new Cropper(imageEditorImage,{
        aspectRatio:cfg.aspect,viewMode:1,autoCropArea:.9,background:false,responsive:true,restore:false,guides:true,center:true,highlight:true,
        movable:true,rotatable:true,scalable:true,zoomable:true,zoomOnWheel:true,cropBoxMovable:true,cropBoxResizable:true,
        ready(){const imageData=this.cropper.getImageData();const ratio=Math.max(.25,Math.min(3,imageData.width/Math.max(1,imageData.naturalWidth)));imageEditorSize.value=String(Math.round(ratio*100));imageEditorSizeValue.textContent=Math.round(ratio*100)+"%";}
      });});
    });
  }
  document.getElementById("profile-image-editor-close")?.addEventListener("click",closeImageEditor);
  document.getElementById("profile-image-editor-cancel")?.addEventListener("click",closeImageEditor);
  imageEditorModal?.addEventListener("click",e=>{if(e.target===imageEditorModal)closeImageEditor();});
  document.getElementById("profile-image-editor-crop")?.addEventListener("click",()=>{profileImageEditorCropper?.setDragMode("crop");setImageEditorButton("profile-image-editor-crop",true);setImageEditorButton("profile-image-editor-move",false);});
  document.getElementById("profile-image-editor-move")?.addEventListener("click",()=>{profileImageEditorCropper?.setDragMode("move");setImageEditorButton("profile-image-editor-crop",false);setImageEditorButton("profile-image-editor-move",true);});
  document.getElementById("profile-image-editor-rotate-left")?.addEventListener("click",()=>profileImageEditorCropper?.rotate(-90));
  document.getElementById("profile-image-editor-rotate-right")?.addEventListener("click",()=>profileImageEditorCropper?.rotate(90));
  document.getElementById("profile-image-editor-reset")?.addEventListener("click",()=>{profileImageEditorCropper?.reset();resetImageEditorControls();});
  imageEditorSize?.addEventListener("input",()=>{const value=Number(imageEditorSize.value);imageEditorSizeValue.textContent=value+"%";profileImageEditorCropper?.zoomTo(value/100);});
  imageEditorStretchX?.addEventListener("input",()=>{const value=Number(imageEditorStretchX.value);imageEditorStretchXValue.textContent=value+"%";profileImageEditorCropper?.scaleX(value/100);});
  imageEditorStretchY?.addEventListener("input",()=>{const value=Number(imageEditorStretchY.value);imageEditorStretchYValue.textContent=value+"%";profileImageEditorCropper?.scaleY(value/100);});
  document.getElementById("profile-image-editor-save")?.addEventListener("click",()=>{
    if(!profileImageEditorCropper||!profileImageEditorResolve)return;
    const cfg=profileImageEditorConfig[profileImageEditorKind];
    try{
      const canvas=profileImageEditorCropper.getCroppedCanvas({width:cfg.width,height:cfg.height,maxWidth:4096,maxHeight:4096,imageSmoothingEnabled:true,imageSmoothingQuality:"high"});
      if(!canvas)throw new Error("The edited image could not be created.");
      const type=profileImageEditorKind==="avatar"?"image/png":"image/jpeg";
      const data=canvas.toDataURL(type,type==="image/jpeg"?.92:undefined);
      const resolve=profileImageEditorResolve;profileImageEditorResolve=null;
      profileImageEditorCropper.destroy();profileImageEditorCropper=null;imageEditorModal.hidden=true;document.body.classList.remove("profile-image-editor-open");resolve(data);
    }catch(error){
      imageEditorStatus.textContent=error.message||"Could not save the edited image.";
    }
  });
  const setProfileImagePreview=(kind,url)=>{
    const preview=document.getElementById("profile-"+kind+"-current");
    if(!preview)return;
    const image=preview.querySelector("img");
    preview.hidden=!url;
    if(url)image.src=url;
    else image.removeAttribute("src");
  };
  const applyProfileDraftPreview=(kind,data)=>{
    if(!data)return;
    if(kind==="avatar")document.getElementById("profile-avatar").innerHTML='<img src="'+data+'" alt="">';
    else document.getElementById("profile-"+kind).style.backgroundImage='url("'+data+'")';
    setProfileImagePreview(kind,data);
  };
  const profileForm=document.getElementById("profile-form"), profileSaveButton=document.getElementById("save-profile-button");
  const tabs=[...document.querySelectorAll(".auth-tab")]; let mode="login", user=null;
  const switcher=document.getElementById("account-switcher");
  const savedAccountsList=document.getElementById("saved-accounts-list");
  const switchError=document.getElementById("account-switch-error");
  const api=async(url,options)=>{const res=await fetch(url,{credentials:"same-origin",...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Something went wrong.");return data;};
  const saveBrowserCredential=async(identifier,password)=>{
    if(!identifier||!password)return;
    try{
      if(window.PasswordCredential && navigator.credentials?.store){
        const credential=new PasswordCredential({id:String(identifier).trim(),password:String(password)});
        await navigator.credentials.store(credential);
      }
    }catch{}
  };

  const showResetStep=step=>{if(!resetCard)return;[resetEmailForm,resetCodeForm,resetPasswordForm].forEach((form,index)=>{if(form)form.hidden=index+1!==step;});document.querySelectorAll("#reset-progress span").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)<=step));document.getElementById("reset-title").textContent=step===1?"Reset your password":step===2?"Check your email":"Choose a new password";document.getElementById("reset-subtitle").textContent=step===1?"Enter the email connected to your Lunar account.":step===2?"Enter the 6-digit code we sent to your email.":"Set a new password for your Lunar account.";};
  const openReset=()=>{authCard.hidden=true;profileCard.hidden=true;resetCard.hidden=false;resetEmail=document.getElementById("auth-identifier").value.trim();document.getElementById("reset-email").value=resetEmail;document.getElementById("reset-email-error").textContent="";document.getElementById("reset-code-error").textContent="";document.getElementById("reset-password-error").textContent="";showResetStep(1);document.getElementById("reset-email").focus();};
  const closeReset=()=>{resetCard.hidden=true;authCard.hidden=false;profileCard.hidden=true;setMode("login");document.getElementById("auth-identifier").focus();};
  const setMode=m=>{mode=m;const reg=m==="register";tabs.forEach(t=>t.classList.toggle("active",t.dataset.mode===m));
    document.getElementById("auth-title").textContent=reg?"Create your Lunar account":"Welcome back";
    document.getElementById("auth-subtitle").textContent=reg?"Use an email, username, and password to create your profile.":"Log in with your username or email.";
    document.getElementById("auth-submit").textContent=reg?"Create Account":"Log In";
    document.getElementById("forgot-password-button").hidden=reg;
    ["register-username-row","email-row","display-name-row"].forEach(id=>document.getElementById(id).hidden=!reg);
    document.getElementById("identifier-label").hidden=reg; document.getElementById("auth-identifier").required=!reg;
    document.getElementById("auth-username").required=reg; document.getElementById("auth-email").required=reg;
    document.getElementById("auth-password").autocomplete=reg?"new-password":"current-password";
    document.getElementById("password-helper").textContent=reg?"Use Generate for a strong password, or let your browser suggest one.":"Use your saved password, or enter it manually.";
    document.getElementById("generate-password").hidden=!reg;
    document.getElementById("generate-username").disabled=!reg;
    document.getElementById("generate-display-name").disabled=!reg;
    errorEl.textContent="";};
  const randomIndex=max=>{const values=new Uint32Array(1);crypto.getRandomValues(values);return values[0]%max;};
  const usernameAdjectives=["Lunar","Nova","Cosmic","Pixel","Stellar","Moon","Orbit","Solar","Frost","Nebula"];
  const usernameNouns=["Fox","Wolf","Byte","Wave","Star","Comet","Echo","Drift","Ray","Spark"];
  const displayAdjectives=["Lunar","Nova","Cosmic","Starlit","Moonlit","Silver","Solar","Velvet","Astral","Quiet"];
  const displayNouns=["Rider","Dreamer","Voyager","Explorer","Pixel","Comet","Orbit","Wanderer","Signal","Pilot"];
  const generateUsername=()=>{
    const value=usernameAdjectives[randomIndex(usernameAdjectives.length)]+usernameNouns[randomIndex(usernameNouns.length)]+String(100+randomIndex(900));
    document.getElementById("auth-username").value=value.slice(0,20);
  };
  const generateDisplayName=()=>{
    document.getElementById("auth-display-name").value=(displayAdjectives[randomIndex(displayAdjectives.length)]+" "+displayNouns[randomIndex(displayNouns.length)]).slice(0,20);
  };
  const passwordToggle=document.getElementById("auth-password-toggle");
  const passwordInput=document.getElementById("auth-password");
  const syncPasswordToggle=()=>{
    if(!passwordToggle||!passwordInput)return;
    const visible=passwordInput.type==="text";
    passwordToggle.setAttribute("aria-label",visible?"Hide password":"Show password");
    passwordToggle.setAttribute("aria-pressed",String(visible));
    passwordToggle.innerHTML='<i class="fa-solid '+(visible?"fa-eye-slash":"fa-eye")+'"></i><span>'+(visible?"Hide":"Show")+'</span>';
  };
  passwordToggle?.addEventListener("click",()=>{
    if(!passwordInput)return;
    passwordInput.type=passwordInput.type==="password"?"text":"password";
    syncPasswordToggle();
    passwordInput.focus();
  });
  syncPasswordToggle();
  const generatePassword=()=>{
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";
    const required=["ABCDEFGHJKLMNPQRSTUVWXYZ","abcdefghijkmnopqrstuvwxyz","23456789","!@#$%^&*_-+="];
    const pick=set=>set[randomIndex(set.length)];
    let value=required.map(pick).join("");
    const bytes=new Uint32Array(18);crypto.getRandomValues(bytes);
    for(const byte of bytes)value+=chars[byte%chars.length];
    value=value.split("").sort(()=>randomIndex(2)-1).join("");
    const input=document.getElementById("auth-password");
    input.value=value.slice(0,22);
    input.dispatchEvent(new Event("input",{bubbles:true}));
  };
  document.getElementById("generate-username")?.addEventListener("click",generateUsername);
  document.getElementById("generate-display-name")?.addEventListener("click",generateDisplayName);
  document.getElementById("generate-password")?.addEventListener("click",generatePassword);
  const initials=n=>(n||"?").trim().slice(0,2).toUpperCase();
  const setProfile=()=>{authCard.hidden=true;profileCard.hidden=false;
    document.getElementById("profile-display").textContent=user.displayName;
    document.getElementById("profile-username").textContent="@"+user.username;
    document.getElementById("profile-avatar").innerHTML=user.avatarUrl?'<img src="'+user.avatarUrl+'" alt="">':initials(user.displayName);
    document.getElementById("profile-username-input").value=user.username||"";
    document.getElementById("profile-email").value=user.email||"";
    document.getElementById("profile-name").value=user.displayName||"";
    document.getElementById("profile-status").value=user.status||"";
    document.getElementById("profile-bio").value=user.bio||"";
    document.getElementById("profile-banner").style.backgroundImage=user.bannerUrl?'url("'+user.bannerUrl+'")':"";
    document.getElementById("profile-background").style.backgroundImage=user.backgroundUrl?'url("'+user.backgroundUrl+'")':"";
    setProfileImagePreview("avatar",user.avatarUrl||"");
    setProfileImagePreview("banner",user.bannerUrl||"");
    setProfileImagePreview("background",user.backgroundUrl||"");
    renderStickerCatalog(user.stickers || []);
    loadSavedAccounts();
  };
  const accountInitials=n=>(n||"?").trim().slice(0,2).toUpperCase();
  async function loadSavedAccounts(){
    if(!savedAccountsList)return;
    try{
      const data=await api("/api/auth/saved-accounts");
      const accounts=data.accounts||[];
      savedAccountsList.innerHTML=accounts.map(a=>'<div class="saved-account '+(user&&a.id===user.id?"current":"")+'"><span class="saved-account-avatar">'+(a.avatarUrl?'<img src="'+a.avatarUrl+'" alt="">':accountInitials(a.displayName||a.username))+'</span><span class="saved-account-copy"><strong>'+String(a.displayName||a.username).replace(/[<>&"]/g,"")+'</strong><span>@'+String(a.username||"").replace(/[<>&"]/g,"")+'</span></span><button type="button" class="saved-account-action" data-switch-user="'+String(a.id).replace(/[^A-Za-z0-9_-]/g,"")+'" '+(user&&a.id===user.id?"disabled":"")+'>'+((user&&a.id===user.id)?"Current":"Switch")+'</button></div>').join("");
      if(!accounts.length)savedAccountsList.innerHTML='<div class="saved-account-copy"><strong>No accounts added yet.</strong><span>Add an account below to save it on this browser.</span></div>';
    }catch(e){savedAccountsList.innerHTML='<div class="saved-account-copy"><span>Could not load saved accounts.</span></div>';}
  }
  async function openAccountSwitcher(){
    if(!switcher)return;
    switchError.textContent="";
    switcher.hidden=false;
    await loadSavedAccounts();
  }
  function showAuthForAdding(){
    switcher.hidden=true;
    authCard.hidden=false;
    profileCard.hidden=true;
    setMode("login");
    document.getElementById("auth-identifier").value="";
    document.getElementById("auth-password").value="";
    document.getElementById("auth-identifier").focus();
  }
  const renderStickerCatalog=stickers=>{
    const grid=document.getElementById("account-sticker-grid"),empty=document.getElementById("account-sticker-empty"),count=document.getElementById("account-sticker-count");
    if(!grid)return;
    grid.innerHTML=(stickers||[]).map(s=>'<div class="profile-public-sticker account-sticker-item" title="'+String(s.name||"Sticker").replace(/"/g,"&quot;")+'"><img src="'+String(s.url||"").replace(/"/g,"&quot;")+'" alt="'+String(s.name||"Sticker").replace(/"/g,"&quot;")+'" loading="lazy"><button type="button" class="account-sticker-remove" data-sticker-id="'+String(s.id||"").replace(/[^A-Za-z0-9_-]/g,"")+'" aria-label="Remove '+String(s.name||"sticker").replace(/"/g,"&quot;")+'"><i class="fa-solid fa-xmark"></i></button></div>').join("");
    empty.hidden=Boolean(stickers?.length);
    count.textContent=stickers?.length?" · "+stickers.length:"";
  };
  document.getElementById("account-sticker-grid")?.addEventListener("click",async e=>{
    const button=e.target.closest(".account-sticker-remove");
    if(!button)return;
    const stickerId=button.dataset.stickerId;
    if(!stickerId)return;
    button.disabled=true;
    try{
      const data=await api("/api/stickers/"+encodeURIComponent(stickerId),{method:"DELETE"});
      user.stickers=data.stickers||[];
      renderStickerCatalog(user.stickers);
    }catch(error){
      button.disabled=false;
      document.getElementById("profile-error").textContent=error.message;
    }
  });
  const profileImageInputMap={avatar:"profile-avatar-file",banner:"profile-banner-file",background:"profile-background-file"};
  const profileImageCurrentUrl=kind=>profileImageDrafts[kind]||({avatar:user?.avatarUrl,banner:user?.bannerUrl,background:user?.backgroundUrl}[kind]||"");
  async function editExistingProfileImage(kind){
    const url=profileImageCurrentUrl(kind);
    if(!url){
      document.getElementById(profileImageInputMap[kind])?.click();
      return;
    }
    try{
      const response=await fetch(new URL(url,location.origin).href,{credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw new Error("Could not load that image for editing.");
      const blob=await response.blob();
      const file=new File([blob],"profile-image."+((blob.type||"image/jpeg").split("/")[1]||"jpg"),{type:blob.type||"image/jpeg"});
      const data=await openImageEditor(kind,file);
      if(data){profileImageDrafts[kind]=data;applyProfileDraftPreview(kind,data);}
    }catch(error){document.getElementById("profile-error").textContent=error.message;}
  }
  document.querySelectorAll("[data-profile-image-choose]").forEach(button=>button.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    document.getElementById(profileImageInputMap[button.dataset.profileImageChoose])?.click();
  }));
  document.querySelectorAll("[data-profile-image-edit]").forEach(button=>button.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    editExistingProfileImage(button.dataset.profileImageEdit);
  }));

  Object.entries(profileImageInputMap).forEach(([kind,id])=>document.getElementById(id)?.addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{const data=await openImageEditor(kind,file);if(!data){e.target.value="";return;}profileImageDrafts[kind]=data;applyProfileDraftPreview(kind,data);}
    catch(error){e.target.value="";document.getElementById("profile-error").textContent=error.message;}
  }));
  const returnTo = new URLSearchParams(location.search).get("returnTo") || "/";
  const savedLogin = localStorage.getItem("ls_login_identifier") || "";
  const identifierInput = document.getElementById("auth-identifier");
  if (identifierInput) identifierInput.value = savedLogin;
  tabs.forEach(t=>t.addEventListener("click",()=>setMode(t.dataset.mode)));
  document.getElementById("forgot-password-button")?.addEventListener("click",openReset);
  document.getElementById("reset-back-button")?.addEventListener("click",closeReset);
  resetEmailForm?.addEventListener("submit",async e=>{e.preventDefault();const error=document.getElementById("reset-email-error"),button=document.getElementById("reset-email-submit");error.textContent="";button.disabled=true;resetEmail=document.getElementById("reset-email").value.trim().toLowerCase();try{await api("/api/auth/password-reset/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:resetEmail})});showResetStep(2);document.getElementById("reset-code").focus();}catch(err){error.textContent=err.message;}finally{button.disabled=false;}});
  resetCodeForm?.addEventListener("submit",async e=>{e.preventDefault();const error=document.getElementById("reset-code-error"),button=document.getElementById("reset-code-submit");error.textContent="";button.disabled=true;try{const data=await api("/api/auth/password-reset/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:resetEmail,code:document.getElementById("reset-code").value.trim()})});resetToken=data.resetToken;showResetStep(3);document.getElementById("reset-password").focus();}catch(err){error.textContent=err.message;}finally{button.disabled=false;}});
  document.getElementById("reset-resend-button")?.addEventListener("click",async()=>{document.getElementById("reset-code-error").textContent="";const button=document.getElementById("reset-resend-button");button.disabled=true;try{await api("/api/auth/password-reset/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:resetEmail})});document.getElementById("reset-code-error").textContent="A new verification code was sent.";}catch(err){document.getElementById("reset-code-error").textContent=err.message;}finally{button.disabled=false;}});
  resetPasswordForm?.addEventListener("submit",async e=>{e.preventDefault();const error=document.getElementById("reset-password-error"),button=document.getElementById("reset-password-submit");error.textContent="";const password=document.getElementById("reset-password").value,confirm=document.getElementById("reset-password-confirm").value;if(password!==confirm){error.textContent="The passwords do not match.";return;}button.disabled=true;try{await api("/api/auth/password-reset/complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resetToken,password})});resetToken="";alert("Your password was changed. Please log in again.");closeReset();document.getElementById("auth-identifier").value=resetEmail;document.getElementById("auth-password").value="";}catch(err){error.textContent=err.message;}finally{button.disabled=false;}});
  authForm.addEventListener("submit",async e=>{e.preventDefault();errorEl.textContent="";const b=document.getElementById("auth-submit");b.disabled=true;
    try{const data=await api(mode==="register"?"/api/auth/register":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="register"?{
      username:document.getElementById("auth-username").value,email:document.getElementById("auth-email").value,
      displayName:document.getElementById("auth-display-name").value,password:document.getElementById("auth-password").value}:{
      identifier:document.getElementById("auth-identifier").value,password:document.getElementById("auth-password").value})});
      const credentialIdentifier=mode==="register"
        ? document.getElementById("auth-username").value.trim()
        : document.getElementById("auth-identifier").value.trim();
      const credentialPassword=document.getElementById("auth-password").value;
      if (mode === "login") localStorage.setItem("ls_login_identifier", credentialIdentifier);
      await saveBrowserCredential(credentialIdentifier,credentialPassword);
      user=data.user;
      if(window.store?.loadAccountSettings) await window.store.loadAccountSettings();
      setProfile(); setTimeout(() => { location.href = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"; }, 120);}
    catch(err){errorEl.textContent=err.message;}finally{b.disabled=false;}});
  profileForm.addEventListener("submit",async e=>{e.preventDefault();const ok=document.getElementById("profile-success"),err=document.getElementById("profile-error");ok.textContent="";err.textContent="";
    const username=document.getElementById("profile-username-input").value.trim();
    const email=document.getElementById("profile-email").value.trim();
    const displayName=document.getElementById("profile-name").value.trim();
    if(!/^[A-Za-z0-9_]{4,20}$/.test(username)){err.textContent="Username must be 4–20 characters using letters, numbers, or underscores.";return;}
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)){err.textContent="Please enter a valid email address.";return;}
    if(!displayName){err.textContent="Display name cannot be empty.";return;}
    profileSaveButton.disabled=true;
    profileSaveButton.textContent="Saving...";
    try{
      const data=await api("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        username,email,
        displayName,status:document.getElementById("profile-status").value.trim(),
        bio:document.getElementById("profile-bio").value.trim(),
        avatarData:profileImageDrafts.avatar,
        bannerData:profileImageDrafts.banner,
        backgroundData:profileImageDrafts.background})});
      user=data.user;profileImageDrafts.avatar="";profileImageDrafts.banner="";profileImageDrafts.background="";setProfile();["profile-avatar-file","profile-banner-file","profile-background-file"].forEach(id=>document.getElementById(id).value="");ok.textContent="Profile saved."
    }catch(e2){err.textContent=e2.message;}finally{profileSaveButton.disabled=false;profileSaveButton.textContent="Save Profile";}});
  document.getElementById("switch-accounts-button")?.addEventListener("click",openAccountSwitcher);
  document.getElementById("close-account-switcher")?.addEventListener("click",()=>{switcher.hidden=true;});
  document.getElementById("add-account-button")?.addEventListener("click",showAuthForAdding);
  savedAccountsList?.addEventListener("click",async e=>{
    const button=e.target.closest("[data-switch-user]");
    if(!button)return;
    switchError.textContent="";
    button.disabled=true;
    try{
      const data=await api("/api/auth/switch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:button.dataset.switchUser})});
      user=data.user;
      if(window.store?.loadAccountSettings) await window.store.loadAccountSettings();
      location.reload();
    }catch(err){
      switchError.textContent=err.message;
      button.disabled=false;
    }
  });
  document.getElementById("logout-button").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch{}user=null;authCard.hidden=false;profileCard.hidden=true;setMode("login");});
  const initialMode = new URLSearchParams(location.search).get("mode");
  api("/api/auth/me").then(async d=>{user=d.user;if(user){if(window.store?.loadAccountSettings) await window.store.loadAccountSettings();setProfile();}else setMode(initialMode==="register"?"register":"login");}).catch(()=>setMode(initialMode==="register"?"register":"login"));
})();

