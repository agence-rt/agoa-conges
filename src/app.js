(function(){
'use strict';
var MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var MOIS_C=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
var JOURS=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
var TYPES=['Congés payés','RTT','Récupération','Sans solde','Autre'];
var NCOL=12;
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

/* ---------- dates ---------- */
var pad=function(n){return String(n).padStart(2,'0')};
var iso=function(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d)};
var parse=function(s){var a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
var toIso=function(dt){return iso(dt.getFullYear(),dt.getMonth(),dt.getDate())};
var addDays=function(s,n){var dt=parse(s);dt.setDate(dt.getDate()+n);return toIso(dt)};
var dow=function(s){return (parse(s).getDay()+6)%7};
var dim=function(y,m){return new Date(y,m+1,0).getDate()};
function isoWeek(s){var dt=parse(s);dt.setDate(dt.getDate()+3-((dt.getDay()+6)%7));var w1=new Date(dt.getFullYear(),0,4);return 1+Math.round(((dt-w1)/864e5-3+((w1.getDay()+6)%7))/7)}
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
var holCache={};
function hols(y){
  if(holCache[y])return holCache[y];
  var e=easter(y),m={};
  var add=function(n){var d=new Date(e.getTime());d.setDate(d.getDate()+n);return toIso(d)};
  m[iso(y,0,1)]='Jour de l’An';m[add(1)]='Lundi de Pâques';m[iso(y,4,1)]='Fête du Travail';
  m[iso(y,4,8)]='Victoire 1945';m[add(39)]='Ascension';m[add(50)]='Lundi de Pentecôte';
  m[iso(y,6,14)]='Fête nationale';m[iso(y,7,15)]='Assomption';m[iso(y,10,1)]='Toussaint';
  m[iso(y,10,11)]='Armistice 1918';m[iso(y,11,25)]='Noël';
  holCache[y]=m;return m;
}
var holName=function(s){return hols(+s.slice(0,4))[s]};
var isWork=function(s){return dow(s)<5&&!holName(s)};
function workdays(a,b){var n=0;for(var s=a,i=0;s<=b&&i<800;s=addDays(s,1),i++){if(isWork(s))n++}return n}
function wdClip(l,from,to){var a=l.start>from?l.start:from,b=l.end<to?l.end:to;return a>b?0:workdays(a,b)}
var fd=function(s){return +s.slice(8)+' '+MOIS_C[+s.slice(5,7)-1]};
var fdl=function(s){return JOURS[dow(s)]+' '+fd(s)};
function fmtRange(a,b){var y1=a.slice(0,4),y2=b.slice(0,4);if(a===b)return fdl(a)+' '+y1;return fdl(a)+(y1!==y2?' '+y1:'')+' → '+fdl(b)+' '+y2}
function shortRange(a,b){if(a===b)return fdl(a);return fd(a)+(a.slice(0,4)!==b.slice(0,4)?' '+a.slice(0,4):'')+' → '+fd(b)+(a.slice(0,4)!==b.slice(0,4)?' '+b.slice(0,4):'')}
var cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1)};
function short(n){var p=String(n).trim().split(/\s+/);return p[0]+(p[1]?' '+p[1].charAt(0).toUpperCase()+'.':'')}
function initials(n){var p=String(n).trim().split(/\s+/);return (p[0].charAt(0)+(p[1]?p[1].charAt(0):'')).toUpperCase()}
var colIdx=function(p){return (((p.color|0)%NCOL)+NCOL)%NCOL};
var colVar=function(p){return 'var(--c'+colIdx(p)+')'};

/* ---------- état ---------- */
var today=toIso(new Date());
function loadPrefs(){try{return JSON.parse(localStorage.getItem('cc-prefs')||'{}')||{}}catch(e){return {}}}
function savePrefs(){try{localStorage.setItem('cc-prefs',JSON.stringify({view:view,sub:sub,hidden:Array.from(hidden)}))}catch(e){}}
var prefs=loadPrefs();
var view=prefs.view==='year'||prefs.view==='report'?prefs.view:'month';
var sub=prefs.sub==='plan'?'plan':'cal';
var hidden=new Set(Array.isArray(prefs.hidden)?prefs.hidden:[]);
var cur={y:+today.slice(0,4),m:+today.slice(5,7)-1};
var people=[],leaves=[],P={},rank={};
var canWrite=true,localMode=false,loaded=false,busy=false;

function reindex(){
  people.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'fr')});
  P={};rank={};
  people.forEach(function(p,i){P[p.id]=p;rank[p.id]=i});
  leaves=leaves.filter(function(l){return l&&l.start&&l.end&&/^\d{4}-\d\d-\d\d$/.test(l.start)&&/^\d{4}-\d\d-\d\d$/.test(l.end)}).map(function(l){if(l.end<l.start){var c=Object.assign({},l);c.end=l.start;return c}return l});
}
var vis=function(){return people.filter(function(p){return !hidden.has(p.id)})};
function leavesOn(s){
  return leaves.filter(function(l){return l.start<=s&&s<=l.end&&P[l.personId]&&!hidden.has(l.personId)})
    .sort(function(a,b){return rank[a.personId]-rank[b.personId]});
}

/* ---------- stockage (fichier partagé) ---------- */
var api=window.agoaApi;
var settings={folder:'',fileName:'agoa-conges.json',dataFile:'',isDefault:false};
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function applyRaw(d){
  people=(d&&d.people||[]).filter(function(x){return !x.deleted});
  leaves=(d&&d.leaves||[]).filter(function(x){return !x.deleted});
  reindex();
}
async function commit(patch){applyRaw(await api.save(patch));render()}
var store={
  addPerson:async function(d){var id=uid();await commit({people:[Object.assign({id:id},d)]});return id},
  setPerson:async function(id,d){await commit({people:[Object.assign({id:id},d)]})},
  delPerson:async function(id){await commit({people:[{id:id,deleted:true}]})},
  addLeave:async function(d){await commit({leaves:[Object.assign({id:uid()},d)]})},
  setLeave:async function(id,d){await commit({leaves:[Object.assign({id:id},d)]})},
  delLeave:async function(id){await commit({leaves:[{id:id,deleted:true}]})}
};
async function run(fn){
  try{await fn();return true}
  catch(e){toast('Enregistrement impossible : '+(e&&e.message?String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/,''):'réessayez.'));return false}
}
var toastT=0;
function toast(msg){var t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},3600)}

/* ---------- rendu ---------- */
function chipHtml(l){
  var p=P[l.personId];
  return '<button type="button" class="chip" data-action="edit-leave" data-id="'+esc(l.id)+'" style="--pc:'+colVar(p)+'" title="'+esc(p.name+' · '+l.type+' · '+fmtRange(l.start,l.end))+'"><i class="dot"></i><span class="full">'+esc(short(p.name))+'</span><span class="ini">'+esc(initials(p.name))+'</span></button>';
}
function dayCell(s,m){
  var d=+s.slice(8),mo=+s.slice(5,7)-1,fer=holName(s),we=dow(s)>=5,ls=leavesOn(s),MAX=4;
  var cls=['day'];if(mo!==m)cls.push('out');if(we)cls.push('we');if(fer)cls.push('fer');if(s===today)cls.push('today');
  var chips=ls.slice(0,MAX).map(chipHtml).join('')+(ls.length>MAX?'<span class="more">+'+(ls.length-MAX)+'</span>':'');
  var label=fdl(s)+(fer?' · '+fer:'')+(ls.length?' · '+ls.length+' absent'+(ls.length>1?'s':''):'');
  return '<div class="'+cls.join(' ')+'" data-action="add-day" data-date="'+s+'" tabindex="0" role="gridcell" aria-label="'+esc(label)+'"><div class="dtop"><span class="dn">'+d+'</span>'+(fer?'<span class="fl" title="'+esc(fer)+'">'+esc(fer)+'</span>':'')+'</div><div class="chips">'+chips+'</div></div>';
}
function calHtml(y,m){
  var first=iso(y,m,1),off=dow(first),weeks=Math.ceil((off+dim(y,m))/7),s=addDays(first,-off);
  var h='<div class="panel"><div class="cal" role="grid" aria-label="'+MOIS[m]+' '+y+'"><div class="hd">S</div>'+JOURS.map(function(j){return '<div class="hd">'+j.slice(0,3)+'</div>'}).join('');
  for(var w=0;w<weeks;w++){
    h+='<div class="wk" title="Semaine '+isoWeek(s)+'">'+isoWeek(s)+'</div>';
    for(var d=0;d<7;d++){h+=dayCell(s,m);s=addDays(s,1)}
  }
  return h+'</div></div>';
}
function planHtml(y,m){
  var n=dim(y,m),days=[],i;
  for(i=1;i<=n;i++)days.push(iso(y,m,i));
  var vp=vis();
  if(!vp.length)return '<div class="panel empty"><h2>Aucun collaborateur affiché</h2><p>Cochez des collaborateurs dans la colonne Équipe pour les voir ici.</p></div>';
  var h='<div class="panel gantt-wrap"><div class="gantt" style="--n:'+n+'"><div class="g-name g-hd">Collaborateur</div>';
  days.forEach(function(s){
    var fer=holName(s);
    h+='<div class="g-h'+(s===today?' today':'')+'" title="'+esc(fdl(s)+(fer?' · '+fer:''))+'"><span>'+JOURS[dow(s)].charAt(0).toUpperCase()+'</span><b>'+(+s.slice(8))+'</b></div>';
  });
  vp.forEach(function(p){
    h+='<div class="g-name" style="--pc:'+colVar(p)+'"><i class="dot"></i><span title="'+esc(p.name)+'">'+esc(p.name)+'</span></div>';
    days.forEach(function(s){
      var l=leaves.find(function(x){return x.personId===p.id&&x.start<=s&&s<=x.end});
      var cls='g-c'+(dow(s)>=5?' we':'')+(holName(s)?' fer':'');
      if(l)h+='<div class="'+cls+' abs" data-action="edit-leave" data-id="'+esc(l.id)+'" style="--pc:'+colVar(p)+'" title="'+esc(p.name+' · '+l.type+' · '+fmtRange(l.start,l.end))+'"></div>';
      else h+='<div class="'+cls+'" data-action="add-cell" data-date="'+s+'" data-person="'+esc(p.id)+'"></div>';
    });
  });
  h+='<div class="g-name g-ft">Absents</div>';
  days.forEach(function(s){var c=leavesOn(s).length;h+='<div class="g-f'+(c>1?' hot':'')+'">'+(c||'')+'</div>'});
  return h+'</div></div>';
}
function listHtml(y,m){
  var from=iso(y,m,1),to=iso(y,m,dim(y,m));
  var items=leaves.filter(function(l){return l.start<=to&&l.end>=from&&P[l.personId]&&!hidden.has(l.personId)})
    .sort(function(a,b){return a.start<b.start?-1:a.start>b.start?1:rank[a.personId]-rank[b.personId]});
  var h='<section class="panel list"><h2>Absences de '+MOIS[m]+' '+y+' <span class="count">'+items.length+'</span></h2>';
  if(!items.length)return h+'<p class="none">Aucune absence ce mois-ci.</p></section>';
  items.forEach(function(l){
    var p=P[l.personId],nb=wdClip(l,from,to);
    h+='<button type="button" class="lrow" data-action="edit-leave" data-id="'+esc(l.id)+'" style="--pc:'+colVar(p)+'"><span class="who"><i class="dot"></i>'+esc(p.name)+'</span><span class="when">'+esc(shortRange(l.start,l.end))+'</span><span class="typ">'+esc(l.type)+(l.note?' · '+esc(l.note):'')+'</span><span class="nb">'+nb+' j</span></button>';
  });
  return h+'</section>';
}
function miniHtml(y,m){
  var first=iso(y,m,1),off=dow(first),n=dim(y,m),i;
  var h='<section class="mini"><h3><button type="button" data-action="goto-month" data-m="'+m+'">'+MOIS[m]+'</button></h3><div class="mg">'+JOURS.map(function(j){return '<span class="wd">'+j.charAt(0).toUpperCase()+'</span>'}).join('');
  for(i=0;i<off;i++)h+='<span class="md out"></span>';
  for(i=1;i<=n;i++){
    var s=iso(y,m,i),ls=leavesOn(s),fer=holName(s),cls=['md'];
    if(ls.length)cls.push('l'+Math.min(ls.length,3));
    if(dow(s)>=5)cls.push('we');if(fer)cls.push('fer');if(s===today)cls.push('today');
    var tip=fdl(s)+(fer?' · '+fer:'')+(ls.length?' — '+ls.map(function(l){return short(P[l.personId].name)}).join(', '):'');
    h+='<button type="button" class="'+cls.join(' ')+'" data-action="goto-month" data-m="'+m+'" title="'+esc(tip)+'">'+i+'</button>';
  }
  return h+'</div></section>';
}
function matrixHtml(y){
  var vp=vis(),tot=new Array(12).fill(0),grand=0;
  var h='<section class="panel mxbox"><h2 class="mxh">Jours ouvrés d’absence en '+y+'</h2><div class="tblwrap"><table class="mx"><thead><tr><th scope="col">Collaborateur</th>'+MOIS_C.map(function(x){return '<th scope="col">'+x.replace('.','')+'</th>'}).join('')+'<th scope="col" class="t">Total</th></tr></thead><tbody>';
  vp.forEach(function(p){
    var row=new Array(12).fill(0),sum=0;
    leaves.forEach(function(l){
      if(l.personId!==p.id||l.start>iso(y,11,31)||l.end<iso(y,0,1))return;
      for(var m=0;m<12;m++){row[m]+=wdClip(l,iso(y,m,1),iso(y,m,dim(y,m)))}
    });
    row.forEach(function(v,m){sum+=v;tot[m]+=v});grand+=sum;
    h+='<tr style="--pc:'+colVar(p)+'"><td><span class="nm"><i></i>'+esc(p.name)+'</span></td>'+row.map(function(v){return v?'<td>'+v+'</td>':'<td class="z">·</td>'}).join('')+'<td class="t">'+sum+'</td></tr>';
  });
  h+='</tbody><tfoot><tr><td>Cumul</td>'+tot.map(function(v){return '<td>'+(v||'·')+'</td>'}).join('')+'<td class="t">'+grand+'</td></tr></tfoot></table></div></section>';
  return h;
}
function yearHtml(){
  var y=cur.y,h='<div class="legend" aria-label="Légende"><span><i style="background:color-mix(in srgb,var(--accent) 24%,var(--surface))"></i>1 absent</span><span><i style="background:color-mix(in srgb,var(--accent) 46%,var(--surface))"></i>2 absents</span><span><i style="background:color-mix(in srgb,var(--accent) 80%,var(--surface))"></i>3 absents ou plus</span><span><i style="background-image:repeating-linear-gradient(135deg,transparent 0 3px,var(--hatch) 3px 4px)"></i>Jour férié</span></div><div class="year">';
  for(var m=0;m<12;m++)h+=miniHtml(y,m);
  return h+'</div>'+matrixHtml(y);
}
/* ---------- compte rendu mensuel ---------- */
function catOf(t){return t==='Congés payés'?'CP':t==='RTT'?'RTT':'Autre'}
var plu=function(n,w){return n+' '+w+(n>1?'s':'')};
function totTxt(o){return 'CP '+o.cp+', RTT '+o.rtt+(o.autre?', autres '+o.autre:'')}
function reportData(y,m){
  var from=iso(y,m,1),to=iso(y,m,dim(y,m)),tot={cp:0,rtt:0,autre:0,tot:0},rows=[];
  people.forEach(function(p){
    var r={p:p,items:[],cp:0,rtt:0,autre:0,tot:0};
    leaves.filter(function(l){return l.personId===p.id&&l.start<=to&&l.end>=from})
      .sort(function(a,b){return a.start<b.start?-1:a.start>b.start?1:0})
      .forEach(function(l){
        var nb=wdClip(l,from,to);if(!nb)return;
        var c=catOf(l.type),k=c==='CP'?'cp':c==='RTT'?'rtt':'autre';
        r[k]+=nb;r.tot+=nb;tot[k]+=nb;tot.tot+=nb;
        r.items.push({l:l,c:c,nb:nb,a:l.start>from?l.start:from,b:l.end<to?l.end:to});
      });
    rows.push(r);
  });
  return {from:from,to:to,rows:rows,tot:tot};
}
function itemNote(it,d,withType){
  var l=it.l,out=[];
  if(withType&&it.c==='Autre')out.push(l.type);
  if(l.note)out.push(l.note);
  if(l.start<d.from)out.push('commencé en '+MOIS[+l.start.slice(5,7)-1]);
  if(l.end>d.to)out.push('se poursuit en '+MOIS[+l.end.slice(5,7)-1]);
  return out.join(' · ');
}
function reportText(d,y,m){
  var L=['COMPTE RENDU DES CONGÉS — '+cap(MOIS[m])+' '+y,
    'Jours ouvrés d’absence : '+d.tot.tot+' ('+totTxt(d.tot)+')',''];
  var none=[];
  d.rows.forEach(function(r){
    if(!r.items.length){none.push(r.p.name);return}
    L.push(r.p.name+' — '+r.tot+' j ('+totTxt(r)+')');
    r.items.forEach(function(it){
      var n=itemNote(it,d,false);
      L.push('  - '+(it.c==='Autre'?it.l.type:it.c)+' · '+shortRange(it.a,it.b)+' · '+it.nb+' j'+(n?' ('+n+')':''));
    });
    L.push('');
  });
  if(none.length)L.push('Sans absence : '+none.join(', '));
  L.push('Jours ouvrés : hors week-ends et jours fériés.');
  return L.join('\n');
}
function reportHtml(){
  var y=cur.y,m=cur.m,d=reportData(y,m),t=d.tot;
  var withAbs=d.rows.filter(function(r){return r.items.length}),none=d.rows.filter(function(r){return !r.items.length});
  var h='<section class="panel rep"><div class="rep-h"><div><h2>Compte rendu · '+cap(MOIS[m])+' '+y+'</h2><p>'+(t.tot?plu(t.tot,'jour')+' ouvré'+(t.tot>1?'s':'')+' d’absence · CP '+t.cp+' · RTT '+t.rtt+(t.autre?' · autres '+t.autre:''):'Aucune absence ce mois-ci.')+'</p></div><div class="hbtns"><button type="button" class="btn primary" data-action="copy-report">Copier le texte</button><button type="button" class="btn" data-action="save-report">Enregistrer en .txt</button></div></div>';
  h+='<textarea id="repTxt" class="rtxt" rows="12" readonly hidden aria-label="Texte du compte rendu"></textarea>';
  h+='<div class="tblwrap"><table class="mx sm"><thead><tr><th scope="col">Collaborateur</th><th scope="col">CP</th><th scope="col">RTT</th><th scope="col">Autres</th><th scope="col" class="t">Total</th></tr></thead><tbody>';
  var cell=function(v){return v?'<td>'+v+'</td>':'<td class="z">·</td>'};
  d.rows.forEach(function(r){
    h+='<tr style="--pc:'+colVar(r.p)+'"><td><span class="nm"><i></i>'+esc(r.p.name)+'</span></td>'+cell(r.cp)+cell(r.rtt)+cell(r.autre)+'<td class="t">'+r.tot+'</td></tr>';
  });
  h+='</tbody><tfoot><tr><td>Équipe</td>'+cell(t.cp)+cell(t.rtt)+cell(t.autre)+'<td class="t">'+t.tot+'</td></tr></tfoot></table></div>';
  if(withAbs.length){
    h+='<div class="rdet"><h3>Détail par collaborateur</h3>';
    withAbs.forEach(function(r){
      h+='<div class="rp" style="--pc:'+colVar(r.p)+'"><div class="rph"><span class="who"><i class="dot"></i>'+esc(r.p.name)+'</span><span class="pt">'+r.tot+' j · '+esc(totTxt(r))+'</span></div>';
      r.items.forEach(function(it){
        var tag=it.c==='CP'?'<span class="tag cp">CP</span>':it.c==='RTT'?'<span class="tag rtt">RTT</span>':'<span class="tag ot">Autre</span>';
        h+='<div class="rr"><span class="when">'+esc(shortRange(it.a,it.b))+'</span><span>'+tag+'</span><span class="typ">'+esc(itemNote(it,d,true))+'</span><span class="nb">'+it.nb+' j</span></div>';
      });
      h+='</div>';
    });
    h+='</div>';
  }
  if(none.length)h+='<p class="hint">Sans absence : '+esc(none.map(function(r){return r.p.name}).join(', '))+'.</p>';
  return h+'</section>';
}
function copyReport(){
  var d=reportData(cur.y,cur.m),txt=reportText(d,cur.y,cur.m),ta=$('#repTxt');
  function fallback(){if(ta){ta.hidden=false;ta.value=txt;ta.focus();ta.select()}toast('Sélectionnez le texte puis copiez-le (Ctrl+C).')}
  try{navigator.clipboard.writeText(txt).then(function(){toast('Compte rendu copié.')},fallback)}catch(e){fallback()}
}
function saveReport(){
  var d=reportData(cur.y,cur.m),txt=reportText(d,cur.y,cur.m);
  api.saveText('Compte-rendu-conges-'+cur.y+'-'+pad(cur.m+1)+'.txt',txt).then(function(r){
    if(r&&r.saved)toast('Compte rendu enregistré.');
  },function(){toast('Enregistrement impossible.')});
}
function openSettings(){
  openModal('<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">Dossier de données</h2>'+
    '<p class="info">Le calendrier est enregistré dans le fichier <b>'+esc(settings.fileName)+'</b>. Placez-le dans un dossier Dropbox partagé et choisissez ce même dossier sur chaque poste : tout le monde voit alors les mêmes congés.</p>'+
    '<div class="fld"><span class="lbl">Emplacement actuel</span><div class="when" style="word-break:break-all">'+esc(settings.dataFile)+'</div></div>'+
    '<div class="acts"><button class="btn primary" type="button" id="sChoose">Choisir un dossier…</button><button class="btn" type="button" id="sOpen">Afficher le fichier</button><button class="btn push" type="button" id="sClose">Fermer</button></div>'+
    '<p class="hint">AGOA CG, version '+esc(settings.version||'')+' · <button type="button" class="lnk" id="sUpd">Rechercher une mise à jour</button></p><p class="hint" id="sUpdMsg" aria-live="polite"></p></div>');
  $('#sUpd').addEventListener('click',async function(){
    $('#sUpdMsg').textContent='Recherche en cours…';
    try{$('#sUpdMsg').textContent=await api.checkUpdate()}catch(e){$('#sUpdMsg').textContent='Recherche impossible.'}
  });
  $('#sClose').addEventListener('click',closeModal);
  $('#sOpen').addEventListener('click',function(){api.showFolder()});
  $('#sChoose').addEventListener('click',async function(){
    try{
      var r=await api.chooseFolder();
      if(!r)return;
      settings=r.settings;applyRaw(r.data);closeModal();render();
      toast(r.copied?'Dossier changé. Les données actuelles y ont été copiées.':'Dossier changé. Le fichier existant a été repris.');
    }catch(e){toast('Changement de dossier impossible.')}
  });
}

function emptyHtml(){
  return '<section class="panel empty"><h2>Aucun collaborateur</h2><p>Ajoutez les collaborateurs dans la colonne Équipe, puis saisissez leurs dates d’absence. Le calendrier se remplit au fur et à mesure, par mois ou sur l’année.</p>'+(canWrite?'<button type="button" class="btn" data-action="demo-load">Voir un exemple</button>':'')+'</section>';
}
function renderMain(){
  var el=$('#main');
  if(!loaded){el.innerHTML='<section class="panel empty"><h2>Chargement</h2><p>Récupération du calendrier de l’équipe…</p></section>';return}
  if(!people.length){el.innerHTML=emptyHtml();return}
  el.innerHTML=view==='year'?yearHtml():view==='report'?reportHtml():(sub==='plan'?planHtml(cur.y,cur.m):calHtml(cur.y,cur.m))+listHtml(cur.y,cur.m);
}
function renderTeam(){
  var from,to,lab;
  if(view==='year'){from=iso(cur.y,0,1);to=iso(cur.y,11,31);lab='en '+cur.y}
  else{from=iso(cur.y,cur.m,1);to=iso(cur.y,cur.m,dim(cur.y,cur.m));lab='en '+MOIS[cur.m]+' '+cur.y}
  $('#teamCount').textContent=people.length;
  $('#plist').innerHTML=people.map(function(p){
    var off=hidden.has(p.id),n=0;
    leaves.forEach(function(l){if(l.personId===p.id)n+=wdClip(l,from,to)});
    return '<li class="prow'+(off?' off':'')+'" style="--pc:'+colVar(p)+'"><button type="button" class="swb" data-action="toggle-person" data-id="'+esc(p.id)+'" aria-pressed="'+(!off)+'" aria-label="'+(off?'Afficher ':'Masquer ')+esc(p.name)+'"><i class="sq"></i><span class="pn">'+esc(p.name)+'</span></button><span class="pc">'+(n?n+' j':'—')+'</span><button type="button" class="icon sm" data-action="edit-person" data-id="'+esc(p.id)+'" aria-label="Modifier '+esc(p.name)+'"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></li>';
  }).join('');
  $('#teamHint').textContent='j = jours ouvrés d’absence '+lab+'.';
  $('#addPerson').hidden=!canWrite;
}
function renderTop(){
  var n=0,ids={};
  leaves.forEach(function(l){if(l.start<=today&&today<=l.end&&P[l.personId]&&!ids[l.personId]){ids[l.personId]=1;n++}});
  $('#sub').textContent=!loaded?'Chargement…':people.length+' collaborateur'+(people.length>1?'s':'')+' · '+(n?n+' absent'+(n>1?'s':'')+' aujourd’hui':'personne d’absent aujourd’hui');
  $('#btnAdd').hidden=!canWrite;
  $('#app').classList.toggle('ro',!canWrite);
}
function renderBanner(){
  var b=$('#banner'),h='';
  var demo=people.some(function(p){return p.demo})||leaves.some(function(l){return l.demo});
  if(settings.isDefault)h+='<p>Les données sont enregistrées sur ce poste uniquement. Choisissez un dossier Dropbox partagé pour que toute l’équipe voie le même calendrier.</p><button type="button" class="btn" data-action="open-settings">Choisir le dossier</button>';
  if(!canWrite&&!localMode)h+='<p>Lecture seule : vous pouvez consulter le calendrier mais pas le modifier.</p>';
  if(demo)h+='<p>Les noms et les dates affichés sont un exemple fictif.</p>'+(canWrite?'<button type="button" class="btn" data-action="demo-clear">Supprimer l’exemple</button>':'');
  b.innerHTML=h;b.hidden=!h;
}
function renderToolbar(){
  $('#vMonth').setAttribute('aria-pressed',String(view==='month'));
  $('#vYear').setAttribute('aria-pressed',String(view==='year'));
  $('#vReport').setAttribute('aria-pressed',String(view==='report'));
  $('#sCal').setAttribute('aria-pressed',String(sub==='cal'));
  $('#sPlan').setAttribute('aria-pressed',String(sub==='plan'));
  $('#subSeg').hidden=view!=='month';
  $('#navLabel').textContent=view==='year'?String(cur.y):cap(MOIS[cur.m])+' '+cur.y;
}
function render(){renderTop();renderBanner();renderToolbar();renderMain();renderTeam()}

/* ---------- fenêtres ---------- */
var modal=$('#modal'),lastFocus=null;
function openModal(html){lastFocus=document.activeElement;modal.innerHTML=html;modal.hidden=false;var f=modal.querySelector('input:not([disabled]),select:not([disabled]),button');if(f)f.focus()}
function closeModal(){if(modal.hidden)return;modal.hidden=true;modal.innerHTML='';if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))lastFocus.focus()}
modal.addEventListener('mousedown',function(e){if(e.target===modal)closeModal()});

function armDelete(btn,idleLabel,armedLabel,go){
  var armed=false,t=0;
  btn.addEventListener('click',function(){
    if(!armed){armed=true;btn.textContent=armedLabel;btn.classList.add('armed');t=setTimeout(function(){armed=false;btn.textContent=idleLabel;btn.classList.remove('armed')},4000);return}
    clearTimeout(t);go();
  });
}
function openLeave(l){
  if(!people.length){toast('Ajoutez d’abord un collaborateur.');return}
  var edit=!!l.id,ro=!canWrite,dis=ro?' disabled':'';
  var types=TYPES.indexOf(l.type)<0?TYPES.concat([l.type]):TYPES;
  openModal('<form class="sheet" id="fLeave" novalidate aria-labelledby="mt"><h2 id="mt">'+(ro?'Absence':edit?'Modifier l’absence':'Ajouter une absence')+'</h2>'+
    '<div class="fld"><label for="fPerson">Collaborateur</label><select id="fPerson"'+dis+'>'+people.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===l.personId?' selected':'')+'>'+esc(p.name)+'</option>'}).join('')+'</select></div>'+
    '<div class="fld"><label for="fType">Type</label><select id="fType"'+dis+'>'+types.map(function(t){return '<option'+(t===l.type?' selected':'')+'>'+esc(t)+'</option>'}).join('')+'</select></div>'+
    '<div class="two"><div class="fld"><label for="fStart">Du</label><input id="fStart" type="date" value="'+l.start+'"'+dis+'></div><div class="fld"><label for="fEnd">Au</label><input id="fEnd" type="date" value="'+l.end+'"'+dis+'></div></div>'+
    '<div class="fld"><label for="fNote">Note</label><input id="fNote" type="text" maxlength="120" value="'+esc(l.note||'')+'" placeholder="Facultatif"'+dis+'></div>'+
    '<p class="info" id="fInfo" aria-live="polite"></p>'+
    '<div class="acts">'+(ro?'':'<button class="btn primary" type="submit" id="fSave">Enregistrer</button>')+'<button class="btn" type="button" id="fCancel">'+(ro?'Fermer':'Annuler')+'</button>'+(edit&&!ro?'<button class="btn danger push" type="button" id="fDel">Supprimer</button>':'')+'</div></form>');
  var info=$('#fInfo'),sEl=$('#fStart'),eEl=$('#fEnd');
  function upd(){
    var a=sEl.value,b=eEl.value;
    if(!a||!b){info.textContent='Renseignez les deux dates.';return}
    if(b<a){info.textContent='La date de fin précède la date de début.';return}
    var pid=$('#fPerson').value,nb=workdays(a,b);
    var others=[];
    leaves.forEach(function(x){if(x.id!==l.id&&x.personId!==pid&&P[x.personId]&&x.start<=b&&x.end>=a){var n=short(P[x.personId].name);if(others.indexOf(n)<0)others.push(n)}});
    info.innerHTML='<b>'+nb+' jour'+(nb>1?'s':'')+' ouvré'+(nb>1?'s':'')+'</b> · '+esc(fmtRange(a,b))+(others.length?'<br>Aussi absents sur la période : '+esc(others.join(', '))+'.':'');
  }
  sEl.addEventListener('change',function(){if(eEl.value&&eEl.value<sEl.value)eEl.value=sEl.value;upd()});
  eEl.addEventListener('change',upd);$('#fPerson').addEventListener('change',upd);upd();
  $('#fCancel').addEventListener('click',closeModal);
  $('#fLeave').addEventListener('submit',async function(e){
    e.preventDefault();if(ro||busy)return;
    var a=sEl.value,b=eEl.value;
    if(!a||!b){info.textContent='Renseignez les deux dates.';return}
    if(b<a)b=a;
    var data={personId:$('#fPerson').value,type:$('#fType').value,start:a,end:b,note:$('#fNote').value.trim()};
    if(l.demo)data.demo=true;
    busy=true;$('#fSave').disabled=true;
    var ok=await run(function(){return edit?store.setLeave(l.id,data):store.addLeave(data)});
    busy=false;
    if(ok){closeModal();if(!edit){var y=+a.slice(0,4),m=+a.slice(5,7)-1;if(view==='month'&&(cur.y!==y||cur.m!==m)){cur={y:y,m:m};render()}else if(view==='year'&&cur.y!==y){cur.y=y;render()}}}
    else $('#fSave')&&($('#fSave').disabled=false);
  });
  var del=$('#fDel');
  if(del)armDelete(del,'Supprimer','Confirmer',async function(){if(busy)return;busy=true;var ok=await run(function(){return store.delLeave(l.id)});busy=false;if(ok)closeModal()});
}
function openPerson(p){
  var ro=!canWrite,color=colIdx(p),nLeaves=leaves.filter(function(l){return l.personId===p.id}).length;
  openModal('<form class="sheet" id="fPers" novalidate aria-labelledby="mt"><h2 id="mt">Collaborateur</h2>'+
    '<div class="fld"><label for="pName">Nom</label><input id="pName" type="text" maxlength="60" value="'+esc(p.name)+'"'+(ro?' disabled':'')+'></div>'+
    '<div class="fld"><span class="lbl" id="pColL">Couleur</span><div class="sws" role="group" aria-labelledby="pColL">'+Array.from({length:NCOL},function(_,i){return '<button type="button" class="sw" data-c="'+i+'" style="--pc:var(--c'+i+')" aria-pressed="'+(i===color)+'" aria-label="Couleur '+(i+1)+'"'+(ro?' disabled':'')+'></button>'}).join('')+'</div></div>'+
    '<p class="info">'+nLeaves+' absence'+(nLeaves>1?'s':'')+' enregistrée'+(nLeaves>1?'s':'')+'.</p>'+
    '<div class="acts">'+(ro?'':'<button class="btn primary" type="submit" id="pSave">Enregistrer</button>')+'<button class="btn" type="button" id="pCancel">'+(ro?'Fermer':'Annuler')+'</button>'+(ro?'':'<button class="btn danger push" type="button" id="pDel">Supprimer</button>')+'</div></form>');
  modal.querySelectorAll('.sw').forEach(function(b){b.addEventListener('click',function(){color=+b.dataset.c;modal.querySelectorAll('.sw').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))})})});
  $('#pCancel').addEventListener('click',closeModal);
  $('#fPers').addEventListener('submit',async function(e){
    e.preventDefault();if(ro||busy)return;
    var name=$('#pName').value.trim();if(!name){$('#pName').focus();return}
    var data={name:name,color:color,order:p.order||Date.now()};if(p.demo)data.demo=true;
    busy=true;var ok=await run(function(){return store.setPerson(p.id,data)});busy=false;if(ok)closeModal();
  });
  var del=$('#pDel');
  if(del)armDelete(del,'Supprimer','Supprimer aussi ses '+nLeaves+' absence'+(nLeaves>1?'s':'')+' ?',async function(){
    if(busy)return;busy=true;
    var ok=await run(async function(){
      var mine=leaves.filter(function(l){return l.personId===p.id});
      for(var i=0;i<mine.length;i++)await store.delLeave(mine[i].id);
      await store.delPerson(p.id);
    });
    busy=false;if(ok){hidden.delete(p.id);savePrefs();closeModal()}
  });
}

/* ---------- exemple ---------- */
async function loadDemo(){
  if(busy)return;busy=true;
  var y=+today.slice(0,4),mon=addDays(today,-dow(today));
  var names=[['Camille Roux',0],['Hugo Blanc',1],['Inès Moreau',2],['Paul Girard',3],['Sofia Lambert',4],['Léo Fabre',5]],ids=[];
  var spec=[
    [0,addDays(mon,2),addDays(mon,4),TYPES[0]],[1,addDays(mon,7),addDays(mon,13),TYPES[0]],[2,addDays(mon,9),addDays(mon,11),TYPES[1]],
    [3,addDays(mon,21),addDays(mon,34),TYPES[0]],[4,addDays(mon,-5),addDays(mon,-3),TYPES[1]],[5,addDays(mon,14),addDays(mon,16),TYPES[2]],
    [0,iso(y,7,10),iso(y,7,21),TYPES[0]],[1,iso(y,7,3),iso(y,7,14),TYPES[0]],[4,iso(y,11,21),iso(y+1,0,1),TYPES[0]],[2,iso(y,3,13),iso(y,3,17),TYPES[0]]
  ];
  var ok=await run(async function(){
    for(var i=0;i<names.length;i++)ids.push(await store.addPerson({name:names[i][0],color:names[i][1],order:Date.now()+i,demo:true}));
    for(var j=0;j<spec.length;j++)await store.addLeave({personId:ids[spec[j][0]],start:spec[j][1],end:spec[j][2],type:spec[j][3],note:'',demo:true});
  });
  busy=false;if(ok)toast('Exemple chargé.');
}
async function clearDemo(){
  if(busy)return;busy=true;
  var ok=await run(async function(){
    var Pp=people.filter(function(p){return p.demo}),ids={};Pp.forEach(function(p){ids[p.id]=1});var L=leaves.filter(function(l){return l.demo||ids[l.personId]}),i;
    for(i=0;i<L.length;i++)await store.delLeave(L[i].id);
    for(i=0;i<Pp.length;i++)await store.delPerson(Pp[i].id);
  });
  busy=false;if(ok)toast('Exemple supprimé.');
}

/* ---------- actions ---------- */
function defPerson(){var v=vis();return (v[0]||people[0]||{}).id}
function defDate(){return today.slice(0,4)==String(cur.y)&&(view==='year'||+today.slice(5,7)-1===cur.m)?today:iso(cur.y,view==='year'?0:cur.m,1)}
function act(t){
  var a=t.dataset.action;
  if(a==='view'){
    var nv=t.dataset.v==='year'?'year':t.dataset.v==='report'?'report':'month';
    /* Début de mois : le compte rendu s’ouvre sur le mois qui vient de se terminer. */
    if(nv==='report'&&view!=='report'&&+today.slice(8)<=10&&cur.y===+today.slice(0,4)&&cur.m===+today.slice(5,7)-1){cur.m--;if(cur.m<0){cur.m=11;cur.y--}}
    view=nv;
  }
  else if(a==='sub')sub=t.dataset.v==='plan'?'plan':'cal';
  else if(a==='prev'||a==='next'){
    var k=a==='next'?1:-1;
    if(view==='year')cur.y+=k;else{cur.m+=k;if(cur.m<0){cur.m=11;cur.y--}else if(cur.m>11){cur.m=0;cur.y++}}
  }
  else if(a==='today')cur={y:+today.slice(0,4),m:+today.slice(5,7)-1};
  else if(a==='goto-month'){cur.m=+t.dataset.m;view='month'}
  else if(a==='toggle-person'){var id=t.dataset.id;if(hidden.has(id))hidden.delete(id);else hidden.add(id)}
  else if(a==='show-all')hidden.clear();
  else if(a==='hide-all')people.forEach(function(p){hidden.add(p.id)});
  else{other(a,t);return}
  savePrefs();render();
}
function other(a,t){
  if(a==='open-add'){if(canWrite){var d=defDate();openLeave({personId:defPerson(),start:d,end:d,type:TYPES[0]})}}
  else if(a==='add-day'){if(canWrite){var s=t.dataset.date;openLeave({personId:defPerson(),start:s,end:s,type:TYPES[0]})}}
  else if(a==='add-cell'){if(canWrite){var s2=t.dataset.date;openLeave({personId:t.dataset.person,start:s2,end:s2,type:TYPES[0]})}}
  else if(a==='edit-leave'){var l=leaves.find(function(x){return x.id===t.dataset.id});if(l)openLeave(l)}
  else if(a==='edit-person'){var p=P[t.dataset.id];if(p)openPerson(p)}
  else if(a==='copy-report')copyReport();
  else if(a==='save-report')saveReport();
  else if(a==='open-settings')openSettings();
  else if(a==='demo-load')loadDemo();
  else if(a==='demo-clear')clearDemo();
}
document.addEventListener('click',function(e){
  if(modal.contains(e.target))return;
  var t=e.target.closest('[data-action]');if(t)act(t);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeModal();return}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.day[data-action]')){e.preventDefault();act(e.target)}
});
$('#addPerson').addEventListener('submit',async function(e){
  e.preventDefault();if(!canWrite||busy)return;
  var inp=$('#newPerson'),name=inp.value.trim();if(!name)return;
  var used={};people.forEach(function(p){used[colIdx(p)]=1});
  var c=0;while(c<NCOL&&used[c])c++;if(c>=NCOL)c=people.length%NCOL;
  busy=true;var ok=await run(function(){return store.addPerson({name:name,color:c,order:Date.now()})});busy=false;
  if(ok){inp.value='';inp.focus()}
});

/* ---------- démarrage ---------- */
async function init(){
  render();
  try{
    settings=await api.getSettings();
    applyRaw(await api.load());
  }catch(e){
    applyRaw({people:[],leaves:[]});
    toast('Lecture du fichier de données impossible : '+(e&&e.message?String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/,''):'erreur inconnue'));
  }
  loaded=true;render();
  api.onChange(function(d){applyRaw(d);render()});
  window.addEventListener('focus',function(){var t=toIso(new Date());if(t!==today){today=t;render()}});
}
init();
})();
