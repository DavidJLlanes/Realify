/* ══════════════════════════════════════════════════════════════
   SHADERS DEL FILTRO CÁMARA
   Migrados sin cambios desde la versión de un solo archivo. El orden
   de las etapas es el recorrido físico de la luz y mover una cambia
   el resultado: el grano añadido antes del mosaico se demosaica con
   la imagen y sale correlacionado entre canales, como en una cámara;
   después, sale independiente por canal, y eso se mide.
   ══════════════════════════════════════════════════════════════ */


export const VS = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

export const PRE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform sampler2D uTex2;
uniform vec2 uRes;
uniform float uSeed;
/* Semilla de la CÁMARA: identifica el sensor simulado y se mantiene
   igual en todas las imágenes de un lote. Distinta de uSeed, que es
   la del disparo concreto. */
uniform float uCamSeed;
in vec2 vUV;
out vec4 fragColor;
const vec3 LUM = vec3(0.2126,0.7152,0.0722);
float hash13(vec3 p){
  p = fract(p*0.1031);
  p += dot(p, p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float gaussN(vec2 uv, float s){
  float u1 = max(hash13(vec3(uv,s)), 1e-6);
  float u2 = hash13(vec3(uv.yx+11.7, s+3.13));
  return sqrt(-2.0*log(u1))*cos(6.2831853*u2);
}
`;

export const SH = {};

/* Lanczos-2 con soporte ensanchado al reducir (antialias).
   La reducción se limita a 2:1; 8 muestras por eje cubren el soporte.
   texelFetch impide interpolar dos veces cada muestra. */
SH.resample = PRE + `
float lanczos(float x){
  x = abs(x);
  if(x < 0.0001) return 1.0;
  if(x >= 2.0) return 0.0;
  float p = 3.14159265*x;
  return sin(p)*sin(p*0.5)/(p*p*0.5);
}
void main(){
  ivec2 size = textureSize(uTex, 0);
  vec2 pos = vUV*vec2(size)-0.5;
  vec2 scale = max(vec2(size)/uRes, vec2(1.0));
  ivec2 base = ivec2(floor(pos));
  vec3 sum = vec3(0.0); float weights = 0.0;
  for(int y=-3; y<=4; y++){
    for(int x=-3; x<=4; x++){
      ivec2 at = base + ivec2(x,y);
      vec2 delta = (vec2(at)-pos)/scale;
      float w = lanczos(delta.x)*lanczos(delta.y);
      sum += texelFetch(uTex, clamp(at, ivec2(0), size-1), 0).rgb*w;
      weights += w;
    }
  }
  fragColor = vec4(clamp(sum/max(weights,0.0001),0.0,1.0),1.0);
}`;
SH.resampleMix = PRE + `
uniform float uMix;
void main(){ fragColor = vec4(mix(texture(uTex,vUV).rgb,
  texture(uTex2,vUV).rgb,uMix),1.0); }`;

/* Transformada à trous: núcleo B3 [1,4,6,4,1]/16 separable,
   sin decimación; dilatación 1 y después 2. c0=c2+(c1-c2)+(c0-c1). */
SH.waveletBlur = PRE + `
uniform vec2 uDir;
uniform float uStride;
void main(){
  vec2 d = uDir*uStride/uRes;
  vec3 c = texture(uTex,vUV).rgb*6.0;
  c += (texture(uTex,vUV-d).rgb+texture(uTex,vUV+d).rgb)*4.0;
  c += texture(uTex,vUV-2.0*d).rgb+texture(uTex,vUV+2.0*d).rgb;
  fragColor = vec4(c/16.0,1.0);
}`;
SH.waveletShrink = PRE + `
uniform sampler2D uTex3;
uniform float uFine;
uniform float uCoarse;
uniform float uEdge;
vec3 shrink(vec3 d, float t){ return sign(d)*max(abs(d)-t,vec3(0.0)); }
void main(){
  vec3 c0=texture(uTex,vUV).rgb, c1=texture(uTex2,vUV).rgb;
  vec3 c2=texture(uTex3,vUV).rgb;
  vec3 d1=c0-c1, d2=c1-c2;
  float edge = smoothstep(0.015,0.12,length(d1)+length(d2));
  float protect = 1.0-uEdge*edge;
  vec3 result = c2+shrink(d1,uFine*protect)+shrink(d2,uCoarse*protect);
  fragColor=vec4(clamp(result,0.0,1.0),1.0);
}`;

/* Filtro peine (comb/notch) contra el patrón de tablero de ajedrez
   que deja un upsampling por convolución traspuesta o vecino-más-
   cercano: una periodicidad EXACTA cada N píxeles, no ruido difuso.
   El laplaciano de un vecino a distancia N (4·c menos sus 4 vecinos,
   mirado a un paso fijo en vez de al inmediato) da
   máxima respuesta justo cuando el valor alterna con ese período
   exacto, que es la firma de una deconvolución de paso 2 sin mezclar
   bien sus salidas. Se mide a dos distancias —2 y 4 texels— porque un
   modelo con varios saltos de escalado en cascada deja el mismo
   patrón repetido a cada una de esas escalas. Un contorno real del
   sujeto también da respuesta alta en el peine; `uEdge` lo protege
   igual que `waveletShrink` protege los suyos. */
SH.upsamp = PRE + `
uniform float uAmt;
uniform float uAmt2;
uniform float uEdge;
vec3 comb(vec2 uv, vec2 d){
  vec3 c = texture(uTex,uv).rgb;
  vec3 n = texture(uTex,uv+vec2(d.x,0.0)).rgb + texture(uTex,uv-vec2(d.x,0.0)).rgb
         + texture(uTex,uv+vec2(0.0,d.y)).rgb + texture(uTex,uv-vec2(0.0,d.y)).rgb;
  return c*4.0-n;
}
void main(){
  vec3 c = texture(uTex,vUV).rgb;
  vec3 comb1 = comb(vUV, 2.0/uRes);
  vec3 comb2 = comb(vUV, 4.0/uRes);
  float edge = smoothstep(0.06,0.30,length(comb1)+length(comb2));
  float protect = 1.0-uEdge*edge;
  vec3 result = c - comb1*uAmt*protect - comb2*uAmt2*protect;
  fragColor = vec4(clamp(result,0.0,1.0),1.0);
}`;

/* Distribución de energía espectral: filtro Gaussiano separable que
   atenúa altas frecuencias, simulando cómo diferentes cámaras reales
   tienen respuestas espectrales distintas. Las antiguas/móviles tienen
   antialiasing agresivo (pasa-bajos fuerte); las high-res modernas
   preservan más detalle fino. Se implementa como dos pasadas: una
   horizontal (este shader) y otra vertical (spectralV). El radio lo
   controla el perfil de cámara elegido o se ajusta manualmente.
   Núcleo Gaussiano de 5 muestras, normalizado a 1. */
SH.spectralH = PRE + `
uniform float uRadius;
void main(){
  vec2 d = vec2(uRadius/uRes.x, 0.0);
  // Pesos normalizados a 1. Los de antes sumaban 1,18 por pasada, y
  // con dos pasadas la etapa aclaraba toda la imagen un 39 % en luz
  // lineal —un gris medio salía como 149 en vez de 128— sin que
  // ningún mando lo explicara.
  vec3 c = texture(uTex,vUV).rgb * 0.3547;
  c += (texture(uTex,vUV-d).rgb + texture(uTex,vUV+d).rgb) * 0.2631;
  c += (texture(uTex,vUV-2.0*d).rgb + texture(uTex,vUV+2.0*d).rgb) * 0.0595;
  fragColor = vec4(c, 1.0);
}`;

SH.spectralV = PRE + `
uniform float uRadius;
void main(){
  vec2 d = vec2(0.0, uRadius/uRes.y);
  // Pesos normalizados a 1. Los de antes sumaban 1,18 por pasada, y
  // con dos pasadas la etapa aclaraba toda la imagen un 39 % en luz
  // lineal —un gris medio salía como 149 en vez de 128— sin que
  // ningún mando lo explicara.
  vec3 c = texture(uTex,vUV).rgb * 0.3547;
  c += (texture(uTex,vUV-d).rgb + texture(uTex,vUV+d).rgb) * 0.2631;
  c += (texture(uTex,vUV-2.0*d).rgb + texture(uTex,vUV+2.0*d).rgb) * 0.0595;
  fragColor = vec4(c, 1.0);
}`;

/* sRGB → lineal. Todo el bloque de sensor trabaja en luz lineal,
   que es donde el ruido de disparo tiene sentido físico. */
SH.input = PRE + `
vec3 s2l(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(vec3(0.04045),c)); }
void main(){ fragColor = vec4(s2l(texture(uTex,vUV).rgb),1.0); }`;

/* Distorsión radial del objetivo. Positivo = barril (zoom en gran
   angular), negativo = cojín (en el extremo tele). Ningún generador
   la produce: sus líneas rectas salen rectas. Además desplaza cada
   píxel una cantidad que depende del radio, lo que por sí solo ya
   rompe la rejilla del modelo. */
SH.distort = PRE + `
uniform float uK1;
uniform float uK2;
uniform float uZoom;
void main(){
  float asp = uRes.x/uRes.y;
  vec2 c = (vUV - 0.5) * vec2(asp, 1.0);
  float hd = 0.5*length(vec2(asp, 1.0));
  float r = length(c)/hd;
  float r2 = r*r;
  float f = 1.0 + uK1*r2 + uK2*r2*r2;
  vec2 p = c * f / uZoom;
  vec2 uv = p / vec2(asp, 1.0) + 0.5;
  fragColor = vec4(texture(uTex, uv).rgb, 1.0);
}`;

/* Profundidad de campo con iris circular. El desenfoque crece con la
   distancia al punto de foco (radio de nitidez), y las muestras se
   toman en un disco con distribución uniforme —raíz cuadrada del
   parámetro radial, ángulo áureo entre muestras— para que la forma
   del bokeh sea un círculo relleno y no un anillo ni un cuadrado.
   Las altas luces se ponderan más que el resto: así es como una
   fuente puntual fuera de foco se abre en un disco brillante en vez
   de simplemente perder definición, que es lo que hace un desenfoque
   gaussiano corriente. */
SH.dof = PRE + `
uniform float uAmt;
uniform vec2  uFocus;
uniform float uRadius;
uniform float uBokeh;
const int N = 24;
const float GOLDEN = 2.3999632297;
void main(){
  vec2 asp = vec2(uRes.x/uRes.y, 1.0);
  vec2 c  = (vUV - 0.5) * asp;
  vec2 fc = (uFocus - 0.5) * asp;
  float d = length(c - fc);
  float coc = clamp((d - uRadius) * uAmt, 0.0, 1.0);
  vec3 base = texture(uTex, vUV).rgb;
  if(coc <= 0.002){ fragColor = vec4(base, 1.0); return; }

  float ang0 = hash13(vec3(vUV*uRes, uSeed+61.0)) * 6.2831853;
  float maxR = coc * 0.05;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for(int i = 0; i < N; i++){
    float t   = (float(i) + 0.5) / float(N);
    float ang = ang0 + float(i) * GOLDEN;
    float rad = sqrt(t) * maxR;
    vec2 o = vec2(cos(ang), sin(ang)) * rad / asp;
    vec3 s = texture(uTex, vUV + o).rgb;
    float l = dot(s, LUM);
    float w = 1.0 + pow(max(l - 0.55, 0.0), 2.0) * uBokeh * 8.0;
    acc += s * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-4), 1.0);
}`;

/* Trepidación de cámara: acumula muestras alrededor del píxel, en una
   de tres formas.
   - Lineal: dirección y distancia constantes en toda la imagen, la
     cámara desplazándose durante la exposición.
   - Zoom radial: cada muestra se acerca o se aleja del centro
     declarado, el arrastre de accionar el zoom durante el disparo.
   - Trepidación de pulso: microsacudidas en direcciones casi al azar
     en vez de un único eje, el temblor de una mano sin apoyo.
   El obturador progresivo (rolling shutter) se suma aparte, como un
   cizallamiento horizontal proporcional a la altura de la fila: cada
   fila se lee un instante distinto del sensor, así que se desplaza un
   poco más que la de encima, sea cual sea el modo de arrastre activo. */
SH.motion = PRE + `
uniform float uAmt;
uniform float uAngle;
uniform float uMode;
uniform vec2  uZoomC;
uniform float uRolling;
const int N = 20;
void main(){
  vec2 base = vUV + vec2(uRolling * (vUV.y - 0.5), 0.0);
  vec3 acc = vec3(0.0);

  if(uMode < 0.5){
    vec2 dir = vec2(cos(uAngle), sin(uAngle)) / uRes;
    for(int i = 0; i < N; i++){
      float t = (float(i)/float(N-1) - 0.5) * uAmt;
      acc += texture(uTex, base + dir*t).rgb;
    }
  } else if(uMode < 1.5){
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);
    vec2 c = (base - uZoomC) * asp;
    for(int i = 0; i < N; i++){
      float t = (float(i)/float(N-1) - 0.5) * uAmt * 0.02;
      vec2 uv = uZoomC + (c * (1.0 + t)) / asp;
      acc += texture(uTex, uv).rgb;
    }
  } else {
    for(int i = 0; i < N; i++){
      float a = hash13(vec3(float(i)*7.13, uSeed, 17.0)) * 6.2831853;
      float r = hash13(vec3(float(i)*3.71, uSeed, 41.0)) * uAmt / uRes.x;
      acc += texture(uTex, base + vec2(cos(a),sin(a))*r).rgb;
    }
  }
  fragColor = vec4(acc/float(N), 1.0);
}`;

/* Polvo del sensor: motas fijas por celda de una rejilla, cada una
   con su propia posición, tamaño y opacidad salidos de un hash de la
   celda —no del píxel—, así que la mancha entera se mueve como un
   bloque y no como ruido. Se revisan las ocho celdas vecinas además
   de la propia para que una mota no se corte en el borde de su
   celda. El oscurecimiento es multiplicativo y se acumula si dos
   motas se solapan, como capas reales de suciedad. */
SH.dust = PRE + `
uniform float uAmt;
uniform float uSize;
uniform float uSoft;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  vec2 asp = vec2(uRes.x/uRes.y, 1.0);
  vec2 p = vUV * asp;
  float grid = 4.0 + uSize * 8.0;
  vec2 cellUV = p * grid;
  vec2 cellId = floor(cellUV);

  float shade = 1.0;
  for(int j = -1; j <= 1; j++){
    for(int i = -1; i <= 1; i++){
      vec2 nid = cellId + vec2(float(i), float(j));
      float h = hash13(vec3(nid, uSeed+81.0));
      if(h > uAmt * 0.9) continue;
      float hx = hash13(vec3(nid, uSeed+82.0));
      float hy = hash13(vec3(nid, uSeed+83.0));
      float hr = hash13(vec3(nid, uSeed+84.0));
      vec2 center = nid + vec2(hx, hy);
      float r = 0.16 + hr * 0.34;
      float dd = length(cellUV - center) / r;
      float edge = mix(0.15, 1.2, uSoft);
      float mask = 1.0 - smoothstep(1.0 - edge, 1.0, dd);
      float darken = mask * mix(0.65, 0.20, hr);
      shade *= 1.0 - darken;
    }
  }
  fragColor = vec4(c * shade, 1.0);
}`;

/* Aberración cromática lateral: el objetivo enfoca cada longitud de
   onda a un aumento ligeramente distinto, así que rojo y azul salen
   a escalas diferentes, y la separación crece con el cuadrado del
   radio. Es radial y centrada, no un desplazamiento uniforme, y esa
   geometría es muy difícil de falsificar por accidente.
   El fringing púrpura es otro fenómeno: aparece en los bordes de
   alto contraste de las zonas claras, por aberración esférica del
   canal azul. */
SH.ca = PRE + `
uniform float uLat;
uniform float uFringe;
void main(){
  float asp = uRes.x/uRes.y;
  vec2 c = vUV - 0.5;
  vec2 ca = c * vec2(asp, 1.0);
  float hd = 0.5*length(vec2(asp, 1.0));
  float r2 = dot(ca,ca)/(hd*hd);

  float sR = 1.0 + uLat*r2;
  float sB = 1.0 - uLat*r2;
  vec3 mid = texture(uTex, vUV).rgb;
  vec3 col = vec3(texture(uTex, c*sR + 0.5).r,
                  mid.g,
                  texture(uTex, c*sB + 0.5).b);

  vec2 t = 1.0/uRes;
  float lx = dot(texture(uTex,vUV+vec2(t.x,0.0)).rgb,LUM)
           - dot(texture(uTex,vUV-vec2(t.x,0.0)).rgb,LUM);
  float ly = dot(texture(uTex,vUV+vec2(0.0,t.y)).rgb,LUM)
           - dot(texture(uTex,vUV-vec2(0.0,t.y)).rgb,LUM);
  float grad = clamp(length(vec2(lx,ly))*3.2, 0.0, 1.0);
  float lum  = dot(col, LUM);
  float w = grad * smoothstep(0.30, 0.85, lum) * uFringe;
  col = mix(col, vec3(col.r*1.10, col.g*0.90, col.b*1.16), w);

  fragColor = vec4(col, 1.0);
}`;

/* Curvatura de campo y astigmatismo: ningún objetivo resuelve igual
   en el centro que en la esquina, y en la esquina el desenfoque no
   es simétrico sino alargado en la dirección radial o en la
   perpendicular. Una imagen generada es igual de nítida de lado a
   lado, y eso es un delator inmediato al 100 %. */
SH.soft = PRE + `
uniform float uAmt;
uniform float uStart;
uniform float uAstig;
void main(){
  float asp = uRes.x/uRes.y;
  vec2 c = (vUV - 0.5) * vec2(asp, 1.0);
  float hd = 0.5*length(vec2(asp, 1.0));
  float r  = length(c)/hd;
  float w  = smoothstep(uStart, 1.0, r) * uAmt;
  if(w <= 0.001){ fragColor = vec4(texture(uTex,vUV).rgb,1.0); return; }

  // Eje radial y su perpendicular: el kernel se estira en uno de los
  // dos según el signo del astigmatismo.
  vec2 rad = r > 1e-5 ? normalize(c) : vec2(1.0,0.0);
  vec2 tan_ = vec2(-rad.y, rad.x);
  float kr = 1.0 + max(uAstig, 0.0)*2.2;
  float kt = 1.0 + max(-uAstig, 0.0)*2.2;
  vec2 sr = rad/uRes * (1.0 + w*5.0) * kr;
  vec2 st = tan_/uRes * (1.0 + w*5.0) * kt;

  /* Gaussiana de 13 muestras con σ=1, normalizada a la unidad:
     0.1839 + 4(0.1115) + 4(0.0676) + 4(0.0249) = 1.0000
     Que sume exactamente 1 no es cosmético: cualquier exceso
     aclara las esquinas en vez de sólo emborronarlas, y encima
     tiraría contra el viñeteo, que es la etapa siguiente. */
  vec3 base = texture(uTex, vUV).rgb;
  vec3 s = base*0.1839;
  s += (texture(uTex,vUV+sr).rgb + texture(uTex,vUV-sr).rgb)*0.1115;
  s += (texture(uTex,vUV+st).rgb + texture(uTex,vUV-st).rgb)*0.1115;
  s += (texture(uTex,vUV+sr*2.0).rgb + texture(uTex,vUV-sr*2.0).rgb)*0.0249;
  s += (texture(uTex,vUV+st*2.0).rgb + texture(uTex,vUV-st*2.0).rgb)*0.0249;
  s += (texture(uTex,vUV+sr+st).rgb + texture(uTex,vUV-sr-st).rgb)*0.0676;
  s += (texture(uTex,vUV+sr-st).rgb + texture(uTex,vUV-sr+st).rgb)*0.0676;

  fragColor = vec4(mix(base, s, clamp(w*1.7, 0.0, 1.0)), 1.0);
}`;

SH.vignette = PRE + `
uniform float uAmount;
uniform float uExt;
uniform float uDesat;
void main(){
  vec3 c = texture(uTex,vUV).rgb;
  vec2 d = (vUV - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  float r = length(d)/0.7071;
  // Ley del coseno a la cuarta: la caída real de un objetivo.
  float f = pow(cos(atan(r*uExt)), 4.0);
  f = mix(1.0, f, uAmount);
  c *= f;
  // El viñeteo óptico también desatura hacia las esquinas.
  float l = dot(c, LUM);
  c = mix(c, vec3(l), (1.0-f)*uDesat);
  fragColor = vec4(c,1.0);
}`;

SH.addup = PRE + `
uniform float uW;
void main(){
  fragColor = vec4(texture(uTex,vUV).rgb + texture(uTex2,vUV).rgb*uW, 1.0);
}`;

SH.bright = PRE + `
uniform float uThresh;
void main(){
  vec3 c = texture(uTex,vUV).rgb;
  float l = dot(c,LUM);
  float w = max(l-uThresh,0.0)/max(1.0-uThresh,0.001);
  fragColor = vec4(c*w,1.0);
}`;

SH.blur = PRE + `
uniform vec2 uDir;
uniform float uRadius;
void main(){
  vec2 st = uDir/uRes*uRadius;
  vec3 s  = texture(uTex,vUV).rgb*0.2270270270;
  s += (texture(uTex,vUV+st*1.3846153846).rgb + texture(uTex,vUV-st*1.3846153846).rgb)*0.3162162162;
  s += (texture(uTex,vUV+st*3.2307692308).rgb + texture(uTex,vUV-st*3.2307692308).rgb)*0.0702702703;
  fragColor = vec4(s,1.0);
}`;

SH.halate = PRE + `
uniform float uStrength;
uniform float uTint;
void main(){
  vec3 base = texture(uTex,vUV).rgb;
  vec3 h    = texture(uTex2,vUV).rgb;
  vec3 tint = vec3(1.0, mix(1.0,0.26,uTint), mix(1.0,0.10,uTint));
  fragColor = vec4(base + h*tint*uStrength, 1.0);
}`;

/* Multiplica por un escalar. Primitiva mínima para pesar una etapa de
   una pirámide antes de sumarla a otra, sin tener que colar ese peso
   dentro de un shader que ya hace otra cosa. */
SH.scale = PRE + `
uniform float uW;
void main(){ fragColor = vec4(texture(uTex,vUV).rgb * uW, 1.0); }`;

/* Fantasmas de objetivo: cada superficie de cristal del objetivo
   refleja hacia atrás una fracción mínima de la luz muy intensa, y esos
   rebotes internos salen alineados con el centro óptico —el eje de la
   lente—, repetidos a los dos lados a distancias crecientes y con un
   tinte ligeramente distinto en cada uno según cuántas superficies ha
   cruzado. Ninguna imagen generada tiene cristal físico detrás por el
   que rebote nada, así que esta geometría exacta —alineada con el
   centro del encuadre, no con el punto brillante— no aparece nunca por
   accidente en un render. */
SH.flareGhosts = PRE + `
uniform float uGhosts;
vec3 samp(vec2 uv){ return texture(uTex, clamp(uv,0.0,1.0)).rgb; }
void main(){
  vec2 toCenter = vec2(0.5) - vUV;
  vec3 acc = vec3(0.0);
  const int NG = 6;
  for(int i = 0; i < NG; i++){
    float t = -0.35 - float(i) * 0.5;
    vec2 gpos = vUV + toCenter * t;
    vec3 g = samp(gpos)*0.5 + samp(gpos+vec2(0.006,0.0))*0.25 + samp(gpos-vec2(0.006,0.0))*0.25;
    vec3 tint = vec3(1.0 + float(i)*0.025, 1.0 - float(i)*0.01, max(1.0 - float(i)*0.05, 0.6));
    acc += g * tint * (1.5 / float(i*i+2));
  }
  fragColor = vec4(acc * uGhosts, 1.0);
}`;

SH.flareComposite = PRE + `
uniform float uTint;
void main(){
  vec3 base = texture(uTex, vUV).rgb;
  vec3 glow = texture(uTex2, vUV).rgb;
  vec3 tint = vec3(1.0, mix(1.0,0.90,uTint), mix(1.0,0.72,uTint));
  fragColor = vec4(base + glow*tint, 1.0);
}`;

/* Microrrelieve de superficie: un campo de altura fractal —la fibra
   del papel, el grano de una copia física— iluminado a rasante. Lo que
   lo hace visible no es una textura pintada encima, sino que la luz le
   llega casi de refilón; por eso gira de verdad con el ángulo de luz
   que se le dé, algo que ninguna textura 2D superpuesta puede imitar. */
SH.relief = PRE + `
uniform float uAmt;
uniform float uScale;
uniform float uAngle;
float vnR(vec2 p, float s){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(vec3(i,s));
  float b = hash13(vec3(i+vec2(1.0,0.0),s));
  float c = hash13(vec3(i+vec2(0.0,1.0),s));
  float d = hash13(vec3(i+vec2(1.0,1.0),s));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float heightR(vec2 p){
  return vnR(p*1.0, uSeed+201.0)*0.55
       + vnR(p*2.3, uSeed+202.0)*0.30
       + vnR(p*4.7, uSeed+203.0)*0.15;
}
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  vec2 px = vUV * uRes / uScale;
  float e = 1.0;
  float hL = heightR(px - vec2(e,0.0));
  float hR = heightR(px + vec2(e,0.0));
  float hD = heightR(px - vec2(0.0,e));
  float hU = heightR(px + vec2(0.0,e));
  vec2 grad = vec2(hR-hL, hU-hD);

  vec2 L = vec2(cos(uAngle), sin(uAngle));
  float shade = dot(grad, L);
  c *= 1.0 + shade * uAmt;
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/* Muestreo por CFA RGGB + demosaico bilineal.
   El bilineal es "malo" a propósito: sus artefactos son
   exactamente los que produce una cámara real. */
SH.bayer = PRE + `
uniform float uAmount;
uniform vec2  uPhase;
/* Las cuatro fases posibles del patrón RGGB. Fijarla siempre en la
   misma sería una constante entre todas tus exportaciones. */
int cfaIdx(ivec2 p){
  int x = (p.x + int(uPhase.x)) & 1;
  int y = (p.y + int(uPhase.y)) & 1;
  if(y==0) return x==0 ? 0 : 1;
  return x==0 ? 1 : 2;
}
float cfaVal(ivec2 p){
  p = clamp(p, ivec2(0), ivec2(uRes)-ivec2(1));
  vec3 c = texelFetch(uTex,p,0).rgb;
  int i = cfaIdx(p);
  return i==0 ? c.r : (i==1 ? c.g : c.b);
}
void main(){
  ivec2 p = ivec2(vUV*uRes);
  int i = cfaIdx(p);
  float C  = cfaVal(p);
  float L  = cfaVal(p+ivec2(-1, 0));
  float R  = cfaVal(p+ivec2( 1, 0));
  float U  = cfaVal(p+ivec2( 0,-1));
  float D  = cfaVal(p+ivec2( 0, 1));
  float UL = cfaVal(p+ivec2(-1,-1));
  float UR = cfaVal(p+ivec2( 1,-1));
  float DL = cfaVal(p+ivec2(-1, 1));
  float DR = cfaVal(p+ivec2( 1, 1));
  vec3 o;
  if(i==0){
    o = vec3(C, (L+R+U+D)*0.25, (UL+UR+DL+DR)*0.25);
  } else if(i==2){
    o = vec3((UL+UR+DL+DR)*0.25, (L+R+U+D)*0.25, C);
  } else {
    int y = p.y - (p.y/2)*2;
    if(y==0) o = vec3((L+R)*0.5, C, (U+D)*0.5);
    else     o = vec3((U+D)*0.5, C, (L+R)*0.5);
  }
  fragColor = vec4(mix(texture(uTex,vUV).rgb, o, uAmount),1.0);
}`;

/* Firma residual del CFA: no el error de reconstrucción de arriba,
   sino la periodicidad de rejilla 2×2 que un demosaico real deja
   detrás incluso cuando reconstruye bien. Cada una de las cuatro
   posiciones RGGB (R, G-fila-par, G-fila-impar, B) recibe su propia
   ganancia fija, distinta por canal, y consistente en toda la
   imagen -- exactamente la correlación periódica que la estimación
   forense de CFA busca (Popescu & Farid) para confirmar que una foto
   vino de un sensor con array de filtro de color detrás. Atada a
   `uCamSeed`: es la posición física del filtro sobre el sensor, así
   que no cambia entre disparos de la misma cámara. */
SH.cfa = PRE + `
uniform float uAmt;
uniform float uColor;
void main(){
  ivec2 p = ivec2(vUV*uRes);
  int idx = (p.y & 1)*2 + (p.x & 1);
  float fi = float(idx);
  vec3 c = texture(uTex,vUV).rgb;
  float luma = hash13(vec3(fi, 0.0, uCamSeed+801.0))*2.0-1.0;
  vec3 chroma = vec3(
    hash13(vec3(fi, 1.0, uCamSeed+802.0))*2.0-1.0,
    hash13(vec3(fi, 2.0, uCamSeed+803.0))*2.0-1.0,
    hash13(vec3(fi, 3.0, uCamSeed+804.0))*2.0-1.0
  );
  vec3 gain = vec3(luma) * (1.0-uColor) + chroma * uColor;
  c *= max(vec3(0.0), vec3(1.0) + gain*uAmt);
  fragColor = vec4(clamp(c,0.0,1.0),1.0);
}`;

/* PRNU: ganancia fija por fotodiodo, distinta de todo el ruido
   aleatorio que añade SH.sensor más abajo. Dos rasgos la definen:
   1) Atada a `uCamSeed`, no a `uSeed` — la firma del silicio no
      cambia entre disparos de la misma cámara, así que el patrón
      debe repetirse idéntico en todo un lote.
   2) Coherencia espacial de unos pocos píxeles: las imperfecciones
      de fabricación afectan a zonas contiguas de la oblea, no a
      fotodiodos sueltos al azar, así que se genera con ruido de
      valor interpolado (grumos) en vez de un hash por píxel puro.
   Se suma una octava de escala mucho mayor —el «gradiente de
   oblea»— que imita la variación lenta de sensibilidad entre el
   centro y el borde del trozo de silicio del que se cortó el
   sensor. Todo se aplica multiplicando la señal: en negro absoluto
   no hay fotocorriente que amplificar, así que el patrón desaparece
   ahí, al contrario que un ruido aditivo. */
SH.prnu = PRE + `
uniform float uAmt;
uniform float uScale;
uniform float uWafer;
float vnp(vec2 p, float s){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(vec3(i,s));
  float b = hash13(vec3(i+vec2(1.0,0.0),s));
  float c = hash13(vec3(i+vec2(0.0,1.0),s));
  float d = hash13(vec3(i+vec2(1.0,1.0),s));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y)*2.0-1.0;
}
void main(){
  vec2 px = vUV*uRes;
  vec3 c = texture(uTex,vUV).rgb;

  float s1 = max(uScale,     0.4);
  float s2 = max(uScale*2.2, 0.9);
  vec3 fine = vec3(
    vnp(px/s1, uCamSeed+401.0)*0.7 + vnp(px/s2, uCamSeed+402.0)*0.3,
    vnp(px/s1, uCamSeed+411.0)*0.7 + vnp(px/s2, uCamSeed+412.0)*0.3,
    vnp(px/s1, uCamSeed+421.0)*0.7 + vnp(px/s2, uCamSeed+422.0)*0.3
  );
  float wafer = vnp(px/max(uRes.x*0.6,1.0), uCamSeed+499.0);

  vec3 pattern = fine*uAmt + vec3(wafer)*uWafer;
  c *= max(vec3(0.0), vec3(1.0) + pattern);
  fragColor = vec4(clamp(c,0.0,1.0),1.0);
}`;

SH.sensor = PRE + `
uniform float uShot;
uniform float uRead;
uniform vec3  uGain;
uniform float uChroma;
uniform float uBand;
uniform float uHot;
uniform float uScale;
uniform float uResponse;
uniform float uColumn;
uniform float uShadow;

float vn(vec2 p, float s){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(vec3(i,s));
  float b = hash13(vec3(i+vec2(1.0,0.0),s));
  float c = hash13(vec3(i+vec2(0.0,1.0),s));
  float d = hash13(vec3(i+vec2(1.0,1.0),s));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y)*2.0-1.0;
}

vec2 rot(vec2 p, float a){
  float c = cos(a), s = sin(a);
  return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
}

/* El grano real se agrupa: los cristales forman cúmulos de tamaños
   distintos. Tres octavas de ruido de valor dan esa estructura; un
   hash por píxel da ruido blanco, que al 400 % se distingue del
   grano a simple vista.
   Cada octava va rotada para despegar su rejilla de la de píxeles:
   sin eso, con escala cerca de 1.0 los nodos coinciden y la
   varianza sube un 35 % de golpe.
   El 3.45 devuelve la desviación a 1.0 (interpolar la reduce);
   medido sobre 90.000 muestras da 1.000 en todo el rango. */
float grain(vec2 px, float sc, float s){
  float s1 = max(sc,       0.35);
  float s2 = max(sc*0.5,   0.25);
  float s3 = max(sc*0.25,  0.15);
  float g = vn(rot(px/s1, 0.37),                     s     )*0.60
          + vn(rot(px/s2, 1.19) + vec2(19.0, 7.0),   s+1.73)*0.29
          + vn(rot(px/s3, 2.41) + vec2( 3.0,29.0),   s+3.91)*0.11;
  return g*3.45;
}

void main(){
  vec2 px = vUV*uRes;
  vec3 c = texture(uTex,vUV).rgb;

  /* Patrón FIJO del sensor: la respuesta por píxel (equivalente
     sintético de la PRNU) y el ruido de columna. Van con «uCamSeed», no
     con «uSeed», y ésa es toda la diferencia: en una cámara real este
     patrón es una propiedad del silicio y sale idéntico en todas sus
     fotos, mientras que el grano de más abajo es aleatorio en cada
     exposición. Atado a la semilla de disparo, un lote entero salía con
     una huella distinta por imagen, que es justo lo contrario de lo que
     ocurre de verdad y se detecta correlacionando unas con otras.

     Sigue siendo un patrón sintético: no reproduce la huella de una
     cámara concreta identificable ni acredita una captura real. */
  vec3 response = vec3(gaussN(floor(px),uCamSeed+301.0),
    gaussN(floor(px),uCamSeed+302.0),gaussN(floor(px),uCamSeed+303.0));
  c *= max(vec3(0.0),vec3(1.0)+response*uResponse);
  c += gaussN(vec2(floor(px.x),0.0),uCamSeed+304.0)*uColumn;

  /* El ruido de disparo ya cae con la señal y el de lectura es
     constante, así que la relación señal-ruido ya empeora sola en
     sombras. Este factor exagera esa asimetría a propósito, sobre la
     luminancia de ENTRADA (antes de que el propio ruido la altere),
     para poder replicar el aspecto de levantar sombras en el
     revelado sin depender sólo de cómo caigan shot y read por su
     cuenta. */
  float lum0 = dot(c, LUM);
  float shadowGain = 1.0 + uShadow * pow(1.0 - clamp(lum0, 0.0, 1.0), 2.0);

  vec3 g1 = vec3(grain(px,                    uScale, uSeed+1.0),
                 grain(px+vec2(53.0,17.0),    uScale, uSeed+2.0),
                 grain(px+vec2(11.0,97.0),    uScale, uSeed+3.0));
  c += sqrt(max(c,0.0)) * g1 * uShot * uGain * shadowGain;

  vec3 g2 = vec3(grain(px+vec2( 7.0, 3.0), uScale*0.7, uSeed+11.0),
                 grain(px+vec2(41.0,63.0), uScale*0.7, uSeed+12.0),
                 grain(px+vec2(83.0,29.0), uScale*0.7, uSeed+13.0));
  c += g2 * uRead * uGain * shadowGain;

  // El ruido de color vive a una escala bastante mayor que el de
  // luminancia: manchas, no puntos.
  float cb = grain(px,                uScale*4.5, uSeed+21.0)*uChroma;
  float cr = grain(px+vec2(13.0,7.0), uScale*4.5, uSeed+22.0)*uChroma;
  c += vec3(cr, -(cb+cr)*0.36, cb);

  c += vn(vec2(0.5, floor(px.y)), uSeed+31.0)*uBand;

  float h = hash13(vec3(floor(px), uSeed+41.0));
  if(h > 1.0 - uHot)      c = vec3(1.15,0.98,0.86);
  else if(h < uHot*0.55)  c = vec3(0.0);

  fragColor = vec4(c,1.0);
}`;

SH.clip = PRE + `
uniform float uBlack;
uniform vec3  uCeil;
void main(){
  vec3 c = texture(uTex,vUV).rgb + uBlack;
  fragColor = vec4(min(max(c,0.0), uCeil),1.0);
}`;

SH.tone = PRE + `
uniform vec3  uWb;
uniform float uExp;
uniform float uS;
uniform float uSat;
vec3 l2s(vec3 c){
  c = max(c,0.0);
  return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c));
}
void main(){
  vec3 c = texture(uTex,vUV).rgb * uWb * uExp;
  c = l2s(clamp(c,0.0,1.0));
  c = mix(c, c*c*(3.0-2.0*c), uS);
  float l = dot(c,LUM);
  vec3 d = (c - vec3(l)) * vec3(1.0+0.18*uSat, 1.0, 1.0-0.07*uSat);
  c = vec3(l) + d*(1.0+uSat*0.55);
  fragColor = vec4(clamp(c,0.0,1.0),1.0);
}`;

/* Gradación por zonas (split-toning): un tinte para las sombras y otro
   distinto para las luces, ponderados por la luminancia del propio
   píxel. El balance de blancos de la etapa anterior es uniforme en
   toda la imagen; una escena real casi nunca lo es, y menos aún tras
   pasar por el procesado de un revelado o de una cámara con "look"
   propio. */
SH.grade = PRE + `
uniform vec2 uShTint;
uniform vec2 uHiTint;
uniform float uAmt;
void main(){
  vec3 c = texture(uTex,vUV).rgb;
  float l = clamp(dot(c, LUM), 0.0, 1.0);
  float wsh = 1.0 - smoothstep(0.0, 0.7, l);
  float whi = smoothstep(0.3, 1.0, l);
  vec3 tint = vec3(uShTint.x, 0.0, uShTint.y) * wsh
            + vec3(uHiTint.x, 0.0, uHiTint.y) * whi;
  c += tint * 0.14 * uAmt;
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

SH.detail = PRE + `
uniform float uSmear;
uniform float uSharp;
uniform float uSharpR;
uniform float uSigma;
uniform float uLocal;

void main(){
  vec2 t = 1.0/uRes;
  vec3 c = texture(uTex,vUV).rgb;
  float l0 = dot(c,LUM);

  /* Bilateral 5×5: pesa por distancia y por diferencia de tono. Un
     desenfoque uniforme emborrona también los bordes y eso se lee
     como foto desenfocada. La reducción de ruido real aplasta lo
     plano y respeta el contorno, y ese contraste es justo lo que
     delata a un JPEG de móvil. */
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for(int j=-2;j<=2;j++){
    for(int i=-2;i<=2;i++){
      vec2 o = vec2(float(i), float(j));
      vec3 cs = texture(uTex, vUV + o*t).rgb;
      float dl = dot(cs,LUM) - l0;
      float w = exp(-dot(o,o)/7.0) * exp(-(dl*dl)/(2.0*uSigma*uSigma));
      acc += cs*w;
      wsum += w;
    }
  }
  vec3 bl = acc/max(wsum, 1e-5);

  float lc = clamp(l0, 0.0, 1.0);
  float w = pow(1.0 - lc, 2.0);
  vec3 sm = mix(c, bl, clamp(uSmear*w, 0.0, 1.0));

  // Desenfoque ancho aparte, para el sobreimpulso del enfoque.
  vec2 t2 = t*uSharpR;
  vec3 b2 = vec3(0.0);
  b2 += texture(uTex,vUV+vec2(-1.0,0.0)*t2).rgb*0.25;
  b2 += texture(uTex,vUV+vec2( 1.0,0.0)*t2).rgb*0.25;
  b2 += texture(uTex,vUV+vec2(0.0,-1.0)*t2).rgb*0.25;
  b2 += texture(uTex,vUV+vec2(0.0, 1.0)*t2).rgb*0.25;

  vec3 sharpened = clamp(sm + (sm-b2)*uSharp, 0.0, 1.0);

  /* Contraste local, aproximando un CLAHE: se aleja el píxel de la
     media de un entorno amplio (uTex2, calculada aparte a baja
     resolución y muy difuminada), con la ganancia recortada donde la
     desviación ya es grande —el equivalente al límite de recorte de
     un CLAHE por histograma, sin necesitar histogramas por celda—.
     Eso es lo que evita que el ruido de una sombra ya ruidosa se
     dispare en vez de simplemente ganar contraste local. */
  vec3 localMean = texture(uTex2, vUV).rgb;
  vec3 dev = sharpened - localMean;
  vec3 clipped = dev / (1.0 + abs(dev) * 2.2);
  vec3 result = sharpened + clipped * uLocal;

  fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}`;

/* Residuo de ruido de cámara: lo que queda tras el pipeline interno
   del ISP (demosaico + reducción de ruido no lineal + realce), no el
   ruido crudo del sensor que ya pone SH.sensor. Dos rasgos lo
   distinguen de ese ruido base:
   1) No-gaussiano: elevar el ruido a una potencia >1 preservando el
      signo da colas pesadas —grumos aislados— en vez de la campana
      suave de un ruido gaussiano puro, que es la textura que deja
      justo un denoiser no lineal al no limpiar perfectamente.
   2) Modulado por la actividad local (un laplaciano de vecino
      inmediato): un denoiser real es agresivo en zonas lisas y tímido
      donde hay detalle que no quiere destruir, así que el residuo
      sigue de cerca ese mismo patrón, no aparece uniforme por toda
      la imagen.
   Atado a `uSeed`, no a `uCamSeed`: es ruido térmico de cada
   exposición, no una propiedad fija del sensor como el PRNU. */
SH.residual = PRE + `
uniform float uAmt;
uniform float uDetail;
uniform float uScale;
float vnr(vec2 p, float s){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(vec3(i,s));
  float b = hash13(vec3(i+vec2(1.0,0.0),s));
  float c = hash13(vec3(i+vec2(0.0,1.0),s));
  float d = hash13(vec3(i+vec2(1.0,1.0),s));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y)*2.0-1.0;
}
void main(){
  vec2 px = vUV*uRes;
  vec3 c = texture(uTex,vUV).rgb;

  vec2 t = 1.0/uRes;
  vec3 n = texture(uTex,vUV+vec2(t.x,0.0)).rgb + texture(uTex,vUV-vec2(t.x,0.0)).rgb
         + texture(uTex,vUV+vec2(0.0,t.y)).rgb + texture(uTex,vUV-vec2(0.0,t.y)).rgb;
  float activity = clamp(length(c*4.0-n)*3.0, 0.0, 1.0);
  float m = mix(1.0, activity, uDetail);

  float s1 = max(uScale, 0.3);
  vec3 raw = vec3(vnr(px/s1,uSeed+701.0), vnr(px/s1,uSeed+711.0), vnr(px/s1,uSeed+721.0));
  vec3 spiky = sign(raw) * pow(abs(raw), vec3(1.6));

  c += spiky * uAmt * m;
  fragColor = vec4(clamp(c,0.0,1.0),1.0);
}`;

/* Rasguños y pelos de superficie: segmentos finos y casi verticales,
   fijos por celda de una rejilla —como el polvo del sensor, pero en
   segmentos alargados en vez de discos—, la mitad claros (suciedad
   reflectante) y la mitad oscuros (marca en la emulsión). Es un
   artefacto de manejo físico posterior a la captura, no del objetivo
   ni del sensor, y por eso vive después del enfoque y no antes. */
SH.scratches = PRE + `
uniform float uAmt;
uniform float uLength;
uniform float uWidth;
float segDist(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba),1e-6), 0.0, 1.0);
  return length(pa - ba*h);
}
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  vec2 asp = vec2(uRes.x/uRes.y, 1.0);
  vec2 p = vUV * asp;
  float cells = 2.5;
  vec2 cellUV = p * cells;
  vec2 cellId = floor(cellUV);

  float mark = 0.0;
  float tintSign = 1.0;
  for(int j = -1; j <= 1; j++){
    for(int i = -1; i <= 1; i++){
      vec2 nid = cellId + vec2(float(i), float(j));
      float h0 = hash13(vec3(nid, uSeed+91.0));
      if(h0 > uAmt * 0.55) continue;
      float hx = hash13(vec3(nid, uSeed+92.0));
      float hy = hash13(vec3(nid, uSeed+93.0));
      float ha = hash13(vec3(nid, uSeed+94.0));
      float hl = hash13(vec3(nid, uSeed+95.0));
      float hb = hash13(vec3(nid, uSeed+96.0));
      vec2 start = nid + vec2(hx, hy);
      float ang = 1.5707963 + (ha - 0.5) * 1.1;
      float len = (0.3 + hl * 1.1) * uLength;
      vec2 dir = vec2(cos(ang), sin(ang)) * len;
      vec2 end = start + dir;
      float d = segDist(cellUV, start, end);
      float w = 0.01 + uWidth * 0.045;
      float m = 1.0 - smoothstep(0.0, w, d);
      if(m > mark){ mark = m; tintSign = hb > 0.5 ? 1.0 : -1.0; }
    }
  }
  vec3 tint = tintSign > 0.0 ? vec3(1.35) : vec3(0.55);
  c = mix(c, c*tint, mark*0.75);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

SH.warp = PRE + `
uniform float uAmp;
uniform float uFreq;
float vnoise(vec2 p, float s){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(vec3(i,s));
  float b = hash13(vec3(i+vec2(1.0,0.0),s));
  float c = hash13(vec3(i+vec2(0.0,1.0),s));
  float d = hash13(vec3(i+vec2(1.0,1.0),s));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y)*2.0-1.0;
}
void main(){
  vec2 p = vUV*uRes/uFreq;
  vec2 d = vec2(vnoise(p, uSeed+51.0), vnoise(p+vec2(31.0,17.0), uSeed+52.0))*uAmp;
  fragColor = vec4(texture(uTex, vUV + d/uRes).rgb,1.0);
}`;

SH.chroma = PRE + `
uniform float uAmount;
vec3 rgb2ycc(vec3 c){
  float y = dot(c, vec3(0.299,0.587,0.114));
  return vec3(y, (c.b-y)*0.564, (c.r-y)*0.713);
}
vec3 ycc2rgb(vec3 v){
  return vec3(v.x + 1.403*v.z,
              v.x - 0.344*v.y - 0.714*v.z,
              v.x + 1.773*v.y);
}
vec2 blockC(vec2 b){
  vec2 acc = vec2(0.0);
  ivec2 base = ivec2(b*2.0);
  for(int j=0;j<2;j++){
    for(int i=0;i<2;i++){
      ivec2 p = clamp(base+ivec2(i,j), ivec2(0), ivec2(uRes)-ivec2(1));
      acc += rgb2ycc(texelFetch(uTex,p,0).rgb).yz;
    }
  }
  return acc*0.25;
}
void main(){
  vec3 full = rgb2ycc(texture(uTex,vUV).rgb);
  vec2 hp = vUV*uRes*0.5 - 0.5;
  vec2 bi = floor(hp), f = fract(hp);
  vec2 cc = mix(mix(blockC(bi),            blockC(bi+vec2(1.0,0.0)), f.x),
                mix(blockC(bi+vec2(0.0,1.0)), blockC(bi+vec2(1.0,1.0)), f.x), f.y);
  vec2 outc = mix(full.yz, cc, uAmount);
  fragColor = vec4(clamp(ycc2rgb(vec3(full.x, outc)),0.0,1.0),1.0);
}`;

/* Rastros visuales de la cuantización DCT por bloques de 8×8, para
   verlos en la vista previa en tiempo real -- la compresión JPEG real
   de más abajo es CPU y sólo se aplica al aceptar. Dos firmas:
   1) Blockiness: en una zona lisa, la componente DC de cada bloque
      domina y queda cuantizada bloque a bloque, así que dos bloques
      vecinos rara vez comparten exactamente el mismo nivel — el
      escalón se nota más cerca del límite entre ellos, donde el
      codec real también lo nota más.
   2) Ringing (efecto Gibbs): truncar las frecuencias altas de la DCT
      dispara una oscilación amortiguada pegada a cualquier borde de
      contraste fuerte, el halo doble que rodea texto o siluetas muy
      comprimidas. */
SH.jpegtrace = PRE + `
uniform float uBlock;
uniform float uRing;
void main(){
  vec2 px = vUV*uRes;
  vec3 c = texture(uTex,vUV).rgb;

  vec2 bp = mod(px, 8.0);
  vec2 bid = floor(px/8.0);
  float dcShift = hash13(vec3(bid, uCamSeed+901.0))*2.0-1.0;
  float edgeBlock = 1.0 - smoothstep(0.0, 1.2, min(min(bp.x,7.0-bp.x),min(bp.y,7.0-bp.y)));
  c += dcShift * uBlock * (0.3 + edgeBlock*0.7);

  vec2 t = 1.0/uRes;
  vec3 gx = texture(uTex,vUV+vec2(t.x,0.0)).rgb - texture(uTex,vUV-vec2(t.x,0.0)).rgb;
  vec3 gy = texture(uTex,vUV+vec2(0.0,t.y)).rgb - texture(uTex,vUV-vec2(0.0,t.y)).rgb;
  float edgeStrength = clamp(length(gx)+length(gy), 0.0, 1.0);
  float wave = sin(px.x*3.14159265*0.9)*sin(px.y*3.14159265*0.9);
  c += wave * edgeStrength * uRing;

  fragColor = vec4(clamp(c,0.0,1.0),1.0);
}`;

SH.copy = PRE + `
void main(){ fragColor = vec4(texture(uTex,vUV).rgb,1.0); }`;
