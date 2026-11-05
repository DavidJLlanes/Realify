"""
Cómo se obtuvieron los modelos de assets/models/people/ (Fase 2 del plan). Documentación ejecutable: lee los originales de una carpeta.
Originales (descargados a mano):
  face_landmarker.task, hand_landmarker.task      https://storage.googleapis.com/mediapipe-models/ (Apache-2.0)
  rtmpose-m_simcc-body7_…zip                      https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/ (Apache-2.0)
  segformer_b2_clothes (onnx/model.onnx)          https://huggingface.co/mattmdjaga/segformer_b2_clothes (MIT)
Uso: python3 tools/models/convertir-personas.py <carpeta con los originales> <carpeta de salida>
Necesita: pip install tensorflow-cpu tf2onnx onnx numpy
"""
import sys, subprocess, zipfile, os, shutil
ent, sal = sys.argv[1], sys.argv[2]
os.makedirs(sal, exist_ok=True); tmp = os.path.join(sal, "_tmp"); os.makedirs(tmp, exist_ok=True)
aqui = os.path.dirname(os.path.abspath(__file__))

# 1) MediaPipe: el .task es un zip con varios .tflite; se pasan a ONNX los que se usan
for tarea, modelos in [("face_landmarker.task", ["face_landmarks_detector"]), ("hand_landmarker.task", ["hand_detector", "hand_landmarks_detector"])]:
    with zipfile.ZipFile(os.path.join(ent, tarea)) as z:
        for n in modelos:
            z.extract(n + ".tflite", tmp)
            subprocess.check_call([sys.executable, "-m", "tf2onnx.convert", "--tflite", os.path.join(tmp, n + ".tflite"), "--output", os.path.join(sal, n + ".onnx"), "--opset", "17"])

# 2) RTMPose-m: el zip ya trae end2end.onnx; sólo se pasan los pesos a fp16
with zipfile.ZipFile(os.path.join(ent, [f for f in os.listdir(ent) if f.startswith("rtmpose-m")][0])) as z:
    ruta = [n for n in z.namelist() if n.endswith("end2end.onnx")][0]
    z.extract(ruta, tmp)
subprocess.check_call([sys.executable, os.path.join(aqui, "pesos-fp16.py"), os.path.join(tmp, ruta), os.path.join(sal, "rtmpose_m_body7_fp16.onnx")])

# 3) SegFormer: pesos a fp16
subprocess.check_call([sys.executable, os.path.join(aqui, "pesos-fp16.py"), os.path.join(ent, "onnx", "model.onnx"), os.path.join(sal, "segformer_b2_clothes_fp16.onnx")])
shutil.rmtree(tmp)
print("Listo en", sal, "· calcula las huellas con: node tools/models/sha256.mjs <archivo>")
