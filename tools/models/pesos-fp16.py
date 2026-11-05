"""
Pasa los pesos de un ONNX a float16 SIN cambiar el cálculo (que sigue en float32): cada peso grande se guarda en fp16 y un nodo Cast
lo devuelve a fp32 al cargar. El archivo pesa la mitad y el resultado es casi idéntico (la conversión completa a fp16 falla con
operadores como Resize). Se usó para RTMPose-m (54→27 MB) y SegFormer-B2 (110→55 MB).
Uso: python3 tools/models/pesos-fp16.py entrada.onnx salida.onnx      (necesita: pip install onnx numpy)
"""
import sys, numpy as np, onnx
from onnx import numpy_helper, TensorProto, helper

src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src); g = m.graph; keep, casts = [], []
for n, t in enumerate(list(g.initializer)):
    if t.data_type == TensorProto.FLOAT and int(np.prod(t.dims)) > 1024:
        nombre = t.name + "__fp16"
        keep.append(numpy_helper.from_array(numpy_helper.to_array(t).astype(np.float16), nombre))
        casts.append(helper.make_node("Cast", [nombre], [t.name], to=TensorProto.FLOAT, name=f"cast_{n}"))
    else:
        keep.append(t)
del g.initializer[:]; g.initializer.extend(keep)
nodos = list(g.node); del g.node[:]; g.node.extend(casts + nodos)
onnx.save(m, dst)
print(f"{len(casts)} pesos pasados a fp16 → {dst}")
