from app.infrastructure.tasks.inventory_tasks import process_merchant_image_task


async def on_product_photo_received(image_bytes: bytes) -> dict:
    task = process_merchant_image_task.delay(image_bytes)
    return {"message": "Rasm qabul qilindi, listing tayyorlanmoqda.", "task_id": task.id}
