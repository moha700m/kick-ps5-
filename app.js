(() => {
const $ = (id) => document.getElementById(id);
const categories = [
  ["Just Chatting","💬","talk"],["Call of Duty","🎯","call-of-duty"],["Fortnite","🪂","fortnite"],["Grand Theft Auto V","🚗","gta-v"],["Minecraft","⛏️","minecraft"],["Music","🎵","music"],["Counter-Strike","⚡","counter-strike"],["League of Legends","🛡️","league-of-legends"]
];
const getList=(key)=>{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return []}};
let favorites=getList("kicktv-favorites"),recent=getList("kicktv-recent"),current="";
function channelName(raw){return String(raw||"").trim().replace(/^@/,"").replace(/[^a-zA-Z0-9_]/g,"").slice(0,25)}
function save(){localStorage.setItem("kicktv-favorites",JSON.stringify(favorites));localStorage.setItem("kicktv-recent",JSON.stringify(recent))}
function categoryCards(target){$(target).innerHTML=categories.map(([name,icon,slug])=>`<button class="category-card" data-category="${slug}"><span class="cat-icon">${icon}</span><span><strong>${name}</strong><small>مشاهدة البثوث والتصنيف ↗</small></span></button>`).join("")}
function renderQuick(){const list=recent.slice(0,4);$("quickChannels").innerHTML=list.length?list.map(c=>`<button class="channel-card" data-channel="${c}">▶ ${c}<small>تشغيل آخر مشاهدة</small></button>`).join(""):'<div class="muted">ما فيه قنوات سابقة. اكتب اسم قناة بالأعلى وابدأ المشاهدة.</div>'}
function renderFavorites(){ $("favoritesList").innerHTML=favorites.length?favorites.map(c=>`<button class="channel-card" data-channel="${c}">★ ${c}<small>اضغط للتشغيل</small></button>`).join(""):'<div class="muted">قائمة المفضلة فارغة حالياً.</div>'}
function showView(view){["home","browse","favorites","player"].forEach(v=>$(v+"View")?.classList.toggle("hidden",v!==view));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));if(view==="favorites")renderFavorites();window.scrollTo(0,0)}
function play(raw){const c=channelName(raw);if(!c){$("channelInput").focus();return}current=c;recent=[c,...recent.filter(x=>x.toLowerCase()!==c.toLowerCase())].slice(0,8);save();$("playingName").textContent=c;$("officialChannel").href="https://kick.com/"+encodeURIComponent(c);$("kickPlayer").src="https://player.kick.com/"+encodeURIComponent(c)+"?autoplay=true";$("playerLoading").textContent="إذا لم يبدأ البث، قد يكون المشغل غير مدعوم في متصفح PS5.";$("favoriteBtn").textContent=favorites.includes(c)?"★ ضمن المفضلة":"☆ أضف للمفضلة";showView("player")}
function goCategory(slug){window.open("https://kick.com/categories/"+encodeURIComponent(slug),"_blank","noopener")}
categoryCards("categoryGrid");categoryCards("categoryGridBrowse");renderQuick();
$("channelForm").addEventListener("submit",e=>{e.preventDefault();play($("channelInput").value)});
$("focusSearch").addEventListener("click",()=>$("channelInput").focus());
document.addEventListener("click",e=>{const ch=e.target.closest("[data-channel]");if(ch)play(ch.dataset.channel);const cat=e.target.closest("[data-category]");if(cat)goCategory(cat.dataset.category)});
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("backBtn").addEventListener("click",()=>{$("kickPlayer").src="";showView("home")});
$("favoriteBtn").addEventListener("click",()=>{if(!current)return;favorites=favorites.includes(current)?favorites.filter(x=>x!==current):[current,...favorites];save();$("favoriteBtn").textContent=favorites.includes(current)?"★ ضمن المفضلة":"☆ أضف للمفضلة"});
const dialog=$("helpDialog");$("helpBtn").addEventListener("click",()=>dialog.showModal());$("closeHelp").addEventListener("click",()=>dialog.close());$("doneHelp").addEventListener("click",()=>dialog.close());
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.open&& !$("playerView").classList.contains("hidden")){$("backBtn").click()}});
})();