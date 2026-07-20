// @ts-nocheck
import "./octahedron.css";

(() => {
  "use strict";
  const root = document.getElementById("octahedron-root");
  if (!(root instanceof HTMLElement)) return;
  const mode = root.dataset.mode === "embed" ? "embed" : "standalone";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SQRT3 = Math.sqrt(3);
  const FOLD_ANGLE = Math.acos(1 / 3);
  const FACE_IDS = ["000","001","010","011","100","101","110","111"];
  const LOCAL = {0:[0,SQRT3/2],1:[-.5,0],2:[.5,0]};
  const REPS = [
    {id:"balanced", roman:"I", title:"Three equal arms", arms:"(2, 2, 2)", net:{root:"111",order:["111","101","001","000","100","010","110","011"],parent:{"111":null,"101":"111","001":"101","000":"001","100":"000","010":"000","110":"100","011":"010"}},tiles:{"000":7,"001":5,"010":3,"011":1,"100":6,"101":4,"110":2,"111":0}},
    {id:"unequal", roman:"II", title:"Three unequal arms", arms:"(3, 2, 1)", net:{root:"011",order:["011","010","000","001","100","101","110","111"],parent:{"011":null,"010":"011","000":"010","001":"000","100":"000","101":"001","110":"100","111":"110"}},tiles:{"000":7,"001":5,"010":2,"011":0,"100":6,"101":4,"110":3,"111":1}},
    {id:"long", roman:"III", title:"One long arm", arms:"(4, 1, 1)", net:{root:"101",order:["101","001","000","100","010","110","111","011"],parent:{"101":null,"001":"101","000":"001","100":"000","010":"000","110":"100","111":"110","011":"111"}},tiles:{"000":7,"001":1,"010":2,"011":4,"100":6,"101":0,"110":3,"111":5}}
  ];
  const state = {rep:0, fold:0, yaw:.72, pitch:-.48, zoom:1, labels:false, graph:false, dragging:false, pointer:null, lastX:0, lastY:0, animation:0};
  const add2=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]], scale2=(a,s)=>[a[0]*s,a[1]*s], mix2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const dot2=(a,b)=>a[0]*b[0]+a[1]*b[1];
  const midpoint=(a,b)=>mix2(a,b,.5);
  const centroid2=pts=>scale2(pts.reduce((s,p)=>add2(s,p),[0,0]),1/pts.length);
  const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], scale3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm3=a=>{const n=Math.sqrt(dot3(a,a));return n<1e-12?[0,0,0]:scale3(a,1/n)};
  const centroid3=pts=>scale3(pts.reduce((s,p)=>add3(s,p),[0,0,0]),1/pts.length);
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const faceBits=f=>[+f[0],+f[1],+f[2]];
  const changedAxis=(a,b)=>{const x=faceBits(a),y=faceBits(b);return [0,1,2].find(i=>x[i]!==y[i])};
  const tileBit=(tile,axis)=>(tile>>(2-axis))&1;
  const tileWord=tile=>tile.toString(2).padStart(3,"0");
  const reflect=(p,a,b)=>{const d=sub2(b,a);const t=dot2(sub2(p,a),d)/dot2(d,d);const foot=add2(a,scale2(d,t));return sub2(scale2(foot,2),p)};
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const multiply=(A,B)=>{const C=Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[r*4+c]+=A[r*4+k]*B[k*4+c];return C};
  const transform=(M,p)=>[M[0]*p[0]+M[1]*p[1]+M[2]*p[2]+M[3],M[4]*p[0]+M[5]*p[1]+M[6]*p[2]+M[7],M[8]*p[0]+M[9]*p[1]+M[10]*p[2]+M[11]];
  const rotationLine=(a,b,angle)=>{const [x,y,z]=norm3(sub3(b,a)),c=Math.cos(angle),s=Math.sin(angle),t=1-c;const R=[c+x*x*t,x*y*t-z*s,x*z*t+y*s,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z*t];const ra=[R[0]*a[0]+R[1]*a[1]+R[2]*a[2],R[3]*a[0]+R[4]*a[1]+R[5]*a[2],R[6]*a[0]+R[7]*a[1]+R[8]*a[2]];const q=sub3(a,ra);return [R[0],R[1],R[2],q[0],R[3],R[4],R[5],q[1],R[6],R[7],R[8],q[2],0,0,0,1]};
  const rotationX=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,-s,0,0,s,c,0,0,0,0,1]};
  const rotationY=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,s,0,0,1,0,0,-s,0,c,0,0,0,0,1]};
  const rotationZ=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,-s,0,0,s,c,0,0,0,0,1,0,0,0,0,1]};
  const svg=(name,attrs={})=>{const el=document.createElementNS(SVG_NS,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el};
  function geometry(rep){
    if(rep._geometry)return rep._geometry;
    const g={[rep.net.root]:{0:[...LOCAL[0]],1:[...LOCAL[1]],2:[...LOCAL[2]]}}, hinges={};
    for(const face of rep.net.order.slice(1)){
      const parent=rep.net.parent[face],axis=changedAxis(parent,face),shared=[0,1,2].filter(i=>i!==axis),a=g[parent][shared[0]],b=g[parent][shared[1]];
      g[face]={[shared[0]]:a,[shared[1]]:b,[axis]:reflect(g[parent][axis],a,b)};
      const childCentre=centroid2([g[face][0],g[face][1],g[face][2]]), derivative=cross3(norm3([b[0]-a[0],b[1]-a[1],0]),[childCentre[0]-a[0],childCentre[1]-a[1],0]);
      hinges[face]={parent,start:shared[0],end:shared[1],sign:derivative[2]>=0?1:-1};
    }
    rep._geometry={g,hinges};return rep._geometry;
  }
  function transforms(rep,fold){
    const {g,hinges}=geometry(rep), T={[rep.net.root]:identity()};
    for(const face of rep.net.order.slice(1)){
      const h=hinges[face], P=T[h.parent], a2=g[h.parent][h.start],b2=g[h.parent][h.end],a=transform(P,[a2[0],a2[1],0]),b=transform(P,[b2[0],b2[1],0]);
      T[face]=multiply(rotationLine(a,b,h.sign*FOLD_ANGLE*fold),P);
    }
    return T;
  }
  const faceVertices=(rep,face)=>{const {g}=geometry(rep);return [g[face][0],g[face][1],g[face][2]]};
  const sideMid=(rep,face,axis)=>{const other=[0,1,2].filter(i=>i!==axis),{g}=geometry(rep);return midpoint(g[face][other[0]],g[face][other[1]])};
  function cubic(a,b,c,d,t){const u=1-t,uu=u*u,tt=t*t;return [u*uu*a[0]+3*uu*t*b[0]+3*u*tt*c[0]+tt*t*d[0],u*uu*a[1]+3*uu*t*b[1]+3*u*tt*c[1]+tt*t*d[1]]}
  function curveSubpaths(rep,face,tile){
    const verts=faceVertices(rep,face), centre=centroid2(verts), edge=Math.hypot(verts[1][0]-verts[0][0],verts[1][1]-verts[0][1]);
    const radius=edge*.19, shoulder=edge*.13, portHandle=edge*.068;
    const sides=[0,1,2].map(axis=>{const m=sideMid(rep,face,axis),a=(Math.atan2(m[1]-centre[1],m[0]-centre[0])+Math.PI*2)%(Math.PI*2);return{axis,m,a}}).sort((a,b)=>a.a-b.a);
    const cp=(a,r=radius)=>[centre[0]+r*Math.cos(a),centre[1]+r*Math.sin(a)], tangent=a=>[-Math.sin(a),Math.cos(a)], shift=(p,v,k)=>[p[0]+v[0]*k,p[1]+v[1]*k], unit=v=>{const n=Math.hypot(v[0],v[1]);return [v[0]/n,v[1]/n]};
    const paths=[[]];let current=paths[0];
    sides.forEach((s,index)=>{
      const a0=s.a-Math.PI/3,a1=s.a+Math.PI/3,start=cp(a0),end=cp(a1),ts=tangent(a0),te=tangent(a1);
      if(index===0)current.push(start);
      if(tileBit(tile,s.axis)){
        const n=[Math.cos(s.a),Math.sin(s.a)],t=tangent(s.a),incoming=unit([n[0]+t[0],n[1]+t[1]]),outgoing=unit([-n[0]+t[0],-n[1]+t[1]]),c1=shift(start,ts,shoulder),c2=shift(s.m,incoming,-portHandle);
        for(let k=1;k<=10;k++)current.push(cubic(start,c1,c2,s.m,k/10));
        current=[];paths.push(current);current.push(s.m);
        const c3=shift(s.m,outgoing,portHandle),c4=shift(end,te,-shoulder);
        for(let k=1;k<=10;k++)current.push(cubic(s.m,c3,c4,end,k/10));
      } else {
        const handle=(4/3)*Math.tan(Math.PI/6)*radius,c1=shift(start,ts,handle),c2=shift(end,te,-handle);
        for(let k=1;k<=14;k++)current.push(cubic(start,c1,c2,end,k/14));
      }
    });
    return paths.filter(p=>p.length>1);
  }
  function validate(rep){
    const words=Object.values(rep.tiles).sort((a,b)=>a-b);if(words.some((v,i)=>v!==i))throw new Error(`${rep.id}: inventory error`);
    let active=0;
    for(const face of FACE_IDS){const bits=faceBits(face);for(let axis=0;axis<3;axis++)if(bits[axis]===0){const n=[...bits];n[axis]=1;const other=n.join("");if(tileBit(rep.tiles[face],axis)!==tileBit(rep.tiles[other],axis))throw new Error(`${rep.id}: mismatch`);if(tileBit(rep.tiles[face],axis))active++;}}
    if(active!==6)throw new Error(`${rep.id}: expected six active edges`);
  }
  REPS.forEach(validate);
  root.innerHTML=`<div class="octa-page" data-mode="${mode}">
    <header class="octa-header">
      <a class="octa-brand" href="https://mathnomad.in" target="_top" aria-label="Math Nomad home"><span class="octa-monogram">MN</span><span><strong>Math Nomad</strong><small>Interactive laboratory</small></span></a>
      <div class="octa-header-copy"><div class="octa-kicker">Sandbox 04</div><h1>Kolams on an <em>Octahedron</em></h1><p>Compare the three graph theoretic representatives on connected octahedron nets and explore the completed solid.</p></div>
    </header>
    <main class="octa-shell"><div class="octa-layout">
      <section class="octa-representatives" aria-label="Choose one of the three kolams"><p class="octa-section-label">Three representatives</p></section>
      <section class="octa-viewer" aria-labelledby="octa-current-title">
        <div class="octa-viewer-head"><div><small>Selected representative</small><h2 id="octa-current-title"></h2></div><span class="octa-arm-badge"></span></div>
        <div class="octa-stage-wrap"><svg id="octa-stage" class="octa-stage" viewBox="0 0 900 610" role="img" tabindex="0" aria-label="Kolams on an octahedron"></svg><span class="octa-stage-hint">Drag to rotate · Scroll to zoom</span></div>
        <div class="octa-controls">
          <div class="octa-fold-row"><button class="octa-fold-button" type="button">Fold the net</button><input id="fold-range" type="range" min="0" max="100" value="0" aria-label="Fold amount"><output for="fold-range">0%</output></div>
          <div class="octa-tool-row" aria-label="View controls">
            <button class="octa-control" type="button" data-action="rotate-left" aria-label="Rotate left">↶ Rotate</button>
            <button class="octa-control" type="button" data-action="rotate-right" aria-label="Rotate right">Rotate ↷</button>
            <button class="octa-control" type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
            <button class="octa-control" type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
            <span class="octa-divider" aria-hidden="true"></span>
            <button class="octa-control" type="button" data-action="labels" aria-pressed="false">Tile labels</button>
            <button class="octa-control" type="button" data-action="graph" aria-pressed="false">Active graph</button>
            <button class="octa-control" type="button" data-action="reset">Reset view</button>
          </div><p class="octa-status">The flat net shows the connected nonzero kolam; the 000 tile is attached along an inactive edge.</p>
        </div>
      </section>
    </div></main><p class="octa-screen-reader" aria-live="polite"></p>
  </div>`;
  const repHost=root.querySelector(".octa-representatives"), stage=root.querySelector("#octa-stage"), title=root.querySelector("#octa-current-title"), badge=root.querySelector(".octa-arm-badge"), range=root.querySelector("#fold-range"), output=root.querySelector("output"), foldButton=root.querySelector(".octa-fold-button"), live=root.querySelector(".octa-screen-reader");
  function projectedPath(points,close=false){if(!points.length)return"";return `M ${points.map((p,i)=>`${i?"L ":""}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ")}${close?" Z":""}`;}
  function buildMini(rep){
    const art=svg("svg",{class:"octa-mini",viewBox:"0 0 190 116","aria-hidden":"true"}), all=FACE_IDS.flatMap(f=>faceVertices(rep,f).map(p=>[p[1],-p[0]])),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),s=Math.min(172/(maxx-minx),98/(maxy-miny)),ox=95-(minx+maxx)*s/2,oy=58-(miny+maxy)*s/2,map=p=>[ox+p[1]*s,oy-p[0]*s];
    for(const face of FACE_IDS){const group=svg("g"),tri=faceVertices(rep,face).map(map);group.append(svg("path",{class:"octa-mini-face",d:projectedPath(tri,true)}));for(const sub of curveSubpaths(rep,face,rep.tiles[face]))group.append(svg("path",{class:"octa-mini-curve",d:projectedPath(sub.map(map),false)}));const c=map(centroid2(faceVertices(rep,face)));group.append(svg("circle",{class:"octa-mini-dot",cx:c[0],cy:c[1],r:1.7}));art.append(group);}return art;
  }
  REPS.forEach((rep,index)=>{const b=document.createElement("button");b.type="button";b.className="octa-rep";b.dataset.rep=String(index);b.setAttribute("aria-pressed",String(index===0));b.append(buildMini(rep));const copy=document.createElement("span");copy.className="octa-rep-copy";copy.innerHTML=`<strong>${rep.roman}. ${rep.title}</strong><span>${rep.arms}</span>`;b.append(copy);b.addEventListener("click",()=>selectRep(index));repHost.append(b);});
  function objectRotation(){const z=rotationZ(-Math.PI/2);if(state.fold<.001)return z;return multiply(rotationY(state.yaw*state.fold),multiply(rotationX(state.pitch*state.fold),z));}
  function world(rep,face,p,T){return transform(T[face],[p[0],p[1],0]);}
  function render(){
    const rep=REPS[state.rep], T=transforms(rep,state.fold), centres=FACE_IDS.map(f=>world(rep,f,centroid2(faceVertices(rep,f)),T)), centre=centroid3(centres), R=objectRotation();
    const records=FACE_IDS.map(face=>{const v3=faceVertices(rep,face).map(p=>transform(R,sub3(world(rep,face,p,T),centre))),normal=cross3(sub3(v3[1],v3[0]),sub3(v3[2],v3[0]));return{face,v3,normal,depth:centroid3(v3)[2]};}).sort((a,b)=>a.depth-b.depth);
    const all3=records.flatMap(r=>r.v3), raw=all3.map(p=>{const q=1/(1-p[2]*.16);return[p[0]*q,-p[1]*q,q];}),xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys),scale=Math.min(790/Math.max(width,.1),520/Math.max(height,.1))*state.zoom,cx=450-(Math.min(...xs)+Math.max(...xs))*scale/2,cy=305-(Math.min(...ys)+Math.max(...ys))*scale/2,project=p=>{const q=1/(1-p[2]*.16);return[cx+p[0]*q*scale,cy-p[1]*q*scale,q];};
    stage.replaceChildren();
    for(const rec of records){const face=rec.face,tile=rep.tiles[face],g=svg("g",{"data-face":face}),tri=rec.v3.map(project),light=norm3([-.35,-.45,1]),illum=Math.max(0,dot3(norm3(rec.normal),light)),L=state.fold<.02?43:38+illum*12;g.append(svg("path",{class:"octa-face",d:projectedPath(tri,true),fill:`hsl(22 55% ${L.toFixed(1)}%)`}));
      if(state.graph){const cf=centroid2(faceVertices(rep,face)),c3=transform(R,sub3(world(rep,face,cf,T),centre)),c2=project(c3);for(let axis=0;axis<3;axis++)if(tileBit(tile,axis)){const m=sideMid(rep,face,axis),m3=transform(R,sub3(world(rep,face,m,T),centre)),m2=project(m3);g.append(svg("path",{class:"octa-graph-edge",d:`M ${c2[0]} ${c2[1]} L ${m2[0]} ${m2[1]}`}));}g.append(svg("circle",{class:"octa-graph-node",cx:c2[0],cy:c2[1],r:tile===0?5:3.8}));}
      for(const sub of curveSubpaths(rep,face,tile)){const points=sub.map(p=>project(transform(R,sub3(world(rep,face,p,T),centre))));g.append(svg("path",{class:"octa-curve",d:projectedPath(points,false)}));}
      const cf=centroid2(faceVertices(rep,face)),c3=transform(R,sub3(world(rep,face,cf,T),centre)),c2=project(c3);g.append(svg("circle",{class:"octa-dot",cx:c2[0],cy:c2[1],r:4.2*clamp(c2[2],.82,1.18)}));if(state.labels){const text=svg("text",{class:"octa-label",x:c2[0],y:c2[1]-12,"text-anchor":"middle"});text.textContent=tileWord(tile);g.append(text);}stage.append(g);
    }
    title.textContent=rep.title;badge.textContent=rep.arms;range.value=String(Math.round(state.fold*100));output.textContent=`${Math.round(state.fold*100)}%`;foldButton.textContent=state.fold>.5?"Unfold the net":"Fold the net";stage.setAttribute("aria-label",`${rep.title}, arm lengths ${rep.arms}, ${Math.round(state.fold*100)} percent folded.`);
  }
  function selectRep(index){state.rep=index;root.querySelectorAll(".octa-rep").forEach((b,i)=>{b.classList.toggle("is-active",i===index);b.setAttribute("aria-pressed",String(i===index));});state.fold=0;state.yaw=.72;state.pitch=-.48;state.zoom=1;render();live.textContent=`Selected ${REPS[index].title}.`;}
  function animateFold(target){cancelAnimationFrame(state.animation);const start=state.fold,begin=performance.now(),duration=matchMedia("(prefers-reduced-motion: reduce)").matches?1:650;const step=now=>{const t=clamp((now-begin)/duration,0,1),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;state.fold=start+(target-start)*e;render();if(t<1)state.animation=requestAnimationFrame(step);else live.textContent=target?"The net is folded into an octahedron.":"The octahedron is unfolded into a net.";};state.animation=requestAnimationFrame(step);}
  foldButton.addEventListener("click",()=>animateFold(state.fold>.5?0:1));range.addEventListener("input",()=>{cancelAnimationFrame(state.animation);state.fold=+range.value/100;render();});
  root.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>{const a=button.dataset.action;if(a==="rotate-left")state.yaw-=.24;if(a==="rotate-right")state.yaw+=.24;if(a==="zoom-out")state.zoom=clamp(state.zoom-.12,.65,1.7);if(a==="zoom-in")state.zoom=clamp(state.zoom+.12,.65,1.7);if(a==="labels"){state.labels=!state.labels;button.setAttribute("aria-pressed",String(state.labels));}if(a==="graph"){state.graph=!state.graph;button.setAttribute("aria-pressed",String(state.graph));}if(a==="reset"){state.yaw=.72;state.pitch=-.48;state.zoom=1;}render();}));
  stage.addEventListener("pointerdown",e=>{stage.setPointerCapture(e.pointerId);state.dragging=true;state.pointer=e.pointerId;state.lastX=e.clientX;state.lastY=e.clientY;stage.classList.add("is-dragging");});
  stage.addEventListener("pointermove",e=>{if(!state.dragging||e.pointerId!==state.pointer)return;const dx=e.clientX-state.lastX,dy=e.clientY-state.lastY;state.lastX=e.clientX;state.lastY=e.clientY;state.yaw+=dx*.009;state.pitch=clamp(state.pitch+dy*.009,-1.45,1.45);render();});
  const release=e=>{if(e.pointerId!==state.pointer)return;state.dragging=false;state.pointer=null;stage.classList.remove("is-dragging");};stage.addEventListener("pointerup",release);stage.addEventListener("pointercancel",release);
  stage.addEventListener("wheel",e=>{e.preventDefault();state.zoom=clamp(state.zoom*(e.deltaY>0?.92:1.08),.65,1.7);render();},{passive:false});
  stage.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")state.yaw-=.14;else if(e.key==="ArrowRight")state.yaw+=.14;else if(e.key==="ArrowUp")state.pitch-=.12;else if(e.key==="ArrowDown")state.pitch+=.12;else if(e.key==="+"||e.key==="=")state.zoom=clamp(state.zoom+.1,.65,1.7);else if(e.key==="-")state.zoom=clamp(state.zoom-.1,.65,1.7);else if(e.key===" "||e.key==="Enter"){e.preventDefault();animateFold(state.fold>.5?0:1);return;}else return;e.preventDefault();render();});
  selectRep(0);
})();
