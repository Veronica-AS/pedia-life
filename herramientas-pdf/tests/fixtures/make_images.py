"""Genera imágenes de prueba (escaneo, fotos con EXIF, PNG con transparencia, WEBP, HEIC) y cifra PDFs con pypdf."""
import random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
random.seed(7)

def font(size):
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default(size=size)

# 1) "Escaneo": texto con acentos sobre papel ligeramente gris y con ruido
W, H = 1700, 2200
img = Image.new("L", (W, H), 238)
d = ImageDraw.Draw(img)
lines = [
    "CONTRATO DE ARRENDAMIENTO",
    "",
    "En la ciudad de México, a 12 de noviembre de 2026,",
    "comparecen por una parte el señor José Muñoz Pérez,",
    "y por la otra la señora María Ángeles Núñez Gómez.",
    "",
    "Cláusula primera: el inmueble ubicado en la calle",
    "Benito Juárez número 123 se destinará a vivienda.",
    "Cláusula segunda: la renta mensual será de $8,500.",
    "",
    "Firma del arrendador ______________________",
]
y = 180
for i, line in enumerate(lines):
    d.text((150, y), line, fill=25, font=font(56 if i == 0 else 46))
    y += 120
# firma manuscrita simulada
pts = [(900 + x * 6, 1530 + int(25 * __import__('math').sin(x / 4.0)) + random.randint(-3, 3)) for x in range(90)]
d.line(pts, fill=10, width=5)
px = img.load()
for _ in range(220000):
    x, yy = random.randrange(W), random.randrange(H)
    px[x, yy] = max(0, min(255, px[x, yy] + random.randint(-40, 40)))
img = img.filter(ImageFilter.GaussianBlur(0.6)).rotate(0.7, fillcolor=238).convert("RGB")
img.save(out / "scan.jpg", quality=93)

# 2) Foto tomada con el celular en vertical: píxeles en horizontal + EXIF Orientation=6
photo = Image.new("RGB", (1200, 800))
pd = ImageDraw.Draw(photo)
for yy in range(800):
    pd.line([(0, yy), (1200, yy)], fill=(40 + yy // 6, 120, 200 - yy // 5))
pd.text((60, 60), "ARRIBA", fill=(255, 255, 255), font=font(90))
exif = Image.Exif()
exif[0x0112] = 6
photo.save(out / "photo-exif6.jpg", quality=90, exif=exif.tobytes())

# 3) PNG con transparencia
png = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
ImageDraw.Draw(png).ellipse((50, 50, 550, 350), fill=(230, 60, 60, 255))
png.save(out / "logo.png")

# 4) WEBP
photo.save(out / "photo.webp", quality=85)

# 5) HEIC (iPhone)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    photo.save(out / "photo.heic", quality=80)
except Exception as e:  # pillow-heif opcional
    print("HEIC omitido:", e)

# 6) Versión PNG reducida del escaneo (para PDF con imagen FlateDecode)
Image.open(out / "scan.jpg").resize((1000, 1294)).save(out / "scan-small.png")
