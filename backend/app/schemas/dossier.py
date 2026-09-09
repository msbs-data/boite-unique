from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DossierBase(BaseModel):
    code: str
    raison_sociale: str
    alias: str
    actif: bool = True


class DossierCreate(DossierBase):
    pass


class DossierOut(DossierBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
