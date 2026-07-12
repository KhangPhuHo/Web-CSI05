# Buoc 0: Doc anh bia sach bang Gemini Vision, tao mo ta ("visual_description")
# roi LUU LAI vao chinh file products.json.
#
# CHI CAN CHAY KHI: them sach moi, hoac doi anh bia cua 1 sach da co.
# Idempotent: sach nao DA CO "visual_description" se duoc BO QUA, khong goi lai
# Gemini Vision (khong ton API call, khong lam hong mo ta da luu).

import os
import json
import glob
import time
import requests
from dotenv import load_dotenv
load_dotenv()

from step5_image import create_vision_model, describe_image


IMG_DIR = "data/img"
PRODUCTS_JSON_PATH = "data/text/products.json"

# Backend Node dang chay tren Render - noi luu ban products.json "chinh thuc"
# (script nay chay LOCAL, nen phai chu dong goi API de day mo ta len ban tren Render)
RENDER_API_BASE_URL = "https://bookstore-bsjx.onrender.com"

# 3 dinh dang anh bia dang dung: png, jpg/jpeg, webp
IMAGE_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png"]

MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def get_mime_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return MIME_TYPES.get(ext, "image/jpeg")


def get_cover_images(product_id: str, img_dir: str = IMG_DIR) -> list:
    """
    Tra ve danh sach duong dan anh bia cua 1 san pham, ho tro ca 2 kieu luu:
      - File le:       data/img/<product_id>.webp (hoac .jpg/.jpeg/.png)
      - Thu muc rieng: data/img/<product_id>/*.webp (VD front.webp, back.webp)
        dung khi 1 sach co nhieu anh (bia truoc + bia sau...)

    Neu la thu muc rieng, anh dau tien sau khi sap xep ten se duoc dung de
    tao mo ta (nen dat ten kieu "1_front.webp", "2_back.webp" de dam bao
    bia truoc luon duoc doc truoc).
    """
    folder_path = os.path.join(img_dir, product_id)

    if os.path.isdir(folder_path):
        files = []
        for ext in IMAGE_EXTENSIONS:
            files.extend(glob.glob(os.path.join(folder_path, f"*{ext}")))
        return sorted(files)

    for ext in IMAGE_EXTENSIONS:
        single_path = os.path.join(img_dir, f"{product_id}{ext}")
        if os.path.exists(single_path):
            return [single_path]

    return []


def save_products_json(data: dict, path: str = PRODUCTS_JSON_PATH):
    """
    Ghi de lai file products.json MOT CACH AN TOAN:
    ghi ra file tam (.tmp) truoc, sau do moi doi ten de thay the file goc.
    Neu chuong trinh bi ngat giua chung (mat dien, loi API...), file goc
    van con nguyen ven, khong bi ghi dang do / hong du lieu.
    """
    tmp_path = f"{path}.tmp"

    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    os.replace(tmp_path, path)


def wake_up_render(api_base_url: str = RENDER_API_BASE_URL, timeout: int = 60) -> None:
    """
    Render free tier se "ngu" (sleep) sau 1 thoi gian khong co request, va lan
    goi dau tien can 30-50s de "danh thuc" server day len. Neu de vay, lan
    PATCH dau tien trong vong lap se rat de bi timeout.

    Ham nay goi 1 request "danh thuc" TRUOC khi bat dau vong lap chinh, voi
    timeout du dai (60s) va bo qua moi loi (chi can server tinh day len la du,
    khong quan tam response tra ve gi).
    """
    print("Dang danh thuc server tren Render (co the mat 30-50s neu dang ngu)...")

    try:
        requests.get(api_base_url, timeout=timeout)
        print("Server tren Render da san sang.")

    except requests.exceptions.RequestException as e:
        print(f"   Canh bao: khong the danh thuc server truoc: {e}")
        print("   (Van tiep tuc chay - lan PATCH dau tien co the phai tu retry)")


def push_visual_description_to_render(product_id: str, description: str,
                                       api_base_url: str = RENDER_API_BASE_URL,
                                       max_retries: int = 3) -> bool:
    """
    Day mo ta vua tao len ban products.json dang luu tren Render, qua API
    PATCH /api/products-json/:id cua backend Node (xem productsJsonController.js).

    Chi cap nhat DUY NHAT field visual_description, khong dam vao cac field
    khac (name/summary/price/stock...) cua san pham tren Render.

    Tu dong thu lai (retry) toi da `max_retries` lan neu gap loi mang/timeout -
    Render free tier hay bi "ngu" nen lan goi dau co the cham, cac lan sau
    thi nhanh. Tra ve True/False de biet co day thanh cong khong - loi o day
    KHONG lam hong ban local (ban local da luu roi truoc khi goi ham nay).
    """
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.patch(
                f"{api_base_url}/api/products-json/{product_id}",
                json={"visual_description": description},
                timeout=60  # du dai de chiu duoc Render "thuc day" lan dau
            )
            response.raise_for_status()
            return True

        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                wait_seconds = 5 * attempt
                print(f"   Loi lan {attempt}/{max_retries} khi day len Render "
                      f"cho '{product_id}': {e} - thu lai sau {wait_seconds}s...")
                time.sleep(wait_seconds)
            else:
                print(f"   Canh bao: khong the day len Render cho '{product_id}' "
                      f"sau {max_retries} lan thu: {e}")
                return False

    return False


def enrich_covers(json_path: str = PRODUCTS_JSON_PATH, img_dir: str = IMG_DIR,
                   push_to_render: bool = True):
    with open(json_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    vision_model = create_vision_model()

    if push_to_render:
        wake_up_render()

    enriched_count = 0
    skipped_count = 0
    missing_image_count = 0
    pushed_count = 0
    failed_product_ids = []  # gom lai de thu day lai o cuoi, ke ca sach da co san local

    for product_id, product in products.items():

        # Da co mo ta roi -> bo qua, khong goi lai Vision (tiet kiem API, giu nguyen mo ta cu)
        if product.get("visual_description"):
            skipped_count += 1

            # QUAN TRONG: sach nay co the tung bi loi khi day len Render o lan
            # chay truoc (VD do Render dang ngu / timeout) - du DA CO mo ta local,
            # ban tren Render van co the dang thieu field nay. Gom vao danh sach
            # se thu day lai o cuoi, de dam bao 2 ban luon dong bo that su.
            if push_to_render:
                failed_product_ids.append((product_id, product["visual_description"]))

            continue

        cover_paths = get_cover_images(product_id, img_dir)

        if not cover_paths:
            print(f"Khong tim thay anh bia cho '{product.get('name', product_id)}' - bo qua")
            missing_image_count += 1
            continue

        # Uu tien anh dau tien (bia truoc) de tao mo ta
        cover_path = cover_paths[0]
        mime_type = get_mime_type(cover_path)

        print(f"Dang doc anh bia: {product.get('name', product_id)} ({cover_path})")

        with open(cover_path, "rb") as img_f:
            image_bytes = img_f.read()

        description = describe_image(vision_model, image_bytes, mime_type)

        product["visual_description"] = description
        enriched_count += 1

        # Luu ngay sau moi sach - neu script loi giua chung, cac sach da xu ly
        # truoc do van khong bi mat, lan chay sau se tu dong bo qua chung.
        save_products_json(products, json_path)

        # Day len ban tren Render de 2 ban (local + Render) luon dong bo
        if push_to_render:
            if push_visual_description_to_render(product_id, description):
                pushed_count += 1
                print(f"   Da day len Render thanh cong")
            else:
                failed_product_ids.append((product_id, description))

    # Thu day lai TAT CA nhung sach chua chac chan da co tren Render:
    # gom ca sach vua tao moi bi loi, LAN sach da co san local (de phong lan
    # truoc bi timeout giua chung). PATCH la thao tac idempotent (ghi de field
    # visual_description) nen day lai nhieu lan khong gay hai gi.
    push_failed_count = 0

    if push_to_render and failed_product_ids:
        print(f"\nDang thu dong bo lai {len(failed_product_ids)} san pham len Render...")

        still_failed = []

        for product_id, description in failed_product_ids:
            if push_visual_description_to_render(product_id, description):
                pushed_count += 1
            else:
                still_failed.append(product_id)

        push_failed_count = len(still_failed)

        if still_failed:
            print(f"   Van con {push_failed_count} san pham chua dong bo duoc: {still_failed}")
            print(f"   -> Chay lai script nay (co the can vai phut) de thu tiep,")
            print(f"      hoac kiem tra lai server Render co dang hoat dong binh thuong khong.")

    print(f"\nHoan thanh!")
    print(f"   - Da tao mo ta moi:    {enriched_count}")
    print(f"   - Da co san, bo qua:   {skipped_count}")
    print(f"   - Khong co anh bia:    {missing_image_count}")
    if push_to_render:
        print(f"   - Da day len Render:   {pushed_count}")
        print(f"   - Day len Render loi:  {push_failed_count}")


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 0: TAO MO TA ANH BIA (GEMINI VISION)")
    print("=" * 50)

    enrich_covers()