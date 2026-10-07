// This is the only page served before access is granted. No app bundles or data
// are loaded, and neither secret is interpolated into the HTML.
export function gatePage(configured) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Passcode · Santa Clara Permit Review Assistant</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230067a5'/%3E%3Cpath d='M8 10V7a4 4 0 0 1 8 0v3M6 10h12v10H6z' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:#f3f6f8;color:#153d53;font-family:Arial,sans-serif;padding:24px}
main{width:100%;max-width:420px;background:white;padding:36px;border:1px solid #d4dfe5;border-radius:8px;box-shadow:0 8px 28px #153d5310}
.mark{width:44px;height:44px;display:grid;place-items:center;background:#edf5fa;color:#0067a5;border-radius:8px;margin-bottom:24px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.6px;color:#0067a5;text-transform:uppercase}
h1{font-size:27px;line-height:1.2;margin:12px 0}p{font-size:15px;line-height:1.6;color:#526b79}
label{display:block;font-weight:700;font-size:14px;margin:24px 0 9px}input{width:100%;padding:14px;border:1px solid #aebfc9;border-radius:4px;font-size:24px;text-align:center;letter-spacing:12px;color:#153d53}
input:focus{outline:3px solid #0067a530;border-color:#0067a5}button{width:100%;background:#0067a5;color:white;border:0;border-radius:4px;font-size:15px;font-weight:700;padding:15px;margin-top:16px;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}#error{color:#9b2525;font-size:14px;line-height:1.5;margin:12px 0 0}.note{font-size:12px;margin:24px 0 0}
@media(max-width:440px){main{padding:28px 22px}h1{font-size:24px}}
</style></head><body><main>
<div class="mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></div>
<div class="eyebrow">Santa Clara County</div><h1>Permit Review Assistant</h1>
<p>Enter the 4-digit passcode to access the portal.</p>
<form id="access-form"><label for="passcode">4-digit passcode</label>
<input id="passcode" name="passcode" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required autocomplete="off" autofocus aria-describedby="error" ${configured ? "" : "disabled"}>
<p id="error" role="alert" aria-live="polite">${configured ? "" : "Access is unavailable until the administrator configures a valid 4-digit APP_PASSCODE secret."}</p>
<button type="submit" ${configured ? "" : "disabled"}>Unlock portal</button></form>
<p class="note">Prototype — Not an Official County System.</p></main>
<script>
const form=document.getElementById('access-form'),input=document.getElementById('passcode'),error=document.getElementById('error'),button=form.querySelector('button');
input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,4);error.textContent='';input.removeAttribute('aria-invalid')});
form.addEventListener('submit',async event=>{
event.preventDefault();if(!/^[0-9]{4}$/.test(input.value)){error.textContent='Enter exactly 4 numeric digits.';return}
button.disabled=true;button.textContent='Checking…';error.textContent='';
try{const response=await fetch('/api/app-access/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:input.value})});const result=await response.json();
input.value='';if(!response.ok){error.textContent=result.error||'Unable to unlock the portal.';input.setAttribute('aria-invalid','true');input.focus();return}window.location.reload();
}catch{error.textContent='Unable to connect. Please try again.'}finally{button.disabled=false;button.textContent='Unlock portal'}
});
</script></body></html>`;
}
