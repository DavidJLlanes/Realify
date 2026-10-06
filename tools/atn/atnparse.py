import struct, sys
class R:
    def __init__(s,d): s.d=d; s.p=0
    def u8(s): v=s.d[s.p]; s.p+=1; return v
    def u16(s): v=struct.unpack('>H',s.d[s.p:s.p+2])[0]; s.p+=2; return v
    def u32(s): v=struct.unpack('>I',s.d[s.p:s.p+4])[0]; s.p+=4; return v
    def i32(s): v=struct.unpack('>i',s.d[s.p:s.p+4])[0]; s.p+=4; return v
    def f64(s): v=struct.unpack('>d',s.d[s.p:s.p+8])[0]; s.p+=8; return v
    def raw(s,n): v=s.d[s.p:s.p+n]; s.p+=n; return v
    def uni(s):
        n=s.u32(); v=s.raw(2*n).decode('utf-16-be',errors='replace'); return v.rstrip('\0')
    def asc(s):          # id: u32 len (0 → 4 bytes)
        n=s.u32(); return s.raw(n if n else 4).decode('latin-1')
def descriptor(r):
    name=r.uni(); cls=r.asc(); n=r.u32(); items={}
    for _ in range(n):
        key=r.asc(); items[key]=value(r)
    return {'_cls':cls,'_name':name,**items}
def value(r):
    t=r.raw(4).decode('latin-1')
    if t=='Objc': return descriptor(r)
    if t=='GlbO': return descriptor(r)
    if t=='VlLs':
        n=r.u32(); return [value(r) for _ in range(n)]
    if t=='doub': return r.f64()
    if t=='long': return r.i32()
    if t=='bool': return bool(r.u8())
    if t=='TEXT': return r.uni()
    if t=='UntF': u=r.raw(4).decode('latin-1'); return (u,r.f64())
    if t=='enum': a=r.asc(); b=r.asc(); return ('enum',a,b)
    if t=='type' or t=='GlbC': name=r.uni(); c=r.asc(); return ('class',c)
    if t=='obj ':
        n=r.u32(); out=[]
        for _ in range(n):
            tt=r.raw(4).decode('latin-1')
            if tt=='prop': r.uni(); r.asc(); k=r.asc(); out.append(('prop',k))
            elif tt=='Clss': r.uni(); out.append(('Clss',r.asc()))
            elif tt=='Enmr': r.uni(); r.asc(); r.asc(); out.append(('Enmr',r.asc()))
            elif tt=='rele': r.uni(); r.asc(); out.append(('rele',r.i32()))
            elif tt=='Idnt': out.append(('Idnt',r.i32()))
            elif tt=='indx': out.append(('indx',r.i32()))
            elif tt=='name': r.uni(); r.asc(); out.append(('name',r.uni()))
            else: raise ValueError('ref '+tt)
        return ('ref',out)
    if t=='alis' or t=='tdta' or t=='Pth ':
        n=r.u32(); return ('data',t,r.raw(n))
    if t=='ObAr': raise ValueError('ObAr')
    raise ValueError('tipo '+t+' en '+hex(r.p))
def parse(path):
    d=open(path,'rb').read(); r=R(d)
    ver=r.u32(); setname=r.uni(); r.u8(); na=r.u32(); acts=[]
    for _ in range(na):
        r.u16(); r.u8(); r.u8(); r.u16(); name=r.uni(); r.u8(); ns=r.u32(); steps=[]
        for _ in range(ns):
            exp=r.u8(); en=r.u8(); dlg=r.u8(); dopt=r.u8()
            tag=r.raw(4).decode('latin-1')
            ev=(r.raw(r.u32()) if tag=='TEXT' else r.raw(4)).decode('latin-1')   # id de evento (TEXT: con longitud; long: OSType)
            nm=r.raw(r.u32()).decode('latin-1')   # nombre
            dn=r.i32()                              # -1: sin texto de diccionario; sigue el descriptor
            if dn>0: r.raw(dn)
            desc=descriptor(r) if dn!=0 else {}
            steps.append({'on':bool(en),'dlg':bool(dlg),'event':ev,'name':nm,'d':desc})
        acts.append({'name':name,'steps':steps})
    assert r.p==len(d),(r.p,len(d))
    return {'set':setname,'actions':acts}
if __name__=='__main__':
    import json
    j=parse(sys.argv[1]); print(j['set'],len(j['actions']))
