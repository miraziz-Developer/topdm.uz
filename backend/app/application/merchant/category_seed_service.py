from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.category_catalog import CLOTHING_CATEGORY_TREE, FULL_BAZAAR_CATEGORY_TREE
from app.infrastructure.db.models import CategoryModel


class CategorySeedService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def ensure_clothing_catalog(self) -> dict[str, int]:
        """Idempotent: kiyim kategoriyalari."""
        return await self._ensure_tree(CLOTHING_CATEGORY_TREE)

    async def ensure_bazaar_catalog(self) -> dict[str, int]:
        """Kiyim + Abu Sahiy/Ippodrom keng katalog (matolar, texnika, uy va h.k.)."""
        return await self._ensure_tree(FULL_BAZAAR_CATEGORY_TREE)

    async def get_or_create_subcategory(self, root_name: str, sub_name: str) -> CategoryModel:
        """AI yoki merchant nomidan yangi sub-kategoriya — kerak bo'lsa root ham yaratiladi."""
        root_name = root_name.strip()
        sub_name = sub_name.strip()
        if not root_name or not sub_name:
            raise ValueError("category_names_required")
        root, _ = await self._get_or_create(name=root_name, parent_id=None, icon="🏷️", sort_order=90)
        sub, _ = await self._get_or_create(name=sub_name, parent_id=root.id, icon=None, sort_order=900)
        await self._session.commit()
        return sub

    async def _ensure_tree(self, tree: list) -> dict[str, int]:
        """Idempotent: root + sub kategoriyalarni yaratadi yoki mavjudini qoldiradi."""
        created_roots = 0
        created_subs = 0
        for root_def in tree:
            root, root_created = await self._get_or_create(
                name=root_def["name"],
                parent_id=None,
                icon=root_def.get("icon"),
                sort_order=root_def["sort_order"],
            )
            if root_created:
                created_roots += 1
            for i, sub_name in enumerate(root_def["subs"]):
                _, sub_created = await self._get_or_create(
                    name=sub_name,
                    parent_id=root.id,
                    icon=None,
                    sort_order=root_def["sort_order"] * 100 + i,
                )
                if sub_created:
                    created_subs += 1
        await self._session.commit()
        count_result = await self._session.execute(select(CategoryModel))
        all_cats = list(count_result.scalars().all())
        return {
            "created_roots": created_roots,
            "created_subs": created_subs,
            "total": len(all_cats),
        }

    async def _get_or_create(
        self,
        *,
        name: str,
        parent_id,
        icon: str | None,
        sort_order: int,
    ) -> tuple[CategoryModel, bool]:
        stmt = select(CategoryModel).where(CategoryModel.name == name)
        if parent_id is None:
            stmt = stmt.where(CategoryModel.parent_id.is_(None))
        else:
            stmt = stmt.where(CategoryModel.parent_id == parent_id)
        result = await self._session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            return existing, False
        row = CategoryModel(
            name=name,
            parent_id=parent_id,
            icon=icon,
            sort_order=sort_order,
        )
        self._session.add(row)
        await self._session.flush()
        return row, True
