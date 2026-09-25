const menuBtn=document.querySelector('.menu-btn');const nav=document.querySelector('.nav');
menuBtn?.addEventListener('click',()=>nav.classList.toggle('open'));
document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
const sections=[...document.querySelectorAll('main section[id]')];
const links=[...document.querySelectorAll('.nav a')];
const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){links.forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+e.target.id))}})},{rootMargin:'-45% 0px -45% 0px'});
sections.forEach(s=>observer.observe(s));
