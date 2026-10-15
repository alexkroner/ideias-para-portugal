(()=>{
const config=window.IDEIAS_CONFIG||{};
const base=(config.supabaseUrl||'').replace(/\/$/,'');
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)&&!!config.publishableKey;
const sessionKey='ideias-portugal-auth-v1';
let session=null,refreshing=null;
try{session=JSON.parse(localStorage.getItem(sessionKey)||'null')}catch{}
function save(s){session=s;try{if(s)localStorage.setItem(sessionKey,JSON.stringify(s));else localStorage.removeItem(sessionKey)}catch{}}
function setSession(s){save({...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)})}
function message(d){const m=d.msg||d.message||d.error_description||d.error||'Não foi possível concluir o pedido.';if(/Invalid login credentials/i.test(m))return 'Email ou palavra-passe incorretos.';if(/Email not confirmed/i.test(m))return 'Confirma primeiro o teu endereço de email.';if(/Database error saving new user/i.test(m))return 'Não foi possível criar a conta. Verifica se o convite corresponde a este email e ainda está disponível.';if(/rate limit/i.test(m))return 'Foram feitos demasiados pedidos. Aguarda alguns minutos.';if(/Unable to validate email|email address.*invalid/i.test(m))return 'Indica um endereço de email válido.';return m}
async function raw(path,{method='GET',body,token}={}){if(!configured)throw Error('A ligação de contas ainda não foi configurada.');let response;try{response=await fetch(base+path,{method,headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}catch{throw Error('Não foi possível contactar o serviço. Verifica a ligação à Internet.')}const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=null}if(!response.ok){const e=new Error(message(data||{}));e.status=response.status;throw e}return data}
async function refresh(){if(!session)return null;if(refreshing)return refreshing;refreshing=(async()=>{try{const s=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});setSession(s);return s}catch(e){if(e.status===400||e.status===401)save(null);throw e}finally{refreshing=null}})();return refreshing}
async function token(){if(session&&session.expires_at<Date.now()/1000+60)await refresh();return session?.access_token}
async function request(path,options={}){return raw(path,{...options,token:await token()})}
const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,{method:'POST',body});
const redirect=()=>config.siteUrl||location.origin+location.pathname;
let recovery=false;
async function init(){if(!configured)return null;const h=new URLSearchParams(location.hash.slice(1));if(h.get('access_token')&&h.get('refresh_token')){recovery=h.get('type')==='recovery';setSession({access_token:h.get('access_token'),refresh_token:h.get('refresh_token'),expires_in:Number(h.get('expires_in')||3600)});history.replaceState(null,'',location.pathname+location.search)}if(h.get('error_description')){const error=h.get('error_description');history.replaceState(null,'',location.pathname+location.search);throw Error(error)}if(!session)return null;try{const u=await request('/auth/v1/user');return u}catch(e){if(e.status===401||e.status===403){save(null);return null}throw e}}
window.CommunityAPI={configured,config,rpc,request,get recovery(){return recovery},clearRecovery(){recovery=false},init,
 async login(email,password){const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email:email.trim(),password}});setSession(s);return s.user},
 async signup(email,password,name,inviteToken){return raw('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect()),{method:'POST',body:{email,password,data:{display_name:name,invite_token:inviteToken}}})},
 async logout(){if(session){try{await request('/auth/v1/logout',{method:'POST'})}catch{}finally{save(null)}}},
 async recover(email){await raw('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect()),{method:'POST',body:{email}})},
 async updatePassword(password){await request('/auth/v1/user',{method:'PUT',body:{password}});recovery=false},
 async resend(email){await raw('/auth/v1/resend',{method:'POST',body:{type:'signup',email,options:{email_redirect_to:redirect()}}})}
};
})();
