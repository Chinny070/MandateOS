"""Read-only adapter for the pinned GenLayerPY StudioNet client."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from keeper.archive import CHAIN_ID, HASH_RE


class GenLayerPYReader:
    """Expose receipt/lifecycle/message reads without account or signing setup."""

    def __init__(self, client: Any | None = None):
        if client is None:
            from genlayer_py import create_client, studionet

            client = create_client(chain=studionet)
        self.client = client

    @staticmethod
    def _hash(tx_id: str) -> str:
        if not isinstance(tx_id, str) or not HASH_RE.fullmatch(tx_id):
            raise ValueError("transaction id must be a 32-byte hex hash")
        return tx_id.lower()

    def verify_chain(self) -> str:
        chain_id = int(self.client.w3.eth.chain_id)
        rendered = hex(chain_id)
        if rendered != CHAIN_ID:
            raise RuntimeError("GenLayerPY endpoint is not StudioNet chain ID 61999")
        return rendered

    def get_transaction(self, tx_id: str) -> dict[str, Any]:
        tx_id = self._hash(tx_id)
        self.verify_chain()
        result = self.client.get_transaction(transaction_hash=tx_id)
        if not isinstance(result, dict):
            raise RuntimeError("GenLayerPY returned a malformed transaction")
        return result

    def get_lifecycle(self, tx_id: str) -> dict[str, Any]:
        tx_id = self._hash(tx_id)
        self.verify_chain()
        result = self.client.get_transaction_lifecycle(transaction_hash=tx_id)
        if is_dataclass(result):
            result = asdict(result)
        elif not isinstance(result, dict) and hasattr(result, "__dict__"):
            result = vars(result)
        if not isinstance(result, dict):
            raise RuntimeError("GenLayerPY returned a malformed lifecycle")
        return result

    def get_triggered_transaction_ids(self, tx_id: str) -> list[str]:
        tx_id = self._hash(tx_id)
        self.verify_chain()
        result = self.client.get_triggered_transaction_ids(transaction_hash=tx_id)
        if not isinstance(result, list):
            raise RuntimeError("GenLayerPY returned malformed triggered transaction IDs")
        return [self._hash(item) for item in result]

    def get_balance(self, address: str) -> int:
        if not isinstance(address, str) or len(address) != 42 or not address.startswith("0x"):
            raise ValueError("balance address must be a 20-byte hex address")
        self.verify_chain()
        return int(self.client.w3.eth.get_balance(address))

    def read_contract(self, address: str, function_name: str, args: list[Any]) -> Any:
        from genlayer_py.types import TransactionHashVariant

        self.verify_chain()
        return self.client.read_contract(
            address=address,
            function_name=function_name,
            args=args,
            transaction_hash_variant=TransactionHashVariant.LATEST_FINAL,
        )
