"""Compilador de acciones de Photoshop (.atn) a recetas de estilos de Realify.
Simula la pila de capas que construye cada acción (capas de ajuste, rellenos, grupos, copias de la imagen) y emite una receta JSON
que el motor de Realify (js/filters/styleengine.js) sabe evaluar. Lo que no sabe interpretar se anota en `unsupported`."""
import math, copy
from atnparse import parse

BLEND = {'Nrml':'normal','Mltp':'multiply','Scrn':'screen','Ovrl':'overlay','SftL':'softLight','HrdL':'hardLight','CDdg':'colorDodge','CBrn':'colorBurn',
 'Dfrn':'difference','Xclu':'exclusion','Drkn':'darken','Lghn':'lighten','H   ':'hue','Strt':'saturation','Clr ':'color','Lmns':'luminosity',
 'linearDodge':'linearDodge','linearBurn':'linearBurn','vividLight':'vividLight','linearLight':'linearLight','pinLight':'pinLight','hardMix':'hardMix',
 'subtract':'subtract','divide':'divide','darkerColor':'darkerColor','lighterColor':'lighterColor','dissolve':'dissolve','PsTh':'pass'}
GTYPES={'Lnr':'lin','Rdl':'rad','Angl':'ang','Rflc':'ref','Dmnd':'dia'}
CLR_NAMES = {'Rds ':'red','Ylws':'yellow','Grns':'green','Cyns':'cyan','Bls ':'blue','Mgnt':'magenta','Whts':'white','Ntrl':'neutral','Blks':'black'}

class Unsupported(Exception): pass

def num(v, d=0.0):
    if isinstance(v, tuple) and len(v)==2 and isinstance(v[1], float): return v[1]
    if isinstance(v, (int,float)): return float(v)
    return d
def key(d,k):
    for kk in d:
        if kk.strip()==k.strip(): return d[kk]
    return None
def refname(v):
    if isinstance(v, tuple) and v[0]=='ref':
        for t,x in v[1]:
            if t=='name': return x
    return None
def refkind(v):
    if isinstance(v, list) and v: v=v[0]
    if isinstance(v, tuple) and v[0]=='ref' and v[1]:
        t,x=v[1][0]; return t,x
    return None,None

def color_rgb(c):
    """RGBC / HSBC / Grsc / LbCl → [r,g,b] 0-255"""
    if not isinstance(c, dict): raise Unsupported('color no RGB')
    cl=c['_cls'].strip()
    if cl=='RGBC': return [num(key(c,'Rd')),num(key(c,'Grn')),num(key(c,'Bl'))]
    if cl=='HSBC':
        h=num(key(c,'H'))%360; s=num(key(c,'Strt'))/100; v=num(key(c,'Brgh'))/100
        c_=v*s; x=c_*(1-abs((h/60)%2-1)); m=v-c_
        r,g,b=[(c_,x,0),(x,c_,0),(0,c_,x),(0,x,c_),(x,0,c_),(c_,0,x)][int(h//60)%6]
        return [(r+m)*255,(g+m)*255,(b+m)*255]
    if cl=='Grsc':
        g=255*(1-num(key(c,'Gry'))/100); return [g,g,g]
    if cl=='LbCl':
        L=num(key(c,'Lmnc')); a=num(key(c,'A')); b=num(key(c,'B'))
        fy=(L+16)/116; fx=fy+a/500; fz=fy-b/200
        f=lambda t: t**3 if t**3>0.008856 else (t-16/116)/7.787
        X=0.96422*f(fx); Y=f(fy); Z=0.82521*f(fz)
        r= 3.1338561*X-1.6168667*Y-0.4906146*Z; g=-0.9787684*X+1.9161415*Y+0.0334540*Z; bb=0.0719453*X-0.2289914*Y+1.4052427*Z
        e=lambda v: 255*(12.92*v if v<=0.0031308 else 1.055*max(v,0)**(1/2.4)-0.055)
        return [max(0,min(255,e(r))),max(0,min(255,e(g))),max(0,min(255,e(bb)))]
    raise Unsupported('color '+cl)

def gradient(g):
    if not isinstance(g, dict): raise Unsupported('degradado')
    if key(g,'GrdF') and key(g,'GrdF')[2]!='CstS': raise Unsupported('degradado de ruido')
    stops=[]
    for s in key(g,'Clrs') or []:
        t=key(s,'Type')
        if t and t[2] in ('FrgC','BckC'): raise Unsupported('degradado con color de primer plano/fondo')
        stops.append([num(key(s,'Lctn'))/4096, [round(x,2) for x in color_rgb(key(s,'Clr'))], num(key(s,'Mdpn'),50)/100])
    alpha=[]
    for s in key(g,'Trns') or []:
        alpha.append([num(key(s,'Lctn'))/4096, num(key(s,'Opct'),100)/100, num(key(s,'Mdpn'),50)/100])
    out={'stops':stops}
    if any(a[1]<0.999 for a in alpha): out['alpha']=alpha
    sm=num(key(g,'Intr'),4096)
    return out

class L:
    __slots__=('name','k','p','o','fo','m','v','clip','kids','parent','mask','ops')
    def __init__(s,name,k,p=None):
        s.name=name; s.k=k; s.p=p or {}; s.ops=[]; s.o=1.0; s.fo=1.0; s.m='normal'; s.v=True; s.clip=False; s.kids=[] if k=='group' else None; s.parent=None; s.mask=None
    def out(s):
        d={'k':s.k}
        d.update(s.p)
        if s.o!=1: d['op']=round(s.o,4)
        if s.fo!=1: d['fo']=round(s.fo,4)
        if s.m!='normal': d['bm']=s.m
        if not s.v: d['hid']=1
        if s.clip: d['clip']=1
        if s.mask: d['mask']=s.mask
        if s.ops: d['ops']=s.ops
        if s.k=='group': d['kids']=[x.out() for x in s.kids]
        return d

class Machine:
    def __init__(s, actions_by_name, filt=None):
        s.acts=actions_by_name; s.root=[]; s.sel=[]; s.unsupported=[]; s.depth=0; s.snapid=0; s.tmp_ref=None
        base=L('Background','base'); s.root.append(base); s.target=base; s.sel=[base]
    # ---- utilidades de árbol
    def container(s, layer): return layer.parent.kids if layer and layer.parent else s.root
    def find(s, name):
        def walk(lst):
            for x in reversed(lst):
                if x.name==name: return x
                if x.kids is not None:
                    r=walk(x.kids)
                    if r: return r
            return None
        return walk(s.root)
    def insert_above_target(s, layer):
        if s.target is None:
            lst=s.root; lst.append(layer)
        else:
            lst=s.container(s.target); layer.parent=s.target.parent
            lst.insert(lst.index(s.target)+1, layer)
        s.target=layer; s.sel=[layer]
    def snapshot_layer(s): return L('Copy','snap')
    # ---- eventos
    def run(s, steps):
        for st in steps:
            if not st['on']: continue
            f=getattr(s,'ev_'+st['name'].replace(' ','_').replace('/','_'),None)
            try:
                if f is None: raise Unsupported('evento «%s»'%st['name'])
                f(st['d'])
            except Unsupported as e:
                s.unsupported.append(str(e))
            except Exception as e:
                s.unsupported.append('error interno en %s (%s)'%(st['name'],type(e).__name__))
    def ev_Make(s,d):
        u=key(d,'Usng'); nw=key(d,'Nw'); ref=key(d,'null')
        t,x=refkind(ref) if ref is not None else (None,None)
        if isinstance(u,dict):
            cl=u['_cls'].strip(); name=key(u,'Nm') or ''
            if cl=='AdjL':
                ty=key(u,'Type'); 
                if not isinstance(ty,dict) and not (isinstance(ty,tuple) and ty[0]=='class'): raise Unsupported('ajuste sin tipo')
                tcls=ty['_cls'].strip() if isinstance(ty,dict) else ty[1].strip()
                lay=L(name or tcls,'adj',{'t':tcls}); s.apply_lyr_props(lay,u)
                if isinstance(ty,dict): s.fill_adj(lay,ty)
                s.insert_above_target(lay); return
            if cl=='contentLayer':
                ty=key(u,'Type')
                if not isinstance(ty,dict): raise Unsupported('relleno sin tipo')
                tcls=ty['_cls'].strip()
                if tcls=='solidColorLayer':
                    lay=L(name or 'Color','solid',{'rgb':[round(v,2) for v in color_rgb(key(ty,'Clr'))]})
                elif tcls=='gradientLayer': lay=L(name or 'Gradient','grad',s.grad_params(ty))
                else: raise Unsupported('relleno '+tcls)
                # un relleno creado justo después de una capa vacía ocupa su lugar y conserva su nombre
                t0=s.target
                if t0 is not None and t0.k=='pix' and not t0.ops and not t0.p and not key(u,'Nm'):
                    lay.name=t0.name; lay.o=t0.o; lay.fo=t0.fo; lay.m=t0.m; lay.clip=t0.clip
                    lst=s.container(t0); i=lst.index(t0); lst.pop(i); s.target=lst[i-1] if i>0 else None
                s.apply_lyr_props(lay,u); s.insert_above_target(lay); return
            if cl=='Lyr':
                lay=L(name or 'Layer','pix'); s.apply_lyr_props(lay,u); s.insert_above_target(lay); return
        if x=='layerSection':
            kids=list(s.sel) if s.sel else []
            if s.target is not None and s.target not in kids: kids=[s.target]+kids
            if not kids: raise Unsupported('grupo vacío')
            par=kids[0].parent; lst=s.container(kids[0])
            idx=[lst.index(k) for k in kids if k in lst]
            if len(idx)!=len(kids): raise Unsupported('grupo de capas no contiguas')
            lo=min(idx); kids_sorted=[lst[i] for i in sorted(idx)]
            g=L(key(d,'Nm') or 'Group','group'); g.m='pass'
            for i in sorted(idx,reverse=True): lst.pop(i)
            lst.insert(lo,g); g.parent=par
            for k in kids_sorted: k.parent=g; g.kids.append(k)
            s.target=g; s.sel=[g]; return
        if isinstance(nw,tuple) and nw[1]=='Chnl':
            at=key(d,'At'); us=key(d,'Usng')
            # máscara de capa: «mostrar todo» no cambia nada; «ocultar todo» o con selección sí
            if isinstance(us,tuple) and us[0]=='enum' and us[2]=='RvlA' or us=='RvlA': return
            if isinstance(us,tuple) and us[0]=='enum' and us[2]=='HdAl': s.target and setattr(s.target,'mask','hide'); return
            return
        if x in ('Grdn','Ptrn') : return
        raise Unsupported('Make '+str(t)+' '+str(x))
    def apply_lyr_props(s,lay,u):
        op=key(u,'Opct'); 
        if op is not None: lay.o=num(op,100)/100
        md=key(u,'Md')
        if md is not None:
            m=md[2] if isinstance(md,tuple) else md
            if m not in BLEND: raise Unsupported('modo de fusión '+str(m))
            lay.m=BLEND[m]
        fo=key(u,'FlOp')
        if fo is not None: lay.fo=num(fo,100)/100
        g=key(u,'Grup')
        if g: lay.clip=True
    def grad_params(s,ty):
        g=key(ty,'Grad'); gp=gradient(g)
        tp=key(ty,'Type'); tp=tp[2] if isinstance(tp,tuple) else (tp if isinstance(tp,str) else 'Lnr ')
        p={'type':GTYPES.get(tp.strip() if isinstance(tp,str) else tp,'lin'),
           'angle':num(key(ty,'Angl'),90),'scale':num(key(ty,'Scl '),100),'stops':gp['stops']}
        if 'alpha' in gp: p['alpha']=gp['alpha']
        if key(ty,'Rvrs'): p['rev']=1
        if key(ty,'Dthr'): p['dither']=1
        off=key(ty,'Ofst')
        if isinstance(off,dict): p['off']=[num(key(off,'Hrzn')),num(key(off,'Vrtc'))]
        if key(ty,'Algn') is False: p['noalign']=1
        return p
    def ev_Select(s,d):
        ref=key(d,'null'); mod=key(d,'selectionModifier'); mod=mod[2] if isinstance(mod,tuple) else mod
        t,x=refkind(ref)
        if t=='name':
            lay=s.find(x)
            if lay is None:
                if x in ('RGB ','Rd  ','Grn ','Bl  ','Msk ','PbTl'): return
                raise Unsupported('seleccionar «%s» inexistente'%x)
            if mod in ('addToSelection','addToSelectionContinuous'):
                if lay not in s.sel: s.sel.append(lay)
                if mod=='addToSelectionContinuous' and len(s.sel)>=2:
                    # rango continuo entre el primero y éste
                    lst=s.container(s.sel[0]); 
                    if lay in lst:
                        a=lst.index(s.sel[0]); b=lst.index(lay); lo,hi=min(a,b),max(a,b)
                        s.sel=[lst[i] for i in range(lo,hi+1)]
                s.target=lay
            elif mod=='removeFromSelection':
                if lay in s.sel: s.sel.remove(lay)
            else: s.target=lay; s.sel=[lay]
            return
        if t in ('Chnl','Msk ','PbTl','Enmr','Mn  ','Dcmn') or x in ('Chnl','Msk ','PbTl','RGB '): return
        if t=='Mn  ': return
        raise Unsupported('Select '+str(t)+' '+str(x))
    def ev_Set(s,d):
        ref=key(d,'null'); T=key(d,'T')
        t,x=refkind(ref)
        if isinstance(T,dict):
            cl=T['_cls'].strip()
            if cl=='Lefx':
                extra=[k_ for k_ in T if not k_.startswith('_') and k_.strip()!='Scl']
                if extra: raise Unsupported('estilos de capa '+','.join(k_.strip() for k_ in extra))
                return
            if cl=='Lyr':
                lay=s.target
                if lay is None: raise Unsupported('Set Lyr sin capa')
                nm=key(T,'Nm'); 
                if nm is not None: lay.name=nm
                s.apply_lyr_props(lay,T)
                v=key(T,'Vsbl')
                if v is not None: lay.v=bool(v)
                return
            lay=s.target
            if lay is None: raise Unsupported('Set sin capa')
            if cl in('solidColorLayer',) and lay.k=='solid': lay.p['rgb']=[round(v,2) for v in color_rgb(key(T,'Clr'))]; return
            if cl=='gradientLayer' and lay.k=='grad':
                np_=s.grad_params(T) if key(T,'Grad') is not None else {}
                # al cambiar sólo parte, se conservan los demás
                for k_,v_ in np_.items(): lay.p[k_]=v_
                if key(T,'Angl') is not None: lay.p['angle']=num(key(T,'Angl'))
                if key(T,'Scl ') is not None: lay.p['scale']=num(key(T,'Scl '))
                if key(T,'Rvrs') is not None: lay.p['rev']=1 if key(T,'Rvrs') else 0
                tp=key(T,'Type')
                if tp is not None: lay.p['type']=GTYPES.get((tp[2] if isinstance(tp,tuple) else tp).strip(),'lin')
                return
            if lay.k=='adj': s.fill_adj(lay,T,cl); return
            raise Unsupported('Set '+cl+' sobre '+lay.k)
        if t in ('fsel','Chnl','Clrs') or x in ('fsel','Chnl','Clrs'): return
        raise Unsupported('Set '+str(t)+' '+str(T))
    def fill_adj(s,lay,T,cl=None):
        cl=(cl or T['_cls']).strip(); p=lay.p
        if cl=='Crvs':
            ch=p.setdefault('ch',{})
            for a in key(T,'Adjs') or []:
                tc,xc=refkind(key(a,'Chnl')); nm={'Cmps':'c','Rd  ':'r','Grn ':'g','Bl  ':'b'}.get(xc if isinstance(xc,str) else '', None)
                if nm is None: raise Unsupported('curva de canal '+str(xc))
                ch[nm]=[[num(key(q,'Hrzn')),num(key(q,'Vrtc'))] for q in key(a,'Crv ')]
        elif cl=='Lvls':
            ch=p.setdefault('ch',{})
            for a in key(T,'Adjs') or []:
                tc,xc=refkind(key(a,'Chnl')); nm={'Cmps':'c','Rd  ':'r','Grn ':'g','Bl  ':'b'}.get(xc if isinstance(xc,str) else '', None)
                if nm is None: raise Unsupported('niveles de canal '+str(xc))
                i=key(a,'Inpt') or [0,255]; o=key(a,'Otpt') or [0,255]
                ch[nm]={'in':[num(i[0]),num(i[1])],'g':num(key(a,'Gmm '),1.0),'out':[num(o[0]),num(o[1])]}
        elif cl=='HStr':
            p['colorize']=bool(key(T,'Clrz')); adjs=key(T,'Adjs') or []
            ranges=[]
            for a in adjs:
                H=num(key(a,'H')); S=num(key(a,'Strt')); Lg=num(key(a,'Lght'))
                if key(a,'LclR') is None and key(a,'BgnR') is None: p['m']=[H,S,Lg]
                else:
                    ranges.append({'r':[num(key(a,'BgnR')),num(key(a,'BgnS')),num(key(a,'EndS')),num(key(a,'EndR'))],'h':H,'s':S,'l':Lg})
            if ranges: p['rg']=ranges
            p.setdefault('m',[0,0,0])
        elif cl=='GdMp':
            gp=gradient(key(T,'Grad')) if key(T,'Grad') is not None else None
            if gp: p['stops']=gp['stops']
            if key(T,'Rvrs') is not None: p['rev']=1 if key(T,'Rvrs') else 0
            if key(T,'Dthr') is not None: p['dither']=1 if key(T,'Dthr') else 0
        elif cl=='photoFilter':
            if key(T,'Clr') is not None: p['rgb']=[round(v,2) for v in color_rgb(key(T,'Clr'))]
            if key(T,'Dnst') is not None: p['d']=num(key(T,'Dnst'))
            p['pl']=1 if (key(T,'PrsL') is None or key(T,'PrsL')) else 0
        elif cl=='BrgC':
            p['b']=num(key(T,'Brgh')); p['c']=num(key(T,'Cntr')); p['legacy']=1 if key(T,'useLegacy') else 0
        elif cl=='ClrB':
            for k_,n_ in (('ShdL','s'),('MdtL','m'),('HghL','h')):
                v=key(T,k_)
                if v is not None: p[n_]=[num(x) for x in v]
            pl=key(T,'PrsL'); p['pl']=0 if pl is False else 1
        elif cl=='SlcC':
            m=key(T,'Mthd'); p['abs']=1 if (isinstance(m,tuple) and m[2]=='Absl') else 0
            c=p.setdefault('c',{})
            for q in key(T,'ClrC') or []:
                nm=CLR_NAMES.get(key(q,'Clrs')[2] if isinstance(key(q,'Clrs'),tuple) else key(q,'Clrs'))
                if nm is None: raise Unsupported('color selectivo '+str(key(q,'Clrs')))
                c[nm]=[num(key(q,'Cyn ')),num(key(q,'Mgnt')),num(key(q,'Ylw ')),num(key(q,'Blck'))]
        elif cl=='Exps':
            p['e']=num(key(T,'Exps')); p['o']=num(key(T,'Ofst')); p['g']=num(key(T,'gammaCorrection'),1.0)
        elif cl=='vibrance':
            p['v']=num(key(T,'vibrance')); p['s']=num(key(T,'Strt'))
        elif cl=='BanW':
            p['bw']=[num(key(T,k_),d_) for k_,d_ in (('Rd  ',40),('Ylw ',60),('Grn ',40),('Cyn ',60),('Bl  ',20),('Mgnt',80))]
            p['tint']=bool(key(T,'useTint'))
        elif cl in ('Invr','invert'): pass
        else: raise Unsupported('ajuste '+cl)
    def ev_Hide(s,d):
        t,x=refkind(key(d,'null'))
        if x=='Trgt' and s.target: s.target.v=False
        elif t=='name':
            lay=s.find(x)
            if lay is None: raise Unsupported('ocultar «%s» inexistente'%x)
            lay.v=False
        elif t in('Chnl','Msk ') or x in('Chnl','Msk '): pass
        else: raise Unsupported('Hide '+str(t))
    def ev_Show(s,d):
        t,x=refkind(key(d,'null'))
        if x=='Trgt' and s.target: s.target.v=True
        elif t=='name':
            lay=s.find(x)
            if lay is None: raise Unsupported('mostrar «%s» inexistente'%x)
            lay.v=True
        elif t in('Chnl','Msk ') or x in('Chnl','Msk '): pass
        else: raise Unsupported('Show '+str(t))
    def ev_Move(s,d):
        lay=s.target; T_=key(d,'T   '); t,x=refkind(T_)
        if lay is None: return
        if isinstance(T_,dict) and T_['_cls'].strip()=='Ofst':
            if lay.k in ('adj','base'): raise Unsupported('mover capa de ajuste')
            lay.ops.append({'op':'xf','tx':num(key(T_,'Hrzn')),'ty':num(key(T_,'Vrtc'))}); return
        if x=='Frnt':
            lst=s.container(lay); lst.remove(lay); s.root.append(lay) if False else lst.append(lay)
        elif x=='Back': 
            lst=s.container(lay); lst.remove(lay); lst.insert(0,lay)
        elif x in ('Nxt ','Prvs'):
            lst=s.container(lay); i=lst.index(lay); lst.pop(i); lst.insert(i+(1 if x=='Nxt ' else -1),lay)
        else: raise Unsupported('Move '+str(x))
    def ev_Play(s,d):
        raise Unsupported('Play')
    def ev_Invert(s,d):
        if s.target is not None and s.target.mask=='hide': s.target.mask=None; return   # máscara «ocultar todo» invertida = mostrar todo
        if s.target is not None and s.target.k in ('pix','snap','solid','grad','group'): s.target.ops.append({'op':'inv'}); return
        raise Unsupported('Invert')
    def ev_Reset(s,d): pass
    def ev_Stop(s,d): pass
    def ev_Delete(s,d):
        t,x=refkind(key(d,'null'))
        if (t in('Lyr ',) or x=='Trgt') and s.target:
            lst=s.container(s.target); lst.remove(s.target); s.target=None; s.sel=[]
        elif t in('Chnl','Msk '): pass
        else: raise Unsupported('Delete '+str(t))


    CONTENT=('solid','grad','pix','snap','group')
    def need_content(s,what):
        lay=s.target
        if lay is None: raise Unsupported(what+' sin capa')
        return lay
    def ev_Fill(s,d):
        lay=s.need_content('Fill')
        u=key(d,'Usng'); u=u[2] if isinstance(u,tuple) else u
        col={'Blck':[0,0,0],'Wht ':[255,255,255],'Gry ':[128,128,128]}.get(u)
        if col is None: raise Unsupported('Fill con '+str(u))
        op=num(key(d,'Opct'),100)/100; md=key(d,'Md'); md=BLEND.get(md[2] if isinstance(md,tuple) else md,'normal')
        if lay.k=='pix' and not lay.ops and not lay.p:
            lay.k='solid'; lay.p={'rgb':col}
            if op!=1: lay.fo=op
            if md!='normal': lay.m=md
        else: raise Unsupported('Fill sobre '+lay.k)
    def ev_Merge_Visible(s,d):
        lay=s.need_content('Merge Visible')
        if not key(d,'Dplc'): raise Unsupported('Merge Visible sin duplicar')
        if lay.k!='pix': raise Unsupported('Merge Visible sobre '+lay.k)
        s.snapid+=1; lay.k='snap'; lay.p={'id':s.snapid,'src':'stack'}
    def ev_Layer_Via_Copy(s,d):
        lay=s.need_content('Layer Via Copy')
        if lay.k=='base':
            n=L(lay.name+' copy','snap',{'id':0,'src':'base'}); s.insert_above_target(n); return
        import copy as _c
        n=_c.deepcopy(lay) if False else s.clone(lay)
        n.name=lay.name+' copy'; s.insert_above_target(n)
    def clone(s,lay):
        n=L(lay.name,lay.k,copy.deepcopy(lay.p)); n.o=lay.o; n.fo=lay.fo; n.m=lay.m; n.v=lay.v; n.clip=lay.clip; n.mask=lay.mask; n.ops=copy.deepcopy(lay.ops)
        if lay.k=='snap' and n.p.get('src')=='stack': n.p['src']='ref'
        if lay.kids is not None:
            n.kids=[]
            for k in lay.kids:
                c=s.clone(k); c.parent=n; n.kids.append(c)
        return n
    def ev_Merge_Layers(s,d):
        lay=s.need_content('Merge Layers')
        if lay.k=='group' and len(s.sel)<2: lay.p['iso']=1; lay.m=lay.m if lay.m!='pass' else 'normal'; return
        if len(s.sel)>=2:
            lst=s.container(s.sel[0]); idx=sorted(lst.index(k) for k in s.sel if k in lst)
            if idx!=list(range(idx[0],idx[-1]+1)): raise Unsupported('Merge Layers de capas no contiguas')
            kids=[lst[i] for i in idx]; g=L('Merged','group',{'iso':1}); g.parent=lst and kids[0].parent
            for i in sorted(idx,reverse=True): lst.pop(i)
            lst.insert(idx[0],g)
            for k in kids: k.parent=g; g.kids.append(k)
            top=kids[-1]; g.name=top.name; s.target=g; s.sel=[g]; return
        # fusionar hacia abajo
        lst=s.container(lay); i=lst.index(lay)
        if i==0: raise Unsupported('Merge Layers sin capa debajo')
        below=lst[i-1]
        if below.k in ('base',): raise Unsupported('fusionar sobre la imagen original')
        g=L(below.name,'group',{'iso':1}); g.m=below.m; g.o=below.o; g.v=below.v; g.parent=lay.parent
        below.m='normal'; below.o=1.0; below.fo=1.0
        lst.pop(i); lst.pop(i-1); lst.insert(i-1,g)
        for k in (below,lay): k.parent=g; g.kids.append(k)
        s.target=g; s.sel=[g]
    def ev_Ungroup_Layers(s,d):
        lay=s.need_content('Ungroup')
        if lay.k!='group': raise Unsupported('Ungroup de no grupo')
        lst=s.container(lay); i=lst.index(lay); lst.pop(i)
        for j,k in enumerate(lay.kids): k.parent=lay.parent; lst.insert(i+j,k)
        s.target=lay.kids[-1] if lay.kids else None; s.sel=[s.target] if s.target else []
    def ev_Rasterize(s,d): pass
    def ev_Convert_to_Smart_Object(s,d): pass
    def addop(s,op,what):
        lay=s.need_content(what)
        if lay.k=='adj': raise Unsupported(what+' sobre capa de ajuste')
        if lay.k=='base': raise Unsupported(what+' sobre la imagen original')
        lay.ops.append(op)
    def ev_Gaussian_Blur(s,d): s.addop({'op':'blur','r':num(key(d,'Rds'))},'Gaussian Blur')
    def ev_Motion_Blur(s,d): s.addop({'op':'mblur','a':num(key(d,'Angl')),'d':num(key(d,'Dstn'))},'Motion Blur')
    def ev_Radial_Blur(s,d):
        m=key(d,'BlrM'); m=m[2] if isinstance(m,tuple) else m
        s.addop({'op':'rblur','n':num(key(d,'Amnt')),'mode':'spin' if m=='Spn ' else 'zoom'},'Radial Blur')
    def ev_Add_Noise(s,d):
        ds=key(d,'Dstr'); ds=ds[2] if isinstance(ds,tuple) else ds
        s.addop({'op':'noise','n':num(key(d,'Nose')),'gauss':1 if ds=='Gsn ' else 0,'mono':1 if key(d,'Mnch') else 0,'seed':int(num(key(d,'FlRs'),1))},'Add Noise')
    def ev_Desaturate(s,d): s.addop({'op':'desat'},'Desaturate')
    def ev_Levels(s,d):
        t=L('x','adj',{'t':'Lvls'}); s.fill_adj(t,d,'Lvls'); s.addop({'op':'lvl','ch':t.p.get('ch',{})},'Levels')
    def ev_Hue_Saturation(s,d):
        t=L('x','adj',{'t':'HStr'}); s.fill_adj(t,d,'HStr'); p=dict(t.p); p.pop('t',None); s.addop(dict(op='hue',**p),'Hue/Saturation')
    def ev_Transform(s,d):
        if key(d,'warp') is not None:
            w=key(d,'warp'); st=key(w,'warpStyle'); 
            if not (isinstance(st,tuple) and st[2]=='warpNone'): raise Unsupported('Transform con deformación '+str(st[2] if isinstance(st,tuple) else st))
        o=key(d,'Ofst'); xf={'op':'xf'}
        if isinstance(o,dict): xf['tx']=num(key(o,'Hrzn')); xf['ty']=num(key(o,'Vrtc'))
        for k_,n_ in (('Wdth','sx'),('Hght','sy')):
            v=key(d,k_)
            if v is not None: xf[n_]=num(v,100)/100
        if key(d,'Angl') is not None: xf['rot']=num(key(d,'Angl'))
        if key(d,'Skew') is not None: raise Unsupported('Transform con sesgo')
        s.addop(xf,'Transform')
    def ev_Align(s,d):
        u=key(d,'Usng'); u=u[2] if isinstance(u,tuple) else u
        m={'AdTp':'top','AdBt':'bottom','AdLf':'left','AdRg':'right','AdCV':'vcenter','AdCH':'hcenter'}.get(u)
        if m is None: raise Unsupported('Align '+str(u))
        s.addop({'op':'align','to':m},'Align')
    def ev_Inverse(s,d): raise Unsupported('Inverse (selección)')
    def ev_Color_Range(s,d): raise Unsupported('Color Range')

def compile_action(act, acts_by_name):
    m=Machine(acts_by_name); m.run(act['steps'])
    vis=[x for x in m.root if x.k!='base']
    # acciones que dejan su resultado oculto (el usuario lo activa luego): como estilo, se muestra
    if vis and all(not x.v for x in vis):
        for x in vis: x.v=True
    layers=[x.out() for x in vis]
    return {'layers':layers}, sorted(set(m.unsupported))
