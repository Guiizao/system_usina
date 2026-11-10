/* Pranchetas Digitais - © 2026 Guilherme. Todos os direitos reservados. Uso somente com autorização do autor (veja LICENCA.txt). */
/* 3.1: as 10 aberturas da logo e os sons, aprovados no protótipo de 09/11. Só carrega com o "Painel novo" ligado (nucleo/iniciar.js). */
(function () {
const O="M90.08 0.05L66.05 0L64.63 0.16L63.11 0.6L60.6 1.04L58.64 1.63L56.57 2.51L54.44 3.65L53.02 4.63L51.55 5.83L50.25 7.08L48.61 8.94L47.08 11.01L45.34 13.95L45.18 14.5L44.8 15.15L44.52 16.19L44.25 16.73L43.65 19.18L43.16 23.16L43.11 71.5L42.94 73.24L42.34 74.99L41.8 75.8L40.93 76.68L40.38 77.11L39.4 77.66L38.2 78.04L37.28 78.2L36.13 78.15L34.6 77.71L33.51 77.11L32.86 76.62L31.72 75.26L31.12 74.06L30.84 72.7L30.74 23.87L30.52 20.16L30.25 17.6L29.86 15.64L29.48 14.77L29.26 13.84L28.94 13.3L28.66 12.53L27.63 10.68L25.99 8.45L25.34 7.68L23.6 5.94L22.23 4.8L20.71 3.71L17.71 2.07L14.66 0.98L11.06 0.33L10.25 0.33L9.92 0.6L9.75 0.98L9.65 2.13L9.59 30.03L9.65 60.38L9.92 64.47L10.25 66.1L10.41 67.47L10.79 68.83L11.06 70.3L11.34 70.95L11.5 71.77L11.83 72.53L12.1 73.57L12.43 74.17L12.64 74.99L12.97 75.53L13.13 76.13L13.57 76.89L13.62 77.17L14.06 77.87L14.82 79.51L16.4 82.07L18.69 85.18L20.71 87.47L23.54 90.19L26.21 92.32L27.63 93.3L30.41 94.99L33.95 96.73L35.75 97.38L36.29 97.66L37 97.82L38.31 98.31L42.23 99.29L46.05 99.84L49.1 100L52.92 99.89L57.06 99.35L61.36 98.31L64.52 97.22L65.18 96.89L65.89 96.68L66.7 96.24L66.98 96.19L69.26 95.04L71.34 93.84L75.1 91.23L78.2 88.5L80.54 86.05L83.22 82.62L83.43 82.18L84.8 80.16L85.01 79.62L85.83 78.26L86.59 76.73L86.7 76.29L87.08 75.64L87.25 75.04L87.57 74.44L87.79 73.62L88.12 73.02L88.28 72.21L88.66 71.34L88.88 70.25L89.16 69.48L89.43 67.9L89.7 67.03L90.3 62.45L90.41 54.44L90.35 54.11L90.41 0.71L90.25 0.22Z";
const I="M68.56 4.63L69.05 4.96L69.16 5.23L69.1 71.23L68.61 74.55L68.17 75.8L68.07 76.46L67.68 77.22L67.52 77.82L66.38 80L65.4 81.42L64.36 82.67L62.89 84.14L61.58 85.23L59.95 86.32L57.87 87.41L57.06 87.68L56.57 87.96L55.86 88.12L54.88 88.5L53.19 88.83L51.28 89.05L49.48 89.05L47.47 88.83L45.61 88.5L44.74 88.17L43.92 88.01L43.11 87.63L42.51 87.47L40.22 86.32L38.58 85.18L37.71 84.41L36.62 83.32L36.35 82.89L36.35 82.72L36.62 82.4L37.17 82.18L39.02 81.91L40.76 81.36L41.96 80.82L43.6 79.73L45.12 78.15L46.1 76.62L46.43 75.69L46.76 75.1L47.25 72.75L47.3 21.47L47.52 19.78L48.01 17.71L49.16 14.99L50.08 13.41L51.23 11.83L53.3 9.59L54.5 8.56L55.86 7.57L57.71 6.49L59.07 5.83L60.71 5.23L62.62 4.74L64.85 4.47L67.08 4.47Z";
const pontos=d=>d.replace(/[MZ]/g,'').split('L').map(p=>p.trim().split(/\s+/).map(Number));
function amostrar(p,n){p=p.concat([p[0]]);const c=[0];for(let i=1;i<p.length;i++)c.push(c[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));const L=c[c.length-1],s=[];let k=0;for(let j=0;j<=n;j++){const a=j/n*L;while(k<p.length-2&&c[k+1]<a)k++;const t=(a-c[k])/(c[k+1]-c[k]||1);s.push([p[k][0]+(p[k+1][0]-p[k][0])*t,p[k][1]+(p[k+1][1]-p[k][1])*t]);}return s;}
const SO=amostrar(pontos(O),252),SI=amostrar(pontos(I),126),TODOS=SO.concat(SI),logo=new Path2D(O+I);
let sem=11;const rnd=()=>(sem=sem*16807%2147483647)/2147483647;
const lim=v=>Math.max(0,Math.min(1,v)),fora=p=>1-Math.pow(1-p,3),sua=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2,suave=(a,b,x)=>{const t=lim((x-a)/(b-a));return t*t*(3-2*t);},volta=p=>1+2.4*Math.pow(p-1,3)+1.4*Math.pow(p-1,2);
const VERDE='57,224,111',CLARO='236,255,241';let BLOOM=1;
// 3.1.5: o protótipo tinha um palco fixo de 4:3 (273 x 205) em volta da logo e, no celular em pé, sobrava tela vazia. V: a tela em unidades da logo;
// KX/KY: quanto ela é maior que o palco de 4:3 em cada eixo; KM: o maior. orb: perto da logo é círculo, longe estica até a borda da tela.
let KX=1,KY=1,KM=1,V={x0:-86.7,x1:186.7,y0:-52.5,y1:152.5};
const orb=(a,d,cx=50,cy=50)=>{const k=lim((d-70)/130);return[cx+Math.cos(a)*d*(1+(Math.max(1,KX)-1)*k),cy+Math.sin(a)*d*(1+(Math.max(1,KY)-1)*k)];},pe=(x,y)=>[50+(x-50)*KX,50+(y-50)*KY];
const tela=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function fundo(W,H){const c=tela(W,H),g=c.getContext('2d'),f=g.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.62);f.addColorStop(0,'#323a36');f.addColorStop(.55,'#1a1f1d');f.addColorStop(1,'#0c0f0e');g.fillStyle=f;g.fillRect(0,0,W,H);const n=tela(140,140),q=n.getContext('2d'),d=q.createImageData(140,140);for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=7;}q.putImageData(d,0,0);g.fillStyle=g.createPattern(n,'repeat');g.fillRect(0,0,W,H);return c;}
function escala(g,s,f){g.save();g.translate(50,50);g.scale(s,s);g.translate(-50,-50);f();g.restore();}
function placa(g,a){if(a<=0)return;g.save();g.globalAlpha=a;g.fillStyle='#fff';g.beginPath();g.roundRect(-16,-16,132,132,26);g.fill();g.restore();}
function logoEm(g,a=1){if(a<=0)return;g.save();g.globalAlpha=a;g.fillStyle='#217e33';g.fill(logo,'evenodd');g.restore();}
function cresce(g,e){if(e<=0)return;if(e>=1){logoEm(g);return;}g.save();g.clip(logo,'evenodd');g.strokeStyle='#217e33';g.lineWidth=e*27;g.stroke(logo);g.restore();}
function linha(g,S,i0,i1){g.beginPath();const a=Math.floor(i0),b=Math.min(S.length-1,Math.ceil(i1));g.moveTo(S[a][0],S[a][1]);for(let i=a+1;i<=b;i++)g.lineTo(S[i][0],S[i][1]);}
function neon(g,tracar,a=1){g.save();g.globalCompositeOperation='lighter';g.strokeStyle=`rgba(${VERDE},${.6*a})`;g.lineWidth=2.7;tracar();g.stroke();g.strokeStyle=`rgba(${CLARO},${a})`;g.lineWidth=.85;tracar();g.stroke();g.restore();}
const contorno=g=>{linha(g,SO,0,252);g.closePath();g.moveTo(SI[0][0],SI[0][1]);for(const q of SI)g.lineTo(q[0],q[1]);g.closePath();};
function cauda(g,p,w,cor=VERDE){const n=p.length;for(let i=1;i<n;i++){const k=i/(n-1);g.strokeStyle=`rgba(${k>.8?CLARO:cor},${k*k*.95})`;g.lineWidth=w*(.25+.75*k);g.beginPath();g.moveTo(p[i-1][0],p[i-1][1]);g.lineTo(p[i][0],p[i][1]);g.stroke();}}
function halo(g,a,r=120,cor=VERDE){if(a<=0)return;g.save();g.globalCompositeOperation='lighter';const c=g.createRadialGradient(50,50,0,50,50,r);c.addColorStop(0,`rgba(${cor},${.42*a})`);c.addColorStop(.5,`rgba(${cor},${.12*a})`);c.addColorStop(1,`rgba(${cor},0)`);g.fillStyle=c;g.fillRect(50-r,50-r,2*r,2*r);g.restore();}
function anel(g,T,t0,d=950,a=.7,r1=165){const p=(T-t0)/d;if(p<=0||p>=1)return;g.save();g.globalCompositeOperation='lighter';g.strokeStyle=`rgba(${VERDE},${a*(1-p)*(1-p)})`;g.lineWidth=2.6*(1-p)+.3;g.beginPath();g.arc(50,50,62+(r1*KM-62)*fora(p),0,6.3);g.stroke();g.restore();}
function reflexo(g,T,t0,d=700){const p=(T-t0)/d;if(p<=0||p>=1)return;const x=-50+200*sua(p);g.save();g.clip(logo,'evenodd');const c=g.createLinearGradient(x-20,0,x+20,24);c.addColorStop(0,'rgba(180,255,205,0)');c.addColorStop(.5,'rgba(180,255,205,.82)');c.addColorStop(1,'rgba(180,255,205,0)');g.fillStyle=c;g.fillRect(-20,-20,140,140);g.restore();}
const nuvem=n=>Array.from({length:n},()=>{const a=rnd()*6.283,r=72+rnd()*70;return{a,ra:r,vx:(rnd()-.5)*.012,vy:-.012-rnd()*.022,d:rnd()*260,l:620+rnd()*560,r:.35+rnd()*.6};});
function poeira(g,L,T,t0){g.save();g.globalCompositeOperation='lighter';for(const q of L){const t=T-t0-q.d;if(t<0||t>q.l)continue;g.fillStyle=`rgba(190,255,212,${Math.sin(Math.PI*t/q.l)*.85})`;g.beginPath();const o=orb(q.a,q.ra);g.arc(o[0]+q.vx*t,o[1]+q.vy*t,q.r,0,6.3);g.fill();}g.restore();}
const leque=n=>Array.from({length:n},()=>{const p=TODOS[Math.floor(rnd()*TODOS.length)],a=rnd()*6.283,v=.05+rnd()*.13;return{p,vx:Math.cos(a)*v,vy:Math.sin(a)*v-.05,l:520+rnd()*640};}),BU5=leque(90),BU6=leque(56);
function estouro(g,L,T,t0,gr){const t=T-t0;if(t<=0)return;g.save();g.globalCompositeOperation='lighter';g.lineWidth=.6;for(const f of L){if(t>f.l)continue;const px=u=>f.p[0]+f.vx*u,py=u=>f.p[1]+f.vy*u+gr*u*u,v=Math.max(0,t-30);g.strokeStyle=`rgba(${t<f.l*.4?CLARO:VERDE},${1-t/f.l})`;g.beginPath();g.moveTo(px(v),py(v));g.lineTo(px(t),py(t));g.stroke();}g.restore();}
function pouso(g,T,t0,d,comLogo=false){const p=lim((T-t0)/d);if(p<=0)return 0;const a=sua(lim(p*1.5));escala(g,.93+.07*volta(p),()=>{placa(g,a);if(comLogo)logoEm(g,a);});return p;}

// [ângulo de saída, quanto giram, raio de saída, começo, duração]
const COM=[[3.9,2.6,215,90,560],[.5,2.4,205,340,560],[5.3,2.8,225,620,500],[2.3,2.5,210,880,500],[1.4,2.7,220,1110,460]];
const curva=(c,u)=>orb(c[0]+c[1]*u,c[2]+(60-c[2])*u);
const TRA=[[SO,0,84],[SO,84,168],[SO,168,252],[SI,0,126]],FA1=Array.from({length:110},()=>{const p=TODOS[Math.floor(rnd()*TODOS.length)],a=rnd()*6.283,v=20+rnd()*62;return{p,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:560+rnd()*720};}),P1=nuvem(26);
function m1(g,T){let lz=0;g.save();g.globalCompositeOperation='lighter';for(const c of COM){const p=(T-c[3])/c[4];if(p<=0||p>=1.35)continue;const h=sua(lim(p)),pts=[];for(let i=0;i<=24;i++)pts.push(curva(c,Math.max(0,h-.42*(1-i/24))));g.globalAlpha=lim(1.35-p)/.35>1?1:lim((1.35-p)/.35);cauda(g,pts,1.5);g.globalAlpha=1;lz+=Math.sin(Math.PI*lim(p))*.3;}g.restore();
const a=1320,d=780,b=T-a-d+60;halo(g,lz+suave(1320,2100,T)*.55+(b>0?.4*(1-suave(0,1200,b)):0));if(b<=0)for(const[S,i0,i1]of TRA){const e=sua(lim((T-a)/d));if(e<=0)continue;neon(g,()=>linha(g,S,i0,i0+(i1-i0)*e));}
if(b>0){logoEm(g,sua(lim(b/640)));const fl=1-.3*Math.max(0,Math.sin(T*.05))*(1-suave(220,720,b)),re=.9+.1*Math.sin(T*.0035);neon(g,()=>contorno(g),fl*re);anel(g,T,a+d-60+40,1100,.85);reflexo(g,T,2720,600);g.save();g.globalCompositeOperation='lighter';for(const f of FA1){if(b>f.l)continue;const e=1-Math.exp(-b/300);g.fillStyle=`rgba(${b<f.l*.4?CLARO:VERDE},${Math.pow(1-b/f.l,1.3)})`;g.beginPath();g.arc(f.p[0]+f.vx*e,f.p[1]+f.vy*e,.5,0,6.3);g.fill();}g.restore();poeira(g,P1,T,2300);}}

const R2=[];function faixas(S,n,d0){let f=0,an=0,di=0,cu=0,de=0;const st=Math.floor((S.length-1)/n);for(let k=0;k<n;k++){const i=k*st;if(k%6===0){f++;const m=S[Math.min(S.length-1,i+3*st)];an=Math.atan2(m[1]-52,m[0]-50)+(rnd()-.5)*1.5;di=200+rnd()*90;cu=1.1+rnd()*.9;de=d0+f*40+rnd()*70;}const a=S[i],b=S[i+st],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;R2.push({i,st,S,x,y,a0:an-cu,da:((Math.atan2(y-52,x-50)-an+cu)%6.283+6.283)%6.283,d0:di,d1:Math.hypot(x-50,y-52),d:de+rnd()*60,v:880+rnd()*220});}}faixas(SO,84,0);faixas(SI,42,120);
const P2=(r,u)=>orb(r.a0+r.da*u,r.d0+(r.d1-r.d0)*u,50,52),F2=Math.max(...R2.map(r=>r.d+r.v))-190,PO2=nuvem(22);
function m2(g,T){const f=lim((T-F2)/880);BLOOM=1-.3*f;halo(g,suave(500,F2,T)*.75*(1-f*.3));pouso(g,T,F2,880);g.lineWidth=.55;for(const r of R2){const c=lim((T-r.d-r.v)/200);if(c<=0)continue;g.strokeStyle=`rgba(${f>.25?'33,126,51':'120,230,160'},${(.8-.38*c)*(1-sua(lim((f-.75)/.25)))})`;g.beginPath();g.moveTo(r.S[r.i][0],r.S[r.i][1]);g.lineTo(r.S[r.i+r.st][0],r.S[r.i+r.st][1]);g.stroke();}g.save();g.globalCompositeOperation='lighter';for(const r of R2){const p=(T-r.d)/r.v;if(p<=0||p>=1.04)continue;const pts=Array.from({length:10},(_,j)=>P2(r,fora(lim(p-.3*(1-j/9)))));cauda(g,pts,1.15);}g.restore();escala(g,.93+.07*volta(f),()=>cresce(g,sua(f)));halo(g,1.1*(1-suave(F2+120,F2+1050,T))*suave(F2,F2+120,T),150);reflexo(g,T,F2+760);poeira(g,PO2,T,F2+260);}

const R3=TODOS.filter((_,i)=>i%4===0).map(p=>({p,d:rnd()*440,v:1180+rnd()*320,g:1.25+rnd()*.85,k:1.8+rnd()*1.7})),PO3=nuvem(22),F3=1780;
const P3=(r,e)=>{const a=(1-e)*r.g*6.283,s=1+r.k*(1-e),x=(r.p[0]-50)*s,y=(r.p[1]-50)*s,c=Math.cos(a),n=Math.sin(a);return[50+x*c-y*n,50+x*n+y*c];};
function m3(g,T){const f=lim((T-F3)/860);BLOOM=1-.3*f;halo(g,suave(100,F3,T)*.85*(1-f*.4));const ar=(1-suave(F3-260,F3+160,T))*suave(0,500,T);if(ar>0){g.save();g.globalCompositeOperation='lighter';for(let b=0;b<3;b++){const of=b*2.094+T*(.0021+T*.0000012);g.beginPath();for(let k=0;k<=150;k++){const u=k/150,q=orb(of+u*7.4,6+u*u*170);k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);}g.strokeStyle=`rgba(${VERDE},${.34*ar})`;g.lineWidth=2.3;g.stroke();}g.restore();}pouso(g,T,F3,860);g.save();g.globalCompositeOperation='lighter';for(const r of R3){const p=(T-r.d)/r.v;if(p<=0||p>=1)continue;g.globalAlpha=sua(lim(p*2.6))*.85;cauda(g,Array.from({length:12},(_,j)=>P3(r,fora(lim(p-.16*(1-j/11))))),.9);}g.restore();for(const r of R3){if((T-r.d)/r.v>=1&&f<1){g.fillStyle=`rgba(${f>.25?'33,126,51':'120,230,160'},${.8*(1-f)})`;g.beginPath();g.arc(r.p[0],r.p[1],.48,0,6.3);g.fill();}}escala(g,.93+.07*volta(f),()=>cresce(g,sua(f)));anel(g,T,F3+120,1050,.8);reflexo(g,T,F3+720);poeira(g,PO3,T,F3+240);}

const PO4=nuvem(24),PL4=Array.from({length:90},()=>({x:rnd(),y:rnd(),vx:(rnd()-.5)*.012,vy:-.006-rnd()*.02,l:560+rnd()*780,r:.25+rnd()*.5}));
function feixe(g,x,a){g.save();g.globalCompositeOperation='lighter';const c=g.createLinearGradient(x-34,0,x+34,0);c.addColorStop(0,`rgba(${VERDE},0)`);c.addColorStop(.5,`rgba(${VERDE},${.5*a})`);c.addColorStop(1,`rgba(${VERDE},0)`);g.fillStyle=c;g.fillRect(x-34,V.y0,68,V.y1-V.y0);g.strokeStyle=`rgba(${CLARO},${a})`;g.lineWidth=.9;g.beginPath();g.moveTo(x,V.y0);g.lineTo(x,V.y1);g.stroke();g.restore();}
function m4(g,T){const A=sua(lim((T-140)/1120)),x1=V.x0-34+(V.x1-V.x0+68)*A,B=sua(lim((T-1290)/960)),x2=V.x1+34-(V.x1-V.x0+68)*B;BLOOM=1-.3*B;g.save();g.strokeStyle='rgba(120,200,150,.08)';g.lineWidth=.3;g.globalAlpha=1-B;for(let v=50-20*Math.ceil((50-Math.min(V.x0,V.y0))/20);v<=Math.max(V.x1,V.y1);v+=20){g.beginPath();g.moveTo(v,V.y0);g.lineTo(v,V.y1);g.moveTo(V.x0,v);g.lineTo(V.x1,v);g.stroke();}g.restore();
g.save();g.globalCompositeOperation='lighter';for(const q of PL4){const tx=140+q.x*1120,t=T-tx;if(t<0||t>q.l)continue;g.fillStyle=`rgba(190,255,212,${(1-t/q.l)*.9})`;g.beginPath();g.arc(V.x0+q.x*(V.x1-V.x0)+q.vx*t,V.y0+q.y*(V.y1-V.y0)+q.vy*t,q.r,0,6.3);g.fill();}g.restore();
if(A>0&&B<1){g.save();g.beginPath();g.rect(V.x0-1,V.y0-1,x1-V.x0+1,V.y1-V.y0+2);g.clip();neon(g,()=>contorno(g),.85*(1-B));g.restore();}
if(B>0){g.save();g.beginPath();g.rect(x2,V.y0-1,V.x1-x2+1,V.y1-V.y0+2);g.clip();placa(g,1);logoEm(g);g.restore();}
if(T>140&&T<1400)feixe(g,x1,lim((1400-T)/170)*suave(140,320,T));if(T>=1290&&T<2420)feixe(g,x2,lim((2420-T)/190)*suave(1290,1470,T));reflexo(g,T,2440);poeira(g,PO4,T,2380);}

const T5=[200,1560,2160],pontoEm=t=>{if(t<T5[1])return SO[Math.floor(lim((t-T5[0])/(T5[1]-T5[0]))*252)];return SI[Math.floor(lim((t-T5[1])/(T5[2]-T5[1]))*126)];},PO5=nuvem(26);
const FA5=Array.from({length:340},()=>{const te=T5[0]+rnd()*(T5[2]-T5[0]);return{te,p:pontoEm(te),vx:(rnd()-.5)*.19,vy:-(.03+rnd()*.15),l:420+rnd()*560};});
function m5(g,T){const f=lim((T-2160)/840);BLOOM=1-.3*f;halo(g,suave(200,2100,T)*.5*(1-f));pouso(g,T,2160,840);const a=lim((T-T5[0])/(T5[1]-T5[0]))*252,b=lim((T-T5[1])/(T5[2]-T5[1]))*126;if(f<1){const al=1-sua(f);if(a>0)neon(g,()=>linha(g,SO,0,a),al*.72);if(b>0)neon(g,()=>linha(g,SI,0,b),al*.72);if(T<T5[2]+200){const[S,h]=b>0?[SI,b]:[SO,a],i0=Math.max(0,h-24);if(h>0)neon(g,()=>linha(g,S,i0,h),1);}}escala(g,.93+.07*volta(f),()=>cresce(g,sua(f)));g.save();g.globalCompositeOperation='lighter';for(const s of FA5){const dt=T-s.te;if(dt<0||dt>s.l)continue;const px=t=>s.p[0]+s.vx*t,py=t=>s.p[1]+s.vy*t+.00017*t*t,v=Math.max(0,dt-26);g.strokeStyle=`rgba(${dt<s.l*.45?CLARO:VERDE},${1-dt/s.l})`;g.lineWidth=.58;g.beginPath();g.moveTo(px(v),py(v));g.lineTo(px(dt),py(dt));g.stroke();}if(T>T5[0]&&T<T5[2]){const q=pontoEm(T),l=15+Math.sin(T*.05)*4,c=g.createRadialGradient(q[0],q[1],0,q[0],q[1],15);c.addColorStop(0,`rgba(${CLARO},1)`);c.addColorStop(.28,`rgba(${VERDE},.55)`);c.addColorStop(1,`rgba(${VERDE},0)`);g.fillStyle=c;g.beginPath();g.arc(q[0],q[1],15,0,6.3);g.fill();g.strokeStyle=`rgba(${CLARO},.8)`;g.lineWidth=.35;g.beginPath();g.moveTo(q[0]-l,q[1]);g.lineTo(q[0]+l,q[1]);g.moveTo(q[0],q[1]-l*.6);g.lineTo(q[0],q[1]+l*.6);g.stroke();}g.restore();estouro(g,BU5,T,2170,.00021);reflexo(g,T,2820);poeira(g,PO5,T,2340);}

const BOL=Array.from({length:64},()=>({x:8+rnd()*84,t:320+rnd()*1950,v:.045+rnd()*.06,r:.45+rnd()*1.5,f:rnd()*6})),PO6=nuvem(24);
function m6(g,T){const f=suave(2340,2960,T),co=suave(0,520,T)*(1-f);BLOOM=1-.3*f;halo(g,suave(300,2200,T)*.55*(1-f*.4));escala(g,.95+.05*volta(lim((T-2340)/760)),()=>placa(g,sua(f)));if(co>0)neon(g,()=>contorno(g),co*.55);const lv=114-132*sua(lim((T-240)/2040)),am=5.2*(1-suave(1850,2620,T))+.25,onda=x=>lv+Math.sin(x*.12+T*.0062)*am+Math.sin(x*.05-T*.0039)*am*.6,cam=()=>{g.beginPath();g.moveTo(-6,onda(-6));for(let x=-3;x<=106;x+=3)g.lineTo(x,onda(x));};
g.save();g.clip(logo,'evenodd');cam();g.lineTo(106,135);g.lineTo(-6,135);g.closePath();const c=g.createLinearGradient(0,lv,0,lv+74);c.addColorStop(0,'#52de87');c.addColorStop(.3,'#2aa755');c.addColorStop(1,'#14632f');g.fillStyle=c;g.fill();g.save();g.globalCompositeOperation='lighter';for(const b of BOL){const t=T-b.t;if(t<0)continue;const y=112-b.v*t;if(y<lv+1)continue;g.strokeStyle='rgba(205,255,222,.7)';g.lineWidth=.3;g.beginPath();g.arc(b.x+Math.sin(t*.006+b.f)*1.8,y,b.r,0,6.3);g.stroke();}g.restore();cam();g.strokeStyle=`rgba(${CLARO},${.95*(1-f)})`;g.lineWidth=1.25;g.stroke();g.restore();logoEm(g,f);estouro(g,BU6,T,2380,.00034);reflexo(g,T,2800);poeira(g,PO6,T,2500);}

const GOT=[[50,16],[22,36],[78,30],[35,76],[66,82],[52,50],[15,62],[85,62]].map((p,i)=>({x:p[0],y:p[1],t:130+i*186})),QUEDA=250,PO7=nuvem(24);
function m7(g,T){const f=suave(2360,2980,T);BLOOM=1-.3*f;halo(g,suave(300,2200,T)*.42*(1-f*.3));escala(g,.95+.05*volta(lim((T-2360)/780)),()=>placa(g,sua(f)));
g.save();g.beginPath();for(const q of GOT){const dt=T-q.t-QUEDA;if(dt<=0)continue;const r=86*fora(lim(dt/880));g.moveTo(q.x+r,q.y);g.arc(q.x,q.y,r,0,6.3);}g.clip();g.save();g.clip(logo,'evenodd');const c=g.createLinearGradient(0,0,0,100);c.addColorStop(0,'#3fcb72');c.addColorStop(1,'#1b7a3e');g.fillStyle=c;g.fillRect(-20,-20,140,140);g.restore();g.restore();logoEm(g,f);
g.save();g.globalCompositeOperation='lighter';for(const q of GOT){const p=(T-q.t)/QUEDA;if(p>0&&p<1){const y=V.y0-12+(q.y-V.y0+12)*p*p;cauda(g,[[q.x,y-22],[q.x,y-13],[q.x,y-5],[q.x,y]],1.7,'150,240,185');g.fillStyle=`rgba(${CLARO},1)`;g.beginPath();g.arc(q.x,y,1.25,0,6.3);g.fill();}const dt=T-q.t-QUEDA;if(dt<=0)continue;for(let k=0;k<4;k++){const u=(dt-k*125)/1120;if(u<=0||u>=1)continue;g.strokeStyle=`rgba(${k?VERDE:CLARO},${(1-u)*(1-u)*(1-f*.9)*.85})`;g.lineWidth=.95*(1-u)+.18;g.beginPath();g.arc(q.x,q.y,fora(u)*98*KM,0,6.3);g.stroke();}}g.restore();reflexo(g,T,2820);poeira(g,PO7,T,2520);}

const spr=(()=>{const c=tela(64,64),g=c.getContext('2d'),f=g.createRadialGradient(32,32,0,32,32,32);f.addColorStop(0,'rgba(215,255,228,.95)');f.addColorStop(.4,'rgba(130,232,165,.38)');f.addColorStop(1,'rgba(90,220,140,0)');g.fillStyle=f;g.fillRect(0,0,64,64);return c;})();
const VA=TODOS.filter((_,i)=>i%2===0).map(p=>({p,x:50+(rnd()-.5)*200,y:140+rnd()*80,d:rnd()*760,v:1420+rnd()*480,f:rnd()*6,g:.7+rnd()*.7})),PO8=nuvem(28);
function m8(g,T){const f=suave(2480,3100,T),l=suave(1820,2640,T);BLOOM=1.15-.45*f;halo(g,suave(200,2100,T)*.5*(1-f*.4));escala(g,.96+.04*sua(f),()=>placa(g,sua(f)));g.save();g.globalCompositeOperation='lighter';for(const s of VA){const p=(T-s.d)/s.v;if(p<=0)continue;if(p>=1){const a=1-lim((p-1)*3.2);if(a<=0)continue;g.globalAlpha=a*.5*(1-f);g.drawImage(spr,s.p[0]-2.6,s.p[1]-2.6-(p-1)*16,5.2,5.2);continue;}const e=sua(p),gi=Math.sin(p*5+s.f)*30*(1-e)*s.g,o=pe(s.x,s.y),x=o[0]+(s.p[0]-o[0])*e+gi,y=o[1]+(s.p[1]-o[1])*e,r=(40*Math.pow(1-p,.8)+2.6)*s.g;g.globalAlpha=suave(0,.3,p)*(.05+.24*p*p);g.drawImage(spr,x-r,y-r,2*r,2*r);}g.restore();if(l>0){const b=(1-l)*7*(g.canvas.width/900);g.save();if('filter'in g&&b>.05)g.filter=`blur(${b}px)`;logoEm(g,l);g.restore();}reflexo(g,T,2980,560);poeira(g,PO8,T,2620);}

let PL9=null;const K9=6;function pl9(){if(PL9)return PL9;PL9=tela(132*K9,132*K9);const q=PL9.getContext('2d');q.scale(K9,K9);q.translate(16,16);placa(q,1);logoEm(q);return PL9;}const PO9=nuvem(24);
function m9(g,T){const a=suave(0,520,T),N=26,w=132/N,im=pl9(),e0=sua(lim((T-2500)/320));BLOOM=.85;halo(g,a*.85*(1-e0*.35)+Math.sin(T*.0021)*.08*a);escala(g,.96+.04*sua(lim((T-340)/2140)),()=>{for(let i=0;i<N;i++){const c=Math.abs(i-(N-1)/2)/(N/2),e=sua(lim((T-340-c*620)/1520)),of=(1-e)*Math.sin(i*.55+T*.0017)*20,yo=(1-e)*Math.sin(i*.45+T*.0019)*5,sw=w*(1+2.6*(1-e)),sx=Math.max(0,Math.min(132-sw,i*w-(sw-w)/2+of))*K9,x=-16+i*w;g.globalAlpha=a;g.drawImage(im,sx,0,sw*K9,132*K9,x,-16+yo,w+.18,132);if(e<1){const q=g.createLinearGradient(x,0,x+w,0);q.addColorStop(0,`rgba(16,44,28,${.32*(1-e)})`);q.addColorStop(.42,'rgba(16,44,28,0)');q.addColorStop(.7,`rgba(120,230,160,${.2*(1-e)})`);q.addColorStop(1,`rgba(16,44,28,${.24*(1-e)})`);g.fillStyle=q;g.fillRect(x,-16+yo,w+.18,132);}}g.globalAlpha=1;});reflexo(g,T,2500);poeira(g,PO9,T,2520);}

const RAI=Array.from({length:52},(_,i)=>({a:i/52*6.283+rnd()*.1,l:.45+rnd()*1,w:.012+rnd()*.03,f:rnd()*6})),PO10=nuvem(30);
function m10(g,T){const luz=suave(180,1920,T),fl=suave(1800,2060,T)*(1-suave(2060,2780,T)),rev=suave(2000,2480,T);BLOOM=1.2-.5*rev;halo(g,luz*1.25*(1-rev*.55),150);g.save();g.globalCompositeOperation='lighter';const rot=T*.00013,c=g.createRadialGradient(50,50,26,50,50,190*KM);c.addColorStop(0,`rgba(200,255,220,${.5*luz*(1-rev*.85)})`);c.addColorStop(.42,`rgba(${VERDE},${.22*luz*(1-rev*.85)})`);c.addColorStop(1,`rgba(${VERDE},0)`);g.fillStyle=c;g.beginPath();for(const r of RAI){const a=r.a+rot,L=(82+108*r.l*KM)*luz*(.84+.16*Math.sin(T*.0032+r.f));g.moveTo(50,50);g.lineTo(50+Math.cos(a-r.w)*L,50+Math.sin(a-r.w)*L);g.lineTo(50+Math.cos(a+r.w)*L,50+Math.sin(a+r.w)*L);g.closePath();}g.fill();g.restore();if(rev<1){g.save();g.globalAlpha=1-rev;g.fillStyle='#060908';g.fill(logo,'evenodd');g.restore();neon(g,()=>contorno(g),luz*.7*(1-rev));}pouso(g,T,2030,780,true);if(fl>0){g.save();g.globalCompositeOperation='lighter';const q=g.createRadialGradient(50,50,0,50,50,230*KM);q.addColorStop(0,`rgba(255,255,255,${fl})`);q.addColorStop(.4,`rgba(190,255,214,${.55*fl})`);q.addColorStop(1,'rgba(90,220,140,0)');g.fillStyle=q;g.fillRect(V.x0,V.y0,V.x1-V.x0,V.y1-V.y0);g.restore();}anel(g,T,2070,1100,.9);anel(g,T,2290,1100,.5,190);reflexo(g,T,2820,560);poeira(g,PO10,T,2500);}

// 11 Cometas (3.1.5, ideia do Guilherme): riscos de luz cruzam a tela rápido, três ou quatro de cada vez em tempos diferentes;
// depois vêm em curva de cima, dos lados e de baixo, cada um encosta num pedaço do contorno e o desenha, e a logo pousa.
const PA11=[[0,0,.18,-.1,430],[120,1,.62,.1,380],[230,0,.82,.14,470],[400,1,.3,-.12,400],[520,0,.5,.08,360],[700,1,.12,.1,450],[830,0,.7,-.1,390],[1010,1,.42,.06,420],[1160,0,.9,-.08,380]]; // [começo, vem da direita, altura na tela, inclinação, duração]
const L11=185,F11=2520,SG11=[[SO,0,63,0],[SO,63,126,1],[SO,126,189,2],[SO,189,252,3],[SI,0,63,0],[SI,63,126,2]].map(([S,i0,i1,lado],k)=>({S,i0,i1,lado,ta:[1250,1330,1420,1480,1560,1640][k],j:(rnd()-.5)*80,c:(rnd()<.5?-1:1)*(50+rnd()*40)})),PO11=nuvem(26);
function risco11(g,x0,y0,x1,y1){g.save();g.globalCompositeOperation='lighter';g.lineCap='round';const c=g.createLinearGradient(x0,y0,x1,y1);c.addColorStop(0,`rgba(${VERDE},0)`);c.addColorStop(.75,`rgba(${VERDE},.45)`);c.addColorStop(1,`rgba(${CLARO},1)`);g.strokeStyle=c;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.lineWidth=13;g.globalAlpha=.07;g.stroke();g.lineWidth=5.5;g.globalAlpha=.24;g.stroke();g.globalAlpha=1;g.lineWidth=1.5;g.stroke();g.fillStyle=`rgba(${CLARO},1)`;g.beginPath();g.arc(x1,y1,1.3,0,6.3);g.fill();g.restore();}
function m11(g,T){const f=lim((T-F11)/780);BLOOM=1.1-.4*f;halo(g,suave(1200,F11,T)*.7*(1-f*.3));
for(const[t0,dir,yf,inc,d]of PA11){const p=(T-t0)/d;if(p<=0||p>=1)continue;const xa=V.x0-12,hx0=xa+(V.x1+L11+12-xa)*p,hx=dir?100-hx0:hx0,tx=dir?hx+L11:hx-L11,yb=V.y0+yf*(V.y1-V.y0),y=x=>yb+inc*(x-50);risco11(g,tx,y(tx),hx,y(hx));}
pouso(g,T,F11,780);
for(const s of SG11){const q=s.S[s.i0],[ox,oy]=[[q[0]+s.j,V.y0-40],[V.x1+40,q[1]+s.j],[q[0]+s.j,V.y1+40],[V.x0-40,q[1]+s.j]][s.lado],dx=q[0]-ox,dy=q[1]-oy,n=Math.hypot(dx,dy)||1,cx=(ox+q[0])/2-dy/n*s.c,cy=(oy+q[1])/2+dx/n*s.c,B=u=>{const v=1-u;return[v*v*ox+2*v*u*cx+u*u*q[0],v*v*oy+2*v*u*cy+u*u*q[1]];};
const a=(T-s.ta)/430;if(a>0&&a<1.35){const h=fora(lim(a));g.save();g.globalCompositeOperation='lighter';g.globalAlpha=a>1?lim((1.35-a)/.35):1;cauda(g,Array.from({length:14},(_,j)=>B(Math.max(0,h-.38*(1-j/13)))),1.4);g.restore();}
const e=sua(lim((T-s.ta-430)/560));if(e>0&&f<1)neon(g,()=>linha(g,s.S,s.i0,s.i0+(s.i1-s.i0)*e),1-sua(f));
if(e>0&&e<1){const p=s.S[Math.min(s.S.length-1,Math.round(s.i0+(s.i1-s.i0)*e))];g.save();g.globalCompositeOperation='lighter';const c=g.createRadialGradient(p[0],p[1],0,p[0],p[1],9);c.addColorStop(0,`rgba(${CLARO},.95)`);c.addColorStop(.35,`rgba(${VERDE},.45)`);c.addColorStop(1,`rgba(${VERDE},0)`);g.fillStyle=c;g.beginPath();g.arc(p[0],p[1],9,0,6.3);g.fill();g.restore();}}
escala(g,.93+.07*volta(f),()=>cresce(g,sua(f)));anel(g,T,F11+100,1050,.8);reflexo(g,T,F11+560);poeira(g,PO11,T,F11+200);}


let A=null,mx=null,ru=null,rvb=null,bus=null,busR=null;
const NOTA=n=>440*Math.pow(2,(n-69)/12);
function ligar(ctx){
  A=ctx;bus=null;busR=null;
  const c=A.createDynamicsCompressor();c.threshold.value=-12;c.knee.value=12;c.ratio.value=3;c.attack.value=.005;c.release.value=.18;c.connect(A.destination);
  mx=A.createGain();mx.gain.value=2.2;mx.connect(c);
  let seed=701;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  ru=A.createBuffer(1,A.sampleRate*2,A.sampleRate);
  const d=ru.getChannelData(0);let a=0,b=0,e=0;
  for(let i=0;i<d.length;i++){const w=rnd();a=.997*a+w*.03;b=.963*b+w*.1;e=.57*e+w*.5;d[i]=(a+b+e)*.42;}
  const ir=A.createBuffer(2,Math.ceil(A.sampleRate*1.05),A.sampleRate);
  for(let c2=0;c2<2;c2++){const q=ir.getChannelData(c2);let z=0;
    for(let i=0;i<q.length;i++){const u=i/q.length;z+=(rnd()-z)*(.55*Math.pow(1-u,2)+.05);q[i]=z*Math.pow(1-u,3.2);}
    [.011,.019,.031].forEach((s,j)=>{q[Math.floor(A.sampleRate*(s+c2*.0031))]+=.4/(j+1);});}
  rvb=A.createConvolver();rvb.buffer=ir;
  const wet=A.createGain();wet.gain.value=.7;rvb.connect(wet);wet.connect(mx);novoBus(0);
}
function novoBus(t){
  if(bus)for(const g of [bus,busR]){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(1,t);g.gain.linearRampToValueAtTime(0,t+.035);}
  bus=A.createGain();busR=A.createGain();bus.connect(mx);busR.connect(rvb);
}
function sai(no,pan=0,rev=.3){
  const p=A.createStereoPanner();p.pan.value=pan;no.connect(p);p.connect(bus);
  if(rev){const r=A.createGain();r.gain.value=rev;p.connect(r);r.connect(busR);}return p;
}
function env(t,d,v,ata=.008){
  const g=A.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+ata);
  g.gain.exponentialRampToValueAtTime(.00001,t+d-.008);g.gain.linearRampToValueAtTime(0,t+d);return g;
}
function osc(t,d,f,tipo='sine'){
  const o=A.createOscillator();o.type=tipo;o.frequency.setValueAtTime(f,t);o.start(t);o.stop(t+d);return o;
}
function passaBaixa(f,q=.5){const b=A.createBiquadFilter();b.type='lowpass';b.frequency.value=f;b.Q.value=q;return b;}
function tecla(t,n,v=.15,d=.32,pan=0,rev=.3){
  // Piano elétrico: duas vozes levemente desafinadas, com timbre que amacia depois do ataque.
  const f=NOTA(n),fim=rev?d+.22:d,g=env(t,fim,v,.007),lp=passaBaixa(3400);lp.connect(g);sai(g,pan,rev);
  for(const c of [-3,3]){
    const o=osc(t,fim,f*Math.pow(2,c/1200)),m=osc(t,fim,f*2),mg=A.createGain(),h=A.createGain();
    mg.gain.setValueAtTime(f*1.1,t);mg.gain.exponentialRampToValueAtTime(f*.06,t+Math.min(.4,fim*.8));
    m.connect(mg);mg.connect(o.frequency);h.gain.value=.5;o.connect(h);h.connect(lp);
  }
}
function piano(t,n,v=.12,d=.5,pan=0,rev=.3){
  // Parciais levemente inarmônicos e martelo curto: os agudos morrem antes dos graves.
  const f=NOTA(n),fim=d+.3,g=A.createGain();sai(g,pan,rev);
  for(let k=1;k<=7;k++){const dk=fim/Math.pow(k,.55),e=env(t,dk,v*.8*Math.pow(k,-1.5),.004),o=osc(t,dk,f*k*Math.sqrt(1+.0004*k*k));o.connect(e);e.connect(g);}
  const s=A.createBufferSource(),b=passaBaixa(1800),e=env(t,.03,v*.3,.001);s.buffer=ru;s.loop=true;s.connect(b);b.connect(e);e.connect(g);s.start(t);s.stop(t+.03);
}
function sopro(t,d,notas,v=.045,pan=0,brilho=1500){
  // Metais sintéticos: três serras desafinadas por nota, sempre atrás do filtro.
  const lp=passaBaixa(280);lp.frequency.setValueAtTime(280,t);lp.frequency.linearRampToValueAtTime(brilho,t+.07);lp.frequency.exponentialRampToValueAtTime(460,t+d);
  const g=env(t,d,v,.03);lp.connect(g);sai(g,pan,.4);
  for(const n of notas)for(const c of [-7,0,7]){const o=osc(t,d,NOTA(n)*Math.pow(2,c/1200),'sawtooth'),h=A.createGain();h.gain.value=.42;o.connect(h);h.connect(lp);}
}
function pad(t,d,notas,v=.04){
  const lp=passaBaixa(1500),g=env(t,d,v,Math.min(.2,d*.4));lp.connect(g);sai(g,0,.5);
  for(const n of notas)for(const c of [-6,0,6]){const o=osc(t,d,NOTA(n)*Math.pow(2,c/1200),'triangle'),h=A.createGain();h.gain.value=.42;o.connect(h);h.connect(lp);}
}
function baixo(t,n,v=.17,d=.3){
  // Com harmônicos: alto-falante de celular não reproduz só a fundamental grave.
  const f=NOTA(n),g=env(t,d,v,.009),lp=passaBaixa(620);lp.connect(g);sai(g,0,.08);
  [[1,1],[2,.42],[3,.2]].forEach(([r,a])=>{const o=osc(t,d,f*r),h=A.createGain();h.gain.value=a;o.connect(h);h.connect(lp);});
}
function ar(t,d,f0,f1,v=.12,p0=0,p1=0){
  const s=A.createBufferSource();s.buffer=ru;s.loop=true;
  const b=A.createBiquadFilter();b.type='bandpass';b.Q.value=.65;
  b.frequency.setValueAtTime(f0,t);b.frequency.exponentialRampToValueAtTime(f1,t+d);
  const g=env(t,d,v,Math.min(d*.5,.2));s.connect(b);b.connect(g);
  const p=sai(g,p0,.35);p.pan.setValueAtTime(p0,t);p.pan.linearRampToValueAtTime(p1,t+d);s.start(t);s.stop(t+d);
}
function impacto(t,v=.17){
  const o=osc(t,.5,92);o.frequency.exponentialRampToValueAtTime(42,t+.3);
  const g=env(t,.5,v,.006);o.connect(g);sai(g,0,.2);
  const o2=osc(t,.2,190);o2.frequency.exponentialRampToValueAtTime(95,t+.16);const g2=env(t,.2,v*.5,.004);o2.connect(g2);sai(g2,0,.25);
  ar(t,.14,900,140,v*.8);
}
function gota(t,f,v,pan){
  const o=osc(t,.11,f);o.frequency.exponentialRampToValueAtTime(f*1.9,t+.05);
  const g=env(t,.11,v,.003);o.connect(g);sai(g,pan,.3);
}
function acorde(t,notas,tipo,v,d){
  if(tipo==='metal')sopro(t,d,notas,v);
  else if(tipo==='pad')pad(t,d,notas,v);
  else notas.forEach((n,i)=>(tipo==='piano'?piano:tecla)(t,n,v,d,(i-1)*.16));
}
function cadencia(t,pouso,raiz,tipo='piano',modo='sus',v=.075){
  // A preparação dura 180 ms; a terça maior entra exatamente no pouso.
  const antes=modo==='sus'?[raiz,raiz+5,raiz+7]:[raiz-2,raiz+2,raiz+5];
  acorde(t+pouso-.18,antes,tipo,v*.68,.2);
  acorde(t+pouso,[raiz,raiz+4,raiz+7,raiz+12],tipo,v,.6);
  baixo(t+pouso,raiz-24,.14,.42);
}
// 3.1.5: 3,3 s de animação e 0,7 s até a tela (iniciar.js), 4 s ao todo. O som foi feito para a versão de até 2 s:
// começa mais tarde, para o acorde de cada um (o "pouso" da cadencia) continuar caindo junto com a logo.
const ABRE=3300,POUSO=[1.23,1.02,1.09,1.21,1.25,1.39,1.35,1.40,1.36,1.12,2.5];
const SOM=[
  // 1 Neon: cinco cometas, contorno elétrico e resolução em Ré.
  t=>{[.05,.225,.40,.575,.75].forEach((x,i)=>ar(t+x,.2,650,2400,.2,i%2? .8:-.8,0));
    [62,64,66,69].forEach((n,i)=>tecla(t+.79+i*.105,n,.065,.13,(i-1.5)*.2));
    cadencia(t,1.23,62,'tecla');impacto(t+1.23,.12);},
  // 2 Riscos: traços convergindo; metais em Dó, bVII-I.
  t=>{[0,.14,.28,.42,.56,.70,.84].forEach((x,i)=>ar(t+x,.18,1500,450,.2,(i%2?1:-1)*(1-x),0));
    sopro(t+.12,.22,[48,55],.045,-.35);sopro(t+.48,.2,[53,60],.05,.35);
    cadencia(t,1.02,60,'metal','bVII',.09);impacto(t+1.02,.2);},
  // 3 Turbilhão: pulsação grave acelerando, sem rolo melódico.
  t=>{ar(t,.99,180,1900,.22,-.8,.8);
    [0,.27,.49,.67,.81,.92,1.01].forEach((x,i)=>baixo(t+x,i%2?43:38,.09,.1));
    cadencia(t,1.09,62,'metal','sus',.085);impacto(t+1.09,.23);},
  // 4 Laser: duas varreduras panorâmicas com direções opostas.
  t=>{ar(t+.07,.60,320,3000,.24,-.95,.95);ar(t+.68,.51,3000,320,.24,.95,-.95);
    tecla(t+.07,57,.09,.18,-.7);tecla(t+.68,64,.09,.18,.7);
    cadencia(t,1.21,57,'piano','sus',.09);},
  // 5 Faíscas: solda rítmica e metais graves em Mi bemol.
  t=>{for(let i=0;i<24;i++){const x=.12+i*(1.13/23);ar(t+x,.022,2100+(i%4)*350,900,.14,-.65+1.3*i/23,0);}
    baixo(t+.12,39,.1,.16);baixo(t+.52,46,.1,.16);baixo(t+.86,39,.1,.16);
    cadencia(t,1.25,63,'metal','bVII',.08);impacto(t+1.25,.24);},
  // 6 Dorna: massa de líquido ascendente e bolhas discretas.
  t=>{ar(t+.14,1.17,140,750,.26,-.2,.2);pad(t+.14,.95,[43,50],.038);
    [.20,.39,.62,.82,1.02,1.22].forEach((x,i)=>gota(t+x,180+i*27,.04,(i%2?1:-1)*.35));
    cadencia(t,1.39,55,'tecla','sus',.105);impacto(t+1.39,.1);},
  // 7 Gotas: tempos e pans do desenho; textura aquática sobre piano médio.
  t=>{const tempos=[.22,.32,.43,.54,.64,.75,.85,.96],pans=[0,-.42,.42,-.23,.24,.03,-.53,.53];
    const notas=[60,64,67,65,64,62,59,60];
    tempos.forEach((x,i)=>{gota(t+x,330+i*16,.065,pans[i]);piano(t+x,notas[i],.055,.14,pans[i],.2);});
    cadencia(t,1.35,60,'piano','sus',.095);},
  // 8 Vapor: condensa em harmonia suave, sem golpe percussivo.
  t=>{ar(t,1.35,2200,380,.22,-.4,.4);pad(t+.08,1.05,[53,60,65],.038);
    cadencia(t,1.40,65,'pad','sus',.2);},
  // 9 Vidro: alinhamento em acordes médios, sem voz de sino.
  t=>{[.19,.385,.58,.775,.97,1.165,1.36].forEach((x,i)=>{
      ar(t+x,.05,1700,700,.1,(i-3)*.19,0);
      if(i<5)[57,61].forEach(n=>tecla(t+x,n,.04,.09,(i-3)*.19,.18));});
    cadencia(t,1.36,57,'tecla','bVII',.085);},
  // 10 Eclipse: crescendo grave, clarão e assinatura de metais em Lá bemol.
  t=>{pad(t+.10,.97,[32,44,51],.055);ar(t+.10,.97,140,3400,.3);
    sopro(t+.60,.30,[56,63],.055);cadencia(t,1.12,56,'metal','bVII',.11);
    impacto(t+1.12,.28);tecla(t+1.12,68,.075,.5);},
  // 11 Cometas: um risco de som para cada passagem, na direção dela; na montagem, traços que convergem e metais em Dó.
  t=>{PA11.forEach(([x,dir,,,d])=>ar(t+x/1000,d/1000,500,2800,.16,dir?.9:-.9,dir?-.9:.9));
    SG11.forEach((s,i)=>ar(t+s.ta/1000,.4,1500,450,.16,(i%2?1:-1)*.6,0));
    cadencia(t,2.5,60,'metal','bVII',.09);impacto(t+2.5,.2);}
];

// Sons das telas (toque, confirmar, aviso, erro). Versão escolhida em 09/11; motor próprio, separado das aberturas.
const TELAS=(()=>{
let A=null,mx=null,ru=null,rvb=null,bus=null,busR=null;const CK=new Map();
function ligar(ctx){A=ctx;CK.clear();const sr=A.sampleRate,c=A.createDynamicsCompressor();c.threshold.value=-13;c.knee.value=14;c.ratio.value=3.5;c.attack.value=.006;c.release.value=.26;mx=A.createGain();mx.gain.value=.9;mx.connect(c);c.connect(A.destination);
ru=A.createBuffer(1,sr*3,sr);const d=ru.getChannelData(0);let a=0,b=0,e=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;a=.997*a+w*.03;b=.963*b+w*.1;e=.57*e+w*.5;d[i]=(a+b+e)*.42;}
const n=Math.floor(sr*3.4),ir=A.createBuffer(2,n,sr);for(let k=0;k<2;k++){const q=ir.getChannelData(k);let y=0;for(let i=0;i<n;i++){const t=i/n,co=.62*Math.pow(1-t,2.2)+.03;y+=(Math.random()*2-1-y)*co;q[i]=y*Math.pow(1-t,3.6)*(i<sr*.012?i/(sr*.012):1);}[.017,.029,.043,.061].forEach((s,j)=>{q[Math.floor(sr*(s+k*.0037))]+=.5/(j+1);});}
rvb=A.createConvolver();rvb.buffer=ir;const w=A.createGain();w.gain.value=.62;rvb.connect(w);w.connect(mx);novoBus(0);}
function novoBus(t){if(bus){const b=bus,r=busR;[b,r].forEach(g=>{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.14);});}bus=A.createGain();busR=A.createGain();bus.connect(mx);busR.connect(rvb);}
function sai(no,pan=0,rev=.3){const p=A.createStereoPanner();p.pan.value=pan;no.connect(p);p.connect(bus);const r=A.createGain();r.gain.value=rev;p.connect(r);r.connect(busR);return p;}
const NOTA=n=>440*Math.pow(2,(n-69)/12);
function env(t,ata,v,d){const g=A.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),t+ata);g.gain.exponentialRampToValueAtTime(.0001,t+d);return g;}
function osc(t,d,f,ti='sine'){const o=A.createOscillator();o.type=ti;o.frequency.setValueAtTime(f,t);o.start(t);o.stop(t+d+.05);return o;}
function ruido(t,d){const s=A.createBufferSource();s.buffer=ru;s.loop=true;s.start(t,Math.random()*2.5);s.stop(t+d+.05);return s;}
const PAR=[[1,1,1],[2,.5,.64],[2.76,.36,.46],[4.07,.18,.3],[5.42,.1,.2],[6.8,.05,.12]];
function sino(t,f,v,pan=0,rev=.65,d=2.5){const g=A.createGain();sai(g,pan,rev);for(const[r,a,k]of PAR){if(f*r>14000)continue;const o=osc(t,d*k,f*r*(1+(Math.random()-.5)*.0012)),e=env(t,.005,v*a*.5,d*k);o.connect(e);e.connect(g);}}
function marimba(t,f,v,pan=0,rev=.28){const g=A.createGain();sai(g,pan,rev);[[1,1,.62],[3.93,.17,.1],[9.2,.05,.035]].forEach(([r,a,d])=>{const o=osc(t,d,f*r),e=env(t,.003,v*a*.8,d);o.connect(e);e.connect(g);});const n=ruido(t,.02),b=A.createBiquadFilter();b.type='bandpass';b.frequency.value=f*2.4;b.Q.value=1.2;const e=env(t,.001,v*.22,.018);n.connect(b);b.connect(e);e.connect(g);}
function pingo(t,de,para,sobe,dura,v){const g=A.createGain();sai(g,0,.05);const o=A.createOscillator();o.type='sine';o.frequency.setValueAtTime(de,t);o.frequency.exponentialRampToValueAtTime(para,t+sobe);o.start(t);o.stop(t+dura+.03);const e=env(t,.006,v,dura);o.connect(e);e.connect(g);}
const UI=[t=>pingo(t,360,760,.05,.1,.2),t=>{marimba(t,NOTA(74),.38,0,.32);marimba(t+.105,NOTA(81),.46,0,.4);},t=>{sino(t,NOTA(79),.34,-.1,.7,1.7);sino(t+.17,NOTA(86),.26,.1,.8,1.9);},t=>{marimba(t,NOTA(52),.6,0,.2);marimba(t+.15,NOTA(48),.66,0,.24);},t=>pingo(t,620,340,.04,.07,.22)];
return{ligar,tocar(i){if(A.state==='suspended')A.resume();novoBus(A.currentTime);UI[i](A.currentTime+.02);},get pronto(){return !!A;},UI};
})();
const MOD=[['Neon',m1,3350,2000],['Riscos',m2,F2+1500,1800],['Turbilhão',m3,3250,1900],['Laser',m4,3200,1700],['Faíscas',m5,3450,2000],['Dorna',m6,3480,2000],['Gotas',m7,3500,2000],['Vapor',m8,3550,2000],['Vidro',m9,3250,1800],['Eclipse',m10,3400,1900],['Cometas',m11,ABRE,ABRE]].map(([n,f,d0,d])=>[n,(g,T)=>f(g,T*d0/ABRE),ABRE,ABRE/d]);
let cv = null, Q = null;
let PR=2;function medir(){const r=cv.getBoundingClientRect(),pr=Math.min(PR,devicePixelRatio||1),W=Math.round(r.width*pr),H=Math.round(r.height*pr);if(Q&&Q.W===W&&Q.H===H)return Q;cv.width=W;cv.height=H;Q={W,H,sc:tela(W,H),m1:tela(W>>1,H>>1),m2:tela(W>>2,H>>2),m3:tela(W>>3,H>>3),b1:tela(W>>2,H>>2),b2:tela(W>>3,H>>3),bg:fundo(W,H)};return Q;}
function metade(de,para){const q=para.getContext('2d');q.clearRect(0,0,para.width,para.height);q.imageSmoothingEnabled=true;q.imageSmoothingQuality='high';q.drawImage(de,0,0,para.width,para.height);}
function borra(de,para,r){const q=para.getContext('2d');q.clearRect(0,0,para.width,para.height);q.filter=`blur(${r}px)`;q.drawImage(de,0,0);q.filter='none';}
function pinta(f,T){const{W,H,sc,m1,m2,m3,b1,b2,bg}=medir(),s=sc.getContext('2d');s.setTransform(1,0,0,1,0,0);s.globalCompositeOperation='source-over';s.globalAlpha=1;s.clearRect(0,0,W,H);const S=Math.min(W,H)/205,vw=W/S,vh=H/S;KX=vw/273.3;KY=vh/205;KM=Math.max(1,KX,KY);V={x0:50-vw/2,x1:50+vw/2,y0:50-vh/2,y1:50+vh/2};s.setTransform(S,0,0,S,W/2-50*S,H/2-50*S);s.lineCap=s.lineJoin='round';BLOOM=1;f(s,T);
metade(sc,m1);metade(m1,m2);metade(m2,m3);borra(m2,b1,Math.max(2,W/300));borra(m3,b2,Math.max(3,W/170));
const c=cv.getContext('2d');c.globalCompositeOperation='source-over';c.globalAlpha=1;c.drawImage(bg,0,0);c.globalCompositeOperation='lighter';c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalAlpha=.6*BLOOM;c.drawImage(b1,0,0,W,H);c.globalAlpha=.8*BLOOM;c.drawImage(b2,0,0,W,H);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.drawImage(sc,0,0);}

  let vez = 0;
  /** Toca a abertura i no canvas; aoFim é chamado ao terminar. */
  function tocar(i, canvas, comSom, aoFim) {
    cv = canvas; Q = null; PR = 2;
    const [, f, D, k] = MOD[i], id = ++vez, ini = performance.now() + (comSom ? 100 : 0);
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) { pinta(f, D); setTimeout(aoFim, 350); return; }
    if (comSom) {
      try {
        if (!A) ligar(new (window.AudioContext || window.webkitAudioContext)());
        if (A.state === 'suspended') A.resume();
        novoBus(A.currentTime); SOM[i](A.currentTime + 0.1 + POUSO[i] * (k - 1));
      } catch (e) { /* sem áudio, a abertura sai muda */ }
    }
    // 3.1.8: aparelho que não acompanha (quadros acima de 28 ms) desenha com menos pontos: 2, depois 1,5, depois 1.
    // O tempo é o do relógio, então a animação não atrasa nem desencontra do som.
    let n = 0, lentos = 0, antes = 0;
    const lp = (a) => {
      if (id !== vez) return;
      if (antes && a - antes > 28) lentos++;
      antes = a;
      if (++n === 18) { if (lentos > 6 && PR > 1) PR = PR > 1.5 ? 1.5 : 1; n = lentos = 0; }
      const T = a - ini; pinta(f, Math.max(0, Math.min(D, T))); if (T < D) requestAnimationFrame(lp); else aoFim();
    };
    requestAnimationFrame(lp);
  }
  function somDaTela(i) {
    try { if (!TELAS.pronto) TELAS.ligar(new (window.AudioContext || window.webkitAudioContext)()); TELAS.tocar(i); } catch (e) { /* sem áudio */ }
  }
  window.Aberturas = { total: MOD.length, tocar, parar() { vez++; }, somDaTela };
})();
