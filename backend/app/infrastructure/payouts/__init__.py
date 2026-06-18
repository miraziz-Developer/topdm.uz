"""Payout (do'konchilarga to'lov) gateway implementatsiyalari."""
from app.infrastructure.payouts.factory import get_payout_gateway

__all__ = ["get_payout_gateway"]
