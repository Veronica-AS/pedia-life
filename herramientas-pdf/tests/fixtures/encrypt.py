"""Cifra un PDF: user_pw vacío = solo contraseña de propietario (se abre sin pedir clave pero está cifrado)."""
import sys
from pypdf import PdfReader, PdfWriter
src, dst, user_pw, owner_pw = sys.argv[1:5]
w = PdfWriter(clone_from=PdfReader(src))
w.encrypt(user_password=user_pw, owner_password=owner_pw, algorithm="AES-256")
with open(dst, "wb") as f:
    w.write(f)
