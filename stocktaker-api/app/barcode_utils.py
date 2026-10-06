"""Barcode generation (for items registered with no existing barcode) and
decoding (for the web dashboard's photo-upload scan flow - the mobile app
decodes on-device and just sends the app the resulting text).
"""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass

from PIL import Image
import barcode as pybarcode
from barcode.writer import ImageWriter
from pyzbar.pyzbar import decode as _zbar_decode


@dataclass
class DecodedBarcode:
    data: str
    symbology: str


def decode_barcodes_from_bytes(image_bytes: bytes) -> list[DecodedBarcode]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = _zbar_decode(image)
    decoded = []
    for r in results:
        try:
            text = r.data.decode("utf-8")
        except UnicodeDecodeError:
            text = r.data.decode("latin-1", errors="replace")
        decoded.append(DecodedBarcode(data=text, symbology=r.type))
    return decoded


def generate_barcode_value(category_code: str, is_unique) -> str:
    category_code = (category_code or "ITM").strip().upper()[:8]
    for _ in range(20):
        candidate = f"{category_code}-{uuid.uuid4().hex[:8].upper()}"
        if is_unique(candidate):
            return candidate
    raise RuntimeError("Could not generate a unique barcode value; try again.")


def render_barcode_png_bytes(value: str) -> bytes:
    code128 = pybarcode.get_barcode_class("code128")
    writer = ImageWriter()
    writer.set_options({"write_text": False, "module_height": 12.0, "quiet_zone": 2.0})
    buf = io.BytesIO()
    code128(value, writer=writer).write(buf)
    return buf.getvalue()
