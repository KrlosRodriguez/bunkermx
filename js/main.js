document.addEventListener('DOMContentLoaded', () => {

// CURSOR
const cur=document.getElementById('cur'),curR=document.getElementById('curR');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cur.style.left=mx+'px';cur.style.top=my+'px'});
(function loop(){rx+=(mx-rx)*.12;ry+=(my-ry)*.12;curR.style.left=rx+'px';curR.style.top=ry+'px';requestAnimationFrame(loop)})();
document.querySelectorAll('a,button,.svc-card,.team-card,.proj-item,.contact-card,.bnk-decl-card,.bnk-step').forEach(el=>{
  el.addEventListener('mouseenter',()=>{cur.style.width='18px';cur.style.height='18px';curR.style.width='52px';curR.style.height='52px'});
  el.addEventListener('mouseleave',()=>{cur.style.width='10px';cur.style.height='10px';curR.style.width='36px';curR.style.height='36px'});
});

// NAV TABS
const tabs=document.querySelectorAll('.tab-link');
const mobs=document.querySelectorAll('.mob-link');
const secs=['inicio','servicios','numeros','talento','proyectos','munet','contacto'];
function setTab(id){tabs.forEach(a=>a.classList.toggle('active',a.dataset.s===id));mobs.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id))}
tabs.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.getElementById(a.dataset.s)?.scrollIntoView({behavior:'smooth'});setTab(a.dataset.s);mob.classList.remove('open');ham.classList.remove('open')}));
mobs.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const id=a.getAttribute('href').replace('#','');document.getElementById(id)?.scrollIntoView({behavior:'smooth'});setTab(id);mob.classList.remove('open');ham.classList.remove('open')}));
const spyObs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)setTab(e.target.id)}),{threshold:.25,rootMargin:'-60px 0px -40% 0px'});
secs.forEach(id=>{const el=document.getElementById(id);if(el)spyObs.observe(el)});

// HAMBURGER
const ham=document.getElementById('ham'),mob=document.getElementById('mob');
ham.addEventListener('click',()=>{ham.classList.toggle('open');mob.classList.toggle('open')});
document.addEventListener('click',e=>{if(!ham.contains(e.target)&&!mob.contains(e.target)){ham.classList.remove('open');mob.classList.remove('open')}});

// EXPAND BUTTONS
document.querySelectorAll('.exp-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const p=document.getElementById(btn.dataset.t);if(!p)return;
    const o=p.classList.toggle('open');btn.classList.toggle('open',o);
  });
});

// ESPACIOS TOGGLE
const espT=document.getElementById('esp-toggle'),espG=document.getElementById('esp-grid'),espI=document.getElementById('esp-ico');
if(espT)espT.addEventListener('click',()=>{const o=espG.classList.toggle('open');espT.classList.toggle('open',o);if(espI)espI.style.transform=o?'rotate(180deg)':'rotate(0deg)'});

// MUNET + PASATONO EXPAND
[['munetProjCard','munetProjExp'],['pasatonoCard','pasatonoExp']].forEach(([cId,pId])=>{
  const c=document.getElementById(cId),p=document.getElementById(pId);
  if(c&&p)c.addEventListener('click',()=>{c.classList.toggle('open');p.classList.toggle('open')});
});

// FILTERS
const fbns=document.querySelectorAll('.f-btn'),pitems=document.querySelectorAll('.proj-item[data-c]');
fbns.forEach(b=>b.addEventListener('click',()=>{
  fbns.forEach(x=>x.classList.remove('active'));b.classList.add('active');
  const f=b.dataset.f;
  pitems.forEach(i=>i.classList.toggle('hidden',f!=='all'&&i.dataset.c!==f));
  document.querySelectorAll('.venue-sep').forEach(s=>s.style.display=f==='all'||f==='venues'?'block':'none');
  const munetExp=document.getElementById('munetProjExp');
  const pasatonoExp=document.getElementById('pasatonoExp');
  if(f!=='all'&&f!=='venues'&&munetExp)munetExp.classList.remove('open');
  if(f!=='all'&&f!=='discografia'&&pasatonoExp)pasatonoExp.classList.remove('open');
}));

// REVEAL
const revObs=new IntersectionObserver(entries=>entries.forEach((e,i)=>{if(e.isIntersecting)setTimeout(()=>e.target.classList.add('vis'),i*60)}),{threshold:.08,rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.rev').forEach(el=>revObs.observe(el));
setTimeout(()=>document.querySelectorAll('.rev').forEach(el=>el.classList.add('vis')),2500);

// CONTACT FORM
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'ENVIANDO...';
    btn.disabled = true;

    // Simulate send (replace with real endpoint)
    setTimeout(() => {
      btn.textContent = 'MENSAJE ENVIADO';
      btn.style.background = '#00E050';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
        contactForm.reset();
      }, 3000);
    }, 1500);
  });
}

}); // end DOMContentLoaded
