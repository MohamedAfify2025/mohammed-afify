const menu=document.querySelector('.menu'), nav=document.querySelector('nav');
if(menu&&nav){menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',open);});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));}
const links=[...document.querySelectorAll('nav a')], sections=[...document.querySelectorAll('main section[id]')];
const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){links.forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+e.target.id));}})},{rootMargin:'-35% 0px -55% 0px'});
sections.forEach(s=>observer.observe(s));
document.getElementById('year').textContent=new Date().getFullYear();
