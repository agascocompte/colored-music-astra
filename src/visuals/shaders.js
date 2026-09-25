export const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
export const fragment = `
precision highp float;
uniform vec2 resolution;
uniform float time, bass, mid, high, energy, impact, motion;
uniform float punch, snap, sparkle, beatAge, travel;
uniform float stardustWaveAge, stardustWaveStrength;
uniform int mode;
uniform sampler2D spectrum;
const float PI=3.14159265359;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float band(float x){return texture2D(spectrum,vec2(clamp(x,0.,1.),.5)).r;}
vec3 palette(float t){return .52+.48*cos(6.28318*(vec3(.08,.36,.57)+t));}
vec3 resonance(vec2 p){
  p*=rot(-.32);p.x*=.90;
  float r=length(p),a=atan(p.y,p.x),base=.51+bass*.08;
  vec3 col=vec3(.005,.012,.025);
  col+=vec3(.015,.08,.13)*exp(-abs(r-base)*7.);
  float spec=band(abs(a)/PI);
  for(int i=0;i<22;i++){
    float f=float(i),phase=f*.285;
    float wave=sin(a*3.+time*.32+phase)*(.035+mid*.035)+sin(a*7.-time*.24+phase*1.7)*(.008+spec*.025);
    float radius=base+sin(phase*1.7)*.052+wave;
    float d=abs(r-radius);
    float thread=.0024/(d+.0017);
    float shading=.25+.75*pow(.5+.5*sin(a+phase*.22+time*.05),2.);
    vec3 color=mix(vec3(.15,.77,1.),vec3(1.,.31,.09),smoothstep(-.2,.5,sin(a+phase*.10)));
    col+=color*thread*shading*(.45+spec*.55);
  }
  float tendril=sin(a*108.+sin(a*7.+time*.2)*6.+r*53.);
  col+=mix(vec3(.07,.65,.9),vec3(1.,.34,.13),smoothstep(-.1,.4,sin(a)))*pow(max(0.,tendril),24.)*exp(-abs(r-base)*25.)*.4;
  float pulse=abs(r-(base+.45*(1.-impact)));
  col+=vec3(.14,.42,.45)*exp(-pulse*55.)*impact*.5*motion;
  col+=vec3(.01,.055,.09)*exp(-r*3.);
  return col;
}
vec3 flow(vec2 p){
  p*=1.7;float t=time*.17;
  vec2 q=vec2(noise(p+t),noise(p+vec2(4.7,1.3)-t));
  vec2 r=vec2(noise(p+3.*q+vec2(1.7,9.2)+t),noise(p+3.*q+vec2(8.3,2.8)-t*.7));
  float f=noise(p+3.7*r+mid*.6);
  float ribbon=sin((f+p.x*.12)*17.+bass*2.);
  vec3 c=mix(vec3(.012,.045,.075),vec3(.04,.55,.5),smoothstep(.15,.72,f));
  c=mix(c,vec3(.55,.2,.65),smoothstep(.45,.85,r.x));
  c=mix(c,vec3(.96,.45,.19),smoothstep(.5,.9,q.y)*smoothstep(-.4,.8,p.x));
  c+=vec3(.55,.89,.71)*pow(max(0.,ribbon),28.)*(.1+high*.35);
  c*=.25+f*1.2;return c*(1.+impact*.18*motion);
}
vec3 terrain(vec2 p){
  p*=1.-punch*.07*motion;
  vec3 c=vec3(.015,.008,.045);float horizon=.08;
  float glow=exp(-abs(p.y-horizon)*8.);c+=vec3(.21,.04,.25)*glow;
  vec2 sun=p-vec2(0.,.18);float sr=length(sun);
  if(sr<.24+punch*.035 && p.y>horizon){float stripes=step(.19,fract(p.y*65.));c+=mix(vec3(1.,.17,.34),vec3(1.,.57,.22),clamp(p.y*2.,0.,1.))*stripes*(.65+snap*.55);}
  if(p.y<horizon){
    float z=1./max(.035,horizon-p.y),x=p.x*z;
    float roadTravel=travel*1.6;
    float road=1.-smoothstep(.9,1.6,abs(x));
    float mountains=band(clamp(abs(x)*.055,0.,1.))*.8;
    float terrainY=z+sin(x*1.3+roadTravel*.14)*(1.-road)*(1.+mountains*5.);
    vec2 grid=abs(fract(vec2(x*.9,terrainY*.5-roadTravel))-.5);
    float lines=max(1.-smoothstep(.015,.045,grid.x),1.-smoothstep(.015,.045,grid.y));
    c+=mix(vec3(.62,.08,.62),vec3(.03,.6,.75),road)*lines/(1.+z*.075)*(.6+bass*.8+punch*2.5*motion);
    c+=mix(vec3(.55,.16,.43),vec3(.5,1.,1.),punch)*exp(-abs(abs(x)-1.5)*18.)/(1.+z*.04)*(1.+punch*2.);
    float front=24./(1.+beatAge*24.);
    float sweep=exp(-abs(z-front)*2.5)*exp(-beatAge*2.2);
    c+=vec3(.2,1.,.9)*sweep*(.3+road)*motion;
    c+=vec3(.6,.25,1.)*snap*lines*(1.-road)*motion;
  }
  for(int i=0;i<45;i++){
    float x=(float(i)/44.-.5)*3.5;
    float h=.04+pow(band(float(i)/44.),1.6)*.44;
    float line=exp(-abs(p.x-x)*170.)*step(horizon,p.y)*step(p.y,horizon+h);
    c+=mix(vec3(.1,.35,.6),vec3(.6,1.,.8),sparkle)*line*(.8+snap);
  }
  c+=vec3(.22,.045,.12)*punch*glow*1.8*motion;return c;
}
vec3 kaleido(vec2 p){
  float r=length(p),a=atan(p.y,p.x)+time*.055;
  vec3 c=vec3(.013,.005,.022);
  for(int i=0;i<11;i++){
    float f=float(i),radius=.12+f*.06+bass*.035;
    float theta=a+f*.105+sin(time*.1)*.12;
    float folded=mod(theta+PI/6.,PI/3.)-PI/6.;
    float hex=r*cos(folded);
    float d=abs(hex-radius);
    float petals=abs(r-radius*(1.+.19*cos(a*6.+f*.3+mid*1.4)));
    vec3 color=mix(vec3(1.,.35,.24),vec3(.5,.19,1.),f/11.);
    color=mix(color,vec3(.23,.84,.78),pow(.5+.5*sin(f*.6),6.));
    float edges=.0018/(d+.0025)+.001/(petals+.003);
    c+=color*edges*(.45+band(f/11.)*.8);
    c+=color*exp(-d*55.)*.035;
  }
  c+=vec3(.3,.09,.15)*exp(-r*9.)*(1.+impact*motion);
  return c;
}
vec3 stars(vec2 p){
  p*=1.-punch*.16*motion;
  vec3 c=vec3(.003,.008,.021);float r=length(p),a=atan(p.y,p.x);
  float clouds=noise(p*3.+vec2(time*.025,0.))*noise(p*6.-time*.015);
  c+=mix(vec3(.10,.025,.25),vec3(.025,.16,.23),noise(p*2.))*clouds*exp(-r*.7)*1.5;
  c+=vec3(.055,.035,.17)*exp(-r*1.7);
  for(int i=0;i<64;i++){
    float f=float(i);float z=fract(f/64.-travel*.022);
    float angle=f*2.39996;
    vec2 center=vec2(cos(angle),sin(angle))*(.12+hash(vec2(f,7.))*.6)/max(z,.03);
    vec2 delta=p-center;
    float d=length(delta*rot(-angle));
    vec3 color=mix(vec3(.22,.58,1.),vec3(1.,.63,.35),hash(vec2(f,3.)));
    float size=.0038/max(z,.07);
    c+=color*size*size/(d*d+.00004)*(.65+high*1.7+sparkle*1.1)*(1.-z);
    vec2 trail=delta*rot(angle);trail.x*=mix(.20,.025,clamp(impact*motion+energy*.25,0.,1.));
    c+=color*.00006/(dot(trail,trail)+.00009)*(1.-z)*(.08+energy*.4+impact*.8*motion);
  }
  vec2 cell=vec2(a*95.,log(max(r,.01))*21.-travel*1.2);
  vec2 id=floor(cell);vec2 gv=fract(cell)-.5;
  gv.y*=1.-impact*.7*motion;
  float star=pow(max(0.,1.-length(gv)*2.),8.)*step(.67,hash(id));
  c+=mix(vec3(.35,.65,1.),vec3(1.,.6,.35),hash(id+4.))*star*(1.2+high*2.+sparkle*2.)*smoothstep(.08,.5,r);
  float wave=abs(r-stardustWaveAge*2.6-.05);
  c+=vec3(.15,.8,1.)*exp(-wave*40.)*exp(-stardustWaveAge*3.)*.75*stardustWaveStrength*motion;
  c+=vec3(.04,.16,.25)*punch*exp(-r*.8)*motion;
  c+=vec3(.34,.55,.7)*.003/(r*r+.007);return c;
}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(gl_FragCoord.xy-.5*resolution)/resolution.y*2.;
  vec3 color;
  if(mode==0)color=resonance(p);else if(mode==1)color=flow(p);else if(mode==2)color=terrain(p);else if(mode==3)color=kaleido(p);else color=stars(p);
  float vignette=1.-.45*pow(length(uv-.5)*1.3,1.5);
  color*=vignette;
  color+= (hash(gl_FragCoord.xy)-.5)*.009;
  color=1.-exp(-color*1.35);
  gl_FragColor=vec4(pow(max(color,vec3(0)),vec3(.92)),1.);
}`;
